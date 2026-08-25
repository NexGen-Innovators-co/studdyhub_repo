-- =============================================================================
-- Live Quiz: fix the "2-second auto-advance" bug in advance_live_quiz()
-- -----------------------------------------------------------------------------
-- Root cause: the function located the "active" question with
--   ... AND start_time IS NOT NULL AND end_time IS NULL
-- but BOTH start-session (edge function) and advance_live_quiz() itself SET
-- end_time (the server-authoritative deadline) the moment a question starts.
-- So the active-question lookup never matched, the time-limit guard never ran,
-- and every 2s client poll / 5s watchdog sweep immediately started the next
-- pending question — the entire quiz ran in seconds regardless of the configured
-- question_time_limit (e.g. 20s/question, but the session completed in ~6s).
--
-- Fix: locate the active question by status = 'active' and compare now() against
-- its stored end_time deadline. p_force (host "Next") still advances immediately.
--
-- Idempotent — safe to re-run. CREATE OR REPLACE preserves existing grants; the
-- REVOKE/GRANT block below re-asserts the lock-down anyway.
-- =============================================================================

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

  -- Find the currently active question (started but not ended). We match on
  -- status = 'active' because end_time is the DEADLINE (start + time limit) and
  -- is set as soon as a question starts — it is never NULL for a started question.
  SELECT * INTO v_active
  FROM public.live_quiz_questions
  WHERE session_id = p_session_id
    AND status = 'active'
  ORDER BY question_index DESC
  LIMIT 1;

  IF FOUND THEN
    -- Auto mode only advances once the server deadline has actually elapsed.
    v_time_limit := COALESCE(v_active.time_limit, 30);
    IF NOT p_force
       AND v_now < COALESCE(v_active.end_time, v_active.start_time + make_interval(secs => v_time_limit)) THEN
      RETURN jsonb_build_object('success', false, 'advanced', false, 'reason', 'not_due');
    END IF;

    -- Close it atomically (guards against concurrent double-advance).
    UPDATE public.live_quiz_questions
    SET end_time = v_now, status = 'completed'
    WHERE id = v_active.id AND status = 'active';

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

-- Keep the SECURITY DEFINER RPC locked down: only the edge function (service
-- role) may call it — clients must not be able to force-advance or complete
-- someone else's session.
REVOKE ALL ON FUNCTION public.advance_live_quiz(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_live_quiz(uuid, boolean) TO service_role;
