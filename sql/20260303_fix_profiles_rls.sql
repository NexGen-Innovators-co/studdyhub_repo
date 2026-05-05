-- ============================================================
-- 20260303: Ensure profile update policy is fully qualified
-- ============================================================

-- This migration re-declares the `profiles_update_own_restricted` policy
-- to eliminate any ambiguity in case an older version without proper
-- qualification is still present in the database.  A 500 error was
-- occurring when PATCHing a profile (school change) due to an ambiguous
-- column reference in an RLS policy for the "profiles" table.

DROP POLICY IF EXISTS profiles_update_own_restricted ON public.profiles;

CREATE POLICY profiles_update_own_restricted ON public.profiles
    FOR UPDATE USING (auth.uid() = public.profiles.id)
    WITH CHECK (
        auth.uid() = public.profiles.id
        AND (
            -- allow if the role hasn't changed or user is downgrading
            public.profiles.user_role IS NOT DISTINCT FROM (
                SELECT p.user_role
                FROM public.profiles p
                WHERE p.id = auth.uid()
            )
            OR public.profiles.user_role = 'student'::text
        )
    );

-- helper to fetch current user's role without invoking RLS
-- used by the restricted update policy below
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_role
  FROM public.profiles
  WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO public;

-- also update the simple "own" policy just in case
ALTER POLICY profiles_update_own ON public.profiles
    USING (auth.uid() = public.profiles.id)
    WITH CHECK (auth.uid() = public.profiles.id);

-- finally, ensure the restricted policy uses the helper instead of a
-- self-referential subquery which triggered recursion and denied updates
DROP POLICY IF EXISTS profiles_update_own_restricted ON public.profiles;
CREATE POLICY profiles_update_own_restricted ON public.profiles
    FOR UPDATE USING (auth.uid() = public.profiles.id)
    WITH CHECK (
        auth.uid() = public.profiles.id
        AND (
            public.profiles.user_role IS NOT DISTINCT FROM public.current_user_role()
            OR public.profiles.user_role = 'student'::text
        )
    );
