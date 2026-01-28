-- Migration: create audio_segments normalized table
CREATE TABLE IF NOT EXISTS audio_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid REFERENCES ai_podcasts(id) ON DELETE CASCADE,
  segment_index integer NOT NULL,
  audio_url text,
  storage_path text,
  transcript text,
  summary text,
  mime_type text,
  duration_seconds integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audio_segments_podcast_segment ON audio_segments(podcast_id, segment_index);
CREATE INDEX IF NOT EXISTS idx_audio_segments_podcast_id ON audio_segments(podcast_id);
