
-- 1) Tabelle: pro Nutzer erlaubte Tätigkeiten
create table if not exists public.profile_activities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, activity_id)
);

-- 2) RLS aktivieren
alter table public.profile_activities enable row level security;

-- 3) Policies
-- Nutzer dürfen ihre eigenen erlaubten Tätigkeiten sehen; Admins sehen alle
create policy "Profile activities: users can select own or admins any"
  on public.profile_activities
  for select
  using ((auth.uid() = profile_id) or public.is_admin(auth.uid()));

-- Nur Admins dürfen schreiben
create policy "Profile activities: only admins can insert"
  on public.profile_activities
  for insert
  with check (public.is_admin(auth.uid()));

create policy "Profile activities: only admins can update"
  on public.profile_activities
  for update
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Profile activities: only admins can delete"
  on public.profile_activities
  for delete
  using (public.is_admin(auth.uid()));

-- 4) updated_at automatisch pflegen
drop trigger if exists set_updated_at_on_profile_activities on public.profile_activities;
create trigger set_updated_at_on_profile_activities
before update on public.profile_activities
for each row execute procedure public.update_updated_at_column();

-- 5) Performance: schnelle Lookups
create index if not exists idx_profile_activities_profile on public.profile_activities (profile_id);
create index if not exists idx_profile_activities_activity on public.profile_activities (activity_id);
