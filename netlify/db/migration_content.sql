-- Run once on existing Neon databases that already had the older `meals` definition
-- (create table if not exists does not add new columns). Safe to re-run.
-- After the schema rewrite, these columns live on `public.dinners` instead.

alter table public.dinners add column if not exists menu_line text;
alter table public.dinners add column if not exists image_url text;
alter table public.dinners add column if not exists image_url_2 text;
alter table public.dinners add column if not exists display_date date;

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_dinners_past_menus on public.dinners (is_visible, status, display_date desc);
