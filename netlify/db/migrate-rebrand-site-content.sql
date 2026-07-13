-- Rebrand marketing JSON for Supper Collective (run once in Neon SQL editor).
-- Updates contact email, location, and venue copy in site_content.key = 'site'.
-- Safe to re-run: sets the same target values.

UPDATE public.site_content
SET
  value = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          value,
          '{contact,email}',
          '"hello@suppercollective.org"'
        ),
        '{contact,location}',
        '"United States"'
      ),
      '{experience,items,2,label}',
      '"Hosted in a member''s home"'
    ),
    '{contact,instagram}',
    '"https://instagram.com/sdsupperclub"'
  ),
  updated_at = now()
WHERE key = 'site';
