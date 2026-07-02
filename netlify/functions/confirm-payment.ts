import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { fulfillGuestCheckout, recordPayment, retrieveCheckoutSession, stripeEnabled } from "./lib/stripe";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

/**
 * Payment: marks attendance as paid (demo) or after Stripe checkout.
 * In Stripe mode, requires sessionId and verifies payment with Stripe before fulfilling.
 */
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
    const sessionId = body.sessionId as string | undefined;
    if (!mealId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "mealId required" }) };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);
    if (!appUser.profile_complete) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Complete your profile before paying" }) };
    }

    if (stripeEnabled()) {
      if (!sessionId) {
        return {
          statusCode: 400,
          headers: jsonHeaders,
          body: JSON.stringify({ error: "sessionId required after Stripe checkout" }),
        };
      }

      const sessionResult = await retrieveCheckoutSession(sessionId);
      if (!sessionResult.ok) {
        return { statusCode: 502, headers: jsonHeaders, body: JSON.stringify({ error: "Could not verify payment" }) };
      }

      const { session } = sessionResult;
      if (session.payment_status !== "paid") {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Payment not completed" }) };
      }

      const metaDinnerId = session.metadata?.dinnerId;
      const metaMemberId = session.metadata?.memberId;
      if (metaDinnerId !== mealId || metaMemberId !== appUser.id) {
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Payment does not match this meal" }) };
      }

      const result = await fulfillGuestCheckout({
        dinnerId: mealId,
        memberId: appUser.id,
        stripeSessionId: session.id,
        stripePaymentIntentId: session.payment_intent,
      });
      if (!result.ok) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: result.error }) };
      }

      const countRows = await sql`
        SELECT count(*)::int AS c FROM dinner_guests
        WHERE dinner_id = ${mealId} AND status IN ('paid', 'confirmed', 'attended')
      `;
      const paidCount = (countRows[0] as { c: number } | undefined)?.c ?? 0;
      const mealRows = await sql`SELECT max_seats FROM dinners WHERE id = ${mealId} LIMIT 1`;
      const maxSeats = (mealRows[0] as { max_seats: number } | undefined)?.max_seats ?? 0;

      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          ok: true,
          paidCount,
          maxSeats,
          mealFull: result.mealFull,
          alreadyPaid: result.alreadyPaid,
        }),
      };
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
      SELECT id, max_seats, status, meal_price_per_guest FROM dinners WHERE id = ${mealId} LIMIT 1
    `;
    const meal = mealRows[0] as
      | { id: string; max_seats: number; status: string; meal_price_per_guest: number | null }
      | undefined;

    if (!meal) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Meal not found" }) };
    }

    const price = Number(meal.meal_price_per_guest) || 0;

    await sql`
      UPDATE dinner_guests
      SET status = 'paid', paid_at = now()
      WHERE dinner_id = ${mealId} AND member_id = ${appUser.id}
    `;

    if (price > 0) {
      await recordPayment({
        dinnerId: mealId,
        memberId: appUser.id,
        kind: "guest_seat",
        amount: price,
      });
    }

    const countRows = await sql`
      SELECT count(*)::int AS c FROM dinner_guests
      WHERE dinner_id = ${mealId} AND status IN ('paid', 'confirmed', 'attended')
    `;
    const paidCount = (countRows[0] as { c: number } | undefined)?.c ?? 0;

    if (paidCount >= meal.max_seats && meal.status === "live") {
      await sql`UPDATE dinners SET status = 'full' WHERE id = ${mealId}`;
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, paidCount, maxSeats: meal.max_seats, mealFull: paidCount >= meal.max_seats }),
    };
  } catch (e) {
    console.error("confirm-payment", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};
