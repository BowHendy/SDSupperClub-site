---
name: Secure admin email setup
overview: Configure `juliebhendy@gmail.com` as the recipient for host-request notifications by setting `ADMIN_NOTIFICATION_EMAIL` only in Netlify (server-side), pairing it with Resend credentials, and verifying delivery—without storing the real address in tracked files.
todos:
  - id: netlify-env
    content: Add ADMIN_NOTIFICATION_EMAIL, RESEND_API_KEY, RESEND_FROM_EMAIL in Netlify UI (no NEXT_PUBLIC_)
    status: completed
  - id: resend-domain
    content: Verify sending domain + from address in Resend; avoid unverified production from-address
    status: completed
  - id: redeploy-test
    content: Redeploy site; test Request to host and confirm inbox + function logs
    status: completed
isProject: false
---

# Secure setup: admin notification email

## How the app uses it

`[netlify/functions/request-host.ts](netlify/functions/request-host.ts)` sends email only when **both** `RESEND_API_KEY` and `ADMIN_NOTIFICATION_EMAIL` are set. Values come from `process.env` on Netlify (Functions runtime), so they are **not** exposed in the static Next.js bundle as long as you do **not** prefix them with `NEXT_PUBLIC_`.

```7:14:netlify/functions/request-host.ts
async function notifyAdminEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!apiKey || !to) {
    console.log("request-host: no RESEND_API_KEY or ADMIN_NOTIFICATION_EMAIL; skipping email");
    return;
  }
```

## Recommended approach (secure)

1. **Do not commit** `juliebhendy@gmail.com` (or production API keys) to [.env.local](.env.local), `.env`, or the repo. Keep [.env.local.example](.env.local.example) as placeholders only.
2. **Set variables in Netlify** only: **Site configuration → Environment variables → Add a variable** (scope: **Production**, and **Deploy previews** if you want previews to notify the same inbox).
  - `ADMIN_NOTIFICATION_EMAIL` = `juliebhendy@gmail.com`
  - `RESEND_API_KEY` = your Resend API key (treat as secret; restrict who can view Netlify team settings)
  - `RESEND_FROM_EMAIL` = a **verified sender** in Resend (see below). Avoid relying on `onboarding@resend.dev` for real ops long-term—Resend documents limits for testing domains.
3. **Redeploy** the site after saving env vars (or trigger a deploy) so Functions pick up the new values.
4. **Resend checklist**
  - Add/verify your **sending domain** in Resend and use a `from` address on that domain in `RESEND_FROM_EMAIL` (format like `SDSupperClub <notifications@yourdomain.com>`).
  - Confirm the **API key** has permission to send.
  - Check spam folder on first test for `juliebhendy@gmail.com`.
5. **Operational security**
  - Limit Netlify team access; turn on **2FA** for accounts that can read env vars.
  - Store the inbox + Resend login in a **password manager** if you need runbooks; keep the repo generic.

## Verification

- After deploy: log in as a member, submit **Request to host**, confirm an email arrives at `juliebhendy@gmail.com`.
- If no email: check **Netlify → Functions → request-host → Logs** for `Resend error` or the “skipping email” log line (means env missing or typo).

## Optional hardening (later)

- Use a **club domain** alias (e.g. `admin@yourdomain.com`) that forwards to Julie’s Gmail for less exposure of personal addresses in support threads.
- Add rate limiting or auditing in the function if host-request spam becomes an issue (out of scope for “set the address”).

