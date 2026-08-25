-- =============================================================================
-- Live Quiz: Realtime delivery + Kahoot-style fairness
-- -----------------------------------------------------------------------------
-- 1) Add live quiz tables to the supabase_realtime publication so postgres_changes
--    events are emitted (required by both the web and mobile realtime clients).
-- 2) Unique constraint on live_quiz_answers(question_id, user_id) so answers are
--    idempotent (one answer per player per question — Kahoot-style).
-- 3) mark_unanswered_as_incorrect(): single bulk, idempotent timeout marking
--    (replaces the racy per-player SELECT-then-INSERT loop in the edge function).
-- 4) advance_live_quiz(): single authoritative, idempotent question advance used by
--    every auto-advance path, eliminating the double-advance / question-skip races.
--
-- NOTE ON RLS: the live quiz tables are currently queried directly by authenticated
-- clients (public lobby browser, past-session results) without row-level security
-- enforced. postgres_changes delivers events to any authenticated subscriber, so no
-- RLS changes are required for realtime to work. If RLS is ever enabled on these
-- tables later, matching SELECT policies for participants MUST be added or realtime
-- events (which respect RLS) will stop being delivered.
--
-- All changes are additive and idempotent — safe to apply at any time.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Realtime publication (idempotent)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_quiz_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_sessions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_quiz_questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_questions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_quiz_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_players;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'live_quiz_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_quiz_answers;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1b) Safety net: the RPCs below rely on live_quiz_questions.time_limit existing.
-- -----------------------------------------------------------------------------
ALTER TABLE public.live_quiz_questions
  ADD COLUMN IF NOT EXISTS time_limit integer DEFAULT 30;

-- -----------------------------------------------------------------------------
-- 2) Unique constraint: one answer per player per question (idempotent)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'live_quiz_answers_question_user_key'
      AND conrelid = 'public.live_quiz_answers'::regclass
  ) THEN
    -- Dedupe any existing duplicate answers first (keep the latest by answered_at).
    DELETE FROM public.live_quiz_answers a
    USING public.live_quiz_answers b
    WHERE a.question_id = b.question_id
      AND a.user_id = b.user_id
      AND (a.answered_at < b.answered_at OR (a.answered_at = b.answered_at AND a.id::text < b.id::text));

    ALTER TABLE public.live_quiz_answers
      ADD CONSTRAINT live_quiz_answers_question_user_key UNIQUE (question_id, user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 3) Bulk, idempotent timeout marking
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_unanswered_as_incorrect(p_session_id uuid, p_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.live_quiz_answers
    (session_id, question_id, user_id, answer_index, is_correct, points_awarded, answered_at, status)
  SELECT p_session_id, p_question_id, p.user_id, -1, false, 0, now(), 'timeout'
  FROM public.live_quiz_players p
  WHERE p.session_id = p_session_id
    AND p.is_playing = true
    AND NOT EXISTS (
      SELECT 1 FROM public.live_quiz_answers a
      WHERE a.question_id = p_question_id AND a.user_id = p.user_id
    )
  ON CONFLICT (question_id, user_id) DO NOTHING;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4) Single authoritative, idempotent advance
-- -----------------------------------------------------------------------------
-- p_force = true  → advance immediately (host pressing "Next").
-- p_force = false → only advance once the active question's time limit has elapsed
--                   (auto mode). Concurrent callers can never double-advance because
--                   the close is guarded by `WHERE status = 'active' AND end_time IS NULL`.
CREATE OR REPLACE FUNCTION public.advance_live_quiz(p_session_id uuid, p_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session public.live_quiz_sessions%ROWTYPE;
  v_active  public.live_quiz_questions%ROWTYPE;
  v_next    public.live_quiz_questions%ROWTYPE;
  v_now     timestamptz := now();
  v_time_limit integer;
  v_result  jsonb;
BEGIN
  SELECT * INTO v_session FROM public.live_quiz_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'session_not_found');
  END IF;

  IF v_session.status <> 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'advanced', false, 'reason', 'not_in_progress');
  END IF;

  -- Find the currently active question (started but not ended).
  SELECT * INTO v_active
  FROM public.live_quiz_questions
  WHERE session_id = p_session_id
    AND start_time IS NOT NULL
    AND end_time IS NULL
  ORDER BY question_index DESC
  LIMIT 1;

  IF FOUND THEN
    -- Auto mode only advances once the time limit has actually elapsed.
    v_time_limit := COALESCE(v_active.time_limit, 30);
    IF NOT p_force AND v_now < v_active.start_time + make_interval(secs => v_time_limit) THEN
      RETURN jsonb_build_object('success', false, 'advanced', false, 'reason', 'not_due');
    END IF;

    -- Close it atomically (guards against concurrent double-advance).
    UPDATE public.live_quiz_questions
    SET end_time = v_now, status = 'completed'
    WHERE id = v_active.id AND status = 'active' AND end_time IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'advanced', false, 'reason', 'already_advanced');
    END IF;

    -- Mark all unanswered players as incorrect (bulk, idempotent).
    PERFORM public.mark_unanswered_as_incorrect(p_session_id, v_active.id);
  END IF;

  -- Start the next pending question, or complete the session.
  SELECT * INTO v_next
  FROM public.live_quiz_questions
  WHERE session_id = p_session_id AND status = 'pending'
  ORDER BY question_index ASC
  LIMIT 1;

  IF FOUND THEN
    v_time_limit := COALESCE(v_next.time_limit, 30);
    UPDATE public.live_quiz_questions
    SET start_time = v_now, end_time = v_now + make_interval(secs => v_time_limit), status = 'active'
    WHERE id = v_next.id;

    v_result := jsonb_build_object(
      'success', true,
      'advanced', true,
      'next_question_index', v_next.question_index,
      'next_question_id', v_next.id,
      'next_question_end_time', to_char(v_now + make_interval(secs => v_time_limit), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    );
  ELSE
    UPDATE public.live_quiz_sessions
    SET status = 'completed', end_time = v_now
    WHERE id = p_session_id AND status = 'in_progress';

    v_result := jsonb_build_object('success', true, 'advanced', true, 'session_completed', true);
  END IF;

  RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5) Lock down the SECURITY DEFINER RPCs. They carry no per-user authorization
--     checks, so they must NOT be callable by clients directly (otherwise any user
--     could force-advance or complete someone else's session). Only the edge
--     function, which runs with the service role key and enforces host checks, may
--     execute them. Deliberately placed AFTER the CREATE FUNCTION statements above:
--     REVOKE on a function that doesn't exist yet would abort the migration.
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.mark_unanswered_as_incorrect(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_live_quiz(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_unanswered_as_incorrect(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.advance_live_quiz(uuid, boolean) TO service_role;
