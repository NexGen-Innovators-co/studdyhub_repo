-- Migration: Deduplicate podcast_listeners and add unique constraint
-- Prevents the same user from having multiple listener rows for the same podcast.

-- 1. Delete duplicate rows, keeping only the earliest per (podcast_id, user_id)
DELETE FROM public.podcast_listeners
WHERE id NOT IN (
  SELECT DISTINCT ON (podcast_id, user_id) id
  FROM public.podcast_listeners
  ORDER BY podcast_id, user_id, joined_at ASC
);

-- 2. Add unique constraint to prevent future duplicates
ALTER TABLE public.podcast_listeners
  ADD CONSTRAINT podcast_listeners_podcast_user_unique UNIQUE (podcast_id, user_id);
