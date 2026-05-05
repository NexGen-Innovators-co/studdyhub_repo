-- ============================================================
-- 20260304: Add institution_id to profiles for normalized school
-- ============================================================

-- Add column (nullable) and foreign key to institutions table.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id);

-- We don't remove the existing `school` text column yet; it'll be kept as fallback.

-- Optionally backfill from existing school text if an institution exists with that name.
-- This is a best-effort migration, manual review may be required for mismatches.

DO $$
BEGIN
    UPDATE public.profiles p
    SET institution_id = i.id
    FROM public.institutions i
    WHERE p.institution_id IS NULL
      AND p.school IS NOT NULL
      AND trim(p.school) <> ''
      AND i.name = trim(p.school);
END $$;

-- ensure index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_profiles_institution ON public.profiles(institution_id);
