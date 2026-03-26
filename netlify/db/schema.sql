-- Netlify DB (Neon Postgres): run this once in the Neon SQL console.
-- Netlify UI → Extensions → Neon → open your project → SQL editor → paste and execute.
-- NETLIFY_DATABASE_URL is set automatically by Netlify when the database is linked.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  netlify_identity_id text unique not null,
  name text,
  email text,
  is_host_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  title text,
  month text not null,
  year int not null,
  neighborhood text not null,
  chef_name text not null default 'TBA',
  status text not null default 'upcoming'
    check (status in ('upcoming', 'live', 'full', 'past')),
  is_visible boolean not null default true,
  max_seats int not null default 10,
  menu_line text,
  image_url text,
  image_url_2 text,
  display_date date,
  created_at timestamptz not null default now()
);

-- Marketing copy and hero (single-document JSON). Editable in Neon or via SQL seed.
create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  meal_id uuid not null references public.meals (id) on delete cascade,
  status text not null default 'waitlisted'
    check (status in ('waitlisted', 'invited', 'paid', 'confirmed')),
  created_at timestamptz not null default now(),
  unique (user_id, meal_id)
);

create table if not exists public.host_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists idx_meals_visible_status on public.meals (is_visible, status);
create index if not exists idx_meals_past_menus on public.meals (is_visible, status, display_date desc);
create index if not exists idx_users_netlify on public.users (netlify_identity_id);
create index if not exists idx_attendances_meal on public.attendances (meal_id);
