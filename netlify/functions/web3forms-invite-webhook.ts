import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";

const jsonHeaders = { "Content-Type": "application/json" };

function pickString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return null;
  return String(value);
}

function parsePossibleField(payload: any, keys: string[]): unknown {
  for (const k of keys) {
    if (payload?.[k] !== undefined) return payload[k];
  }
  return null;
}

function getSiteUrl(event: { headers: Record<string, string | undefined> }): string | null {
  const env =
    process.env.URL ??
    process.env.DEPLOY_PRIME_URL ??
    process.env.NETLIFY_SITE_URL ??
    null;
  if (env) return env.replace(/\/+$/, "");

  const proto = event.headers["x-forwarded-proto"] ?? event.headers["X-Forwarded-Proto"] ?? "https";
  const host = event.headers["x-forwarded-host"] ?? event.headers["X-Forwarded-Host"] ?? event.headers.host;
  if (!host) return null;
  return `${proto}://${host}`.replace(/\/+$/, "");
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // Deprecated: Web3Forms webhooks are a paid feature. The marketing invite form uses Netlify
  // Forms + Netlify reCAPTCHA (`InviteForm.tsx`); submissions do not hit this endpoint. This
  // handler remains only for legacy Web3Forms integrations that still POST here.

  try {
    if (!event.body) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Missing body" }) };
    }

    const payload = JSON.parse(event.body);

    // Web3Forms webhook payload shape varies by integration; support both:
    // - top-level fields: { name, email, referred_by, why, access_key, ... }
    // - nested fields: { data: { ... } }
    const data = payload?.data ?? payload?.formData ?? payload?.fields ?? payload;

    const accessKey =
      pickString(payload?.access_key) ??
      pickString(payload?.accessKey) ??
      pickString(data?.access_key) ??
      pickString(data?.accessKey) ??
      null;

    const expectedKey = process.env.WEB3FORMS_ACCESS_KEY ?? process.env.NEXT_PUBLIC_WEB3FORMS_KEY;
    if (expectedKey && accessKey && accessKey !== expectedKey) {
      return {
        statusCode: 401,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Invalid Web3Forms access key" }),
      };
    }

    const name = pickString(parsePossibleField(payload, ["name"]) ?? parsePossibleField(data, ["name"]));
    const email =
      pickString(parsePossibleField(payload, ["email"]) ?? parsePossibleField(data, ["email"]));
    const referredBy =
      pickString(parsePossibleField(payload, ["referred_by", "referredBy"]) ?? parsePossibleField(data, ["referred_by", "referredBy"]));

    // Your React form sends `why`, so store it into `why_you_love_to_come`.
    const why =
      pickString(parsePossibleField(payload, ["why", "why_you_love_to_come"]) ?? parsePossibleField(data, ["why", "why_you_love_to_come"]));

    const formKey =
      pickString(payload?.form_key) ?? pickString(payload?.formKey) ?? pickString(data?.form_key) ?? null;

    const source =
      pickString(payload?.source) ?? pickString(payload?.referrer) ?? pickString(data?.source) ?? null;

    if (!email) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "email required" }) };
    }
    if (!why) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "why required" }) };
    }

    await sql`
      INSERT INTO invitation_requests (
        name,
        email,
        referred_by,
        why_you_love_to_come,
        status,
        web3forms_access_key,
        form_key,
        source
      )
      VALUES (
        ${name},
        ${email},
        ${referredBy},
        ${why},
        'pending',
        ${accessKey},
        ${formKey},
        ${source}
      )
    `;

    const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL ?? null;
    if (!adminTo) {
      console.log("web3forms-invite-webhook: no ADMIN_NOTIFICATION_EMAIL; skipping admin email");
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
    }

    const siteUrl = getSiteUrl({ headers: event.headers });
    const loginUrl = siteUrl ? `${siteUrl}/login/` : "/login/";
    const adminUrl = siteUrl ? `${siteUrl}/admin/` : "/admin/";

    try {
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
    } catch (e) {
      console.error("web3forms-invite-webhook: failed sending admin email", e);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("web3forms-invite-webhook", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};

