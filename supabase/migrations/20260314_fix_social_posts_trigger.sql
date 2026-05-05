-- Migration: Fix social_posts and social_comments triggers to use author_id instead of user_id
-- Date: 2026-03-14
-- Issue: Triggers were checking NEW.user_id but table schemas use author_id (code 42703)

---============================================================================
-- Fix 1: Trigger for social post creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_post_create()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    last_post_at = now(),
    posts_count = posts_count + 1
  WHERE user_id = NEW.author_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

---============================================================================
-- Fix 2: Trigger for social comment creation (group interactions)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_activity_on_group_interaction()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.user_activity_tracking
  SET
    last_active = now(),
    last_group_interaction_at = now(),
    group_interactions_count = group_interactions_count + 1
  WHERE user_id = NEW.author_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
