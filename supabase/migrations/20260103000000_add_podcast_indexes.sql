-- Add indexes for podcast filtering and sorting performance

-- Index for default ordering (status=completed, created_at desc)
CREATE INDEX IF NOT EXISTS idx_podcasts_status_created_at 
ON ai_podcasts (status, created_at DESC);

-- Index for public feed (discover tab)
CREATE INDEX IF NOT EXISTS idx_podcasts_public_feed 
ON ai_podcasts (status, is_public, created_at DESC);

-- Index for user's podcasts (my podcasts tab)
CREATE INDEX IF NOT EXISTS idx_podcasts_user_feed 
ON ai_podcasts (status, user_id, created_at DESC);

-- Index for live podcasts (live tab)
CREATE INDEX IF NOT EXISTS idx_podcasts_live_feed 
ON ai_podcasts (status, is_live, is_public, created_at DESC);

-- Index for searching by tags (using GIN index for array)
CREATE INDEX IF NOT EXISTS idx_podcasts_tags 
ON ai_podcasts USING GIN (tags);
