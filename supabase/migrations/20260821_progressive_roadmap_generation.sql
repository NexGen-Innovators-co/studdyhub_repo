-- =============================================================================
-- Migration: 20260821_progressive_roadmap_generation.sql
-- Purpose: Progressive, just-in-time roadmap generation.
--
-- Only generates the NEXT week when a user completes their CURRENT week.
-- Zero tokens wasted on inactive users.
-- =============================================================================

-- 1. RPC: find active users who need the next week generated
--    Returns users who have ≥1 completed step in their latest week
--    but don't have the next week's steps yet.
CREATE OR REPLACE FUNCTION public.find_users_needing_next_week()
RETURNS TABLE(user_id UUID, next_week INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH user_weeks AS (
        -- Get max week per user that has steps
        SELECT
            krs.user_id,
            MAX(krs.week) AS max_week
        FROM public.kid_roadmap_steps krs
        GROUP BY krs.user_id
    ),
    user_completions AS (
        -- Count completed steps per user per week
        SELECT
            krs.user_id,
            krs.week,
            COUNT(*) FILTER (WHERE krs.is_completed = true) AS completed_count,
            COUNT(*) AS total_count
        FROM public.kid_roadmap_steps krs
        GROUP BY krs.user_id, krs.week
    ),
    active_users AS (
        -- Users who completed ≥1 step in their latest week
        SELECT
            uw.user_id,
            uw.max_week,
            uc.completed_count
        FROM user_weeks uw
        JOIN user_completions uc ON uc.user_id = uw.user_id AND uc.week = uw.max_week
        WHERE uc.completed_count >= 1
          AND uw.max_week < 8  -- Don't generate beyond week 8
    )
    SELECT
        au.user_id,
        (au.max_week + 1)::INT AS next_week
    FROM active_users au
    -- Exclude users who already have the next week
    WHERE NOT EXISTS (
        SELECT 1 FROM public.kid_roadmap_steps krs2
        WHERE krs2.user_id = au.user_id
          AND krs2.week = (au.max_week + 1)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_users_needing_next_week() TO service_role;

-- 2. RPC: trigger next-week generation for a specific user
--    Called by the app when user completes the last step of a week.
CREATE OR REPLACE FUNCTION public.trigger_next_week_generation(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_max_week INT;
    v_next_week INT;
    v_has_completed BOOLEAN;
BEGIN
    -- Find the user's max week and whether they completed any step in it
    SELECT
        MAX(week),
        BOOL_OR(is_completed)
    INTO v_max_week, v_has_completed
    FROM public.kid_roadmap_steps
    WHERE user_id = p_user_id;

    IF v_max_week IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No roadmap steps found');
    END IF;

    IF NOT v_has_completed THEN
        RETURN jsonb_build_object('success', false, 'error', 'No completed steps in current week');
    END IF;

    v_next_week := v_max_week + 1;

    IF v_next_week > 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Already at max weeks');
    END IF;

    -- Check if next week already exists
    IF EXISTS (
        SELECT 1 FROM public.kid_roadmap_steps
        WHERE user_id = p_user_id AND week = v_next_week
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Next week already exists');
    END IF;

    -- Queue for background generation (fire-and-forget via pg_notify)
    PERFORM pg_notify('generate_roadmap_next_week', jsonb_build_object(
        'user_id', p_user_id,
        'week', v_next_week
    )::text);

    RETURN jsonb_build_object(
        'success', true,
        'next_week', v_next_week,
        'message', 'Queued for background generation'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.trigger_next_week_generation(UUID) TO authenticated;

-- 3. pg_cron schedule: Run the cron every 6 hours
--    This picks up any active users who need the next week.
--    Uncomment the following after enabling pg_cron extension:
--
-- SELECT cron.schedule(
--     'generate-roadmap-next-week',
--     '0 */6 * * *',  -- Every 6 hours
--     $$
--     SELECT net.http_post(
--         url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-roadmap-cron',
--         headers := jsonb_build_object(
--             'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--             'Content-Type', 'application/json'
--         ),
--         body := '{}'::jsonb
--     );
--     $$
-- );
