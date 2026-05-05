-- ============================================================
-- DIAGNOSTIC: Verify Purge Worked Correctly
-- ============================================================
-- After purging a user, check their data is actually deleted

-- 1. Find the purged user UUID (use one from earlier: 138529ad-9d57-4e83-a402-3ac231486097)
SELECT 'CHECKING PURGED USER' as check_type;

-- 2. Verify profile is deleted
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE id = '138529ad-9d57-4e83-a402-3ac231486097') as profiles_count,
  (SELECT COUNT(*) FROM social_users WHERE id = '138529ad-9d57-4e83-a402-3ac231486097') as social_users_count
;
-- Expected: 0, 0 (both should be gone)


-- 3. Verify ALL posts deleted
SELECT 
  'social_posts' as table_name,
  COUNT(*) as remaining_count,
  STRING_AGG(DISTINCT author_id::text, ', ') as author_ids
FROM social_posts 
WHERE author_id = '138529ad-9d57-4e83-a402-3ac231486097'
-- Expected: 0 rows (all should cascade delete)


UNION ALL

SELECT 
  'social_comments' as table_name,
  COUNT(*) as remaining_count,
  STRING_AGG(DISTINCT author_id::text, ', ') as author_ids
FROM social_comments 
WHERE author_id = '138529ad-9d57-4e83-a402-3ac231486097'
-- Expected: 0 rows


UNION ALL

SELECT 
  'chat_sessions' as table_name,
  COUNT(*) as remaining_count,
  NULL as author_ids
FROM social_chat_messages 
WHERE sender_id = '138529ad-9d57-4e83-a402-3ac231486097'
-- Expected: 0 rows


ORDER BY table_name;


-- ============================================================
-- DIAGNOSTIC: Check for Orphaned Social Posts
-- ============================================================
-- Find posts where author_id references non-existent social_users

SELECT
  'ORPHANED POSTS' as issue_type,
  COUNT(*) as orphaned_count,
  STRING_AGG(DISTINCT sp.author_id::text, ', ') as author_ids_with_no_profile
FROM social_posts sp
WHERE sp.author_id NOT IN (SELECT id FROM social_users)
-- This should be EMPTY after CASCADE deletes work correctly


UNION ALL

SELECT
  'ORPHANED COMMENTS' as issue_type,
  COUNT(*) as orphaned_count,
  STRING_AGG(DISTINCT sc.author_id::text, ', ') as author_ids_with_no_profile
FROM social_comments sc
WHERE sc.author_id NOT IN (SELECT id FROM social_users);
-- This should be EMPTY after CASCADE deletes work correctly


-- ============================================================
-- DIAGNOSTIC: Get-Social-Feed Query Simulation
-- ============================================================
-- Simulate what the get-social-feed function returns for purged user

-- First, check if functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name ILIKE '%social%feed%'
ORDER BY routine_name;

-- Check the actual RPC function definition
SELECT 
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_social_feed';


-- ============================================================
-- DIAGNOSTIC: Check Profile View Privacy Settings
-- ============================================================
-- When viewing a user profile, what privacy filters apply?

-- Simulate viewing purged user's profile
-- The UI should be calling something like:
-- SELECT * FROM social_posts WHERE author_id = 'purged-user-id'

SELECT
  sp.id,
  sp.author_id,
  sp.privacy,
  sp.content,
  sp.created_at,
  su.username
FROM social_posts sp
LEFT JOIN social_users su ON sp.author_id = su.id
WHERE sp.author_id = '138529ad-9d57-4e83-a402-3ac231486097'
-- If this returns rows, the CASCADE delete didn't work!
-- If it returns 0 rows, the issue is in the UI/RLP policies


ORDER BY sp.created_at DESC;


-- ============================================================
-- DIAGNOSTIC: Infinite Scroll Issue
-- ============================================================
-- Check if there are duplicate/cached posts being returned

-- Count total posts in feed (no filters)
SELECT COUNT(*) as total_posts FROM social_posts;

-- Check for posts with same content (possible caching/duplication)
SELECT 
  content,
  COUNT(*) as count,
  STRING_AGG(id::text, ', ') as post_ids
FROM social_posts
WHERE content IS NOT NULL 
  AND content != ''
GROUP BY content
HAVING COUNT(*) > 1
ORDER BY count DESC
LIMIT 20;
-- If this has many results, posts are being duplicated somehow
