-- Remove BÜRO-specific activities from all other branches
DELETE FROM public.branch_activities 
WHERE activity_id IN (
  SELECT id FROM public.activities 
  WHERE name IN ('Meeting', 'Order', 'Warenpflege', 'Foto SPZ OLS', 'Foto Hut OLS')
)
AND branch_id IN (
  SELECT id FROM public.branches 
  WHERE name != 'BÜRO'
);