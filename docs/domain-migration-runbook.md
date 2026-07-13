# Supper Collective — domain migration runbook

Operational checklist for moving from `sandiegosupperclub.com` to **`suppercollective.org`**. Code and SQL in this repo are updated; complete the dashboard steps below in order.

## Phase 1 — DNS and Netlify (primary domain)

1. Netlify → **Domain management** → **Add a domain** → `suppercollective.org`.
2. In **GoDaddy → DNS** for `suppercollective.org`, add records Netlify shows (typically):
   - **A** `@` → Netlify load balancer IP (often `75.2.60.5`)
   - **CNAME** `www` → `your-site-name.netlify.app`
   - Or point GoDaddy nameservers to Netlify DNS and manage records there.
3. Wait for DNS propagation; confirm SSL certificates are issued in Netlify.
4. Set **`suppercollective.org`** as **Primary domain**.
5. Enable **Force HTTPS**.

## Phase 2 — 301 redirect from old domain

1. Keep `sandiegosupperclub.com` and `www.sandiegosupperclub.com` on the **same** Netlify site.
2. Non-primary domains redirect to primary automatically (301).
3. Verify: `curl -I https://sandiegosupperclub.com` → `Location: https://suppercollective.org/...`

## Phase 3 — Resend

1. Resend → **Domains** → add `suppercollective.org`.
2. Add SPF/DKIM DNS records at GoDaddy (or Netlify DNS); wait for verification.
3. Netlify → **Environment variables** → set:
   - `RESEND_FROM_EMAIL` = `Supper Collective <hello@suppercollective.org>`
4. **Trigger a new deploy.**

Optional: GoDaddy email forwarding for inbound mail to `hello@suppercollective.org`.

## Phase 4 — Stripe

1. Stripe Dashboard → **Developers → Webhooks**.
2. Update endpoint URL to:
   `https://suppercollective.org/.netlify/functions/stripe-webhook`
3. Events: `checkout.session.completed`, `checkout.session.expired`.
4. If signing secret changes, update `STRIPE_WEBHOOK_SECRET` in Netlify and redeploy.

## Phase 5 — Netlify Identity

1. **Identity → Settings** — confirm site URL uses `https://suppercollective.org`.
2. **Identity → Email templates** — replace “SD Supper Club” with “Supper Collective”.
3. `NETLIFY_IDENTITY_ADMIN_TOKEN` does not need to change.

## Phase 6 — Production database

Run once in Neon SQL editor (Netlify → Extensions → Neon):

```bash
# Or paste contents of netlify/db/migrate-rebrand-site-content.sql
```

File: [`netlify/db/migrate-rebrand-site-content.sql`](../netlify/db/migrate-rebrand-site-content.sql)

## Phase 7 — Deploy code

Push the rebrand commit to your production branch so Netlify deploys updated copy, emails, and metadata.

## Phase 8 — Post-cutover verification

```bash
npm run verify:migration
```

Or manually:

1. `https://suppercollective.org` loads with “Supper Collective” branding.
2. Old domain 301s to new domain (`/`, `/login`, `/admin`).
3. Submit invite form → row in `invitation_requests` + admin email.
4. Log in as member; test Identity invite links on new domain.
5. Stripe test checkout → redirect to `/members/?paid=1` on new domain.
6. Both domains show valid SSL.

## Phase 9 — SEO and social

1. [Google Search Console](https://search.google.com/search-console) — add `suppercollective.org` property.
2. Use Change of Address from old property if available, or rely on 301s.
3. Update Instagram bio link to `https://suppercollective.org`.
4. Update bookmarks, printed materials, and Miro board titles as needed.

## What you do NOT need to do

- Create a new Neon database or Netlify site
- Rotate `NETLIFY_DATABASE_URL` for a domain change alone
- Re-seed admins or ask members to re-register
