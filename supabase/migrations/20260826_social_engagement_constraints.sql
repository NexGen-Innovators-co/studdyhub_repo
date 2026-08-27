-- 20260826_social_engagement_constraints.sql
-- Guarantees the unique constraints that the API gateway's idempotent
-- like/bookmark upserts require (ON CONFLICT "post_id,user_id").
--
-- Migration 20260325_add_unique_constraints_and_social_schema.sql introduced
-- social_likes_post_user_unique, but production logs show Postgres rejecting
-- the likes upsert with 42P10 ("there is no unique or exclusion constraint
-- matching the ON CONFLICT specification") — i.e. this migration was never
-- applied to the live project. This file re-applies it defensively and covers
-- social_bookmarks, whose gateway handler has the same upsert pattern.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.social_likes'::regclass
          AND conname = 'social_likes_post_user_unique'
    ) THEN
        ALTER TABLE public.social_likes
            ADD CONSTRAINT social_likes_post_user_unique UNIQUE (post_id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.social_bookmarks'::regclass
          AND conname = 'social_bookmarks_post_user_unique'
    ) THEN
        -- De-duplicate any pre-existing repeats before constraining, so the
        -- ALTER cannot fail on a dirty table.
        DELETE FROM public.social_bookmarks a
        USING public.social_bookmarks b
        WHERE a.post_id = b.post_id
          AND a.user_id = b.user_id
          AND a.ctid > b.ctid;

        ALTER TABLE public.social_bookmarks
            ADD CONSTRAINT social_bookmarks_post_user_unique UNIQUE (post_id, user_id);
    END IF;
END $$;

-- Same de-dup guard for likes in case the table already accumulated repeats
-- while the constraint was missing (the app treated every retry as a new row).
DELETE FROM public.social_likes a
USING public.social_likes b
WHERE a.post_id = b.post_id
  AND a.user_id = b.user_id
  AND a.ctid > b.ctid;
