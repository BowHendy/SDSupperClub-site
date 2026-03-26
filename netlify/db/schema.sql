-- Netlify DB (Neon Postgres): run this once in the Neon SQL console.
-- Netlify UI → Extensions → Neon → open your project → SQL editor → paste and execute.
-- NETLIFY_DATABASE_URL is set automatically by Netlify when the database is linked.

create extension if not exists "pgcrypto";

-- Keep marketing content stable across schema rewrites.
create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Start-fresh replacement (drop old tables first).
drop table if exists public.dinner_guests;
drop table if exists public.dinners;
drop table if exists public.chefs;
drop table if exists public.hosts;
drop table if exists public.members;
drop table if exists public.invitation_requests;
drop table if exists public.admins;

drop table if exists public.attendances;
drop table if exists public.host_requests;
drop table if exists public.meals;
drop table if exists public.users;

-- Admins (must exist before tables that reference it).
create table if not exists public.admins (
  email text primary key,
  password text,
  netlify_identity_id text,
  created_at timestamptz not null default now()
);

-- Invitation requests (fed by a Web3Forms webhook).
create table if not exists public.invitation_requests (
  id uuid primary key default gen_random_uuid(),

  name text,
  email text not null,
  referred_by text,
  why_you_love_to_come text not null,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),

  -- Optional audit context from the webhook submit.
  web3forms_access_key text,
  form_key text,
  source text,

  approved_at timestamptz,
  approved_by text references public.admins (email) on delete set null,

  created_at timestamptz not null default now()
);

-- Members (Netlify Identity + approval gating).
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),

  netlify_identity_id text unique not null,

  first_name text,
  surname text,
  email text,
  mobile_phone text,

  referred_by text,
  allergies text,

  -- Attendance history snapshots; app should keep array alignment.
  attended_dates date[] not null default '{}'::date[],
  attended_host_names text[] not null default '{}'::text[],

  -- Unused when using Netlify Identity, but present per your requested schema.
  password text,

  is_approved boolean not null default false,

  created_at timestamptz not null default now()
);

-- Hosts (pending approval until admins approve).
create table if not exists public.hosts (
  id uuid primary key default gen_random_uuid(),

  member_id uuid unique references public.members (id) on delete cascade,

  first_name text,
  surname text,
  email text,
  mobile_phone text,

  address text not null,

  cutlery boolean not null default false,
  glassware boolean not null default false,
  crockery boolean not null default false,

  password text,

  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approval_note text,

  created_at timestamptz not null default now()
);

-- Chefs.
create table if not exists public.chefs (
  id uuid primary key default gen_random_uuid(),

  member_id uuid unique references public.members (id) on delete set null,

  first_name text,
  surname text,
  email text,
  mobile_phone text,

  food_genres text[] not null default '{}'::text[],

  password text,

  created_at timestamptz not null default now()
);

-- Dinners (replaces `meals` for the booking/status flow).
create table if not exists public.dinners (
  id uuid primary key default gen_random_uuid(),

  chef_id uuid references public.chefs (id) on delete set null,
  host_id uuid references public.hosts (id) on delete set null,

  -- Snapshot fields at dinner creation time.
  address text,
  host_name text,
  host_contact text,

  -- Chef + dinner details (kept compatible with existing UI fields).
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

  -- Your requested fields.
  food_genre text,
  drink_pairing text,

  created_at timestamptz not null default now()
);

-- Dinner guests (replaces `attendances`).
create table if not exists public.dinner_guests (
  id uuid primary key default gen_random_uuid(),

  dinner_id uuid not null references public.dinners (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,

  status text not null default 'waitlisted'
    check (status in ('waitlisted', 'invited', 'paid', 'confirmed')),

  attended_date date,
  host_name_snapshot text,

  created_at timestamptz not null default now(),
  unique (dinner_id, member_id)
);

-- Indexes for expected queries.
create index if not exists idx_dinners_visible_status on public.dinners (is_visible, status);
create index if not exists idx_dinners_past_menus on public.dinners (is_visible, status, display_date desc);
create index if not exists idx_members_netlify_identity on public.members (netlify_identity_id);
create index if not exists idx_dinner_guests_dinner on public.dinner_guests (dinner_id);
create index if not exists idx_dinner_guests_member on public.dinner_guests (member_id);
create index if not exists idx_dinner_guests_status on public.dinner_guests (status);
