import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { getApprovedChefForMember } from "./lib/chef";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const appUser = await requireApprovedMember(context);
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
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
