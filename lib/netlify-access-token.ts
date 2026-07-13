"use client";

import { loadNetlifyIdentity } from "./netlify-identity";

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
    const ni = await loadNetlifyIdentity();
    const user = ni.currentUser();
    if (!user) return null;

    const direct = user.token?.access_token as string | undefined;
    if (direct) return direct;

    if (typeof user.jwt === "function") {
      return (await user.jwt()) as string;
    }
  } catch {
    return null;
  }

  return null;
}
