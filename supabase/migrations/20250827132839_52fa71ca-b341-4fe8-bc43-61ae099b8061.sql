
begin;

-- 1) Sicherstellen, dass die Branch/Aktivitäten existieren (nur falls nicht vorhanden)
insert into public.branches (name)
select 'BÜRO'
where not exists (select 1 from public.branches where name = 'BÜRO');

insert into public.activities (name)
select 'Meeting'
where not exists (select 1 from public.activities where name = 'Meeting');

insert into public.activities (name)
select 'OLS'
where not exists (select 1 from public.activities where name = 'OLS');

insert into public.activities (name)
select 'Order'
where not exists (select 1 from public.activities where name = 'Order');

insert into public.activities (name)
select 'Foto Hut OLS'
where not exists (select 1 from public.activities where name = 'Foto Hut OLS');

insert into public.activities (name)
select 'Foto SPZ OLS'
where not exists (select 1 from public.activities where name = 'Foto SPZ OLS');

-- 2) Alle bisherigen Zuordnungen für BÜRO löschen
delete from public.branch_activities ba
using public.branches b
where ba.branch_id = b.id
  and b.name = 'BÜRO';

-- 3) Exakte Zuordnung für BÜRO anlegen
insert into public.branch_activities (branch_id, activity_id)
select b.id, a.id
from public.branches b, public.activities a
where b.name = 'BÜRO' and a.name = 'Meeting';

insert into public.branch_activities (branch_id, activity_id)
select b.id, a.id
from public.branches b, public.activities a
where b.name = 'BÜRO' and a.name = 'OLS';

insert into public.branch_activities (branch_id, activity_id)
select b.id, a.id
from public.branches b, public.activities a
where b.name = 'BÜRO' and a.name = 'Order';

insert into public.branch_activities (branch_id, activity_id)
select b.id, a.id
from public.branches b, public.activities a
where b.name = 'BÜRO' and a.name = 'Foto Hut OLS';

insert into public.branch_activities (branch_id, activity_id)
select b.id, a.id
from public.branches b, public.activities a
where b.name = 'BÜRO' and a.name = 'Foto SPZ OLS';

commit;
