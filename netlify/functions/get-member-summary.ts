import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { isAdmin } from "./lib/admin";
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


  try {
    const appUser = await requireApprovedMember(context);

    const meals = await sql`
      SELECT
        id, title, month, year, neighborhood, chef_name, status, max_seats,
        display_date, meal_price_per_guest, food_genre, created_at, zip
      FROM dinners
      WHERE is_visible = true AND status IN ('live', 'upcoming', 'full')
    `;

    const meal = pickActiveMeal((meals ?? []) as Record<string, unknown>[]);
    let attendance = null as Record<string, unknown> | null;
    let confirmedCount = 0;
    let isFull = false;

    if (meal) {
      const mealId = meal.id as string;
      const attRows = await sql`
        SELECT id, status, dinner_id, member_id, created_at
        FROM dinner_guests
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

    const pendingChefRows = await sql`
      SELECT id FROM chefs
      WHERE member_id = ${appUser.id} AND approval_status = 'pending'
      LIMIT 1
    `;
    const pendingChef = pendingChefRows[0];

    const approvedChefRows = await sql`
      SELECT id FROM chefs
      WHERE member_id = ${appUser.id} AND approval_status = 'approved'
      LIMIT 1
    `;
    const approvedChef = approvedChefRows[0];

    const admin = await isAdmin(context);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        meal,
        attendance,
        confirmedCount,
        maxSeats: meal ? (meal.max_seats as number) : null,
        isFull,
        primaryRole: appUser.primary_role,
        profileComplete: appUser.profile_complete,
        isHostApproved: Boolean(approvedHost),
        pendingHostRequest: Boolean(pendingHost),
        isChefApproved: Boolean(approvedChef),
        pendingChefRequest: Boolean(pendingChef),
        isAdmin: admin,
      }),
    };
  } catch (e) {
    console.error("get-member-summary", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
