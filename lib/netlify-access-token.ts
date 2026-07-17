"use client";

function readNfJwtCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)nf_jwt=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

/** Access token for Netlify Functions (Identity JWT). */
export async function getAccessToken(): Promise<string | null> {
  const fromCookie = readNfJwtCookie();
  if (fromCookie) return fromCookie;

  try {
    const { getUser } = await import("@netlify/identity");
    const user = await getUser();
    if (!user) return null;
  } catch {
    return null;
  }

  return readNfJwtCookie();
}
