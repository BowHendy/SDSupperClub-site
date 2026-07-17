/**
 * Simple DB-backed rate limits for public Netlify Functions.
 * Creates the bucket table on first use so no separate migrate step is required.
 */

import { sql } from "./db";

let ensured = false;

async function ensureTable(): Promise<void> {
  if (ensured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
      bucket text PRIMARY KEY,
      hit_count int NOT NULL DEFAULT 0,
      window_start timestamptz NOT NULL DEFAULT now()
    )
  `;
  ensured = true;
}

export function clientIpFromEvent(event: {
  headers?: Record<string, string | undefined> | null;
}): string {
  const headers = event.headers ?? {};
  const nf = headers["x-nf-client-connection-ip"]?.trim();
  if (nf) return nf;
  const forwarded = headers["x-forwarded-for"]?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = headers["x-real-ip"]?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Increment a named bucket. Returns allowed=false when the count would exceed max
 * within the rolling windowSeconds window (resets after the window elapses).
 */
export async function consumeRateLimit(params: {
  bucket: string;
  max: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  await ensureTable();
  const { bucket, max, windowSeconds } = params;

  const rows = await sql`
    SELECT hit_count, window_start FROM public.rate_limit_buckets WHERE bucket = ${bucket} LIMIT 1
  `;
  const row = rows[0] as { hit_count: number; window_start: string } | undefined;
  const now = Date.now();

  if (!row) {
    await sql`
      INSERT INTO public.rate_limit_buckets (bucket, hit_count, window_start)
      VALUES (${bucket}, 1, now())
      ON CONFLICT (bucket) DO UPDATE SET hit_count = 1, window_start = now()
    `;
    return { allowed: true, remaining: Math.max(0, max - 1) };
  }

  const windowStart = new Date(row.window_start).getTime();
  const elapsedSec = (now - windowStart) / 1000;

  if (elapsedSec >= windowSeconds) {
    await sql`
      UPDATE public.rate_limit_buckets
      SET hit_count = 1, window_start = now()
      WHERE bucket = ${bucket}
    `;
    return { allowed: true, remaining: Math.max(0, max - 1) };
  }

  if (row.hit_count >= max) {
    return { allowed: false, remaining: 0 };
  }

  await sql`
    UPDATE public.rate_limit_buckets
    SET hit_count = hit_count + 1
    WHERE bucket = ${bucket}
  `;
  return { allowed: true, remaining: Math.max(0, max - row.hit_count - 1) };
}
