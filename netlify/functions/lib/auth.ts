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
  is_member_approved: boolean;
};

export async function getOrCreateAppUser(netlifyUser: NetlifyUser): Promise<AppUser> {
  const fullName =
    (netlifyUser.user_metadata?.full_name as string | undefined) ??
    (netlifyUser.user_metadata?.name as string | undefined) ??
    null;

  const [firstName, surname] = (() => {
    if (!fullName) return [null as string | null, null as string | null];
    const parts = fullName
      .split(" ")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 1) return [parts[0]!, null as string | null];
    return [parts[0]!, parts.slice(1).join(" ")];
  })();

  const email = netlifyUser.email ?? null;

  const approvedInviteRows = await sql`
    SELECT id, referred_by
    FROM invitation_requests
    WHERE email = ${email}
      AND status = 'approved'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const approvedInvite = approvedInviteRows[0] as { id: string; referred_by: string | null } | undefined;
  const shouldBeApproved = Boolean(approvedInvite);

  const existingRows = await sql`
    SELECT id, is_approved
    FROM members
    WHERE netlify_identity_id = ${netlifyUser.sub}
    LIMIT 1
  `;
  const existing = existingRows[0] as { id: string; is_approved: boolean } | undefined;
  if (existing) {
    // Keep the row id stable, but allow approval to "turn on" when admins approve the invite later.
    if (shouldBeApproved && !existing.is_approved) {
      await sql`
        UPDATE members
        SET is_approved = true,
            referred_by = COALESCE(${approvedInvite?.referred_by ?? null}, referred_by),
            email = ${email}
        WHERE id = ${existing.id}
      `;
    }
    return { id: String(existing.id), is_member_approved: Boolean(shouldBeApproved || existing.is_approved) };
  }

  const createdRows = await sql`
    INSERT INTO members (
      netlify_identity_id,
      email,
      first_name,
      surname,
      referred_by,
      is_approved
    )
    VALUES (
      ${netlifyUser.sub},
      ${email},
      ${firstName},
      ${surname},
      ${approvedInvite?.referred_by ?? null},
      ${shouldBeApproved}
    )
    RETURNING id, is_approved
  `;

  const created = createdRows[0] as { id: string; is_approved: boolean } | undefined;
  if (!created) throw new Error("Failed to create member");
  return { id: String(created.id), is_member_approved: Boolean(created.is_approved) };
}
