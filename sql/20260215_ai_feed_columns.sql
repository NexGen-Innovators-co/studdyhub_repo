-- Migration: Add AI-powered feed columns
-- Date: 2026-02-15
-- Description: Adds AI categorization, user preference tracking, and interaction signals

-- 1. Add AI category/topics to social_posts
ALTER TABLE social_posts
  ADD COLUMN IF NOT EXISTS ai_categories text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_sentiment text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_quality_score smallint DEFAULT NULL;

-- Index for category-based filtering
CREATE INDEX IF NOT EXISTS idx_social_posts_ai_categories 
  ON social_posts USING GIN (ai_categories);

-- 2. Add AI preference profile to social_users
ALTER TABLE social_users
  ADD COLUMN IF NOT EXISTS ai_preferred_categories jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_preferred_authors text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_profile_updated_at timestamptz DEFAULT NULL;

-- 3. Create user interaction signals table for AI learning
CREATE TABLE IF NOT EXISTS social_user_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
  signal_type text NOT NULL, -- 'like', 'comment', 'share', 'bookmark', 'view', 'dwell', 'skip', 'hide'
  signal_value real DEFAULT 1.0, -- Weighted value (e.g., dwell time in seconds for 'dwell')
  categories text[] DEFAULT '{}', -- Copied from post's ai_categories at signal time
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, post_id, signal_type)
);

-- Indexes for efficient AI feed queries
CREATE INDEX IF NOT EXISTS idx_social_user_signals_user 
  ON social_user_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_user_signals_categories 
  ON social_user_signals USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_social_user_signals_type 
  ON social_user_signals(user_id, signal_type);

-- 4. Enable RLS
ALTER TABLE social_user_signals ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own signals
CREATE POLICY "Users can manage own signals" ON social_user_signals
  FOR ALL USING (auth.uid() = user_id);

-- Service role can manage all signals
CREATE POLICY "Service role full access on signals" ON social_user_signals
  FOR ALL USING (auth.role() = 'service_role');

-- 5. Function to automatically record signals when users interact
CREATE OR REPLACE FUNCTION record_like_signal()
RETURNS TRIGGER AS $$
DECLARE
  post_categories text[];
BEGIN
  SELECT ai_categories INTO post_categories FROM social_posts WHERE id = NEW.post_id;
  
  INSERT INTO social_user_signals (user_id, post_id, signal_type, signal_value, categories)
  VALUES (NEW.user_id, NEW.post_id, 'like', 1.0, COALESCE(post_categories, '{}'))
  ON CONFLICT (user_id, post_id, signal_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION remove_like_signal()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM social_user_signals 
  WHERE user_id = OLD.user_id AND post_id = OLD.post_id AND signal_type = 'like';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_bookmark_signal()
RETURNS TRIGGER AS $$
DECLARE
  post_categories text[];
BEGIN
  SELECT ai_categories INTO post_categories FROM social_posts WHERE id = NEW.post_id;
  
  INSERT INTO social_user_signals (user_id, post_id, signal_type, signal_value, categories)
  VALUES (NEW.user_id, NEW.post_id, 'bookmark', 2.0, COALESCE(post_categories, '{}'))
  ON CONFLICT (user_id, post_id, signal_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_comment_signal()
RETURNS TRIGGER AS $$
DECLARE
  post_categories text[];
BEGIN
  SELECT ai_categories INTO post_categories FROM social_posts WHERE id = NEW.post_id;
  
  INSERT INTO social_user_signals (user_id, post_id, signal_type, signal_value, categories)
  VALUES (NEW.author_id, NEW.post_id, 'comment', 1.5, COALESCE(post_categories, '{}'))
  ON CONFLICT (user_id, post_id, signal_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_share_signal()
RETURNS TRIGGER AS $$
DECLARE
  post_categories text[];
BEGIN
  SELECT ai_categories INTO post_categories FROM social_posts WHERE id = NEW.original_post_id;
  
  INSERT INTO social_user_signals (user_id, post_id, signal_type, signal_value, categories)
  VALUES (NEW.user_id, NEW.original_post_id, 'share', 3.0, COALESCE(post_categories, '{}'))
  ON CONFLICT (user_id, post_id, signal_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_view_signal()
RETURNS TRIGGER AS $$
DECLARE
  post_categories text[];
BEGIN
  SELECT ai_categories INTO post_categories FROM social_posts WHERE id = NEW.post_id;
  
  INSERT INTO social_user_signals (user_id, post_id, signal_type, signal_value, categories)
  VALUES (NEW.user_id, NEW.post_id, 'view', 0.3, COALESCE(post_categories, '{}'))
  ON CONFLICT (user_id, post_id, signal_type) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create triggers for automatic signal recording
DROP TRIGGER IF EXISTS trg_like_signal ON social_likes;
CREATE TRIGGER trg_like_signal 
  AFTER INSERT ON social_likes 
  FOR EACH ROW EXECUTE FUNCTION record_like_signal();

DROP TRIGGER IF EXISTS trg_unlike_signal ON social_likes;
CREATE TRIGGER trg_unlike_signal 
  AFTER DELETE ON social_likes 
  FOR EACH ROW EXECUTE FUNCTION remove_like_signal();

DROP TRIGGER IF EXISTS trg_bookmark_signal ON social_bookmarks;
CREATE TRIGGER trg_bookmark_signal 
  AFTER INSERT ON social_bookmarks 
  FOR EACH ROW EXECUTE FUNCTION record_bookmark_signal();

DROP TRIGGER IF EXISTS trg_comment_signal ON social_comments;
CREATE TRIGGER trg_comment_signal 
  AFTER INSERT ON social_comments 
  FOR EACH ROW EXECUTE FUNCTION record_comment_signal();

DROP TRIGGER IF EXISTS trg_share_signal ON social_shares;
CREATE TRIGGER trg_share_signal 
  AFTER INSERT ON social_shares 
  FOR EACH ROW EXECUTE FUNCTION record_share_signal();

DROP TRIGGER IF EXISTS trg_view_signal ON social_post_views;
CREATE TRIGGER trg_view_signal 
  AFTER INSERT ON social_post_views 
  FOR EACH ROW EXECUTE FUNCTION record_view_signal();
