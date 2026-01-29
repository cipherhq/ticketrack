-- ============================================================================
-- GET ALL RLS POLICIES FROM DEV
-- ============================================================================
-- Run this in DEV SQL Editor
-- Copy the results to compare with production
-- ============================================================================

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
