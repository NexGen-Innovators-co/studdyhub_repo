-- Fix the social_users trigger to properly sync data from profiles
-- This handles the case where social_users already exists (from import)

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
  -- Extract name from profile
  v_full_name := coalesce(NEW.full_name, 'Scholar');
  v_avatar_url := NEW.avatar_url;

  -- Generate username from email
  v_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_username) < 3 then
    v_username := v_username || '_' || substring(NEW.id::text from 1 for 6);
  end if;

  -- Upsert: create or update social_users
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
    coalesce(NEW.created_at, now()),
    now(),
    NEW.email,
    true,
    'active'::social_user_status
  )
  ON CONFLICT (id) DO UPDATE SET
    -- Sync display_name and avatar from profile if social_users has defaults
    display_name = CASE
      WHEN public.social_users.display_name = 'Scholar' THEN EXCLUDED.display_name
      ELSE public.social_users.display_name
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.social_users.avatar_url),
    email = COALESCE(EXCLUDED.email, public.social_users.email),
    updated_at = now();

  RETURN NEW;
END;
$$;
