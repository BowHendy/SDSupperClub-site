import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { setPrimaryRole } from "./lib/auth";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";
import { buildChefDecisionEmail } from "./lib/email-templates";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const admin = await requireAdmin(context);
    const body = JSON.parse(event.body || "{}");
    const chefId = body.chefId as string | undefined;
    const decision = body.decision as string | undefined; // 'approve' | 'reject'
    const note = (body.note as string | undefined) ?? "";

    if (!chefId || (decision !== "approve" && decision !== "reject")) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "chefId and decision ('approve'|'reject') required" }),
      };
    }

    const rows = await sql`
      SELECT id, member_id, first_name, email, approval_status
      FROM chefs WHERE id = ${chefId} LIMIT 1
    `;
    const chef = rows[0] as
      | { id: string; member_id: string | null; first_name: string | null; email: string | null; approval_status: string }
      | undefined;
    if (!chef) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Chef not found" }) };
    }

    const newStatus = decision === "approve" ? "approved" : "rejected";
    await sql`
      UPDATE chefs
      SET approval_status = ${newStatus},
          approval_note = ${note || null},
          approved_at = ${decision === "approve" ? new Date().toISOString() : null},
          approved_by = ${admin.email}
      WHERE id = ${chefId}
    `;

    if (decision === "approve" && chef.member_id) {
      await setPrimaryRole(chef.member_id, "chef");
    }

    if (chef.email) {
      try {
        const mail = buildChefDecisionEmail(decision === "approve", chef.first_name, note);
        await sendEmail({ to: chef.email, subject: mail.subject, text: mail.text, html: mail.html });
      } catch (e) {
        console.error("admin-review-chef: email failed", e);
      }
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
