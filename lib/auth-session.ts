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

/** End the current session (clears @netlify/identity cookies). */
export async function signOut(): Promise<void> {
  try {
    await identityLogout();
  } catch {
    /* session may already be cleared */
  }
}

/** Subscribe to login/logout for client nav updates. Returns unsubscribe. */
export function subscribeAuthChange(onChange: (signedIn: boolean) => void): () => void {
  return onAuthChange((event) => {
    if (event === "login") onChange(true);
    if (event === "logout") onChange(false);
  });
}
