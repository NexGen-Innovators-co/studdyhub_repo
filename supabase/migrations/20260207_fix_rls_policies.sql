-- Migration: Fix rls_policy_always_true warnings
-- Date: 2026-02-07
-- Description: Tightens overly permissive RLS policies flagged by the Supabase
--              linter as having USING(true) or WITH CHECK(true).
--
-- APPROACH:
--   • Policies that CAN be safely tightened are replaced with proper checks.
--   • Policies that CANNOT be tightened (because INVOKER triggers or counter
--     updates depend on them) are marked as intentional with explanations.
--
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy
--
-- =============================  IMPORTANT  ==================================
-- Run the function search_path migration (20260207_fix_function_search_path.sql)
-- FIRST, then run this file. Both are idempotent (DROP IF EXISTS + CREATE).
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. app_stats — single-row global counter (PK = 00000000-...0001)
-- ============================================================================
-- Table has NO user_id column. LandingPage.tsx reads/inserts the default row.
-- The trg_update_app_stats_on_profiles trigger updates counters.

-- INSERT: was TO public WITH CHECK (true) — ANY anon user could insert rows.
-- Fix: constrain to the one known stats row.
DROP POLICY IF EXISTS "Allow public insert access to app_stats" ON public.app_stats;
CREATE POLICY "Allow public insert of default stats row"
  ON public.app_stats FOR INSERT
  TO public
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);

-- UPDATE: was TO authenticated USING (true) — any user could update any column.
-- Fix: constrain to the one known stats row (trigger still works because
-- update_app_stats_function() is SECURITY DEFINER and bypasses RLS).
DROP POLICY IF EXISTS "Allow authenticated update access to app_stats" ON public.app_stats;
CREATE POLICY "Allow authenticated update of stats row"
  ON public.app_stats FOR UPDATE
  TO authenticated
  USING  (id = '00000000-0000-0000-0000-000000000001'::uuid)
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);


-- ============================================================================
-- 2. content_moderation_log — only edge functions (service_role) write
-- ============================================================================
-- Edge functions use SUPABASE_SERVICE_ROLE_KEY → bypass RLS entirely.
-- Block any direct client INSERT by using WITH CHECK (false).
DROP POLICY IF EXISTS "Service role can insert moderation logs" ON public.content_moderation_log;
CREATE POLICY "Block client inserts on moderation logs"
  ON public.content_moderation_log FOR INSERT
  TO authenticated
  WITH CHECK (false);
-- service_role still inserts freely (it bypasses RLS).


-- ============================================================================
-- 3. live_quiz_players — only insert yourself as a player
-- ============================================================================
-- Column: user_id (uuid, NOT NULL).
-- Edge function (service_role) handles most joins; if the client ever
-- inserts directly it must be for its own user_id.
DROP POLICY IF EXISTS "Anyone can join as player" ON public.live_quiz_players;
CREATE POLICY "Authenticated can join as own player"
  ON public.live_quiz_players FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- 4. live_quiz_questions — only the session host can add questions
-- ============================================================================
-- No user_id column; questions belong to a session.
-- Edge function (service_role) inserts questions and bypasses RLS.
-- Client: only the quiz host should be able to insert from the browser.
DROP POLICY IF EXISTS "System can create questions" ON public.live_quiz_questions;
CREATE POLICY "Host can create questions"
  ON public.live_quiz_questions FOR INSERT
  TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM public.live_quiz_sessions s
      WHERE s.host_user_id = auth.uid()
    )
  );


-- ============================================================================
-- 5. live_quiz_sessions — only create sessions where you are the host
-- ============================================================================
-- Column: host_user_id (uuid, NOT NULL).
DROP POLICY IF EXISTS "Anyone can create sessions" ON public.live_quiz_sessions;
CREATE POLICY "Authenticated can create own sessions"
  ON public.live_quiz_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_user_id);


-- ============================================================================
-- 6. notifications INSERT — *** INTENTIONALLY KEPT PERMISSIVE ***
-- ============================================================================
-- 7 SECURITY INVOKER trigger functions insert notifications for OTHER users:
--   notify_chat_message, notify_group_message, notify_new_follower,
--   notify_post_share, notify_post_mention, notify_comment_mention,
--   notify_group_invite.
-- Because they are INVOKER, they run as the acting user (auth.uid() ≠ target
-- user_id). Restricting to auth.uid() = user_id would BREAK these triggers.
--
-- SECURITY DEFINER trigger functions (handle_new_comment_notification,
-- handle_new_like_notification, etc.) bypass RLS and are unaffected.
--
-- Client also inserts calendar/push reminders for self (pushNotificationService.ts).
--
-- TODO (future): Convert the 7 INVOKER triggers above to SECURITY DEFINER,
--                then tighten this to WITH CHECK (auth.uid() = user_id).
--
-- KEEPING AS-IS — accept linter warning.
-- (No DROP/CREATE needed; policy "Enable insert for authenticated users" stays.)


-- ============================================================================
-- 7. podcast_chunks — only edge functions write; block/restrict client access
-- ============================================================================
-- Column: uploader_user_id (uuid, NULLABLE).
-- Edge functions use service_role → bypass RLS.
-- Client never touches this table directly.

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.podcast_chunks;
CREATE POLICY "Uploader can insert podcast chunks"
  ON public.podcast_chunks FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploader_user_id
    OR uploader_user_id IS NULL  -- edge function may leave NULL initially
  );

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.podcast_chunks;
CREATE POLICY "Uploader can update podcast chunks"
  ON public.podcast_chunks FOR UPDATE
  TO authenticated
  USING  (auth.uid() = uploader_user_id OR uploader_user_id IS NULL)
  WITH CHECK (auth.uid() = uploader_user_id OR uploader_user_id IS NULL);


-- ============================================================================
-- 8. podcast_recordings — replace blanket ALL with ownership checks
-- ============================================================================
-- Column: user_id (uuid, NULLABLE).
-- Existing policies that remain untouched:
--   • "Mod access on recordings" — ALL, checks podcast ownership via ai_podcasts
--   • "Read access on recordings" — SELECT for published/member podcasts
-- The blanket "Enable all" is replaced with ownership-aware checks.

DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.podcast_recordings;
CREATE POLICY "Owner can manage own recordings"
  ON public.podcast_recordings FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.ai_podcasts p
      WHERE p.id = podcast_recordings.podcast_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.ai_podcasts p
      WHERE p.id = podcast_recordings.podcast_id
        AND p.user_id = auth.uid()
    )
  );


-- ============================================================================
-- 9. referrals — only process_referral_reward (DEFINER) writes; block clients
-- ============================================================================
-- process_referral_reward(uuid, text) is SECURITY DEFINER → bypasses RLS.
-- Client only does SELECT (to show referral status).
DROP POLICY IF EXISTS "System can insert referrals" ON public.referrals;
CREATE POLICY "Block client inserts on referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "System can update referrals" ON public.referrals;
CREATE POLICY "Block client updates on referrals"
  ON public.referrals FOR UPDATE
  TO authenticated
  USING  (false)
  WITH CHECK (false);


-- ============================================================================
-- 10. social_hashtags UPDATE — *** INTENTIONALLY KEPT PERMISSIVE ***
-- ============================================================================
-- Hashtags have no owner column; posts_count is incremented by ANY user who
-- creates a post with that hashtag. useSocialActions.ts does .upsert({ name }).
-- There is no meaningful ownership check possible on a shared counter table.
--
-- TODO (future): Move hashtag upserts to a SECURITY DEFINER function, then
--                tighten or remove this policy.
--
-- KEEPING AS-IS — accept linter warning.


-- ============================================================================
-- 11. social_posts UPDATE — *** INTENTIONALLY KEPT PERMISSIVE ***
-- ============================================================================
-- USING(true) is required because ANY authenticated user can update counters:
--   • useSocialPostViews.ts increments views_count on viewed posts
--   • useSocialActions.ts increments shares_count on shared posts
-- The existing WITH CHECK already constrains what non-authors can modify
-- (only counter columns).
--
-- TODO (future): Move counter increments to SECURITY DEFINER RPCs, then
--                tighten USING to auth.uid() = author_id.
--
-- KEEPING AS-IS — accept linter warning.


-- ============================================================================
-- 12. social_users "Authenticated can update followers count"
--     *** INTENTIONALLY KEPT PERMISSIVE ***
-- ============================================================================
-- INVOKER trigger functions (on social_follows INSERT/DELETE) update
-- followers_count and following_count on OTHER users' rows.
-- e.g. When user A follows user B, the trigger increments user B's
-- followers_count — running as user A (INVOKER), so auth.uid() ≠ B.
--
-- The separate "Enable update for own profile" policy (USING auth.uid() = id)
-- already covers users editing their own profile fields.
--
-- TODO (future): Convert follow-count triggers to SECURITY DEFINER,
--                then drop this policy entirely.
--
-- KEEPING AS-IS — accept linter warning.


COMMIT;

-- ============================================================================
-- NON-SQL FIXES (require Supabase Dashboard actions)
-- ============================================================================
--
-- 13. auth_leaked_password_protection
--     Dashboard → Authentication → Settings → Enable "Leaked Password Protection"
--     Reference: https://supabase.com/docs/guides/database/database-linter?lint=0023_auth_leaked_password_protection
--
-- 14. vulnerable_postgres_version (17.4.1.048)
--     Dashboard → Settings → Infrastructure → Restart Server
--     (or wait for Supabase to auto-upgrade; no data loss on restart)
--     Reference: https://supabase.com/docs/guides/database/database-linter?lint=0025_vulnerable_postgres_version
--
-- 15. pg_net extension in public schema
--     The linter suggests moving pg_net from public to extensions schema.
--     This is SAFE ONLY IF send_push_notification() and any other functions
--     using net.http_post() are updated. Since net.* calls already use the
--     net schema prefix (not public.), moving the extension should be fine,
--     but TEST IN STAGING FIRST:
--
--     ALTER EXTENSION pg_net SET SCHEMA extensions;
--
