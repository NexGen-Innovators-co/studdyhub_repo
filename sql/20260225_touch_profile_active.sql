-- ============================================================
-- touch_profile_active()  — SECURITY DEFINER helper
-- ============================================================
-- Bypasses RLS to update profiles.updated_at for the current
-- authenticated user.  This avoids the infinite-recursion error
-- caused by the profiles_update_own_restricted policy's
-- self-referencing WITH CHECK clause.
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_profile_active()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- Allow any authenticated user to call this function
GRANT EXECUTE ON FUNCTION public.touch_profile_active() TO authenticated;
