-- Enable required extension (gen_random_uuid)
create extension if not exists pgcrypto;

-- Generic updated_at trigger function
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper: check if a user is admin (security definer to avoid RLS recursion)
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Profiles policies
create policy "Profiles: users can select their own or admins can select all"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "Profiles: users can insert their own row"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Profiles: users can update their own or admins any"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin(auth.uid()))
  with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy "Profiles: only admins can delete"
  on public.profiles
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

-- Trigger to auto-update updated_at on profiles
create or replace trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Auto-insert profile for new auth users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Create trigger on auth.users to populate profiles
-- Note: if it exists, drop first to avoid duplicates
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Branches table
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.branches enable row level security;

create policy "Branches: anyone authenticated can read"
  on public.branches
  for select
  to authenticated
  using (true);

create policy "Branches: only admins can insert"
  on public.branches
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Branches: only admins can update"
  on public.branches
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Branches: only admins can delete"
  on public.branches
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

create or replace trigger trg_branches_updated_at
before update on public.branches
for each row execute function public.update_updated_at_column();

-- Activities table
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activities enable row level security;

create policy "Activities: anyone authenticated can read"
  on public.activities
  for select
  to authenticated
  using (true);

create policy "Activities: only admins can insert"
  on public.activities
  for insert
  to authenticated
  with check (public.is_admin(auth.uid()));

create policy "Activities: only admins can update"
  on public.activities
  for update
  to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

create policy "Activities: only admins can delete"
  on public.activities
  for delete
  to authenticated
  using (public.is_admin(auth.uid()));

create or replace trigger trg_activities_updated_at
before update on public.activities
for each row execute function public.update_updated_at_column();

-- Time entries table
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  paused_seconds integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_time_entries_user_started on public.time_entries (user_id, started_at);

alter table public.time_entries enable row level security;

create policy "Time entries: users can read their own"
  on public.time_entries
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Time entries: users can insert their own"
  on public.time_entries
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Time entries: users can update their own"
  on public.time_entries
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Time entries: users can delete their own"
  on public.time_entries
  for delete
  to authenticated
  using (auth.uid() = user_id);

create or replace trigger trg_time_entries_updated_at
before update on public.time_entries
for each row execute function public.update_updated_at_column();

-- Validation: ended_at must be >= started_at when provided
create or replace function public.validate_time_entry()
returns trigger
language plpgsql
as $$
begin
  if new.ended_at is not null and new.ended_at < new.started_at then
    raise exception 'ended_at must be after started_at';
  end if;
  if new.paused_seconds < 0 then
    raise exception 'paused_seconds cannot be negative';
  end if;
  return new;
end;
$$;

-- Attach validation triggers
create or replace trigger trg_time_entries_validate_ins
before insert on public.time_entries
for each row execute function public.validate_time_entry();

create or replace trigger trg_time_entries_validate_upd
before update on public.time_entries
for each row execute function public.validate_time_entry();

-- Seed data (idempotent)
insert into public.branches (name) values
  ('Bau'),
  ('Elektro'),
  ('IT'),
  ('Maler'),
  ('Installateur')
on conflict (name) do nothing;

insert into public.activities (name) values
  ('Planung'),
  ('Montage'),
  ('Wartung'),
  ('Support'),
  ('Dokumentation')
on conflict (name) do nothing;