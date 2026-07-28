import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";
import { countPaidSeats } from "./lib/meal";

const jsonHeaders = { "Content-Type": "application/json" };

/** Public live meals — safe columns only (no host address / contact). */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const meals = await sql`
      SELECT
        id, title, month, year, neighborhood, chef_name, status, max_seats,
        display_date, meal_price_per_guest, food_genre, drink_pairing, menu_line, zip
      FROM dinners
      WHERE is_visible = true AND status IN ('live', 'full')
      ORDER BY display_date ASC NULLS LAST, created_at ASC
    `;

    const enriched = [];
    for (const meal of meals as Record<string, unknown>[]) {
      const paidCount = await countPaidSeats(meal.id as string);
      const maxSeats = meal.max_seats as number;
      enriched.push({
        ...meal,
        paidCount,
        maxSeats,
        isFull: meal.status === "full" || paidCount >= maxSeats,
      });
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, meals: enriched }) };
  } catch (e) {
    console.error("get-public-meals", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
