# Netlify DB (Neon) DDL

- **[schema.sql](schema.sql)** — Full schema for new projects. Run in Neon SQL editor or via `npm run db:apply-schema`.
- **[migration_content.sql](migration_content.sql)** — If you already applied an older `schema.sql`, run this once to add site content and extra `meals` columns.
- **[seed-content.sql](seed-content.sql)** — Optional sample marketing JSON + past dinners (safe upserts). Run after schema/migration.
