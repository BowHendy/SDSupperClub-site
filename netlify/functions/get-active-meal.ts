import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const meals = await sql`
      SELECT * FROM dinners
      WHERE is_visible = true AND status IN ('live', 'upcoming', 'full')
      ORDER BY
        CASE status WHEN 'live' THEN 0 WHEN 'full' THEN 1 ELSE 2 END,
        created_at ASC
      LIMIT 1
    `;

    const meal = meals[0] as Record<string, unknown> | undefined;
    if (!meal) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ meal: null }) };
    }

    const countRows = await sql`
      SELECT count(*)::int AS c FROM dinner_guests
      WHERE dinner_id = ${meal.id as string} AND status IN ('paid', 'confirmed')
    `;
    const confirmedCount = (countRows[0] as { c: number } | undefined)?.c ?? 0;
    const maxSeats = meal.max_seats as number;
    const isFull = meal.status === "full" || confirmedCount >= maxSeats;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        meal,
        confirmedCount,
        maxSeats,
        isFull,
      }),
    };
  } catch (e) {
    console.error("get-active-meal", e);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
