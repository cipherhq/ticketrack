-- ============================================================================
-- GET PRODUCTION DATABASE OBJECTS
-- ============================================================================
-- Run this in PRODUCTION Supabase SQL Editor
-- Copy the results for each query
-- ============================================================================

-- 1. ALL FUNCTIONS (with definitions)
SELECT 
    routine_name,
    routine_type,
    data_type as return_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 2. ALL VIEWS (with definitions)
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. ALL TRIGGERS (with definitions)
SELECT 
    trigger_name,
    event_object_table as table_name,
    action_timing,
    event_manipulation,
    action_statement,
    action_condition
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 4. ALL RLS POLICIES (first 100)
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
ORDER BY tablename, policyname
LIMIT 100;

-- 5. ALL INDEXES (first 100)
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname
LIMIT 100;

-- ============================================================================
-- ALTERNATIVE: Get just the names for comparison
-- ============================================================================

-- Functions (names only)
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' ORDER BY routine_name;

-- Views (names only)
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' ORDER BY table_name;

-- Triggers (names only)
SELECT trigger_name, event_object_table FROM information_schema.triggers 
WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;
