/**
 * Stripe helpers — platform Checkout (interim), not Stripe Connect.
 *
 * Collect: Checkout Sessions charge the platform Stripe account.
 * Ledger: `payments` / `payouts` rows are app bookkeeping for ops (ingredient,
 * remainder, subsidy). They are not Connect transfers or Stripe escrow.
 * Demo: opt-in via ALLOW_DEMO_PAYMENTS=true; hard-blocked when CONTEXT=production.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { countPaidSeats } from "./meal";
import { sql } from "./db";

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function stripeWebhookEnabled(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

/** True only when demo fulfillment is explicitly enabled and not production. */
export function demoPaymentsAllowed(): boolean {
  if (process.env.ALLOW_DEMO_PAYMENTS?.trim() !== "true") return false;
  if (process.env.CONTEXT === "production") return false;
  return true;
}

export type PaymentsReady =
  | { ok: true; mode: "stripe" | "demo" }
  | { ok: false; error: string; status: number };

/** Fail closed unless Stripe is configured or demo mode is explicitly allowed. */
export function requirePaymentsReady(): PaymentsReady {
  if (stripeEnabled()) return { ok: true, mode: "stripe" };
  if (demoPaymentsAllowed()) return { ok: true, mode: "demo" };
  return {
    ok: false,
    status: 503,
    error:
      "Payments are not configured. Set STRIPE_SECRET_KEY, or ALLOW_DEMO_PAYMENTS=true for non-production only.",
  };
}

export type CheckoutSessionResult =
  | { ok: true; mode: "stripe"; sessionId: string; url: string }
  | { ok: true; mode: "demo" }
  | { ok: false; error: string };

type StripeCheckoutSession = {
  id: string;
  payment_status: string;
  payment_intent: string | null;
  metadata?: Record<string, string>;
};

async function stripeRequest<T>(path: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return { ok: false, error: "Stripe not configured" };

  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }

  return { ok: true, data: (await res.json()) as T };
}

export async function createCheckoutSession(params: {
  amountCents: number;
  customerEmail: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSessionResult> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    if (demoPaymentsAllowed()) return { ok: true, mode: "demo" };
    return {
      ok: false,
      error:
        "Payments are not configured. Set STRIPE_SECRET_KEY, or ALLOW_DEMO_PAYMENTS=true for non-production only.",
    };
  }

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("customer_email", params.customerEmail);
  body.set("success_url", params.successUrl);
  body.set("cancel_url", params.cancelUrl);
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(params.amountCents));
  body.set("line_items[0][price_data][product_data][name]", "Supper Collective seat");
  body.set("line_items[0][quantity]", "1");
  for (const [k, v] of Object.entries(params.metadata)) {
    body.set(`metadata[${k}]`, v);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    return { ok: false, error: await res.text() };
  }

  const json = (await res.json()) as { id: string; url: string };
  return { ok: true, mode: "stripe", sessionId: json.id, url: json.url };
}

export async function retrieveCheckoutSession(sessionId: string): Promise<
  { ok: true; session: StripeCheckoutSession } | { ok: false; error: string }
> {
  const result = await stripeRequest<StripeCheckoutSession>(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`
  );
  if (!result.ok) return result;
  return { ok: true, session: result.data };
}

export function verifyStripeWebhook(payload: string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader?.trim()) return false;

  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t") timestamp = Number.parseInt(value, 10);
    else if (key === "v1") signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  return signatures.some((sig) => {
    try {
      const sigBuf = Buffer.from(sig, "hex");
      return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
    } catch {
      return false;
    }
  });
}

export type FulfillGuestCheckoutResult =
  | { ok: true; alreadyPaid: boolean; mealFull: boolean }
  | { ok: false; error: string };

/** Mark a guest seat paid after Stripe checkout completes (idempotent). */
export async function fulfillGuestCheckout(params: {
  dinnerId: string;
  memberId: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
}): Promise<FulfillGuestCheckoutResult> {
  const { dinnerId, memberId, stripeSessionId, stripePaymentIntentId } = params;

  const attRows = await sql`
    SELECT status FROM dinner_guests
    WHERE dinner_id = ${dinnerId} AND member_id = ${memberId}
    LIMIT 1
  `;
  const att = attRows[0] as { status: string } | undefined;
  if (!att) {
    return { ok: false, error: "Attendance not found" };
  }

  const alreadyPaid = att.status === "paid" || att.status === "confirmed" || att.status === "attended";
  if (!alreadyPaid && att.status !== "approved" && att.status !== "invited") {
    return { ok: false, error: "Guest not eligible for payment" };
  }

  if (!alreadyPaid) {
    await sql`
      UPDATE dinner_guests
      SET status = 'paid', paid_at = now()
      WHERE dinner_id = ${dinnerId} AND member_id = ${memberId}
    `;
  }

  const paymentRef = stripePaymentIntentId ?? stripeSessionId;
  await sql`
    UPDATE payments
    SET stripe_payment_intent_id = ${paymentRef}, updated_at = now()
    WHERE dinner_id = ${dinnerId}
      AND member_id = ${memberId}
      AND stripe_payment_intent_id = ${stripeSessionId}
  `;

  const mealRows = await sql`
    SELECT max_seats, status FROM dinners WHERE id = ${dinnerId} LIMIT 1
  `;
  const meal = mealRows[0] as { max_seats: number; status: string } | undefined;
  if (!meal) {
    return { ok: true, alreadyPaid, mealFull: false };
  }

  const paidCount = await countPaidSeats(dinnerId);
  const mealFull = paidCount >= meal.max_seats;
  if (mealFull && meal.status === "live") {
    await sql`UPDATE dinners SET status = 'full' WHERE id = ${dinnerId}`;
  }

  return { ok: true, alreadyPaid, mealFull };
}

export async function failCheckoutSessionPayments(sessionId: string): Promise<void> {
  await sql`
    UPDATE payments
    SET status = 'failed', updated_at = now()
    WHERE stripe_payment_intent_id = ${sessionId} AND status = 'held'
  `;
}

export async function recordPayment(params: {
  dinnerId: string;
  memberId: string;
  kind: "guest_seat" | "host_seat" | "host_subsidy" | "attendance_fee";
  amount: number;
  stripePaymentIntentId?: string | null;
}): Promise<void> {
  await sql`
    INSERT INTO payments (dinner_id, member_id, kind, amount, status, stripe_payment_intent_id)
    VALUES (
      ${params.dinnerId},
      ${params.memberId},
      ${params.kind},
      ${params.amount},
      'held',
      ${params.stripePaymentIntentId ?? null}
    )
  `;
}

export async function recordPayout(params: {
  dinnerId: string;
  chefId: string;
  kind: "chef_ingredient_auto" | "chef_remainder" | "host_subsidy_refund";
  amount: number;
  status?: "pending" | "paid" | "paused";
}): Promise<void> {
  await sql`
    INSERT INTO payouts (dinner_id, chef_id, kind, amount, status)
    VALUES (
      ${params.dinnerId},
      ${params.chefId},
      ${params.kind},
      ${params.amount},
      ${params.status ?? "pending"}
    )
  `;
}
