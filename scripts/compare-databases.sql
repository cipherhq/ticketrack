-- ============================================================================
-- DATABASE COMPARISON QUERIES
-- ============================================================================
-- Run these queries in BOTH Production and Dev Supabase SQL Editors
-- to compare table structures
-- ============================================================================

-- Query 1: List all public tables
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Query 2: Count tables
SELECT 
    COUNT(*) as table_count
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE';

-- Query 3: List all tables with row counts (if accessible)
SELECT 
    schemaname,
    tablename,
    n_tup_ins as estimated_rows
FROM pg_stat_user_tables
ORDER BY tablename;

-- Query 4: List all views
SELECT 
    table_schema,
    table_name
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- Query 5: List all functions
SELECT 
    routine_schema,
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Query 6: List all sequences
SELECT 
    sequence_schema,
    sequence_name
FROM information_schema.sequences
WHERE sequence_schema = 'public'
ORDER BY sequence_name;

-- Query 7: List all indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Query 8: List all foreign keys
SELECT
    tc.table_schema, 
    tc.table_name, 
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- Query 9: Get table columns with details
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- Query 10: Summary comparison (run this in both and compare results)
SELECT 
    'Tables' as object_type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 
    'Views' as object_type,
    COUNT(*) as count
FROM information_schema.views
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Functions' as object_type,
    COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
UNION ALL
SELECT 
    'Sequences' as object_type,
    COUNT(*) as count
FROM information_schema.sequences
WHERE sequence_schema = 'public';
