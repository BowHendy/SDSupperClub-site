import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    await requireAdmin(context);

    const statusRaw = event.queryStringParameters?.status ?? "pending";
    const status = ["pending", "approved", "rejected"].includes(statusRaw) ? statusRaw : "pending";

    const hosts = await sql`
      SELECT
        id, member_id, first_name, surname, email, mobile_phone,
        address, allergies, kitchen_photo_url, dining_photo_url,
        cutlery, glassware, crockery, approval_status, approval_note, created_at
      FROM hosts
      WHERE approval_status = ${status}
      ORDER BY created_at DESC
    `;

    const chefs = await sql`
      SELECT
        id, member_id, first_name, surname, email, mobile_phone,
        bio, headshot_url, cv_url, references_text, food_genres,
        approval_status, approval_note, created_at
      FROM chefs
      WHERE approval_status = ${status}
      ORDER BY created_at DESC
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, hosts, chefs }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
