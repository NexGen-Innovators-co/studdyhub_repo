-- Migration: mark documents attached to courses as public
-- Date: 2026-01-24

-- This migration is non-destructive. It will:
-- 1) Ensure the `is_public` column exists (safe default false).
-- 2) Update any documents referenced by `course_materials` to `is_public = true`.

BEGIN;

-- 1) Add `is_public` column if missing
ALTER TABLE IF EXISTS public.documents
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 2) Mark documents linked to course_materials as public
UPDATE public.documents d
SET is_public = true
FROM public.course_materials cm
WHERE cm.document_id = d.id
  AND d.is_public = false;

COMMIT;

-- Note: This migration only flips the `is_public` flag on documents that are
-- currently not public and are referenced by `course_materials`.
-- If you previously applied policies that depend on `is_public`, this
-- makes course-attached documents visible to public SELECT policies.
