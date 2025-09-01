-- Fix security vulnerability by recreating the view with security_invoker option
-- This ensures the view respects RLS policies of underlying tables

-- First drop the existing view
DROP VIEW IF EXISTS public.v_time_entries_formatted;

-- Recreate the view with security_invoker to respect RLS on underlying tables
CREATE VIEW public.v_time_entries_formatted 
WITH (security_invoker = true) AS
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
    ELSE 
      EXTRACT(EPOCH FROM (NOW() - te.started_at))::integer - COALESCE(te.paused_seconds, 0)
  END as net_seconds,
  te.created_at,
  te.updated_at,
  p.email as user_email,
  p.display_name as user_display_name,
  to_char(te.ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') as ended_utc,
  b.name as branch_name,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN 
      LPAD((EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - COALESCE(te.paused_seconds, 0)) / 3600 || '', 2, '0') || ':' || 
      LPAD(((EXTRACT(EPOCH FROM (te.ended_at - te.started_at))::integer - COALESCE(te.paused_seconds, 0)) % 3600) / 60 || '', 2, '0')
    ELSE 
      LPAD((EXTRACT(EPOCH FROM (NOW() - te.started_at))::integer - COALESCE(te.paused_seconds, 0)) / 3600 || '', 2, '0') || ':' || 
      LPAD(((EXTRACT(EPOCH FROM (NOW() - te.started_at))::integer - COALESCE(te.paused_seconds, 0)) % 3600) / 60 || '', 2, '0')
  END as net_hhmm,
  a.name as activity_name,
  to_char(te.started_at AT TIME ZONE 'UTC', 'HH24:MI') as start_local,
  CASE 
    WHEN te.ended_at IS NOT NULL THEN to_char(te.ended_at AT TIME ZONE 'UTC', 'HH24:MI')
    ELSE NULL 
  END as end_local,
  CASE 
    WHEN te.ended_at IS NULL THEN 'running'
    ELSE 'completed'
  END as status,
  te.notes,
  to_char(te.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') as started_utc
FROM public.time_entries te
LEFT JOIN public.profiles p ON te.user_id = p.id  
LEFT JOIN public.branches b ON te.branch_id = b.id
LEFT JOIN public.activities a ON te.activity_id = a.id;