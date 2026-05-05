-- Migration: Ensure deleting a user cascades into all child tables that should follow
-- Date: 2026-03-18
-- Purpose: Prevent foreign key failures when deleting users by enforcing ON DELETE CASCADE

-- Note: This is intentionally broad; it mirrors the intended "DELETE CASCADE" behavior
-- from USER_DELETION_FOREIGN_KEY_REFERENCE.md for tables that should not block user deletion.

-- Achievements
ALTER TABLE public.achievements
  DROP CONSTRAINT IF EXISTS achievements_user_id_fkey;
ALTER TABLE public.achievements
  ADD CONSTRAINT achievements_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Admin Users
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_user_id_fkey;
ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- AI Podcasts
ALTER TABLE public.ai_podcasts
  DROP CONSTRAINT IF EXISTS ai_podcasts_user_id_fkey;
ALTER TABLE public.ai_podcasts
  ADD CONSTRAINT ai_podcasts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- AI User Memory
ALTER TABLE public.ai_user_memory
  DROP CONSTRAINT IF EXISTS ai_user_memory_user_id_fkey;
ALTER TABLE public.ai_user_memory
  ADD CONSTRAINT ai_user_memory_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- App Ratings
ALTER TABLE public.app_ratings
  DROP CONSTRAINT IF EXISTS app_ratings_user_id_fkey;
ALTER TABLE public.app_ratings
  ADD CONSTRAINT app_ratings_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- App Testimonials
ALTER TABLE public.app_testimonials
  DROP CONSTRAINT IF EXISTS app_testimonials_user_id_fkey;
ALTER TABLE public.app_testimonials
  ADD CONSTRAINT app_testimonials_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Audio Processing Results (reapply to ensure it stays cascade)
ALTER TABLE public.audio_processing_results
  DROP CONSTRAINT IF EXISTS audio_processing_results_user_id_fkey;
ALTER TABLE public.audio_processing_results
  ADD CONSTRAINT audio_processing_results_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Calendar Integrations
ALTER TABLE public.calendar_integrations
  DROP CONSTRAINT IF EXISTS calendar_integrations_user_id_fkey;
ALTER TABLE public.calendar_integrations
  ADD CONSTRAINT calendar_integrations_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Content Moderation Log
ALTER TABLE public.content_moderation_log
  DROP CONSTRAINT IF EXISTS content_moderation_log_user_id_fkey;
ALTER TABLE public.content_moderation_log
  ADD CONSTRAINT content_moderation_log_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Content Moderation Queue
ALTER TABLE public.content_moderation_queue
  DROP CONSTRAINT IF EXISTS content_moderation_queue_reported_by_fkey;
ALTER TABLE public.content_moderation_queue
  ADD CONSTRAINT content_moderation_queue_reported_by_fkey
  FOREIGN KEY (reported_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Daily Notification Log (already cascade, but keep idempotent)
ALTER TABLE public.daily_notification_log
  DROP CONSTRAINT IF EXISTS daily_notification_log_user_id_fkey;
ALTER TABLE public.daily_notification_log
  ADD CONSTRAINT daily_notification_log_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Document Folders
ALTER TABLE public.document_folders
  DROP CONSTRAINT IF EXISTS document_folders_user_id_fkey;
ALTER TABLE public.document_folders
  ADD CONSTRAINT document_folders_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Flashcards
ALTER TABLE public.flashcards
  DROP CONSTRAINT IF EXISTS flashcards_user_id_fkey;
ALTER TABLE public.flashcards
  ADD CONSTRAINT flashcards_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Institution Invites
ALTER TABLE public.institution_invites
  DROP CONSTRAINT IF EXISTS institution_invites_invited_by_fkey;
ALTER TABLE public.institution_invites
  ADD CONSTRAINT institution_invites_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Institution Members
ALTER TABLE public.institution_members
  DROP CONSTRAINT IF EXISTS institution_members_user_id_fkey;
ALTER TABLE public.institution_members
  ADD CONSTRAINT institution_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.institution_members
  DROP CONSTRAINT IF EXISTS institution_members_invited_by_fkey;
ALTER TABLE public.institution_members
  ADD CONSTRAINT institution_members_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Learning Topic Connections
ALTER TABLE public.learning_topic_connections
  DROP CONSTRAINT IF EXISTS learning_topic_connections_user_id_fkey;
ALTER TABLE public.learning_topic_connections
  ADD CONSTRAINT learning_topic_connections_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Live Quiz Answers
ALTER TABLE public.live_quiz_answers
  DROP CONSTRAINT IF EXISTS live_quiz_answers_user_id_fkey;
ALTER TABLE public.live_quiz_answers
  ADD CONSTRAINT live_quiz_answers_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Live Quiz Players
ALTER TABLE public.live_quiz_players
  DROP CONSTRAINT IF EXISTS live_quiz_players_user_id_fkey;
ALTER TABLE public.live_quiz_players
  ADD CONSTRAINT live_quiz_players_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Live Quiz Sessions (host_user_id)
ALTER TABLE public.live_quiz_sessions
  DROP CONSTRAINT IF EXISTS live_quiz_sessions_host_user_id_fkey;
ALTER TABLE public.live_quiz_sessions
  ADD CONSTRAINT live_quiz_sessions_host_user_id_fkey
  FOREIGN KEY (host_user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Notification Preferences
ALTER TABLE public.notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
ALTER TABLE public.notification_preferences
  ADD CONSTRAINT notification_preferences_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Notification Subscriptions
ALTER TABLE public.notification_subscriptions
  DROP CONSTRAINT IF EXISTS notification_subscriptions_user_id_fkey;
ALTER TABLE public.notification_subscriptions
  ADD CONSTRAINT notification_subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Notifications
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Platform Update Reads
ALTER TABLE public.platform_update_reads
  DROP CONSTRAINT IF EXISTS platform_update_reads_user_id_fkey;
ALTER TABLE public.platform_update_reads
  ADD CONSTRAINT platform_update_reads_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Podcast Credits
ALTER TABLE public.podcast_credits
  DROP CONSTRAINT IF EXISTS podcast_credits_user_id_fkey;
ALTER TABLE public.podcast_credits
  ADD CONSTRAINT podcast_credits_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Podcast Credit Transactions
ALTER TABLE public.podcast_credit_transactions
  DROP CONSTRAINT IF EXISTS podcast_credit_transactions_user_id_fkey;
ALTER TABLE public.podcast_credit_transactions
  ADD CONSTRAINT podcast_credit_transactions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Podcast Listeners
ALTER TABLE public.podcast_listeners
  DROP CONSTRAINT IF EXISTS podcast_listeners_user_id_fkey;
ALTER TABLE public.podcast_listeners
  ADD CONSTRAINT podcast_listeners_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Podcast Members
ALTER TABLE public.podcast_members
  DROP CONSTRAINT IF EXISTS podcast_members_user_id_fkey;
ALTER TABLE public.podcast_members
  ADD CONSTRAINT podcast_members_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Podcast Shares
ALTER TABLE public.podcast_shares
  DROP CONSTRAINT IF EXISTS podcast_shares_user_id_fkey;
ALTER TABLE public.podcast_shares
  ADD CONSTRAINT podcast_shares_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Profiles (primary user record in social subsystem)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Quiz Attempts
ALTER TABLE public.quiz_attempts
  DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;
ALTER TABLE public.quiz_attempts
  ADD CONSTRAINT quiz_attempts_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Role Verification Requests
ALTER TABLE public.role_verification_requests
  DROP CONSTRAINT IF EXISTS role_verification_requests_user_id_fkey;
ALTER TABLE public.role_verification_requests
  ADD CONSTRAINT role_verification_requests_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Schema Agent Audit
ALTER TABLE public.schema_agent_audit
  DROP CONSTRAINT IF EXISTS schema_agent_audit_user_id_fkey;
ALTER TABLE public.schema_agent_audit
  ADD CONSTRAINT schema_agent_audit_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Social Users (profile table for social layer)
ALTER TABLE public.social_users
  DROP CONSTRAINT IF EXISTS social_users_id_fkey;
ALTER TABLE public.social_users
  ADD CONSTRAINT social_users_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Social Post Views
ALTER TABLE public.social_post_views
  DROP CONSTRAINT IF EXISTS social_post_views_user_id_fkey;
ALTER TABLE public.social_post_views
  ADD CONSTRAINT social_post_views_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Subscriptions
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- User Activity Tracking
ALTER TABLE public.user_activity_tracking
  DROP CONSTRAINT IF EXISTS user_activity_tracking_user_id_fkey;
ALTER TABLE public.user_activity_tracking
  ADD CONSTRAINT user_activity_tracking_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- User Education Profiles
ALTER TABLE public.user_education_profiles
  DROP CONSTRAINT IF EXISTS user_education_profiles_user_id_fkey;
ALTER TABLE public.user_education_profiles
  ADD CONSTRAINT user_education_profiles_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- User Learning Goals
ALTER TABLE public.user_learning_goals
  DROP CONSTRAINT IF EXISTS user_learning_goals_user_id_fkey;
ALTER TABLE public.user_learning_goals
  ADD CONSTRAINT user_learning_goals_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- User Stats
ALTER TABLE public.user_stats
  DROP CONSTRAINT IF EXISTS user_stats_user_id_fkey;
ALTER TABLE public.user_stats
  ADD CONSTRAINT user_stats_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
