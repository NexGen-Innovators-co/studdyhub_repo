-- ═══════════════════════════════════════════════════════════════════════════
-- SEED SOCIAL_USERS FROM PROFILES
-- Run this in SQL Editor to create social_users for all profiles
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Insert missing social_users from profiles
INSERT INTO public.social_users (
  id, username, display_name, avatar_url, bio, interests,
  is_verified, is_contributor, followers_count, following_count,
  posts_count, last_active, created_at, updated_at, email,
  is_public, status
)
SELECT
  p.id,
  -- Generate unique username from email
  lower(regexp_replace(
    split_part(p.email, '@', 1),
    '[^a-zA-Z0-9_]', '', 'g'
  )) || case
    when length(lower(regexp_replace(split_part(p.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'))) < 3
    then '_' || substring(p.id::text from 1 for 6)
    else ''
  end,
  coalesce(p.full_name, 'Scholar'),
  p.avatar_url,
  'New to the community!',
  ARRAY['learning'],
  false,
  false,
  0,
  0,
  0,
  coalesce(p.created_at, now()),
  coalesce(p.created_at, now()),
  now(),
  p.email,
  true,
  'active'::social_user_status
FROM public.profiles p
LEFT JOIN public.social_users s ON s.id = p.id
WHERE s.id IS NULL
ON CONFLICT (id) DO NOTHING;


-- 2. Update existing social_users with profile data (names, avatars)
UPDATE public.social_users s
SET
  display_name = coalesce(p.full_name, s.display_name),
  avatar_url = coalesce(p.avatar_url, s.avatar_url),
  email = coalesce(p.email, s.email),
  updated_at = now()
FROM public.profiles p
WHERE s.id = p.id
  AND (
    s.display_name IS NULL
    OR s.display_name = 'Scholar'
    OR s.avatar_url IS NULL
    AND p.avatar_url IS NOT NULL
  );


-- 3. Verify: show counts
SELECT
  (SELECT count(*) FROM profiles) AS total_profiles,
  (SELECT count(*) FROM social_users) AS total_social_users,
  (SELECT count(*) FROM profiles p LEFT JOIN social_users s ON s.id = p.id WHERE s.id IS NULL) AS missing_social_users;


-- 4. Show sample of synced users
SELECT
  s.id,
  s.username,
  s.display_name,
  s.avatar_url,
  p.full_name AS profile_name,
  p.avatar_url AS profile_avatar
FROM social_users s
JOIN profiles p ON p.id = s.id
ORDER BY s.created_at DESC
LIMIT 10;
