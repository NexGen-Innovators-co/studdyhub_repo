-- Migration: Fix function_search_path_mutable warnings
-- Date: 2026-02-07
-- Description: Pins search_path on all public functions that the Supabase
--              linter flagged as having a mutable search_path.
--
-- APPROACH:
--   • Functions whose bodies already use fully-qualified names (public.table)
--     get SET search_path = ''  (strictest).
--   • Functions whose bodies use UNQUALIFIED table names get
--     SET search_path = 'public'  (pins to public, still resolves the linter
--     because the path is no longer mutable / injectable).
--
-- NOTE: log_admin_activity(_action text, _target_type text, _target_id uuid, _details jsonb)
--       already has search_path=public — skipped.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

-- ============================================================================
-- GROUP A — Bodies already fully qualified → SET search_path = ''
-- ============================================================================

-- Trigger functions that only touch NEW/OLD (no table refs at all)
ALTER FUNCTION public.update_updated_at()                 SET search_path = '';
ALTER FUNCTION public.update_updated_at_column()          SET search_path = '';
ALTER FUNCTION public.update_flashcard_updated_at()       SET search_path = '';
ALTER FUNCTION public.update_chat_message_timestamp()     SET search_path = '';
ALTER FUNCTION public.update_context_size()               SET search_path = '';

-- Pure-logic functions (no table refs)
ALTER FUNCTION public.generate_referral_code()            SET search_path = '';
ALTER FUNCTION public.build_where_clause(jsonb)           SET search_path = '';
ALTER FUNCTION public.get_xp_for_level(integer)           SET search_path = '';

-- Trigger/regular functions whose bodies use public.* qualified refs
ALTER FUNCTION public._social_chat_message_reads_propagate()     SET search_path = '';
ALTER FUNCTION public._social_group_members_propagate()          SET search_path = '';
ALTER FUNCTION public._social_groups_recalc_members_count_for(uuid) SET search_path = '';
ALTER FUNCTION public.assign_referral_code()              SET search_path = '';
ALTER FUNCTION public.create_social_user_profile()        SET search_path = '';
ALTER FUNCTION public.handle_new_user()                   SET search_path = '';
ALTER FUNCTION public.handle_new_user_debug()             SET search_path = '';
ALTER FUNCTION public.handle_new_user_inner(jsonb)        SET search_path = '';
ALTER FUNCTION public.handle_user_update()                SET search_path = '';
ALTER FUNCTION public.handle_new_comment_notification()   SET search_path = '';
ALTER FUNCTION public.handle_new_like_notification()      SET search_path = '';
ALTER FUNCTION public.notify_post_comment()               SET search_path = '';
ALTER FUNCTION public.notify_post_like()                  SET search_path = '';
ALTER FUNCTION public.notify_comment_like()               SET search_path = '';
ALTER FUNCTION public.guard_log_admin_activity()          SET search_path = '';
ALTER FUNCTION public.log_admin_activity()                SET search_path = '';  -- trigger overload (0-arg)
ALTER FUNCTION public.increment_podcast_listen_count(uuid)  SET search_path = '';
ALTER FUNCTION public.increment_podcast_share_count(uuid)   SET search_path = '';
ALTER FUNCTION public.check_user_is_cohost(uuid, uuid)     SET search_path = '';
ALTER FUNCTION public.get_due_flashcards(uuid, integer)     SET search_path = '';
ALTER FUNCTION public.review_flashcard(uuid, uuid, integer) SET search_path = '';
ALTER FUNCTION public.process_referral_reward(uuid, text)   SET search_path = '';
ALTER FUNCTION public.sync_profile_to_social()            SET search_path = '';
ALTER FUNCTION public.sync_social_to_profile()            SET search_path = '';
ALTER FUNCTION public.expire_old_podcast_invites()        SET search_path = '';
ALTER FUNCTION public.generate_unique_username(text)      SET search_path = '';
ALTER FUNCTION public.mark_session_messages_read(uuid, uuid) SET search_path = '';

-- information_schema / pg_catalog queries (always accessible)
ALTER FUNCTION public.get_schema_tables()                 SET search_path = '';
ALTER FUNCTION public.get_table_columns(text)             SET search_path = '';
ALTER FUNCTION public.get_table_policies(text)            SET search_path = '';
ALTER FUNCTION public.get_table_relationships(text)       SET search_path = '';


-- ============================================================================
-- GROUP B — Bodies use UNQUALIFIED table names → SET search_path = 'public'
--           (pinned = no longer mutable, resolves the linter warning)
-- ============================================================================

-- Trigger functions with unqualified table references
ALTER FUNCTION public.cleanup_podcast_cohosts()           SET search_path = 'public';
-- body: DELETE FROM podcast_cohosts ...

ALTER FUNCTION public.notify_chat_message()               SET search_path = 'public';
-- body: social_chat_sessions, social_users, notifications

ALTER FUNCTION public.notify_group_message()              SET search_path = 'public';
-- body: social_chat_sessions, social_users, social_groups, social_group_members, notifications

ALTER FUNCTION public.notify_new_follower()               SET search_path = 'public';
-- body: social_users, notifications

ALTER FUNCTION public.notify_post_share()                 SET search_path = 'public';
-- body: social_posts, social_users, notifications

ALTER FUNCTION public.notify_post_mention()               SET search_path = 'public';
-- body: social_users, notifications

ALTER FUNCTION public.notify_comment_mention()            SET search_path = 'public';
-- body: social_users, notifications

ALTER FUNCTION public.notify_group_invite()               SET search_path = 'public';
-- body: social_groups, social_users, notifications

ALTER FUNCTION public.update_chat_session_timestamp()     SET search_path = 'public';
-- body: social_chat_sessions

ALTER FUNCTION public.update_session_last_message()       SET search_path = 'public';
-- body: social_chat_sessions

ALTER FUNCTION public.send_push_notification()            SET search_path = 'public';
-- body: notification_preferences, notification_subscriptions, net.http_post

-- Regular functions with unqualified table references
ALTER FUNCTION public.apply_code_night_promo(uuid, text)  SET search_path = 'public';
-- body: subscriptions

ALTER FUNCTION public.get_user_streak(uuid)               SET search_path = 'public';
-- body: notes, class_recordings, documents, chat_messages

ALTER FUNCTION public.get_user_activity_stats(uuid, integer) SET search_path = 'public';
-- body: notes, class_recordings, documents, chat_messages

ALTER FUNCTION public.get_user_activity_history(uuid, timestamptz, text) SET search_path = 'public';
-- body: notes, class_recordings, documents, quiz_attempts, chat_messages

ALTER FUNCTION public.mark_notification_read(uuid)        SET search_path = 'public';
-- body: notifications

ALTER FUNCTION public.mark_all_notifications_read()       SET search_path = 'public';
-- body: notifications

ALTER FUNCTION public.cleanup_old_notifications()         SET search_path = 'public';
-- body: notifications

ALTER FUNCTION public.cleanup_old_podcast_chunks(integer) SET search_path = 'public';
-- body: podcast_chunks

ALTER FUNCTION public.log_schema_query(uuid, text, text, jsonb, boolean, text, integer) SET search_path = 'public';
-- body: schema_agent_audit

ALTER FUNCTION public.approve_group_member(uuid, uuid, uuid, uuid) SET search_path = 'public';
-- body: social_group_members, social_groups, social_users, social_notifications

ALTER FUNCTION public.validate_and_execute_query(uuid, text, text, jsonb, jsonb, jsonb, integer) SET search_path = 'public';
-- body: information_schema + calls build_where_clause (unqualified function call)

ALTER FUNCTION public.get_or_create_group_chat_session(uuid) SET search_path = 'public';
-- body: social_chat_sessions

ALTER FUNCTION public.get_user_stats_with_achievements(uuid) SET search_path = 'public';
-- body: user_stats, achievements

ALTER FUNCTION public.is_podcast_cohost(uuid, uuid)       SET search_path = 'public';
-- body: podcast_cohosts

ALTER FUNCTION public.check_podcast_permissions(uuid, uuid) SET search_path = 'public';
-- body: ai_podcasts, podcast_cohosts

ALTER FUNCTION public.get_session_unread_count(uuid, uuid) SET search_path = 'public';
-- body: social_chat_messages

ALTER FUNCTION public.get_user_unread_count(uuid)         SET search_path = 'public';
-- body: social_chat_messages, social_chat_sessions

ALTER FUNCTION public.get_suggested_users(uuid, uuid[], integer, integer) SET search_path = 'public';
-- body: social_users

ALTER FUNCTION public.get_learning_velocity(uuid, integer) SET search_path = 'public';
-- body: notes

ALTER FUNCTION public.update_goal_progress(uuid, integer) SET search_path = 'public';
-- body: user_learning_goals
