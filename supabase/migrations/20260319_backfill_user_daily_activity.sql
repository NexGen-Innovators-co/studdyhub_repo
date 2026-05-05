-- Migration: Backfill user_daily_activity from existing activity tables
-- Date: 2026-03-19

-- NOTE: This migration is intended to run once. It inserts aggregated daily counts
-- for existing users based on existing content tables, so the new daily activity
-- tracking system starts with meaningful historical data.

-- 1. Notes (assign xp per note to match in-app XP values)
INSERT INTO public.user_daily_activity (user_id, activity_date, activity_type, action_count, xp_earned)
SELECT
  user_id,
  DATE(created_at) AS activity_date,
  'note' AS activity_type,
  COUNT(*) AS action_count,
  COUNT(*) * 30 AS xp_earned
FROM public.notes
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(created_at)
ON CONFLICT (user_id, activity_date, activity_type)
DO UPDATE SET
  action_count = EXCLUDED.action_count,
  xp_earned = EXCLUDED.xp_earned;

-- 2. Recordings
INSERT INTO public.user_daily_activity (user_id, activity_date, activity_type, action_count, xp_earned)
SELECT
  user_id,
  DATE(created_at) AS activity_date,
  'recording' AS activity_type,
  COUNT(*) AS action_count,
  0 AS xp_earned
FROM public.class_recordings
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(created_at)
ON CONFLICT (user_id, activity_date, activity_type)
DO UPDATE SET
  action_count = EXCLUDED.action_count;

-- 3. Documents
INSERT INTO public.user_daily_activity (user_id, activity_date, activity_type, action_count, xp_earned)
SELECT
  user_id,
  DATE(created_at) AS activity_date,
  'document' AS activity_type,
  COUNT(*) AS action_count,
  0 AS xp_earned
FROM public.documents
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(created_at)
ON CONFLICT (user_id, activity_date, activity_type)
DO UPDATE SET
  action_count = EXCLUDED.action_count;

-- 4. Quiz attempts
INSERT INTO public.user_daily_activity (user_id, activity_date, activity_type, action_count, xp_earned)
SELECT
  user_id,
  DATE(created_at) AS activity_date,
  'quiz' AS activity_type,
  COUNT(*) AS action_count,
  0 AS xp_earned
FROM public.quiz_attempts
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(created_at)
ON CONFLICT (user_id, activity_date, activity_type)
DO UPDATE SET
  action_count = EXCLUDED.action_count;

-- 5. Chat messages (assign a small XP per message)
INSERT INTO public.user_daily_activity (user_id, activity_date, activity_type, action_count, xp_earned)
SELECT
  user_id,
  DATE(timestamp) AS activity_date,
  'chat' AS activity_type,
  COUNT(*) AS action_count,
  COUNT(*) * 10 AS xp_earned
FROM public.chat_messages
WHERE user_id IS NOT NULL
GROUP BY user_id, DATE(timestamp)
ON CONFLICT (user_id, activity_date, activity_type)
DO UPDATE SET
  action_count = EXCLUDED.action_count,
  xp_earned = EXCLUDED.xp_earned;
