-- Migration: Activity tracking triggers for content creation
-- Date: 2026-03-13
-- Purpose: Auto-update user_activity_tracking when users create/interact with content

---============================================================================
-- 1. Trigger for chat session creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_chat_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    last_chat_at = now(),
    chat_sessions_count = chat_sessions_count + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_on_chat_create_trigger ON public.chat_sessions;
CREATE TRIGGER update_activity_on_chat_create_trigger
  AFTER INSERT ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activity_on_chat_create();

---============================================================================
-- 2. Trigger for note creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_note_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    last_note_at = now(),
    notes_count = notes_count + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_on_note_create_trigger ON public.notes;
CREATE TRIGGER update_activity_on_note_create_trigger
  AFTER INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activity_on_note_create();

---============================================================================
-- 3. Trigger for document upload
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_document_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    documents_count = documents_count + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_on_document_create_trigger ON public.documents;
CREATE TRIGGER update_activity_on_document_create_trigger
  AFTER INSERT ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activity_on_document_create();

---============================================================================
-- 4. Trigger for quiz attempt
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_quiz_attempt()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    last_quiz_at = now(),
    quiz_attempts_count = quiz_attempts_count + 1,
    quiz_streak = CASE 
      WHEN last_quiz_at::date = (now() - interval '1 day')::date THEN quiz_streak + 1
      WHEN last_quiz_at::date = now()::date THEN quiz_streak
      ELSE 1
    END
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_on_quiz_attempt_trigger ON public.quiz_attempts;
CREATE TRIGGER update_activity_on_quiz_attempt_trigger
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activity_on_quiz_attempt();

---============================================================================
-- 5. Trigger for social post creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_post_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    last_post_at = now(),
    posts_count = posts_count + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_on_post_create_trigger ON public.social_posts;
CREATE TRIGGER update_activity_on_post_create_trigger
  AFTER INSERT ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activity_on_post_create();

---============================================================================
-- 6. Trigger for group interactions (posts, comments in groups)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_group_interaction()
RETURNS TRIGGER AS $$
BEGIN
  -- For social_comments, check if it's in a group post
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    last_group_interaction_at = now(),
    group_interactions_count = group_interactions_count + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_activity_on_group_comment_trigger ON public.social_comments;
CREATE TRIGGER update_activity_on_group_comment_trigger
  AFTER INSERT ON public.social_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_activity_on_group_interaction();

---============================================================================
-- 7. Trigger for podcast play (if tracked via a table)
-- ============================================================================
-- Note: Uncomment if you have a podcast_plays or similar table
-- CREATE OR REPLACE FUNCTION public.update_activity_on_podcast_play()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   UPDATE public.user_activity_tracking
--   SET
--     last_active = now(),
--     last_podcast_play_at = now()
--   WHERE user_id = NEW.user_id;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- CREATE TRIGGER update_activity_on_podcast_play_trigger
--   AFTER INSERT ON public.podcast_plays
--   FOR EACH ROW
--   EXECUTE FUNCTION public.update_activity_on_podcast_play();

---============================================================================
-- 8. General activity touch trigger for any user action
-- ============================================================================
-- Procedure to call from edge functions to just update last_active
CREATE OR REPLACE FUNCTION public.touch_user_activity(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET last_active = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

---============================================================================
-- 9. Nightly batch update of engagement tiers (optional, runs via cron)
-- ============================================================================
-- This ensures engagement_tier stays current for all users
CREATE OR REPLACE FUNCTION public.update_all_engagement_tiers()
RETURNS TABLE(updated_count INT) AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.user_activity_tracking
  SET
    engagement_tier = public.calculate_engagement_tier(last_active),
    updated_at = now()
  WHERE true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

---============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.touch_user_activity(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_all_engagement_tiers() TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_engagement_tier(TIMESTAMPTZ) TO authenticated, service_role;
