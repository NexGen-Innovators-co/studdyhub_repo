-- ============================================================================
-- Server-Side RPCs: Move all business logic from client to database layer
-- ============================================================================

-- 1. AWARD XP — single source of truth for all XP/credits/level changes
-- Called by: quiz completion, game completion, daily quest, badge, lessons
CREATE OR REPLACE FUNCTION public.award_xp(
    p_user_id    UUID,
    p_xp_amount  INTEGER,
    p_reason     TEXT DEFAULT 'activity'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_safe_xp    INTEGER;
    v_profile    RECORD;
    v_stats      RECORD;
    v_new_xp     INTEGER;
    v_new_level  INTEGER;
    v_new_balance INTEGER;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;
    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'xp_amount must be positive';
    END IF;

    -- Anti-tamper cap: max 500 XP per single award
    v_safe_xp := LEAST(p_xp_amount, 500);

    -- Ensure profiles row exists
    INSERT INTO public.profiles (id, user_role, updated_at)
    VALUES (p_user_id, 'student', now())
    ON CONFLICT (id) DO NOTHING;

    -- Ensure user_stats row exists
    INSERT INTO public.user_stats (user_id, total_xp, level, current_streak, longest_streak, updated_at)
    VALUES (p_user_id, 0, 1, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    -- Lock and read current state
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    SELECT * INTO v_stats   FROM public.user_stats WHERE user_id = p_user_id FOR UPDATE;

    -- Calculate new values
    v_new_xp      := COALESCE(v_stats.total_xp, 0) + v_safe_xp;
    v_new_level   := (v_new_xp / 500) + 1;
    v_new_balance := LEAST(COALESCE(v_profile.points_balance, 0) + v_safe_xp, 100000);

    -- Update profiles (points balance)
    UPDATE public.profiles
    SET    points_balance = v_new_balance,
           updated_at     = now()
    WHERE  id = p_user_id;

    -- Update user_stats (lifetime XP + level)
    UPDATE public.user_stats
    SET    total_xp       = v_new_xp,
           level          = v_new_level,
           last_activity_date = now(),
           updated_at     = now()
    WHERE  user_id = p_user_id;

    RETURN jsonb_build_object(
        'success',        true,
        'xp_awarded',     v_safe_xp,
        'total_xp',       v_new_xp,
        'level',          v_new_level,
        'points_balance', v_new_balance,
        'reason',         p_reason
    );
END;
$$;


-- 2. SUBMIT QUIZ RESULT — handles quiz stats + XP + streak atomically
CREATE OR REPLACE FUNCTION public.submit_quiz_result(
    p_user_id       UUID,
    p_score         INTEGER,
    p_total         INTEGER,
    p_time_seconds  INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pct         NUMERIC;
    v_xp          INTEGER;
    v_profile     RECORD;
    v_stats       RECORD;
    v_new_xp      INTEGER;
    v_new_level   INTEGER;
    v_new_balance INTEGER;
    v_new_attempted  INTEGER;
    v_new_completed  INTEGER;
    v_new_avg     NUMERIC;
    v_new_study   INTEGER;
    v_new_streak  INTEGER;
    v_new_longest INTEGER;
    v_is_same_day BOOLEAN;
    v_today       DATE := CURRENT_DATE;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;
    IF p_total <= 0 THEN
        RAISE EXCEPTION 'total questions must be positive';
    END IF;

    v_pct := (p_score::NUMERIC / p_total::NUMERIC) * 100;

    -- XP formula: score * 25 + 50 base, capped at 500
    v_xp := LEAST((p_score * 25) + 50, 500);

    -- Ensure rows exist
    INSERT INTO public.profiles (id, user_role, updated_at)
    VALUES (p_user_id, 'student', now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_stats (user_id, total_xp, level, current_streak, longest_streak, updated_at)
    VALUES (p_user_id, 0, 1, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    -- Lock and read
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;
    SELECT * INTO v_stats   FROM public.user_stats WHERE user_id = p_user_id FOR UPDATE;

    -- XP + level
    v_new_xp      := COALESCE(v_stats.total_xp, 0) + v_xp;
    v_new_level   := (v_new_xp / 500) + 1;
    v_new_balance := LEAST(COALESCE(v_profile.points_balance, 0) + v_xp, 100000);

    -- Quiz counters
    v_new_attempted := COALESCE(v_stats.total_quizzes_attempted, 0) + 1;
    v_new_completed := COALESCE(v_stats.total_quizzes_completed, 0) + 1;

    -- Running average score
    IF v_new_completed = 1 THEN
        v_new_avg := v_pct;
    ELSE
        v_new_avg := ((COALESCE(v_stats.average_score, 0) * (v_new_completed - 1)) + v_pct) / v_new_completed;
    END IF;

    -- Study time
    v_new_study := COALESCE(v_stats.total_study_time_seconds, 0) + GREATEST(p_time_seconds, 0);

    -- Streak calculation (server time)
    IF v_stats.last_activity_date IS NULL THEN
        v_new_streak := 1;
    ELSIF DATE(v_stats.last_activity_date) = v_today THEN
        v_new_streak := GREATEST(COALESCE(v_stats.current_streak, 0), 1);
    ELSIF v_today - DATE(v_stats.last_activity_date) = 1 THEN
        v_new_streak := COALESCE(v_stats.current_streak, 0) + 1;
    ELSE
        v_new_streak := 1;
    END IF;
    v_new_longest := GREATEST(COALESCE(v_stats.longest_streak, 0), v_new_streak);

    -- Update profiles
    UPDATE public.profiles
    SET    points_balance = v_new_balance,
           updated_at     = now()
    WHERE  id = p_user_id;

    -- Update user_stats
    UPDATE public.user_stats
    SET    total_xp                = v_new_xp,
           level                   = v_new_level,
           total_quizzes_attempted = v_new_attempted,
           total_quizzes_completed = v_new_completed,
           average_score           = v_new_avg,
           total_study_time_seconds = v_new_study,
           current_streak          = v_new_streak,
           longest_streak          = v_new_longest,
           last_activity_date      = now(),
           updated_at              = now()
    WHERE  user_id = p_user_id;

    RETURN jsonb_build_object(
        'success',              true,
        'xp_awarded',           v_xp,
        'total_xp',             v_new_xp,
        'level',                v_new_level,
        'points_balance',       v_new_balance,
        'quizzes_attempted',    v_new_attempted,
        'quizzes_completed',    v_new_completed,
        'average_score',        ROUND(v_new_avg, 1),
        'current_streak',       v_new_streak,
        'longest_streak',       v_new_longest,
        'percentage',           ROUND(v_pct, 1)
    );
END;
$$;


-- 3. SPEND CREDITS — atomic balance check + deduction
CREATE OR REPLACE FUNCTION public.spend_credits(
    p_user_id  UUID,
    p_cost     INTEGER,
    p_item     TEXT DEFAULT 'item'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_new_balance INTEGER;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;
    IF p_cost <= 0 THEN
        RAISE EXCEPTION 'cost must be positive';
    END IF;

    -- Ensure row exists
    INSERT INTO public.profiles (id, user_role, updated_at)
    VALUES (p_user_id, 'student', now())
    ON CONFLICT (id) DO NOTHING;

    -- Lock row for atomic check+deduct
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id FOR UPDATE;

    IF COALESCE(v_profile.points_balance, 0) < p_cost THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'insufficient_credits',
            'balance', COALESCE(v_profile.points_balance, 0),
            'needed',  p_cost
        );
    END IF;

    v_new_balance := v_profile.points_balance - p_cost;

    UPDATE public.profiles
    SET    points_balance = v_new_balance,
           updated_at     = now()
    WHERE  id = p_user_id;

    RETURN jsonb_build_object(
        'success',        true,
        'balance',        v_new_balance,
        'spent',          p_cost,
        'item',           p_item
    );
END;
$$;


-- 4. RECORD ACTIVITY — streak update using server time
CREATE OR REPLACE FUNCTION public.record_activity(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats    RECORD;
    v_new_streak  INTEGER;
    v_new_longest INTEGER;
    v_today    DATE := CURRENT_DATE;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;

    -- Ensure row exists
    INSERT INTO public.user_stats (user_id, total_xp, level, current_streak, longest_streak, updated_at)
    VALUES (p_user_id, 0, 1, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id FOR UPDATE;

    -- Streak logic using server date
    IF v_stats.last_activity_date IS NULL THEN
        v_new_streak := 1;
    ELSIF DATE(v_stats.last_activity_date) = v_today THEN
        v_new_streak := GREATEST(COALESCE(v_stats.current_streak, 0), 1);
    ELSIF v_today - DATE(v_stats.last_activity_date) = 1 THEN
        v_new_streak := COALESCE(v_stats.current_streak, 0) + 1;
    ELSE
        v_new_streak := 1;
    END IF;

    v_new_longest := GREATEST(COALESCE(v_stats.longest_streak, 0), v_new_streak);

    UPDATE public.user_stats
    SET    current_streak     = v_new_streak,
           longest_streak     = v_new_longest,
           last_activity_date = now(),
           updated_at         = now()
    WHERE  user_id = p_user_id;

    RETURN jsonb_build_object(
        'success',        true,
        'current_streak', v_new_streak,
        'longest_streak', v_new_longest
    );
END;
$$;


-- 5. CLAIM DAILY QUEST — server-side date validation + XP award
CREATE OR REPLACE FUNCTION public.claim_daily_quest(
    p_user_id  UUID,
    p_points   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats    RECORD;
    v_today    TEXT := to_char(CURRENT_DATE, 'YYYY-MM-DD');
    v_result   JSONB;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;

    -- Ensure row exists
    INSERT INTO public.user_stats (user_id, total_xp, level, current_streak, longest_streak, updated_at)
    VALUES (p_user_id, 0, 1, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id FOR UPDATE;

    -- Already claimed today?
    IF v_stats.last_daily_quest_claimed_date = v_today THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'already_claimed_today'
        );
    END IF;

    -- Mark claimed + record activity
    UPDATE public.user_stats
    SET    last_daily_quest_claimed_date = v_today,
           last_activity_date           = now(),
           updated_at                   = now()
    WHERE  user_id = p_user_id;

    -- Award XP through the standard RPC
    SELECT public.award_xp(p_user_id, p_points, 'daily_quest') INTO v_result;

    RETURN jsonb_build_object(
        'success',  true,
        'points',   p_points,
        'details',  v_result
    );
END;
$$;


-- 6. CLAIM BADGE — server-side eligibility check + XP award
CREATE OR REPLACE FUNCTION public.claim_badge(
    p_user_id    UUID,
    p_badge_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stats     RECORD;
    v_badges    TEXT[];
    v_already   BOOLEAN;
    v_result    JSONB;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;
    IF p_badge_name IS NULL OR p_badge_name = '' THEN
        RAISE EXCEPTION 'badge_name is required';
    END IF;

    -- Ensure row exists
    INSERT INTO public.user_stats (user_id, total_xp, level, current_streak, longest_streak, updated_at)
    VALUES (p_user_id, 0, 1, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_stats FROM public.user_stats WHERE user_id = p_user_id FOR UPDATE;

    -- Parse existing badges
    IF v_stats.badges_earned IS NULL OR v_stats.badges_earned = '' THEN
        v_badges := ARRAY[]::TEXT[];
    ELSE
        SELECT string_to_array(v_stats.badges_earned, ',') INTO v_badges;
    END IF;

    -- Check if already has badge
    v_already := p_badge_name = ANY(v_badges);

    -- Also check first_quest specific flag
    IF p_badge_name = 'first_quest' AND COALESCE(v_stats.hasclaimedfirstquestbonus, false) THEN
        v_already := true;
    END IF;

    IF v_already THEN
        RETURN jsonb_build_object(
            'success', false,
            'error',   'badge_already_earned'
        );
    END IF;

    -- Add badge
    v_badges := array_append(v_badges, p_badge_name);

    UPDATE public.user_stats
    SET    badges_earned = array_to_string(v_badges, ','),
           hasclaimedfirstquestbonus = CASE WHEN p_badge_name = 'first_quest' THEN true ELSE COALESCE(hasclaimedfirstquestbonus, false) END,
           current_streak = GREATEST(COALESCE(current_streak, 0), 1),
           last_activity_date = now(),
           updated_at = now()
    WHERE  user_id = p_user_id;

    -- Award 50 XP for badge
    SELECT public.award_xp(p_user_id, 50, 'badge:' || p_badge_name) INTO v_result;

    RETURN jsonb_build_object(
        'success',    true,
        'badge',      p_badge_name,
        'all_badges', v_badges,
        'xp_details', v_result
    );
END;
$$;


-- 7. SUBMIT GAME RESULT — handles game progress + XP + streak atomically
CREATE OR REPLACE FUNCTION public.submit_game_result(
    p_user_id    UUID,
    p_game_key   TEXT,
    p_level      INTEGER,
    p_score      INTEGER,
    p_total      INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pct       NUMERIC;
    v_stars     INTEGER;
    v_xp        INTEGER;
    v_existing  RECORD;
    v_next_unlock INTEGER;
    v_new_stars JSONB;
    v_best_pct  INTEGER;
    v_result    JSONB;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;
    IF p_total <= 0 THEN
        RAISE EXCEPTION 'total must be positive';
    END IF;

    v_pct := (p_score::NUMERIC / p_total::NUMERIC) * 100;

    -- Stars calculation (server-side)
    v_stars := CASE
        WHEN v_pct >= 90 THEN 3
        WHEN v_pct >= 70 THEN 2
        WHEN v_pct >= 40 THEN 1
        ELSE 0
    END;

    -- XP calculation (server-side): base + level bonus + percentage bonus
    v_xp := LEAST(50 + (p_level * 10) + (v_stars * 25), 500);

    -- Read existing game progress
    SELECT * INTO v_existing
    FROM   public.game_progress
    WHERE  user_id = p_user_id AND game_key = p_game_key;

    -- Calculate next unlock level
    IF v_stars > 0 THEN
        v_next_unlock := GREATEST(COALESCE(v_existing.unlocked_level, 1), p_level + 1);
    ELSE
        v_next_unlock := COALESCE(v_existing.unlocked_level, 1);
    END IF;

    -- Merge stars by level (JSONB)
    IF v_existing.stars_by_level IS NOT NULL THEN
        v_new_stars := v_existing.stars_by_level;
    ELSE
        v_new_stars := '{}'::JSONB;
    END IF;
    -- Keep the best stars for this level
    IF v_stars > COALESCE((v_new_stars -> p_level::TEXT)::INTEGER, 0) THEN
        v_new_stars := jsonb_set(v_new_stars, ARRAY[p_level::TEXT], to_jsonb(v_stars));
    END IF;

    -- Upsert game_progress
    INSERT INTO public.game_progress (id, user_id, game_key, unlocked_level, stars_by_level, best_scores, total_xp_earned, last_played_at, created_at, updated_at)
    VALUES (
        COALESCE(v_existing.id, gen_random_uuid()),
        p_user_id,
        p_game_key,
        v_next_unlock,
        v_new_stars,
        COALESCE(v_existing.best_scores, '{}'::JSONB),
        COALESCE(v_existing.total_xp_earned, 0) + v_xp,
        now(),
        now(),
        now()
    )
    ON CONFLICT (user_id, game_key) DO UPDATE SET
        unlocked_level = v_next_unlock,
        stars_by_level = v_new_stars,
        total_xp_earned = COALESCE(game_progress.total_xp_earned, 0) + v_xp,
        last_played_at = now(),
        updated_at = now();

    -- Award XP through standard RPC (handles profiles + user_stats)
    SELECT public.award_xp(p_user_id, v_xp, 'game:' || p_game_key || ':L' || p_level) INTO v_result;

    -- Record activity for streak
    PERFORM public.record_activity(p_user_id);

    RETURN jsonb_build_object(
        'success',         true,
        'stars',           v_stars,
        'xp_awarded',      v_xp,
        'unlocked_level',  v_next_unlock,
        'total_xp_earned', COALESCE(v_existing.total_xp_earned, 0) + v_xp,
        'stats',           v_result
    );
END;
$$;


-- 8. PURCHASE STREAK FREEZE — atomic credit deduction + freeze grant
CREATE OR REPLACE FUNCTION public.purchase_streak_freeze(
    p_user_id UUID,
    p_cost    INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_spend_result JSONB;
    v_stats RECORD;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;

    -- Spend credits first (atomic balance check)
    SELECT public.spend_credits(p_user_id, p_cost, 'streak_freeze') INTO v_spend_result;

    IF NOT (v_spend_result ->> 'success')::BOOLEAN THEN
        RETURN v_spend_result;
    END IF;

    -- Grant the freeze
    -- Ensure row exists
    INSERT INTO public.user_stats (user_id, total_xp, level, current_streak, longest_streak, updated_at)
    VALUES (p_user_id, 0, 1, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_stats
    SET    streak_freezes = COALESCE(streak_freezes, 0) + 1,
           last_activity_date = now(),
           updated_at = now()
    WHERE  user_id = p_user_id;

    SELECT streak_freezes INTO v_stats FROM public.user_stats WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success',        true,
        'balance',        (v_spend_result ->> 'balance')::INTEGER,
        'streak_freezes', v_stats.streak_freezes
    );
END;
$$;


-- ============================================================================
-- Grants: allow authenticated users to call these RPCs
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.award_xp(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quiz_result(UUID, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_activity(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_badge(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_game_result(UUID, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_streak_freeze(UUID, INTEGER) TO authenticated;
