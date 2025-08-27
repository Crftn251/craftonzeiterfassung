
-- 1) Tabelle für Filiale-Activity-Zuordnungen
create table if not exists public.branch_activities (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (branch_id, activity_id)
);

alter table public.branch_activities enable row level security;

-- RLS-Policies im Stil der bestehenden Tabellen
create policy "Branch activities: anyone authenticated can read"
  on public.branch_activities
  for select
  using (true);

create policy "Branch activities: only admins can insert"
  on public.branch_activities
  for insert
  with check (is_admin(auth.uid()));

create policy "Branch activities: only admins can update"
  on public.branch_activities
  for update
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

create policy "Branch activities: only admins can delete"
  on public.branch_activities
  for delete
  using (is_admin(auth.uid()));

-- 2) Activities für "BÜRO" ergänzen (nur falls noch nicht vorhanden)
with desired as (
  select unnest(array[
    'Meeting',
    'Order',
    'Warenpflege',
    'Foto SPZ OLS',
    'Foto Hut OLS'
  ]::text[]) as name
),
ins as (
  insert into public.activities (name)
  select d.name
  from desired d
  where not exists (select 1 from public.activities a where a.name = d.name)
  returning id, name
),
all_acts as (
  select id, name from public.activities where name in (select name from desired)
),
buero as (
  select id from public.branches where name = 'BÜRO' limit 1
)
insert into public.branch_activities (branch_id, activity_id)
select b.id, a.id
from buero b
cross join all_acts a
on conflict (branch_id, activity_id) do nothing;
