-- Expand quizzes_source_type_check to allow values the AI planner emits.
-- Currently allowed: recording, notes, ai, live_custom
-- Adding: manual, generated, imported, cram_sheet, ai_generated
ALTER TABLE public.quizzes
  DROP CONSTRAINT IF EXISTS quizzes_source_type_check;

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_source_type_check CHECK (
    source_type = ANY (
      ARRAY[
        'recording'::text,
        'notes'::text,
        'ai'::text,
        'live_custom'::text,
        'manual'::text,
        'generated'::text,
        'imported'::text,
        'cram_sheet'::text,
        'ai_generated'::text
      ]
    )
  );
