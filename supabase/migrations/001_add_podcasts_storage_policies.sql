-- Migration: Add storage policies for `podcasts` bucket
-- Run this in your Supabase project's SQL editor or via the CLI: `supabase db query <file>`

BEGIN;

-- Ensure Row Level Security is enabled on storage.objects
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload to the `podcasts` bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated uploads to podcasts' AND schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Allow authenticated uploads to podcasts" ON storage.objects
        FOR INSERT
        WITH CHECK (
          bucket_id = 'podcasts'
          AND auth.role() = 'authenticated'
        );
    $$;
  END IF;
END$$;

-- Allow owners to SELECT their own podcast objects or anyone to SELECT objects marked public in metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow select on podcasts for owners and public' AND schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Allow select on podcasts for owners and public" ON storage.objects
        FOR SELECT
        USING (
          bucket_id = 'podcasts'
          AND (
            owner = auth.uid()
            OR (metadata->>'public') = 'true'
          )
        );
    $$;
  END IF;
END$$;

-- Allow owners to UPDATE their own podcast objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow update on podcasts for owners' AND schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Allow update on podcasts for owners" ON storage.objects
        FOR UPDATE
        USING (
          bucket_id = 'podcasts'
          AND owner = auth.uid()
        )
        WITH CHECK (
          bucket_id = 'podcasts'
          AND owner = auth.uid()
        );
    $$;
  END IF;
END$$;

-- Allow owners to DELETE their own podcast objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Allow delete on podcasts for owners' AND schemaname = 'storage' AND tablename = 'objects'
  ) THEN
    EXECUTE $$
      CREATE POLICY "Allow delete on podcasts for owners" ON storage.objects
        FOR DELETE
        USING (
          bucket_id = 'podcasts'
        );
    $$;
  END IF;
END$$;

COMMIT;

-- Notes:
-- 1) These policies scope all rules to the "podcasts" bucket only. They assume the upload client sets the `owner` column to the uploading user's `auth.uid()` (Supabase Storage client does this automatically when used with a logged-in user).
-- 2) To allow public reads for specific files, set the object's metadata `{"public":"true"}` when uploading.
-- 3) The storage bucket may still reject certain MIME types via its bucket configuration ("Allowed MIME types"). To permit `video/webm` you must update the bucket settings in the Supabase dashboard: Storage → Buckets → podcasts → Settings → Allowed MIME types, then add `video/webm` (or set to blank to allow all).
-- 4) Alternatively, you can transcode uploaded video to an allowed audio format server-side before storing.
