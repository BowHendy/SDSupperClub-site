import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { getApprovedHostForMember } from "./lib/host";
import { hostHasActiveLiveMeal } from "./lib/meal";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const body = JSON.parse(event.body || "{}");
    const mealId = body.mealId as string | undefined;
    if (!mealId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "mealId required" }) };
    }

    const appUser = await requireApprovedMember(context);

    // G4: hosts cannot RSVP elsewhere while hosting a live meal.
    const host = await getApprovedHostForMember(appUser.id);
    if (host) {
      const mealRows = await sql`SELECT host_id FROM dinners WHERE id = ${mealId} LIMIT 1`;
      const targetHostId = (mealRows[0] as { host_id: string | null } | undefined)?.host_id;
      if (targetHostId !== host.id && (await hostHasActiveLiveMeal(host.id))) {
        return {
          statusCode: 403,
          headers: jsonHeaders,
          body: JSON.stringify({ error: "Cannot request a seat while you are hosting an active meal" }),
        };
      }
    }

    const mealRows = await sql`
      SELECT id, status, max_seats, is_visible FROM dinners WHERE id = ${mealId} LIMIT 1
    `;
    const meal = mealRows[0] as { id: string; status: string; max_seats: number; is_visible: boolean } | undefined;

    if (!meal || !meal.is_visible || meal.status !== "live") {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Meal is not open for attendance requests" }),
      };
    }

    const countRows = await sql`
      SELECT count(*)::int AS c FROM dinner_guests
      WHERE dinner_id = ${mealId} AND status IN ('paid', 'confirmed', 'attended')
    `;
    const taken = (countRows[0] as { c: number } | undefined)?.c ?? 0;
    if (taken >= meal.max_seats) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Meal is full" }) };
    }

    await sql`
      INSERT INTO dinner_guests (dinner_id, member_id, status)
      VALUES (${mealId}, ${appUser.id}, 'waitlisted')
      ON CONFLICT (dinner_id, member_id) DO UPDATE SET status = 'waitlisted'
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("request-attendance", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
