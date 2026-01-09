-- Add school_name to courses and school to profiles

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS school_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school text;

-- Create an index on school_name for faster filtering
CREATE INDEX IF NOT EXISTS idx_courses_school_name ON public.courses(school_name);
