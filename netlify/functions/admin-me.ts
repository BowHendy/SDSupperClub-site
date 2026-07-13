import type { Handler } from "@netlify/functions";
import { isAdmin } from "./lib/admin";

const jsonHeaders = { "Content-Type": "application/json" };

/** Returns whether the authenticated user is in the admins table. */
export const handler: Handler = async (_event, context) => {
  try {
    const admin = await isAdmin(context);
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, isAdmin: admin }),
    };
  } catch (e) {
    console.error("admin-me", e);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};
