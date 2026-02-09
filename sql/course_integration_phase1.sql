-- ============================================================
-- Course Integration Phase 1 — Enrollment, Resources & Progress
-- Run this in Supabase SQL Editor
-- Date: 2026-02-09
-- ============================================================

-- =====================
-- 1. course_enrollments
-- =====================
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  last_accessed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped')),
  UNIQUE(course_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_enrollments_course ON public.course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_status ON public.course_enrollments(status);

-- RLS
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view enrollments (needed for enrollment counts)
CREATE POLICY "Anyone can view enrollments"
  ON public.course_enrollments FOR SELECT
  TO authenticated
  USING (true);

-- Users can enroll themselves
CREATE POLICY "Users can enroll themselves"
  ON public.course_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own enrollment
CREATE POLICY "Users can update own enrollment"
  ON public.course_enrollments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (unenroll) their own enrollment
CREATE POLICY "Users can delete own enrollment"
  ON public.course_enrollments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- =====================
-- 2. course_resources
-- =====================
CREATE TABLE IF NOT EXISTS public.course_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('document', 'quiz', 'podcast', 'note', 'recording')),
  resource_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(course_id, resource_type, resource_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_resources_course ON public.course_resources(course_id);
CREATE INDEX IF NOT EXISTS idx_course_resources_type ON public.course_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_course_resources_resource ON public.course_resources(resource_type, resource_id);

-- RLS
ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view course resources
CREATE POLICY "Anyone can view course resources"
  ON public.course_resources FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage resources (insert/update/delete)
-- We check against admin_users table
CREATE POLICY "Admins can insert course resources"
  ON public.course_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can update course resources"
  ON public.course_resources FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can delete course resources"
  ON public.course_resources FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );


-- =====================
-- 3. course_progress
-- =====================
CREATE TABLE IF NOT EXISTS public.course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES public.course_enrollments(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES public.course_resources(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  score INTEGER,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  UNIQUE(enrollment_id, resource_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_course_progress_enrollment ON public.course_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_resource ON public.course_progress(resource_id);

-- RLS
ALTER TABLE public.course_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own progress (via enrollment ownership)
CREATE POLICY "Users can view own progress"
  ON public.course_progress FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE id = course_progress.enrollment_id
      AND user_id = auth.uid()
    )
  );

-- Users can insert their own progress
CREATE POLICY "Users can insert own progress"
  ON public.course_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE id = course_progress.enrollment_id
      AND user_id = auth.uid()
    )
  );

-- Users can update their own progress
CREATE POLICY "Users can update own progress"
  ON public.course_progress FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE id = course_progress.enrollment_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.course_enrollments
      WHERE id = course_progress.enrollment_id
      AND user_id = auth.uid()
    )
  );


-- =====================
-- 4. Helper function: calculate_course_progress
-- =====================
CREATE OR REPLACE FUNCTION public.calculate_course_progress(p_enrollment_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_required INTEGER;
  completed_required INTEGER;
  progress INTEGER;
BEGIN
  -- Count total required resources for this enrollment's course
  SELECT COUNT(*) INTO total_required
  FROM public.course_resources cr
  JOIN public.course_enrollments ce ON ce.course_id = cr.course_id
  WHERE ce.id = p_enrollment_id
  AND cr.is_required = true;

  -- If no required resources, count all resources
  IF total_required = 0 THEN
    SELECT COUNT(*) INTO total_required
    FROM public.course_resources cr
    JOIN public.course_enrollments ce ON ce.course_id = cr.course_id
    WHERE ce.id = p_enrollment_id;
  END IF;

  -- If still 0 resources, return 0
  IF total_required = 0 THEN
    RETURN 0;
  END IF;

  -- Count completed resources
  IF (SELECT COUNT(*) FROM public.course_resources cr
      JOIN public.course_enrollments ce ON ce.course_id = cr.course_id
      WHERE ce.id = p_enrollment_id AND cr.is_required = true) > 0 THEN
    -- Only count required
    SELECT COUNT(*) INTO completed_required
    FROM public.course_progress cp
    JOIN public.course_resources cr ON cr.id = cp.resource_id
    JOIN public.course_enrollments ce ON ce.course_id = cr.course_id AND ce.id = cp.enrollment_id
    WHERE cp.enrollment_id = p_enrollment_id
    AND cp.completed = true
    AND cr.is_required = true;
  ELSE
    -- Count all
    SELECT COUNT(*) INTO completed_required
    FROM public.course_progress cp
    WHERE cp.enrollment_id = p_enrollment_id
    AND cp.completed = true;
  END IF;

  progress := ROUND((completed_required::NUMERIC / total_required::NUMERIC) * 100);

  -- Update the enrollment record
  UPDATE public.course_enrollments
  SET progress_percent = progress,
      status = CASE WHEN progress >= 100 THEN 'completed' ELSE status END
  WHERE id = p_enrollment_id;

  RETURN progress;
END;
$$;


-- =====================
-- 5. Trigger: auto-recalculate progress on course_progress changes
-- =====================
CREATE OR REPLACE FUNCTION public.trigger_recalculate_course_progress()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Recalculate for the enrollment
  PERFORM public.calculate_course_progress(
    COALESCE(NEW.enrollment_id, OLD.enrollment_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalculate_course_progress ON public.course_progress;
CREATE TRIGGER trg_recalculate_course_progress
  AFTER INSERT OR UPDATE OR DELETE ON public.course_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalculate_course_progress();


-- =====================
-- 6. Trigger: update last_accessed_at on enrollment when progress changes
-- =====================
CREATE OR REPLACE FUNCTION public.trigger_update_enrollment_last_accessed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.course_enrollments
  SET last_accessed_at = now()
  WHERE id = NEW.enrollment_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_enrollment_last_accessed ON public.course_progress;
CREATE TRIGGER trg_update_enrollment_last_accessed
  AFTER INSERT OR UPDATE ON public.course_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_enrollment_last_accessed();


-- ============================================================
-- DONE! After running this, regenerate your Supabase types:
--   supabase gen types typescript --project-id <ID> > src/integrations/supabase/types.ts
-- ============================================================
