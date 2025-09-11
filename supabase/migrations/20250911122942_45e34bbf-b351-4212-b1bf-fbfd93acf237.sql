-- Secure access to sensitive time tracking view
-- 1) Ensure the view executes with caller permissions (respecting RLS of underlying tables)
-- 2) Revoke direct access so only the RPC function `get_time_entries_formatted` can expose data with proper filtering

-- Be idempotent and safe
DO $$
BEGIN
  -- Enforce security invoker on the view (safe to re-run)
  BEGIN
    EXECUTE 'ALTER VIEW public.v_time_entries_formatted SET (security_invoker = true)';
  EXCEPTION WHEN others THEN
    -- Ignore if already set or if the view does not exist in some environments
    NULL;
  END;
END $$;

-- Lock down direct access to the view for client roles
REVOKE ALL ON TABLE public.v_time_entries_formatted FROM PUBLIC;
REVOKE ALL ON TABLE public.v_time_entries_formatted FROM anon;
REVOKE ALL ON TABLE public.v_time_entries_formatted FROM authenticated;

-- Optional: document intent
COMMENT ON VIEW public.v_time_entries_formatted IS 'Direct SELECT revoked. Use RPC public.get_time_entries_formatted which enforces per-user filtering (or admin access).';