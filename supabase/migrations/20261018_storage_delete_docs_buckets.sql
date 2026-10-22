-- ============================================================================
-- Owner-scoped DELETE policies for the document storage buckets.
--
-- The old owner-less policies ("Allow authenticated deletes from documents
-- bucket", …) were dropped in 20260210_rls_cleanup_and_fixes.sql. This
-- restores deletion rights, scoped to the file owner's folder, for both
-- buckets the app writes to:
--   documents      → <userId>/uploads/<file>
--   chat-documents → <userId>/<uuid>-<file>
-- i.e. (storage.foldername(name))[1] is always the owner's uid.
--
-- Without this, client-side supabase.storage .remove() calls fail with a
-- permission error and deleted documents leave orphaned objects behind.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can delete their own document files'
  ) THEN
    CREATE POLICY "Users can delete their own document files"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id IN ('documents', 'chat-documents')
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;