-- ============================================================================
-- GENERATE CREATE POLICY STATEMENTS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- This generates CREATE POLICY statements that can be run in dev
-- ============================================================================

SELECT 
    'CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename || E'\n' ||
    '    AS ' || permissive || E'\n' ||
    '    FOR ' || cmd || E'\n' ||
    '    TO ' || 
    CASE 
        WHEN roles::text = '{public}' THEN 'public'
        WHEN roles::text = '{authenticated}' THEN 'authenticated'
        WHEN roles::text = '{anon}' THEN 'anon'
        WHEN roles::text = '{anon,authenticated}' THEN 'anon, authenticated'
        ELSE REPLACE(REPLACE(roles::text, '{', ''), '}', '')
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
