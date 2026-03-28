import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";

const jsonHeaders = { "Content-Type": "application/json" };
const INVITE_FORM_NAME = "invite-request";

/** Fields Netlify adds; do not map into invitation_requests. */
const IGNORE_DATA_KEYS = new Set([
  "form-name",
  "form_name",
  "bot-field",
  "g-recaptcha-response",
  "g_recaptcha_response",
]);

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

function rawSubmissionData(payload: Record<string, unknown>): Record<string, unknown> {
  const d = payload.data;
  if (d && typeof d === "object" && !Array.isArray(d)) return d as Record<string, unknown>;
  return {};
}

function dataFromOrderedFields(payload: Record<string, unknown>): Record<string, string> {
  const ordered = payload.ordered_human_fields;
  if (!Array.isArray(ordered)) return {};

  const out: Record<string, string> = {};
  for (const row of ordered) {
    if (!row || typeof row !== "object") continue;
    const r = row as { name?: string; value?: unknown };
    const name = pickString(r.name);
    if (!name || IGNORE_DATA_KEYS.has(name)) continue;
    const val = pickString(r.value);
    if (val) out[name] = val;
  }
  return out;
}

function normalizeFields(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (IGNORE_DATA_KEYS.has(k)) continue;
    const s = pickString(v);
    if (s !== null && s !== "") out[k] = s;
  }
  return out;
}

function field(data: Record<string, string>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = data[k];
    if (v !== undefined && v !== "") return v;
  }
  return null;
}

/**
 * Netlify Forms trigger: runs after a submission is verified (including reCAPTCHA when enabled).
 * @see https://docs.netlify.com/build/functions/trigger-on-events/#form-triggers
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const root = JSON.parse(event.body || "{}") as { payload?: Record<string, unknown> };
    const payload = root.payload;
    if (!payload || typeof payload !== "object") {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Missing payload" }) };
    }

    const raw = rawSubmissionData(payload);
    const formName =
      pickString(payload.form_name) ??
      pickString(payload.formName) ??
      pickString(raw["form-name"]) ??
      pickString(raw["form_name"]);

    let data = normalizeFields(raw);
    if (Object.keys(data).length === 0) {
      data = dataFromOrderedFields(payload);
    }

    if (formName !== INVITE_FORM_NAME) {
      console.log("submission-created: skipped (not invite-request)", { formName: formName ?? "(none)" });
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, skipped: true }) };
    }

    const name = field(data, "name");
    const email = field(data, "email");
    const referredBy = field(data, "referredBy", "referred_by");
    const why = field(data, "why");

    if (!email || !why) {
      console.error("submission-created: invite-request missing email or why", {
        keys: Object.keys(data),
      });
      // Avoid Netlify retries for unrecoverable shape mismatches.
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: false }) };
    }

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
        'netlify-forms'
      )
    `;

    const adminTo = process.env.ADMIN_NOTIFICATION_EMAIL ?? null;
    if (!adminTo) {
      console.log("submission-created: no ADMIN_NOTIFICATION_EMAIL; skipping admin email");
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
          "A new membership request was submitted (Netlify Forms).",
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
      console.error("submission-created: failed sending admin email", e);
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("submission-created", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
