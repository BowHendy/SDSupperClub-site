import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    await requireAdmin(context);
    const body = JSON.parse(event.body || "{}");
    const dinnerId = body.dinnerId as string | undefined;
    if (!dinnerId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "dinnerId required" }) };
    }

    await sql`
      UPDATE dinner_guests
      SET status = 'cancelled', cancelled_at = now(), refunded_at = now()
      WHERE dinner_id = ${dinnerId} AND status IN ('paid', 'confirmed', 'approved', 'waitlisted')
    `;
    await sql`
      UPDATE payments SET status = 'refunded', updated_at = now()
      WHERE dinner_id = ${dinnerId} AND status = 'held'
    `;
    await sql`
      UPDATE dinners
      SET status = 'cancelled', cancelled_at = now()
      WHERE id = ${dinnerId}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
