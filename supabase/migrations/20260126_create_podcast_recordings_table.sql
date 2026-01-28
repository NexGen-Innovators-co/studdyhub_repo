-- Migration: create podcast_recordings table to track recording sessions
CREATE TABLE IF NOT EXISTS podcast_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid REFERENCES ai_podcasts(id) ON DELETE CASCADE,
  session_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress, assembling, finalized, failed
  started_at timestamp with time zone DEFAULT now(),
  ended_at timestamp with time zone,
  duration_seconds integer,
  final_audio_url text,
  storage_path text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podcast_recordings_podcast_id ON podcast_recordings(podcast_id);
