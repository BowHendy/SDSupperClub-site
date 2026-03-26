import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

async function notifyAdminEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!apiKey || !to) {
    console.log("request-host: no RESEND_API_KEY or ADMIN_NOTIFICATION_EMAIL; skipping email");
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "SDSupperClub <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend error", res.status, errText);
  }
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const message = (body.message as string | undefined) ?? "";

    const appUser = await getOrCreateAppUser(netlifyUser);

    const pendingRows = await sql`
      SELECT id FROM host_requests
      WHERE user_id = ${appUser.id} AND status = 'pending'
      LIMIT 1
    `;

    if (pendingRows[0]) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, alreadyPending: true }),
      };
    }

    await sql`
      INSERT INTO host_requests (user_id, message, status)
      VALUES (${appUser.id}, ${message || null}, 'pending')
    `;

    await notifyAdminEmail(
      "SDSupperClub — request to host",
      `A member requested to host.\n\nUser id (app): ${appUser.id}\nNetlify id: ${netlifyUser.sub}\nEmail: ${netlifyUser.email ?? "unknown"}\n\nMessage:\n${message || "(none)"}`,
    );

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("request-host", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};
