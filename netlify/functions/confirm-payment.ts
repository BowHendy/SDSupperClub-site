import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

/**
 * Payment stub: marks attendance as paid and may close the meal when seats are filled.
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
    if (!mealId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "mealId required" }) };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);

    await sql`
      INSERT INTO dinner_guests (dinner_id, member_id, status)
      VALUES (${mealId}, ${appUser.id}, 'paid')
      ON CONFLICT (dinner_id, member_id) DO UPDATE SET status = EXCLUDED.status
    `;

    const mealRows = await sql`
      SELECT id, max_seats, status FROM dinners WHERE id = ${mealId} LIMIT 1
    `;
    const meal = mealRows[0] as { id: string; max_seats: number; status: string } | undefined;

    if (!meal) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Meal not found" }) };
    }

    const countRows = await sql`
      SELECT count(*)::int AS c FROM dinner_guests
      WHERE dinner_id = ${mealId} AND status IN ('paid', 'confirmed')
    `;
    const paidCount = (countRows[0] as { c: number } | undefined)?.c ?? 0;
    const maxSeats = meal.max_seats;

    if (paidCount >= maxSeats && meal.status === "live") {
      await sql`UPDATE dinners SET status = 'full' WHERE id = ${mealId}`;

      const nextRows = await sql`
        SELECT id FROM dinners
        WHERE status = 'upcoming' AND is_visible = true
        ORDER BY created_at ASC
        LIMIT 1
      `;
      const nextId = (nextRows[0] as { id: string } | undefined)?.id;
      if (nextId) {
        await sql`UPDATE dinners SET status = 'live' WHERE id = ${nextId}`;
      }
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, paidCount, maxSeats, mealFull: paidCount >= maxSeats }),
    };
  } catch (e) {
    console.error("confirm-payment", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};
