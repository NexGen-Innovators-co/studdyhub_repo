-- =============================================================================
-- COMBINED MIGRATION: Run this SINGLE file in the Supabase SQL Editor.
-- =============================================================================
-- This fixes two issues found in the device logs:
--
-- 1. sync_profile_to_social() trigger crashes on EVERY profile UPDATE because
--    profiles.username is NULL → violates NOT NULL on social_users.username
--    This blocks ALL profile PATCHes (academic_tier, learning_style, etc.)
--
-- 2. The auth-onboarding edge function returns HTTP 500 because the backing
--    RPCs (get_profile, complete_onboarding, sync_profile) don't exist yet.
--
-- Run order: This file is self-contained. Run it once.
-- =============================================================================

-- ═════════════════════════════════════════════════════════════════════════════
-- PART A: Fix the sync_profile_to_social() trigger (blocks ALL profile updates)
-- ═════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_profile_to_social()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_username TEXT;
    v_display_name TEXT;
BEGIN
    -- Generate a safe username — never NULL for social_users NOT NULL constraint
    v_username := COALESCE(
        NULLIF(TRIM(NEW.username), ''),
        'user_' || substring(NEW.id::text from 1 for 8)
    );

    v_display_name := COALESCE(
        NULLIF(TRIM(NEW.full_name), ''),
        v_username
    );

    -- Upsert into social_users; create if missing, update if exists
    INSERT INTO public.social_users (
        id, username, display_name, avatar_url, is_online, last_active,
        created_at, updated_at
    ) VALUES (
        NEW.id,
        v_username,
        v_display_name,
        COALESCE(NEW.avatar_url, ''),
        false,
        now(),
        COALESCE(NEW.created_at, now()),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = COALESCE(
            NULLIF(TRIM(EXCLUDED.display_name), ''),
            social_users.display_name,
            v_username
        ),
        avatar_url   = COALESCE(EXCLUDED.avatar_url, social_users.avatar_url),
        updated_at   = now()
    WHERE EXCLUDED.username IS NOT NULL
      AND EXCLUDED.username != social_users.username;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- NEVER block the parent UPDATE on profiles — social sync is best-effort
    RAISE WARNING 'sync_profile_to_social: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Fix any existing social_users rows with NULL username
UPDATE public.social_users
SET username = COALESCE(NULLIF(username, ''), 'user_' || substring(id::text from 1 for 8))
WHERE username IS NULL OR TRIM(username) = '';

-- ═════════════════════════════════════════════════════════════════════════════
-- PART B: Data-integrity constraints + auth-onboarding RPCs
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. Ensure academic_tier only contains valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_academic_tier_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_academic_tier_check
            CHECK (academic_tier IS NULL OR academic_tier IN ('explorer', 'achiever', 'scholar'));
    END IF;
END $$;

-- 2. Set safe defaults for new rows
ALTER TABLE public.profiles
    ALTER COLUMN academic_tier DROP DEFAULT;

ALTER TABLE public.profiles
    ALTER COLUMN academic_level DROP DEFAULT;

ALTER TABLE public.profiles
    ALTER COLUMN onboarding_completed SET DEFAULT false;

-- 3. Reset incomplete onboarding profiles so they don't get stuck in achiever
UPDATE public.profiles
SET academic_tier = NULL, academic_level = NULL
WHERE onboarding_completed = false;

-- 4. RPC: complete_onboarding — atomic single call that sets ALL onboarding fields
CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_full_name        TEXT DEFAULT NULL,
    p_school           TEXT DEFAULT NULL,
    p_academic_level   TEXT DEFAULT NULL,
    p_academic_tier    TEXT DEFAULT NULL,
    p_learning_style   TEXT DEFAULT NULL,
    p_learning_preferences JSONB DEFAULT NULL,
    p_quiz_preferences JSONB DEFAULT NULL,
    p_personal_context TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_row public.profiles%ROWTYPE;
    v_result JSONB;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    INSERT INTO public.profiles (
        id, email, full_name, school, academic_level, academic_tier,
        learning_style, learning_preferences, quiz_preferences,
        personal_context, onboarding_completed, user_role,
        role_verification_status, updated_at
    ) VALUES (
        v_uid,
        (SELECT email FROM auth.users WHERE id = v_uid),
        COALESCE(p_full_name, ''),
        COALESCE(p_school, ''),
        COALESCE(p_academic_level, 'Undergraduate'),
        COALESCE(p_academic_tier, 'achiever'),
        COALESCE(p_learning_style, 'visual'),
        COALESCE(p_learning_preferences, '{"examples":true,"difficulty":"medium","explanation_style":"detailed"}'::jsonb),
        COALESCE(p_quiz_preferences, '{"difficulty":"intermediate","question_types":["multiple_choice","true_false"],"time_per_question":60}'::jsonb),
        COALESCE(p_personal_context, ''),
        true,
        'student',
        'not_required',
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name            = COALESCE(EXCLUDED.full_name, profiles.full_name),
        school               = COALESCE(EXCLUDED.school, profiles.school),
        academic_level       = COALESCE(EXCLUDED.academic_level, profiles.academic_level),
        academic_tier        = COALESCE(EXCLUDED.academic_tier, profiles.academic_tier),
        learning_style       = COALESCE(EXCLUDED.learning_style, profiles.learning_style),
        learning_preferences = COALESCE(EXCLUDED.learning_preferences, profiles.learning_preferences),
        quiz_preferences     = COALESCE(EXCLUDED.quiz_preferences, profiles.quiz_preferences),
        personal_context     = COALESCE(EXCLUDED.personal_context, profiles.personal_context),
        onboarding_completed = true,
        updated_at           = now()
    RETURNING * INTO v_row;

    v_result := jsonb_build_object(
        'success',              true,
        'id',                   v_row.id,
        'email',                v_row.email,
        'full_name',            v_row.full_name,
        'school',               v_row.school,
        'academic_level',       v_row.academic_level,
        'academic_tier',        v_row.academic_tier,
        'learning_style',       v_row.learning_style,
        'learning_preferences', v_row.learning_preferences,
        'quiz_preferences',     v_row.quiz_preferences,
        'personal_context',     v_row.personal_context,
        'onboarding_completed', v_row.onboarding_completed
    );

    RETURN v_result;
END;
$$;

-- 5. RPC: get_profile — returns the full profile for the authenticated user
CREATE OR REPLACE FUNCTION public.get_profile()
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

    SELECT * INTO v_row FROM public.profiles WHERE id = v_uid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Profile not found'
        );
    END IF;

    RETURN jsonb_build_object(
        'success',              true,
        'id',                   v_row.id,
        'email',                v_row.email,
        'full_name',            v_row.full_name,
        'avatar_url',           v_row.avatar_url,
        'school',               v_row.school,
        'academic_level',       v_row.academic_level,
        'academic_tier',        v_row.academic_tier,
        'learning_style',       v_row.learning_style,
        'learning_preferences', v_row.learning_preferences,
        'quiz_preferences',     v_row.quiz_preferences,
        'personal_context',     v_row.personal_context,
        'onboarding_completed', v_row.onboarding_completed,
        'user_role',            v_row.user_role,
        'points_balance',       v_row.points_balance,
        'bonus_ai_credits',     v_row.bonus_ai_credits,
        'is_public',            v_row.is_public,
        'referral_code',        v_row.referral_code,
        'institution_id',       v_row.institution_id,
        'created_at',           v_row.created_at,
        'updated_at',           v_row.updated_at
    );
END;
$$;

-- 6. RPC: sync_profile — safe upsert from client, merges local → cloud
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
    p_onboarding_completed BOOLEAN DEFAULT NULL
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

    INSERT INTO public.profiles (id, email, user_role, role_verification_status, updated_at)
    VALUES (v_uid, (SELECT email FROM auth.users WHERE id = v_uid), 'student', 'not_required', now())
    ON CONFLICT (id) DO NOTHING;

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
        onboarding_completed = COALESCE(p_onboarding_completed, onboarding_completed),
        updated_at           = now()
    WHERE id = v_uid
    RETURNING * INTO v_row;

    RETURN jsonb_build_object(
        'success',              true,
        'id',                   v_row.id,
        'email',                v_row.email,
        'full_name',            v_row.full_name,
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

-- 7. Grants
GRANT EXECUTE ON FUNCTION public.complete_onboarding(
    TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_profile() TO authenticated;

GRANT EXECUTE ON FUNCTION public.sync_profile(
    TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- PART C: Reset the test user's stale data so onboarding works fresh
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE public.profiles
SET academic_tier = NULL,
    academic_level = 'Undergraduate',
    onboarding_completed = false,
    learning_style = 'visual'
WHERE id = '7ae822ab-5107-4a69-a480-b0d8e2ac3f4a';
