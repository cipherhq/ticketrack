-- ============================================================================
-- GENERATE CREATE POLICY STATEMENTS FOR ALL PRODUCTION POLICIES
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- This generates CREATE POLICY statements wrapped in conditional checks
-- Copy the output and run it in DEV SQL Editor
-- ============================================================================

SELECT 
    'DO $$' || E'\n' ||
    'BEGIN' || E'\n' ||
    '    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''' || tablename || ''') THEN' || E'\n' ||
    '        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''' || tablename || ''' AND policyname = ''' || policyname || ''') THEN' || E'\n' ||
    '            CREATE POLICY "' || policyname || '" ON ' || schemaname || '.' || tablename || E'\n' ||
    '                AS ' || permissive || E'\n' ||
    '                FOR ' || cmd || E'\n' ||
    '                TO ' || 
    CASE 
        WHEN roles::text = '{public}' THEN 'public'
        WHEN roles::text = '{authenticated}' THEN 'authenticated'
        WHEN roles::text = '{anon}' THEN 'anon'
        WHEN roles::text = '{anon,authenticated}' THEN 'anon, authenticated'
        ELSE REPLACE(REPLACE(roles::text, '{', ''), '}', '')
    END || E'\n' ||
    COALESCE('                USING (' || qual || ')' || E'\n', '') ||
    COALESCE('                WITH CHECK (' || with_check || ')' || E'\n', '') ||
    '            ;' || E'\n' ||
    '        END IF;' || E'\n' ||
    '    END IF;' || E'\n' ||
    'END $$;' as create_policy_statement
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
