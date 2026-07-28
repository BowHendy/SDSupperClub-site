"use client";

import { getUser, logout as identityLogout, onAuthChange } from "@netlify/identity";

/** Whether a user has an active Identity session (cookie or browser storage). */
export async function isSignedIn(): Promise<boolean> {
  try {
    const user = await getUser();
    return user !== null;
  } catch {
    return false;
  }
}

function clearLocalIdentityState(): void {
  if (typeof document === "undefined") return;
  const expire = "Thu, 01 Jan 1970 00:00:00 GMT";
  const base = `path=/; secure; samesite=lax; expires=${expire}`;
  document.cookie = `nf_jwt=; ${base}`;
  document.cookie = `nf_refresh=; ${base}`;
  try {
    window.localStorage.removeItem("gotrue.user");
  } catch {
    /* ignore */
  }
}

/** End the current session and always clear local Identity cookies/storage. */
export async function signOut(): Promise<void> {
  try {
    await identityLogout();
  } catch {
    /* session may already be cleared remotely */
  } finally {
    clearLocalIdentityState();
  }
}

/** Subscribe to login/logout for client nav updates. Returns unsubscribe. */
export function subscribeAuthChange(onChange: (signedIn: boolean) => void): () => void {
  return onAuthChange((event) => {
    if (event === "login") onChange(true);
    if (event === "logout") onChange(false);
  });
}
