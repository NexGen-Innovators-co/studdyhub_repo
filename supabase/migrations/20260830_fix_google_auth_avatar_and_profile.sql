-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Google Auth signup flow — avatar preservation + profile creation
-- Issue 1: complete_onboarding RPC doesn't accept avatar_url → Google avatar lost
-- Issue 2: handle_new_user_social trigger doesn't read raw_user_meta_data
-- ═══════════════════════════════════════════════════════════════════════════


-- 1. Update complete_onboarding RPC to accept avatar_url and extract Google avatar
CREATE OR REPLACE FUNCTION public.complete_onboarding(
    p_full_name        TEXT DEFAULT NULL,
    p_school           TEXT DEFAULT NULL,
    p_academic_level   TEXT DEFAULT NULL,
    p_academic_tier    TEXT DEFAULT NULL,
    p_learning_style   TEXT DEFAULT NULL,
    p_learning_preferences JSONB DEFAULT NULL,
    p_quiz_preferences JSONB DEFAULT NULL,
    p_personal_context TEXT DEFAULT NULL,
    p_avatar_url       TEXT DEFAULT NULL
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
    v_avatar text;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Resolve avatar: explicit param > Google raw_user_meta_data > existing profile
    v_avatar := COALESCE(
        p_avatar_url,
        (SELECT raw_user_meta_data->>'picture' FROM auth.users WHERE id = v_uid),
        ''
    );

    -- Upsert the profile (create if missing, update if exists)
    INSERT INTO public.profiles (
        id, email, full_name, school, academic_level, academic_tier,
        learning_style, learning_preferences, quiz_preferences,
        personal_context, avatar_url, onboarding_completed, user_role,
        role_verification_status, updated_at
    ) VALUES (
        v_uid,
        (SELECT email FROM auth.users WHERE id = v_uid),
        COALESCE(p_full_name, (SELECT coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '') FROM auth.users WHERE id = v_uid)),
        COALESCE(p_school, ''),
        COALESCE(p_academic_level, 'Undergraduate'),
        COALESCE(p_academic_tier, 'achiever'),
        COALESCE(p_learning_style, 'visual'),
        COALESCE(p_learning_preferences, '{"examples":true,"difficulty":"medium","explanation_style":"detailed"}'::jsonb),
        COALESCE(p_quiz_preferences, '{"difficulty":"intermediate","question_types":["multiple_choice","true_false"],"time_per_question":60}'::jsonb),
        COALESCE(p_personal_context, ''),
        CASE WHEN v_avatar = '' THEN NULL ELSE v_avatar END,
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
        avatar_url           = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        onboarding_completed = true,
        updated_at           = now()
    RETURNING * INTO v_row;

    -- Build the response
    v_result := jsonb_build_object(
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
        'onboarding_completed', v_row.onboarding_completed
    );

    RETURN v_result;
END;
$$;


-- 2. Update get_profile to also return avatar_url from Google if missing
CREATE OR REPLACE FUNCTION public.get_profile()
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

    SELECT * INTO v_row FROM public.profiles WHERE id = v_uid;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Profile not found'
        );
    END IF;

    -- Auto-sync Google avatar if profile is missing one
    IF v_row.avatar_url IS NULL OR v_row.avatar_url = '' THEN
        UPDATE public.profiles
        SET avatar_url = (SELECT raw_user_meta_data->>'picture' FROM auth.users WHERE id = v_uid),
            updated_at = now()
        WHERE id = v_uid
          AND (SELECT raw_user_meta_data->>'picture' FROM auth.users WHERE id = v_uid) IS NOT NULL;
        -- Re-read after update
        SELECT * INTO v_row FROM public.profiles WHERE id = v_uid;
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
        'username',             v_row.username
    );
END;
$$;


-- 3. Update handle_new_user_social trigger to extract Google avatar and name
CREATE OR REPLACE FUNCTION public.handle_new_user_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
  v_full_name text;
BEGIN
  -- Generate username from email
  v_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_username) < 3 then
    v_username := v_username || '_' || substring(NEW.id::text from 1 for 6);
  end if;

  -- Extract avatar from auth.users raw_user_meta_data (Google picture)
  SELECT raw_user_meta_data->>'picture' INTO v_avatar_url
  FROM auth.users WHERE id = NEW.id;

  -- Extract full name from auth.users raw_user_meta_data (Google name)
  SELECT coalesce(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    NEW.full_name,
    'Scholar'
  ) INTO v_full_name
  FROM auth.users WHERE id = NEW.id;

  -- Upsert social_users
  INSERT INTO public.social_users (
    id, username, display_name, avatar_url, bio, interests,
    is_verified, is_contributor, followers_count, following_count,
    posts_count, last_active, created_at, updated_at, email,
    is_public, status
  ) VALUES (
    NEW.id, v_username,
    coalesce(v_full_name, 'Scholar'),
    coalesce(v_avatar_url, NEW.avatar_url),
    'New to the community!',
    ARRAY['learning'], false, false, 0, 0, 0, now(),
    coalesce(NEW.created_at, now()), now(),
    NEW.email, true, 'active'::social_user_status
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE
      WHEN public.social_users.display_name IN ('Scholar', '') THEN coalesce(v_full_name, public.social_users.display_name)
      ELSE public.social_users.display_name
    END,
    avatar_url = coalesce(v_avatar_url, EXCLUDED.avatar_url, public.social_users.avatar_url),
    email = coalesce(EXCLUDED.email, public.social_users.email),
    updated_at = now();

  -- Also update the profiles table avatar if it's null
  IF v_avatar_url IS NOT NULL AND (NEW.avatar_url IS NULL OR NEW.avatar_url = '') THEN
    UPDATE public.profiles SET avatar_url = v_avatar_url, updated_at = now() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


-- 4. Backfill: sync Google avatars for all existing profiles missing them
UPDATE public.profiles p
SET
  avatar_url = u.raw_user_meta_data->>'picture',
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND (p.avatar_url IS NULL OR p.avatar_url = '')
  AND u.raw_user_meta_data->>'picture' IS NOT NULL
  AND u.raw_user_meta_data->>'picture' != '';

-- Also backfill full_name for profiles with default name
UPDATE public.profiles p
SET
  full_name = coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    p.full_name
  ),
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND (p.full_name IS NULL OR p.full_name IN ('Scholar', 'New Scholar'))
  AND (
    u.raw_user_meta_data->>'full_name' IS NOT NULL
    OR u.raw_user_meta_data->>'name' IS NOT NULL
  );
