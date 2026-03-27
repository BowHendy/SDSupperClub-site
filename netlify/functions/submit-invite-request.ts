import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";

const jsonHeaders = { "Content-Type": "application/json" };

function debugLog(
  runId: string,
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) {
  fetch("http://127.0.0.1:7716/ingest/b86549cd-061e-4aac-8e7b-ff093d2073af", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "a53e2f" },
    body: JSON.stringify({
      sessionId: "a53e2f",
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function pickString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return null;
  return String(v);
}

function getSiteUrl(event: { headers: Record<string, string | undefined> }): string | null {
  const env = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? process.env.NETLIFY_SITE_URL ?? null;
  if (env) return env.replace(/\/+$/, "");

  const proto = event.headers["x-forwarded-proto"] ?? event.headers["X-Forwarded-Proto"] ?? "https";
  const host = event.headers["x-forwarded-host"] ?? event.headers["X-Forwarded-Host"] ?? event.headers.host;
  if (!host) return null;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

async function verifyHCaptcha(token: string, remoteIp: string | null): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) throw new Error("Missing HCAPTCHA_SECRET");

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (remoteIp) form.set("remoteip", remoteIp);

  const res = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const json = (await res.json()) as { success?: boolean };
  return Boolean(json.success);
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    // #region agent log
    debugLog("pre-fix", "H1", "submit-invite-request.ts:handler:start", "handler start", {
      hasBody: Boolean(event.body),
      hasDbUrl: Boolean(process.env.NETLIFY_DATABASE_URL),
      hasCaptchaSecret: Boolean(process.env.HCAPTCHA_SECRET),
      hasAdminEmail: Boolean(process.env.ADMIN_NOTIFICATION_EMAIL),
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
    });
    // #endregion
    const body = JSON.parse(event.body || "{}") as Record<string, unknown>;
    const name = pickString(body.name);
    const email = pickString(body.email);
    const referredBy = pickString(body.referredBy);
    const why = pickString(body.why);
    const hCaptchaToken = pickString(body.hCaptchaToken);
    const source = pickString(body.source);

    if (!email) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "email required" }) };
    }
    if (!why) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "why required" }) };
    }
    if (!hCaptchaToken) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "captcha required" }) };
    }

    const remoteIp =
      event.headers["x-nf-client-connection-ip"] ??
      event.headers["X-Nf-Client-Connection-Ip"] ??
      null;

    const captchaOk = await verifyHCaptcha(hCaptchaToken, remoteIp);
    // #region agent log
    debugLog("pre-fix", "H2", "submit-invite-request.ts:captcha", "captcha verification completed", {
      captchaOk,
      hasRemoteIp: Boolean(remoteIp),
    });
    // #endregion
    if (!captchaOk) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "captcha failed" }) };
    }

    // #region agent log
    debugLog("pre-fix", "H3", "submit-invite-request.ts:db:before-insert", "about to insert invitation request", {
      hasEmail: Boolean(email),
      hasWhy: Boolean(why),
    });
    // #endregion
    await sql`
      INSERT INTO invitation_requests (
        name,
        email,
        referred_by,
        why_you_love_to_come,
        status,
        source
      )
      VALUES (
        ${name},
        ${email},
        ${referredBy},
        ${why},
        'pending',
        ${source}
      )
    `;
    // #region agent log
    debugLog("pre-fix", "H3", "submit-invite-request.ts:db:after-insert", "insert succeeded", {});
    // #endregion

    const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL ?? null;
    if (!adminTo) {
      console.log("submit-invite-request: no ADMIN_NOTIFICATION_EMAIL; skipping admin email");
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
    }

    const siteUrl = getSiteUrl({ headers: event.headers });
    const loginUrl = siteUrl ? `${siteUrl}/login/` : "/login/";
    const adminUrl = siteUrl ? `${siteUrl}/admin/` : "/admin/";

    try {
      // #region agent log
      debugLog("pre-fix", "H4", "submit-invite-request.ts:email:before-send", "about to send admin email", {
        hasAdminTo: Boolean(adminTo),
      });
      // #endregion
      await sendEmail({
        to: adminTo,
        subject: "SDSupperClub — new membership request",
        text: [
          "A new membership request was submitted.",
          "",
          `Name: ${name ?? "(not provided)"}`,
          `Email: ${email}`,
          `Referred by: ${referredBy ?? "(not provided)"}`,
          "",
          "Why:",
          why,
          "",
          `Login: ${loginUrl}`,
          `Admin dashboard: ${adminUrl}`,
        ].join("\n"),
      });
      // #region agent log
      debugLog("pre-fix", "H4", "submit-invite-request.ts:email:after-send", "admin email send succeeded", {});
      // #endregion
    } catch (e) {
      // #region agent log
      debugLog("pre-fix", "H4", "submit-invite-request.ts:email:catch", "admin email send failed", {
        errorName: e instanceof Error ? e.name : typeof e,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
      // #endregion
      console.error("submit-invite-request: failed sending admin email", e);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    // #region agent log
    debugLog("pre-fix", "H5", "submit-invite-request.ts:handler:catch", "handler failed", {
      errorName: e instanceof Error ? e.name : typeof e,
      errorMessage: e instanceof Error ? e.message : String(e),
    });
    // #endregion
    console.error("submit-invite-request", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};

