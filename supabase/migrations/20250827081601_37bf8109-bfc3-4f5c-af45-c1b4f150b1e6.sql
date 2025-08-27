-- Update branch names to the correct values
-- First, delete any existing branches to avoid conflicts
DELETE FROM public.branches;

-- Insert the correct branch names
INSERT INTO public.branches (name) VALUES 
('SPZ'),
('SPW'), 
('SPR'),
('J&C'),
('BÜRO'),
('TAL');