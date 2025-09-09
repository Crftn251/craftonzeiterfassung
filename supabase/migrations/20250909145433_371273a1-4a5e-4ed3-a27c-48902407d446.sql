-- Enable RLS on the v_time_entries_formatted view
ALTER VIEW public.v_time_entries_formatted SET ROW LEVEL SECURITY ENABLE;

-- Create policy to allow users to see only their own time entries or admins to see all
CREATE POLICY "Users can view their own time entries or admins can view all" 
ON public.v_time_entries_formatted 
FOR SELECT 
USING (auth.uid() = user_id OR is_admin(auth.uid()));

-- Create policy to prevent any modifications to the view (it's read-only)
CREATE POLICY "No modifications allowed on view" 
ON public.v_time_entries_formatted 
FOR ALL 
USING (false);