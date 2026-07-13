-- Add birth year from invite form (21+ gate on marketing site).
alter table public.invitation_requests add column if not exists birth_year int;
