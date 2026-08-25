-- Migration: Speed Race columns on live_quiz_sessions
-- Date: 2026-08-14
-- Explorer Speed Race: public quick-match lobbies are sessions marked with a game_key
-- and is_public = true. The live-quiz edge function's find-public-lobby action queries
-- these columns (service role, so RLS does not apply to the lookup).

ALTER TABLE public.live_quiz_sessions
  ADD COLUMN IF NOT EXISTS game_key text;

ALTER TABLE public.live_quiz_sessions
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Fast lookup of open public lobbies by game.
CREATE INDEX IF NOT EXISTS idx_live_quiz_sessions_public_lobby
  ON public.live_quiz_sessions (game_key, status)
  WHERE is_public = true;
