-- ============================================================
-- Backfill Notification Preferences for Existing Users
-- Creates default notification preferences for all users who
-- don't already have them (users from before preference system)
-- ============================================================

-- Insert default notification preferences for users who don't have them yet
INSERT INTO notification_preferences (
  user_id,
  email_notifications,
  push_notifications,
  schedule_reminders,
  social_notifications,
  quiz_reminders,
  assignment_reminders,
  reminder_time,
  quiet_hours_enabled,
  quiet_hours_start,
  quiet_hours_end,
  user_timezone,
  max_notifications_per_day,
  daily_categories,
  created_at,
  updated_at
)

-- Select all users from auth.users who don't have notification preferences yet
SELECT
  u.id as user_id,
  true as email_notifications,
  true as push_notifications,
  true as schedule_reminders,
  true as social_notifications,
  true as quiz_reminders,
  true as assignment_reminders,
  30 as reminder_time,
  false as quiet_hours_enabled,
  '22:00' as quiet_hours_start,
  '08:00' as quiet_hours_end,
  'UTC' as user_timezone,  -- Default to UTC (users can update in Settings based on IP detection)
  3 as max_notifications_per_day,
  jsonb_build_object(
    'study_planning', jsonb_build_object('enabled', true, 'time', '07:00'),
    'quiz_challenge', jsonb_build_object('enabled', true, 'time', '14:00'),
    'group_nudge', jsonb_build_object('enabled', true, 'time', '17:00'),
    'podcast_discovery', jsonb_build_object('enabled', true, 'time', '19:00'),
    'progress_tracking', jsonb_build_object('enabled', true, 'time', '20:00')
  ) as daily_categories,
  NOW() as created_at,
  NOW() as updated_at

FROM auth.users u

-- Only insert for users who don't already have preferences
WHERE u.id NOT IN (
  SELECT DISTINCT user_id FROM notification_preferences
)

-- Exclude deleted users
AND u.deleted_at IS NULL

ON CONFLICT (user_id) DO NOTHING;

-- Log the result
DO $$
DECLARE
  affected_count INT;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM notification_preferences
  WHERE created_at >= NOW() - INTERVAL '1 minute';
  
  RAISE NOTICE '[Backfill] Created notification preferences for % users', affected_count;
END $$;
