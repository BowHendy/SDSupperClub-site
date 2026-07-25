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

    const identityCtx = (context as { clientContext?: { identity?: { token?: string; url?: string } } })
      ?.clientContext?.identity;
    const hasEnvToken = Boolean(process.env.NETLIFY_IDENTITY_ADMIN_TOKEN);
    const hasContextToken = Boolean(identityCtx?.token);
    // #region agent log
    fetch("http://127.0.0.1:7791/ingest/9edce051-a32e-42af-9f1a-0a04a0d1bc57", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ef69d" },
      body: JSON.stringify({
        sessionId: "2ef69d",
        hypothesisId: "A,B,C,D",
        location: "admin-approve-invitation-request.ts:pre-invite",
        message: "approve invite preflight",
        data: {
          requestStatus: req.status,
          hasEnvToken,
          hasContextToken,
          hasIdentityUrl: Boolean(identityCtx?.url),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    console.log(
      "[debug:2ef69d] approve invite preflight",
      JSON.stringify({
        requestStatus: req.status,
        hasEnvToken,
        hasContextToken,
        hasIdentityUrl: Boolean(identityCtx?.url),
      }),
    );
    // #endregion

    if (req.status !== "approved") {
      await sql`
        UPDATE invitation_requests
        SET status = 'approved',
            approved_at = now(),
            approved_by = ${admin.email}
        WHERE id = ${requestId}
      `;
    }

    const invite = await inviteIdentityUser(req.email, {
      identityAdminToken: identityCtx?.token ?? null,
    });
    if (!invite.ok) {
      // #region agent log
      fetch("http://127.0.0.1:7791/ingest/9edce051-a32e-42af-9f1a-0a04a0d1bc57", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ef69d" },
        body: JSON.stringify({
          sessionId: "2ef69d",
          hypothesisId: "A,B,D",
          location: "admin-approve-invitation-request.ts:invite-failed",
          message: "invite failed after status update",
          data: {
            error: invite.error,
            hasEnvToken,
            hasContextToken,
            markedApprovedBeforeInvite: true,
            priorStatus: req.status,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({
          error: invite.error,
          debug: { hasEnvToken, hasContextToken, priorStatus: req.status },
        }),
      };
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

