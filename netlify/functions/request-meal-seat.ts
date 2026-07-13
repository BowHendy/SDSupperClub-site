import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";
import { inviteIdentityUser } from "./lib/netlify-identity-admin";
import { sendEmail } from "./lib/email";
import { buildCreatePasswordEmail } from "./lib/email-templates";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const dinnerId = body.dinnerId as string | undefined;
    const name = (body.name as string | undefined)?.trim() ?? null;

    if (!email || !dinnerId) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "email and dinnerId required" }),
      };
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

    await sql`
      INSERT INTO meal_seat_requests (dinner_id, email, name, status)
      VALUES (${dinnerId}, ${email}, ${name}, 'pending')
      ON CONFLICT (dinner_id, email) DO UPDATE SET name = COALESCE(EXCLUDED.name, meal_seat_requests.name)
    `;

    const invite = await inviteIdentityUser(email);
    if (!invite.ok) {
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: invite.error }) };
    }

    try {
      const mail = buildCreatePasswordEmail(name);
      await sendEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });
    } catch (e) {
      console.error("request-meal-seat: helper email failed", e);
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
