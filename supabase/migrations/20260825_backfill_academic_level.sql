-- Backfill profiles.academic_level with specific grade from user_education_profiles
-- for explorer users whose academic_level still holds a generic category.
-- This fixes the discrepancy where "Junior High School" was stored instead of "JHS 3".

UPDATE public.profiles p
SET academic_level = uep.year_or_grade
FROM public.user_education_profiles uep
WHERE uep.user_id = p.id
  AND p.academic_tier = 'explorer'
  AND uep.year_or_grade IS NOT NULL
  AND uep.year_or_grade != ''
  -- Only fix rows where academic_level is a category, not a specific grade
  AND (
    p.academic_level IN ('Junior High School', 'Primary School', 'High School', 'Undergraduate')
    OR p.academic_level IS NULL
    OR p.academic_level = ''
  );

-- Log how many rows were updated
DO $$
BEGIN
  RAISE NOTICE 'Backfill complete. Updated profiles.academic_level from user_education_profiles.year_or_grade for explorer users.';
END $$;
