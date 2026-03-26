import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
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
    const mealId = body.mealId as string | undefined;
    if (!mealId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "mealId required" }) };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);

    const mealRows = await sql`
      SELECT id, status, max_seats FROM meals WHERE id = ${mealId} LIMIT 1
    `;
    const meal = mealRows[0] as { id: string; status: string; max_seats: number } | undefined;

    if (!meal) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Meal not found" }) };
    }

    if (meal.status !== "live") {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Meal is not open for attendance requests" }),
      };
    }

    const countRows = await sql`
      SELECT count(*)::int AS c FROM attendances
      WHERE meal_id = ${mealId} AND status IN ('paid', 'confirmed')
    `;
    const taken = (countRows[0] as { c: number } | undefined)?.c ?? 0;
    if (taken >= meal.max_seats) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Meal is full" }) };
    }

    await sql`
      INSERT INTO attendances (user_id, meal_id, status)
      VALUES (${appUser.id}, ${mealId}, 'waitlisted')
      ON CONFLICT (user_id, meal_id) DO UPDATE SET status = EXCLUDED.status
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("request-attendance", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};
