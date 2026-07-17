-- Non-destructive: ZIP + coordinates for nearest-meal public teaser.
alter table public.hosts
  add column if not exists zip text;

alter table public.dinners
  add column if not exists zip text;

alter table public.dinners
  add column if not exists latitude double precision;

alter table public.dinners
  add column if not exists longitude double precision;

create index if not exists idx_dinners_geo
  on public.dinners (latitude, longitude)
  where latitude is not null and longitude is not null;
