import type { HandlerContext } from "@netlify/functions";
import { sql } from "./db";
import { getNetlifyUser } from "./auth";

export type AdminUser = {
  email: string;
  netlifyIdentityId: string;
};

export async function requireAdmin(context: HandlerContext): Promise<AdminUser> {
  const netlifyUser = getNetlifyUser(context);
  if (!netlifyUser?.sub) {
    throw new Error("Unauthorized");
  }

  const email = netlifyUser.email ?? null;
  if (!email) {
    throw new Error("Unauthorized");
  }

  const rows = await sql`
    SELECT email
    FROM admins
    WHERE email = ${email}
    LIMIT 1
  `;
  const row = rows[0] as { email: string } | undefined;
  if (!row?.email) {
    throw new Error("Forbidden");
  }

  return { email: row.email, netlifyIdentityId: netlifyUser.sub };
}

