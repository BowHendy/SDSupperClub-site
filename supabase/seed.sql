-- Optional: seed one visible live meal (run once in SQL Editor).
insert into public.meals (title, month, year, neighborhood, chef_name, status, is_visible, max_seats)
select 'March Dinner', 'March', 2025, 'Mission Hills', 'TBA', 'live', true, 10
where not exists (
  select 1 from public.meals where is_visible = true and status in ('live', 'upcoming', 'full')
);
