import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
import { getApprovedChefForMember } from "./lib/chef";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const body = JSON.parse(event.body || "{}");
    const dinnerId = body.dinnerId as string | undefined;
    const reason = (body.reason as string | undefined)?.trim() ?? "";
    const role = body.role as string | undefined;
    if (!dinnerId || !reason || (role !== "host" && role !== "chef")) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "dinnerId, reason, and role ('host'|'chef') required" }),
      };
    }

    const appUser = await requireApprovedMember(context);
    if (role === "host") {
      const host = await getApprovedHostForMember(appUser.id);
      if (!host || !(await hostOwnsDinner(host.id, dinnerId))) {
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
      }
    } else {
      const chef = await getApprovedChefForMember(appUser.id);
      const mealRows = await sql`SELECT chef_id FROM dinners WHERE id = ${dinnerId} LIMIT 1`;
      if (!chef || (mealRows[0] as { chef_id: string } | undefined)?.chef_id !== chef.id) {
        return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your assigned meal" }) };
      }
    }

    await sql`
      INSERT INTO disputes (dinner_id, raised_by_member_id, raised_by_role, reason)
      VALUES (${dinnerId}, ${appUser.id}, ${role}, ${reason})
    `;
    await sql`UPDATE dinners SET status = 'dispute' WHERE id = ${dinnerId}`;
    await sql`
      UPDATE payouts SET status = 'paused', updated_at = now()
      WHERE dinner_id = ${dinnerId} AND status = 'pending'
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("meal-flag-dispute", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
