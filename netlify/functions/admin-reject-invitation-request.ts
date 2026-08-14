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

  // #region agent log
  let stage = "start";
  // #endregion
  try {
    // #region agent log
    stage = "auth";
    // #endregion
    const admin = await requireAdmin(context);
    // #region agent log
    stage = "parse";
    // #endregion
    const body = JSON.parse(event.body || "{}") as { requestId?: string; note?: string };
    const requestId = body.requestId;
    const note = (body.note ?? "").trim();
    if (!requestId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "requestId required" }) };
    }

    // #region agent log
    stage = "select";
    // #endregion
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
      // #region agent log
      stage = "update";
      // #endregion
      await sql`
        UPDATE invitation_requests
        SET status = 'rejected',
            approved_at = now(),
            approved_by = ${admin.email}
        WHERE id = ${requestId}
      `;
    }

    // Don’t fail rejection if the notification email fails; status update is the main action.
    let emailSent = false;
    try {
      // #region agent log
      stage = "build_email";
      // #endregion
      const rejection = buildRejectionEmail(req.name, note);
      // #region agent log
      stage = "send_email";
      // #endregion
      await sendEmail({
        to: req.email,
        subject: rejection.subject,
        text: rejection.text,
        html: rejection.html,
      });
      emailSent = true;
    } catch (e) {
      // #region agent log
      const emailMsg = e instanceof Error ? e.message : String(e);
      console.error("admin-reject-invitation-request: email failed", { stage, msg: emailMsg });
      // #endregion
    }

    // #region agent log
    stage = "done";
    console.error("admin-reject-invitation-request debug", { stage, emailSent, statusCode: 200 });
    // #endregion
    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, emailSent }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    // #region agent log
    console.error("admin-reject-invitation-request debug", { stage, msg, statusCode });
    // #endregion
    return {
      statusCode,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: statusCode === 500 ? "Server error" : msg,
        // Temporary debug fields for client-side capture (session b7a4ad)
        debugDetail: msg,
        debugStage: stage,
      }),
    };
  }
};

