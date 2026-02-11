-- ============================================================================
-- Migration: Restrict Anonymous Access
-- Date: 2026-02-11
-- Purpose: 1) Change remaining TO public/anon policies to TO authenticated
--          2) Ensure no anonymous user can access database or storage
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DATABASE POLICIES
-- ============================= ===============================================

-- ---- app_stats ----
-- Previously allowed anon INSERT. Restrict to authenticated.
DROP POLICY IF EXISTS "Allow public insert of default stats row" ON public.app_stats;
CREATE POLICY "Allow authenticated insert of default stats row"
  ON public.app_stats FOR INSERT
  TO authenticated
  WITH CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid);

-- ---- audio_segments ----
-- Previously allowed public SELECT. Restrict to authenticated.
DROP POLICY IF EXISTS "Read access for audio segments" ON public.audio_segments;
CREATE POLICY "Read access for audio segments" ON public.audio_segments
  FOR SELECT
  TO authenticated  -- Changed from public to authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM ai_podcasts p
      WHERE p.id = audio_segments.podcast_id
        AND (p.is_public = true OR (auth.uid() IS NOT NULL AND p.user_id = auth.uid()))
    ))
    OR
    (auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM podcast_members pm
      WHERE pm.podcast_id = audio_segments.podcast_id
        AND pm.user_id = auth.uid()
    ))
  );

-- ---- badges ----
-- Ensure "Anyone can view badges" is restricted to authenticated
DROP POLICY IF EXISTS "Anyone can view badges" ON public.badges;
CREATE POLICY "Authenticated users can view badges" ON public.badges
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 2. STORAGE POLICIES
-- ============================================================================

-- ---- podcasts bucket ----
-- Previously allowed public SELECT (if metadata->>public = true).
-- Restrict to authenticated users ONLY.
DROP POLICY IF EXISTS "Allow select on podcasts for owners and public" ON storage.objects;
CREATE POLICY "Allow authenticated select on podcasts" ON storage.objects
  FOR SELECT
  TO authenticated  -- Restrict to authenticated
  USING (
    bucket_id = 'podcasts'
    AND (
      owner = auth.uid()
      OR (metadata->>'public') = 'true'
    )
  );

-- ---- avatars bucket ----
-- Ensure avatars are only viewable by authenticated users
-- (Note: If avatars need to be truly public for social sharing without login,
-- this should be reconsidered. Using TO authenticated for now as per plan.)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Authenticated can view avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- ---- generatedimages bucket ----
-- Ensure generated images are only viewable by authenticated users
DROP POLICY IF EXISTS "Anyone can view generated images" ON storage.objects;
CREATE POLICY "Authenticated can view generated images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'generatedimages');

COMMIT;
