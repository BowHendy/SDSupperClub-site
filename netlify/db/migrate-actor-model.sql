-- Actor-model migration for ALREADY-PROVISIONED databases.
-- Run this in the Neon SQL console to upgrade an existing schema WITHOUT
-- dropping data. (schema.sql is the destructive fresh-install file; do not run
-- that on a database you want to keep.)
--
-- Every statement is idempotent: safe to run more than once.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- members: primary role + profile fields
-- ---------------------------------------------------------------------------
alter table public.members add column if not exists primary_role text not null default 'guest';
alter table public.members add column if not exists profile_complete boolean not null default false;
alter table public.members add column if not exists zip text;
alter table public.members drop constraint if exists members_primary_role_check;
alter table public.members add constraint members_primary_role_check
  check (primary_role in ('guest', 'member', 'host', 'chef'));

-- ---------------------------------------------------------------------------
-- hosts: photos, allergies, stripe, approval audit
-- ---------------------------------------------------------------------------
alter table public.hosts add column if not exists allergies text;
alter table public.hosts add column if not exists kitchen_photo_url text;
alter table public.hosts add column if not exists dining_photo_url text;
alter table public.hosts add column if not exists stripe_connect_id text;
alter table public.hosts add column if not exists stripe_customer_id text;
alter table public.hosts add column if not exists approved_at timestamptz;
alter table public.hosts add column if not exists approved_by text;

-- ---------------------------------------------------------------------------
-- chefs: bio/cv/references, stripe, approval
-- ---------------------------------------------------------------------------
alter table public.chefs add column if not exists bio text;
alter table public.chefs add column if not exists headshot_url text;
alter table public.chefs add column if not exists cv_url text;
alter table public.chefs add column if not exists references_text text;
alter table public.chefs add column if not exists stripe_connect_id text;
alter table public.chefs add column if not exists approval_status text not null default 'pending';
alter table public.chefs add column if not exists approval_note text;
alter table public.chefs add column if not exists approved_at timestamptz;
alter table public.chefs add column if not exists approved_by text;
alter table public.chefs drop constraint if exists chefs_approval_status_check;
alter table public.chefs add constraint chefs_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

-- ---------------------------------------------------------------------------
-- dinners: pricing, dual confirm, fill milestones, cancellation
-- ---------------------------------------------------------------------------
alter table public.dinners add column if not exists meal_price_per_guest numeric(10, 2);
alter table public.dinners add column if not exists price_agreed_by_host boolean not null default false;
alter table public.dinners add column if not exists host_confirmed_at timestamptz;
alter table public.dinners add column if not exists chef_confirmed_at timestamptz;
alter table public.dinners add column if not exists t14_warning_sent boolean not null default false;
alter table public.dinners add column if not exists t7_ingredient_paid boolean not null default false;
alter table public.dinners add column if not exists subsidy_required boolean not null default false;
alter table public.dinners add column if not exists subsidy_paid_amount numeric(10, 2) not null default 0;
alter table public.dinners add column if not exists cancelled_at timestamptz;
alter table public.dinners add column if not exists cancel_reason text;
alter table public.dinners drop constraint if exists dinners_status_check;
alter table public.dinners add constraint dinners_status_check
  check (status in (
    'draft', 'dual_confirm_pending', 'live', 'full', 'subsidy_pending',
    'cancel_requested', 'cancelled', 'dispute', 'complete', 'past', 'upcoming'
  ));

-- ---------------------------------------------------------------------------
-- dinner_guests: host seat + lifecycle timestamps + expanded status
-- ---------------------------------------------------------------------------
alter table public.dinner_guests add column if not exists is_host_seat boolean not null default false;
alter table public.dinner_guests add column if not exists approved_at timestamptz;
alter table public.dinner_guests add column if not exists paid_at timestamptz;
alter table public.dinner_guests add column if not exists cancelled_at timestamptz;
alter table public.dinner_guests add column if not exists refunded_at timestamptz;
alter table public.dinner_guests drop constraint if exists dinner_guests_status_check;
alter table public.dinner_guests add constraint dinner_guests_status_check
  check (status in (
    'waitlisted', 'invited', 'approved', 'paid', 'confirmed',
    'attended', 'rejected', 'cancelled'
  ));

-- ---------------------------------------------------------------------------
-- New tables (idempotent): payments, payouts, disputes, platform_settings
-- ---------------------------------------------------------------------------
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

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  attendance_fee_enabled boolean not null default true,
  attendance_fee_amount numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (id) values (true)
  on conflict (id) do nothing;

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

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_dinners_host on public.dinners (host_id);
create index if not exists idx_dinners_chef on public.dinners (chef_id);
create index if not exists idx_members_primary_role on public.members (primary_role);
create index if not exists idx_hosts_approval on public.hosts (approval_status);
create index if not exists idx_chefs_approval on public.chefs (approval_status);
create index if not exists idx_payments_dinner on public.payments (dinner_id);
create index if not exists idx_payouts_dinner on public.payouts (dinner_id);
create index if not exists idx_disputes_dinner on public.disputes (dinner_id);
create index if not exists idx_disputes_status on public.disputes (status);

-- ---------------------------------------------------------------------------
-- Backfill: existing approved hosts/members keep sensible primary roles.
-- (Optional; comment out if you prefer to set roles manually.)
-- ---------------------------------------------------------------------------
update public.members m
set primary_role = 'host'
from public.hosts h
where h.member_id = m.id
  and h.approval_status = 'approved'
  and m.primary_role = 'guest';
