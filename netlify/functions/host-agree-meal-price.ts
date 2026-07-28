import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const body = JSON.parse(event.body || "{}");
    const dinnerId = body.dinnerId as string | undefined;
    const agree = Boolean(body.agree);
    if (!dinnerId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "dinnerId required" }) };
    }

    const appUser = await requireApprovedMember(context);
    const host = await getApprovedHostForMember(appUser.id);
    if (!host || !(await hostOwnsDinner(host.id, dinnerId))) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
    }

    const mealRows = await sql`
      SELECT meal_price_per_guest FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    if (!mealRows[0] || (mealRows[0] as { meal_price_per_guest: number | null }).meal_price_per_guest == null) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Chef has not set a price yet" }) };
    }

    await sql`
      UPDATE dinners
      SET price_agreed_by_host = ${agree},
          status = CASE WHEN ${agree} THEN 'dual_confirm_pending' ELSE status END
      WHERE id = ${dinnerId}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("host-agree-meal-price", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
