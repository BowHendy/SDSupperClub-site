import type { HandlerContext } from "@netlify/functions";
import { sql } from "./db";
import { getNetlifyUser } from "./auth";

export type AdminUser = {
  email: string;
  netlifyIdentityId: string;
};

async function findAdminRow(email: string, sub: string) {
  const rows = await sql`
    SELECT email, netlify_identity_id
    FROM admins
    WHERE lower(email) = lower(${email})
    LIMIT 1
  `;
  const row = rows[0] as { email: string; netlify_identity_id: string | null } | undefined;
  if (!row) return null;

  // Bind Identity sub on first successful admin auth; reject mismatches afterward.
  if (row.netlify_identity_id && row.netlify_identity_id !== sub) {
    return null;
  }
  if (!row.netlify_identity_id) {
    await sql`
      UPDATE admins
      SET netlify_identity_id = ${sub}
      WHERE lower(email) = lower(${email})
        AND netlify_identity_id IS NULL
    `;
  }

  return row;
}

export async function isAdmin(context: HandlerContext): Promise<boolean> {
  const netlifyUser = getNetlifyUser(context);
  const email = netlifyUser?.email ?? null;
  if (!netlifyUser?.sub || !email) return false;
  const row = await findAdminRow(email, netlifyUser.sub);
  return Boolean(row);
}

export async function requireAdmin(context: HandlerContext): Promise<AdminUser> {
  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser?.sub) throw new Error("Unauthorized");

  const email = netlifyUser.email ?? null;
  if (!email) throw new Error("Unauthorized");

  const row = await findAdminRow(email, netlifyUser.sub);
  if (!row?.email) throw new Error("Forbidden");

  return { email: row.email, netlifyIdentityId: netlifyUser.sub };
}
