-- Backfill social_users.last_login_at and last_active from Supabase auth.users data
--
-- Purpose: The new realtime/verification flow tracks last_login_at via
-- `track_user_login()` (which updates social_users). Existing users who
-- logged in before that mechanism existed may have NULL/empty values.
--
-- This script uses `auth.users.last_sign_in_at` (Supabase Auth) as a source
-- of truth for the most recent login timestamp.

-- NOTE: Run this once in the database (e.g. via psql, Supabase SQL editor, or migration runner).

BEGIN;

UPDATE public.social_users su
SET
  last_login_at = COALESCE(u.last_sign_in_at, su.last_login_at),
  last_active = COALESCE(u.last_sign_in_at, su.last_active)
FROM auth.users u
WHERE su.id = u.id
  AND (su.last_login_at IS NULL OR su.last_active IS NULL)
  AND u.last_sign_in_at IS NOT NULL;

-- Optionally, you can also mark users as active if they logged in recently:
-- UPDATE public.social_users
-- SET status = 'active'
-- WHERE last_login_at >= NOW() - INTERVAL '30 days';

COMMIT;

-- Verify results
-- SELECT id, last_login_at, last_active
-- FROM public.social_users
-- WHERE last_login_at IS NOT NULL
-- ORDER BY last_login_at DESC
-- LIMIT 20;
