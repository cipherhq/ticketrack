-- ============================================================================
-- CHECK DATABASE LOGIC - Run this in BOTH Production and Dev SQL Editors
-- ============================================================================
-- Copy results and compare
-- ============================================================================

-- 1. Check Extensions
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'uuid-ossp', 'pgcrypto')
ORDER BY extname;

-- 2. Check Functions
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 3. Check Views
SELECT 
    table_name as view_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 4. Check Triggers
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 5. Check Cron Jobs (if pg_cron is enabled)
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
ORDER BY jobname;

-- 6. Check RLS Policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Check Indexes
SELECT 
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 8. Summary Counts
SELECT 
    'Extensions' as object_type,
    COUNT(*) as count
FROM pg_extension
WHERE extname IN ('pg_cron', 'pg_net', 'uuid-ossp', 'pgcrypto')
UNION ALL
SELECT 
    'Functions',
    COUNT(*)
FROM information_schema.routines
WHERE routine_schema = 'public'
UNION ALL
SELECT 
    'Views',
    COUNT(*)
FROM information_schema.views
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Triggers',
    COUNT(*)
FROM information_schema.triggers
WHERE trigger_schema = 'public'
UNION ALL
SELECT 
    'Cron Jobs',
    COUNT(*)
FROM cron.job
UNION ALL
SELECT 
    'RLS Policies',
    COUNT(*)
FROM pg_policies
WHERE schemaname = 'public'
UNION ALL
SELECT 
    'Indexes',
    COUNT(*)
FROM pg_indexes
WHERE schemaname = 'public';
