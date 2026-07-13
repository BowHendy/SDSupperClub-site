import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";
import { inviteIdentityUser } from "./lib/netlify-identity-admin";
import { sendEmail } from "./lib/email";
import { buildWelcomeEmail } from "./lib/email-templates";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const admin = await requireAdmin(context);
    const body = JSON.parse(event.body || "{}") as { requestId?: string };
    const requestId = body.requestId;
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

    if (req.status !== "approved") {
      await sql`
        UPDATE invitation_requests
        SET status = 'approved',
            approved_at = now(),
            approved_by = ${admin.email}
        WHERE id = ${requestId}
      `;
    }

    const invite = await inviteIdentityUser(req.email);
    if (!invite.ok) {
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: invite.error }) };
    }

    // Optional helper email so the user knows to look for Netlify's invite email.
    try {
      const welcome = buildWelcomeEmail(req.name);
      await sendEmail({
        to: req.email,
        subject: welcome.subject,
        text: welcome.text,
        html: welcome.html,
      });
    } catch (e) {
      // Don’t fail approval if the helper email fails; the Identity invite is the main action.
      console.error("admin-approve-invitation-request: helper email failed", e);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, invited: invite.invited }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};

