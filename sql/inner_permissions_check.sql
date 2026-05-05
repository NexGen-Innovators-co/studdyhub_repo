-- 1. Check if RLS is currently enabled on the podcast tables
SELECT 
    relname as table_name, 
    CASE WHEN relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE nspname = 'public'
AND relname IN (
    'ai_podcasts', 
    'podcast_participation_requests', 
    'audio_segments', 
    'podcast_recordings', 
    'podcast_listeners'
);

-- 2. View all active policies for these tables
SELECT
    tablename,
    policyname,
    roles,
    cmd as operation,
    qual as using_expression,
    with_check as with_check_expression
FROM
    pg_policies
WHERE
    schemaname = 'public'
    AND tablename IN (
        'ai_podcasts', 
        'podcast_participation_requests', 
        'audio_segments', 
        'podcast_recordings', 
        'podcast_listeners'
    )
ORDER BY
    tablename,
    policyname;
