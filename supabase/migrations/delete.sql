-- Create a role-qualified schema for safety if needed
-- CREATE SCHEMA IF NOT EXISTS maintenance;

CREATE OR REPLACE FUNCTION public.purge_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Optional: ensure only privileged role can run
  -- PERFORM CASE WHEN current_setting('role', true) IS NULL THEN NULL END;

  -- Wrap everything in a transaction
  PERFORM pg_advisory_xact_lock(999991); -- coarse lock to avoid concurrent purges

  -- 1) Live quiz cleanup: cascade dependents, then sessions, then quizzes
  WITH user_quiz_ids AS (
    SELECT q.id FROM public.quizzes q WHERE q.user_id = p_user_id
  ),
  user_sessions AS (
    SELECT s.id FROM public.live_quiz_sessions s
    WHERE s.host_user_id = p_user_id OR s.quiz_id IN (SELECT id FROM user_quiz_ids)
  ),
  del_pqp AS (
    DELETE FROM public.player_question_progress pqp
    USING public.live_quiz_questions q
    WHERE q.id = pqp.question_id
      AND q.session_id IN (SELECT id FROM user_sessions)
    RETURNING 1
  ),
  del_answers AS (
    DELETE FROM public.live_quiz_answers a
    USING public.live_quiz_questions q
    WHERE q.id = a.question_id
      AND q.session_id IN (SELECT id FROM user_sessions)
    RETURNING 1
  ),
  del_questions AS (
    DELETE FROM public.live_quiz_questions q
    WHERE q.session_id IN (SELECT id FROM user_sessions)
    RETURNING 1
  ),
  del_players AS (
    DELETE FROM public.live_quiz_players lp
    WHERE lp.session_id IN (SELECT id FROM user_sessions)
    RETURNING 1
  )
  DELETE FROM public.live_quiz_sessions s
  WHERE s.id IN (SELECT id FROM user_sessions);

  -- Any direct attempts/participation by user
  DELETE FROM public.quiz_attempts WHERE user_id = p_user_id;

  -- Now the user's quizzes
  DELETE FROM public.quizzes WHERE user_id = p_user_id;

  -- 2) Social graph and content (child-first)
  -- Reads/resources/media for messages sent by the user
  DELETE FROM public.social_chat_message_reads WHERE user_id = p_user_id;
  DELETE FROM public.social_chat_message_resources r
  USING public.social_chat_messages m
  WHERE r.message_id = m.id AND m.sender_id = p_user_id;
  DELETE FROM public.social_chat_message_media mm
  USING public.social_chat_messages m
  WHERE mm.message_id = m.id AND m.sender_id = p_user_id;

  -- Messages and sessions
  DELETE FROM public.social_chat_messages WHERE sender_id = p_user_id;
  DELETE FROM public.social_chat_sessions
  WHERE user_id1 = p_user_id OR user_id2 = p_user_id;

  -- Interactions and graph edges
  DELETE FROM public.social_event_attendees WHERE user_id = p_user_id;
  DELETE FROM public.social_group_members WHERE user_id = p_user_id;
  DELETE FROM public.social_notifications
  WHERE user_id = p_user_id OR actor_id = p_user_id;
  DELETE FROM public.social_bookmarks WHERE user_id = p_user_id;
  DELETE FROM public.social_likes WHERE user_id = p_user_id;
  DELETE FROM public.social_follows
  WHERE follower_id = p_user_id OR following_id = p_user_id;
  DELETE FROM public.social_user_signals WHERE user_id = p_user_id;

  -- Content authored by the user (posts/comments), children first
  DELETE FROM public.social_comment_media scm
  USING public.social_comments c
  WHERE scm.comment_id = c.id AND c.author_id = p_user_id;

  DELETE FROM public.social_media sm
  USING public.social_posts p
  WHERE sm.post_id = p.id AND p.author_id = p_user_id;

  DELETE FROM public.social_post_hashtags sph
  USING public.social_posts p
  WHERE sph.post_id = p.id AND p.author_id = p_user_id;

  DELETE FROM public.social_post_tags spt
  USING public.social_posts p
  WHERE spt.post_id = p.id AND p.author_id = p_user_id;

  DELETE FROM public.social_post_views WHERE user_id = p_user_id;
  DELETE FROM public.social_comments WHERE author_id = p_user_id;
  DELETE FROM public.social_shares WHERE user_id = p_user_id;
  DELETE FROM public.social_posts WHERE author_id = p_user_id;

  -- Events organized by the user (after removing attendees above)
  DELETE FROM public.social_events WHERE organizer_id = p_user_id;

  -- Finally remove the social profile row
  DELETE FROM public.social_users WHERE id = p_user_id;

  -- 3) Documents/notes/folders (child-first)
  DELETE FROM public.document_folder_items dfi
  USING public.document_folders f
  WHERE dfi.folder_id = f.id AND f.user_id = p_user_id;
  DELETE FROM public.document_folders WHERE user_id = p_user_id;

  DELETE FROM public.notes WHERE user_id = p_user_id;
  DELETE FROM public.class_recordings WHERE user_id = p_user_id;
  DELETE FROM public.documents WHERE user_id = p_user_id;

  -- 4) Chat (AI chat)
  DELETE FROM public.chat_messages WHERE user_id = p_user_id;
  DELETE FROM public.chat_sessions WHERE user_id = p_user_id;

  -- 5) Schedule
  DELETE FROM public.schedule_reminders sr
  USING public.schedule_items s
  WHERE sr.schedule_id = s.id AND s.user_id = p_user_id;
  DELETE FROM public.schedule_items WHERE user_id = p_user_id;

  -- 6) Learning/goals/flashcards
  DELETE FROM public.flashcards WHERE user_id = p_user_id;
  DELETE FROM public.user_learning_goals WHERE user_id = p_user_id;
  DELETE FROM public.ai_user_memory WHERE user_id = p_user_id;
  DELETE FROM public.learning_topic_connections WHERE user_id = p_user_id;

  -- 7) Notifications (system-wide tables)
  DELETE FROM public.notification_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.notification_preferences WHERE user_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;

  -- 8) Calendar
  DELETE FROM public.calendar_integrations WHERE user_id = p_user_id;

  -- 9) Stats and achievements
  DELETE FROM public.achievements WHERE user_id = p_user_id;
  DELETE FROM public.user_stats WHERE user_id = p_user_id;

  -- 10) Podcasts
  DELETE FROM public.podcast_credit_transactions WHERE user_id = p_user_id;
  DELETE FROM public.podcast_credits WHERE user_id = p_user_id;
  DELETE FROM public.podcast_listeners WHERE user_id = p_user_id;
  DELETE FROM public.podcast_members WHERE user_id = p_user_id OR invited_by = p_user_id;
  DELETE FROM public.podcast_invites WHERE inviter_id = p_user_id OR invitee_id = p_user_id;

  -- 11) Courses/platform
  DELETE FROM public.course_enrollments WHERE user_id = p_user_id;
  DELETE FROM public.course_resources WHERE created_by = p_user_id;
  DELETE FROM public.courses WHERE created_by = p_user_id;

  DELETE FROM public.platform_update_reads WHERE user_id = p_user_id;
  DELETE FROM public.platform_updates
  WHERE created_by = p_user_id OR updated_by = p_user_id;

  -- 12) Admin/institution
  DELETE FROM public.admin_activity_logs al
  USING public.admin_users a
  WHERE al.admin_id = a.id AND a.user_id = p_user_id;

  DELETE FROM public.admin_users
  WHERE user_id = p_user_id OR created_by = p_user_id;

  DELETE FROM public.institution_members
  WHERE user_id = p_user_id OR invited_by = p_user_id;

  DELETE FROM public.institution_invites
  WHERE invited_by = p_user_id;

  -- 13) Moderation/system logs
  DELETE FROM public.content_moderation_log WHERE user_id = p_user_id;
  DELETE FROM public.system_error_logs
  WHERE user_id = p_user_id OR resolved_by = p_user_id;

  -- 14) Referrals
  DELETE FROM public.referrals
  WHERE referrer_id = p_user_id OR referee_id = p_user_id;

  -- 15) Profiles last (keep auth.users as requested)
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- If you ever need to remove the Auth user, uncomment:
  -- DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

-- Restrict execution to trusted roles (optional but recommended)
REVOKE ALL ON FUNCTION public.purge_user_data(uuid) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION public.purge_user_data(uuid) TO your_app_role;