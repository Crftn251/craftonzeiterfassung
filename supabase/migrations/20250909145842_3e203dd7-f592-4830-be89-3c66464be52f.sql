-- Fix the security definer view by setting security_invoker = true
-- This ensures the view respects RLS policies of the calling user, not the view creator
ALTER VIEW public.v_time_entries_formatted SET (security_invoker = true);