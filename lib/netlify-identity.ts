"use client";

/* netlify-identity-widget ships a UMD bundle; dynamic import avoids Turbopack static export errors. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NetlifyIdentityModule = any;

let cached: NetlifyIdentityModule | null = null;

export async function loadNetlifyIdentity(): Promise<NetlifyIdentityModule> {
  if (typeof window === "undefined") {
    throw new Error("Netlify Identity is only available in the browser");
  }
  if (cached) return cached;
  const mod = await import("netlify-identity-widget");
  cached = (mod as { default?: NetlifyIdentityModule }).default ?? mod;
  return cached;
}

let inited = false;

export async function initNetlifyIdentity(): Promise<void> {
  if (typeof window === "undefined" || inited) return;
  const ni = await loadNetlifyIdentity();
  inited = true;
  const url = process.env.NEXT_PUBLIC_NETLIFY_IDENTITY_URL;
  if (url) {
    ni.init({ APIUrl: url });
  } else {
    ni.init();
  }
}
