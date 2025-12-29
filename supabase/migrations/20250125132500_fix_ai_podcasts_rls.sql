-- Fix RLS policies for ai_podcasts table to allow updates
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can update own podcasts" ON ai_podcasts;
DROP POLICY IF EXISTS "Users can update their own podcasts" ON ai_podcasts;
DROP POLICY IF EXISTS "Users can delete own podcasts" ON ai_podcasts;

-- Create comprehensive policy for podcast owners to update their own podcasts
CREATE POLICY "Users can update own podcasts"
ON ai_podcasts
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own podcasts
DROP POLICY IF EXISTS "Users can delete their own podcasts" ON ai_podcasts;
CREATE POLICY "Users can delete their own podcasts"
ON ai_podcasts
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Ensure users can insert their own podcasts
DROP POLICY IF EXISTS "Users can insert own podcasts" ON ai_podcasts;
CREATE POLICY "Users can insert own podcasts"
ON ai_podcasts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure users can select their own and public podcasts
DROP POLICY IF EXISTS "Users can view own and public podcasts" ON ai_podcasts;
CREATE POLICY "Users can view own and public podcasts"
ON ai_podcasts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR is_public = true);

-- Allow anonymous users to view public podcasts
DROP POLICY IF EXISTS "Anyone can view public podcasts" ON ai_podcasts;
CREATE POLICY "Anyone can view public podcasts"
ON ai_podcasts
FOR SELECT
TO anon
USING (is_public = true);

-- Add admin policies for all operations
DROP POLICY IF EXISTS "Admins can manage all podcasts" ON ai_podcasts;
CREATE POLICY "Admins can manage all podcasts"
ON ai_podcasts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users 
    WHERE admin_users.user_id = auth.uid()
  )
);

