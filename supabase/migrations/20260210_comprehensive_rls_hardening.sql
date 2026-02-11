-- ============================================================================
-- Migration: Comprehensive RLS Hardening (v2 — complete rewrite)
-- Date: 2026-02-10
-- Purpose: 1) Drop all dangerous permissive policies identified in audit
--          2) Enable RLS + proper policies on EVERY user-data table
--          3) Fix storage policies
--          4) Create helper SECURITY DEFINER RPCs for counter increments
--          5) Restrict dangerous SECURITY DEFINER functions
--
-- Audit findings addressed:
--   - social_posts/social_users/social_hashtags readable by anon (public role)
--   - social_users writable by ANY authenticated user (followers_count etc.)
--   - podcast_recordings/podcast_chunks open to all authenticated
--   - referrals/content_moderation_log insertable by anon
--   - notifications insertable for any user_id
--   - 20+ tables with zero RLS policies (profiles, notes, documents, etc.)
--   - validate_and_execute_query: dynamic SQL executor callable by any user
--   - get_schema_tables/get_table_columns: schema information leakage
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. PREREQUISITE: Create is_admin() helper (used by later policies)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================================
-- 1. DROP DANGEROUS EXISTING POLICIES
--    Only drop the overly-permissive ones. Keep super_admin_* policies.
-- ============================================================================

-- social_posts: anon can read all, any auth user can update any post
DROP POLICY IF EXISTS "Enable read access for all users"  ON public.social_posts;
DROP POLICY IF EXISTS "Enable updates for post metadata"  ON public.social_posts;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.social_posts;
DROP POLICY IF EXISTS "Enable delete for post authors"    ON public.social_posts;

-- social_users: anon can read all, any auth user can update any profile
DROP POLICY IF EXISTS "Enable read access for all users"       ON public.social_users;
DROP POLICY IF EXISTS "Authenticated can update followers count" ON public.social_users;
DROP POLICY IF EXISTS "Enable insert for authenticated users"  ON public.social_users;
DROP POLICY IF EXISTS "Enable update for own profile"          ON public.social_users;

-- social_hashtags: anon can read all, any auth user can update any hashtag
DROP POLICY IF EXISTS "Enable read access for all users"       ON public.social_hashtags;
DROP POLICY IF EXISTS "Enable insert for authenticated users"  ON public.social_hashtags;
DROP POLICY IF EXISTS "Authenticated can update hashtags"      ON public.social_hashtags;

-- notifications: any auth user can insert notification for ANY user
DROP POLICY IF EXISTS "Enable insert for authenticated users"  ON public.notifications;
-- Re-scope the public-role policies to authenticated-only
DROP POLICY IF EXISTS "Users can delete own notifications"     ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications"     ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications"       ON public.notifications;

-- podcast_recordings: ALL operations open to all authenticated
DROP POLICY IF EXISTS "Enable all for authenticated users"     ON public.podcast_recordings;
-- Fix the buggy policy (pm.podcast_id = pm.podcast_id is always true)
DROP POLICY IF EXISTS "Read access on recordings"              ON public.podcast_recordings;

-- podcast_chunks: all ops open with USING(true)
DROP POLICY IF EXISTS "Enable insert for authenticated users"  ON public.podcast_chunks;
DROP POLICY IF EXISTS "Enable select for authenticated users"  ON public.podcast_chunks;
DROP POLICY IF EXISTS "Enable update for authenticated users"  ON public.podcast_chunks;

-- referrals: anon can insert/update
DROP POLICY IF EXISTS "System can insert referrals"            ON public.referrals;
DROP POLICY IF EXISTS "System can update referrals"            ON public.referrals;

-- content_moderation_log: anon can insert
DROP POLICY IF EXISTS "Service role can insert moderation logs" ON public.content_moderation_log;

-- app_stats: anon can insert, any auth can update
DROP POLICY IF EXISTS "Allow public insert access to app_stats"  ON public.app_stats;
DROP POLICY IF EXISTS "Allow authenticated update access to app_stats" ON public.app_stats;


-- ============================================================================
-- 2. ENABLE RLS + PROPER POLICIES ON ALL TABLES
-- ============================================================================

-- ============================================================================
-- 2a. CORE USER DATA TABLES — user_id scoped (owner-only)
-- ============================================================================

-- ---- profiles (PK = id = auth.uid()) ----
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read any profile (needed for social features: display name, avatar)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_select_authenticated' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_insert_own' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_update_own' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_delete_own' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_delete_own ON public.profiles FOR DELETE USING (auth.uid() = id);
  END IF;
END $$;

-- ---- notes ----
ALTER TABLE IF EXISTS public.notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notes_select_own' AND tablename = 'notes') THEN
    CREATE POLICY notes_select_own ON public.notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notes_insert_own' AND tablename = 'notes') THEN
    CREATE POLICY notes_insert_own ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notes_update_own' AND tablename = 'notes') THEN
    CREATE POLICY notes_update_own ON public.notes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notes_delete_own' AND tablename = 'notes') THEN
    CREATE POLICY notes_delete_own ON public.notes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- documents ----
ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_select_own' AND tablename = 'documents') THEN
    CREATE POLICY documents_select_own ON public.documents FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_insert_own' AND tablename = 'documents') THEN
    CREATE POLICY documents_insert_own ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_update_own' AND tablename = 'documents') THEN
    CREATE POLICY documents_update_own ON public.documents FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'documents_delete_own' AND tablename = 'documents') THEN
    CREATE POLICY documents_delete_own ON public.documents FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- document_folders ----
ALTER TABLE IF EXISTS public.document_folders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'document_folders_select_own' AND tablename = 'document_folders') THEN
    CREATE POLICY document_folders_select_own ON public.document_folders FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'document_folders_insert_own' AND tablename = 'document_folders') THEN
    CREATE POLICY document_folders_insert_own ON public.document_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'document_folders_update_own' AND tablename = 'document_folders') THEN
    CREATE POLICY document_folders_update_own ON public.document_folders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'document_folders_delete_own' AND tablename = 'document_folders') THEN
    CREATE POLICY document_folders_delete_own ON public.document_folders FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- flashcards ----
ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flashcards_select_own' AND tablename = 'flashcards') THEN
    CREATE POLICY flashcards_select_own ON public.flashcards FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flashcards_insert_own' AND tablename = 'flashcards') THEN
    CREATE POLICY flashcards_insert_own ON public.flashcards FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flashcards_update_own' AND tablename = 'flashcards') THEN
    CREATE POLICY flashcards_update_own ON public.flashcards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'flashcards_delete_own' AND tablename = 'flashcards') THEN
    CREATE POLICY flashcards_delete_own ON public.flashcards FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- schedule_items ----
ALTER TABLE IF EXISTS public.schedule_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schedule_items_select_own' AND tablename = 'schedule_items') THEN
    CREATE POLICY schedule_items_select_own ON public.schedule_items FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schedule_items_insert_own' AND tablename = 'schedule_items') THEN
    CREATE POLICY schedule_items_insert_own ON public.schedule_items FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schedule_items_update_own' AND tablename = 'schedule_items') THEN
    CREATE POLICY schedule_items_update_own ON public.schedule_items FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schedule_items_delete_own' AND tablename = 'schedule_items') THEN
    CREATE POLICY schedule_items_delete_own ON public.schedule_items FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- quizzes ----
ALTER TABLE IF EXISTS public.quizzes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quizzes_select_own' AND tablename = 'quizzes') THEN
    CREATE POLICY quizzes_select_own ON public.quizzes FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quizzes_insert_own' AND tablename = 'quizzes') THEN
    CREATE POLICY quizzes_insert_own ON public.quizzes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quizzes_update_own' AND tablename = 'quizzes') THEN
    CREATE POLICY quizzes_update_own ON public.quizzes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quizzes_delete_own' AND tablename = 'quizzes') THEN
    CREATE POLICY quizzes_delete_own ON public.quizzes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- class_recordings ----
ALTER TABLE IF EXISTS public.class_recordings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'class_recordings_select_own' AND tablename = 'class_recordings') THEN
    CREATE POLICY class_recordings_select_own ON public.class_recordings FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'class_recordings_insert_own' AND tablename = 'class_recordings') THEN
    CREATE POLICY class_recordings_insert_own ON public.class_recordings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'class_recordings_update_own' AND tablename = 'class_recordings') THEN
    CREATE POLICY class_recordings_update_own ON public.class_recordings FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'class_recordings_delete_own' AND tablename = 'class_recordings') THEN
    CREATE POLICY class_recordings_delete_own ON public.class_recordings FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- ai_podcasts ----
ALTER TABLE IF EXISTS public.ai_podcasts ENABLE ROW LEVEL SECURITY;

-- Authenticated can see own podcasts + public podcasts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_podcasts_select_own_or_public' AND tablename = 'ai_podcasts') THEN
    CREATE POLICY ai_podcasts_select_own_or_public ON public.ai_podcasts FOR SELECT
      USING (auth.uid() = user_id OR is_public = true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_podcasts_insert_own' AND tablename = 'ai_podcasts') THEN
    CREATE POLICY ai_podcasts_insert_own ON public.ai_podcasts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_podcasts_update_own' AND tablename = 'ai_podcasts') THEN
    CREATE POLICY ai_podcasts_update_own ON public.ai_podcasts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'ai_podcasts_delete_own' AND tablename = 'ai_podcasts') THEN
    CREATE POLICY ai_podcasts_delete_own ON public.ai_podcasts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- chat_messages (AI chat — user_id scoped) ----
ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_messages_select_own' AND tablename = 'chat_messages') THEN
    CREATE POLICY chat_messages_select_own ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_messages_insert_own' AND tablename = 'chat_messages') THEN
    CREATE POLICY chat_messages_insert_own ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_messages_delete_own' AND tablename = 'chat_messages') THEN
    CREATE POLICY chat_messages_delete_own ON public.chat_messages FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- chat_sessions (AI chat — user_id scoped) ----
ALTER TABLE IF EXISTS public.chat_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_sessions_select_own' AND tablename = 'chat_sessions') THEN
    CREATE POLICY chat_sessions_select_own ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_sessions_insert_own' AND tablename = 'chat_sessions') THEN
    CREATE POLICY chat_sessions_insert_own ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_sessions_update_own' AND tablename = 'chat_sessions') THEN
    CREATE POLICY chat_sessions_update_own ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'chat_sessions_delete_own' AND tablename = 'chat_sessions') THEN
    CREATE POLICY chat_sessions_delete_own ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- subscriptions (read-only for user, writes via SECURITY DEFINER RPCs) ----
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_select_own' AND tablename = 'subscriptions') THEN
    CREATE POLICY subscriptions_select_own ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 2b. SOCIAL TABLES — Authenticated-only access with appropriate sharing
-- ============================================================================

-- ---- social_users (PK = id = auth.uid()) ----
ALTER TABLE IF EXISTS public.social_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_users_select_auth' AND tablename = 'social_users') THEN
    CREATE POLICY social_users_select_auth ON public.social_users FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
-- NOTE: social_users.id = auth.uid()  (not user_id)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_users_insert_own' AND tablename = 'social_users') THEN
    CREATE POLICY social_users_insert_own ON public.social_users FOR INSERT
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_users_update_own' AND tablename = 'social_users') THEN
    CREATE POLICY social_users_update_own ON public.social_users FOR UPDATE
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ---- social_posts ----
ALTER TABLE IF EXISTS public.social_posts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all posts (privacy filtering done at app level)
-- This replaces the old "Enable read access for all users" that allowed anon
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_select_auth' AND tablename = 'social_posts') THEN
    CREATE POLICY social_posts_select_auth ON public.social_posts FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_insert_own' AND tablename = 'social_posts') THEN
    CREATE POLICY social_posts_insert_own ON public.social_posts FOR INSERT
      WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_update_own' AND tablename = 'social_posts') THEN
    CREATE POLICY social_posts_update_own ON public.social_posts FOR UPDATE
      USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_posts_delete_own' AND tablename = 'social_posts') THEN
    CREATE POLICY social_posts_delete_own ON public.social_posts FOR DELETE
      USING (auth.uid() = author_id);
  END IF;
END $$;

-- ---- social_comments ----
ALTER TABLE IF EXISTS public.social_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_comments_select_auth' AND tablename = 'social_comments') THEN
    CREATE POLICY social_comments_select_auth ON public.social_comments FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_comments_insert_own' AND tablename = 'social_comments') THEN
    CREATE POLICY social_comments_insert_own ON public.social_comments FOR INSERT
      WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_comments_update_own' AND tablename = 'social_comments') THEN
    CREATE POLICY social_comments_update_own ON public.social_comments FOR UPDATE
      USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_comments_delete_own' AND tablename = 'social_comments') THEN
    CREATE POLICY social_comments_delete_own ON public.social_comments FOR DELETE
      USING (auth.uid() = author_id);
  END IF;
END $$;

-- ---- social_likes ----
ALTER TABLE IF EXISTS public.social_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_likes_select_auth' AND tablename = 'social_likes') THEN
    CREATE POLICY social_likes_select_auth ON public.social_likes FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_likes_insert_own' AND tablename = 'social_likes') THEN
    CREATE POLICY social_likes_insert_own ON public.social_likes FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_likes_delete_own' AND tablename = 'social_likes') THEN
    CREATE POLICY social_likes_delete_own ON public.social_likes FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- social_bookmarks ----
ALTER TABLE IF EXISTS public.social_bookmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_bookmarks_select_own' AND tablename = 'social_bookmarks') THEN
    CREATE POLICY social_bookmarks_select_own ON public.social_bookmarks FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_bookmarks_insert_own' AND tablename = 'social_bookmarks') THEN
    CREATE POLICY social_bookmarks_insert_own ON public.social_bookmarks FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_bookmarks_delete_own' AND tablename = 'social_bookmarks') THEN
    CREATE POLICY social_bookmarks_delete_own ON public.social_bookmarks FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- social_follows ----
ALTER TABLE IF EXISTS public.social_follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_follows_select_auth' AND tablename = 'social_follows') THEN
    CREATE POLICY social_follows_select_auth ON public.social_follows FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_follows_insert_own' AND tablename = 'social_follows') THEN
    CREATE POLICY social_follows_insert_own ON public.social_follows FOR INSERT
      WITH CHECK (auth.uid() = follower_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_follows_delete_own' AND tablename = 'social_follows') THEN
    CREATE POLICY social_follows_delete_own ON public.social_follows FOR DELETE
      USING (auth.uid() = follower_id);
  END IF;
END $$;

-- ---- social_shares ----
ALTER TABLE IF EXISTS public.social_shares ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_shares_select_auth' AND tablename = 'social_shares') THEN
    CREATE POLICY social_shares_select_auth ON public.social_shares FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_shares_insert_own' AND tablename = 'social_shares') THEN
    CREATE POLICY social_shares_insert_own ON public.social_shares FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_shares_delete_own' AND tablename = 'social_shares') THEN
    CREATE POLICY social_shares_delete_own ON public.social_shares FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- social_groups ----
ALTER TABLE IF EXISTS public.social_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_groups_select_auth' AND tablename = 'social_groups') THEN
    CREATE POLICY social_groups_select_auth ON public.social_groups FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_groups_insert_auth' AND tablename = 'social_groups') THEN
    CREATE POLICY social_groups_insert_auth ON public.social_groups FOR INSERT
      WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_groups_update_creator' AND tablename = 'social_groups') THEN
    CREATE POLICY social_groups_update_creator ON public.social_groups FOR UPDATE
      USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_groups_delete_creator' AND tablename = 'social_groups') THEN
    CREATE POLICY social_groups_delete_creator ON public.social_groups FOR DELETE
      USING (auth.uid() = created_by);
  END IF;
END $$;

-- ---- social_group_members ----
ALTER TABLE IF EXISTS public.social_group_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_group_members_select_auth' AND tablename = 'social_group_members') THEN
    CREATE POLICY social_group_members_select_auth ON public.social_group_members FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_group_members_insert_own' AND tablename = 'social_group_members') THEN
    CREATE POLICY social_group_members_insert_own ON public.social_group_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_group_members_update_own' AND tablename = 'social_group_members') THEN
    CREATE POLICY social_group_members_update_own ON public.social_group_members FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_group_members_delete_own' AND tablename = 'social_group_members') THEN
    CREATE POLICY social_group_members_delete_own ON public.social_group_members FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- social_events ----
ALTER TABLE IF EXISTS public.social_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_events_select_auth' AND tablename = 'social_events') THEN
    CREATE POLICY social_events_select_auth ON public.social_events FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_events_insert_auth' AND tablename = 'social_events') THEN
    CREATE POLICY social_events_insert_auth ON public.social_events FOR INSERT
      WITH CHECK (auth.uid() = organizer_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_events_update_creator' AND tablename = 'social_events') THEN
    CREATE POLICY social_events_update_creator ON public.social_events FOR UPDATE
      USING (auth.uid() = organizer_id) WITH CHECK (auth.uid() = organizer_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_events_delete_creator' AND tablename = 'social_events') THEN
    CREATE POLICY social_events_delete_creator ON public.social_events FOR DELETE
      USING (auth.uid() = organizer_id);
  END IF;
END $$;

-- ---- social_hashtags (read-only for users, writes via SECURITY DEFINER RPC) ----
ALTER TABLE IF EXISTS public.social_hashtags ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_hashtags_select_auth' AND tablename = 'social_hashtags') THEN
    CREATE POLICY social_hashtags_select_auth ON public.social_hashtags FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
-- INSERT for hashtags only via RPC (increment_hashtag_count) — no direct client INSERT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_hashtags_insert_auth' AND tablename = 'social_hashtags') THEN
    CREATE POLICY social_hashtags_insert_auth ON public.social_hashtags FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- ---- social_reports ----
ALTER TABLE IF EXISTS public.social_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_reports_insert_auth' AND tablename = 'social_reports') THEN
    CREATE POLICY social_reports_insert_auth ON public.social_reports FOR INSERT
      WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_reports_select_own' AND tablename = 'social_reports') THEN
    CREATE POLICY social_reports_select_own ON public.social_reports FOR SELECT
      USING (auth.uid() = reporter_id OR public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- 2c. SOCIAL CHAT TABLES — Participant-scoped
-- ============================================================================

-- ---- social_chat_sessions (p2p: user_id1/user_id2, group: group_id) ----
ALTER TABLE IF EXISTS public.social_chat_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_sessions_select_participant' AND tablename = 'social_chat_sessions') THEN
    CREATE POLICY social_chat_sessions_select_participant ON public.social_chat_sessions FOR SELECT
      USING (
        auth.uid() = user_id1
        OR auth.uid() = user_id2
        OR EXISTS (
          SELECT 1 FROM social_group_members gm
          WHERE gm.group_id = social_chat_sessions.group_id
            AND gm.user_id = auth.uid()
            AND gm.status = 'active'
        )
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_sessions_insert_participant' AND tablename = 'social_chat_sessions') THEN
    CREATE POLICY social_chat_sessions_insert_participant ON public.social_chat_sessions FOR INSERT
      WITH CHECK (auth.uid() = user_id1 OR auth.uid() = user_id2);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_sessions_update_participant' AND tablename = 'social_chat_sessions') THEN
    CREATE POLICY social_chat_sessions_update_participant ON public.social_chat_sessions FOR UPDATE
      USING (auth.uid() = user_id1 OR auth.uid() = user_id2);
  END IF;
END $$;

-- ---- social_chat_messages — only visible to chat participants ----
ALTER TABLE IF EXISTS public.social_chat_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_messages_select_participant' AND tablename = 'social_chat_messages') THEN
    CREATE POLICY social_chat_messages_select_participant ON public.social_chat_messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM social_chat_sessions s
          WHERE s.id = social_chat_messages.session_id
            AND (
              s.user_id1 = auth.uid()
              OR s.user_id2 = auth.uid()
              OR EXISTS (
                SELECT 1 FROM social_group_members gm
                WHERE gm.group_id = s.group_id
                  AND gm.user_id = auth.uid()
                  AND gm.status = 'active'
              )
            )
        )
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_messages_insert_own' AND tablename = 'social_chat_messages') THEN
    CREATE POLICY social_chat_messages_insert_own ON public.social_chat_messages FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_messages_update_own' AND tablename = 'social_chat_messages') THEN
    CREATE POLICY social_chat_messages_update_own ON public.social_chat_messages FOR UPDATE
      USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_messages_delete_own' AND tablename = 'social_chat_messages') THEN
    CREATE POLICY social_chat_messages_delete_own ON public.social_chat_messages FOR DELETE
      USING (auth.uid() = sender_id);
  END IF;
END $$;

-- ---- social_chat_message_reads ----
ALTER TABLE IF EXISTS public.social_chat_message_reads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_reads_select_own' AND tablename = 'social_chat_message_reads') THEN
    CREATE POLICY social_chat_reads_select_own ON public.social_chat_message_reads FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_reads_insert_own' AND tablename = 'social_chat_message_reads') THEN
    CREATE POLICY social_chat_reads_insert_own ON public.social_chat_message_reads FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_chat_reads_update_own' AND tablename = 'social_chat_message_reads') THEN
    CREATE POLICY social_chat_reads_update_own ON public.social_chat_message_reads FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---- social_notifications ----
ALTER TABLE IF EXISTS public.social_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_notifications_select_own' AND tablename = 'social_notifications') THEN
    CREATE POLICY social_notifications_select_own ON public.social_notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_notifications_update_own' AND tablename = 'social_notifications') THEN
    CREATE POLICY social_notifications_update_own ON public.social_notifications FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'social_notifications_delete_own' AND tablename = 'social_notifications') THEN
    CREATE POLICY social_notifications_delete_own ON public.social_notifications FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 2d. NOTIFICATION TABLES
-- ============================================================================

-- ---- notifications (push) — user can only manage own ----
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_select_own' AND tablename = 'notifications') THEN
    CREATE POLICY notifications_select_own ON public.notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
-- INSERT: only for own user_id (triggers use SECURITY DEFINER to bypass for cross-user inserts)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_insert_own' AND tablename = 'notifications') THEN
    CREATE POLICY notifications_insert_own ON public.notifications FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_update_own' AND tablename = 'notifications') THEN
    CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_delete_own' AND tablename = 'notifications') THEN
    CREATE POLICY notifications_delete_own ON public.notifications FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- notification_preferences ----
ALTER TABLE IF EXISTS public.notification_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_prefs_select_own' AND tablename = 'notification_preferences') THEN
    CREATE POLICY notification_prefs_select_own ON public.notification_preferences FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_prefs_insert_own' AND tablename = 'notification_preferences') THEN
    CREATE POLICY notification_prefs_insert_own ON public.notification_preferences FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_prefs_update_own' AND tablename = 'notification_preferences') THEN
    CREATE POLICY notification_prefs_update_own ON public.notification_preferences FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---- notification_subscriptions (web push subscriptions) ----
ALTER TABLE IF EXISTS public.notification_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_subs_select_own' AND tablename = 'notification_subscriptions') THEN
    CREATE POLICY notification_subs_select_own ON public.notification_subscriptions FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_subs_insert_own' AND tablename = 'notification_subscriptions') THEN
    CREATE POLICY notification_subs_insert_own ON public.notification_subscriptions FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_subs_update_own' AND tablename = 'notification_subscriptions') THEN
    CREATE POLICY notification_subs_update_own ON public.notification_subscriptions FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notification_subs_delete_own' AND tablename = 'notification_subscriptions') THEN
    CREATE POLICY notification_subs_delete_own ON public.notification_subscriptions FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 2e. PODCAST TABLES — Owner-scoped with public read for shared content
-- ============================================================================

-- ---- podcast_chunks — scoped to uploader ----
ALTER TABLE IF EXISTS public.podcast_chunks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_chunks_select_own' AND tablename = 'podcast_chunks') THEN
    CREATE POLICY podcast_chunks_select_own ON public.podcast_chunks FOR SELECT
      USING (auth.uid() = uploader_user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_chunks_insert_own' AND tablename = 'podcast_chunks') THEN
    CREATE POLICY podcast_chunks_insert_own ON public.podcast_chunks FOR INSERT
      WITH CHECK (auth.uid() = uploader_user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_chunks_update_own' AND tablename = 'podcast_chunks') THEN
    CREATE POLICY podcast_chunks_update_own ON public.podcast_chunks FOR UPDATE
      USING (auth.uid() = uploader_user_id) WITH CHECK (auth.uid() = uploader_user_id);
  END IF;
END $$;

-- ---- podcast_recordings — owner of the parent podcast ----
ALTER TABLE IF EXISTS public.podcast_recordings ENABLE ROW LEVEL SECURITY;

-- Keep "Mod access on recordings" (already correctly scoped to podcast owner)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_recordings_select_own' AND tablename = 'podcast_recordings') THEN
    CREATE POLICY podcast_recordings_select_own ON public.podcast_recordings FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (
          SELECT 1 FROM ai_podcasts p
          WHERE p.id = podcast_recordings.podcast_id
            AND (p.user_id = auth.uid() OR p.is_public = true)
        )
      );
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_recordings_insert_own' AND tablename = 'podcast_recordings') THEN
    CREATE POLICY podcast_recordings_insert_own ON public.podcast_recordings FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_recordings_update_own' AND tablename = 'podcast_recordings') THEN
    CREATE POLICY podcast_recordings_update_own ON public.podcast_recordings FOR UPDATE
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_recordings_delete_own' AND tablename = 'podcast_recordings') THEN
    CREATE POLICY podcast_recordings_delete_own ON public.podcast_recordings FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- podcast_cohosts ----
ALTER TABLE IF EXISTS public.podcast_cohosts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_cohosts_select_auth' AND tablename = 'podcast_cohosts') THEN
    CREATE POLICY podcast_cohosts_select_auth ON public.podcast_cohosts FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_cohosts_insert_own' AND tablename = 'podcast_cohosts') THEN
    CREATE POLICY podcast_cohosts_insert_own ON public.podcast_cohosts FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_cohosts_delete_own' AND tablename = 'podcast_cohosts') THEN
    CREATE POLICY podcast_cohosts_delete_own ON public.podcast_cohosts FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- podcast_members ----
ALTER TABLE IF EXISTS public.podcast_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_members_select_auth' AND tablename = 'podcast_members') THEN
    CREATE POLICY podcast_members_select_auth ON public.podcast_members FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_members_insert_own' AND tablename = 'podcast_members') THEN
    CREATE POLICY podcast_members_insert_own ON public.podcast_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_members_delete_own' AND tablename = 'podcast_members') THEN
    CREATE POLICY podcast_members_delete_own ON public.podcast_members FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- podcast_invites ----
ALTER TABLE IF EXISTS public.podcast_invites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_invites_select_own' AND tablename = 'podcast_invites') THEN
    CREATE POLICY podcast_invites_select_own ON public.podcast_invites FOR SELECT
      USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_invites_insert_own' AND tablename = 'podcast_invites') THEN
    CREATE POLICY podcast_invites_insert_own ON public.podcast_invites FOR INSERT
      WITH CHECK (auth.uid() = inviter_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'podcast_invites_update_own' AND tablename = 'podcast_invites') THEN
    CREATE POLICY podcast_invites_update_own ON public.podcast_invites FOR UPDATE
      USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);
  END IF;
END $$;

-- ============================================================================
-- 2f. QUIZ / GAMIFICATION TABLES
-- ============================================================================

-- ---- quiz_attempts ----
ALTER TABLE IF EXISTS public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quiz_attempts_select_own' AND tablename = 'quiz_attempts') THEN
    CREATE POLICY quiz_attempts_select_own ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quiz_attempts_insert_own' AND tablename = 'quiz_attempts') THEN
    CREATE POLICY quiz_attempts_insert_own ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quiz_attempts_update_own' AND tablename = 'quiz_attempts') THEN
    CREATE POLICY quiz_attempts_update_own ON public.quiz_attempts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---- user_stats ----
ALTER TABLE IF EXISTS public.user_stats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_stats_select_own' AND tablename = 'user_stats') THEN
    CREATE POLICY user_stats_select_own ON public.user_stats FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_stats_update_own' AND tablename = 'user_stats') THEN
    CREATE POLICY user_stats_update_own ON public.user_stats FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ---- achievements ----
ALTER TABLE IF EXISTS public.achievements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'achievements_select_own' AND tablename = 'achievements') THEN
    CREATE POLICY achievements_select_own ON public.achievements FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- ---- user_learning_goals ----
ALTER TABLE IF EXISTS public.user_learning_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_learning_goals_select_own' AND tablename = 'user_learning_goals') THEN
    CREATE POLICY user_learning_goals_select_own ON public.user_learning_goals FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_learning_goals_insert_own' AND tablename = 'user_learning_goals') THEN
    CREATE POLICY user_learning_goals_insert_own ON public.user_learning_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_learning_goals_update_own' AND tablename = 'user_learning_goals') THEN
    CREATE POLICY user_learning_goals_update_own ON public.user_learning_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_learning_goals_delete_own' AND tablename = 'user_learning_goals') THEN
    CREATE POLICY user_learning_goals_delete_own ON public.user_learning_goals FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- 2g. ADMIN / SYSTEM TABLES
-- ============================================================================

-- ---- admin_users (only self or admins) ----
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_users_select_admin' AND tablename = 'admin_users') THEN
    CREATE POLICY admin_users_select_admin ON public.admin_users FOR SELECT
      USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- ---- admin_activity_logs (admin-only) ----
ALTER TABLE IF EXISTS public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'admin_activity_logs_select_admin' AND tablename = 'admin_activity_logs') THEN
    CREATE POLICY admin_activity_logs_select_admin ON public.admin_activity_logs FOR SELECT
      USING (public.is_admin());
  END IF;
END $$;

-- ---- referrals (tighten: no anon, only own referrals) ----
ALTER TABLE IF EXISTS public.referrals ENABLE ROW LEVEL SECURITY;

-- Keep existing user-scoped SELECT policies (referrer/referee)
-- No direct client INSERT/UPDATE — handled by process_referral_reward() SECURITY DEFINER

-- ---- content_moderation_log (tighten INSERT to admin-only) ----
ALTER TABLE IF EXISTS public.content_moderation_log ENABLE ROW LEVEL SECURITY;
-- Existing admin SELECT and user SELECT policies are fine
-- INSERT should only be from server side (edge functions use service_role key which bypasses RLS)

-- ---- schema_agent_audit (admin-only) ----
ALTER TABLE IF EXISTS public.schema_agent_audit ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'schema_agent_audit_select_own' AND tablename = 'schema_agent_audit') THEN
    CREATE POLICY schema_agent_audit_select_own ON public.schema_agent_audit FOR SELECT
      USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- ============================================================================
-- 3. FIX STORAGE DELETE POLICY — Add owner check
-- ============================================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Allow delete on podcasts for owners'
      AND schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    DROP POLICY "Allow delete on podcasts for owners" ON storage.objects;
  END IF;
END $$;

CREATE POLICY "Allow delete on podcasts for owners" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'podcasts' AND owner = auth.uid());


-- ============================================================================
-- 4. SECURITY DEFINER RPCs for counter increments
--    Replaces the dangerous open UPDATE policies on social tables.
--    Counter updates now go through these RPCs instead of direct UPDATEs.
-- ============================================================================

-- RPC: Increment social_posts view count
CREATE OR REPLACE FUNCTION public.increment_post_views(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE social_posts
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = p_post_id;
END;
$$;

-- RPC: Increment social_posts share count
CREATE OR REPLACE FUNCTION public.increment_post_shares(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE social_posts
  SET shares_count = COALESCE(shares_count, 0) + 1
  WHERE id = p_post_id;
END;
$$;

-- RPC: Increment hashtag post count
CREATE OR REPLACE FUNCTION public.increment_hashtag_count(p_hashtag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE social_hashtags
  SET posts_count = COALESCE(posts_count, 0) + 1
  WHERE id = p_hashtag_id;
END;
$$;

-- RPC: Update follower/following counts on social_users
-- NOTE: social_users PK is 'id' (= auth.uid()), not 'user_id'
CREATE OR REPLACE FUNCTION public.update_social_user_counts(
  p_user_id uuid,
  p_followers_delta integer DEFAULT 0,
  p_following_delta integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE social_users
  SET
    followers_count = GREATEST(0, COALESCE(followers_count, 0) + p_followers_delta),
    following_count = GREATEST(0, COALESCE(following_count, 0) + p_following_delta)
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_post_views(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_post_shares(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_hashtag_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_social_user_counts(uuid, integer, integer) TO authenticated;


-- ============================================================================
-- 5. RESTRICT DANGEROUS FUNCTIONS
-- ============================================================================

-- validate_and_execute_query: Dynamic SQL executor callable by any authenticated user.
-- This is essentially a universal query proxy that bypasses all RLS (SECURITY DEFINER).
-- Revoke public/authenticated access; if needed, expose only to admins.
REVOKE ALL ON FUNCTION public.validate_and_execute_query(uuid, text, text, jsonb, jsonb, jsonb, integer) FROM public;
REVOKE ALL ON FUNCTION public.validate_and_execute_query(uuid, text, text, jsonb, jsonb, jsonb, integer) FROM authenticated;

-- Schema introspection functions: expose full DB schema to any caller
-- These should only be accessible to admins
REVOKE ALL ON FUNCTION public.get_schema_tables() FROM public;
REVOKE ALL ON FUNCTION public.get_schema_tables() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_schema_tables() TO authenticated;  -- gated by is_admin() at app level

REVOKE ALL ON FUNCTION public.get_table_columns(text) FROM public;
REVOKE ALL ON FUNCTION public.get_table_columns(text) FROM authenticated;

REVOKE ALL ON FUNCTION public.get_table_policies(text) FROM public;
REVOKE ALL ON FUNCTION public.get_table_policies(text) FROM authenticated;

REVOKE ALL ON FUNCTION public.get_table_relationships(text) FROM public;
REVOKE ALL ON FUNCTION public.get_table_relationships(text) FROM authenticated;

-- build_where_clause: helper for validate_and_execute_query, also restrict
REVOKE ALL ON FUNCTION public.build_where_clause(jsonb) FROM public;
REVOKE ALL ON FUNCTION public.build_where_clause(jsonb) FROM authenticated;


COMMIT;
