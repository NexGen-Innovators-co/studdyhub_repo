-- ============================================================
-- App Ratings & Testimonials
-- Allows authenticated users to rate the app and submit
-- testimonials that appear on the landing page.
-- ============================================================

-- 1. Ratings table (one rating per user, can be updated)
CREATE TABLE IF NOT EXISTS public.app_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id) -- one rating per user
);

-- 2. Testimonials table (one testimonial per user, admin-approved)
CREATE TABLE IF NOT EXISTS public.app_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) >= 10 AND char_length(content) <= 500),
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id) -- one testimonial per user
);

-- 3. Enable RLS
ALTER TABLE public.app_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_testimonials ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for app_ratings
-- Anyone can read (for aggregate stats on landing page)
CREATE POLICY "Anyone can read ratings"
  ON public.app_ratings FOR SELECT
  USING (true);

-- Authenticated users can insert their own rating
CREATE POLICY "Users can insert own rating"
  ON public.app_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own rating
CREATE POLICY "Users can update own rating"
  ON public.app_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. RLS policies for app_testimonials
-- Anyone can read approved testimonials (for landing page)
CREATE POLICY "Anyone can read approved testimonials"
  ON public.app_testimonials FOR SELECT
  USING (is_approved = true OR auth.uid() = user_id);

-- Authenticated users can insert their own testimonial
CREATE POLICY "Users can insert own testimonial"
  ON public.app_testimonials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can update their own testimonial
CREATE POLICY "Users can update own testimonial"
  ON public.app_testimonials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can delete their own testimonial
CREATE POLICY "Users can delete own testimonial"
  ON public.app_testimonials FOR DELETE
  USING (auth.uid() = user_id);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_ratings_user_id ON public.app_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_app_testimonials_approved ON public.app_testimonials(is_approved) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_app_testimonials_user_id ON public.app_testimonials(user_id);

-- 7. Function to compute average rating (used by landing page stats)
CREATE OR REPLACE FUNCTION public.get_app_rating_stats()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'average_rating', COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    'total_ratings', COUNT(*)
  )
  FROM public.app_ratings;
$$;
