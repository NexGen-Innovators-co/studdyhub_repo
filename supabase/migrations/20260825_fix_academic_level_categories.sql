-- Fix 1: Restore academic_level to proper category values
-- Explorer tier should have "Junior High School" or "Primary School"
UPDATE public.profiles
SET academic_level = CASE
    WHEN academic_level ~* '^JHS [0-9]+$' OR academic_level ~* '^Basic [789]$' THEN 'Junior High School'
    WHEN academic_level ~* '^Basic [1-6]$' OR academic_level ~* '^Primary [0-9]+$' THEN 'Primary School'
    ELSE academic_level
END
WHERE academic_tier = 'explorer'
  AND academic_level IS NOT NULL
  AND academic_level != ''
  AND academic_level NOT IN ('Junior High School', 'Primary School', 'High School', 'Undergraduate');

-- Fix 2: For any explorer where academic_level is still null/blank,
-- derive it from user_education_profiles.year_or_grade
UPDATE public.profiles p
SET academic_level = CASE
    WHEN uep.year_or_grade ~* '^JHS' THEN 'Junior High School'
    WHEN uep.year_or_grade ~* '^Basic|^Primary' THEN 'Primary School'
    ELSE 'Primary School'
END
FROM public.user_education_profiles uep
WHERE uep.user_id = p.id
  AND p.academic_tier = 'explorer'
  AND (p.academic_level IS NULL OR p.academic_level = '');

-- Verify results
DO $$
BEGIN
  RAISE NOTICE 'academic_level categories restored. Explorer users now have Junior High School or Primary School.';
END $$;
