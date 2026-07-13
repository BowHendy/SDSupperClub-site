import { sql } from "./db";

export type ApprovedHost = {
  id: string;
  member_id: string;
};

/** Returns the approved host record for a member, or null if not an approved host. */
export async function getApprovedHostForMember(memberId: string): Promise<ApprovedHost | null> {
  const rows = await sql`
    SELECT id, member_id
    FROM hosts
    WHERE member_id = ${memberId} AND approval_status = 'approved'
    LIMIT 1
  `;
  const row = rows[0] as ApprovedHost | undefined;
  return row ? { id: String(row.id), member_id: String(row.member_id) } : null;
}

/** Confirms a dinner belongs to the given host. */
export async function hostOwnsDinner(hostId: string, dinnerId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok FROM dinners WHERE id = ${dinnerId} AND host_id = ${hostId} LIMIT 1
  `;
  return Boolean(rows[0]);
}

/** Human-friendly label for a dinner, used in emails. */
export function dinnerLabel(d: {
  title?: string | null;
  month?: string | null;
  year?: number | null;
  neighborhood?: string | null;
}): string {
  const parts = [d.title?.trim(), [d.month, d.year].filter(Boolean).join(" ").trim(), d.neighborhood?.trim()]
    .filter((p): p is string => Boolean(p && p.length));
  return parts.join(" · ");
}
