-- Migration: add GIN index for ai_podcasts.audio_segments (if still used as JSONB)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_podcasts' AND column_name='audio_segments') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ai_podcasts_audio_segments_gin ON ai_podcasts USING gin (audio_segments jsonb_path_ops)';
  END IF;
END$$;
