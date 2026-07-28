import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
import { countPaidSeats } from "./lib/meal";
import { recordPayment, requirePaymentsReady, stripeEnabled } from "./lib/stripe";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const body = JSON.parse(event.body || "{}");
    const dinnerId = body.dinnerId as string | undefined;
    if (!dinnerId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "dinnerId required" }) };
    }

    const appUser = await requireApprovedMember(context);
    const host = await getApprovedHostForMember(appUser.id);
    if (!host || !(await hostOwnsDinner(host.id, dinnerId))) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
    }

    const mealRows = await sql`
      SELECT max_seats, meal_price_per_guest FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    const meal = mealRows[0] as { max_seats: number; meal_price_per_guest: number | null } | undefined;
    if (!meal?.meal_price_per_guest) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Meal price not set" }) };
    }

    const paid = await countPaidSeats(dinnerId);
    const shortfall = Math.max(0, meal.max_seats - paid);
    if (shortfall <= 0) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "No subsidy needed" }) };
    }

    const amount = shortfall * Number(meal.meal_price_per_guest);

    const payments = requirePaymentsReady();
    if (!payments.ok) {
      return {
        statusCode: payments.status,
        headers: jsonHeaders,
        body: JSON.stringify({ error: payments.error }),
      };
    }

    if (!stripeEnabled()) {
      await sql`
        UPDATE dinners
        SET subsidy_required = true,
            subsidy_paid_amount = subsidy_paid_amount + ${amount},
            status = 'subsidy_pending'
        WHERE id = ${dinnerId}
      `;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, mode: "demo", amount }) };
    }

    await recordPayment({
      dinnerId,
      memberId: appUser.id,
      kind: "host_subsidy",
      amount,
    });
    await sql`
      UPDATE dinners
      SET subsidy_required = true,
          subsidy_paid_amount = subsidy_paid_amount + ${amount},
          status = 'subsidy_pending'
      WHERE id = ${dinnerId}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, mode: "stripe", amount }) };
  } catch (e) {
    console.error("host-pay-subsidy", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
