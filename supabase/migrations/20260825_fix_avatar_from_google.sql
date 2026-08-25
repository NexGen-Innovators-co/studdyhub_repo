-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Extract avatar from Google sign-in raw_user_meta_data
-- and backfill existing users who have null avatars
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Backfill avatars from auth.users.raw_user_meta_data for existing users
--    Google stores the picture in raw_user_meta_data->>'picture'
UPDATE public.profiles p
SET
  avatar_url = u.raw_user_meta_data->>'picture',
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.avatar_url IS NULL
  AND u.raw_user_meta_data->>'picture' IS NOT NULL
  AND u.raw_user_meta_data->>'picture' != '';


-- 2. Also backfill full_name from Google if profiles has default "Scholar"
UPDATE public.profiles p
SET
  full_name = coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    p.full_name
  ),
  updated_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND (p.full_name IS NULL OR p.full_name = 'Scholar')
  AND (
    u.raw_user_meta_data->>'full_name' IS NOT NULL
    OR u.raw_user_meta_data->>'name' IS NOT NULL
  );


-- 3. Sync avatars to social_users from profiles
UPDATE public.social_users s
SET
  avatar_url = p.avatar_url,
  display_name = coalesce(
    CASE WHEN s.display_name = 'Scholar' THEN p.full_name ELSE NULL END,
    s.display_name
  ),
  updated_at = now()
FROM public.profiles p
WHERE s.id = p.id
  AND (
    (s.avatar_url IS NULL AND p.avatar_url IS NOT NULL)
    OR (s.display_name = 'Scholar' AND p.full_name != 'Scholar')
  );


-- 4. Update the social_users trigger to extract avatar from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username text;
  v_avatar_url text;
  v_full_name text;
BEGIN
  -- Generate username from email
  v_username := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'));
  if length(v_username) < 3 then
    v_username := v_username || '_' || substring(NEW.id::text from 1 for 6);
  end if;

  -- Get avatar from auth.users raw_user_meta_data (Google picture)
  SELECT raw_user_meta_data->>'picture' INTO v_avatar_url
  FROM auth.users WHERE id = NEW.id;

  -- Get full name from auth.users raw_user_meta_data
  SELECT coalesce(
    raw_user_meta_data->>'full_name',
    raw_user_meta_data->>'name',
    NEW.full_name,
    'Scholar'
  ) INTO v_full_name
  FROM auth.users WHERE id = NEW.id;

  -- Upsert social_users
  INSERT INTO public.social_users (
    id, username, display_name, avatar_url, bio, interests,
    is_verified, is_contributor, followers_count, following_count,
    posts_count, last_active, created_at, updated_at, email,
    is_public, status
  ) VALUES (
    NEW.id, v_username,
    coalesce(v_full_name, 'Scholar'),
    coalesce(v_avatar_url, NEW.avatar_url),
    'New to the community!',
    ARRAY['learning'], false, false, 0, 0, 0, now(),
    coalesce(NEW.created_at, now()), now(),
    NEW.email, true, 'active'::social_user_status
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE
      WHEN public.social_users.display_name IN ('Scholar', '') THEN coalesce(v_full_name, public.social_users.display_name)
      ELSE public.social_users.display_name
    END,
    avatar_url = coalesce(v_avatar_url, EXCLUDED.avatar_url, public.social_users.avatar_url),
    email = coalesce(EXCLUDED.email, public.social_users.email),
    updated_at = now();

  -- Also update the profiles table avatar if it's null
  IF NEW.avatar_url IS NULL AND v_avatar_url IS NOT NULL THEN
    UPDATE public.profiles SET avatar_url = v_avatar_url, updated_at = now() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


-- 5. Verify results
SELECT
  (SELECT count(*) FROM profiles WHERE avatar_url IS NOT NULL) AS profiles_with_avatar,
  (SELECT count(*) FROM profiles WHERE avatar_url IS NULL) AS profiles_without_avatar,
  (SELECT count(*) FROM social_users WHERE avatar_url IS NOT NULL) AS social_with_avatar,
  (SELECT count(*) FROM social_users WHERE avatar_url IS NULL) AS social_without_avatar;


-- 6. Show sample of synced avatars
SELECT
  p.id,
  p.full_name,
  p.avatar_url,
  s.display_name AS social_name,
  s.avatar_url AS social_avatar
FROM profiles p
JOIN social_users s ON s.id = p.id
WHERE p.avatar_url IS NOT NULL
ORDER BY p.updated_at DESC
LIMIT 10;
