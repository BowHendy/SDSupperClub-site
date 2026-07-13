import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

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
    const host = await getApprovedHostForMember(appUser.id);
    if (!host) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not an approved host" }) };
    }

    const dinnerId = event.queryStringParameters?.dinnerId ?? null;
    if (!dinnerId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "dinnerId required" }) };
    }

    if (!(await hostOwnsDinner(host.id, dinnerId))) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
    }

    const attendees = await sql`
      SELECT
        dg.id,
        dg.status,
        dg.is_host_seat,
        dg.created_at,
        m.first_name,
        m.surname,
        m.email,
        m.allergies
      FROM dinner_guests dg
      JOIN members m ON m.id = dg.member_id
      WHERE dg.dinner_id = ${dinnerId}
      ORDER BY dg.created_at ASC
    `;

    const paidRows = await sql`
      SELECT count(*)::int AS c FROM dinner_guests
      WHERE dinner_id = ${dinnerId} AND status IN ('paid', 'confirmed', 'attended')
    `;
    const paidCount = (paidRows[0] as { c: number } | undefined)?.c ?? 0;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, attendees, paidCount }),
    };
  } catch (e) {
    console.error("host-list-attendees", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
