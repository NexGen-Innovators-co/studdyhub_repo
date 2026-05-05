-- ============================================================
-- complete_onboarding()  — SECURITY DEFINER helper
-- ============================================================
-- Bypasses the self-referencing profiles_update_own_restricted
-- RLS policy that causes infinite recursion (42P17) when the
-- onboarding wizard tries to update the user's profile.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _email              text        DEFAULT NULL,
  _full_name          text        DEFAULT NULL,
  _institution_id     uuid        DEFAULT NULL,
  _school             text        DEFAULT NULL,
  _avatar_url         text        DEFAULT NULL,
  _learning_style     text        DEFAULT NULL,
  _learning_prefs     jsonb       DEFAULT NULL,
  _user_role          text        DEFAULT 'student',
  _personal_context   text        DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid  uuid := auth.uid();
  _row  profiles%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    email                = COALESCE(NULLIF(TRIM(_email), ''), email),
    full_name            = COALESCE(NULLIF(TRIM(_full_name), ''), full_name),
    institution_id       = COALESCE(_institution_id, institution_id),
    school               = COALESCE(NULLIF(TRIM(_school), ''), school),
    avatar_url           = COALESCE(_avatar_url, avatar_url),
    learning_style       = COALESCE(NULLIF(TRIM(_learning_style), ''), learning_style),
    learning_preferences = COALESCE(_learning_prefs, learning_preferences),
    user_role            = COALESCE(NULLIF(TRIM(_user_role), ''), user_role),
    personal_context     = CASE
                             WHEN _personal_context IS NOT NULL THEN _personal_context
                             ELSE personal_context
                           END,
    onboarding_completed = true,
    updated_at           = now()
  WHERE id = _uid
  RETURNING * INTO _row;

  RETURN row_to_json(_row);
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.complete_onboarding(text, text, uuid, text, text, text, jsonb, text, text) TO authenticated;
