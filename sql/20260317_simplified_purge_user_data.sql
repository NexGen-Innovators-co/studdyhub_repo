-- ============================================================
-- Simplified purge_user_data() Function
-- ============================================================
-- This is the SIMPLIFIED version that works AFTER the CASCADE
-- delete migration (20260317_add_cascade_delete_constraints.sql)
-- has been deployed.
--
-- Instead of ~200 lines manually deleting from 50+ tables,
-- this version only needs to delete from the root tables.
-- All dependent tables cascade automatically.
--
-- DEPLOYMENT:
-- 1. Deploy: sql/20260317_add_cascade_delete_constraints.sql
-- 2. Deploy: This function update
-- 3. Remove old purge_user_data function from supabase/migrations/delete.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.purge_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Optional coarse lock to avoid concurrent purges
  PERFORM pg_advisory_xact_lock(999991);

  -- Step 1: Delete the social_users record
  -- This cascades to: all social posts, comments, events, chats, interactions
  DELETE FROM public.social_users WHERE id = p_user_id;

  -- Step 2: Delete the profiles record
  -- This cascades to:
  --   - notes, documents, class_recordings
  --   - quizzes (which cascade to live_quiz_sessions → questions → players → answers)
  --   - quiz_attempts
  --   - flashcards, learning goals, AI memory, topic connections
  --   - chat_sessions, chat_messages
  --   - schedule_items (which cascade to schedule_reminders)
  --   - achievements, user_stats
  --   - course_enrollments (which cascade to course_progress)
  --   - platform_update_reads
  --   - And many more indirect cascades...
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- Step 3: Delete direct auth.users references
  -- After profiles cascade, clean up any remaining direct user_id references:
  -- These mostly stay because they reference auth.users directly:
  --   - notification_preferences, notification_subscriptions, daily_notification_log
  --   - podcast_credits, podcast_credit_transactions
  --   - institution_members, admin_users
  --   - user_activity_tracking, calendar_integrations
  --   - referrals
  --   - content_moderation_log (SET NULL - audit trail)
  --   - system_error_logs (SET NULL - system audit trail)
  -- 
  -- These all cascade or SET NULL automatically, but we ensure they're deleted:
  DELETE FROM public.notification_preferences WHERE user_id = p_user_id;
  DELETE FROM public.notification_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.podcast_credits WHERE user_id = p_user_id;
  DELETE FROM public.podcast_credit_transactions WHERE user_id = p_user_id;
  DELETE FROM public.institution_members WHERE user_id = p_user_id;
  DELETE FROM public.admin_users WHERE user_id = p_user_id;
  DELETE FROM public.user_activity_tracking WHERE user_id = p_user_id;
  DELETE FROM public.calendar_integrations WHERE user_id = p_user_id;
  DELETE FROM public.referrals WHERE referrer_id = p_user_id OR referee_id = p_user_id;

  -- Note: Audit logs (content_moderation_log, system_error_logs) are SET NULL
  -- to preserve history while removing the user association

  -- Authentication user is NOT deleted (kept per original design)
  -- Uncomment if you want to enable full user deletion:
  -- DELETE FROM auth.users WHERE id = p_user_id;

  RAISE NOTICE '[Purge Complete] User % and all associated data deleted', p_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error during user purge: %', SQLERRM;
END;
$$;

-- Restrict execution to trusted roles
REVOKE ALL ON FUNCTION public.purge_user_data(uuid) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.purge_user_data(uuid) TO authenticated;
