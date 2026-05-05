-- Add scheduled start time and late join capabilities to live_quiz_sessions
ALTER TABLE public.live_quiz_sessions
ADD COLUMN IF NOT EXISTS scheduled_start_time timestamp with time zone,
ADD COLUMN IF NOT EXISTS allow_late_join boolean DEFAULT true;
