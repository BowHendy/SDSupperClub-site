import type { Handler } from "@netlify/functions";
import {
  failCheckoutSessionPayments,
  fulfillGuestCheckout,
  stripeWebhookEnabled,
  verifyStripeWebhook,
} from "./lib/stripe";

const jsonHeaders = { "Content-Type": "application/json" };

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  if (!stripeWebhookEnabled()) {
    return { statusCode: 503, headers: jsonHeaders, body: JSON.stringify({ error: "Webhook not configured" }) };
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET!.trim();
  const signature = event.headers["stripe-signature"] ?? event.headers["Stripe-Signature"];
  const body = event.body ?? "";

  if (!verifyStripeWebhook(body, signature, secret)) {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Invalid signature" }) };
  }

  let stripeEvent: StripeEvent;
  try {
    stripeEvent = JSON.parse(body) as StripeEvent;
  } catch {
    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  try {
    switch (stripeEvent.type) {
      case "checkout.session.completed": {
        const session = stripeEvent.data.object;
        if (session.payment_status !== "paid") break;

        const dinnerId = session.metadata && typeof session.metadata === "object"
          ? (session.metadata as Record<string, string>).dinnerId
          : undefined;
        const memberId = session.metadata && typeof session.metadata === "object"
          ? (session.metadata as Record<string, string>).memberId
          : undefined;

        if (!dinnerId || !memberId || typeof session.id !== "string") {
          console.error("stripe-webhook: checkout.session.completed missing metadata", session.id);
          break;
        }

        const paymentIntent =
          typeof session.payment_intent === "string" ? session.payment_intent : null;

        const result = await fulfillGuestCheckout({
          dinnerId,
          memberId,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntent,
        });
        if (!result.ok) {
          console.error("stripe-webhook: fulfill failed", result.error, session.id);
        }
        break;
      }
      case "checkout.session.expired": {
        const session = stripeEvent.data.object;
        if (typeof session.id === "string") {
          await failCheckoutSessionPayments(session.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("stripe-webhook", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }

  return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ received: true }) };
};
