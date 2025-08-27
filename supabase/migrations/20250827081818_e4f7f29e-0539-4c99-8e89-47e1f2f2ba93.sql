-- Update activity names to the correct values
-- First, delete any existing activities to avoid conflicts
DELETE FROM public.activities;

-- Insert the correct activity names
INSERT INTO public.activities (name) VALUES 
('Ordnung'),
('Verkauf'), 
('OLS'),
('Social Media'),
('Meeting'),
('Ware');