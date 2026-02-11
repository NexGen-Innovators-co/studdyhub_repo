-- ============================================================================
-- Migration: Storage Policy Fixes for recordings, generatedimages, avatars, podcasts
-- Date: 2026-02-10
-- Purpose: Add proper RLS policies for storage buckets that are missing them
--
-- Actual upload paths discovered from codebase:
--   avatars:         public/<userId>/<timestamp>.ext   (client: UserSettings.tsx)
--   recordings:      <userId>/<timestamp>_<filename>   (client: useStreamingUpload.ts)
--   generatedimages: <userId>/<filename>               (edge: generate-image-from-text, service_role)
--   podcasts:        live-podcasts/<podcastId>/...      (edge: upload-podcast-chunk, service_role)
--                    live-podcasts/<podcastId>_<ts>.webm (client: podcastLiveService.ts)
--                    temp-transcription/<ts>.webm        (client: transcriptionService.ts)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. AVATARS BUCKET — Add UPDATE & DELETE with correct path check
--    Actual path: public/<userId>/<timestamp>.ext
--    foldername[1] = 'public', foldername[2] = <userId>
--    Existing policies: SELECT (all authenticated), INSERT (all authenticated, no folder check)
-- ============================================================================

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );


-- ============================================================================
-- 2. RECORDINGS BUCKET — Full CRUD for owners
--    Actual path: <userId>/<timestamp>_<filename>
--    foldername[1] = <userId>
-- ============================================================================

-- Users can view their own recordings
CREATE POLICY "Users can view their own recordings"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can upload their own recordings
CREATE POLICY "Users can upload their own recordings"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own recordings
CREATE POLICY "Users can update their own recordings"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own recordings
CREATE POLICY "Users can delete their own recordings"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 3. GENERATEDIMAGES BUCKET — User-scoped CRUD
--    Actual path: <userId>/<filename>
--    foldername[1] = <userId>
--    NOTE: Edge function uses service_role (bypasses RLS). These policies are
--    defense-in-depth for any future client-side access.
-- ============================================================================

-- Users can view their own generated images
CREATE POLICY "Users can view their own generated images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'generatedimages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can upload their own generated images
CREATE POLICY "Users can upload their own generated images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generatedimages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own generated images
CREATE POLICY "Users can update their own generated images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'generatedimages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'generatedimages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own generated images
CREATE POLICY "Users can delete their own generated images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'generatedimages'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================================
-- 4. PODCASTS BUCKET — Fix client-side upload paths
--    Edge functions (upload-podcast-chunk, complete-podcast-chunks) use service_role
--    and bypass RLS. But two client-side paths exist:
--      a) podcastLiveService.ts: live-podcasts/<podcastId>_<ts>.webm
--      b) transcriptionService.ts: temp-transcription/<ts>.webm
--    After the cleanup migration, the remaining good policies are:
--      - "Allow select on podcasts for owners and public" (owner OR metadata.public)
--      - "Allow authenticated uploads to podcasts" (folder check: live-podcasts)
--      - "Allow update on podcasts for owners" (owner check)
--      - "Allow delete on podcasts for owners" (owner check — from hardening migration)
--      - "Users can upload their own podcast audio" (folder: live-podcasts)
--    These cover the client paths. No additional policies needed for podcasts.
-- ============================================================================
-- (No changes needed — existing policies + service_role edge functions cover all paths)


COMMIT;
