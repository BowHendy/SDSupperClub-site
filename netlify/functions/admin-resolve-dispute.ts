import type { Handler } from "@netlify/functions";
import { requireAdmin } from "./lib/admin";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const admin = await requireAdmin(context);
    const body = JSON.parse(event.body || "{}");
    const disputeId = body.disputeId as string | undefined;
    const resolutionNote = (body.resolutionNote as string | undefined)?.trim() ?? "";
    const releaseRemainder = Boolean(body.releaseRemainder);
    if (!disputeId) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "disputeId required" }) };
    }

    const rows = await sql`
      SELECT dinner_id FROM disputes WHERE id = ${disputeId} AND status = 'open' LIMIT 1
    `;
    const dispute = rows[0] as { dinner_id: string } | undefined;
    if (!dispute) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Dispute not found" }) };
    }

    await sql`
      UPDATE disputes
      SET status = 'resolved', resolution_note = ${resolutionNote || null},
          resolved_at = now(), resolved_by = ${admin.email}
      WHERE id = ${disputeId}
    `;

    if (releaseRemainder) {
      await sql`
        UPDATE payouts SET status = 'paid', updated_at = now()
        WHERE dinner_id = ${dispute.dinner_id} AND kind = 'chef_remainder' AND status = 'paused'
      `;
    }

    await sql`
      UPDATE dinners SET status = 'complete' WHERE id = ${dispute.dinner_id} AND status = 'dispute'
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const statusCode = msg === "Unauthorized" ? 401 : msg === "Forbidden" ? 403 : 500;
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: statusCode === 500 ? "Server error" : msg }) };
  }
};
