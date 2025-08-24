-- Create social network tables for NoteMind
-- Migration: 20241201000000_create_social_network_tables.sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends existing auth.users)
CREATE TABLE IF NOT EXISTS public.social_users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  is_contributor BOOLEAN DEFAULT FALSE,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  author_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  privacy TEXT CHECK (privacy IN ('public', 'followers', 'private')) DEFAULT 'public',
  group_id UUID, -- Will reference groups table
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  bookmarks_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create media table for post attachments
CREATE TABLE IF NOT EXISTS public.social_media (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('image', 'video', 'document')) NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create hashtags table
CREATE TABLE IF NOT EXISTS public.social_hashtags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  posts_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_hashtags junction table
CREATE TABLE IF NOT EXISTS public.social_post_hashtags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  hashtag_id UUID REFERENCES public.social_hashtags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, hashtag_id)
);

-- Create tags table
CREATE TABLE IF NOT EXISTS public.social_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create post_tags junction table
CREATE TABLE IF NOT EXISTS public.social_post_tags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.social_tags(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);

-- Create groups table
CREATE TABLE IF NOT EXISTS public.social_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_image_url TEXT,
  category TEXT NOT NULL,
  privacy TEXT CHECK (privacy IN ('public', 'private')) DEFAULT 'public',
  members_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE IF NOT EXISTS public.social_group_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.social_groups(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('admin', 'moderator', 'member')) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS public.social_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE, -- For nested comments
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comment_media table
CREATE TABLE IF NOT EXISTS public.social_comment_media (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comment_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('image', 'video', 'document')) NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create likes table
CREATE TABLE IF NOT EXISTS public.social_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR 
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE(user_id, post_id),
  UNIQUE(user_id, comment_id)
);

-- Create bookmarks table
CREATE TABLE IF NOT EXISTS public.social_bookmarks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Create follows table
CREATE TABLE IF NOT EXISTS public.social_follows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  follower_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.social_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('like', 'comment', 'share', 'follow', 'group_invite', 'mention')) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table
CREATE TABLE IF NOT EXISTS public.social_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  group_id UUID REFERENCES public.social_groups(id) ON DELETE CASCADE,
  organizer_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  location TEXT,
  is_online BOOLEAN DEFAULT FALSE,
  max_attendees INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create event_attendees table
CREATE TABLE IF NOT EXISTS public.social_event_attendees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.social_events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('attending', 'maybe', 'declined')) DEFAULT 'attending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.social_chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id UUID REFERENCES public.social_groups(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create chat_message_media table
CREATE TABLE IF NOT EXISTS public.social_chat_message_media (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.social_chat_messages(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('image', 'video', 'document')) NOT NULL,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shares table
CREATE TABLE IF NOT EXISTS public.social_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  original_post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE NOT NULL,
  share_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create reports table for content moderation
CREATE TABLE IF NOT EXISTS public.social_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE NOT NULL,
  reported_user_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.social_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.social_comments(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.social_groups(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')) DEFAULT 'pending',
  moderator_id UUID REFERENCES public.social_users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (
    reported_user_id IS NOT NULL OR 
    post_id IS NOT NULL OR 
    comment_id IS NOT NULL OR 
    group_id IS NOT NULL
  )
);

-- Add foreign key constraint for posts.group_id
ALTER TABLE public.social_posts 
ADD CONSTRAINT fk_posts_group_id 
FOREIGN KEY (group_id) REFERENCES public.social_groups(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_social_posts_author_id ON public.social_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON public.social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_privacy ON public.social_posts(privacy);
CREATE INDEX IF NOT EXISTS idx_social_posts_group_id ON public.social_posts(group_id);

CREATE INDEX IF NOT EXISTS idx_social_media_post_id ON public.social_media(post_id);

CREATE INDEX IF NOT EXISTS idx_social_hashtags_name ON public.social_hashtags(name);
CREATE INDEX IF NOT EXISTS idx_social_post_hashtags_post_id ON public.social_post_hashtags(post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_hashtags_hashtag_id ON public.social_post_hashtags(hashtag_id);

CREATE INDEX IF NOT EXISTS idx_social_groups_category ON public.social_groups(category);
CREATE INDEX IF NOT EXISTS idx_social_groups_privacy ON public.social_groups(privacy);
CREATE INDEX IF NOT EXISTS idx_social_groups_created_at ON public.social_groups(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_group_members_group_id ON public.social_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_social_group_members_user_id ON public.social_group_members(user_id);

CREATE INDEX IF NOT EXISTS idx_social_comments_post_id ON public.social_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_author_id ON public.social_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_social_likes_user_id ON public.social_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_social_likes_post_id ON public.social_likes(post_id);

CREATE INDEX IF NOT EXISTS idx_social_bookmarks_user_id ON public.social_bookmarks(user_id);

CREATE INDEX IF NOT EXISTS idx_social_follows_follower_id ON public.social_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_social_follows_following_id ON public.social_follows(following_id);

CREATE INDEX IF NOT EXISTS idx_social_notifications_user_id ON public.social_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_social_notifications_created_at ON public.social_notifications(created_at DESC);

-- Create functions for updating counts
CREATE OR REPLACE FUNCTION update_post_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update post counts when new post is created
    UPDATE public.social_users 
    SET posts_count = posts_count + 1 
    WHERE id = NEW.author_id;
    
    -- Update group post count if post belongs to a group
    IF NEW.group_id IS NOT NULL THEN
      UPDATE public.social_groups 
      SET posts_count = posts_count + 1 
      WHERE id = NEW.group_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update post counts when post is deleted
    UPDATE public.social_users 
    SET posts_count = posts_count - 1 
    WHERE id = OLD.author_id;
    
    IF OLD.group_id IS NOT NULL THEN
      UPDATE public.social_groups 
      SET posts_count = posts_count - 1 
      WHERE id = OLD.group_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for post counts
CREATE TRIGGER trigger_update_post_counts
  AFTER INSERT OR DELETE ON public.social_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_post_counts();

-- Function to update like counts
CREATE OR REPLACE FUNCTION update_like_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update post like count
    IF NEW.post_id IS NOT NULL THEN
      UPDATE public.social_posts 
      SET likes_count = likes_count + 1 
      WHERE id = NEW.post_id;
    END IF;
    
    -- Update comment like count
    IF NEW.comment_id IS NOT NULL THEN
      UPDATE public.social_comments 
      SET likes_count = likes_count + 1 
      WHERE id = NEW.comment_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update post like count
    IF OLD.post_id IS NOT NULL THEN
      UPDATE public.social_posts 
      SET likes_count = likes_count - 1 
      WHERE id = OLD.post_id;
    END IF;
    
    -- Update comment like count
    IF OLD.comment_id IS NOT NULL THEN
      UPDATE public.social_comments 
      SET likes_count = likes_count - 1 
      WHERE id = OLD.comment_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for like counts
CREATE TRIGGER trigger_update_like_counts
  AFTER INSERT OR DELETE ON public.social_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_like_counts();

-- Function to update comment counts
CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_posts 
    SET comments_count = comments_count + 1 
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_posts 
    SET comments_count = comments_count - 1 
    WHERE id = OLD.post_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for comment counts
CREATE TRIGGER trigger_update_comment_counts
  AFTER INSERT OR DELETE ON public.social_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_counts();

-- Function to update follow counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_users 
    SET followers_count = followers_count + 1 
    WHERE id = NEW.following_id;
    
    UPDATE public.social_users 
    SET following_count = following_count + 1 
    WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_users 
    SET followers_count = followers_count - 1 
    WHERE id = OLD.following_id;
    
    UPDATE public.social_users 
    SET following_count = following_count - 1 
    WHERE id = OLD.follower_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for follow counts
CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON public.social_follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- Function to update group member counts
CREATE OR REPLACE FUNCTION update_group_member_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_groups 
    SET members_count = members_count + 1 
    WHERE id = NEW.group_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_groups 
    SET members_count = members_count - 1 
    WHERE id = OLD.group_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for group member counts
CREATE TRIGGER trigger_update_group_member_counts
  AFTER INSERT OR DELETE ON public.social_group_members
  FOR EACH ROW
  EXECUTE FUNCTION update_group_member_counts();

-- Function to update hashtag post counts
CREATE OR REPLACE FUNCTION update_hashtag_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.social_hashtags 
    SET posts_count = posts_count + 1 
    WHERE id = NEW.hashtag_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.social_hashtags 
    SET posts_count = posts_count - 1 
    WHERE id = OLD.hashtag_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for hashtag counts
CREATE TRIGGER trigger_update_hashtag_counts
  AFTER INSERT OR DELETE ON public.social_post_hashtags
  FOR EACH ROW
  EXECUTE FUNCTION update_hashtag_counts();

-- Enable Row Level Security (RLS)
ALTER TABLE public.social_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_comment_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_chat_message_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_reports ENABLE ROW LEVEL SECURITY;

-- Fix RLS policies to prevent infinite recursion
DROP POLICY IF EXISTS "Users can view public groups" ON social_groups;
DROP POLICY IF EXISTS "Users can view public posts" ON social_posts;
DROP POLICY IF EXISTS "Users can view public comments" ON social_comments;

-- Simplified RLS policies
CREATE POLICY "Enable read access for all users" ON social_groups
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_groups
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for group creators" ON social_groups
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Enable delete for group creators" ON social_groups
    FOR DELETE USING (auth.uid() = created_by);

-- Posts policies
CREATE POLICY "Enable read access for all users" ON social_posts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_posts
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for post authors" ON social_posts
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Enable delete for post authors" ON social_posts
    FOR DELETE USING (auth.uid() = author_id);

-- Comments policies
CREATE POLICY "Enable read access for all users" ON social_comments
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_comments
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for comment authors" ON social_comments
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Enable delete for comment authors" ON social_comments
    FOR DELETE USING (auth.uid() = author_id);

-- Other tables
CREATE POLICY "Enable read access for all users" ON social_users
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for own profile" ON social_users
    FOR UPDATE USING (auth.uid() = id);

-- Media policies
CREATE POLICY "Enable read access for all users" ON social_media
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_media
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Hashtags and tags (public read, authenticated insert)
CREATE POLICY "Enable read access for all users" ON social_hashtags
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_hashtags
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable read access for all users" ON social_tags
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_tags
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Junction tables
CREATE POLICY "Enable read access for all users" ON social_post_hashtags
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_post_hashtags
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable read access for all users" ON social_post_tags
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_post_tags
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Likes, bookmarks, follows
CREATE POLICY "Enable read access for all users" ON social_likes
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete for own likes" ON social_likes
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Enable read access for all users" ON social_bookmarks
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable delete for own bookmarks" ON social_bookmarks
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Enable read access for all users" ON social_follows
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_follows
    FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Enable delete for own follows" ON social_follows
    FOR DELETE USING (auth.uid() = follower_id);

-- Group members
CREATE POLICY "Enable read access for all users" ON social_group_members
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON social_group_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own membership" ON social_group_members
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for own membership" ON social_group_members
    FOR DELETE USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Enable read access for own notifications" ON social_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Enable insert for authenticated users" ON social_notifications
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Enable update for own notifications" ON social_notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Insert some sample data for testing
INSERT INTO public.social_hashtags (name) VALUES 
  ('AI'), ('Education'), ('Technology'), ('Innovation'), ('Learning'), ('Programming'),
  ('StudyTips'), ('ContentCreation'), ('Community'), ('Development')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.social_tags (name) VALUES 
  ('Technology'), ('Programming'), ('Resources'), ('Tips'), ('AI'), ('Education')
ON CONFLICT (name) DO NOTHING; 

-- Storage bucket policies
INSERT INTO storage.buckets (id, name, public) 
VALUES ('social-media', 'social-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to social-media bucket
CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'social-media');

-- Allow authenticated users to upload to social-media bucket
CREATE POLICY "Authenticated users can upload" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'social-media' 
        AND auth.role() = 'authenticated'
    );

-- Allow users to update their own files
CREATE POLICY "Users can update own files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'social-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

-- Allow users to delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'social-media' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    ); 