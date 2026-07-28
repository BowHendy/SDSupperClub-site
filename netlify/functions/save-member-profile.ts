import type { Handler } from "@netlify/functions";
import { requireApprovedMember } from "./lib/auth";
import { authStatusFromError, publicErrorMessage } from "./lib/security";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }


  try {
    const body = JSON.parse(event.body || "{}");
    const firstName = (body.firstName as string | undefined)?.trim() ?? "";
    const surname = (body.surname as string | undefined)?.trim() ?? "";
    const mobilePhone = (body.mobilePhone as string | undefined)?.trim() ?? "";
    const zip = (body.zip as string | undefined)?.trim() ?? "";
    const allergies = (body.allergies as string | undefined)?.trim() ?? "";

    const missing: string[] = [];
    if (!firstName) missing.push("firstName");
    if (!mobilePhone) missing.push("mobilePhone");
    if (!zip) missing.push("zip");
    if (missing.length > 0) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: "Incomplete profile", missing }) };
    }

    const appUser = await requireApprovedMember(context);

    await sql`
      UPDATE members
      SET first_name = ${firstName},
          surname = ${surname || null},
          mobile_phone = ${mobilePhone},
          zip = ${zip},
          allergies = ${allergies || null},
          profile_complete = true,
          email = ${appUser.netlifyUser.email ?? null}
      WHERE id = ${appUser.id}
    `;

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("save-member-profile", e);
    const statusCode = authStatusFromError(e);
    return { statusCode, headers: jsonHeaders, body: JSON.stringify({ error: publicErrorMessage(e) }) };
  }
};
