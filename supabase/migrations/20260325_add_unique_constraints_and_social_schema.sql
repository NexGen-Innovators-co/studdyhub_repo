-- Migration: Add UNIQUE constraints and triggers for social tables
-- Date: 2026-03-25

-- 1. Ensure UNIQUE constraints exist on social tables to prevent PostgREST ON CONFLICT errors
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'social_likes_post_user_unique'
    ) THEN
        ALTER TABLE public.social_likes 
        ADD CONSTRAINT social_likes_post_user_unique UNIQUE (post_id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'social_bookmarks_post_user_unique'
    ) THEN
        ALTER TABLE public.social_bookmarks 
        ADD CONSTRAINT social_bookmarks_post_user_unique UNIQUE (post_id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'social_group_members_group_user_unique'
    ) THEN
        ALTER TABLE public.social_group_members 
        ADD CONSTRAINT social_group_members_group_user_unique UNIQUE (group_id, user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'social_follows_follower_following_unique'
    ) THEN
        ALTER TABLE public.social_follows 
        ADD CONSTRAINT social_follows_follower_following_unique UNIQUE (follower_id, following_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'course_enrollments_user_course_unique'
    ) THEN
        ALTER TABLE public.course_enrollments 
        ADD CONSTRAINT course_enrollments_user_course_unique UNIQUE (user_id, course_id);
    END IF;
END $$;

-- 2. Enable RLS on social tables if not already enabled
ALTER TABLE IF EXISTS public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.social_users ENABLE ROW LEVEL SECURITY;

-- 3. Add permissive read/write policies for public social interactions
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public social users read" ON public.social_users;
    CREATE POLICY "Public social users read" ON public.social_users FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Public social users insert/update" ON public.social_users;
    CREATE POLICY "Public social users insert/update" ON public.social_users FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social posts read" ON public.social_posts;
    CREATE POLICY "Public social posts read" ON public.social_posts FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Public social posts insert/update/delete" ON public.social_posts;
    CREATE POLICY "Public social posts insert/update/delete" ON public.social_posts FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social likes full access" ON public.social_likes;
    CREATE POLICY "Public social likes full access" ON public.social_likes FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social bookmarks full access" ON public.social_bookmarks;
    CREATE POLICY "Public social bookmarks full access" ON public.social_bookmarks FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social comments full access" ON public.social_comments;
    CREATE POLICY "Public social comments full access" ON public.social_comments FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social groups full access" ON public.social_groups;
    CREATE POLICY "Public social groups full access" ON public.social_groups FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social group members full access" ON public.social_group_members;
    CREATE POLICY "Public social group members full access" ON public.social_group_members FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social chat messages full access" ON public.social_chat_messages;
    CREATE POLICY "Public social chat messages full access" ON public.social_chat_messages FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social events full access" ON public.social_events;
    CREATE POLICY "Public social events full access" ON public.social_events FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public social follows full access" ON public.social_follows;
    CREATE POLICY "Public social follows full access" ON public.social_follows FOR ALL USING (true) WITH CHECK (true);
END $$;
