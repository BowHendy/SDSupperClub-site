import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";
import { buildRejectionEmail } from "./lib/email-templates";

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
      SELECT id, name, email, status
      FROM invitation_requests
      WHERE id = ${requestId}
      LIMIT 1
    `;
    const req = rows[0] as { id: string; name: string | null; email: string; status: string } | undefined;
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

    // Don’t fail rejection if the notification email fails; status update is the main action.
    try {
      const rejection = buildRejectionEmail(req.name, note);
      await sendEmail({
        to: req.email,
        subject: rejection.subject,
        text: rejection.text,
        html: rejection.html,
      });
    } catch (e) {
      console.error("admin-reject-invitation-request: email failed", e);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
