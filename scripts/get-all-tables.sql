-- ============================================================================
-- GET ALL TABLES - Run this in BOTH Production and Dev SQL Editors
-- ============================================================================
-- Copy the results and compare them
-- ============================================================================

-- Query 1: List all public tables (most important)
SELECT 
    'TABLE' as object_type,
    table_name,
    'public' as schema_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Query 2: Count tables
SELECT 
    COUNT(*) as total_tables
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- Query 3: List all views
SELECT 
    'VIEW' as object_type,
    table_name as view_name,
    'public' as schema_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- Query 4: List all functions
SELECT 
    'FUNCTION' as object_type,
    routine_name as function_name,
    routine_schema as schema_name
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Query 5: Complete summary
SELECT 
    'Tables' as object_type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Views',
    COUNT(*)
FROM information_schema.views
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Functions',
    COUNT(*)
FROM information_schema.routines
WHERE routine_schema = 'public'
UNION ALL
SELECT 
    'Sequences',
    COUNT(*)
FROM information_schema.sequences
WHERE sequence_schema = 'public';
