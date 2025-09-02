-- Fix Security Definer View issue by removing security filtering from view
-- The security filtering should be handled by the get_time_entries_formatted() function instead

DROP VIEW IF EXISTS public.v_time_entries_formatted;

CREATE VIEW public.v_time_entries_formatted AS
SELECT 
  te.id,
  te.user_id,
  te.branch_id,
  te.activity_id,
  te.started_at,
  te.ended_at,
  te.paused_seconds,
  DATE(te.started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin') as date_local,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - te.paused_seconds
    ELSE 0
  END as net_seconds,
  te.created_at,
  te.updated_at,
  to_char(te.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as started_utc,
  p.email as user_email,
  COALESCE(p.display_name, p.email) as user_display_name,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      to_char(te.ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ELSE NULL
  END as ended_utc,
  b.name as branch_name,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      LPAD((EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - te.paused_seconds) / 3600 || '', 2, '0') || ':' ||
      LPAD(((EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - te.paused_seconds) % 3600) / 60 || '', 2, '0')
    ELSE '00:00'
  END as net_hhmm,
  a.name as activity_name,
  to_char(te.started_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin', 'HH24:MI') as start_local,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      to_char(te.ended_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
    ELSE NULL
  END as end_local,
  CASE 
    WHEN te.ended_at IS NULL THEN 'Läuft'
    ELSE 'Beendet'
  END as status,
  te.notes
FROM public.time_entries te
LEFT JOIN public.profiles p ON te.user_id = p.id
LEFT JOIN public.branches b ON te.branch_id = b.id
LEFT JOIN public.activities a ON te.activity_id = a.id
ORDER BY te.started_at DESC;

-- Enable RLS on the view to prevent direct access
ALTER TABLE public.v_time_entries_formatted ENABLE ROW LEVEL SECURITY;

-- Policy: Block all direct access to the view - force use of the secure function
CREATE POLICY "Block direct access to time entries view" 
ON public.v_time_entries_formatted 
FOR ALL 
USING (false);