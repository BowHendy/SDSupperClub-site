import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
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

    const title = (body.title as string | undefined)?.trim() ?? null;
    const month = (body.month as string | undefined)?.trim();
    const year = body.year != null ? Number(body.year) : undefined;
    const neighborhood = (body.neighborhood as string | undefined)?.trim();
    const foodGenre = (body.foodGenre as string | undefined)?.trim();
    const drinkPairing = (body.drinkPairing as string | undefined)?.trim() ?? null;
    const menuLine = (body.menuLine as string | undefined)?.trim() ?? null;
    const displayDate = (body.displayDate as string | undefined)?.trim() ?? null;

    const rows = await sql`
      UPDATE dinners SET
        title = COALESCE(${title}, title),
        month = COALESCE(${month ?? null}, month),
        year = COALESCE(${year ?? null}, year),
        neighborhood = COALESCE(${neighborhood ?? null}, neighborhood),
        food_genre = COALESCE(${foodGenre ?? null}, food_genre),
        drink_pairing = COALESCE(${drinkPairing}, drink_pairing),
        menu_line = COALESCE(${menuLine}, menu_line),
        display_date = COALESCE(${displayDate}, display_date)
      WHERE id = ${dinnerId}
      RETURNING *
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, meal: rows[0] }) };
  } catch (e) {
    console.error("host-meal-update", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
