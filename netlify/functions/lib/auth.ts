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

export type PrimaryRole = "guest" | "member" | "host" | "chef";

export type AppUser = {
  id: string;
  is_member_approved: boolean;
  primary_role: PrimaryRole;
  profile_complete: boolean;
};

function normalizeRole(value: unknown): PrimaryRole {
  return value === "member" || value === "host" || value === "chef" ? value : "guest";
}

/** Set a member's primary role. Admin overrides + lifecycle promotions use this. */
export async function setPrimaryRole(memberId: string, role: PrimaryRole): Promise<void> {
  await sql`
    UPDATE members SET primary_role = ${role} WHERE id = ${memberId}
  `;
}

/** Link pending meal-first seat requests to a member after Identity signup. */
export async function linkMealSeatRequests(memberId: string, email: string | null): Promise<void> {
  if (!email) return;
  const pending = await sql`
    SELECT id, dinner_id FROM meal_seat_requests
    WHERE email = ${email} AND status = 'pending'
  `;
  for (const row of pending as { id: string; dinner_id: string }[]) {
    await sql`
      INSERT INTO dinner_guests (dinner_id, member_id, status)
      VALUES (${row.dinner_id}, ${memberId}, 'waitlisted')
      ON CONFLICT (dinner_id, member_id) DO NOTHING
    `;
    await sql`
      UPDATE meal_seat_requests SET status = 'linked' WHERE id = ${row.id}
    `;
  }
  if ((pending as unknown[]).length > 0) {
    await sql`UPDATE members SET is_approved = true WHERE id = ${memberId}`;
  }
}

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
    SELECT id, is_approved, primary_role, profile_complete
    FROM members
    WHERE netlify_identity_id = ${netlifyUser.sub}
    LIMIT 1
  `;
  const existing = existingRows[0] as
    | { id: string; is_approved: boolean; primary_role: string; profile_complete: boolean }
    | undefined;
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
    await linkMealSeatRequests(existing.id, email);
    const guestRows = await sql`
      SELECT 1 AS ok FROM dinner_guests WHERE member_id = ${existing.id} LIMIT 1
    `;
    const mealFirst = Boolean(guestRows[0]);
    return {
      id: String(existing.id),
      is_member_approved: Boolean(shouldBeApproved || existing.is_approved || mealFirst),
      primary_role: normalizeRole(existing.primary_role),
      profile_complete: Boolean(existing.profile_complete),
    };
  }

  const createdRows = await sql`
    INSERT INTO members (
      netlify_identity_id,
      email,
      first_name,
      surname,
      referred_by,
      is_approved,
      primary_role
    )
    VALUES (
      ${netlifyUser.sub},
      ${email},
      ${firstName},
      ${surname},
      ${approvedInvite?.referred_by ?? null},
      ${shouldBeApproved},
      'guest'
    )
    RETURNING id, is_approved, primary_role, profile_complete
  `;

  const created = createdRows[0] as
    | { id: string; is_approved: boolean; primary_role: string; profile_complete: boolean }
    | undefined;
  if (!created) throw new Error("Failed to create member");
  await linkMealSeatRequests(created.id, email);
  const guestRows = await sql`
    SELECT 1 AS ok FROM dinner_guests WHERE member_id = ${created.id} LIMIT 1
  `;
  const mealFirst = Boolean(guestRows[0]);
  return {
    id: String(created.id),
    is_member_approved: Boolean(created.is_approved || mealFirst),
    primary_role: normalizeRole(created.primary_role),
    profile_complete: Boolean(created.profile_complete),
  };
}
