-- =============================================================================
-- Live Quiz: persist live history to the cloud
-- -----------------------------------------------------------------------------
-- Previously, live quiz attempts were recorded ONLY in the mobile Room DB with
-- pushToCloud=false, and logout wiped the local DB (clearAllTables) — so a
-- finished live challenge vanished from History after logout/login.
--
-- Fix: push live quiz attempts into quiz_attempts (like the web does) and keep
-- the full results snapshot (leaderboard + per-question review) in a dedicated
-- jsonb column so the full-page results view survives re-login.
--
-- All statements are idempotent — safe to re-run.
-- =============================================================================

-- 1) Live results snapshot (leaderboard + per-question user answers).
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS live_results jsonb;
