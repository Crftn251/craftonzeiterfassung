-- Link all BÜRO activities to the branch (idempotent)
INSERT INTO public.branch_activities (branch_id, activity_id)
SELECT 
  b.id as branch_id,
  a.id as activity_id
FROM public.branches b
CROSS JOIN public.activities a
WHERE b.name = 'BÜRO' 
  AND a.name IN ('Order', 'Warenpflege', 'Foto SPZ OLS', 'Foto Hut OLS')
  AND NOT EXISTS (
    SELECT 1 FROM public.branch_activities ba 
    WHERE ba.branch_id = b.id AND ba.activity_id = a.id
  );

-- Add unique index to prevent duplicate branch-activity combinations
CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_activities_unique 
ON public.branch_activities (branch_id, activity_id);