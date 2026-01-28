-- Migration: add cleanup policy helper for podcast_chunks
-- This creates a function to remove podcast_chunks older than 30 days. Adjust retention as needed.
CREATE OR REPLACE FUNCTION cleanup_old_podcast_chunks(retention_days integer DEFAULT 30)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM podcast_chunks WHERE created_at < now() - (retention_days || ' days')::interval;
END;
$$;

-- Note: schedule invocation via pg_cron or external scheduler as appropriate in deployment environment.
