-- Critical Security Fix: Prevent privilege escalation on profiles table

-- 1. Create function to validate profile updates safely (avoiding RLS recursion)
CREATE OR REPLACE FUNCTION public.can_update_profile(
  target_user_id uuid, 
  new_role text, 
  new_weekly_goal integer
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_weekly_goal integer;
BEGIN
  -- Admins can update anything
  IF public.is_admin(auth.uid()) THEN
    RETURN true;
  END IF;
  
  -- Non-admins can only update their own profile
  IF auth.uid() != target_user_id THEN
    RETURN false;
  END IF;
  
  -- Non-admins cannot change role from 'user'
  IF new_role != 'user' THEN
    RETURN false;
  END IF;
  
  -- Non-admins cannot change weekly_goal_hours (get current value to compare)
  SELECT weekly_goal_hours INTO current_weekly_goal 
  FROM public.profiles 
  WHERE id = target_user_id;
  
  IF new_weekly_goal IS DISTINCT FROM current_weekly_goal THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- 2. Create BEFORE triggers to enforce the guard function
CREATE TRIGGER profiles_guard_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_ins_upd();

CREATE TRIGGER profiles_guard_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_ins_upd();

-- 3. Drop existing RLS policies on profiles
DROP POLICY IF EXISTS "Profiles: users can insert their own row" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: users can update their own or admins any" ON public.profiles;

-- 4. Create hardened RLS policies
CREATE POLICY "Profiles: users can insert their own with role user, admins can insert any"
ON public.profiles
FOR INSERT
WITH CHECK (
  (auth.uid() = id AND role = 'user') OR 
  public.is_admin(auth.uid())
);

CREATE POLICY "Profiles: restricted updates based on role"
ON public.profiles
FOR UPDATE
USING ((auth.uid() = id) OR public.is_admin(auth.uid()))
WITH CHECK (public.can_update_profile(id, role, weekly_goal_hours));

-- 5. Optional: Allow admins to read all time entries for reporting (keeping user access)
CREATE POLICY "Time entries: admins can read all"
ON public.time_entries
FOR SELECT
USING (public.is_admin(auth.uid()));

COMMENT ON FUNCTION public.can_update_profile IS 'Security function to prevent privilege escalation on profiles table';