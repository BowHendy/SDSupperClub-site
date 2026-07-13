import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser, setPrimaryRole } from "./lib/auth";
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
    const attendeeId = body.attendeeId as string | undefined;
    if (!dinnerId || !attendeeId) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "dinnerId and attendeeId required" }),
      };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);
    const host = await getApprovedHostForMember(appUser.id);
    if (!host || !(await hostOwnsDinner(host.id, dinnerId))) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
    }

    const attRows = await sql`
      SELECT dg.id, dg.member_id, dg.status, m.primary_role
      FROM dinner_guests dg
      JOIN members m ON m.id = dg.member_id
      WHERE dg.id = ${attendeeId} AND dg.dinner_id = ${dinnerId}
      LIMIT 1
    `;
    const att = attRows[0] as
      | { id: string; member_id: string; status: string; primary_role: string }
      | undefined;
    if (!att) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Attendee not found" }) };
    }
    if (att.status !== "paid" && att.status !== "confirmed") {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Attendee must be paid/confirmed to mark attended" }),
      };
    }

    await sql`
      UPDATE dinner_guests
      SET status = 'attended', attended_date = CURRENT_DATE
      WHERE id = ${attendeeId}
    `;

    if (att.primary_role === "guest") {
      await setPrimaryRole(att.member_id, "member");
    }

    const dinnerRows = await sql`
      SELECT host_name FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    const hostName = (dinnerRows[0] as { host_name: string | null } | undefined)?.host_name ?? null;

    await sql`
      UPDATE members
      SET attended_dates = array_append(attended_dates, CURRENT_DATE),
          attended_host_names = array_append(attended_host_names, ${hostName ?? "Host"})
      WHERE id = ${att.member_id}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, promotedToMember: att.primary_role === "guest" }) };
  } catch (e) {
    console.error("host-mark-attended", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
