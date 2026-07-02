import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { sql } from "./lib/db";
import { createCheckoutSession, recordPayment, stripeEnabled } from "./lib/stripe";

const jsonHeaders = { "Content-Type": "application/json" };

async function getAttendanceFee(): Promise<number> {
  const rows = await sql`
    SELECT attendance_fee_enabled, attendance_fee_amount FROM platform_settings WHERE id = true LIMIT 1
  `;
  const s = rows[0] as { attendance_fee_enabled: boolean; attendance_fee_amount: number } | undefined;
  if (!s?.attendance_fee_enabled) return 0;
  return Number(s.attendance_fee_amount) || 0;
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const mealId = body.mealId as string | undefined;
    if (!mealId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "mealId required" }) };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);
    if (!appUser.profile_complete) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Complete your profile before paying" }) };
    }

    const attRows = await sql`
      SELECT status FROM dinner_guests
      WHERE dinner_id = ${mealId} AND member_id = ${appUser.id} LIMIT 1
    `;
    const att = attRows[0] as { status: string } | undefined;
    if (!att || (att.status !== "approved" && att.status !== "invited")) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Host must approve your seat first" }) };
    }

    const mealRows = await sql`
      SELECT meal_price_per_guest FROM dinners WHERE id = ${mealId} LIMIT 1
    `;
    const price = Number((mealRows[0] as { meal_price_per_guest: number | null } | undefined)?.meal_price_per_guest);
    if (!Number.isFinite(price) || price <= 0) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Meal price not set" }) };
    }

    const fee = await getAttendanceFee();
    const total = price + fee;
    const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? "http://localhost:8888";

    if (!stripeEnabled()) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, mode: "demo", amount: total }),
      };
    }

    const checkout = await createCheckoutSession({
      amountCents: Math.round(total * 100),
      customerEmail: netlifyUser.email ?? "",
      metadata: { dinnerId: mealId, memberId: appUser.id },
      successUrl: `${siteUrl}/members/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${siteUrl}/members/?paid=0`,
    });

    if (!checkout.ok) {
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: checkout.error }) };
    }
    if (checkout.mode === "demo") {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, mode: "demo", amount: total }) };
    }

    await recordPayment({
      dinnerId: mealId,
      memberId: appUser.id,
      kind: "guest_seat",
      amount: price,
      stripePaymentIntentId: checkout.sessionId,
    });
    if (fee > 0) {
      await recordPayment({
        dinnerId: mealId,
        memberId: appUser.id,
        kind: "attendance_fee",
        amount: fee,
        stripePaymentIntentId: checkout.sessionId,
      });
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, mode: "stripe", url: checkout.url }),
    };
  } catch (e) {
    console.error("create-checkout", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
