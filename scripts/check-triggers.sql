-- ═══════════════════════════════════════════════════════════════════════════
-- CHECK ALL TRIGGERS — Run this in SQL Editor to verify setup
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. List ALL triggers on public schema (our custom ones)
SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE t.tgtype & 1 WHEN 1 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
  CASE
    WHEN t.tgtype & 4 = 4 THEN 'INSERT'
    WHEN t.tgtype & 8 = 8 THEN 'DELETE'
    WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
    WHEN t.tgtype & 20 = 20 THEN 'INSERT OR UPDATE'
    ELSE 'OTHER (' || t.tgtype::text || ')'
  END AS event,
  t.tgenabled AS enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal  -- exclude system triggers
ORDER BY c.relname, t.tgname;


-- 2. Check for DUPLICATE triggers (same table + same function)
SELECT
  c.relname AS table_name,
  p.proname AS function_name,
  count(*) AS trigger_count,
  CASE WHEN count(*) > 1 THEN '⚠️ DUPLICATE!' ELSE '✅ OK' END AS status
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
GROUP BY c.relname, p.proname
HAVING count(*) > 1
ORDER BY trigger_count DESC;


-- 3. Verify our specific triggers exist
SELECT
  trigger_name,
  table_name,
  function_name,
  '✅ EXISTS' AS status
FROM (
  VALUES
    ('on_profile_create_social', 'profiles', 'handle_new_user_social'),
    ('on_profile_change_update_stats', 'profiles', 'trigger_update_app_stats'),
    ('on_note_change_update_stats', 'notes', 'trigger_update_app_stats'),
    ('on_quiz_attempt_update_stats', 'quiz_attempts', 'trigger_update_app_stats'),
    ('on_document_change_update_stats', 'documents', 'trigger_update_app_stats'),
    ('on_podcast_change_update_stats', 'ai_podcasts', 'trigger_update_app_stats')
) AS expected(trigger_name, table_name, function_name)
WHERE EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_proc p ON t.tgfoid = p.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
    AND t.tgname = expected.trigger_name
    AND c.relname = expected.table_name
    AND p.proname = expected.function_name
)
UNION ALL
SELECT
  expected.trigger_name,
  expected.table_name,
  expected.function_name,
  '❌ MISSING' AS status
FROM (
  VALUES
    ('on_profile_create_social', 'profiles', 'handle_new_user_social'),
    ('on_profile_change_update_stats', 'profiles', 'trigger_update_app_stats'),
    ('on_note_change_update_stats', 'notes', 'trigger_update_app_stats'),
    ('on_quiz_attempt_update_stats', 'quiz_attempts', 'trigger_update_app_stats'),
    ('on_document_change_update_stats', 'documents', 'trigger_update_app_stats'),
    ('on_podcast_change_update_stats', 'ai_podcasts', 'trigger_update_app_stats')
) AS expected(trigger_name, table_name, function_name)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  JOIN pg_proc p ON t.tgfoid = p.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
    AND t.tgname = expected.trigger_name
    AND c.relname = expected.table_name
    AND p.proname = expected.function_name
)
ORDER BY trigger_name;


-- 4. Check our specific functions exist
SELECT
  routine_name,
  routine_type,
  '✅ EXISTS' AS status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'update_app_stats',
    'trigger_update_app_stats',
    'handle_new_user_social'
  )
ORDER BY routine_name;


-- 5. Check app_stats current values
SELECT * FROM app_stats;


-- 6. Check social_users count vs profiles count
SELECT
  (SELECT count(*) FROM profiles) AS profiles_count,
  (SELECT count(*) FROM social_users) AS social_users_count,
  CASE
    WHEN (SELECT count(*) FROM profiles) = (SELECT count(*) FROM social_users) THEN '✅ MATCH'
    ELSE '⚠️ MISMATCH — ' || ((SELECT count(*) FROM profiles) - (SELECT count(*) FROM social_users))::text || ' profiles without social_users'
  END AS sync_status;


-- 7. Find profiles WITHOUT social_users (should be 0 after trigger runs)
SELECT
  p.id,
  p.email,
  p.full_name,
  '❌ MISSING social_users' AS status
FROM profiles p
LEFT JOIN social_users s ON s.id = p.id
WHERE s.id IS NULL
LIMIT 20;


-- 8. Check social_users with default "Scholar" display_name (not synced from profile)
SELECT
  s.id,
  s.username,
  s.display_name,
  p.full_name AS profile_name,
  CASE
    WHEN s.display_name = 'Scholar' AND p.full_name IS NOT NULL AND p.full_name != 'Scholar'
    THEN '⚠️ NOT SYNCED'
    ELSE '✅ OK'
  END AS sync_status
FROM social_users s
JOIN profiles p ON p.id = s.id
WHERE s.display_name = 'Scholar'
  AND p.full_name IS NOT NULL
  AND p.full_name != 'Scholar'
LIMIT 20;
