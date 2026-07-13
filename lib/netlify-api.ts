"use client";

import { getAccessToken } from "./netlify-access-token";
import { netlifyFunctionUrl } from "./netlify-paths";

export { netlifyFunctionUrl };

/** Authenticated fetch to Netlify Functions (Identity JWT). */
export async function fetchAuthed(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(path, { ...init, headers });
}
