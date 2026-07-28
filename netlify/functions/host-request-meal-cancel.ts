import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { getApprovedHostForMember, hostOwnsDinner } from "./lib/host";
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
    if (!dinnerId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "dinnerId required" }) };
    }

    const appUser = await requireApprovedMember(context);
    const host = await getApprovedHostForMember(appUser.id);
    if (!host || !(await hostOwnsDinner(host.id, dinnerId))) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
    }

    await sql`
      UPDATE dinners
      SET status = 'cancel_requested', cancel_reason = ${reason || "host_requested"}
      WHERE id = ${dinnerId}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("host-request-meal-cancel", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
