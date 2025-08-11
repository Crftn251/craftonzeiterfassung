-- Optional seed data for branches and activities
-- Run this in the Supabase SQL editor after creating the schema.

insert into public.branches (name)
values
  ('Bau'),
  ('Elektro'),
  ('IT'),
  ('Maler'),
  ('Installateur')
on conflict (name) do nothing;

insert into public.activities (name)
values
  ('Planung'),
  ('Montage'),
  ('Wartung'),
  ('Support'),
  ('Dokumentation')
on conflict (name) do nothing;
