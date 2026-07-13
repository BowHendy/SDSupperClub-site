import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { daysUntilDisplayDate } from "./lib/meal";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser) {
    return { statusCode: 401, headers: jsonHeaders, body: JSON.stringify({ error: "Unauthorized" }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const dinnerId = body.dinnerId as string | undefined;
    if (!dinnerId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "dinnerId required" }) };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);

    const attRows = await sql`
      SELECT dg.id, dg.status, d.display_date
      FROM dinner_guests dg
      JOIN dinners d ON d.id = dg.dinner_id
      WHERE dg.dinner_id = ${dinnerId} AND dg.member_id = ${appUser.id}
      LIMIT 1
    `;
    const att = attRows[0] as { id: string; status: string; display_date: string | null } | undefined;
    if (!att) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "No attendance found" }) };
    }

    if (att.status === "waitlisted" || att.status === "approved") {
      await sql`
        UPDATE dinner_guests SET status = 'cancelled', cancelled_at = now()
        WHERE id = ${att.id}
      `;
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, refunded: true }) };
    }

    if (att.status === "paid" || att.status === "confirmed") {
      const days = daysUntilDisplayDate(att.display_date);
      const refundEligible = days != null && days >= 14;
      await sql`
        UPDATE dinner_guests
        SET status = 'cancelled', cancelled_at = now(),
            refunded_at = ${refundEligible ? new Date().toISOString() : null}
        WHERE id = ${att.id}
      `;
      if (refundEligible) {
        await sql`
          UPDATE payments SET status = 'refunded', updated_at = now()
          WHERE dinner_id = ${dinnerId} AND member_id = ${appUser.id} AND status = 'held'
        `;
      }
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ ok: true, refunded: refundEligible }),
      };
    }

    return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Cannot cancel this attendance" }) };
  } catch (e) {
    console.error("guest-cancel-attendance", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
