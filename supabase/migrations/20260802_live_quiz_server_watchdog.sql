-- =============================================================================
-- Live Quiz: fully server-driven advancement (no client dependence)
-- -----------------------------------------------------------------------------
-- A pg_cron watchdog that sweeps every few seconds and drives the live quiz
-- forward using the authoritative (idempotent) advance_live_quiz RPC from the
-- realtime-fairness migration. With this in place the quiz advances, timeouts
-- are marked, and sessions complete even when ZERO clients are connected —
-- clients only render state and submit answers.
--
-- Requires: pg_cron (already used by the document-processor watchdog migration)
-- and advance_live_quiz() from 20260802_live_quiz_realtime_fairness.sql.
--
-- All statements are idempotent — safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Ensure pg_cron is available (matches the existing watchdog migration).
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- -----------------------------------------------------------------------------
-- 2) The sweep: auto-start scheduled sessions, then advance every in-progress
--    session whose active question is due (or start its first pending question,
--    or complete it when no questions remain).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.advance_due_live_quizzes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  -- 2a) Auto-start sessions whose scheduled start time has passed (server-driven
  --     start, no host poll required). advance_live_quiz below then starts Q1.
  UPDATE public.live_quiz_sessions
  SET status = 'in_progress', start_time = now()
  WHERE status = 'waiting'
    AND scheduled_start_time IS NOT NULL
    AND scheduled_start_time <= now();

  -- 2b) For every in-progress session, run the authoritative advance. It is
  --     idempotent: it only closes an ACTIVE question whose time limit has
  --     elapsed (guarded by WHERE status='active' AND end_time IS NULL), marks
  --     unanswered players, starts the next PENDING question with a fresh
  --     server end_time, or completes the session when nothing remains.
  FOR v_session_id IN
    SELECT id FROM public.live_quiz_sessions WHERE status = 'in_progress'
  LOOP
    PERFORM public.advance_live_quiz(v_session_id, false);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_due_live_quizzes() TO postgres;

-- -----------------------------------------------------------------------------
-- 3) Schedule the watchdog every 5 seconds (pg_cron supports the leading
--    seconds field). Idempotent: only schedules once per job name.
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'live-quiz-watchdog') THEN
    PERFORM cron.schedule(
      'live-quiz-watchdog',
      '*/5 * * * * *',                     -- every 5 seconds
      'SELECT public.advance_due_live_quizzes();'
    );
  END IF;
END $$;
