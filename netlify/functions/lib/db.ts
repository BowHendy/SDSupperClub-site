import { neon } from "@netlify/neon";

/** Tagged-template SQL client; uses `NETLIFY_DATABASE_URL` from Netlify DB. */
export const sql = neon();
