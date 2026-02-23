-- ============================================================
-- Fix admin_activity_logs: add INSERT policy for admins
-- ============================================================
-- The table had RLS enabled with only a SELECT policy,
-- so all INSERT attempts silently failed. This adds the
-- missing INSERT policy so admins can actually write logs.
-- ============================================================

-- Add INSERT policy for admins
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'admin_activity_logs_insert_admin' 
    AND tablename = 'admin_activity_logs'
  ) THEN
    CREATE POLICY admin_activity_logs_insert_admin 
      ON public.admin_activity_logs 
      FOR INSERT
      WITH CHECK (public.is_admin());
  END IF;
END $$;

-- Also add UPDATE policy so admins can mark logs if needed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'admin_activity_logs_update_admin' 
    AND tablename = 'admin_activity_logs'
  ) THEN
    CREATE POLICY admin_activity_logs_update_admin 
      ON public.admin_activity_logs 
      FOR UPDATE
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
