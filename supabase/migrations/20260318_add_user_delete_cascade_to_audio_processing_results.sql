-- Migration: Ensure user deletion cascades to audio_processing_results
-- Date: 2026-03-18

-- Drop the existing FK constraint (if present) and recreate with ON DELETE CASCADE
ALTER TABLE public.audio_processing_results
  DROP CONSTRAINT IF EXISTS audio_processing_results_user_id_fkey;

ALTER TABLE public.audio_processing_results
  ADD CONSTRAINT audio_processing_results_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
