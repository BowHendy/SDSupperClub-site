export type PasswordFlowType = "invite" | "recovery";

const HASH_PARAM_BY_FLOW: Record<PasswordFlowType, string> = {
  invite: "invite_token",
  recovery: "recovery_token",
};

function hashParams(): URLSearchParams | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash || hash === "#") return null;
  return new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
}

/** Netlify Identity puts auth tokens in the URL hash on invite / recovery / confirm links. */
export function getIdentityAuthHash(): string | null {
  const params = hashParams();
  if (!params) return null;

  const keys = ["invite_token", "recovery_token", "confirmation_token"] as const;
  for (const key of keys) {
    if (params.has(key)) return window.location.hash;
  }
  return null;
}

export function identityAuthHashKind(hash: string | null): string | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  if (params.has("invite_token")) return "invite_token";
  if (params.has("recovery_token")) return "recovery_token";
  if (params.has("confirmation_token")) return "confirmation_token";
  return null;
}

export function getPasswordFlowFromHash(): PasswordFlowType | null {
  const kind = identityAuthHashKind(getIdentityAuthHash());
  if (kind === "invite_token") return "invite";
  if (kind === "recovery_token") return "recovery";
  return null;
}

export function getAuthTokenFromHash(flow: PasswordFlowType): string | null {
  const params = hashParams();
  if (!params) return null;
  const value = params.get(HASH_PARAM_BY_FLOW[flow]);
  return value?.trim() ? value : null;
}

export function clearIdentityAuthHash(): void {
  if (typeof window === "undefined") return;
  const url = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", url);
}
