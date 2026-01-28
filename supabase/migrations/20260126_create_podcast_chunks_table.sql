-- Migration: create podcast_chunks staging table
-- Transient table to store metadata for uploaded chunks. Do not store large base64 blobs long-term.
CREATE TABLE IF NOT EXISTS podcast_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  podcast_id uuid REFERENCES ai_podcasts(id) ON DELETE CASCADE,
  upload_session_id text NOT NULL,
  chunk_index integer NOT NULL,
  total_chunks integer,
  storage_path text,
  file_size integer,
  mime_type text,
  checksum text,
  status text DEFAULT 'uploaded',
  uploader_user_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podcast_chunks_session_idx ON podcast_chunks(podcast_id, upload_session_id, chunk_index);

-- Ensure no duplicate chunk index per session
CREATE UNIQUE INDEX IF NOT EXISTS uq_podcast_chunks_session_chunk ON podcast_chunks (upload_session_id, chunk_index);
