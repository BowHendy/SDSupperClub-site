import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const admin = await requireAdmin(context);
    const body = JSON.parse(event.body || "{}") as { requestId?: string; note?: string };
    const requestId = body.requestId;
    const note = (body.note ?? "").trim();
    if (!requestId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "requestId required" }) };
    }

    const rows = await sql`
      SELECT id, email, status
      FROM invitation_requests
      WHERE id = ${requestId}
      LIMIT 1
    `;
    const req = rows[0] as { id: string; email: string; status: string } | undefined;
    if (!req) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Not found" }) };
    }

    if (req.status !== "rejected") {
      await sql`
        UPDATE invitation_requests
        SET status = 'rejected',
            approved_at = now(),
            approved_by = ${admin.email}
        WHERE id = ${requestId}
      `;
    }

    await sendEmail({
      to: req.email,
      subject: "SDSupperClub — update on your request",
      text: [
        "Thanks for your interest in SDSupperClub.",
        "",
        "At this point in time, we’re not able to offer you membership.",
        note ? "" : null,
        note ? `Note from the team:\n${note}` : null,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n"),
    });

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};

