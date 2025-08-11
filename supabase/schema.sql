-- Supabase Schema for Crafton Time
-- Enable useful extensions
create extension if not exists pgcrypto with schema extensions;

-- Profiles table (user roles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

create trigger trg_profiles_updated
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Profiles are viewable by the owner or admins"
  on public.profiles for select
  using (auth.uid() = id or exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Branches
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.branches enable row level security;

create policy "Branches are readable by all"
  on public.branches for select
  using (true);

create policy "Only admins can modify branches"
  on public.branches for all
  using (exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists idx_branches_name on public.branches (name);

-- Activities
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;

create policy "Activities are readable by all"
  on public.activities for select
  using (true);

create policy "Only admins can modify activities"
  on public.activities for all
  using (exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create index if not exists idx_activities_name on public.activities (name);

-- Time entries
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  branch_id uuid references public.branches(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  start_time timestamptz not null,
  end_time timestamptz,
  paused_seconds integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_time_entries_updated
before update on public.time_entries
for each row execute function public.set_updated_at();

alter table public.time_entries enable row level security;

create policy "Users can see their own time entries"
  on public.time_entries for select
  using (auth.uid() = user_id);

create policy "Users can insert their own time entries"
  on public.time_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own time entries"
  on public.time_entries for update
  using (auth.uid() = user_id);

create policy "Users can delete their own time entries"
  on public.time_entries for delete
  using (auth.uid() = user_id);

create index if not exists idx_time_entries_user on public.time_entries (user_id, start_time desc);
