type InviteResult =
  | { ok: true; invited: true }
  | { ok: true; invited: false; reason: "already_exists" }
  | { ok: false; error: string; status?: number };

function getIdentityBaseUrl(): string {
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
 * Requires a GoTrue admin token in `NETLIFY_IDENTITY_ADMIN_TOKEN`.
 *
 * Netlify's public docs emphasize using `@netlify/identity` for admin operations,
 * but this repo uses lambda-compatible functions. So we call the GoTrue endpoint directly.
 */
export async function inviteIdentityUser(email: string): Promise<InviteResult> {
  const adminToken = process.env.NETLIFY_IDENTITY_ADMIN_TOKEN;
  if (!adminToken) {
    return { ok: false, error: "Missing NETLIFY_IDENTITY_ADMIN_TOKEN" };
  }

  const base = getIdentityBaseUrl();
  const endpoints = [
    `${base}/admin/invites`, // some deployments
    `${base}/invite`, // GoTrue classic
  ];

  let lastError: InviteResult | null = null;

  for (const endpoint of endpoints) {
    try {
      const res = await postJson(endpoint, adminToken, { email });
      if (res.ok) {
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

