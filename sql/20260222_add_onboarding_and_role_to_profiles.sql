-- Migration: Add onboarding_completed and user_role columns to profiles table
-- Required for DB-backed onboarding state and educator role persistence.

-- 1. Add onboarding_completed flag
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 2. Add user_role column with check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'user_role'
  ) THEN
    ALTER TABLE profiles
      ADD COLUMN user_role TEXT DEFAULT 'student'
      CHECK (user_role IN ('student', 'school_admin', 'tutor_affiliated', 'tutor_independent'));
  END IF;
END $$;

-- 3. Add role_verified_at timestamp (nullable — set when role is verified/confirmed)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_verified_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Index for queries filtering by role
CREATE INDEX IF NOT EXISTS idx_profiles_user_role ON profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON profiles(onboarding_completed);

-- 5. Backfill: mark existing users with education profiles as onboarding-completed
UPDATE profiles p
SET onboarding_completed = true
WHERE EXISTS (
  SELECT 1 FROM user_education_profiles uep WHERE uep.user_id = p.id
)
AND p.onboarding_completed = false;

-- 6. Comment documentation
COMMENT ON COLUMN profiles.onboarding_completed IS 'Whether the user has completed the onboarding wizard (DB-backed, survives sign-out)';
COMMENT ON COLUMN profiles.user_role IS 'User role: student, school_admin, tutor_affiliated, or tutor_independent';
COMMENT ON COLUMN profiles.role_verified_at IS 'Timestamp when the user role was verified/confirmed by admin';
