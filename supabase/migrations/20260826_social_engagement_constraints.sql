-- 20260826_social_engagement_constraints.sql
-- Guarantees the unique constraints that the API gateway's idempotent
-- like/view/bookmark upserts require (ON CONFLICT "post_id,user_id").
--
-- Migration 20260325_add_unique_constraints_and_social_schema.sql introduced
-- social_likes_post_user_unique, but production logs show Postgres rejecting
-- the likes upsert with 42P10 ("there is no unique or exclusion constraint
-- matching the ON CONFLICT specification") — i.e. this migration was never
-- applied to the live project. This file re-applies it defensively and covers
-- the rest of the engagement tables that share the same pattern.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

DO $$
BEGIN
    -- Post likes: one like per user per post.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.social_likes'::regclass
          AND conname = 'social_likes_post_user_unique'
    ) THEN
        DELETE FROM public.social_likes a
        USING public.social_likes b
        WHERE a.post_id IS NOT NULL
          AND b.post_id IS NOT NULL
          AND a.post_id = b.post_id
          AND a.user_id = b.user_id
          AND a.ctid > b.ctid;

        ALTER TABLE public.social_likes
            ADD CONSTRAINT social_likes_post_user_unique UNIQUE (post_id, user_id);
    END IF;

    -- Comment likes: one like per user per comment.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.social_likes'::regclass
          AND conname = 'social_likes_comment_user_unique'
    ) THEN
        DELETE FROM public.social_likes a
        USING public.social_likes b
        WHERE a.comment_id IS NOT NULL
          AND b.comment_id IS NOT NULL
          AND a.comment_id = b.comment_id
          AND a.user_id = b.user_id
          AND a.ctid > b.ctid;

        ALTER TABLE public.social_likes
            ADD CONSTRAINT social_likes_comment_user_unique UNIQUE (comment_id, user_id);
    END IF;

    -- View tracking: count a user view once per post.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.social_post_views'::regclass
          AND conname = 'social_post_views_post_user_unique'
    ) THEN
        DELETE FROM public.social_post_views a
        USING public.social_post_views b
        WHERE a.post_id = b.post_id
          AND a.user_id = b.user_id
          AND a.ctid > b.ctid;

        ALTER TABLE public.social_post_views
            ADD CONSTRAINT social_post_views_post_user_unique UNIQUE (post_id, user_id);
    END IF;

    -- Bookmarks: one bookmark per user per post.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.social_bookmarks'::regclass
          AND conname = 'social_bookmarks_post_user_unique'
    ) THEN
        DELETE FROM public.social_bookmarks a
        USING public.social_bookmarks b
        WHERE a.post_id = b.post_id
          AND a.user_id = b.user_id
          AND a.ctid > b.ctid;

        ALTER TABLE public.social_bookmarks
            ADD CONSTRAINT social_bookmarks_post_user_unique UNIQUE (post_id, user_id);
    END IF;
END $$;
