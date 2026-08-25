CREATE OR REPLACE FUNCTION public.sync_profile(
    p_full_name        TEXT DEFAULT NULL,
    p_school           TEXT DEFAULT NULL,
    p_academic_level   TEXT DEFAULT NULL,
    p_academic_tier    TEXT DEFAULT NULL,
    p_learning_style   TEXT DEFAULT NULL,
    p_learning_preferences JSONB DEFAULT NULL,
    p_quiz_preferences JSONB DEFAULT NULL,
    p_personal_context TEXT DEFAULT NULL,
    p_avatar_url       TEXT DEFAULT NULL,
    p_bio              TEXT DEFAULT NULL,
    p_username         TEXT DEFAULT NULL,
    p_onboarding_completed BOOLEAN DEFAULT NULL,
    p_points_balance   INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_row public.profiles%ROWTYPE;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Ensure row exists first
    INSERT INTO public.profiles (id, email, user_role, role_verification_status, updated_at)
    VALUES (v_uid, (SELECT email FROM auth.users WHERE id = v_uid), 'student', 'not_required', now())
    ON CONFLICT (id) DO NOTHING;

    -- Update only the fields the client provided
    UPDATE public.profiles SET
        full_name            = COALESCE(p_full_name, full_name),
        school               = COALESCE(p_school, school),
        academic_level       = COALESCE(p_academic_level, academic_level),
        academic_tier        = COALESCE(p_academic_tier, academic_tier),
        learning_style       = COALESCE(p_learning_style, learning_style),
        learning_preferences = COALESCE(p_learning_preferences, learning_preferences),
        quiz_preferences     = COALESCE(p_quiz_preferences, quiz_preferences),
        personal_context     = COALESCE(p_personal_context, personal_context),
        avatar_url           = COALESCE(p_avatar_url, avatar_url),
        bio                  = COALESCE(p_bio, bio),
        username             = COALESCE(p_username, username),
        onboarding_completed = COALESCE(p_onboarding_completed, onboarding_completed),
        points_balance       = COALESCE(p_points_balance, points_balance),
        updated_at           = now()
    WHERE id = v_uid
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'success',              true,
        'id',                   v_row.id,
        'email',                v_row.email,
        'full_name',            v_row.full_name,
        'username',             v_row.username,
        'school',               v_row.school,
        'academic_level',       v_row.academic_level,
        'academic_tier',        v_row.academic_tier,
        'learning_style',       v_row.learning_style,
        'learning_preferences', v_row.learning_preferences,
        'quiz_preferences',     v_row.quiz_preferences,
        'personal_context',     v_row.personal_context,
        'onboarding_completed', v_row.onboarding_completed,
        'points_balance',       v_row.points_balance,
        'bonus_ai_credits',     v_row.bonus_ai_credits
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_profile(TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER) TO authenticated;
