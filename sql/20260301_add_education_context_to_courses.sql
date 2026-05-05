-- Migration: Add education context columns to courses table
-- Allows courses to be tagged with curriculum, education level, and country
-- for filtering in the "For You" personalized course recommendations.

-- Add education context foreign keys to courses
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS curriculum_id UUID REFERENCES curricula(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS education_level_id UUID REFERENCES education_levels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_id UUID REFERENCES countries(id) ON DELETE SET NULL;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_courses_curriculum ON courses(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_courses_education_level ON courses(education_level_id);
CREATE INDEX IF NOT EXISTS idx_courses_country ON courses(country_id);

-- Comment on columns for documentation
COMMENT ON COLUMN courses.curriculum_id IS 'Reference to the curriculum this course follows (e.g., WASSCE, IGCSE)';
COMMENT ON COLUMN courses.education_level_id IS 'Target education level for this course (e.g., SHS 1, JHS 3)';
COMMENT ON COLUMN courses.country_id IS 'Country this course is designed for (e.g., Ghana, Nigeria)';

-- Add enrollment_count tracking column (denormalized for dashboard performance)
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS enrollment_count INTEGER DEFAULT 0;

-- Function to keep enrollment_count in sync
CREATE OR REPLACE FUNCTION update_course_enrollment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = NEW.course_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE courses SET enrollment_count = GREATEST(enrollment_count - 1, 0) WHERE id = OLD.course_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on course_enrollments
DROP TRIGGER IF EXISTS trg_update_course_enrollment_count ON course_enrollments;
CREATE TRIGGER trg_update_course_enrollment_count
  AFTER INSERT OR DELETE ON course_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_course_enrollment_count();

-- Backfill existing enrollment counts
UPDATE courses c
SET enrollment_count = (
  SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id
)
WHERE EXISTS (
  SELECT 1 FROM course_enrollments ce WHERE ce.course_id = c.id
);
