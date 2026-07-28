import type { Handler } from "@netlify/functions";
import { getOrCreateAppUser } from "./lib/auth";
import { assertIdentityEventAuthorized, publicErrorMessage } from "./lib/security";

/**
 * Netlify Identity trigger: runs when a user signs up (invite accepted).
 * @see https://docs.netlify.com/functions/trigger-on-events/#identity-trigger-functions
 *
 * Authorization: Netlify `clientContext.identity` and/or signed webhook header.
 * Join behavior unchanged — still creates/links the members row for the invited user.
 */
export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    assertIdentityEventAuthorized(event, context);

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
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : 500;
    return {
      statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: publicErrorMessage(e) }),
    };
  }
};
