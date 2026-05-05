-- Migration: Add admin RLS policies for testimonial moderation
-- Allows admin users (verified via is_admin()) to read ALL testimonials
-- and update/delete them for moderation purposes.

-- 1. Allow admins to read ALL testimonials (including unapproved)
CREATE POLICY "Admins can read all testimonials"
  ON public.app_testimonials FOR SELECT
  USING (is_admin(auth.uid()));

-- 2. Allow admins to update any testimonial (approve/reject)
CREATE POLICY "Admins can update any testimonial"
  ON public.app_testimonials FOR UPDATE
  USING (is_admin(auth.uid()));

-- 3. Allow admins to delete any testimonial
CREATE POLICY "Admins can delete any testimonial"
  ON public.app_testimonials FOR DELETE
  USING (is_admin(auth.uid()));

-- 4. Allow admins to read all ratings (for stats)
CREATE POLICY "Admins can read all ratings"
  ON public.app_ratings FOR SELECT
  USING (is_admin(auth.uid()));
