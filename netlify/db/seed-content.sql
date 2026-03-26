-- Idempotent seed: past menus + site JSON (matches former lib/mock-data defaults).
-- Run in Neon after schema.sql / migration_content.sql.

insert into public.meals (
  id,
  month,
  year,
  neighborhood,
  chef_name,
  status,
  is_visible,
  menu_line,
  display_date
) values
  (
    'a0000001-0001-4000-8000-000000000001'::uuid,
    'February',
    2025,
    'North Park',
    'Chef Luisa Reyes',
    'past',
    true,
    'Wood-fired lamb, citrus, smoke.',
    '2025-02-01'
  ),
  (
    'a0000002-0001-4000-8000-000000000002'::uuid,
    'January',
    2025,
    'Ocean Beach',
    'Chef Marcus Webb',
    'past',
    true,
    'Spot prawns, fermented greens, sea lettuce.',
    '2025-01-01'
  ),
  (
    'a0000003-0001-4000-8000-000000000003'::uuid,
    'December',
    2024,
    'South Park',
    'Chef Yuki Tanaka',
    'past',
    true,
    'Duck two ways, persimmon, black garlic.',
    '2024-12-01'
  ),
  (
    'a0000004-0001-4000-8000-000000000004'::uuid,
    'October',
    2024,
    'Bankers Hill',
    'Chef Ana Rivera',
    'past',
    true,
    'Squash blossoms, goat cheese, honey.',
    '2024-10-01'
  )
on conflict (id) do update set
  month = excluded.month,
  year = excluded.year,
  neighborhood = excluded.neighborhood,
  chef_name = excluded.chef_name,
  status = excluded.status,
  is_visible = excluded.is_visible,
  menu_line = excluded.menu_line,
  display_date = excluded.display_date;

insert into public.site_content (key, value)
values (
  'site',
  $json${
    "hero": {
      "headline": "Ten seats. One chef. Someone's home. Once a month.",
      "cta": "Request an Invitation"
    },
    "experience": {
      "title": "Good food. Good people. One night a month.",
      "lead": "Every month a different member hosts — they pick the chef, they pick the drinks, they set the table. It's never the same twice, and that's exactly the point.",
      "items": [
        { "label": "One dinner per month", "key": "frequency" },
        { "label": "10 guests, invite-only", "key": "guests" },
        { "label": "Hosted in a member's San Diego home", "key": "venue" },
        { "label": "Chef-curated seasonal menu", "key": "menu" }
      ],
      "bridge": "Every month. Different host, different home, different food.",
      "paragraphs": [
        "Whoever's hosting picks what gets cooked and what gets poured. No venues, no menus emailed in advance. Just a real table, people worth meeting, and a meal someone genuinely cared about making.",
        "You leave having eaten well. You also leave with new people in your phone."
      ]
    },
    "membership": {
      "title": "How to Join",
      "intro": "You join by being invited by a current member. Guests can invite one new person per dinner. If you'd like to be considered, tell us a bit about yourself below.",
      "formTitle": "Request an Invitation"
    },
    "contact": {
      "instagram": "https://instagram.com/sdsupperclub",
      "email": "hello@sdsupperclub.com",
      "location": "San Diego, CA"
    },
    "upcomingFallback": {
      "month": "March",
      "year": 2025,
      "neighborhood": "Mission Hills",
      "chefName": "TBA",
      "cta": "Confirm Your Seat"
    }
  }$json$::jsonb
)
on conflict (key) do update set
  value = excluded.value,
  updated_at = now();
