-- Allow enrolled users to read notes that are linked as course resources
-- This supplements the existing notes_select_own policy

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS notes_select_own ON public.notes;

-- Create a new SELECT policy that allows:
-- 1. Users to read their own notes (original behavior)
-- 2. Enrolled users to read notes linked to their courses
CREATE POLICY notes_select_own_or_course ON public.notes
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.course_resources cr
      JOIN public.course_enrollments ce ON ce.course_id = cr.course_id
      WHERE cr.resource_id = notes.id
        AND cr.resource_type = 'note'
        AND ce.user_id = auth.uid()
        AND ce.status IN ('active', 'completed')
    )
  );
