import { sql } from "./db";

export type DinnerRow = {
  id: string;
  status: string;
  display_date: string | null;
  host_id: string | null;
  chef_id: string | null;
  max_seats: number;
  host_confirmed_at: string | null;
  chef_confirmed_at: string | null;
  t14_warning_sent: boolean;
  t7_ingredient_paid: boolean;
  subsidy_required: boolean;
  subsidy_paid_amount: number;
  meal_price_per_guest: number | null;
};

export function daysUntilDisplayDate(displayDate: string | null): number | null {
  if (!displayDate) return null;
  const d = new Date(displayDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export async function countPaidSeats(dinnerId: string): Promise<number> {
  const rows = await sql`
    SELECT count(*)::int AS c FROM dinner_guests
    WHERE dinner_id = ${dinnerId} AND status IN ('paid', 'confirmed', 'attended')
  `;
  return (rows[0] as { c: number } | undefined)?.c ?? 0;
}

export async function getDinnerById(dinnerId: string): Promise<DinnerRow | null> {
  const rows = await sql`
    SELECT
      id, status, display_date, host_id, chef_id, max_seats,
      host_confirmed_at, chef_confirmed_at, t14_warning_sent, t7_ingredient_paid,
      subsidy_required, subsidy_paid_amount, meal_price_per_guest
    FROM dinners WHERE id = ${dinnerId} LIMIT 1
  `;
  const row = rows[0] as DinnerRow | undefined;
  return row ?? null;
}

/** Host has an active live-ish meal (blocks RSVP at other hosts per G4). */
export async function hostHasActiveLiveMeal(hostId: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1 AS ok FROM dinners
    WHERE host_id = ${hostId}
      AND status IN ('draft', 'dual_confirm_pending', 'live', 'full', 'subsidy_pending')
    LIMIT 1
  `;
  return Boolean(rows[0]);
}
