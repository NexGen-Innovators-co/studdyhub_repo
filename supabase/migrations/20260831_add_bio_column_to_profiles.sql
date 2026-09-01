-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Add missing 'bio' column to profiles table
-- sync_profile RPC references bio but the column was never created.
-- ═══════════════════════════════════════════════════════════════════════════

-- Add bio column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN bio TEXT;
    RAISE NOTICE '✅ Added bio column to profiles table';
  ELSE
    RAISE NOTICE 'ℹ️ bio column already exists';
  END IF;
END $$;
