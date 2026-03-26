import type { HandlerContext } from "@netlify/functions";
import { sql } from "./db";

export type NetlifyUser = {
  sub: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export function getNetlifyUser(context: HandlerContext): NetlifyUser | null {
  const raw = context.clientContext?.user as NetlifyUser | undefined;
  if (!raw?.sub) return null;
  return raw;
}

export type AppUser = {
  id: string;
  is_host_approved: boolean;
};

export async function getOrCreateAppUser(netlifyUser: NetlifyUser): Promise<AppUser> {
  const existingRows = await sql`
    SELECT id, is_host_approved
    FROM users
    WHERE netlify_identity_id = ${netlifyUser.sub}
    LIMIT 1
  `;
  const existing = existingRows[0] as { id: string; is_host_approved: boolean } | undefined;
  if (existing) {
    return {
      id: String(existing.id),
      is_host_approved: Boolean(existing.is_host_approved),
    };
  }

  const nameMeta =
    (netlifyUser.user_metadata?.full_name as string | undefined) ??
    (netlifyUser.user_metadata?.name as string | undefined) ??
    null;

  const createdRows = await sql`
    INSERT INTO users (netlify_identity_id, email, name)
    VALUES (${netlifyUser.sub}, ${netlifyUser.email ?? null}, ${nameMeta})
    RETURNING id, is_host_approved
  `;
  const created = createdRows[0] as { id: string; is_host_approved: boolean } | undefined;
  if (!created) throw new Error("Failed to create user");
  return {
    id: String(created.id),
    is_host_approved: Boolean(created.is_host_approved),
  };
}
