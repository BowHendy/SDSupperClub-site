import type { Handler } from "@netlify/functions";
import { getNetlifyUser } from "./lib/auth";
import { sql } from "./lib/db";
import { haversineKm } from "./lib/geocode";

const jsonHeaders = { "Content-Type": "application/json" };

type DinnerRow = {
  id: string;
  display_date: string | null;
  month: string;
  year: number;
  zip: string | null;
  neighborhood: string;
  chef_name: string;
  status: string;
  max_seats: number;
  latitude: number | null;
  longitude: number | null;
};

function parseCoord(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function chefFirstName(chefName: string | null | undefined): string | null {
  if (!chefName || chefName === "TBA") return null;
  return chefName.trim().split(/\s+/)[0] ?? null;
}

/**
 * Public next-meal teaser.
 * - Optional ?lat=&lng= picks the nearest visible live/upcoming/full dinner with coordinates.
 * - Without geo (or no geo dinners): soonest by display_date.
 * - Logged out: { date, zip } only.
 * - Logged in (Identity JWT): richer teaser, still no full address / seat CTA.
 */
export const handler: Handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const params = event.queryStringParameters ?? {};
    const viewerLat = parseCoord(params.lat ?? null);
    const viewerLng = parseCoord(params.lng ?? null);
    const signedIn = Boolean(getNetlifyUser(context));

    const meals = (await sql`
      SELECT
        id, display_date, month, year, zip, neighborhood, chef_name, status, max_seats,
        latitude, longitude
      FROM dinners
      WHERE is_visible = true AND status IN ('live', 'upcoming', 'full')
      ORDER BY
        CASE WHEN display_date IS NULL THEN 1 ELSE 0 END,
        display_date ASC NULLS LAST,
        created_at ASC
    `) as DinnerRow[];

    if (meals.length === 0) {
      return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ meal: null }) };
    }

    let meal: DinnerRow = meals[0]!;

    if (viewerLat != null && viewerLng != null) {
      const withCoords = meals.filter(
        (m) => m.latitude != null && m.longitude != null && Number.isFinite(Number(m.latitude)) && Number.isFinite(Number(m.longitude)),
      );
      if (withCoords.length > 0) {
        let best = withCoords[0]!;
        let bestKm = haversineKm(viewerLat, viewerLng, Number(best.latitude), Number(best.longitude));
        for (let i = 1; i < withCoords.length; i++) {
          const m = withCoords[i]!;
          const km = haversineKm(viewerLat, viewerLng, Number(m.latitude), Number(m.longitude));
          if (km < bestKm) {
            best = m;
            bestKm = km;
          }
        }
        meal = best;
      }
    }

    const date =
      meal.display_date ??
      (meal.month && meal.year ? `${meal.month} ${meal.year}` : null);

    if (!signedIn) {
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({
          meal: {
            date,
            zip: meal.zip,
          },
        }),
      };
    }

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        meal: {
          date,
          zip: meal.zip,
          neighborhood: meal.neighborhood,
          chefFirstName: chefFirstName(meal.chef_name),
          status: meal.status,
        },
      }),
    };
  } catch (e) {
    console.error("get-active-meal", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
