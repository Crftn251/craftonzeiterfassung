/*
  SEO: Title, description, single H1 usage is handled in pages. This file contains a minimal docs snippet.

  How to provision Supabase (run in SQL editor):
  1) Paste supabase/schema.sql, run all.
  2) Optionally paste supabase/seed.sql, run all.
  3) Ensure you have a profile row with your auth uid if you need admin:
     insert into public.profiles (id, role) values ('<your-auth-user-id>', 'admin')
     on conflict (id) do update set role = excluded.role;
*/
