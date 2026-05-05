-- ============================================================================
-- STEP 1: Dump ALL flagged function definitions (full source code)
-- Run this in Supabase Dashboard > SQL Editor
-- Copy the entire result to share back
-- ============================================================================

SELECT
  p.proname                                          AS function_name,
  pg_get_function_identity_arguments(p.oid)          AS arguments,
  pg_get_function_result(p.oid)                      AS return_type,
  l.lanname                                          AS language,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS security,
  CASE WHEN p.proconfig IS NOT NULL
       THEN array_to_string(p.proconfig, ', ')
       ELSE '(none)' END                             AS config_settings,
  p.prosrc                                           AS source_code
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname IN (
    'cleanup_podcast_cohosts',
    'increment_podcast_listen_count',
    'increment_podcast_share_count',
    '_social_chat_message_reads_propagate',
    'expire_old_podcast_invites',
    '_social_groups_recalc_members_count_for',
    'generate_referral_code',
    'handle_new_user_debug',
    '_social_group_members_propagate',
    'is_podcast_cohost',
    'cleanup_old_podcast_chunks',
    'update_updated_at',
    'sync_social_to_profile',
    'process_referral_reward',
    'sync_profile_to_social',
    'update_flashcard_updated_at',
    'get_user_stats_with_achievements',
    'update_goal_progress',
    'get_due_flashcards',
    'review_flashcard',
    'log_admin_activity',
    'get_user_streak',
    'check_user_is_cohost',
    'send_push_notification',
    'guard_log_admin_activity',
    'check_podcast_permissions',
    'handle_new_comment_notification',
    'notify_new_follower',
    'notify_chat_message',
    'notify_group_message',
    'notify_post_share',
    'get_xp_for_level',
    'mark_notification_read',
    'mark_all_notifications_read',
    'cleanup_old_notifications',
    'notify_post_mention',
    'update_chat_session_timestamp',
    'get_suggested_users',
    'get_or_create_group_chat_session',
    'update_session_last_message',
    'update_chat_message_timestamp',
    'notify_comment_mention',
    'get_user_unread_count',
    'get_session_unread_count',
    'handle_user_update',
    'notify_group_invite',
    'update_context_size',
    'get_user_activity_stats',
    'apply_code_night_promo',
    'update_updated_at_column',
    'get_table_policies',
    'create_social_user_profile',
    'assign_referral_code',
    'handle_new_user_inner',
    'mark_session_messages_read',
    'approve_group_member',
    'handle_new_user',
    'get_learning_velocity',
    'generate_unique_username',
    'notify_comment_like',
    'build_where_clause',
    'notify_post_like',
    'get_schema_tables',
    'notify_post_comment',
    'handle_new_like_notification',
    'get_table_columns',
    'get_table_relationships',
    'validate_and_execute_query',
    'log_schema_query',
    'get_user_activity_history'
  )
ORDER BY p.proname;


-- ============================================================================
-- STEP 2: Show current RLS policies on the flagged tables
-- ============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual   AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'app_stats',
    'content_moderation_log',
    'live_quiz_players',
    'live_quiz_questions',
    'live_quiz_sessions',
    'notifications',
    'podcast_chunks',
    'podcast_recordings',
    'referrals',
    'social_hashtags',
    'social_posts',
    'social_users'
  )
ORDER BY tablename, policyname;


-- ============================================================================
-- STEP 3: Show table columns for the flagged tables
-- (so we know which user-ownership columns exist)
-- ============================================================================

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'app_stats',
    'content_moderation_log',
    'live_quiz_players',
    'live_quiz_questions',
    'live_quiz_sessions',
    'notifications',
    'podcast_chunks',
    'podcast_recordings',
    'referrals',
    'social_hashtags',
    'social_posts',
    'social_users'
  )
ORDER BY table_name, ordinal_position;


-- ============================================================================
-- STEP 4: Show triggers on these tables (to understand which functions
--          are called as triggers vs standalone)
-- ============================================================================

SELECT
  event_object_table  AS table_name,
  trigger_name,
  event_manipulation  AS event,
  action_timing       AS timing,
  action_statement    AS function_call
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN (
    'app_stats',
    'content_moderation_log',
    'live_quiz_players',
    'live_quiz_questions',
    'live_quiz_sessions',
    'notifications',
    'podcast_chunks',
    'podcast_recordings',
    'referrals',
    'social_hashtags',
    'social_posts',
    'social_users',
    'social_comments',
    'social_likes',
    'social_follows',
    'social_group_members',
    'social_chat_messages',
    'social_chat_message_reads',
    'chat_messages',
    'chat_sessions',
    'profiles',
    'flashcards',
    'study_goals'
  )
ORDER BY table_name, trigger_name;


-- ============================================================================
-- STEP 5: Check which functions are trigger functions vs regular functions
-- ============================================================================

SELECT
  p.proname AS function_name,
  CASE p.prorettype
    WHEN 2279 THEN 'trigger'   -- trigger return type OID
    ELSE pg_get_function_result(p.oid)
  END AS return_type,
  CASE p.prosecdef WHEN true THEN 'SECURITY DEFINER' ELSE 'INVOKER' END AS security,
  l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language  l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname IN (
    'cleanup_podcast_cohosts',
    'increment_podcast_listen_count',
    'increment_podcast_share_count',
    '_social_chat_message_reads_propagate',
    'expire_old_podcast_invites',
    '_social_groups_recalc_members_count_for',
    'generate_referral_code',
    'handle_new_user_debug',
    '_social_group_members_propagate',
    'is_podcast_cohost',
    'cleanup_old_podcast_chunks',
    'update_updated_at',
    'sync_social_to_profile',
    'process_referral_reward',
    'sync_profile_to_social',
    'update_flashcard_updated_at',
    'get_user_stats_with_achievements',
    'update_goal_progress',
    'get_due_flashcards',
    'review_flashcard',
    'log_admin_activity',
    'get_user_streak',
    'check_user_is_cohost',
    'send_push_notification',
    'guard_log_admin_activity',
    'check_podcast_permissions',
    'handle_new_comment_notification',
    'notify_new_follower',
    'notify_chat_message',
    'notify_group_message',
    'notify_post_share',
    'get_xp_for_level',
    'mark_notification_read',
    'mark_all_notifications_read',
    'cleanup_old_notifications',
    'notify_post_mention',
    'update_chat_session_timestamp',
    'get_suggested_users',
    'get_or_create_group_chat_session',
    'update_session_last_message',
    'update_chat_message_timestamp',
    'notify_comment_mention',
    'get_user_unread_count',
    'get_session_unread_count',
    'handle_user_update',
    'notify_group_invite',
    'update_context_size',
    'get_user_activity_stats',
    'apply_code_night_promo',
    'update_updated_at_column',
    'get_table_policies',
    'create_social_user_profile',
    'assign_referral_code',
    'handle_new_user_inner',
    'mark_session_messages_read',
    'approve_group_member',
    'handle_new_user',
    'get_learning_velocity',
    'generate_unique_username',
    'notify_comment_like',
    'build_where_clause',
    'notify_post_like',
    'get_schema_tables',
    'notify_post_comment',
    'handle_new_like_notification',
    'get_table_columns',
    'get_table_relationships',
    'validate_and_execute_query',
    'log_schema_query',
    'get_user_activity_history'
  )
ORDER BY return_type DESC, p.proname;


-- ============================================================================
-- STEP 6: Check pg_net extension current schema
-- ============================================================================

SELECT
  e.extname   AS extension_name,
  n.nspname   AS current_schema,
  e.extversion AS version
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_net';
