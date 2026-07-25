import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";
import { inviteIdentityUser } from "./lib/netlify-identity-admin";
import { sendEmail } from "./lib/email";
import { buildCreatePasswordEmail } from "./lib/email-templates";
import { clientIpFromEvent, consumeRateLimit } from "./lib/rate-limit";

const jsonHeaders = { "Content-Type": "application/json" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_NAME_LEN = 120;
const RATE_IP_MAX = 8;
const RATE_IP_WINDOW_SEC = 60 * 60;
const RATE_GLOBAL_MAX = 40;
const RATE_GLOBAL_WINDOW_SEC = 60 * 60;
const RATE_DINNER_MAX = 20;
const RATE_DINNER_WINDOW_SEC = 60 * 60;
const RATE_EMAIL_MAX = 3;
const RATE_EMAIL_WINDOW_SEC = 24 * 60 * 60;

function tooManyRequests() {
  return {
    statusCode: 429,
    headers: { ...jsonHeaders, "Retry-After": "3600" },
    body: JSON.stringify({ error: "Too many requests. Please try again later." }),
  };
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}") as Record<string, unknown>;

    // Honeypot: bots fill hidden fields; humans leave blank. Fake success.
    const honeypot = typeof body.company === "string" ? body.company.trim() : "";
    if (honeypot) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, invited: false }) };
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const dinnerId = typeof body.dinnerId === "string" ? body.dinnerId.trim() : "";
    const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
    const name = nameRaw ? nameRaw.slice(0, MAX_NAME_LEN) : null;

    if (!email || !dinnerId) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "email and dinnerId required" }),
      };
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Invalid email" }) };
    }
    if (!UUID_RE.test(dinnerId)) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Invalid dinnerId" }) };
    }

    const mealRows = await sql`
      SELECT id, status, is_visible, max_seats FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    const meal = mealRows[0] as
      | { id: string; status: string; is_visible: boolean; max_seats: number }
      | undefined;
    if (!meal || !meal.is_visible || meal.status !== "live") {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "Meal is not open for seat requests" }),
      };
    }

    const countRows = await sql`
      SELECT count(*)::int AS c FROM dinner_guests
      WHERE dinner_id = ${dinnerId} AND status IN ('waitlisted', 'approved', 'paid', 'confirmed', 'attended')
    `;
    const taken = (countRows[0] as { c: number } | undefined)?.c ?? 0;
    if (taken >= meal.max_seats) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Meal is full" }) };
    }

    const existingRows = await sql`
      SELECT id FROM meal_seat_requests
      WHERE dinner_id = ${dinnerId} AND email = ${email}
      LIMIT 1
    `;
    const existing = existingRows[0] as { id: string } | undefined;

    // Idempotent: do not re-invite or re-email on repeat submissions for the same seat.
    if (existing) {
      if (name) {
        await sql`
          UPDATE meal_seat_requests
          SET name = COALESCE(${name}, name)
          WHERE id = ${existing.id}
        `;
      }
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, invited: false, alreadyRequested: true }),
      };
    }

    const ip = clientIpFromEvent(event);
    const ipLimit = await consumeRateLimit({
      bucket: `meal-seat:ip:${ip}`,
      max: RATE_IP_MAX,
      windowSeconds: RATE_IP_WINDOW_SEC,
    });
    if (!ipLimit.allowed) return tooManyRequests();

    const globalLimit = await consumeRateLimit({
      bucket: "meal-seat:global",
      max: RATE_GLOBAL_MAX,
      windowSeconds: RATE_GLOBAL_WINDOW_SEC,
    });
    if (!globalLimit.allowed) return tooManyRequests();

    const dinnerLimit = await consumeRateLimit({
      bucket: `meal-seat:dinner:${dinnerId}`,
      max: RATE_DINNER_MAX,
      windowSeconds: RATE_DINNER_WINDOW_SEC,
    });
    if (!dinnerLimit.allowed) return tooManyRequests();

    const emailLimit = await consumeRateLimit({
      bucket: `meal-seat:email:${email}`,
      max: RATE_EMAIL_MAX,
      windowSeconds: RATE_EMAIL_WINDOW_SEC,
    });
    if (!emailLimit.allowed) return tooManyRequests();

    try {
      await sql`
        INSERT INTO meal_seat_requests (dinner_id, email, name, status)
        VALUES (${dinnerId}, ${email}, ${name}, 'pending')
      `;
    } catch (e) {
      // Concurrent duplicate for unique (dinner_id, email) — treat as idempotent success.
      const msg = e instanceof Error ? e.message : String(e);
      if (/unique|duplicate|23505/i.test(msg)) {
        return {
          statusCode: 200,
          headers: jsonHeaders,
          body: JSON.stringify({ ok: true, invited: false, alreadyRequested: true }),
        };
      }
      throw e;
    }

    const identityCtx = (context as { clientContext?: { identity?: { token?: string; url?: string } } })
      ?.clientContext?.identity;
    const invite = await inviteIdentityUser(email, {
      identityAdminToken: identityCtx?.token ?? null,
      identityUrl: identityCtx?.url ?? null,
    });
    if (!invite.ok) {
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: invite.error }) };
    }

    // Only send helper email when Identity actually issued a new invite.
    if (invite.invited) {
      try {
        const mail = buildCreatePasswordEmail(name);
        await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
      } catch (e) {
        console.error("request-meal-seat: helper email failed", e);
      }
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, invited: invite.invited }),
    };
  } catch (e) {
    console.error("request-meal-seat", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
