import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

async function notifyAdminEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL ?? process.env.ADMIN_NOTIFICATION_EMAILS;
  if (!apiKey || !to) {
    console.log("chef-apply: no RESEND_API_KEY or admin email; skipping notification");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL ?? "Supper Collective <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: to.split(",").map((s) => s.trim()), subject, text }),
  });
  if (!res.ok) {
    console.error("chef-apply: Resend error", res.status, await res.text());
  }
}

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const body = JSON.parse(event.body || "{}");
    const bio = (body.bio as string | undefined) ?? "";
    const cvUrl = (body.cvUrl as string | undefined) ?? "";
    const references = (body.references as string | undefined) ?? "";
    const headshotUrl = (body.headshotUrl as string | undefined) ?? "";
    const mobilePhone = (body.mobilePhone as string | undefined) ?? "";
    const foodGenres = Array.isArray(body.foodGenres)
      ? (body.foodGenres as unknown[]).map((g) => String(g)).filter(Boolean)
      : [];

    // CV + references are the core of a chef application.
    const missing: string[] = [];
    if (!cvUrl.trim()) missing.push("cvUrl");
    if (!references.trim()) missing.push("references");
    if (missing.length > 0) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: "CV and references are required", missing }),
      };
    }

    const appUser = await requireApprovedMember(context);

    const fullName =
      (appUser.netlifyUser.user_metadata?.full_name as string | undefined) ??
      (appUser.netlifyUser.user_metadata?.name as string | undefined) ??
      null;
    const parts = fullName ? fullName.split(" ").map((p) => p.trim()).filter(Boolean) : [];
    const firstName = parts[0] ?? null;
    const surname = parts.length > 1 ? parts.slice(1).join(" ") : null;

    const pendingRows = await sql`
      SELECT id FROM chefs
      WHERE member_id = ${appUser.id} AND approval_status = 'pending'
      LIMIT 1
    `;
    if (pendingRows[0]) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true, alreadyPending: true }) };
    }

    await sql`
      INSERT INTO chefs (
        member_id, first_name, surname, email, mobile_phone,
        bio, headshot_url, cv_url, references_text, food_genres, approval_status
      )
      VALUES (
        ${appUser.id}, ${firstName}, ${surname}, ${appUser.netlifyUser.email ?? null}, ${mobilePhone || null},
        ${bio || null}, ${headshotUrl || null}, ${cvUrl}, ${references}, ${foodGenres as unknown as string[]}, 'pending'
      )
      ON CONFLICT (member_id) DO UPDATE SET
        mobile_phone = EXCLUDED.mobile_phone,
        bio = EXCLUDED.bio,
        headshot_url = EXCLUDED.headshot_url,
        cv_url = EXCLUDED.cv_url,
        references_text = EXCLUDED.references_text,
        food_genres = EXCLUDED.food_genres,
        approval_status = CASE
          WHEN chefs.approval_status = 'approved' THEN 'approved'
          ELSE 'pending'
        END
    `;

    await notifyAdminEmail(
      "Supper Collective — chef application",
      [
        "A member applied to cook.",
        "",
        `Member id (app): ${appUser.id}`,
        `Email: ${appUser.netlifyUser.email ?? "unknown"}`,
        `Food genres: ${foodGenres.join(", ") || "(none)"}`,
        `CV: ${cvUrl}`,
        "",
        `References:\n${references}`,
      ].join("\n"),
    );

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("chef-apply", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
