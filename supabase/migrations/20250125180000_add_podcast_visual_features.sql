-- Add podcast type and visual assets support
ALTER TABLE ai_podcasts 
ADD COLUMN IF NOT EXISTS podcast_type TEXT DEFAULT 'audio' CHECK (podcast_type IN ('audio', 'image-audio', 'video', 'live-stream')),
ADD COLUMN IF NOT EXISTS visual_assets JSONB;

-- Add comment
COMMENT ON COLUMN ai_podcasts.podcast_type IS 'Type of podcast: audio (audio only), image-audio (audio with images), video (full video), live-stream (real-time AI stream)';
COMMENT ON COLUMN ai_podcasts.visual_assets IS 'Array of visual assets for the podcast including images, video segments, and metadata';

-- Create index for podcast type filtering
CREATE INDEX IF NOT EXISTS idx_ai_podcasts_type ON ai_podcasts(podcast_type);
