import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";

/**
 * Netlify Identity trigger: runs when a user signs up (invite accepted).
 * @see https://docs.netlify.com/functions/trigger-on-events/#identity-trigger-functions
 */
export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const user = payload.user ?? payload.record;
    if (!user?.id || !user?.email) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid Identity payload" }),
      };
    }

    const name =
      user.user_metadata?.full_name ?? user.user_metadata?.name ?? null;

    await sql`
      INSERT INTO users (netlify_identity_id, email, name)
      VALUES (${user.id}, ${user.email}, ${name})
      ON CONFLICT (netlify_identity_id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name
    `;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    };
  } catch (e) {
    console.error("identity-signup", e);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
