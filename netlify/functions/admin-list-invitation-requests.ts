import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

type InvitationRequestStatus = "pending" | "approved" | "rejected";

function isStatus(v: unknown): v is InvitationRequestStatus {
  return v === "pending" || v === "approved" || v === "rejected";
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    await requireAdmin(context);

    const statusRaw = event.queryStringParameters?.status ?? null;
    const status = isStatus(statusRaw) ? statusRaw : null;

    const rows = status
      ? await sql`
          SELECT
            id,
            name,
            email,
            referred_by,
            why_you_love_to_come,
            status,
            approved_at,
            approved_by,
            created_at
          FROM invitation_requests
          WHERE status = ${status}
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT
            id,
            name,
            email,
            referred_by,
            why_you_love_to_come,
            status,
            approved_at,
            approved_by,
            created_at
          FROM invitation_requests
          ORDER BY created_at DESC
        `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, requests: rows }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};

