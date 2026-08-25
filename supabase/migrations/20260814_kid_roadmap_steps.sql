-- Migration: kid_roadmap_steps — Explorer (kids) daily learning path
-- Date: 2026-08-14
-- One row per roadmap step (lesson / practice quiz / game / review), generated per
-- subject after school setup. Mirrors the local Room `roadmap_steps` table; the app
-- pushes completion updates and pulls the path on sync. RLS = own rows.

CREATE TABLE IF NOT EXISTS public.kid_roadmap_steps (
  id uuid NOT NULL,
  user_id uuid NOT NULL,
  subject_code text NOT NULL DEFAULT '',
  subject_name text NOT NULL DEFAULT '',
  week integer NOT NULL DEFAULT 1,
  day integer NOT NULL DEFAULT 1,
  step_index integer NOT NULL DEFAULT 0,
  title text NOT NULL DEFAULT '',
  step_type text NOT NULL DEFAULT 'lesson',
  ref_id text,
  xp_reward integer NOT NULL DEFAULT 20,
  is_completed boolean NOT NULL DEFAULT false,
  due_date timestamp with time zone NULL,
  completed_at timestamp with time zone NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT kid_roadmap_steps_pkey PRIMARY KEY (id),
  CONSTRAINT kid_roadmap_steps_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_kid_roadmap_steps_user
  ON public.kid_roadmap_steps (user_id, week, day);

ALTER TABLE public.kid_roadmap_steps ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kid_roadmap_steps'
      AND policyname = 'kid_roadmap_steps_select_own'
  ) THEN
    CREATE POLICY kid_roadmap_steps_select_own
      ON public.kid_roadmap_steps
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kid_roadmap_steps'
      AND policyname = 'kid_roadmap_steps_insert_own'
  ) THEN
    CREATE POLICY kid_roadmap_steps_insert_own
      ON public.kid_roadmap_steps
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'kid_roadmap_steps'
      AND policyname = 'kid_roadmap_steps_update_own'
  ) THEN
    CREATE POLICY kid_roadmap_steps_update_own
      ON public.kid_roadmap_steps
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
      AND tablename = 'kid_roadmap_steps'
      AND policyname = 'kid_roadmap_steps_delete_own'
  ) THEN
    CREATE POLICY kid_roadmap_steps_delete_own
      ON public.kid_roadmap_steps
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kid_roadmap_steps TO authenticated;
