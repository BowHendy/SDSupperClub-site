/**
 * Applies netlify/db/schema.sql using NETLIFY_DATABASE_URL from .env.local or .env.
 * Usage: npm run db:apply-schema
 *
 * You can also paste the contents of netlify/db/schema.sql into the Neon SQL editor.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const url = process.env.NETLIFY_DATABASE_URL;
if (!url) {
  console.error("Missing NETLIFY_DATABASE_URL.");
  console.error("Set it in .env.local, then re-run this script.");
  process.exit(1);
}

const schemaPath = path.join(root, "netlify", "db", "schema.sql");
const ddl = fs.readFileSync(schemaPath, "utf8");

const sql = postgres(url, { max: 1 });

try {
  await sql.unsafe(ddl);
  console.log("Applied:", schemaPath);
} finally {
  await sql.end({ timeout: 5 });
}
