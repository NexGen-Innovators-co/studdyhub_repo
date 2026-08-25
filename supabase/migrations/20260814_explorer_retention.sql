-- Migration: Explorer retention columns on user_stats
-- Date: 2026-08-14
-- The kids' credits store spends points on streak freezes, and the Daily Quest
-- generator tracks when the reward was last claimed — both live on user_stats.

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS streak_freezes integer NOT NULL DEFAULT 0;

ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS last_daily_quest_claimed_date text NOT NULL DEFAULT '';
