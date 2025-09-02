-- Enable RLS on the time entries formatted view
ALTER TABLE public.v_time_entries_formatted ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own time entries
CREATE POLICY "Users can view their own formatted time entries" 
ON public.v_time_entries_formatted 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Admins can see all formatted time entries  
CREATE POLICY "Admins can view all formatted time entries" 
ON public.v_time_entries_formatted 
FOR SELECT 
USING (is_admin(auth.uid()));