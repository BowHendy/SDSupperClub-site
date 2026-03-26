import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const rows = await sql`SELECT value FROM site_content WHERE key = ${"site"}`;
    const row = rows[0] as { value: unknown } | undefined;
    if (!row?.value || typeof row.value !== "object") {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ site: null }) };
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ site: row.value }),
    };
  } catch (e) {
    console.error("get-site-content", e);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
