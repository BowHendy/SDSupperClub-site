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

    const address = (body.address as string | undefined) ?? "";
    const mobilePhone = (body.mobilePhone as string | undefined) ?? "";
    const cutlery = Boolean(body.cutlery);
    const glassware = Boolean(body.glassware);
    const crockery = Boolean(body.crockery);

    if (!address.trim()) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "address required" }) };
    }

    const fullName =
      (netlifyUser.user_metadata?.full_name as string | undefined) ??
      (netlifyUser.user_metadata?.name as string | undefined) ??
      null;
    const parts = fullName
      ? fullName
          .split(" ")
          .map((p) => p.trim())
          .filter(Boolean)
      : [];
    const firstName = parts[0] ?? null;
    const surname = parts.length > 1 ? parts.slice(1).join(" ") : null;

    const appUser = await getOrCreateAppUser(netlifyUser);

    const pendingRows = await sql`
      SELECT id FROM hosts
      WHERE member_id = ${appUser.id} AND approval_status = 'pending'
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
      INSERT INTO hosts (
        member_id,
        first_name,
        surname,
        email,
        mobile_phone,
        address,
        cutlery,
        glassware,
        crockery,
        approval_status,
        approval_note
      )
      VALUES (
        ${appUser.id},
        ${firstName},
        ${surname},
        ${netlifyUser.email ?? null},
        ${mobilePhone || null},
        ${address},
        ${cutlery},
        ${glassware},
        ${crockery},
        'pending',
        ${message || null}
      )
      ON CONFLICT (member_id) DO UPDATE SET
        address = EXCLUDED.address,
        mobile_phone = EXCLUDED.mobile_phone,
        cutlery = EXCLUDED.cutlery,
        glassware = EXCLUDED.glassware,
        crockery = EXCLUDED.crockery,
        approval_note = EXCLUDED.approval_note,
        approval_status = CASE
          WHEN hosts.approval_status = 'approved' THEN 'approved'
          ELSE 'pending'
        END
    `;

    await notifyAdminEmail(
      "SDSupperClub — request to host",
      [
        "A member requested to host.",
        "",
        `Member id (app): ${appUser.id}`,
        `Netlify id: ${netlifyUser.sub}`,
        `Email: ${netlifyUser.email ?? "unknown"}`,
        "",
        `Address:\n${address}`,
        `Cutlery: ${cutlery}`,
        `Glassware: ${glassware}`,
        `Crockery: ${crockery}`,
        "",
        `Message:\n${message || "(none)"}`,
      ].join("\n"),
    );

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("request-host", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: String(e) }) };
  }
};
