-- ============================================================================
-- Migration: RLS Cleanup & Critical Security Fixes
-- Date: 2026-02-10
-- Purpose: Clean up duplicate policies, fix critical security bugs, remove dead code
--
-- Based on audit of all_rls_triggers_func.json
--
-- CRITICAL BUGS FIXED:
--   1. audio_segments SELECT: self-join bug (pm.podcast_id = pm.podcast_id)
--      -> Always TRUE, leaks ALL audio segments to ANY podcast member
--   2. social-media storage: "Allow all operations" for any authenticated user
--      -> Any user can DELETE/UPDATE anyone's social media files
--   3. documents storage: DELETE/UPDATE have no owner check
--      -> Any authenticated user can delete/modify anyone's documents
--   4. podcasts storage: UPDATE has no owner check
--      -> Any authenticated user can overwrite anyone's podcast files
--   5. podcasts storage: DELETE only checks folder name, not owner
--      -> Any authenticated user can delete any live podcast
--   6. podcasts storage: SELECT allows public read of ALL files
--      -> Bypasses the owner/metadata check policy
--
-- DUPLICATES REMOVED: ~30 policies (old verbose names replaced by new
--   tablename_operation_scope convention from hardening migration)
--
-- DEAD CODE REMOVED:
--   - badges: service_role policies (service_role bypasses RLS entirely)
--   - badges: redundant "Authenticated users can view" (already has USING(true))
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP DUPLICATE TABLE POLICIES
--    Keep the new well-named policies (tablename_operation_scope pattern).
--    Drop old verbose-named duplicates doing the same thing.
-- ============================================================================

-- ---- achievements ----
-- Keep: "Users can insert own achievements" (INSERT, only one)
-- Keep: "achievements_select_own" (SELECT, new)
-- Drop: "Users can view own achievements" (SELECT, old duplicate)
DROP POLICY IF EXISTS "Users can view own achievements" ON public.achievements;

-- ---- admin_activity_logs ----
-- Keep: "admin_activity_logs_select_admin" (SELECT, uses is_admin() — 0 args, new)
-- Drop: "Admins can view activity logs" (SELECT, uses is_admin(auth.uid()) — 1 arg, old)
DROP POLICY IF EXISTS "Admins can view activity logs" ON public.admin_activity_logs;

-- ---- ai_podcasts ----
-- Keep: ai_podcasts_select_own_or_public, ai_podcasts_insert_own,
--       ai_podcasts_update_own, ai_podcasts_delete_own (new)
-- Keep: "Admins can manage all podcasts", "Anyone can view public podcasts" (unique)
-- Keep: super_admin_delete/select_ai_podcasts
-- Drop all old duplicates:
DROP POLICY IF EXISTS "Delete access on ai_podcasts"       ON public.ai_podcasts;
DROP POLICY IF EXISTS "Insert access on ai_podcasts"       ON public.ai_podcasts;
DROP POLICY IF EXISTS "Update access on ai_podcasts"       ON public.ai_podcasts;
DROP POLICY IF EXISTS "Users can update own podcasts"       ON public.ai_podcasts;
DROP POLICY IF EXISTS "Users can view accessible podcasts"  ON public.ai_podcasts;

-- ---- chat_messages ----
-- Keep: chat_messages_insert_own, chat_messages_select_own,
--       chat_messages_delete_own (new)
-- Keep: "Enable update for users" (UPDATE, only non-super_admin UPDATE policy)
-- Keep: all super_admin_* policies
-- Drop old duplicates:
DROP POLICY IF EXISTS "Enable insert for users"     ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view own messages"   ON public.chat_messages;

-- ---- chat_sessions ----
-- Keep: chat_sessions_insert_own, chat_sessions_select_own,
--       chat_sessions_update_own, chat_sessions_delete_own (new, all have WITH CHECK)
-- Keep: all super_admin_* policies
-- Drop old duplicates (some missing WITH CHECK on UPDATE):
DROP POLICY IF EXISTS "Users can create their own chat sessions"  ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete their own chat sessions"  ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update their own chat sessions"  ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can view their own chat sessions"    ON public.chat_sessions;

-- ---- class_recordings ----
-- Keep: class_recordings_insert_own, class_recordings_select_own,
--       class_recordings_update_own, class_recordings_delete_own (new)
-- Keep: "Allow read for owners and shared recordings via chat" (unique complex policy)
-- Keep: all super_admin_* policies
-- Drop old duplicates:
DROP POLICY IF EXISTS "Users can create own recordings"  ON public.class_recordings;
DROP POLICY IF EXISTS "Users can delete own recordings"  ON public.class_recordings;
DROP POLICY IF EXISTS "Users can update own recordings"  ON public.class_recordings;
DROP POLICY IF EXISTS "Users can view own recordings"    ON public.class_recordings;


-- ============================================================================
-- 2. FIX CRITICAL BUG: audio_segments SELECT self-join
--    The existing policy has:  pm.podcast_id = pm.podcast_id  (ALWAYS TRUE)
--    This means ANY authenticated podcast member can see ALL audio segments.
-- ============================================================================

-- Drop the buggy policy
DROP POLICY IF EXISTS "Read access for audio segments" ON public.audio_segments;

-- Re-create with correct join: pm.podcast_id = audio_segments.podcast_id
CREATE POLICY "Read access for audio segments" ON public.audio_segments
  FOR SELECT
  TO public
  USING (
    (EXISTS (
      SELECT 1 FROM ai_podcasts p
      WHERE p.id = audio_segments.podcast_id
        AND (p.is_public = true OR (auth.uid() IS NOT NULL AND p.user_id = auth.uid()))
    ))
    OR
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM podcast_members pm
      WHERE pm.podcast_id = audio_segments.podcast_id  -- FIXED: was pm.podcast_id = pm.podcast_id
        AND pm.user_id = auth.uid()
    ))
  );


-- ============================================================================
-- 3. REMOVE DEAD CODE: badges service_role policies
--    service_role bypasses RLS entirely, so these policies never gate anything.
--    Also remove redundant SELECT (already has USING(true)).
-- ============================================================================

DROP POLICY IF EXISTS "Service role can delete badges" ON public.badges;
DROP POLICY IF EXISTS "Service role can insert badges" ON public.badges;
DROP POLICY IF EXISTS "Service role can update badges" ON public.badges;
DROP POLICY IF EXISTS "Authenticated users can view badges" ON public.badges;
-- Remaining: "Anyone can view badges" USING(true) — sufficient


-- ============================================================================
-- 4. FIX CRITICAL STORAGE POLICY BUGS
-- ============================================================================

-- ---- 4a. social-media bucket ----
-- BUG: "Allow all operations for authenticated users" lets ANY user DELETE/UPDATE
-- anyone's files. The proper per-operation policies already exist.
DROP POLICY IF EXISTS "Allow all operations for authenticated users"
  ON storage.objects;

-- Also drop the overly-permissive INSERT (no owner check).
-- Keep "Users can upload to social-media" which has auth.uid() = owner check.
DROP POLICY IF EXISTS "Authenticated users can upload"
  ON storage.objects;

-- ---- 4b. documents bucket ----
-- BUG: DELETE/UPDATE/INSERT policies have no owner check (only auth.uid() IS NOT NULL).
-- Proper folder-scoped policies already exist. Drop the dangerous ones.
DROP POLICY IF EXISTS "Allow authenticated deletes from documents bucket"
  ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to documents bucket"
  ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to documents bucket"
  ON storage.objects;

-- BUG: "Allow public reads from documents bucket" allows reading ALL docs.
-- The "Allow read on shared document files" policy properly checks ownership/sharing.
DROP POLICY IF EXISTS "Allow public reads from documents bucket"
  ON storage.objects;

-- ---- 4c. podcasts bucket ----
-- BUG: UPDATE has no owner check — any authenticated user can overwrite any file
DROP POLICY IF EXISTS "Users can update their own podcast audio"
  ON storage.objects;

-- BUG: DELETE only checks folder name, not owner
DROP POLICY IF EXISTS "Users can delete their own podcast audio"
  ON storage.objects;

-- BUG: "Public can view podcast audio" is USING(bucket_id='podcasts') with no
-- owner/public check. Supersedes the proper owner/metadata check policy.
DROP POLICY IF EXISTS "Public can view podcast audio"
  ON storage.objects;

-- The following GOOD policies remain:
--   "Allow select on podcasts for owners and public" (owner OR metadata.public)
--   "Allow authenticated uploads to podcasts" (folder check)
--   "Allow update on podcasts for owners" (owner check)
--   "Allow delete on podcasts for owners" (owner check)
--   "Users can upload their own podcast audio" (live-podcasts folder)


-- ============================================================================
-- 5. VERIFICATION QUERY (run after migration to confirm cleanup)
-- ============================================================================
-- After applying this migration, run:
--
--   SELECT tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, cmd;
--
-- Expected: No more duplicate policy names per table/operation.
-- ============================================================================

COMMIT;
