import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
import { getApprovedChefForMember } from "./lib/chef";
import { daysUntilDisplayDate } from "./lib/meal";
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
    const role = body.role as string | undefined; // 'host' | 'chef'
    if (!dinnerId || (role !== "host" && role !== "chef")) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "dinnerId and role ('host'|'chef') required" }),
      };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);
    const mealRows = await sql`
      SELECT id, host_id, chef_id, display_date, price_agreed_by_host,
             host_confirmed_at, chef_confirmed_at, status
      FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    const meal = mealRows[0] as {
      id: string;
      host_id: string;
      chef_id: string | null;
      display_date: string | null;
      price_agreed_by_host: boolean;
      host_confirmed_at: string | null;
      chef_confirmed_at: string | null;
      status: string;
    } | undefined;
    if (!meal) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Meal not found" }) };
    }

    if (!meal.price_agreed_by_host) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Host must agree to chef price first" }) };
    }

    const days = daysUntilDisplayDate(meal.display_date);
    if (days != null && days > 30) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Dual confirm opens within 30 days of display_date" }),
      };
    }

    if (role === "host") {
      const host = await getApprovedHostForMember(appUser.id);
      if (!host || host.id !== meal.host_id) {
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not the host for this meal" }) };
      }
      await sql`UPDATE dinners SET host_confirmed_at = now() WHERE id = ${dinnerId}`;
    } else {
      const chef = await getApprovedChefForMember(appUser.id);
      if (!chef || chef.id !== meal.chef_id) {
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not the chef for this meal" }) };
      }
      await sql`UPDATE dinners SET chef_confirmed_at = now() WHERE id = ${dinnerId}`;
    }

    const updated = await sql`
      SELECT host_confirmed_at, chef_confirmed_at FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    const u = updated[0] as { host_confirmed_at: string | null; chef_confirmed_at: string | null };
    if (u.host_confirmed_at && u.chef_confirmed_at) {
      await sql`
        UPDATE dinners
        SET status = 'live', is_visible = true
        WHERE id = ${dinnerId}
      `;
      // Ensure host seat row exists (counts toward 10).
      const hostMemberRows = await sql`
        SELECT member_id FROM hosts WHERE id = ${meal.host_id} LIMIT 1
      `;
      const hostMemberId = (hostMemberRows[0] as { member_id: string } | undefined)?.member_id;
      if (hostMemberId) {
        await sql`
          INSERT INTO dinner_guests (dinner_id, member_id, status, is_host_seat)
          VALUES (${dinnerId}, ${hostMemberId}, 'approved', true)
          ON CONFLICT (dinner_id, member_id) DO UPDATE SET is_host_seat = true
        `;
      }
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, bothConfirmed: Boolean(u.host_confirmed_at && u.chef_confirmed_at) }) };
  } catch (e) {
    console.error("meal-dual-confirm", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
