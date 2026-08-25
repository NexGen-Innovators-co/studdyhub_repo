-- Migration: game_progress — Explorer (kids) game stars, unlocked levels, XP
-- Date: 2026-08-14
-- One row per (user, game). Mirrors the local Room `game_progress` table and is
-- upserted from the app on every level result. RLS = own rows (see
-- 20260210_comprehensive_rls_hardening.sql conventions).

CREATE TABLE IF NOT EXISTS public.game_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_key text NOT NULL,
  unlocked_level integer NOT NULL DEFAULT 1,
  stars_by_level jsonb NOT NULL DEFAULT '{}'::jsonb,
  best_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_xp_earned integer NOT NULL DEFAULT 0,
  last_played_at timestamp with time zone NULL DEFAULT now(),
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT game_progress_pkey PRIMARY KEY (id),
  CONSTRAINT game_progress_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT game_progress_user_game_unique UNIQUE (user_id, game_key)
);

CREATE INDEX IF NOT EXISTS idx_game_progress_user_id
  ON public.game_progress (user_id);

ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_progress'
      AND policyname = 'game_progress_select_own'
  ) THEN
    CREATE POLICY game_progress_select_own
      ON public.game_progress
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_progress'
      AND policyname = 'game_progress_insert_own'
  ) THEN
    CREATE POLICY game_progress_insert_own
      ON public.game_progress
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_progress'
      AND policyname = 'game_progress_update_own'
  ) THEN
    CREATE POLICY game_progress_update_own
      ON public.game_progress
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
      AND tablename = 'game_progress'
      AND policyname = 'game_progress_delete_own'
  ) THEN
    CREATE POLICY game_progress_delete_own
      ON public.game_progress
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;

-- Keep updated_at fresh on every change.
CREATE OR REPLACE FUNCTION public.touch_game_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_game_progress_updated_at ON public.game_progress;
CREATE TRIGGER trg_game_progress_updated_at
  BEFORE UPDATE ON public.game_progress
  FOR EACH ROW EXECUTE FUNCTION public.touch_game_progress_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_progress TO authenticated;
