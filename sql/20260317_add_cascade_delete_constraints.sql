-- ============================================================
-- Add ON DELETE CASCADE to Foreign Key Constraints
-- ============================================================
-- This migration enables automatic cascading deletes across all
-- tables when a user is deleted. This simplifies the purge_user_data()
-- function and reduces the risk of orphaned records.
--
-- Strategy:
-- - CASCADE: User content (notes, posts, quizzes, etc.)
-- - SET NULL: Audit logs and "created_by" references
-- - RESTRICT: Transaction/history tables that must preserve data
--
-- Note: This is a non-blocking migration. Constraints are dropped and
-- recreated one at a time to avoid long locks.
-- ============================================================

-- ============================================================
-- SECTION 1: Direct auth.users FK References
-- Strategy: CASCADE for user content, SET NULL for audit trails
-- ============================================================

-- 1. PROFILES table
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_verified_by_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_verified_by_fkey 
  FOREIGN KEY (role_verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. NOTIFICATION preferences and tracking
ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE notification_subscriptions DROP CONSTRAINT IF EXISTS notification_subscriptions_user_id_fkey;
ALTER TABLE notification_subscriptions ADD CONSTRAINT notification_subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE daily_notification_log DROP CONSTRAINT IF EXISTS daily_notification_log_user_id_fkey;
ALTER TABLE daily_notification_log ADD CONSTRAINT daily_notification_log_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. PODCAST system
ALTER TABLE podcast_credits DROP CONSTRAINT IF EXISTS podcast_credits_user_id_fkey;
ALTER TABLE podcast_credits ADD CONSTRAINT podcast_credits_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE podcast_credit_transactions DROP CONSTRAINT IF EXISTS podcast_credit_transactions_user_id_fkey;
ALTER TABLE podcast_credit_transactions ADD CONSTRAINT podcast_credit_transactions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. INSTITUTION members
ALTER TABLE institution_members DROP CONSTRAINT IF EXISTS institution_members_user_id_fkey;
ALTER TABLE institution_members ADD CONSTRAINT institution_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 5. ADMIN users
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_user_id_fkey;
ALTER TABLE admin_users ADD CONSTRAINT admin_users_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 6. ACTIVITY tracking
ALTER TABLE user_activity_tracking DROP CONSTRAINT IF EXISTS user_activity_tracking_user_id_fkey;
ALTER TABLE user_activity_tracking ADD CONSTRAINT user_activity_tracking_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 7. CALENDAR integrations
ALTER TABLE calendar_integrations DROP CONSTRAINT IF EXISTS calendar_integrations_user_id_fkey;
ALTER TABLE calendar_integrations ADD CONSTRAINT calendar_integrations_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 8. REFERRALS - both directions CASCADE (delete referrer's invites and referee's referral records)
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referrer_id_fkey;
ALTER TABLE referrals ADD CONSTRAINT referrals_referrer_id_fkey 
  FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_referee_id_fkey;
ALTER TABLE referrals ADD CONSTRAINT referrals_referee_id_fkey 
  FOREIGN KEY (referee_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 9. CONTENT MODERATION
ALTER TABLE content_moderation_log DROP CONSTRAINT IF EXISTS content_moderation_log_user_id_fkey;
ALTER TABLE content_moderation_log ADD CONSTRAINT content_moderation_log_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 10. SYSTEM ERROR LOGS - SET NULL to preserve error history
ALTER TABLE system_error_logs DROP CONSTRAINT IF EXISTS system_error_logs_user_id_fkey CASCADE;
ALTER TABLE system_error_logs ADD CONSTRAINT system_error_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE system_error_logs DROP CONSTRAINT IF EXISTS system_error_logs_resolved_by_fkey CASCADE;
ALTER TABLE system_error_logs ADD CONSTRAINT system_error_logs_resolved_by_fkey 
  FOREIGN KEY (resolved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- SECTION 2: profiles.id FK References (indirect cascade)
-- These cascade through profiles FK cascading when user deleted
-- ============================================================

-- 1. NOTES
ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
ALTER TABLE notes ADD CONSTRAINT notes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 2. DOCUMENTS & CLASS RECORDINGS
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_user_id_fkey;
ALTER TABLE documents ADD CONSTRAINT documents_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE class_recordings DROP CONSTRAINT IF EXISTS class_recordings_user_id_fkey;
ALTER TABLE class_recordings ADD CONSTRAINT class_recordings_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. DOCUMENT FOLDERS
ALTER TABLE document_folders DROP CONSTRAINT IF EXISTS document_folders_user_id_fkey;
ALTER TABLE document_folders ADD CONSTRAINT document_folders_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 4. QUIZZES
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_user_id_fkey;
ALTER TABLE quizzes ADD CONSTRAINT quizzes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;
ALTER TABLE quiz_attempts ADD CONSTRAINT quiz_attempts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 5. FLASHCARDS
ALTER TABLE flashcards DROP CONSTRAINT IF EXISTS flashcards_user_id_fkey;
ALTER TABLE flashcards ADD CONSTRAINT flashcards_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 6. LEARNING GOALS & AI MEMORY
ALTER TABLE user_learning_goals DROP CONSTRAINT IF EXISTS user_learning_goals_user_id_fkey;
ALTER TABLE user_learning_goals ADD CONSTRAINT user_learning_goals_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE ai_user_memory DROP CONSTRAINT IF EXISTS ai_user_memory_user_id_fkey;
ALTER TABLE ai_user_memory ADD CONSTRAINT ai_user_memory_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE learning_topic_connections DROP CONSTRAINT IF EXISTS learning_topic_connections_user_id_fkey;
ALTER TABLE learning_topic_connections ADD CONSTRAINT learning_topic_connections_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 7. CHAT SESSIONS & MESSAGES (AI Chat)
ALTER TABLE chat_sessions DROP CONSTRAINT IF EXISTS chat_sessions_user_id_fkey;
ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey;
ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 8. SCHEDULE items
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_user_id_fkey;
ALTER TABLE schedule_items ADD CONSTRAINT schedule_items_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 9. ACHIEVEMENTS & STATS
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_user_id_fkey;
ALTER TABLE achievements ADD CONSTRAINT achievements_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS user_stats_user_id_fkey;
ALTER TABLE user_stats ADD CONSTRAINT user_stats_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 10. COURSE ENROLLMENTS
ALTER TABLE course_enrollments DROP CONSTRAINT IF EXISTS course_enrollments_user_id_fkey;
ALTER TABLE course_enrollments ADD CONSTRAINT course_enrollments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 11. PLATFORM UPDATES
ALTER TABLE platform_update_reads DROP CONSTRAINT IF EXISTS platform_update_reads_user_id_fkey;
ALTER TABLE platform_update_reads ADD CONSTRAINT platform_update_reads_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- SECTION 3: social_users.id FK References
-- Cascades through social_users when profiles deleted
-- ============================================================

-- 1. SOCIAL POSTS & INTERACTIONS
ALTER TABLE social_posts DROP CONSTRAINT IF EXISTS social_posts_author_id_fkey;
ALTER TABLE social_posts ADD CONSTRAINT social_posts_author_id_fkey 
  FOREIGN KEY (author_id) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_post_views DROP CONSTRAINT IF EXISTS social_post_views_user_id_fkey;
ALTER TABLE social_post_views ADD CONSTRAINT social_post_views_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_shares DROP CONSTRAINT IF EXISTS social_shares_user_id_fkey;
ALTER TABLE social_shares ADD CONSTRAINT social_shares_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES social_users(id) ON DELETE CASCADE;

-- 2. SOCIAL COMMENTS
ALTER TABLE social_comments DROP CONSTRAINT IF EXISTS social_comments_author_id_fkey;
ALTER TABLE social_comments ADD CONSTRAINT social_comments_author_id_fkey 
  FOREIGN KEY (author_id) REFERENCES social_users(id) ON DELETE CASCADE;

-- 3. SOCIAL INTERACTIONS (likes, follows, bookmarks)
ALTER TABLE social_likes DROP CONSTRAINT IF EXISTS social_likes_user_id_fkey;
ALTER TABLE social_likes ADD CONSTRAINT social_likes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_follows DROP CONSTRAINT IF EXISTS social_follows_follower_id_fkey;
ALTER TABLE social_follows ADD CONSTRAINT social_follows_follower_id_fkey 
  FOREIGN KEY (follower_id) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_follows DROP CONSTRAINT IF EXISTS social_follows_following_id_fkey;
ALTER TABLE social_follows ADD CONSTRAINT social_follows_following_id_fkey 
  FOREIGN KEY (following_id) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_bookmarks DROP CONSTRAINT IF EXISTS social_bookmarks_user_id_fkey;
ALTER TABLE social_bookmarks ADD CONSTRAINT social_bookmarks_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES social_users(id) ON DELETE CASCADE;

-- 4. SOCIAL CHAT
ALTER TABLE social_chat_sessions DROP CONSTRAINT IF EXISTS social_chat_sessions_user_id1_fkey;
ALTER TABLE social_chat_sessions ADD CONSTRAINT social_chat_sessions_user_id1_fkey 
  FOREIGN KEY (user_id1) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_chat_sessions DROP CONSTRAINT IF EXISTS social_chat_sessions_user_id2_fkey;
ALTER TABLE social_chat_sessions ADD CONSTRAINT social_chat_sessions_user_id2_fkey 
  FOREIGN KEY (user_id2) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_chat_messages DROP CONSTRAINT IF EXISTS social_chat_messages_sender_id_fkey;
ALTER TABLE social_chat_messages ADD CONSTRAINT social_chat_messages_sender_id_fkey 
  FOREIGN KEY (sender_id) REFERENCES social_users(id) ON DELETE CASCADE;

ALTER TABLE social_chat_message_reads DROP CONSTRAINT IF EXISTS social_chat_message_reads_user_id_fkey;
ALTER TABLE social_chat_message_reads ADD CONSTRAINT social_chat_message_reads_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 5. SOCIAL EVENTS & GROUPS
ALTER TABLE social_events DROP CONSTRAINT IF EXISTS social_events_organizer_id_fkey;
ALTER TABLE social_events ADD CONSTRAINT social_events_organizer_id_fkey 
  FOREIGN KEY (organizer_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE social_event_attendees DROP CONSTRAINT IF EXISTS social_event_attendees_user_id_fkey;
ALTER TABLE social_event_attendees ADD CONSTRAINT social_event_attendees_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE social_group_members DROP CONSTRAINT IF EXISTS social_group_members_user_id_fkey;
ALTER TABLE social_group_members ADD CONSTRAINT social_group_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- 6. SOCIAL NOTIFICATIONS
ALTER TABLE social_notifications DROP CONSTRAINT IF EXISTS social_notifications_user_id_fkey;
ALTER TABLE social_notifications ADD CONSTRAINT social_notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE social_notifications DROP CONSTRAINT IF EXISTS social_notifications_actor_id_fkey;
ALTER TABLE social_notifications ADD CONSTRAINT social_notifications_actor_id_fkey 
  FOREIGN KEY (actor_id) REFERENCES social_users(id) ON DELETE CASCADE;

-- 7. SOCIAL USER SIGNALS
ALTER TABLE social_user_signals DROP CONSTRAINT IF EXISTS social_user_signals_user_id_fkey;
ALTER TABLE social_user_signals ADD CONSTRAINT social_user_signals_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- SECTION 4: Live Quiz Tables - Hierarchical CASCADE
-- ============================================================

-- Live quiz sessions (cascade from quizzes)
ALTER TABLE live_quiz_sessions DROP CONSTRAINT IF EXISTS live_quiz_sessions_quiz_id_fkey;
ALTER TABLE live_quiz_sessions ADD CONSTRAINT live_quiz_sessions_quiz_id_fkey 
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

ALTER TABLE live_quiz_sessions DROP CONSTRAINT IF EXISTS live_quiz_sessions_host_user_id_fkey;
ALTER TABLE live_quiz_sessions ADD CONSTRAINT live_quiz_sessions_host_user_id_fkey 
  FOREIGN KEY (host_user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Live quiz questions
ALTER TABLE live_quiz_questions DROP CONSTRAINT IF EXISTS live_quiz_questions_session_id_fkey;
ALTER TABLE live_quiz_questions ADD CONSTRAINT live_quiz_questions_session_id_fkey 
  FOREIGN KEY (session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE;

-- Live quiz players
ALTER TABLE live_quiz_players DROP CONSTRAINT IF EXISTS live_quiz_players_session_id_fkey;
ALTER TABLE live_quiz_players ADD CONSTRAINT live_quiz_players_session_id_fkey 
  FOREIGN KEY (session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE;

ALTER TABLE live_quiz_players DROP CONSTRAINT IF EXISTS live_quiz_players_user_id_fkey;
ALTER TABLE live_quiz_players ADD CONSTRAINT live_quiz_players_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Live quiz answers
ALTER TABLE live_quiz_answers DROP CONSTRAINT IF EXISTS live_quiz_answers_question_id_fkey;
ALTER TABLE live_quiz_answers ADD CONSTRAINT live_quiz_answers_question_id_fkey 
  FOREIGN KEY (question_id) REFERENCES live_quiz_questions(id) ON DELETE CASCADE;

ALTER TABLE live_quiz_answers DROP CONSTRAINT IF EXISTS live_quiz_answers_session_id_fkey;
ALTER TABLE live_quiz_answers ADD CONSTRAINT live_quiz_answers_session_id_fkey 
  FOREIGN KEY (session_id) REFERENCES live_quiz_sessions(id) ON DELETE CASCADE;

-- Player question progress
ALTER TABLE player_question_progress DROP CONSTRAINT IF EXISTS player_question_progress_question_id_fkey;
ALTER TABLE player_question_progress ADD CONSTRAINT player_question_progress_question_id_fkey 
  FOREIGN KEY (question_id) REFERENCES live_quiz_questions(id) ON DELETE CASCADE;

-- ============================================================
-- SECTION 5: Podcast Tables - Hierarchical CASCADE
-- ============================================================

ALTER TABLE podcast_members DROP CONSTRAINT IF EXISTS podcast_members_user_id_fkey;
ALTER TABLE podcast_members ADD CONSTRAINT podcast_members_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE podcast_members DROP CONSTRAINT IF EXISTS podcast_members_invited_by_fkey;
ALTER TABLE podcast_members ADD CONSTRAINT podcast_members_invited_by_fkey 
  FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE podcast_invites DROP CONSTRAINT IF EXISTS podcast_invites_inviter_id_fkey;
ALTER TABLE podcast_invites ADD CONSTRAINT podcast_invites_inviter_id_fkey 
  FOREIGN KEY (inviter_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE podcast_invites DROP CONSTRAINT IF EXISTS podcast_invites_invitee_id_fkey;
ALTER TABLE podcast_invites ADD CONSTRAINT podcast_invites_invitee_id_fkey 
  FOREIGN KEY (invitee_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE podcast_listeners DROP CONSTRAINT IF EXISTS podcast_listeners_user_id_fkey;
ALTER TABLE podcast_listeners ADD CONSTRAINT podcast_listeners_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- SECTION 6: Course Tables - Hierarchical CASCADE
-- ============================================================

ALTER TABLE course_progress DROP CONSTRAINT IF EXISTS course_progress_enrollment_id_fkey;
ALTER TABLE course_progress ADD CONSTRAINT course_progress_enrollment_id_fkey 
  FOREIGN KEY (enrollment_id) REFERENCES course_enrollments(id) ON DELETE CASCADE;

ALTER TABLE course_resources DROP CONSTRAINT IF EXISTS course_resources_created_by_fkey;
ALTER TABLE course_resources ADD CONSTRAINT course_resources_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE course_resources DROP CONSTRAINT IF EXISTS course_resources_course_id_fkey;
ALTER TABLE course_resources ADD CONSTRAINT course_resources_course_id_fkey 
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_created_by_fkey;
ALTER TABLE courses ADD CONSTRAINT courses_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================
-- SECTION 7: Platform Updates Table
-- ============================================================

ALTER TABLE platform_updates DROP CONSTRAINT IF EXISTS platform_updates_created_by_fkey;
ALTER TABLE platform_updates ADD CONSTRAINT platform_updates_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE platform_updates DROP CONSTRAINT IF EXISTS platform_updates_updated_by_fkey;
ALTER TABLE platform_updates ADD CONSTRAINT platform_updates_updated_by_fkey 
  FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================
-- SECTION 8: Admin Activity Logs - Audit Trail (SET NULL)
-- ============================================================

ALTER TABLE admin_activity_logs DROP CONSTRAINT IF EXISTS admin_activity_logs_admin_id_fkey;
ALTER TABLE admin_activity_logs ADD CONSTRAINT admin_activity_logs_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE SET NULL;

-- ============================================================
-- SECTION 9: Institution-related CASCADE
-- ============================================================

ALTER TABLE institution_members DROP CONSTRAINT IF EXISTS institution_members_invited_by_fkey;
ALTER TABLE institution_members ADD CONSTRAINT institution_members_invited_by_fkey 
  FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE institution_invites DROP CONSTRAINT IF EXISTS institution_invites_invited_by_fkey;
ALTER TABLE institution_invites ADD CONSTRAINT institution_invites_invited_by_fkey 
  FOREIGN KEY (invited_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================
-- SECTION 10: Schedule Reminders - Hierarchical CASCADE
-- ============================================================

ALTER TABLE schedule_reminders DROP CONSTRAINT IF EXISTS schedule_reminders_schedule_id_fkey;
ALTER TABLE schedule_reminders ADD CONSTRAINT schedule_reminders_schedule_id_fkey 
  FOREIGN KEY (schedule_id) REFERENCES schedule_items(id) ON DELETE CASCADE;

-- ============================================================
-- SECTION 11: Document Folder Items
-- ============================================================

ALTER TABLE document_folder_items DROP CONSTRAINT IF EXISTS document_folder_items_folder_id_fkey;
ALTER TABLE document_folder_items ADD CONSTRAINT document_folder_items_folder_id_fkey 
  FOREIGN KEY (folder_id) REFERENCES document_folders(id) ON DELETE CASCADE;

-- ============================================================
-- SECTION 12: Social Media & Comment Media
-- ============================================================

ALTER TABLE social_media DROP CONSTRAINT IF EXISTS social_media_post_id_fkey;
ALTER TABLE social_media ADD CONSTRAINT social_media_post_id_fkey 
  FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;

ALTER TABLE social_comment_media DROP CONSTRAINT IF EXISTS social_comment_media_comment_id_fkey;
ALTER TABLE social_comment_media ADD CONSTRAINT social_comment_media_comment_id_fkey 
  FOREIGN KEY (comment_id) REFERENCES social_comments(id) ON DELETE CASCADE;

ALTER TABLE social_post_hashtags DROP CONSTRAINT IF EXISTS social_post_hashtags_post_id_fkey;
ALTER TABLE social_post_hashtags ADD CONSTRAINT social_post_hashtags_post_id_fkey 
  FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;

ALTER TABLE social_post_tags DROP CONSTRAINT IF EXISTS social_post_tags_post_id_fkey;
ALTER TABLE social_post_tags ADD CONSTRAINT social_post_tags_post_id_fkey 
  FOREIGN KEY (post_id) REFERENCES social_posts(id) ON DELETE CASCADE;

-- Social chat message resources and media
ALTER TABLE social_chat_message_resources DROP CONSTRAINT IF EXISTS social_chat_message_resources_message_id_fkey;
ALTER TABLE social_chat_message_resources ADD CONSTRAINT social_chat_message_resources_message_id_fkey 
  FOREIGN KEY (message_id) REFERENCES social_chat_messages(id) ON DELETE CASCADE;

ALTER TABLE social_chat_message_media DROP CONSTRAINT IF EXISTS social_chat_message_media_message_id_fkey;
ALTER TABLE social_chat_message_media ADD CONSTRAINT social_chat_message_media_message_id_fkey 
  FOREIGN KEY (message_id) REFERENCES social_chat_messages(id) ON DELETE CASCADE;

-- ============================================================
-- Verification
-- ============================================================
-- Log completion with summary
DO $$
BEGIN
  RAISE NOTICE '[CASCADE MIGRATION] Cascade delete constraints updated successfully';
  RAISE NOTICE '[CASCADE MIGRATION] Strategy:';
  RAISE NOTICE '  - CASCADE: User content (notes, posts, quizzes, messages, etc.)';
  RAISE NOTICE '  - SET NULL: Audit trails (admin logs, error logs, who-created-what records)';
  RAISE NOTICE '[CASCADE MIGRATION] The purge_user_data() function is now simplified';
END $$;
