"use client";

import { loadNetlifyIdentity } from "./netlify-identity";
import { netlifyFunctionUrl } from "./netlify-paths";

export { netlifyFunctionUrl };

/** Authenticated fetch to Netlify Functions (Identity JWT). */
export async function fetchAuthed(path: string, init?: RequestInit): Promise<Response> {
  const ni = await loadNetlifyIdentity();
  const user = ni.currentUser();
  const token = user?.token?.access_token;
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
