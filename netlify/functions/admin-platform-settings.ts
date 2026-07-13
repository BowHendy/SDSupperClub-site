import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  try {
    await requireAdmin(context);

    if (event.httpMethod === "GET") {
      const rows = await sql`
        SELECT attendance_fee_enabled, attendance_fee_amount, updated_at
        FROM platform_settings WHERE id = true LIMIT 1
      `;
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, settings: rows[0] ?? null }),
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const enabled = Boolean(body.attendanceFeeEnabled);
    const amount = Number(body.attendanceFeeAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Invalid attendanceFeeAmount" }) };
    }

    await sql`
      UPDATE platform_settings
      SET attendance_fee_enabled = ${enabled},
          attendance_fee_amount = ${amount},
          updated_at = now()
      WHERE id = true
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
