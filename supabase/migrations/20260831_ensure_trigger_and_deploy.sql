-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Ensure handle_new_user_social trigger exists on profiles
-- The function was created in earlier migrations but the trigger may not
-- have been applied if migrations were run out of order or partially.
-- Also ensures the social_user_status enum and social_users table exist.
-- ═══════════════════════════════════════════════════════════════════════════

-- 0. Ensure social_user_status enum type exists
DO $$ BEGIN
  CREATE TYPE public.social_user_status AS ENUM ('active', 'suspended', 'banned', 'deactivated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 0b. Ensure social_users table exists (minimal schema if missing)
CREATE TABLE IF NOT EXISTS public.social_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT 'Scholar',
  avatar_url TEXT,
  bio TEXT DEFAULT 'New to the community!',
  interests TEXT[] DEFAULT ARRAY['learning'],
  email TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_contributor BOOLEAN DEFAULT false,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT true,
  status public.social_user_status DEFAULT 'active',
  last_active TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 0c. Add status column to social_users if it doesn't exist
DO $$ BEGIN
  ALTER TABLE public.social_users ADD COLUMN IF NOT EXISTS status public.social_user_status DEFAULT 'active';
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- 1. Ensure the function exists (idempotent — CREATE OR REPLACE)
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

  -- Extract avatar from auth.users raw_user_meta_data (Google picture)
  SELECT raw_user_meta_data->>'picture' INTO v_avatar_url
  FROM auth.users WHERE id = NEW.id;

  -- Extract full name from auth.users raw_user_meta_data (Google name)
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
  IF v_avatar_url IS NOT NULL AND (NEW.avatar_url IS NULL OR NEW.avatar_url = '') THEN
    UPDATE public.profiles SET avatar_url = v_avatar_url, updated_at = now() WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Drop trigger if it exists, then recreate (ensures clean state)
DROP TRIGGER IF EXISTS on_profile_create_social ON public.profiles;
CREATE TRIGGER on_profile_create_social
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_social();

-- 3. Verify
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'profiles'
      AND t.tgname = 'on_profile_create_social'
      AND NOT t.tgisdisabled
  ) THEN
    RAISE NOTICE '✅ Trigger on_profile_create_social is active on public.profiles';
  ELSE
    RAISE WARNING '❌ Trigger on_profile_create_social is NOT active';
  END IF;
END $$;
