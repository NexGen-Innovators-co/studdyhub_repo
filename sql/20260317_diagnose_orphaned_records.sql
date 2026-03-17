-- ============================================================
-- Diagnostic: Find Orphaned Records
-- ============================================================
-- This query finds all records with user_id references that
-- don't have corresponding profiles. These are orphaned records.

-- Find orphaned documents
SELECT 
  COUNT(*) as orphaned_document_count,
  STRING_AGG(DISTINCT d.user_id::text, ', ') as orphaned_user_ids
FROM documents d
WHERE d.user_id NOT IN (SELECT id FROM profiles);

-- Find ALL orphaned records by table
WITH orphaned_users AS (
  SELECT DISTINCT d.user_id
  FROM documents d
  WHERE d.user_id NOT IN (SELECT id FROM profiles)
)
SELECT 
  'documents' as table_name,
  COUNT(*) as orphaned_count
FROM documents d
WHERE d.user_id IN (SELECT user_id FROM orphaned_users)

UNION ALL

SELECT 'notes' as table_name, COUNT(*) 
FROM notes n
WHERE n.user_id IN (SELECT user_id FROM orphaned_users)

UNION ALL

SELECT 'quizzes' as table_name, COUNT(*) 
FROM quizzes q
WHERE q.user_id IN (SELECT user_id FROM orphaned_users)

UNION ALL

SELECT 'chat_sessions' as table_name, COUNT(*) 
FROM chat_sessions cs
WHERE cs.user_id IN (SELECT user_id FROM orphaned_users)

UNION ALL

SELECT 'flashcards' as table_name, COUNT(*) 
FROM flashcards fc
WHERE fc.user_id IN (SELECT user_id FROM orphaned_users)

ORDER BY orphaned_count DESC;

-- Full list of affected user IDs
SELECT DISTINCT user_id
FROM (
  SELECT user_id FROM documents WHERE user_id NOT IN (SELECT id FROM profiles)
  UNION
  SELECT user_id FROM notes WHERE user_id NOT IN (SELECT id FROM profiles)
  UNION
  SELECT user_id FROM quizzes WHERE user_id NOT IN (SELECT id FROM profiles)
  UNION
  SELECT user_id FROM chat_sessions WHERE user_id NOT IN (SELECT id FROM profiles)
  UNION
  SELECT user_id FROM flashcards WHERE user_id NOT IN (SELECT id FROM profiles)
) as orphaned
ORDER BY user_id;
