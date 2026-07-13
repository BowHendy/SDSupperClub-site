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
    const status = event.queryStringParameters?.status ?? null;

    const meals = status
      ? await sql`
          SELECT d.*, h.first_name AS host_first_name, c.first_name AS chef_first_name
          FROM dinners d
          LEFT JOIN hosts h ON h.id = d.host_id
          LEFT JOIN chefs c ON c.id = d.chef_id
          WHERE d.status = ${status}
          ORDER BY d.display_date ASC NULLS LAST
        `
      : await sql`
          SELECT d.*, h.first_name AS host_first_name, c.first_name AS chef_first_name
          FROM dinners d
          LEFT JOIN hosts h ON h.id = d.host_id
          LEFT JOIN chefs c ON c.id = d.chef_id
          ORDER BY d.display_date ASC NULLS LAST
        `;

    const disputes = await sql`
      SELECT d.*, din.title, din.display_date
      FROM disputes d
      JOIN dinners din ON din.id = d.dinner_id
      WHERE d.status = 'open'
      ORDER BY d.created_at DESC
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, meals, disputes }),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
