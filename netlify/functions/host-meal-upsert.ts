import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { getApprovedHostForMember } from "./lib/host";
import { pairChefByGenre } from "./lib/chef";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const appUser = await getOrCreateAppUser(netlifyUser);
    const host = await getApprovedHostForMember(appUser.id);
    if (!host) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not an approved host" }) };
    }

    if (event.httpMethod === "GET") {
      const rows = await sql`
        SELECT * FROM dinners
        WHERE host_id = ${host.id}
          AND status NOT IN ('past', 'cancelled', 'complete')
        ORDER BY created_at DESC
        LIMIT 1
      `;
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, meal: rows[0] ?? null }),
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const existingRows = await sql`
      SELECT id FROM dinners
      WHERE host_id = ${host.id}
        AND status NOT IN ('past', 'cancelled', 'complete')
      LIMIT 1
    `;
    if (existingRows[0]) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "One active meal per host — edit your existing meal" }),
      };
    }

    const title = (body.title as string | undefined)?.trim() ?? null;
    const month = (body.month as string | undefined)?.trim() ?? "";
    const year = Number(body.year);
    const neighborhood = (body.neighborhood as string | undefined)?.trim() ?? "";
    const foodGenre = (body.foodGenre as string | undefined)?.trim() ?? "";
    const drinkPairing = (body.drinkPairing as string | undefined)?.trim() ?? null;
    const menuLine = (body.menuLine as string | undefined)?.trim() ?? null;
    const displayDate = (body.displayDate as string | undefined)?.trim() ?? null;

    if (!month || !year || !neighborhood || !foodGenre) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "month, year, neighborhood, foodGenre required" }),
      };
    }

    const hostRows = await sql`
      SELECT address, first_name, surname, mobile_phone FROM hosts WHERE id = ${host.id} LIMIT 1
    `;
    const h = hostRows[0] as
      | { address: string; first_name: string | null; surname: string | null; mobile_phone: string | null }
      | undefined;

    const chefId = await pairChefByGenre(foodGenre);
    const chefRows = chefId
      ? await sql`SELECT first_name, surname FROM chefs WHERE id = ${chefId} LIMIT 1`
      : [];
    const chef = chefRows[0] as { first_name: string | null; surname: string | null } | undefined;
    const chefName = chef
      ? [chef.first_name, chef.surname].filter(Boolean).join(" ") || "TBA"
      : "TBA";

    const created = await sql`
      INSERT INTO dinners (
        host_id, chef_id, address, host_name, host_contact,
        title, month, year, neighborhood, chef_name,
        food_genre, drink_pairing, menu_line, display_date,
        status, is_visible
      )
      VALUES (
        ${host.id}, ${chefId}, ${h?.address ?? null},
        ${[h?.first_name, h?.surname].filter(Boolean).join(" ") || null},
        ${h?.mobile_phone ?? null},
        ${title}, ${month}, ${year}, ${neighborhood}, ${chefName},
        ${foodGenre}, ${drinkPairing}, ${menuLine}, ${displayDate},
        'draft', false
      )
      RETURNING *
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, meal: created[0] }) };
  } catch (e) {
    console.error("host-meal-upsert", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
