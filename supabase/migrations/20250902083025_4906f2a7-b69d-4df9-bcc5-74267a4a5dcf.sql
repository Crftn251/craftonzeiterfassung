-- Enable RLS on the v_time_entries_formatted view
ALTER VIEW public.v_time_entries_formatted SET (security_invoker = on);

-- Add RLS policies to v_time_entries_formatted view
CREATE POLICY "Users can view their own time entries or admins can view all"
ON public.v_time_entries_formatted
FOR SELECT
USING (auth.uid() = user_id OR is_admin(auth.uid()));