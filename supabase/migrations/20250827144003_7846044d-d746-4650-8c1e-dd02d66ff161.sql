
-- 1) Büro-Branch ggf. anlegen (case-insensitive prüfen)
insert into public.branches (name)
select 'Büro'
where not exists (
  select 1 from public.branches b where lower(b.name) = lower('Büro')
);

-- 2) Büro-Activities (case-insensitive prüfen und nur fehlende anlegen)
with target_activities(name) as (
  values ('Meeting'), ('OLS'), ('Order'), ('Foto Hut OLS'), ('Foto SPZ OLS')
)
insert into public.activities (name)
select t.name
from target_activities t
where not exists (
  select 1 from public.activities a where lower(a.name) = lower(t.name)
);

-- 3) Alle Zuordnungen dieser fünf Activities aus NICHT-Büro-Branches löschen
delete from public.branch_activities ba
using public.activities a, public.branches b
where ba.activity_id = a.id
  and ba.branch_id = b.id
  and lower(a.name) in (
    'meeting', 'ols', 'order', 'foto hut ols', 'foto spz ols'
  )
  and lower(b.name) <> lower('Büro');

-- 4) In Büro alle anderen (nicht gewünschte) Activities entfernen
delete from public.branch_activities ba
using public.branches b
where ba.branch_id = b.id
  and lower(b.name) = lower('Büro')
  and exists (
    select 1
    from public.activities ax
    where ax.id = ba.activity_id
      and not (lower(ax.name) in ('meeting','ols','order','foto hut ols','foto spz ols'))
  );

-- 5) Fehlende Zuordnungen der fünf Activities für Büro ergänzen
insert into public.branch_activities (branch_id, activity_id)
select b.id, a.id
from public.branches b
cross join public.activities a
where lower(b.name) = lower('Büro')
  and lower(a.name) in ('meeting','ols','order','foto hut ols','foto spz ols')
  and not exists (
    select 1 from public.branch_activities ba
    where ba.branch_id = b.id and ba.activity_id = a.id
  );
