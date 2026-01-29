-- ============================================================================
-- FIND MISSING ITEMS IN DEV
-- ============================================================================
-- Run these queries in PRODUCTION SQL Editor first, then compare with Dev
-- ============================================================================

-- 1. LIST ALL FUNCTIONS (Production)
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 2. LIST ALL VIEWS (Production)
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. LIST ALL TRIGGERS (Production)
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 4. LIST ALL CRON JOBS (Production)
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
ORDER BY jobname;

-- 5. LIST ALL RLS POLICIES (Production) - First 50
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname
LIMIT 50;

-- 6. LIST ALL INDEXES (Production) - First 50
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname
LIMIT 50;

-- ============================================================================
-- COMPARISON SUMMARY
-- ============================================================================
-- Production has:
-- - 103 functions (Dev has 60) → 43 missing
-- - 4 views (Dev has 0) → 4 missing
-- - 40 triggers (Dev has 29) → 11 missing
-- - 8 cron jobs (Dev has 5) → 3 missing
-- - 479 policies (Dev has 386) → 93 missing
-- - 640 indexes (Dev has 413) → 227 missing
-- ============================================================================
