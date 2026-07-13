# Netlify DB (Neon) DDL

- **[schema.sql](schema.sql)** — Full schema for new projects. Run in Neon SQL editor or via `npm run db:apply-schema`. **Destructive:** drops existing tables first — do not run on a database you want to keep.
- **[migrate-actor-model.sql](migrate-actor-model.sql)** — Non-destructive upgrade for an existing database to the actor model (primary roles, host/chef profiles, dinner lifecycle + milestones, payments/payouts/disputes, platform settings). Idempotent; safe to re-run.
- **[migration_content.sql](migration_content.sql)** — If you already applied an older `schema.sql`, run this once to add site content and extra `dinners` columns.
- **[seed-content.sql](seed-content.sql)** — Optional sample marketing JSON + past dinners (safe upserts). Run after schema/migration.
- **[seed-admins.sql](seed-admins.sql)** — Insert default admin emails. Run in Neon or via `npm run db:seed-admins`.
- **[migrate-rebrand-site-content.sql](migrate-rebrand-site-content.sql)** — One-time update of `site_content` contact/venue copy for Supper Collective rebrand.

## Email setup (Resend + Web3Forms)

This project uses **Resend** for system emails sent from Netlify Functions (admin notifications, approvals/rejections).

### Netlify environment variables (Production scope)

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (example: `Supper Collective <hello@suppercollective.org>`)
- `ADMIN_NOTIFICATION_EMAILS` (comma-separated) or `ADMIN_NOTIFICATION_EMAIL` (single inbox)
- `NETLIFY_IDENTITY_ADMIN_TOKEN` (required to send Identity invites on approve)

### Avoid duplicate emails

If you previously configured Web3Forms to email admins directly, disable that in the Web3Forms dashboard once Resend notifications are confirmed working. The form should still submit and the webhook will handle notifications.
