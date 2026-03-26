/**
 * Loads NETLIFY_DATABASE_URL from .env.local or .env (never commit real values).
 * Usage: npm run db:verify
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { neon } from "@netlify/neon";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });
dotenv.config({ path: path.join(root, ".env") });

const url = process.env.NETLIFY_DATABASE_URL;
if (!url) {
  console.error("Missing NETLIFY_DATABASE_URL.");
  console.error("Set it in .env.local (local) or Netlify Site → Environment variables (production).");
  process.exit(1);
}

const sql = neon(url);
const rows = await sql`SELECT 1 AS ok`;
if (!rows?.[0] || Number(rows[0].ok) !== 1) {
  console.error("Unexpected response:", rows);
  process.exit(1);
}
console.log("NETLIFY_DATABASE_URL: connection OK (SELECT 1).");
