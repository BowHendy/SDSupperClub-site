# SDSupperClub

A static website for SDSupperClub — a private, invite-only dining club in San Diego. Built with Next.js (App Router), Tailwind CSS, and Framer Motion. Designed for **static export** and upload to traditional shared hosting (FTP / cPanel).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment variables**

   Copy `.env.local.example` to `.env.local` and fill in:

   - `NEXT_PUBLIC_WEB3FORMS_KEY` — from [web3forms.com](https://web3forms.com) (for the invitation request form).
   - `NEXT_PUBLIC_MEMBERS_PASSWORD` — password for the `/members` area (optional; leave blank to disable).
   - `NEXT_PUBLIC_SANITY_*` — only if you connect Sanity CMS later.

3. **Run locally**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Build for production (static export)

```bash
npm run build
```

This generates a static site in the **`out`** folder (HTML, CSS, JS). There are no server-side routes; the site is fully static.

## Deploying to shared hosting

1. Run `npm run build`.
2. Upload the **contents** of the `out` folder to your host’s web root (e.g. `public_html` or `www`) via FTP or cPanel File Manager.
3. No Node.js or server config is required; the host serves the static files as-is.

## Project structure

- `app/` — Next.js App Router (pages, layout).
- `components/` — UI and section components (Hero, Navigation, InviteForm, etc.).
- `lib/` — Mock data and Sanity client config.
- `sanity/` — Sanity schema definitions for future CMS use.

## Features

- **Hero, What It Is, Experience, Past Dinners, Upcoming Dinner, How to Join** — all content is driven by `lib/mock-data.ts` (replace with Sanity when ready).
- **Invitation form** — submits via Web3Forms (client-side); configure your notification email in the Web3Forms dashboard.
- **Members area** (`/members`) — client-side password gate; password is set with `NEXT_PUBLIC_MEMBERS_PASSWORD`.

## Adding a hero image

Place an image at `public/images/hero.jpg` to use as the hero background. The site will work without it (gradient fallback).
