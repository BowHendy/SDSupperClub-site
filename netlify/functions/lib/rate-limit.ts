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
 * Increment a named bucket atomically. Returns allowed=false when the count
 * would exceed max within the rolling windowSeconds window.
 */
export async function consumeRateLimit(params: {
  bucket: string;
  max: number;
  windowSeconds: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  await ensureTable();
  const { bucket, max, windowSeconds } = params;

  const rows = await sql`
    INSERT INTO public.rate_limit_buckets (bucket, hit_count, window_start)
    VALUES (${bucket}, 1, now())
    ON CONFLICT (bucket) DO UPDATE
      SET
        hit_count = CASE
          WHEN public.rate_limit_buckets.window_start <= now() - (${windowSeconds} * interval '1 second')
            THEN 1
          ELSE public.rate_limit_buckets.hit_count + 1
        END,
        window_start = CASE
          WHEN public.rate_limit_buckets.window_start <= now() - (${windowSeconds} * interval '1 second')
            THEN now()
          ELSE public.rate_limit_buckets.window_start
        END
    RETURNING hit_count
  `;

  const hitCount = Number((rows[0] as { hit_count: number } | undefined)?.hit_count ?? 1);
  if (hitCount > max) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: Math.max(0, max - hitCount) };
}
