import type { Handler } from "@netlify/functions";

const jsonHeaders = { "Content-Type": "application/json" };

/**
 * Stub: promote waitlisted guests to "invited" and send email.
 * Protect with ADMIN_NOTIFY_SECRET in the `x-admin-secret` header when set.
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const secret = process.env.ADMIN_NOTIFY_SECRET;
  if (secret) {
    const sent = event.headers["x-admin-secret"] ?? event.headers["X-Admin-Secret"];
    if (sent !== secret) {
      return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
    }
  }

  return {
    statusCode: 501,
    headers: jsonHeaders,
    body: JSON.stringify({
      ok: false,
      message: "notify-waitlist is not implemented yet (no email provider wired).",
    }),
  };
};
