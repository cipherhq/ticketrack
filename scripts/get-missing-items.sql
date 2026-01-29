-- ============================================================================
-- GET MISSING ITEMS - Run in PRODUCTION SQL Editor
-- ============================================================================
-- This will help identify what's still missing in dev
-- ============================================================================

-- 1. Get all function names (to compare with dev)
SELECT 
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 2. Get all view names
SELECT 
    table_name as view_name
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. Get all trigger names
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 4. Get all RLS policy names
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
