type InviteResult =
  | { ok: true; invited: true }
  | { ok: true; invited: false; reason: "already_exists" }
  | { ok: false; error: string; status?: number };

function getIdentityBaseUrl(identityUrl?: string | null): string {
  const fromContext = identityUrl?.replace(/\/+$/, "");
  if (fromContext) return fromContext;

  const configured = process.env.NETLIFY_IDENTITY_URL;
  if (configured) return configured.replace(/\/+$/, "");

  // Netlify sets URL in production; netlify dev sets it locally.
  const siteUrl = process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? process.env.NETLIFY_SITE_URL ?? "";
  if (!siteUrl) return "/.netlify/identity";
  return `${siteUrl.replace(/\/+$/, "")}/.netlify/identity`;
}

async function postJson(url: string, token: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/**
 * Invite a user by email via Netlify Identity (GoTrue).
 *
 * Prefers `NETLIFY_IDENTITY_ADMIN_TOKEN` when set; otherwise uses the short-lived
 * admin JWT from `context.clientContext.identity` (Netlify Functions + Identity).
 */
export async function inviteIdentityUser(
  email: string,
  opts?: { identityAdminToken?: string | null; identityUrl?: string | null },
): Promise<InviteResult> {
  const envToken = process.env.NETLIFY_IDENTITY_ADMIN_TOKEN;
  const contextToken = opts?.identityAdminToken ?? null;
  const adminToken = envToken || contextToken || null;
  const using = envToken ? "env" : contextToken ? "context" : "none";
  // #region agent log
  fetch("http://127.0.0.1:7791/ingest/9edce051-a32e-42af-9f1a-0a04a0d1bc57", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ef69d" },
    body: JSON.stringify({
      sessionId: "2ef69d",
      runId: "post-fix",
      hypothesisId: "A,B",
      location: "netlify-identity-admin.ts:inviteIdentityUser",
      message: "invite token resolution",
      data: {
        hasEnvToken: Boolean(envToken),
        hasContextToken: Boolean(contextToken),
        using,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  console.log(
    "[debug:2ef69d] invite token resolution",
    JSON.stringify({ hasEnvToken: Boolean(envToken), hasContextToken: Boolean(contextToken), using }),
  );
  // #endregion
  if (!adminToken) {
    return {
      ok: false,
      error:
        "Missing Identity admin token (set NETLIFY_IDENTITY_ADMIN_TOKEN or enable Identity so context.clientContext.identity.token is available)",
    };
  }

  const base = getIdentityBaseUrl(opts?.identityUrl);
  const endpoints = [
    `${base}/invite`, // GoTrue classic (Netlify docs)
    `${base}/admin/invites`, // some deployments
  ];

  let lastError: InviteResult | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await postJson(endpoint, adminToken, { email });
      if (res.ok || res.status === 204) {
        return { ok: true, invited: true };
      }

      const text = await res.text();
      // Common-ish case: already invited / already exists. Treat as non-fatal.
      if (res.status === 409 || /already/i.test(text)) {
        return { ok: true, invited: false, reason: "already_exists" };
      }

      lastError = { ok: false, error: text || `Identity invite failed`, status: res.status };
    } catch (e) {
      lastError = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  return lastError ?? { ok: false, error: "Identity invite failed" };
}
