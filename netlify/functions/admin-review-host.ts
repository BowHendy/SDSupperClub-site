import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { setPrimaryRole } from "./lib/auth";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";
import { buildHostDecisionEmail } from "./lib/email-templates";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const admin = await requireAdmin(context);
    const body = JSON.parse(event.body || "{}");
    const hostId = body.hostId as string | undefined;
    const decision = body.decision as string | undefined; // 'approve' | 'reject'
    const note = (body.note as string | undefined) ?? "";

    if (!hostId || (decision !== "approve" && decision !== "reject")) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "hostId and decision ('approve'|'reject') required" }),
      };
    }

    const rows = await sql`
      SELECT id, member_id, first_name, email, approval_status
      FROM hosts WHERE id = ${hostId} LIMIT 1
    `;
    const host = rows[0] as
      | { id: string; member_id: string; first_name: string | null; email: string | null; approval_status: string }
      | undefined;
    if (!host) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Host not found" }) };
    }

    const newStatus = decision === "approve" ? "approved" : "rejected";
    await sql`
      UPDATE hosts
      SET approval_status = ${newStatus},
          approval_note = ${note || null},
          approved_at = ${decision === "approve" ? new Date().toISOString() : null},
          approved_by = ${admin.email}
      WHERE id = ${hostId}
    `;

    if (decision === "approve" && host.member_id) {
      await setPrimaryRole(host.member_id, "host");
    }

    if (host.email) {
      try {
        const mail = buildHostDecisionEmail(decision === "approve", host.first_name, note);
        await sendEmail({ to: host.email, subject: mail.subject, text: mail.text, html: mail.html });
      } catch (e) {
        console.error("admin-review-host: email failed", e);
      }
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
