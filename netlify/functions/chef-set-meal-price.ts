import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { getApprovedChefForMember } from "./lib/chef";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const body = JSON.parse(event.body || "{}");
    const dinnerId = body.dinnerId as string | undefined;
    const pricePerGuest = Number(body.pricePerGuest);
    if (!dinnerId || !Number.isFinite(pricePerGuest) || pricePerGuest <= 0) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "dinnerId and positive pricePerGuest required" }),
      };
    }

    const appUser = await requireApprovedMember(context);
    const chef = await getApprovedChefForMember(appUser.id);
    if (!chef) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not an approved chef" }) };
    }

    const rows = await sql`
      SELECT id, chef_id, status FROM dinners WHERE id = ${dinnerId} LIMIT 1
    `;
    const meal = rows[0] as { id: string; chef_id: string | null; status: string } | undefined;
    if (!meal || meal.chef_id !== chef.id) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your assigned meal" }) };
    }

    await sql`
      UPDATE dinners
      SET meal_price_per_guest = ${pricePerGuest},
          price_agreed_by_host = false,
          status = CASE WHEN status = 'draft' THEN 'dual_confirm_pending' ELSE status END
      WHERE id = ${dinnerId}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("chef-set-meal-price", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
