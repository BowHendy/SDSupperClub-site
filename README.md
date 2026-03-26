# SDSupperClub

A static website for SDSupperClub — a private, invite-only dining club in San Diego. Built with Next.js (App Router), Tailwind CSS, and Framer Motion. Deployed on **Netlify** with **Netlify Identity**, **Netlify Functions**, and [**Netlify DB**](https://docs.netlify.com/netlify-db/) (Neon Postgres) for members, meals, and RSVPs.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.local.example` to `.env.local`. See comments there for:

   - Web3Forms (optional invite form)
   - `NEXT_PUBLIC_NETLIFY_IDENTITY_URL` — only if you run the frontend outside Netlify (see below)
   - `NETLIFY_DATABASE_URL` — optional for local-only testing; `npx netlify dev` injects it when Netlify DB is linked

3. **Netlify DB (schema)**

   - Link [Netlify DB](https://docs.netlify.com/netlify-db/) to your site (CLI `npx netlify db init`, UI **Extensions → Neon**, or deploy with `@netlify/neon` in dependencies).
   - **Claim** the database in the Netlify UI if you need it beyond the trial window ([claim your database](https://docs.netlify.com/netlify-db/)).
   - Apply the DDL once — either:
     - Paste and run [`netlify/db/schema.sql`](netlify/db/schema.sql) in the **Neon SQL editor** (open from Netlify’s Neon extension), **or**
     - Locally: put `NETLIFY_DATABASE_URL` in `.env.local` (gitignored), then run `npm run db:apply-schema`.
   - Verify connectivity (optional): `npm run db:verify` with `NETLIFY_DATABASE_URL` in `.env.local`.
   - Existing databases: run [`netlify/db/migration_content.sql`](netlify/db/migration_content.sql) once if `site_content` or new `meals` columns are missing.
   - Optional content seed (past menus + marketing JSON): [`netlify/db/seed-content.sql`](netlify/db/seed-content.sql) in Neon. See [`netlify/db/README.md`](netlify/db/README.md).
   - Optionally run [`supabase/seed.sql`](supabase/seed.sql) in the same database for a sample live meal (compatible Postgres SQL).

4. **Netlify**

   - Connect this repo and use the included [`netlify.toml`](netlify.toml) (build: `npm run build`, publish: `out`, functions: `netlify/functions`).
   - **Site → Identity → Enable Identity** — set registration to **Invite only**.
   - `NETLIFY_DATABASE_URL` is set automatically when Netlify DB is connected; no manual secret for the DB URL is required in production.
   - Optional: `ADMIN_NOTIFY_SECRET` for the `notify-waitlist` stub.
   - Invite members from **Identity → Invite users**.

   **Host-request admin email (Resend)** — set these only in Netlify (server-side). Do **not** use the `NEXT_PUBLIC_` prefix and do **not** commit real values to git. See [Admin notification email (secure setup)](#admin-notification-email-secure-setup) below.

5. **Run locally**

   **Static site + functions + Identity + DB (recommended):**

   ```bash
   npx netlify dev
   ```

   Open the URL Netlify prints (often `http://localhost:8888`). Functions live at `/.netlify/functions/*`.

   **Next.js only** (no Functions / Identity on localhost unless you set `NEXT_PUBLIC_NETLIFY_IDENTITY_URL` to your deployed site’s Identity URL):

   ```bash
   npm run dev
   ```

## Build for production (static export)

```bash
npm run build
```

Output is in **`out/`**. On Netlify, the build command above runs automatically; Functions in `netlify/functions/` deploy alongside the static site.

## Netlify DB post-provisioning checklist

Do these after Neon / Netlify DB is created for the site (code already expects `@netlify/neon` and `NETLIFY_DATABASE_URL` in Functions).

1. **Rotate DB credentials if they were ever exposed** (chat, screenshot, ticket): Neon console → reset password for the DB role → copy the new connection string → **Netlify → Environment variables → `NETLIFY_DATABASE_URL`** → save → **redeploy**. Never commit the URL or password to git.
2. **Verify env in Netlify:** **Site configuration → Environment variables** → confirm **`NETLIFY_DATABASE_URL`** exists for **Production** (and **Deploy previews** if previews should use the DB). For a quick local check: same variable in `.env.local`, then `npm run db:verify`.
3. **Apply schema:** Run [`netlify/db/schema.sql`](netlify/db/schema.sql) in Neon’s SQL editor, or locally `npm run db:apply-schema` with `NETLIFY_DATABASE_URL` set. If the DB already existed, run [`netlify/db/migration_content.sql`](netlify/db/migration_content.sql) once, then optional [`netlify/db/seed-content.sql`](netlify/db/seed-content.sql).
4. **Claim Neon** (long-term): **Extensions → Neon → Connect / Claim** so the instance is not removed after the unclaimed trial period ([docs](https://docs.netlify.com/netlify-db/)).
5. **Trace “signup” issues:** There are two paths:
  - **Marketing “request invite” form** ([`components/ui/InviteForm.tsx`](components/ui/InviteForm.tsx)): uses **Web3Forms** + hCaptcha and **`NEXT_PUBLIC_WEB3FORMS_KEY`** only — not Netlify DB. If the key is missing, the UI now explains that. hCaptcha requires enabling the hCaptcha block option in your Web3Forms dashboard.
   - **Member account (Identity invite accepted):** Netlify Identity calls **`identity-signup`** → writes to **`users`**. If that fails, open **Netlify → Functions → `identity-signup` → Logs** (typical causes: missing `NETLIFY_DATABASE_URL`, or schema not applied → `relation "users" does not exist`).

## Admin notification email (secure setup)

[`request-host`](netlify/functions/request-host.ts) emails the club when a member requests to host. Delivery uses [Resend](https://resend.com). The admin inbox and API key exist **only** in the Netlify Functions environment (not in the static site bundle).

### 1. Netlify environment variables

In **Netlify → Site configuration → Environment variables**, add (scopes: at least **Production**; add **Deploy Previews** only if previews should send real emails):

| Variable | Purpose |
| -------- | ------- |
| `ADMIN_NOTIFICATION_EMAIL` | Inbox that receives host-request notifications (e.g. the club admin’s email). |
| `RESEND_API_KEY` | Resend API key — treat as a secret; restrict who can view Netlify settings. |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `SDSupperClub <notifications@yourdomain.com>`. |

Never commit these to the repo or put them in `.env.local` if that file might be pushed. Keep [.env.local.example](.env.local.example) as placeholders only.

### 2. Resend

1. Create an API key with send permission.
2. **Verify a sending domain** and use a `from` address on that domain in `RESEND_FROM_EMAIL`.
3. Avoid relying on Resend’s unverified testing `from` addresses for long-term production mail.

### 3. Redeploy and verify

1. **Trigger a new deploy** after saving env vars so functions pick them up.
2. Log in on the live site, open **Members**, submit **Request to host**.
3. Confirm the message arrives at the admin inbox (check spam on first send).
4. If nothing arrives: **Netlify → Functions → `request-host` → Logs** — look for `Resend error` or the log line that indicates missing `RESEND_API_KEY` / `ADMIN_NOTIFICATION_EMAIL`.

### 4. Operational security

- Use **2FA** on Netlify and Resend; limit team access to environments that hold secrets.
- Prefer a **dedicated club address** or forwarder instead of a personal inbox where possible.

## Architecture

| Piece | Role |
| ----- | ---- |
| `app/login/` | Netlify Identity widget (log in) |
| `app/members/` | Dashboard: meal, request to attend, pay stub, request to host, manage-meal scaffold |
| `components/sections/UpcomingDinner.tsx` | Public “upcoming dinner” from `get-active-meal` + Neon-backed marketing fallback |
| `components/sections/PastMenus.tsx` | Past menus from `get-past-meals` (`meals.status = past`) |
| `SiteContentProvider` | Loads hero / experience / contact / membership copy from `get-site-content` |
| `netlify/functions/` | API: Netlify DB (`@netlify/neon`), Identity signup hook, stubs for waitlist + payment |
| `netlify/db/schema.sql` | `users`, `meals`, `attendances`, `host_requests`, `site_content` |

### Netlify Functions

| Function | Purpose |
| -------- | ------- |
| `identity-signup` | Identity trigger — upserts a row in `public.users` |
| `get-active-meal` | Public — current visible meal + seat counts |
| `get-past-meals` | Public — past menus for marketing (`meals` with `status = past`) |
| `get-site-content` | Public — JSON document for hero, experience, membership, contact (`site_content.key = site`) |
| `get-member-summary` | Authed — meal + your attendance + host flags |
| `request-attendance` | Authed — waitlist for a live meal |
| `confirm-payment` | Stub — marks paid; closes meal at `max_seats`; promotes next `upcoming` → `live` |
| `request-host` | Authed — `host_requests` row; optional Resend email to admin |
| `notify-waitlist` | Stub — returns 501 (wire email + DB later) |

### Admin tasks (for now)

- Approve hosts: set `users.is_host_approved = true` in Neon for that member.
- Create / transition meals: edit `meals` rows (`status`, `is_visible`) in Neon.
- Marketing copy: edit `site_content` row where `key = 'site'` (JSON), or use [`netlify/db/seed-content.sql`](netlify/db/seed-content.sql) as a template.

## Project structure

- `app/` — Next.js App Router (pages, layout).
- `components/` — UI and sections.
- `lib/` — Default/fallback content, Netlify helpers, site content types.
- `netlify/functions/` — Serverless API.
- `netlify/db/` — SQL schema for Netlify DB.
- `supabase/` — Legacy folder name; optional `seed.sql` still works against Neon.
## Features

- **Marketing pages** — copy and upcoming fallback from Neon (`get-site-content`) with [`lib/default-site-content.ts`](lib/default-site-content.ts) as offline fallback; past menus from `get-past-meals`.
- **Invitation form** — Web3Forms (or swap to Netlify Forms).
- **Members** — Netlify Identity + Netlify DB–backed dashboard.

## Adding a hero image

Place an image at `public/images/hero.jpg` to use as the hero background. The site will work without it (gradient fallback).
