-- ============================================================
-- Educator RLS Policy Fixes
-- Fixes: educators blocked from managing course_resources,
--        missing visibility-aware course select,
--        missing educator course update/delete
-- Run in Supabase SQL Editor AFTER 20260301_educator_platform_schema.sql
-- ============================================================

-- ─── 1. Courses: Visibility-aware SELECT ──────────────────────
-- Drop overly-permissive select if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'courses' AND policyname = 'Anyone can view courses'
  ) THEN
    DROP POLICY "Anyone can view courses" ON public.courses;
  END IF;
END $$;

CREATE POLICY "courses_select_visible" ON public.courses
  FOR SELECT TO authenticated
  USING (
    -- Public & published courses visible to all authenticated users
    (visibility = 'public' AND is_published = true)
    -- Institution courses visible to members of that institution
    OR (visibility = 'institution' AND institution_id IN (SELECT user_institution_ids(auth.uid())))
    -- Creator can always see their own courses
    OR created_by = auth.uid()
    -- Platform admins can see everything
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- ─── 2. Courses: Educator UPDATE own courses ──────────────────
CREATE POLICY "courses_update_own" ON public.courses
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- ─── 3. Courses: Educator DELETE own courses ──────────────────
CREATE POLICY "courses_delete_own" ON public.courses
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- ─── 4. Courses: Educator INSERT (must be educator) ──────────
-- Drop any existing insert policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'courses' AND policyname = 'Anyone can insert courses'
  ) THEN
    DROP POLICY "Anyone can insert courses" ON public.courses;
  END IF;
END $$;

CREATE POLICY "courses_insert_educator" ON public.courses
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Must be an educator in some institution, or a platform admin
    is_educator(auth.uid())
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );


-- ─── 5. Course Resources: Allow educator CUD on own courses ──
-- Drop existing admin-only policies
DROP POLICY IF EXISTS "Admins can insert course resources" ON public.course_resources;
DROP POLICY IF EXISTS "Admins can update course resources" ON public.course_resources;
DROP POLICY IF EXISTS "Admins can delete course resources" ON public.course_resources;

-- Educator can INSERT resources into courses they created
CREATE POLICY "educators_insert_course_resources" ON public.course_resources
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Course creator
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.created_by = auth.uid()
    )
    -- Or institution admin for that course's institution
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND c.institution_id IS NOT NULL
        AND is_institution_member(auth.uid(), c.institution_id, 'admin')
    )
    -- Platform admin
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Educator can UPDATE resources in courses they created
CREATE POLICY "educators_update_course_resources" ON public.course_resources
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND c.institution_id IS NOT NULL
        AND is_institution_member(auth.uid(), c.institution_id, 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND c.institution_id IS NOT NULL
        AND is_institution_member(auth.uid(), c.institution_id, 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

-- Educator can DELETE resources from courses they created
CREATE POLICY "educators_delete_course_resources" ON public.course_resources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND c.institution_id IS NOT NULL
        AND is_institution_member(auth.uid(), c.institution_id, 'admin')
    )
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );


-- ─── 6. Course Enrollments: Better scoping ───────────────────
-- Drop the overly-permissive select if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'course_enrollments' AND policyname = 'Anyone can view enrollments'
  ) THEN
    DROP POLICY "Anyone can view enrollments" ON public.course_enrollments;
  END IF;
END $$;

CREATE POLICY "enrollments_select_scoped" ON public.course_enrollments
  FOR SELECT TO authenticated
  USING (
    -- Own enrollments
    user_id = auth.uid()
    -- Course creator can view enrollments for their courses
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.created_by = auth.uid()
    )
    -- Institution admins can view enrollments for institution courses
    OR EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id
        AND c.institution_id IS NOT NULL
        AND is_institution_member(auth.uid(), c.institution_id, 'admin')
    )
    -- Platform admin
    OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );


-- ─── 7. Educator helper: Check course ownership ──────────────
CREATE OR REPLACE FUNCTION is_course_owner(_user_id uuid, _course_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM courses WHERE id = _course_id AND created_by = _user_id
  );
$$;


-- ============================================================
-- DONE! After running this, educators can:
--   ✓ See public/institution/own courses (visibility-aware)
--   ✓ Create courses (if verified educator)
--   ✓ Update/delete their own courses
--   ✓ Add/update/delete resources in their own courses
--   ✓ View enrollments for their courses
-- ============================================================
