-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EXPAND APP_STATS TABLE
-- ═══════════════════════════════════════════════════════════════════════════

-- Add new columns (one at a time to avoid batch ALTER issues)
ALTER TABLE public.app_stats ADD COLUMN IF NOT EXISTS total_users text NOT NULL DEFAULT '0';
ALTER TABLE public.app_stats ADD COLUMN IF NOT EXISTS quizzes_taken text NOT NULL DEFAULT '0';
ALTER TABLE public.app_stats ADD COLUMN IF NOT EXISTS documents_uploaded text NOT NULL DEFAULT '0';
ALTER TABLE public.app_stats ADD COLUMN IF NOT EXISTS podcasts_generated text NOT NULL DEFAULT '0';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. UPDATE APP_STATS FUNCTION (expanded)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_app_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_users bigint;
  v_total_users bigint;
  v_notes_count bigint;
  v_quizzes_count bigint;
  v_documents_count bigint;
  v_podcasts_count bigint;
  v_rating numeric;
BEGIN
  -- Count users who signed in within the last 30 days
  SELECT count(*) INTO v_active_users
  FROM auth.users
  WHERE last_sign_in_at > now() - interval '30 days';

  -- Total registered users
  SELECT count(*) INTO v_total_users
  FROM auth.users;

  -- Count total notes
  SELECT count(*) INTO v_notes_count
  FROM public.notes;

  -- Count total quizzes taken (quiz_attempts)
  SELECT count(*) INTO v_quizzes_count
  FROM public.quiz_attempts;

  -- Count total documents
  SELECT count(*) INTO v_documents_count
  FROM public.documents;

  -- Count total podcasts
  SELECT count(*) INTO v_podcasts_count
  FROM public.ai_podcasts;

  -- Get app rating (default to 4.9 if no ratings exist)
  SELECT coalesce(avg(rating), 4.9) INTO v_rating
  FROM public.app_ratings;

  -- Helper: format large numbers (1234 → "1.2k+", 12345 → "12k+")
  -- Update the single app_stats row
  UPDATE public.app_stats
  SET
    active_users = CASE
      WHEN v_active_users >= 1000 THEN round(v_active_users / 1000.0, 1)::text || 'k+'
      WHEN v_active_users > 0 THEN v_active_users::text || '+'
      ELSE '0+'
    END,
    total_users = CASE
      WHEN v_total_users >= 1000 THEN round(v_total_users / 1000.0, 1)::text || 'k+'
      WHEN v_total_users > 0 THEN v_total_users::text
      ELSE '0'
    END,
    notes_processed = CASE
      WHEN v_notes_count >= 1000 THEN round(v_notes_count / 1000.0, 1)::text || 'k+'
      WHEN v_notes_count > 0 THEN v_notes_count::text || '+'
      ELSE '0+'
    END,
    quizzes_taken = CASE
      WHEN v_quizzes_count >= 1000 THEN round(v_quizzes_count / 1000.0, 1)::text || 'k+'
      WHEN v_quizzes_count > 0 THEN v_quizzes_count::text || '+'
      ELSE '0+'
    END,
    documents_uploaded = CASE
      WHEN v_documents_count >= 1000 THEN round(v_documents_count / 1000.0, 1)::text || 'k+'
      WHEN v_documents_count > 0 THEN v_documents_count::text || '+'
      ELSE '0+'
    END,
    podcasts_generated = CASE
      WHEN v_podcasts_count >= 1000 THEN round(v_podcasts_count / 1000.0, 1)::text || 'k+'
      WHEN v_podcasts_count > 0 THEN v_podcasts_count::text || '+'
      ELSE '0+'
    END,
    user_rating = round(v_rating, 1)::text || '/5',
    uptime = '99.9%',
    updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

  -- If no row exists, insert one
  IF NOT FOUND THEN
    INSERT INTO public.app_stats (id, active_users, total_users, notes_processed, quizzes_taken, documents_uploaded, podcasts_generated, uptime, user_rating)
    VALUES (
      '00000000-0000-0000-0000-000000000001'::uuid,
      CASE WHEN v_active_users >= 1000 THEN round(v_active_users / 1000.0, 1)::text || 'k+'
           WHEN v_active_users > 0 THEN v_active_users::text || '+'
           ELSE '0+' END,
      CASE WHEN v_total_users >= 1000 THEN round(v_total_users / 1000.0, 1)::text || 'k+'
           WHEN v_total_users > 0 THEN v_total_users::text
           ELSE '0' END,
      CASE WHEN v_notes_count >= 1000 THEN round(v_notes_count / 1000.0, 1)::text || 'k+'
           WHEN v_notes_count > 0 THEN v_notes_count::text || '+'
           ELSE '0+' END,
      CASE WHEN v_quizzes_count >= 1000 THEN round(v_quizzes_count / 1000.0, 1)::text || 'k+'
           WHEN v_quizzes_count > 0 THEN v_quizzes_count::text || '+'
           ELSE '0+' END,
      CASE WHEN v_documents_count >= 1000 THEN round(v_documents_count / 1000.0, 1)::text || 'k+'
           WHEN v_documents_count > 0 THEN v_documents_count::text || '+'
           ELSE '0+' END,
      CASE WHEN v_podcasts_count >= 1000 THEN round(v_podcasts_count / 1000.0, 1)::text || 'k+'
           WHEN v_podcasts_count > 0 THEN v_podcasts_count::text || '+'
           ELSE '0+' END,
      '99.9%',
      round(v_rating, 1)::text || '/5'
    );
  END IF;
END;
$$;

-- Run immediately to populate with current data
SELECT public.update_app_stats();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. AUTO-CREATE SOCIAL_USERS ON SIGNUP (server-side trigger)
-- ═══════════════════════════════════════════════════════════════════════════

-- This function runs automatically when a new profile is created
-- It creates the corresponding social_users record so the app doesn't have to.
CREATE OR REPLACE FUNCTION public.handle_new_user_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_full_name text;
  v_avatar_url text;
  v_username text;
BEGIN
  -- Extract name from profile or user metadata
  v_full_name := coalesce(NEW.full_name, 'Scholar');
  v_avatar_url := NEW.avatar_url;

  -- Generate a unique username from email or name
  v_username := split_part(NEW.email, '@', 1);
  -- Clean username: remove special chars, lowercase
  v_username := lower(regexp_replace(v_username, '[^a-zA-Z0-9_]', '', 'g'));
  -- Ensure minimum length
  if length(v_username) < 3 then
    v_username := v_username || '_' || substring(NEW.id::text from 1 for 6);
  end if;

  -- Upsert social_users (idempotent — safe to run multiple times)
  INSERT INTO public.social_users (
    id, username, display_name, avatar_url, bio, interests,
    is_verified, is_contributor, followers_count, following_count,
    posts_count, last_active, created_at, updated_at, email,
    is_public, status
  ) VALUES (
    NEW.id,
    v_username,
    v_full_name,
    v_avatar_url,
    'New to the community!',
    ARRAY['learning'],
    false,
    false,
    0,
    0,
    0,
    now(),
    now(),
    now(),
    NEW.email,
    true,
    'active'::social_user_status
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Only update if the social_user record is missing key data
    username = COALESCE(EXCLUDED.username, public.social_users.username),
    display_name = COALESCE(EXCLUDED.display_name, public.social_users.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.social_users.avatar_url),
    email = COALESCE(EXCLUDED.email, public.social_users.email),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table
-- When a profile is created (user signup), auto-create social_users
DROP TRIGGER IF EXISTS on_profile_create_social ON public.profiles;
CREATE TRIGGER on_profile_create_social
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_social();


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. AUTO-UPDATE APP_STATS TRIGGER (debounced)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_update_app_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Debounce: only update if more than 5 minutes since last update
  IF (now() - coalesce(
    (SELECT updated_at FROM public.app_stats WHERE id = '00000000-0000-0000-0000-000000000001'::uuid),
    now() - interval '1 hour'
  )) > interval '5 minutes'
  THEN
    PERFORM public.update_app_stats();
  END IF;
  RETURN NEW;
END;
$$;

-- Triggers on key tables to keep app_stats fresh
DROP TRIGGER IF EXISTS on_profile_change_update_stats ON public.profiles;
CREATE TRIGGER on_profile_change_update_stats
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_update_app_stats();

DROP TRIGGER IF EXISTS on_note_change_update_stats ON public.notes;
CREATE TRIGGER on_note_change_update_stats
  AFTER INSERT ON public.notes
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_update_app_stats();

DROP TRIGGER IF EXISTS on_quiz_attempt_update_stats ON public.quiz_attempts;
CREATE TRIGGER on_quiz_attempt_update_stats
  AFTER INSERT ON public.quiz_attempts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_update_app_stats();

DROP TRIGGER IF EXISTS on_document_change_update_stats ON public.documents;
CREATE TRIGGER on_document_change_update_stats
  AFTER INSERT ON public.documents
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_update_app_stats();

DROP TRIGGER IF EXISTS on_podcast_change_update_stats ON public.ai_podcasts;
CREATE TRIGGER on_podcast_change_update_stats
  AFTER INSERT ON public.ai_podcasts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_update_app_stats();


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SEED EXISTING USERS INTO SOCIAL_USERS
-- ═══════════════════════════════════════════════════════════════════════════

-- For all existing users who don't have a social_users record yet
INSERT INTO public.social_users (
  id, username, display_name, avatar_url, bio, interests,
  is_verified, is_contributor, followers_count, following_count,
  posts_count, last_active, created_at, updated_at, email,
  is_public, status
)
SELECT
  p.id,
  lower(regexp_replace(split_part(p.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'))
    || case when length(lower(regexp_replace(split_part(p.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'))) < 3
       then '_' || substring(p.id::text from 1 for 6) else '' end,
  coalesce(p.full_name, 'Scholar'),
  p.avatar_url,
  'New to the community!',
  ARRAY['learning'],
  false,
  false,
  0,
  0,
  0,
  coalesce(p.created_at, now()),
  coalesce(p.created_at, now()),
  now(),
  p.email,
  true,
  'active'::social_user_status
FROM public.profiles p
LEFT JOIN public.social_users s ON s.id = p.id
WHERE s.id IS NULL
ON CONFLICT (id) DO NOTHING;
