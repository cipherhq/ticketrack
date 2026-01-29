-- ============================================================================
-- GET FUNCTIONS AND VIEWS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- Copy the results to generate migration scripts
-- ============================================================================

-- ============================================================================
-- PART 1: ALL FUNCTIONS (with full definitions)
-- ============================================================================
SELECT 
    routine_name,
    routine_type,
    data_type as return_type,
    pg_get_functiondef(p.oid) as full_definition
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.routine_schema = 'public'
    AND n.nspname = 'public'
ORDER BY r.routine_name;

-- ============================================================================
-- PART 2: FUNCTIONS (names only - for quick comparison)
-- ============================================================================
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- ============================================================================
-- PART 3: ALL VIEWS (with full definitions)
-- ============================================================================
SELECT 
    table_name as view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- PART 4: VIEWS (names only - for quick comparison)
-- ============================================================================
SELECT table_name as view_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;
