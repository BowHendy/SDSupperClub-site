import type { Handler } from "@netlify/functions";
import { getNetlifyUser, getOrCreateAppUser } from "./lib/auth";
import { getApprovedHostForMember, hostOwnsDinner, dinnerLabel } from "./lib/host";
import { sql } from "./lib/db";
import { sendEmail } from "./lib/email";
import { buildAttendeeDecisionEmail } from "./lib/email-templates";

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
    const attendeeId = body.attendeeId as string | undefined;
    const decision = body.decision as string | undefined; // 'approve' | 'reject'
    if (!attendeeId || (decision !== "approve" && decision !== "reject")) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "attendeeId and decision ('approve'|'reject') required" }),
      };
    }

    const appUser = await getOrCreateAppUser(netlifyUser);
    const host = await getApprovedHostForMember(appUser.id);
    if (!host) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not an approved host" }) };
    }

    const rows = await sql`
      SELECT
        dg.id, dg.dinner_id, dg.status, dg.is_host_seat,
        m.first_name, m.email,
        d.title, d.month, d.year, d.neighborhood, d.status AS dinner_status,
        d.host_confirmed_at, d.chef_confirmed_at, d.max_seats
      FROM dinner_guests dg
      JOIN members m ON m.id = dg.member_id
      JOIN dinners d ON d.id = dg.dinner_id
      WHERE dg.id = ${attendeeId}
      LIMIT 1
    `;
    const att = rows[0] as
      | {
          id: string;
          dinner_id: string;
          status: string;
          is_host_seat: boolean;
          first_name: string | null;
          email: string | null;
          title: string | null;
          month: string | null;
          year: number | null;
          neighborhood: string | null;
          dinner_status: string;
          host_confirmed_at: string | null;
          chef_confirmed_at: string | null;
          max_seats: number;
        }
      | undefined;

    if (!att) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: "Attendee not found" }) };
    }

    if (!(await hostOwnsDinner(host.id, att.dinner_id))) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: "Not your dinner" }) };
    }

    if (att.status !== "waitlisted") {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: `Attendee is '${att.status}', not waitlisted` }),
      };
    }

    // Attendees cannot be approved until the T-30 dual confirm is complete.
    if (decision === "approve" && (!att.host_confirmed_at || !att.chef_confirmed_at)) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({
          error: "Host and chef must both confirm the meal (T-30) before approving attendees.",
        }),
      };
    }

    if (decision === "approve") {
      const takenRows = await sql`
        SELECT count(*)::int AS c FROM dinner_guests
        WHERE dinner_id = ${att.dinner_id} AND status IN ('approved', 'paid', 'confirmed', 'attended')
      `;
      const taken = (takenRows[0] as { c: number } | undefined)?.c ?? 0;
      if (taken >= att.max_seats) {
        return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Meal is full" }) };
      }

      await sql`
        UPDATE dinner_guests
        SET status = 'approved', approved_at = now()
        WHERE id = ${attendeeId}
      `;
    } else {
      await sql`
        UPDATE dinner_guests
        SET status = 'rejected'
        WHERE id = ${attendeeId}
      `;
    }

    if (att.email) {
      try {
        const label = dinnerLabel(att);
        const mail = buildAttendeeDecisionEmail(decision === "approve", att.first_name, label);
        await sendEmail({ to: att.email, subject: mail.subject, text: mail.text, html: mail.html });
      } catch (e) {
        console.error("host-review-attendee: email failed", e);
      }
    }

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("host-review-attendee", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
