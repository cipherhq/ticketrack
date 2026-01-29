-- ============================================================================
-- COMPARE DATABASE COUNTS
-- ============================================================================
-- Run this in BOTH Production and Dev to see the differences
-- ============================================================================

-- Summary counts
SELECT 
    'Functions' as type, 
    COUNT(*) as count
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_type = 'FUNCTION'
UNION ALL
SELECT 
    'Views' as type, 
    COUNT(*) as count
FROM information_schema.views 
WHERE table_schema = 'public'
UNION ALL
SELECT 
    'Triggers' as type, 
    COUNT(*) as count
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
UNION ALL
SELECT 
    'RLS Policies' as type, 
    COUNT(*) as count
FROM pg_policies 
WHERE schemaname = 'public';

-- Detailed function list (to find the 1 missing)
SELECT routine_name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
    AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Detailed view list (to find the 1 missing)
SELECT table_name
FROM information_schema.views 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Detailed trigger list (to find the 3 missing)
SELECT 
    event_object_table || '.' || trigger_name as trigger_full_name
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
