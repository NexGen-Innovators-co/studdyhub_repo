-- Migration: Create user_daily_activity tracking table + log_user_activity RPC
-- Date: 2026-03-18

-- Create user_daily_activity table for tracking activity per day
CREATE TABLE IF NOT EXISTS public.user_daily_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type VARCHAR(50) NOT NULL,
  action_count INT DEFAULT 1,
  xp_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, activity_date, activity_type)
);

-- Enable RLS so only the user (or trusted functions) can see their activity
ALTER TABLE IF EXISTS public.user_daily_activity ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_daily_activity'
      AND policyname = 'user_daily_activity_select_own'
  ) THEN
    CREATE POLICY user_daily_activity_select_own
      ON public.user_daily_activity
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_daily_activity'
      AND policyname = 'user_daily_activity_insert_own'
  ) THEN
    CREATE POLICY user_daily_activity_insert_own
      ON public.user_daily_activity
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_daily_activity'
      AND policyname = 'user_daily_activity_update_own'
  ) THEN
    CREATE POLICY user_daily_activity_update_own
      ON public.user_daily_activity
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- Create the log_user_activity RPC used by the client
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_user_id UUID,
  p_activity_type VARCHAR,
  p_xp_earned INT DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.user_daily_activity (user_id, activity_date, activity_type, xp_earned, action_count)
  VALUES (p_user_id, CURRENT_DATE, p_activity_type, p_xp_earned, 1)
  ON CONFLICT (user_id, activity_date, activity_type)
  DO UPDATE SET
    action_count = public.user_daily_activity.action_count + 1,
    xp_earned = public.user_daily_activity.xp_earned + EXCLUDED.xp_earned,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.log_user_activity(UUID, VARCHAR, INT) TO authenticated;
