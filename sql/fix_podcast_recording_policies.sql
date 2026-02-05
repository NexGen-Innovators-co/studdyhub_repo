-- FIX: Add missing RLS policies for podcast recording tables
-- Run this in the Supabase Dashboard > SQL Editor

-- 1. Podcast Chunks Policies
ALTER TABLE IF EXISTS podcast_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON podcast_chunks;
DROP POLICY IF EXISTS "Enable select for authenticated users" ON podcast_chunks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON podcast_chunks;

CREATE POLICY "Enable insert for authenticated users" 
ON podcast_chunks FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable select for authenticated users" 
ON podcast_chunks FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Enable update for authenticated users" 
ON podcast_chunks FOR UPDATE
TO authenticated 
USING (true);


-- 2. Podcast Recordings Policies
ALTER TABLE IF EXISTS podcast_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON podcast_recordings;

CREATE POLICY "Enable all for authenticated users" 
ON podcast_recordings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
