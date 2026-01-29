-- ============================================================================
-- GENERATE CREATE POLICY STATEMENTS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- This will generate CREATE POLICY statements for all RLS policies
-- Copy the output and run it in DEV SQL Editor
-- ============================================================================

SELECT 
    'CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename || E'\n' ||
    '    AS ' || permissive || E'\n' ||
    '    FOR ' || cmd || E'\n' ||
    CASE 
        WHEN roles::text = '{public}' THEN '    TO public'
        WHEN roles::text = '{authenticated}' THEN '    TO authenticated'
        WHEN roles::text = '{anon}' THEN '    TO anon'
        WHEN roles::text = '{anon,authenticated}' THEN '    TO anon, authenticated'
        ELSE '    TO ' || array_to_string(roles, ', ')
    END || E'\n' ||
    CASE 
        WHEN qual IS NOT NULL THEN '    USING (' || qual || ')'
        ELSE ''
    END ||
    CASE 
        WHEN qual IS NOT NULL AND with_check IS NOT NULL THEN E'\n'
        WHEN qual IS NULL AND with_check IS NOT NULL THEN ''
        ELSE ''
    END ||
    CASE 
        WHEN with_check IS NOT NULL THEN '    WITH CHECK (' || with_check || ')'
        ELSE ''
    END || ';' as create_policy_statement
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
