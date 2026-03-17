-- ============================================================
-- Fix Orphaned Records - Option 2: CREATE MISSING PROFILES
-- ============================================================
-- This script creates missing profiles for all orphaned user_ids.
-- Use this if you want to preserve the data but create placeholder
-- profiles for users that exist in auth.users but not profiles table.
--
-- This is safer than deleting data - it preserves everything.
-- ============================================================

-- First, create missing profiles from data that references them
INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  d.user_id as id,
  'user_' || SUBSTRING(d.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(d.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM documents d
WHERE d.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  n.user_id as id,
  'user_' || SUBSTRING(n.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(n.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM notes n
WHERE n.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  q.user_id as id,
  'user_' || SUBSTRING(q.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(q.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM quizzes q
WHERE q.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  cs.user_id as id,
  'user_' || SUBSTRING(cs.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(cs.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM chat_sessions cs
WHERE cs.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  f.user_id as id,
  'user_' || SUBSTRING(f.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(f.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM flashcards f
WHERE f.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  si.user_id as id,
  'user_' || SUBSTRING(si.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(si.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM schedule_items si
WHERE si.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  a.user_id as id,
  'user_' || SUBSTRING(a.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(a.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM achievements a
WHERE a.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  us.user_id as id,
  'user_' || SUBSTRING(us.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(us.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM user_stats us
WHERE us.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  cr.user_id as id,
  'user_' || SUBSTRING(cr.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(cr.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM class_recordings cr
WHERE cr.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  df.user_id as id,
  'user_' || SUBSTRING(df.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(df.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM document_folders df
WHERE df.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  aum.user_id as id,
  'user_' || SUBSTRING(aum.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(aum.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM ai_user_memory aum
WHERE aum.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  ltc.user_id as id,
  'user_' || SUBSTRING(ltc.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(ltc.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM learning_topic_connections ltc
WHERE ltc.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, email, created_at, updated_at)
SELECT DISTINCT 
  ulg.user_id as id,
  'user_' || SUBSTRING(ulg.user_id::text, 1, 8) as username,
  'recovered_' || SUBSTRING(ulg.user_id::text, 1, 8) || '@example.com' as email,
  NOW() as created_at,
  NOW() as updated_at
FROM user_learning_goals ulg
WHERE ulg.user_id NOT IN (SELECT id FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- Log results
DO $$
DECLARE
  recovered_count INT;
BEGIN
  SELECT COUNT(*) INTO recovered_count FROM profiles 
  WHERE email LIKE 'recovered_%@example.com';
  
  RAISE NOTICE '[Orphan Recovery] Created % placeholder profiles for orphaned records', recovered_count;
END $$;
