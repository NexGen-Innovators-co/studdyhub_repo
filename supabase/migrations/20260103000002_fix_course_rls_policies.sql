-- Fix RLS policies for courses and course_materials to use correct user_id column

-- Drop incorrect policies
DROP POLICY IF EXISTS "Admins can insert courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can update courses" ON public.courses;
DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;

DROP POLICY IF EXISTS "Admins can insert course_materials" ON public.course_materials;
DROP POLICY IF EXISTS "Admins can update course_materials" ON public.course_materials;
DROP POLICY IF EXISTS "Admins can delete course_materials" ON public.course_materials;

-- Re-create policies with correct column (user_id)

-- Courses
CREATE POLICY "Admins can insert courses" ON public.courses
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "Admins can update courses" ON public.courses
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "Admins can delete courses" ON public.courses
  FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

-- Course Materials
CREATE POLICY "Admins can insert course_materials" ON public.course_materials
  FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "Admins can update course_materials" ON public.course_materials
  FOR UPDATE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "Admins can delete course_materials" ON public.course_materials
  FOR DELETE
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));
