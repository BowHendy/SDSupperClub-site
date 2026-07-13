-- Add Supper Collective admin emails (run once in Neon SQL editor or via npm run db:seed-admins).
INSERT INTO public.admins (email)
VALUES
  ('bowenhendy@gmail.com'),
  ('juliebhendy@gmail.com')
ON CONFLICT (email) DO NOTHING;
