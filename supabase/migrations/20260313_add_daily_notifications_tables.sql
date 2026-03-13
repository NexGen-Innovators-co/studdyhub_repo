-- Migration: Add user activity tracking and daily notification logging
-- Date: 2026-03-13
-- Purpose: Support daily engagement notification system ("toothbrush test")

-- ============================================================================
-- 1. Create user_activity_tracking table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_activity_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Last activity timestamps
  last_active TIMESTAMPTZ DEFAULT now(),
  last_chat_at TIMESTAMPTZ,
  last_note_at TIMESTAMPTZ,
  last_quiz_at TIMESTAMPTZ,
  last_post_at TIMESTAMPTZ,
  last_group_interaction_at TIMESTAMPTZ,
  last_podcast_play_at TIMESTAMPTZ,

  -- Activity counts (denormalized for quick access)
  chat_sessions_count INT DEFAULT 0,
  notes_count INT DEFAULT 0,
  documents_count INT DEFAULT 0,
  quiz_attempts_count INT DEFAULT 0,
  quiz_streak INT DEFAULT 0,
  posts_count INT DEFAULT 0,
  group_interactions_count INT DEFAULT 0,

  -- Engagement tier
  engagement_tier VARCHAR(20) DEFAULT 'cold',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_engagement_tier
  ON public.user_activity_tracking(engagement_tier, last_active DESC);
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_user_id
  ON public.user_activity_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_tracking_last_active
  ON public.user_activity_tracking(last_active DESC);

-- Enable RLS
ALTER TABLE public.user_activity_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_tracking'
      AND policyname = 'users_view_own_activity'
  ) THEN
    CREATE POLICY "users_view_own_activity" ON public.user_activity_tracking
      FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_tracking'
      AND policyname = 'admins_view_all_activity'
  ) THEN
    CREATE POLICY "admins_view_all_activity" ON public.user_activity_tracking
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.admin_users
          WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_activity_tracking'
      AND policyname = 'system_update_activity'
  ) THEN
    CREATE POLICY "system_update_activity" ON public.user_activity_tracking
      FOR UPDATE TO authenticated
      USING (true);  -- enforcement via triggers/app logic
  END IF;
END$$;

-- Optional: index for admin lookup used in RLS
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);

-- ============================================================================
-- 2. Create daily_notification_log table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Notification metadata
  notification_type VARCHAR(100) NOT NULL,
  category INT CHECK (category >= 1 AND category <= 5),

  -- Scheduling and delivery
  scheduled_send_at TIMESTAMPTZ NOT NULL,
  actually_sent_at TIMESTAMPTZ,

  -- Engagement tracking
  opened_by_user BOOLEAN DEFAULT false,
  opened_at TIMESTAMPTZ,
  deep_link_clicked BOOLEAN DEFAULT false,
  deep_link_clicked_at TIMESTAMPTZ,
  action_taken BOOLEAN DEFAULT false,
  action_taken_at TIMESTAMPTZ,

  -- Content and personalization
  personalization_data JSONB,
  message_template VARCHAR(500),
  deep_link_url TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_notification_log_user
  ON public.daily_notification_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_notification_log_category
  ON public.daily_notification_log(category, opened_by_user);
CREATE INDEX IF NOT EXISTS idx_daily_notification_log_created
  ON public.daily_notification_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_notification_log_user_category
  ON public.daily_notification_log(user_id, category, created_at DESC);

-- Enable RLS
ALTER TABLE public.daily_notification_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (guarded)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_notification_log'
      AND policyname = 'users_view_own_notification_logs'
  ) THEN
    CREATE POLICY "users_view_own_notification_logs" ON public.daily_notification_log
      FOR SELECT TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_notification_log'
      AND policyname = 'admins_view_all_notification_logs'
  ) THEN
    CREATE POLICY "admins_view_all_notification_logs" ON public.daily_notification_log
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.admin_users
          WHERE user_id = (SELECT auth.uid())
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_notification_log'
      AND policyname = 'system_insert_notification_logs'
  ) THEN
    CREATE POLICY "system_insert_notification_logs" ON public.daily_notification_log
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;
END$$;

-- ============================================================================
-- 3. Extend notification_preferences table (guarded)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_preferences'
  ) THEN
    ALTER TABLE public.notification_preferences
      ADD COLUMN IF NOT EXISTS daily_categories JSONB DEFAULT '{
        "study_planning": true,
        "quiz_challenge": true,
        "group_nudge": true,
        "podcast_discovery": true,
        "progress_tracking": true
      }'::jsonb;

    ALTER TABLE public.notification_preferences
      ADD COLUMN IF NOT EXISTS preferred_notification_times JSONB DEFAULT '{
        "study_planning": ["08:00"],
        "quiz_challenge": ["14:00"],
        "group_nudge": ["17:00"],
        "podcast_discovery": ["07:00", "19:00"],
        "progress_tracking": "flexible"
      }'::jsonb;

    ALTER TABLE public.notification_preferences
      ADD COLUMN IF NOT EXISTS max_notifications_per_day INT
        DEFAULT 3 CHECK (max_notifications_per_day >= 0 AND max_notifications_per_day <= 10);

    ALTER TABLE public.notification_preferences
      ADD COLUMN IF NOT EXISTS user_timezone VARCHAR(100) DEFAULT 'UTC';
  END IF;
END$$;

-- ============================================================================
-- 4. Helper function and triggers for engagement tier
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_engagement_tier(last_active TIMESTAMPTZ)
RETURNS VARCHAR(20)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  days_since_active INT;
BEGIN
  days_since_active := EXTRACT(DAY FROM (now() - last_active));
  IF days_since_active < 1 THEN
    RETURN 'very_active';
  ELSIF days_since_active < 7 THEN
    RETURN 'active';
  ELSIF days_since_active < 30 THEN
    RETURN 'warm';
  ELSE
    RETURN 'cold';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_engagement_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.engagement_tier := public.calculate_engagement_tier(NEW.last_active);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_engagement_tier_trigger'
  ) THEN
    CREATE TRIGGER update_engagement_tier_trigger
      BEFORE UPDATE ON public.user_activity_tracking
      FOR EACH ROW
      EXECUTE FUNCTION public.update_engagement_tier();
  END IF;
END$$;

-- ============================================================================
-- 5. Initialize activity tracking on user signup
-- ============================================================================
CREATE OR REPLACE FUNCTION public.initialize_user_activity_tracking()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_activity_tracking (user_id, last_active, engagement_tier)
  VALUES (NEW.id, now(), 'very_active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'initialize_activity_tracking_trigger'
  ) THEN
    CREATE TRIGGER initialize_activity_tracking_trigger
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.initialize_user_activity_tracking();
  END IF;
END$$;

-- ============================================================================
-- 6. Create type for notification categories (guarded)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_category') THEN
    CREATE TYPE public.notification_category AS ENUM (
      'study_planning',
      'quiz_challenge',
      'group_nudge',
      'podcast_discovery',
      'progress_tracking'
    );
  END IF;
END
$$;

-- ============================================================================
-- 7. Grants
-- ============================================================================
GRANT SELECT ON public.user_activity_tracking TO authenticated;
GRANT SELECT ON public.daily_notification_log TO authenticated;
GRANT SELECT ON public.notification_preferences TO authenticated;
GRANT UPDATE ON public.notification_preferences TO authenticated;