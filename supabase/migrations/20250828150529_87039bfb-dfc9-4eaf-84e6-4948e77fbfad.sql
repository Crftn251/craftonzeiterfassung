
-- Formattierte Sicht über alle Zeiteinträge
-- - Beachtet RLS via security_invoker
-- - Formatiert Datum/Zeiten in Europe/Berlin
-- - Nettozeit = (ended_at oder now) - started_at - paused_seconds
-- - Enthält hilfreiche Bezeichner (Branch-/Activity-/User-Namen)

create or replace view public.v_time_entries_formatted
with (security_invoker = on) as
select
  te.id,
  te.user_id,
  p.email as user_email,
  coalesce(p.display_name, p.email) as user_display_name,
  te.branch_id,
  b.name as branch_name,
  te.activity_id,
  a.name as activity_name,
  te.started_at,
  te.ended_at,
  te.paused_seconds,
  te.notes,

  -- UTC-Strings (ISO-ähnlich)
  to_char(te.started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as started_utc,
  case
    when te.ended_at is not null
      then to_char(te.ended_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    else null
  end as ended_utc,

  -- Lokale Darstellung Europe/Berlin
  (te.started_at at time zone 'Europe/Berlin')::date as date_local,
  to_char(te.started_at at time zone 'Europe/Berlin', 'HH24:MI') as start_local,
  case
    when te.ended_at is not null
      then to_char(te.ended_at at time zone 'Europe/Berlin', 'HH24:MI')
    else null
  end as end_local,

  -- Status und Netto-Dauer
  case when te.ended_at is null then 'running' else 'ended' end as status,
  greatest(
    0,
    extract(epoch from (coalesce(te.ended_at, now()) - te.started_at))::int - te.paused_seconds
  ) as net_seconds,
  lpad((greatest(0, extract(epoch from (coalesce(te.ended_at, now()) - te.started_at))::int - te.paused_seconds) / 3600)::text, 2, '0')
    || ':' ||
  lpad(((greatest(0, extract(epoch from (coalesce(te.ended_at, now()) - te.started_at))::int - te.paused_seconds) % 3600) / 60)::text, 2, '0')
    as net_hhmm,

  te.created_at,
  te.updated_at
from public.time_entries te
left join public.profiles p on p.id = te.user_id
left join public.branches b on b.id = te.branch_id
left join public.activities a on a.id = te.activity_id
;

-- Berechtigungen für den Zugriff aus dem Client
grant select on public.v_time_entries_formatted to authenticated;
