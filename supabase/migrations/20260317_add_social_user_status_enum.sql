-- Migration: Add status enum to social_users table
-- Date: 2026-03-17
-- Purpose: Replace is_verified boolean with status enum for better scalability

-- ─── Step 1: Create the social_user_status enum type ───
CREATE TYPE IF NOT EXISTS public.social_user_status AS ENUM (
  'active',
  'suspended',
  'banned',
  'deactivated'
);

-- ─── Step 2: Add status column to social_users (nullable initially) ───
ALTER TABLE IF EXISTS public.social_users 
ADD COLUMN IF NOT EXISTS status public.social_user_status;

-- ─── Step 3: Migrate data from is_verified to status ───
-- All users default to 'active' (suspension is an admin action, not a default state)
UPDATE public.social_users
SET status = 'active'::public.social_user_status
WHERE status IS NULL;

-- ─── Step 4: Make status NOT NULL with default ───
ALTER TABLE IF EXISTS public.social_users
ALTER COLUMN status SET DEFAULT 'active'::public.social_user_status,
ALTER COLUMN status SET NOT NULL;

-- ─── Step 5: Create index for filtering queries ───
CREATE INDEX IF NOT EXISTS idx_social_users_status 
ON public.social_users(status);

-- ─── Step 6: Update comment/documentation ───
COMMENT ON COLUMN public.social_users.status IS 'Account status: active (normal user), suspended (admin action), banned (moderation action), deactivated (user action)';

-- ─── Optional: Drop is_verified after verification period (run separately) ───
-- ALTER TABLE public.social_users DROP COLUMN is_verified CASCADE;
-- This can be done after 1-2 weeks to ensure no references remain
