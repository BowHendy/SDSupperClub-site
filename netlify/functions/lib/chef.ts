import { sql } from "./db";

export type ApprovedChef = {
  id: string;
  member_id: string | null;
};

export async function getApprovedChefForMember(memberId: string): Promise<ApprovedChef | null> {
  const rows = await sql`
    SELECT id, member_id FROM chefs
    WHERE member_id = ${memberId} AND approval_status = 'approved'
    LIMIT 1
  `;
  const row = rows[0] as ApprovedChef | undefined;
  return row ? { id: String(row.id), member_id: row.member_id ? String(row.member_id) : null } : null;
}

/** Auto-pair: first approved chef matching food_genre (v1). */
export async function pairChefByGenre(foodGenre: string): Promise<string | null> {
  if (!foodGenre.trim()) return null;
  const rows = await sql`
    SELECT id FROM chefs
    WHERE approval_status = 'approved'
      AND ${foodGenre} = ANY(food_genres)
    ORDER BY created_at ASC
    LIMIT 1
  `;
  const row = rows[0] as { id: string } | undefined;
  return row ? String(row.id) : null;
}
