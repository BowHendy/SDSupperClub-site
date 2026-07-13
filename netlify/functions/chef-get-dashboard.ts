import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { getApprovedChefForMember } from "./lib/chef";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const appUser = await getOrCreateAppUser(netlifyUser);
    const chef = await getApprovedChefForMember(appUser.id);
    if (!chef) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not an approved chef" }) };
    }

    const meals = await sql`
      SELECT * FROM dinners
      WHERE chef_id = ${chef.id}
        AND status NOT IN ('past', 'cancelled')
      ORDER BY display_date ASC NULLS LAST
    `;

    const payouts = await sql`
      SELECT * FROM payouts WHERE chef_id = ${chef.id} ORDER BY created_at DESC LIMIT 20
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, meals, payouts }),
    };
  } catch (e) {
    console.error("chef-get-dashboard", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
