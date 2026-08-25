-- Migration: Add lesson_json column to kid_roadmap_steps for caching full interactive lesson content
-- Date: 2026-08-16
-- Prevents repeated AI generation when a student re-opens a roadmap lesson.

ALTER TABLE public.kid_roadmap_steps
ADD COLUMN IF NOT EXISTS lesson_json text NULL;

COMMENT ON COLUMN public.kid_roadmap_steps.lesson_json IS 'Cached structured JSON for interactive lessons (paragraphs, tips, vocab, questions) preventing redundant AI generation.';
