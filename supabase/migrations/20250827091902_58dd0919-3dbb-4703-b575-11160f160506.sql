
-- Ensure the activities exist (create only if missing)
with ensure_activities as (
  insert into public.activities (name)
  select v.name
  from (values ('Ware'), ('Verkauf'), ('Social Media')) as v(name)
  where not exists (
    select 1 from public.activities a where a.name = v.name
  )
  returning id, name
),
-- Ensure the J&C branch exists (create only if missing)
ensure_branch as (
  insert into public.branches (name)
  select 'J&C'
  where not exists (
    select 1 from public.branches b where b.name = 'J&C'
  )
  returning id
),
-- Get branch id for J&C (whether newly created or pre-existing)
target_branch as (
  select id from public.branches where name = 'J&C' limit 1
),
-- Gather the activity ids for the three activities
target_activities as (
  select id, name from public.activities where name in ('Ware','Verkauf','Social Media')
),
-- Insert mappings for J&C -> activities (skip if already mapped)
insert_mappings as (
  insert into public.branch_activities (branch_id, activity_id)
  select tb.id, ta.id
  from target_branch tb
  join target_activities ta on true
  where not exists (
    select 1
    from public.branch_activities ba
    where ba.branch_id = tb.id
      and ba.activity_id = ta.id
  )
  returning id
)
select
  (select count(*) from ensure_activities) as activities_created,
  (select count(*) from insert_mappings)  as mappings_inserted;
