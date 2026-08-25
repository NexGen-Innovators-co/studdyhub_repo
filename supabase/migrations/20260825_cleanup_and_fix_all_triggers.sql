-- ═══════════════════════════════════════════════════════════════════════════
-- CLEANUP: Remove duplicate/old triggers and recreate properly
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop ALL old app_stats triggers (we'll recreate them cleanly)
DROP TRIGGER IF EXISTS on_note_change_update_stats ON public.notes;
DROP TRIGGER IF EXISTS on_profile_change_update_stats ON public.profiles;
DROP TRIGGER IF EXISTS on_quiz_attempt_update_stats ON public.quiz_attempts;
DROP TRIGGER IF EXISTS on_document_change_update_stats ON public.documents;
DROP TRIGGER IF EXISTS on_podcast_change_update_stats ON public.ai_podcasts;

-- Drop old duplicate triggers from previous migrations
DROP TRIGGER IF EXISTS trg_update_app_stats_on_notes ON public.notes;
DROP TRIGGER IF EXISTS trg_update_app_stats_on_notes_update ON public.notes;
DROP TRIGGER IF EXISTS trg_update_app_stats_on_profiles ON public.profiles;
DROP TRIGGER IF EXISTS trg_update_app_stats_on_profiles_update ON public.profiles;

-- Drop the old function if it exists (different name)
DROP FUNCTION IF EXISTS public.update_app_stats_function();


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. RECREATE APP_STATS FUNCTION (clean version)
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
  SELECT count(*) INTO v_active_users
  FROM auth.users WHERE last_sign_in_at > now() - interval '30 days';

  SELECT count(*) INTO v_total_users
  FROM auth.users;

  SELECT count(*) INTO v_notes_count FROM public.notes;
  SELECT count(*) INTO v_quizzes_count FROM public.quiz_attempts;
  SELECT count(*) INTO v_documents_count FROM public.documents;
  SELECT count(*) INTO v_podcasts_count FROM public.ai_podcasts;

  SELECT coalesce(avg(rating), 4.9) INTO v_rating
  FROM public.app_ratings;

  UPDATE public.app_stats SET
    active_users = CASE WHEN v_active_users >= 1000 THEN round(v_active_users/1000.0,1)::text||'k+' WHEN v_active_users > 0 THEN v_active_users::text||'+' ELSE '0+' END,
    total_users = CASE WHEN v_total_users >= 1000 THEN round(v_total_users/1000.0,1)::text||'k+' WHEN v_total_users > 0 THEN v_total_users::text ELSE '0' END,
    notes_processed = CASE WHEN v_notes_count >= 1000 THEN round(v_notes_count/1000.0,1)::text||'k+' WHEN v_notes_count > 0 THEN v_notes_count::text||'+' ELSE '0+' END,
    quizzes_taken = CASE WHEN v_quizzes_count >= 1000 THEN round(v_quizzes_count/1000.0,1)::text||'k+' WHEN v_quizzes_count > 0 THEN v_quizzes_count::text||'+' ELSE '0+' END,
    documents_uploaded = CASE WHEN v_documents_count >= 1000 THEN round(v_documents_count/1000.0,1)::text||'k+' WHEN v_documents_count > 0 THEN v_documents_count::text||'+' ELSE '0+' END,
    podcasts_generated = CASE WHEN v_podcasts_count >= 1000 THEN round(v_podcasts_count/1000.0,1)::text||'k+' WHEN v_podcasts_count > 0 THEN v_podcasts_count::text||'+' ELSE '0+' END,
    user_rating = round(v_rating,1)::text||'/5',
    uptime = '99.9%',
    updated_at = now()
  WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

  IF NOT FOUND THEN
    INSERT INTO public.app_stats (id, active_users, total_users, notes_processed, quizzes_taken, documents_uploaded, podcasts_generated, uptime, user_rating)
    VALUES ('00000000-0000-0000-0000-000000000001'::uuid,
      CASE WHEN v_active_users >= 1000 THEN round(v_active_users/1000.0,1)::text||'k+' WHEN v_active_users > 0 THEN v_active_users::text||'+' ELSE '0+' END,
      CASE WHEN v_total_users >= 1000 THEN round(v_total_users/1000.0,1)::text||'k+' WHEN v_total_users > 0 THEN v_total_users::text ELSE '0' END,
      CASE WHEN v_notes_count >= 1000 THEN round(v_notes_count/1000.0,1)::text||'k+' WHEN v_notes_count > 0 THEN v_notes_count::text||'+' ELSE '0+' END,
      CASE WHEN v_quizzes_count >= 1000 THEN round(v_quizzes_count/1000.0,1)::text||'k+' WHEN v_quizzes_count > 0 THEN v_quizzes_count::text||'+' ELSE '0+' END,
      CASE WHEN v_documents_count >= 1000 THEN round(v_documents_count/1000.0,1)::text||'k+' WHEN v_documents_count > 0 THEN v_documents_count::text||'+' ELSE '0+' END,
      CASE WHEN v_podcasts_count >= 1000 THEN round(v_podcasts_count/1000.0,1)::text||'k+' WHEN v_podcasts_count > 0 THEN v_podcasts_count::text||'+' ELSE '0+' END,
      '99.9%', round(v_rating,1)::text||'/5');
  END IF;
END;
$$;

SELECT public.update_app_stats();


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. RECREATE STATS TRIGGER (debounced, one per table)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.trigger_update_app_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (now() - coalesce(
    (SELECT updated_at FROM public.app_stats WHERE id = '00000000-0000-0000-0000-000000000001'::uuid),
    now() - interval '1 hour'
  )) > interval '5 minutes' THEN
    PERFORM public.update_app_stats();
  END IF;
  RETURN NEW;
END;
$$;

-- Create ONE trigger per table (AFTER INSERT)
CREATE TRIGGER on_note_change_update_stats
  AFTER INSERT ON public.notes
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_update_app_stats();

CREATE TRIGGER on_profile_change_update_stats
  AFTER INSERT ON public.profiles
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_update_app_stats();

CREATE TRIGGER on_quiz_attempt_update_stats
  AFTER INSERT ON public.quiz_attempts
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_update_app_stats();

CREATE TRIGGER on_document_change_update_stats
  AFTER INSERT ON public.documents
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_update_app_stats();

CREATE TRIGGER on_podcast_change_update_stats
  AFTER INSERT ON public.ai_podcasts
  FOR EACH STATEMENT EXECUTE FUNCTION public.trigger_update_app_stats();


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SOCIAL_USERS TRIGGER (auto-create on profile insert)
-- ═══════════════════════════════════════════════════════════════════════════

DROP TRIGGER IF EXISTS on_profile_create_social ON public.profiles;

CREATE OR REPLACE FUNCTION public.handle_new_user_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
BEGIN
  v_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_username) < 3 then
    v_username := v_username || '_' || substring(NEW.id::text from 1 for 6);
  end if;

  INSERT INTO public.social_users (
    id, username, display_name, avatar_url, bio, interests,
    is_verified, is_contributor, followers_count, following_count,
    posts_count, last_active, created_at, updated_at, email,
    is_public, status
  ) VALUES (
    NEW.id, v_username,
    coalesce(NEW.full_name, 'Scholar'),
    NEW.avatar_url,
    'New to the community!',
    ARRAY['learning'], false, false, 0, 0, 0, now(),
    coalesce(NEW.created_at, now()), now(),
    NEW.email, true, 'active'::social_user_status
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE WHEN public.social_users.display_name = 'Scholar' THEN EXCLUDED.display_name ELSE public.social_users.display_name END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.social_users.avatar_url),
    email = COALESCE(EXCLUDED.email, public.social_users.email),
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_create_social
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_social();


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. VERIFY: Run the checks
-- ═══════════════════════════════════════════════════════════════════════════

-- Check no duplicates remain
SELECT
  c.relname AS table_name,
  p.proname AS function_name,
  count(*) AS trigger_count,
  CASE WHEN count(*) > 1 THEN '⚠️ DUPLICATE' ELSE '✅ OK' END AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND NOT t.tgisinternal
  AND p.proname IN ('trigger_update_app_stats', 'handle_new_user_social')
GROUP BY c.relname, p.proname;

-- Check app_stats
SELECT * FROM app_stats;

-- Check social_users count
SELECT
  (SELECT count(*) FROM profiles) AS profiles,
  (SELECT count(*) FROM social_users) AS social_users,
  (SELECT count(*) FROM profiles p LEFT JOIN social_users s ON s.id = p.id WHERE s.id IS NULL) AS missing;
