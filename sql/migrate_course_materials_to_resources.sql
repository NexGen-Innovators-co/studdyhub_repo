-- ============================================================
-- Bulk Migration: course_materials → course_resources
-- 
-- Copies every existing course_materials row (that has a document_id)
-- into the course_resources table as resource_type = 'document'.
-- Uses ON CONFLICT to skip rows that already exist.
--
-- Run this ONCE in Supabase SQL Editor after Phase 1 migration.
-- Date: 2026-02-09
-- ============================================================

INSERT INTO public.course_resources (
  course_id,
  resource_type,
  resource_id,
  title,
  description,
  category,
  is_required,
  created_at
)
SELECT
  cm.course_id,
  'document'            AS resource_type,
  cm.document_id        AS resource_id,
  cm.title,
  cm.description,
  cm.category,
  false                 AS is_required,
  cm.created_at
FROM public.course_materials cm
WHERE cm.document_id IS NOT NULL
ON CONFLICT (course_id, resource_type, resource_id) DO NOTHING;

-- Report how many were migrated
DO $$
DECLARE
  total_materials INT;
  total_resources INT;
BEGIN
  SELECT COUNT(*) INTO total_materials
  FROM public.course_materials WHERE document_id IS NOT NULL;

  SELECT COUNT(*) INTO total_resources
  FROM public.course_resources WHERE resource_type = 'document';

  RAISE NOTICE 'Migration complete: % course_materials rows → % document resources now exist',
    total_materials, total_resources;
END $$;
