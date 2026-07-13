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

-- Start-fresh replacement (drop old tables first; dependents before parents).
drop table if exists public.disputes;
drop table if exists public.payouts;
drop table if exists public.payments;
drop table if exists public.meal_seat_requests;
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

-- Invitation requests (fed by Netlify Forms -> submission-created; optional legacy Web3Forms webhook).
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
-- Note: "Guest" is the default primary role for new accounts; a member becomes
-- the "member" primary role only after host accept + profile + pay + first attendance.
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),

  netlify_identity_id text unique not null,

  first_name text,
  surname text,
  email text,
  mobile_phone text,

  referred_by text,
  allergies text,
  zip text,

  -- One primary role per person; admin can override.
  primary_role text not null default 'guest'
    check (primary_role in ('guest', 'member', 'host', 'chef')),

  -- True once the core profile fields are filled out.
  profile_complete boolean not null default false,

  -- Attendance history snapshots; app should keep array alignment.
  attended_dates date[] not null default '{}'::date[],
  attended_host_names text[] not null default '{}'::text[],

  -- Unused when using Netlify Identity, but present per your requested schema.
  password text,

  is_approved boolean not null default false,

  created_at timestamptz not null default now()
);

-- Hosts (pending approval until admins approve).
-- Full profile + equipment-for-10 confirmations are collected BEFORE submit;
-- equipment flags must all be true at submission time (enforced in app).
create table if not exists public.hosts (
  id uuid primary key default gen_random_uuid(),

  member_id uuid unique references public.members (id) on delete cascade,

  first_name text,
  surname text,
  email text,
  mobile_phone text,

  address text not null,
  allergies text,

  -- Kitchen + dining proof photos collected during application.
  kitchen_photo_url text,
  dining_photo_url text,

  -- Confirmed-for-10 equipment; all must be true at submit.
  cutlery boolean not null default false,
  glassware boolean not null default false,
  crockery boolean not null default false,

  -- Stripe Connect account for payouts + card-on-file for penalties (Phase 3).
  stripe_connect_id text,
  stripe_customer_id text,

  password text,

  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approval_note text,
  approved_at timestamptz,
  approved_by text references public.admins (email) on delete set null,

  created_at timestamptz not null default now()
);

-- Chefs (apply via /chef/apply with CV + references; admin approves).
create table if not exists public.chefs (
  id uuid primary key default gen_random_uuid(),

  member_id uuid unique references public.members (id) on delete set null,

  first_name text,
  surname text,
  email text,
  mobile_phone text,

  bio text,
  headshot_url text,
  cv_url text,
  references_text text,

  food_genres text[] not null default '{}'::text[],

  -- Stripe Connect account for ingredient + remainder payouts (Phase 3).
  stripe_connect_id text,

  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected')),
  approval_note text,
  approved_at timestamptz,
  approved_by text references public.admins (email) on delete set null,

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

  -- Expanded lifecycle. Meal stays unlisted (not public) until T-30 dual confirm.
  status text not null default 'draft'
    check (status in (
      'draft',              -- host created; chef agreeing price
      'dual_confirm_pending', -- price agreed; awaiting T-30 host+chef confirm
      'live',               -- both confirmed; public + collecting paid seats
      'full',               -- 10 paid seats
      'subsidy_pending',    -- T-14 under fill; awaiting host subsidy or cancel
      'cancel_requested',   -- host requested cancel; awaiting admin
      'cancelled',          -- cancelled + refunds issued
      'dispute',            -- flagged; payouts paused
      'complete',           -- dinner happened
      'past',               -- archived
      'upcoming'            -- legacy
    )),

  is_visible boolean not null default false,
  max_seats int not null default 10,

  menu_line text,
  image_url text,
  image_url_2 text,
  display_date date,

  -- Your requested fields.
  food_genre text,
  drink_pairing text,

  -- Pricing: chef proposes, host agrees before going live.
  meal_price_per_guest numeric(10, 2),
  price_agreed_by_host boolean not null default false,

  -- T-30 dual confirmation timestamps (both required before going live).
  host_confirmed_at timestamptz,
  chef_confirmed_at timestamptz,

  -- Fill-milestone bookkeeping.
  t14_warning_sent boolean not null default false,
  t7_ingredient_paid boolean not null default false,
  subsidy_required boolean not null default false,
  subsidy_paid_amount numeric(10, 2) not null default 0,

  cancelled_at timestamptz,
  cancel_reason text,

  created_at timestamptz not null default now()
);

-- Dinner guests (replaces `attendances`). One row is the host's own seat.
create table if not exists public.dinner_guests (
  id uuid primary key default gen_random_uuid(),

  dinner_id uuid not null references public.dinners (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,

  status text not null default 'waitlisted'
    check (status in (
      'waitlisted',  -- requested seat; awaiting host
      'invited',     -- legacy alias for approved
      'approved',    -- host accepted; profile + payment needed
      'paid',        -- paid; funds in escrow
      'confirmed',   -- seat locked for dinner
      'attended',    -- showed up (promote guest -> member)
      'rejected',    -- host declined
      'cancelled'    -- cancelled or refunded
    )),

  -- The host's own seat counts toward the 10.
  is_host_seat boolean not null default false,

  attended_date date,
  host_name_snapshot text,

  approved_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  refunded_at timestamptz,

  created_at timestamptz not null default now(),
  unique (dinner_id, member_id)
);

-- Payment ledger: incoming guest/host charges held in escrow (Phase 3).
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  dinner_id uuid references public.dinners (id) on delete set null,
  member_id uuid references public.members (id) on delete set null,

  kind text not null
    check (kind in ('guest_seat', 'host_seat', 'host_subsidy', 'attendance_fee')),

  amount numeric(10, 2) not null,

  status text not null default 'held'
    check (status in ('held', 'released', 'refunded', 'partial_refunded', 'failed')),
  refunded_amount numeric(10, 2) not null default 0,

  stripe_payment_intent_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Payout ledger: outgoing payments to chefs (Phase 3).
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),

  dinner_id uuid references public.dinners (id) on delete set null,
  chef_id uuid references public.chefs (id) on delete set null,

  kind text not null
    check (kind in ('chef_ingredient_auto', 'chef_remainder', 'host_subsidy_refund')),

  amount numeric(10, 2) not null,

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'paused', 'reversed')),

  stripe_transfer_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Disputes: host or chef flags a meal; pauses payouts; admin resolves.
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),

  dinner_id uuid not null references public.dinners (id) on delete cascade,
  raised_by_member_id uuid references public.members (id) on delete set null,
  raised_by_role text check (raised_by_role in ('host', 'chef')),

  reason text not null,

  status text not null default 'open'
    check (status in ('open', 'resolved')),
  resolution_note text,
  resolved_at timestamptz,
  resolved_by text references public.admins (email) on delete set null,

  created_at timestamptz not null default now()
);

-- Platform settings (single row): global attendance-fee toggle, etc.
create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  attendance_fee_enabled boolean not null default true,
  attendance_fee_amount numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (true)
  on conflict (id) do nothing;

-- Meal-first signup: public seat request before Identity account exists.
create table if not exists public.meal_seat_requests (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references public.dinners (id) on delete cascade,
  email text not null,
  name text,
  status text not null default 'pending'
    check (status in ('pending', 'linked', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (dinner_id, email)
);

-- Indexes for expected queries.
create index if not exists idx_dinners_visible_status on public.dinners (is_visible, status);
create index if not exists idx_dinners_past_menus on public.dinners (is_visible, status, display_date desc);
create index if not exists idx_dinners_host on public.dinners (host_id);
create index if not exists idx_dinners_chef on public.dinners (chef_id);
create index if not exists idx_members_netlify_identity on public.members (netlify_identity_id);
create index if not exists idx_members_primary_role on public.members (primary_role);
create index if not exists idx_dinner_guests_dinner on public.dinner_guests (dinner_id);
create index if not exists idx_dinner_guests_member on public.dinner_guests (member_id);
create index if not exists idx_dinner_guests_status on public.dinner_guests (status);
create index if not exists idx_hosts_approval on public.hosts (approval_status);
create index if not exists idx_chefs_approval on public.chefs (approval_status);
create index if not exists idx_payments_dinner on public.payments (dinner_id);
create index if not exists idx_payouts_dinner on public.payouts (dinner_id);
create index if not exists idx_disputes_dinner on public.disputes (dinner_id);
create index if not exists idx_disputes_status on public.disputes (status);
