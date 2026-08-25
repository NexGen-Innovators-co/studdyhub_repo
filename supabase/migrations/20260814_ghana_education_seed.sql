-- Migration: Ghana education reference data seed (Explorer / kids onboarding)
-- Date: 2026-08-14
--
-- Seeds the reference hierarchy the mobile + web onboarding depend on:
--   countries → education_levels → curricula → examinations → subjects
-- All inserts are idempotent (ON CONFLICT DO NOTHING / WHERE NOT EXISTS), so this
-- is a safe no-op on databases that already have the data. The user-facing rows
-- (user_education_profiles, user_subjects) are written by the apps, not here.

-- ── countries ────────────────────────────────────────────────────────────────
INSERT INTO public.countries (code, name, flag_emoji, official_languages, is_active, sort_order)
VALUES ('GH', 'Ghana', '🇬🇭', ARRAY['English'], true, 1)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.countries (code, name, flag_emoji, official_languages, is_active, sort_order)
VALUES ('NG', 'Nigeria', '🇳🇬', ARRAY['English'], true, 2)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.countries (code, name, flag_emoji, official_languages, is_active, sort_order)
VALUES ('KE', 'Kenya', '🇰🇪', ARRAY['English', 'Swahili'], true, 3)
ON CONFLICT (code) DO NOTHING;

-- ── education_levels ─────────────────────────────────────────────────────────
-- Ghana NaCCA bands: Primary (Basic 1–6) → JHS (1–3) → SHS (1–3) → Tertiary.
INSERT INTO public.education_levels (country_id, code, name, short_name, category, sort_order, typical_start_age, typical_duration_years)
SELECT id, 'gh_primary', 'Primary (Basic 1–6)', 'Basic', 'primary', 10, 6, 6
FROM public.countries WHERE code = 'GH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.education_levels (country_id, code, name, short_name, category, sort_order, typical_start_age, typical_duration_years)
SELECT id, 'gh_lower_secondary', 'Lower Secondary (JHS 1–3)', 'JHS', 'lower_secondary', 20, 12, 3
FROM public.countries WHERE code = 'GH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.education_levels (country_id, code, name, short_name, category, sort_order, typical_start_age, typical_duration_years)
SELECT id, 'gh_upper_secondary', 'Upper Secondary (SHS 1–3)', 'SHS', 'upper_secondary', 30, 15, 3
FROM public.countries WHERE code = 'GH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.education_levels (country_id, code, name, short_name, category, sort_order, typical_start_age, typical_duration_years)
SELECT id, 'gh_tertiary', 'Tertiary (University & Colleges)', 'Tertiary', 'tertiary', 40, 18, 4
FROM public.countries WHERE code = 'GH'
ON CONFLICT (code) DO NOTHING;

-- ── curricula ────────────────────────────────────────────────────────────────
INSERT INTO public.curricula (country_id, education_level_id, code, name, governing_body, is_active)
SELECT c.id, l.id, 'gh_primary_nacca', 'Ghana Primary Curriculum (NaCCA)',
       'National Council for Curriculum and Assessment (NaCCA)', true
FROM public.countries c
JOIN public.education_levels l ON l.country_id = c.id AND l.code = 'gh_primary'
WHERE c.code = 'GH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.curricula (country_id, education_level_id, code, name, governing_body, is_active)
SELECT c.id, l.id, 'gh_jhs_nacca', 'Ghana JHS Curriculum (NaCCA)',
       'National Council for Curriculum and Assessment (NaCCA)', true
FROM public.countries c
JOIN public.education_levels l ON l.country_id = c.id AND l.code = 'gh_lower_secondary'
WHERE c.code = 'GH'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.curricula (country_id, education_level_id, code, name, governing_body, is_active)
SELECT c.id, l.id, 'gh_shs_nacca', 'Ghana SHS Curriculum (NaCCA)',
       'National Council for Curriculum and Assessment (NaCCA)', true
FROM public.countries c
JOIN public.education_levels l ON l.country_id = c.id AND l.code = 'gh_upper_secondary'
WHERE c.code = 'GH'
ON CONFLICT (code) DO NOTHING;

-- ── examinations ─────────────────────────────────────────────────────────────
INSERT INTO public.examinations (curriculum_id, code, name, typical_date, recurrence, is_active)
SELECT id, 'bece', 'Basic Education Certificate Examination (BECE)', '2026-06-08', 'annual', true
FROM public.curricula WHERE code = 'gh_jhs_nacca'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.examinations (curriculum_id, code, name, typical_date, recurrence, is_active)
SELECT id, 'wasce', 'West African Senior School Certificate Examination (WASSCE)', '2026-05-04', 'annual', true
FROM public.curricula WHERE code = 'gh_shs_nacca'
ON CONFLICT (code) DO NOTHING;

-- ── subjects (core + elective for each Ghana curriculum) ────────────────────
-- subjects has no (curriculum_id, code) unique constraint, so use WHERE NOT EXISTS.
DO $$
DECLARE
  cur_ids uuid[] := ARRAY(
    SELECT id FROM public.curricula
    WHERE code IN ('gh_primary_nacca', 'gh_jhs_nacca', 'gh_shs_nacca')
  );
  cur uuid;
  s record;
BEGIN
  FOREACH cur IN ARRAY cur_ids LOOP
    FOR s IN VALUES
      ('ENG', 'English Language', 'core', 1),
      ('MATH', 'Mathematics', 'core', 2),
      ('SCI', 'Science', 'core', 3),
      ('SST', 'Social Studies', 'core', 4),
      ('ICT', 'ICT', 'elective', 5),
      ('ART', 'Creative Arts', 'elective', 6),
      ('FRENCH', 'French', 'elective', 7),
      ('TWI', 'Twi (Ghanaian Language)', 'elective', 8),
      ('RME', 'Religious & Moral Education', 'elective', 9)
    LOOP
      INSERT INTO public.subjects (curriculum_id, code, name, category, sort_order, is_active)
      SELECT cur, s.column1, s.column2, s.column3, s.column4, true
      WHERE NOT EXISTS (
        SELECT 1 FROM public.subjects WHERE curriculum_id = cur AND code = s.column1
      );
    END LOOP;
  END LOOP;
END $$;
