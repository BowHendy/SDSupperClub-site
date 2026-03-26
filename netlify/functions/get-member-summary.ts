import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

function pickActiveMeal(meals: Record<string, unknown>[]) {
  const list = [...meals].sort((a, b) => {
    const order = (s: string) => (s === "live" ? 0 : s === "full" ? 1 : 2);
    const diff = order(a.status as string) - order(b.status as string);
    if (diff !== 0) return diff;
    return new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
  });
  return list[0] ?? null;
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const appUser = await getOrCreateAppUser(netlifyUser);

    const meals = await sql`
      SELECT * FROM dinners
      WHERE is_visible = true AND status IN ('live', 'upcoming', 'full')
    `;

    const meal = pickActiveMeal((meals ?? []) as Record<string, unknown>[]);
    let attendance = null as Record<string, unknown> | null;
    let confirmedCount = 0;
    let isFull = false;

    if (meal) {
      const mealId = meal.id as string;
      const attRows = await sql`
        SELECT * FROM dinner_guests
        WHERE member_id = ${appUser.id} AND dinner_id = ${mealId}
        LIMIT 1
      `;
      attendance = (attRows[0] as Record<string, unknown>) ?? null;

      const countRows = await sql`
        SELECT count(*)::int AS c FROM dinner_guests
        WHERE dinner_id = ${mealId} AND status IN ('paid', 'confirmed')
      `;
      confirmedCount = (countRows[0] as { c: number } | undefined)?.c ?? 0;
      const maxSeats = meal.max_seats as number;
      isFull = meal.status === "full" || confirmedCount >= maxSeats;
    }

    const pendingRows = await sql`
      SELECT id, approval_status FROM hosts
      WHERE member_id = ${appUser.id} AND approval_status = 'pending'
      LIMIT 1
    `;
    const pendingHost = pendingRows[0];

    const approvedRows = await sql`
      SELECT id FROM hosts
      WHERE member_id = ${appUser.id} AND approval_status = 'approved'
      LIMIT 1
    `;
    const approvedHost = approvedRows[0];

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        meal,
        attendance,
        confirmedCount,
        maxSeats: meal ? (meal.max_seats as number) : null,
        isFull,
        isHostApproved: Boolean(approvedHost),
        pendingHostRequest: Boolean(pendingHost),
      }),
    };
  } catch (e) {
    console.error("get-member-summary", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};
