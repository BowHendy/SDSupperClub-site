/**
 * Applies a single SQL migration file using NETLIFY_DATABASE_URL.
 * Usage: npm run db:migrate -- netlify/db/migrate-invite-birth-year.sql
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const rel = process.argv[2];
if (!rel) {
  console.error("Usage: node scripts/apply-migration.mjs <path-to.sql>");
  process.exit(1);
}

const url = process.env.NETLIFY_DATABASE_URL;
if (!url) {
  console.error("Missing NETLIFY_DATABASE_URL.");
  process.exit(1);
}

const migrationPath = path.join(root, rel);
const ddl = fs.readFileSync(migrationPath, "utf8");
const sql = postgres(url, { max: 1 });

try {
  await sql.unsafe(ddl);
  console.log("Applied:", migrationPath);
} finally {
  await sql.end({ timeout: 5 });
}
