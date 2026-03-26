---
name: Netlify DB Full Migration
overview: Fully replace Supabase with Netlify DB (Neon Postgres via `@netlify/neon`) across all seven Netlify functions. The schema is identical Postgres — the main work is replacing the Supabase JS client ORM calls with raw tagged-template SQL.
todos:
  - id: schema-file
    content: Create netlify/db/schema.sql with the four-table Postgres schema (users, meals, attendances, host_requests) and a comment instructing how to run it in the Neon console
    status: completed
  - id: install-neon
    content: Add @netlify/neon to package.json dependencies (npm install @netlify/neon) and remove @supabase/supabase-js
    status: completed
  - id: db-lib
    content: Create netlify/functions/lib/db.ts with a shared neon() SQL client; delete netlify/functions/lib/supabase.ts
    status: completed
  - id: auth-lib
    content: "Rewrite netlify/functions/lib/auth.ts: remove SupabaseClient import/param, rewrite getOrCreateAppUser with raw SQL (SELECT then INSERT … RETURNING)"
    status: completed
  - id: identity-signup
    content: "Rewrite netlify/functions/identity-signup.ts: replace Supabase upsert with raw SQL INSERT … ON CONFLICT DO UPDATE"
    status: completed
  - id: get-active-meal
    content: Rewrite netlify/functions/get-active-meal.ts with raw SQL (SELECT meals, COUNT attendances)
    status: completed
  - id: get-member-summary
    content: Rewrite netlify/functions/get-member-summary.ts with raw SQL for meals, user attendance, confirmed count, and host_requests
    status: completed
  - id: request-attendance
    content: Rewrite netlify/functions/request-attendance.ts with raw SQL (SELECT meal, COUNT seats, INSERT … ON CONFLICT DO UPDATE)
    status: completed
  - id: confirm-payment
    content: Rewrite netlify/functions/confirm-payment.ts with raw SQL (upsert attendance, count seats, UPDATE meal status, promote next meal)
    status: completed
  - id: request-host
    content: Rewrite netlify/functions/request-host.ts with raw SQL (SELECT pending host_request, INSERT host_request)
    status: completed
  - id: env-docs
    content: "Update .env.local.example and README.md: add NETLIFY_DATABASE_URL, remove SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, update DB setup instructions"
    status: completed
isProject: false
---

# Netlify DB Full Migration

## What changes

Every Netlify function currently calls `getServiceClient()` from `[netlify/functions/lib/supabase.ts](netlify/functions/lib/supabase.ts)` to get a Supabase client, then uses its ORM API. These are all replaced with `neon()` from `@netlify/neon` and raw tagged-template SQL.

The Netlify Identity auth layer (`netlify-identity-widget`, `getNetlifyUser`) is **untouched** — only the database layer changes.

## Files touched

- `package.json` — add `@netlify/neon`, remove `@supabase/supabase-js`
- `netlify/functions/lib/supabase.ts` → **deleted**, replaced by `netlify/functions/lib/db.ts`
- `netlify/functions/lib/auth.ts` — drop `SupabaseClient` param from `getOrCreateAppUser`, rewrite queries as raw SQL
- `netlify/functions/identity-signup.ts` — raw SQL upsert
- `netlify/functions/get-active-meal.ts` — raw SQL queries
- `netlify/functions/get-member-summary.ts` — raw SQL queries
- `netlify/functions/request-attendance.ts` — raw SQL queries
- `netlify/functions/confirm-payment.ts` — raw SQL queries
- `netlify/functions/request-host.ts` — raw SQL queries
- `netlify/db/schema.sql` — **new file**, schema to run once in Neon console
- `.env.local.example` — add `NETLIFY_DATABASE_URL`, remove Supabase vars
- `README.md` — update DB setup instructions

## Key API change in `lib/auth.ts`

`getOrCreateAppUser` currently takes a `SupabaseClient` as its first argument. After migration it owns its own connection — all callers drop the `supabase` argument:

```typescript
// Before
const appUser = await getOrCreateAppUser(supabase, netlifyUser);

// After
const appUser = await getOrCreateAppUser(netlifyUser);
```

## New `lib/db.ts` (replaces `lib/supabase.ts`)

```typescript
import { neon } from '@netlify/neon';
export const sql = neon(); // uses NETLIFY_DATABASE_URL automatically
```

## Schema setup (one-time, manual)

A new `netlify/db/schema.sql` will contain the same four-table schema as `[supabase/schema.sql](supabase/schema.sql)` (users, meals, attendances, host_requests) without Supabase-specific comments. Run it once in the Neon console (Netlify UI → Extensions → Neon → Open in Neon console → SQL editor).

## SQL translation pattern

Every Supabase ORM call becomes a raw SQL tagged template, for example:

```typescript
// Before (Supabase ORM)
const { data } = await supabase.from("users")
  .select("id, is_host_approved")
  .eq("netlify_identity_id", sub)
  .maybeSingle();

// After (Neon raw SQL)
const [row] = await sql`
  SELECT id, is_host_approved FROM users
  WHERE netlify_identity_id = ${sub} LIMIT 1
`;
```

## Environment variables

- `NETLIFY_DATABASE_URL` is set **automatically** by Netlify when Netlify DB is provisioned — no manual action needed in production.
- For local dev with `netlify dev`, Netlify CLI injects it automatically.
- Remove `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Netlify UI after verifying migration.

