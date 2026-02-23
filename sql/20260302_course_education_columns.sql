-- 20260302_course_education_columns.sql
-- Add education framework FK columns to the courses table so courses
-- can be linked to a country, education level and curriculum.
-- All columns are nullable — existing courses continue working unchanged.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS country_id uuid REFERENCES countries(id),
  ADD COLUMN IF NOT EXISTS education_level_id uuid REFERENCES education_levels(id),
  ADD COLUMN IF NOT EXISTS curriculum_id uuid REFERENCES curricula(id);

-- Indexes for common filter patterns
CREATE INDEX IF NOT EXISTS idx_courses_country ON courses(country_id);
CREATE INDEX IF NOT EXISTS idx_courses_education_level ON courses(education_level_id);
CREATE INDEX IF NOT EXISTS idx_courses_curriculum ON courses(curriculum_id);

COMMENT ON COLUMN courses.country_id IS 'FK to countries — ties course to a nation';
COMMENT ON COLUMN courses.education_level_id IS 'FK to education_levels — e.g. SHS, university';
COMMENT ON COLUMN courses.curriculum_id IS 'FK to curricula — e.g. Ghana NaCCA, Cambridge';
