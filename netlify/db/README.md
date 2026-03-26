# Netlify DB (Neon) DDL

- **[schema.sql](schema.sql)** — Full schema for new projects. Run in Neon SQL editor or via `npm run db:apply-schema`.
- **[migration_content.sql](migration_content.sql)** — If you already applied an older `schema.sql`, run this once to add site content and extra `dinners` columns.
- **[seed-content.sql](seed-content.sql)** — Optional sample marketing JSON + past dinners (safe upserts). Run after schema/migration.

## Email setup (Resend + Web3Forms)

This project uses **Resend** for system emails sent from Netlify Functions (admin notifications, approvals/rejections).

### Netlify environment variables (Production scope)

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` (example: `SDSupperClub <onboarding@resend.dev>`)
- `ADMIN_NOTIFICATION_EMAIL` (the admin inbox for new membership requests)

### Avoid duplicate emails

If you previously configured Web3Forms to email admins directly, disable that in the Web3Forms dashboard once Resend notifications are confirmed working. The form should still submit and the webhook will handle notifications.
