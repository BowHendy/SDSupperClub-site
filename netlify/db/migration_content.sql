-- Run once on existing Neon databases that already had the older `meals` definition
-- (create table if not exists does not add new columns). Safe to re-run.

alter table public.meals add column if not exists menu_line text;
alter table public.meals add column if not exists image_url text;
alter table public.meals add column if not exists image_url_2 text;
alter table public.meals add column if not exists display_date date;

create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_meals_past_menus on public.meals (is_visible, status, display_date desc);
