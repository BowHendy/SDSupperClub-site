/**
 * Geocode a US ZIP to lat/lng via Nominatim (OpenStreetMap).
 * Results should be stored on the dinner row — do not call on every public request.
 */

export type GeocodeResult = { ok: true; lat: number; lng: number } | { ok: false; error: string };

const US_ZIP_RE = /^\d{5}$/;

export function normalizeUsZip(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = m?.[1] ?? null;
  return zip && US_ZIP_RE.test(zip) ? zip : null;
}

export async function geocodeUsZip(zip: string): Promise<GeocodeResult> {
  const normalized = normalizeUsZip(zip);
  if (!normalized) {
    return { ok: false, error: "Invalid ZIP" };
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("postalcode", normalized);
  url.searchParams.set("country", "US");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "SupperCollective/1.0 (meal proximity; hello@suppercollective.org)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return { ok: false, error: `Geocode HTTP ${res.status}` };
  }

  const rows = (await res.json()) as { lat?: string; lon?: string }[];
  const first = rows[0];
  const lat = first?.lat ? Number.parseFloat(first.lat) : NaN;
  const lng = first?.lon ? Number.parseFloat(first.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "No geocode result" };
  }
  return { ok: true, lat, lng };
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
