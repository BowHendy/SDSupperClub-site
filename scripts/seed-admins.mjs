/**
 * Insert default admin emails into Neon.
 * Usage: npm run db:seed-admins
 *
 * Requires NETLIFY_DATABASE_URL in .env.local or .env.
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
  console.error("Missing NETLIFY_DATABASE_URL. Set it in .env.local and retry.");
  process.exit(1);
}

const sqlPath = path.join(root, "netlify", "db", "seed-admins.sql");
const sqlText = fs.readFileSync(sqlPath, "utf8");

const sql = postgres(url, { max: 1 });
try {
  await sql.unsafe(sqlText);
  const rows = await sql`SELECT email, created_at FROM admins ORDER BY created_at ASC`;
  console.log("Admins table:");
  for (const row of rows) {
    console.log(`  ${row.email}`);
  }
} finally {
  await sql.end();
}
