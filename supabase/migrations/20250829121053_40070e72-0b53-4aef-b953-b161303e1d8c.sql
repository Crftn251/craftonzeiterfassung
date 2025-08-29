-- Add missing activities to J&C branch
-- First get the branch and activity IDs
INSERT INTO branch_activities (branch_id, activity_id)
SELECT 
    b.id as branch_id, 
    a.id as activity_id
FROM branches b
CROSS JOIN activities a
WHERE b.name = 'J&C'
AND a.name IN ('Foto Hut OLS', 'Foto SPZ OLS', 'Meeting', 'OLS', 'Order', 'Ordnung', 'Warenpflege')
AND NOT EXISTS (
    SELECT 1 FROM branch_activities ba2 
    WHERE ba2.branch_id = b.id 
    AND ba2.activity_id = a.id
);