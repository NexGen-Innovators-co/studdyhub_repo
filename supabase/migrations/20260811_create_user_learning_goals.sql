-- Migration: Create user_learning_goals table for the AI goal-setting flow
-- Date: 2026-08-11
-- The gemini-chat planner targets this table when the user asks to create or
-- track learning goals ("create the goals..."). RLS + own-row policies mirror
-- the repo convention (see 20260210_comprehensive_rls_hardening.sql).

CREATE TABLE IF NOT EXISTS public.user_learning_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_text text NOT NULL,
  target_date timestamp with time zone NULL,
  progress integer NULL DEFAULT 0,
  category text NULL DEFAULT 'general'::text,
  is_completed boolean NULL DEFAULT false,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT user_learning_goals_pkey PRIMARY KEY (id),
  CONSTRAINT user_learning_goals_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT user_learning_goals_progress_check CHECK (
    (progress >= 0) AND (progress <= 100)
  )
);

-- The planner filters by user_id on nearly every query.
CREATE INDEX IF NOT EXISTS idx_user_learning_goals_user_id
  ON public.user_learning_goals (user_id);

ALTER TABLE public.user_learning_goals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_learning_goals'
      AND policyname = 'user_learning_goals_select_own'
  ) THEN
    CREATE POLICY user_learning_goals_select_own
      ON public.user_learning_goals
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_learning_goals'
      AND policyname = 'user_learning_goals_insert_own'
  ) THEN
    CREATE POLICY user_learning_goals_insert_own
      ON public.user_learning_goals
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_learning_goals'
      AND policyname = 'user_learning_goals_update_own'
  ) THEN
    CREATE POLICY user_learning_goals_update_own
      ON public.user_learning_goals
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_learning_goals'
      AND policyname = 'user_learning_goals_delete_own'
  ) THEN
    CREATE POLICY user_learning_goals_delete_own
      ON public.user_learning_goals
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- Keep updated_at fresh when progress / target_date changes. Unique function
-- name so it can never collide with an existing shared trigger function.
CREATE OR REPLACE FUNCTION public.touch_user_learning_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_learning_goals_updated_at ON public.user_learning_goals;
CREATE TRIGGER trg_user_learning_goals_updated_at
  BEFORE UPDATE ON public.user_learning_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_learning_goals_updated_at();

-- Authenticated users manage their own goals (RLS enforces ownership).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learning_goals TO authenticated;
