-- ============================================================
-- Fix Orphaned Records - Option 1: DELETE ORPHANED RECORDS
-- ============================================================
-- This script DELETES all records with user_ids that don't
-- have corresponding profiles. Use this if you want to clean
-- up orphaned data.
--
-- ⚠️ WARNING: This is DESTRUCTIVE. Run diagnosis first!
-- ============================================================

-- First, identify which user_ids are orphaned
WITH orphaned_users AS (
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
    UNION
    SELECT user_id FROM schedule_items WHERE user_id NOT IN (SELECT id FROM profiles)
    UNION
    SELECT user_id FROM achievements WHERE user_id NOT IN (SELECT id FROM profiles)
    UNION
    SELECT user_id FROM user_stats WHERE user_id NOT IN (SELECT id FROM profiles)
    UNION
    SELECT user_id FROM class_recordings WHERE user_id NOT IN (SELECT id FROM profiles)
    UNION
    SELECT user_id FROM document_folders WHERE user_id NOT IN (SELECT id FROM profiles)
    UNION
    SELECT user_id FROM ai_user_memory WHERE user_id NOT IN (SELECT id FROM profiles)
    UNION
    SELECT user_id FROM learning_topic_connections WHERE user_id NOT IN (SELECT id FROM profiles)
    UNION
    SELECT user_id FROM user_learning_goals WHERE user_id NOT IN (SELECT id FROM profiles)
  ) as all_orphaned
)
DELETE FROM documents WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM notes WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM notes WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM quizzes WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM quizzes WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM chat_sessions WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM chat_sessions WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM flashcards WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM flashcards WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM schedule_items WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM schedule_items WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM achievements WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM achievements WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM user_stats WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM user_stats WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM class_recordings WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM class_recordings WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM document_folders WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM document_folders WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM ai_user_memory WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM ai_user_memory WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM learning_topic_connections WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM learning_topic_connections WHERE user_id IN (SELECT user_id FROM orphaned_users);

WITH orphaned_users AS (
  SELECT DISTINCT user_id FROM (SELECT user_id FROM user_learning_goals WHERE user_id NOT IN (SELECT id FROM profiles)) as x
)
DELETE FROM user_learning_goals WHERE user_id IN (SELECT user_id FROM orphaned_users);

-- Log results
DO $$
BEGIN
  RAISE NOTICE '[Orphan Cleanup] Deleted all orphaned records without corresponding profiles';
END $$;
