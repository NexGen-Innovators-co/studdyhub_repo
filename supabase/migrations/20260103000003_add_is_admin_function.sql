-- Create a secure function to check if the current user is an admin
-- This function runs with SECURITY DEFINER to bypass RLS on the admin_users table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

-- Update RLS policies for courses to use the new function

DROP POLICY IF EXISTS "Admins can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can update courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;

CREATE POLICY "Admins can insert courses" ON public.courses
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update courses" ON public.courses
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete courses" ON public.courses
  FOR DELETE
  USING (is_admin());

-- Update RLS policies for course_materials to use the new function

DROP POLICY IF EXISTS "Admins can insert course_materials" ON public.course_materials;
DROP POLICY IF EXISTS "Admins can update course_materials" ON public.course_materials;
DROP POLICY IF EXISTS "Admins can delete course_materials" ON public.course_materials;

CREATE POLICY "Admins can insert course_materials" ON public.course_materials
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update course_materials" ON public.course_materials
  FOR UPDATE
  USING (is_admin());

CREATE POLICY "Admins can delete course_materials" ON public.course_materials
  FOR DELETE
  USING (is_admin());
