import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
import { recordPayout } from "./lib/stripe";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

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
    const dinnerId = body.dinnerId as string | undefined;
    if (!dinnerId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "dinnerId required" }) };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);
    const host = await getApprovedHostForMember(appUser.id);
    if (!host || !(await hostOwnsDinner(host.id, dinnerId))) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
    }

    const rows = await sql`
      SELECT chef_id, meal_price_per_guest, max_seats, t7_ingredient_paid
      FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    const meal = rows[0] as {
      chef_id: string | null;
      meal_price_per_guest: number | null;
      max_seats: number;
      t7_ingredient_paid: boolean;
    } | undefined;
    if (!meal?.chef_id || !meal.meal_price_per_guest) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Meal not ready for remainder payout" }) };
    }

    const pot = Number(meal.meal_price_per_guest) * meal.max_seats;
    const remainder = pot * 0.5;

    await recordPayout({
      dinnerId,
      chefId: meal.chef_id,
      kind: "chef_remainder",
      amount: remainder,
      status: "pending",
    });
    await sql`UPDATE dinners SET status = 'complete' WHERE id = ${dinnerId}`;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, amount: remainder }) };
  } catch (e) {
    console.error("host-trigger-chef-remainder", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
