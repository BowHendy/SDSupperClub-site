/**
 * Full site + Netlify DB health check.
 * Usage: npm run health
 *
 * Loads NETLIFY_DATABASE_URL from .env.local or .env (never commit real values).
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@netlify/neon";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const EXPECTED_TABLES = [
  "site_content",
  "admins",
  "invitation_requests",
  "members",
  "hosts",
  "chefs",
  "dinners",
  "dinner_guests",
];

const ENV_CHECKS = [
  {
    key: "NETLIFY_DATABASE_URL",
    note: "required for all Netlify Functions that use the DB",
  },
  {
    key: "RESEND_API_KEY",
    note: "emails won't send without this",
  },
  {
    key: "RESEND_FROM_EMAIL",
    note: "sender address for Resend (defaults to onboarding@resend.dev if unset)",
    optional: true,
  },
  {
    key: "ADMIN_NOTIFICATION_EMAILS",
    note: "comma-separated admin inboxes for new membership request emails",
    optional: true,
  },
  {
    key: "ADMIN_NOTIFICATION_EMAIL",
    note: "fallback single admin inbox if ADMIN_NOTIFICATION_EMAILS is unset",
    optional: true,
  },
  {
    key: "NETLIFY_IDENTITY_ADMIN_TOKEN",
    note: "required to send Identity invites on approve",
  },
  {
    key: "NEXT_PUBLIC_NETLIFY_IDENTITY_URL",
    note: "only needed for local dev off Netlify origin",
    optional: true,
  },
];

function ok(label) {
  return `  ✓ ${label}`;
}

function fail(label, note) {
  return note ? `  ✗ ${label}          (${note})` : `  ✗ ${label}`;
}

function section(title) {
  console.log("");
  console.log(title);
}

async function countTable(sql, table) {
  const queries = {
    site_content: sql`SELECT count(*)::int AS n FROM site_content`,
    admins: sql`SELECT count(*)::int AS n FROM admins`,
    invitation_requests: sql`SELECT count(*)::int AS n FROM invitation_requests`,
    members: sql`SELECT count(*)::int AS n FROM members`,
    hosts: sql`SELECT count(*)::int AS n FROM hosts`,
    chefs: sql`SELECT count(*)::int AS n FROM chefs`,
    dinners: sql`SELECT count(*)::int AS n FROM dinners`,
    dinner_guests: sql`SELECT count(*)::int AS n FROM dinner_guests`,
  };
  const rows = await queries[table];
  return rows[0]?.n ?? 0;
}

console.log("=== Supper Collective — Site Health Check ===");

section("ENV VARS");
for (const { key, note, optional } of ENV_CHECKS) {
  const value = process.env[key];
  if (value) {
    console.log(ok(key));
  } else if (optional) {
    console.log(`  - ${key}          (optional — ${note})`);
  } else {
    console.log(fail(key, note));
  }
}

section("NETLIFY FORMS");
const formsHtml = path.join(root, "public", "__forms.html");
if (fs.existsSync(formsHtml)) {
  const html = fs.readFileSync(formsHtml, "utf8");
  const hasInviteForm = html.includes('name="invite-request"');
  console.log(ok("public/__forms.html exists"));
  console.log(hasInviteForm ? ok('invite-request form skeleton present') : fail('invite-request form skeleton missing'));
  console.log("  → submission-created function must be wired in Netlify UI (Forms → invite-request → submission-created)");
} else {
  console.log(fail("public/__forms.html missing", "Netlify may not detect invite-request form at build time"));
}

const url = process.env.NETLIFY_DATABASE_URL;
if (!url) {
  section("DATABASE");
  console.log(fail("Cannot connect", "Missing NETLIFY_DATABASE_URL"));
  console.log("");
  console.log("Set NETLIFY_DATABASE_URL in .env.local, then re-run: npm run health");
  process.exit(1);
}

section("DATABASE");
let sql;
try {
  sql = neon(url);
  const ping = await sql`SELECT 1 AS ok`;
  if (!ping?.[0] || Number(ping[0].ok) !== 1) {
    console.log(fail("Unexpected ping response", JSON.stringify(ping)));
    process.exit(1);
  }
  console.log(ok("Connected (Neon Postgres)"));
} catch (e) {
  console.log(fail("Connection failed", e instanceof Error ? e.message : String(e)));
  process.exit(1);
}

try {
  const tableRows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const existing = new Set(tableRows.map((r) => r.table_name));

  for (const table of EXPECTED_TABLES) {
    if (!existing.has(table)) {
      console.log(fail(`${table.padEnd(22)} missing`, "run npm run db:apply-schema"));
      continue;
    }
    const n = await countTable(sql, table);
    const suffix = table === "admins" && n === 0 ? " ← add your email to admins table" : "";
    console.log(`  ${table.padEnd(22)} ${n} row(s)${suffix}`);
  }

  const extra = [...existing].filter((t) => !EXPECTED_TABLES.includes(t));
  if (extra.length > 0) {
    console.log(`  (other tables: ${extra.join(", ")})`);
  }
} catch (e) {
  console.log(fail("Schema check failed", e instanceof Error ? e.message : String(e)));
  process.exit(1);
}

section("ADMINS");
try {
  const admins = await sql`
    SELECT email, created_at
    FROM admins
    ORDER BY created_at ASC
  `;
  if (admins.length === 0) {
    console.log(fail("No admin emails registered"));
    console.log("  Run in Neon SQL console:");
    console.log("  INSERT INTO admins (email) VALUES ('your-email@example.com') ON CONFLICT DO NOTHING;");
  } else {
    for (const row of admins) {
      const when = row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "";
      console.log(`  ${when}  ${row.email}`);
    }
  }
} catch (e) {
  console.log(fail("Could not read admins", e instanceof Error ? e.message : String(e)));
}

section("RECENT INVITATION REQUESTS");
try {
  const requests = await sql`
    SELECT email, status, created_at, source
    FROM invitation_requests
    ORDER BY created_at DESC
    LIMIT 5
  `;
  if (requests.length === 0) {
    console.log("  (none — submit the invite form on the site to test submission-created → DB)");
  } else {
    for (const row of requests) {
      const when = row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "";
      const src = row.source ? `  [${row.source}]` : "";
      console.log(`  ${when}  ${row.email}   ${row.status}${src}`);
    }
  }
} catch (e) {
  console.log(fail("Could not read invitation_requests", e instanceof Error ? e.message : String(e)));
}

console.log("");
