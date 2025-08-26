-- Create table for sick days and vacation days
CREATE TABLE public.absence_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sickness', 'vacation')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one entry per user per date
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.absence_days ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own absence days" 
ON public.absence_days 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own absence days" 
ON public.absence_days 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own absence days" 
ON public.absence_days 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own absence days" 
ON public.absence_days 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_absence_days_updated_at
BEFORE UPDATE ON public.absence_days
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();