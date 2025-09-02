-- Create a security definer function to get filtered time entries
CREATE OR REPLACE FUNCTION public.get_time_entries_formatted()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  branch_id uuid,
  activity_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  paused_seconds integer,
  date_local date,
  net_seconds integer,
  created_at timestamptz,
  updated_at timestamptz,
  started_utc text,
  user_email text,
  user_display_name text,
  ended_utc text,
  branch_name text,
  net_hhmm text,
  activity_name text,
  start_local text,
  end_local text,
  status text,
  notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    v.id,
    v.user_id,
    v.branch_id,
    v.activity_id,
    v.started_at,
    v.ended_at,
    v.paused_seconds,
    v.date_local,
    v.net_seconds,
    v.created_at,
    v.updated_at,
    v.started_utc,
    v.user_email,
    v.user_display_name,
    v.ended_utc,
    v.branch_name,
    v.net_hhmm,
    v.activity_name,
    v.start_local,
    v.end_local,
    v.status,
    v.notes
  FROM public.v_time_entries_formatted v
  WHERE 
    v.user_id = auth.uid() 
    OR is_admin(auth.uid());
$$;