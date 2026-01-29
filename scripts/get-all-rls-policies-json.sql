-- ============================================================================
-- GET ALL RLS POLICIES AS JSON
-- ============================================================================
-- Run this in PRODUCTION Supabase SQL Editor
-- Copy the results (JSON array) and save to policies.json
-- ============================================================================

SELECT 
    json_build_object(
        'policy_sql',
        'DO $$' || E'\n' ||
        'BEGIN' || E'\n' ||
        '    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''' || tablename || ''') THEN' || E'\n' ||
        '        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''' || tablename || ''' AND policyname = ''' || policyname || ''') THEN' || E'\n' ||
        '            CREATE POLICY "' || policyname || '" ON public.' || tablename || E'\n' ||
        '                AS ' || permissive || E'\n' ||
        '                FOR ' || cmd || E'\n' ||
        '                TO ''public''' || E'\n' ||
        CASE 
            WHEN qual IS NOT NULL THEN '                USING (' || qual || ')' || E'\n'
            ELSE ''
        END ||
        CASE 
            WHEN with_check IS NOT NULL THEN '                WITH CHECK (' || with_check || ')' || E'\n'
            ELSE ''
        END ||
        '            ;' || E'\n' ||
        '        END IF;' || E'\n' ||
        '    END IF;' || E'\n' ||
        'END $$;'
    ) as policy_sql
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
