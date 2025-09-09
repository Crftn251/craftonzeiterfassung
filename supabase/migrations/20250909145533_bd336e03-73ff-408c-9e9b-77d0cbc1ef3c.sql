-- Since views can't have RLS policies, we'll update the view definition 
-- to include security filtering directly
CREATE OR REPLACE VIEW public.v_time_entries_formatted AS
SELECT 
  te.id,
  te.user_id,
  te.branch_id,
  te.activity_id,
  te.started_at,
  te.ended_at,
  te.paused_seconds,
  te.started_at::date as date_local,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - COALESCE(te.paused_seconds, 0)
    ELSE 0
  END as net_seconds,
  te.created_at,
  te.updated_at,
  p.display_name as user_display_name,
  p.email as user_email,
  b.name as branch_name,
  a.name as activity_name,
  to_char(te.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') as started_utc,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      to_char(te.ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')
    ELSE NULL
  END as ended_utc,
  to_char(te.started_at, 'HH24:MI') as start_local,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      to_char(te.ended_at, 'HH24:MI')
    ELSE NULL
  END as end_local,
  CASE 
    WHEN te.ended_at IS NULL THEN 'Running'
    ELSE 'Completed'
  END as status,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN
      LPAD((EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - COALESCE(te.paused_seconds, 0)) / 3600, 2, '0') || ':' ||
      LPAD(((EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - COALESCE(te.paused_seconds, 0)) % 3600) / 60, 2, '0')
    ELSE '00:00'
  END as net_hhmm,
  te.notes
FROM public.time_entries te
LEFT JOIN public.profiles p ON te.user_id = p.id
LEFT JOIN public.branches b ON te.branch_id = b.id  
LEFT JOIN public.activities a ON te.activity_id = a.id
-- CRITICAL SECURITY FILTER: Only show entries for current user or if user is admin
WHERE te.user_id = auth.uid() OR public.is_admin(auth.uid())
ORDER BY te.started_at DESC;