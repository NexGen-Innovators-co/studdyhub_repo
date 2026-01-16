-- Migration to add notification triggers for Social Actions
-- This populates the 'notifications' table.
-- To send PUSH notifications, configure a Database Webhook in Supabase Dashboard:
--   Table: notifications
--   Events: INSERT
--   URL: [YOUR_PROJECT_URL]/functions/v1/send-notification
--   Headers: Authorization: Bearer [SERVICE_ROLE_KEY]

-- 1. Function to notify post owner on new comment
CREATE OR REPLACE FUNCTION public.handle_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
    preview_text TEXT;
BEGIN
    -- Get post owner
    SELECT user_id INTO post_owner_id
    FROM public.social_posts
    WHERE id = NEW.post_id;

    -- Ignore if commenting on own post
    IF post_owner_id IS NOT NULL AND post_owner_id != NEW.author_id THEN
        preview_text := substring(NEW.content from 1 for 50);
        IF length(NEW.content) > 50 THEN
            preview_text := preview_text || '...';
        END IF;

        INSERT INTO public.notifications (user_id, type, title, message, data, read)
        VALUES (
            post_owner_id,
            'social_comment',
            'New Comment',
            'Someone commented: ' || preview_text,
            jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id),
            false
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger for Comments
DROP TRIGGER IF EXISTS on_social_comment_insert ON public.social_comments;
CREATE TRIGGER on_social_comment_insert
AFTER INSERT ON public.social_comments
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_comment_notification();


-- 3. Function to notify post owner on like
CREATE OR REPLACE FUNCTION public.handle_new_like_notification()
RETURNS TRIGGER AS $$
DECLARE
    post_owner_id UUID;
BEGIN
    -- Get post owner
    SELECT user_id INTO post_owner_id
    FROM public.social_posts
    WHERE id = NEW.post_id;

    -- Ignore if liking own post
    IF post_owner_id IS NOT NULL AND post_owner_id != NEW.user_id THEN
        -- Check if notification already exists to avoid spam (optional, but good for likes)
        -- For now, we just insert. The client/edge function can dedupe if needed.
        
        INSERT INTO public.notifications (user_id, type, title, message, data, read)
        VALUES (
            post_owner_id,
            'social_like',
            'New Like',
            'Someone liked your post',
            jsonb_build_object('post_id', NEW.post_id),
            false
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger for Likes
DROP TRIGGER IF EXISTS on_social_like_insert ON public.social_likes;
CREATE TRIGGER on_social_like_insert
AFTER INSERT ON public.social_likes
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_like_notification();

-- 5. Helper function for schedule reminders (if not using cron only)
-- Note: Schedule reminders are typically poll-based (Cron) because they depend on TIME, not INSERT events.
-- The existing check-schedule-reminders function handles this.

