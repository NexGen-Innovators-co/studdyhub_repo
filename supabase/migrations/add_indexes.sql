-- Adding index to notes table for user_id and updated_at
CREATE INDEX IF NOT EXISTS idx_notes_user_id_updated_at
ON notes (user_id, updated_at DESC);

-- Adding index to documents table for user_id and updated_at
CREATE INDEX IF NOT EXISTS idx_documents_user_id_updated_at
ON documents (user_id, updated_at DESC);

-- Adding index to podcasts table for user_id and created_at
CREATE INDEX IF NOT EXISTS idx_podcasts_user_id_created_at
ON podcasts (user_id, created_at DESC);