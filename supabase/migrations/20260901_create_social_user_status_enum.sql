-- FIX: Create missing social_user_status enum type
-- This was referenced by handle_new_user_social trigger but never created,
-- causing "Database error saving new user" (500) on every new Google sign-up.

DO $$ BEGIN
  CREATE TYPE public.social_user_status AS ENUM ('active', 'suspended', 'banned', 'deactivated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
