-- Fix security vulnerability: Add RLS policies to v_time_entries_formatted view
-- This view currently exposes all employee time tracking data to any authenticated user

-- Enable RLS on the view
ALTER VIEW public.v_time_entries_formatted SET (security_invoker = on);

-- Create RLS policies for the view
CREATE POLICY "Time entries formatted: users can read their own entries"
  ON public.v_time_entries_formatted
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Time entries formatted: admins can read all entries" 
  ON public.v_time_entries_formatted
  FOR SELECT
  USING (is_admin(auth.uid()));