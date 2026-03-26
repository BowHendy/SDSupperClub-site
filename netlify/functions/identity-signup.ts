import type { Handler } from "@netlify/functions";
import { getOrCreateAppUser } from "./lib/auth";

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

    await getOrCreateAppUser({
      sub: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    });

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
