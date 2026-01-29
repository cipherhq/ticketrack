-- ============================================================================
-- SIMPLE DUMP QUERIES - Run each separately
-- ============================================================================
-- Run each query one at a time in Production SQL Editor
-- Copy the results and save to a text file
-- ============================================================================

-- QUERY 1: Get all function definitions
SELECT pg_get_functiondef(p.oid) || ';'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- QUERY 2: Get all view definitions  
SELECT 'CREATE OR REPLACE VIEW public.' || table_name || ' AS ' || view_definition || ';'
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- QUERY 3: Get all trigger definitions
SELECT 
    'DROP TRIGGER IF EXISTS ' || t.trigger_name || ' ON public.' || t.event_object_table || ';' || chr(10) ||
    'CREATE TRIGGER ' || t.trigger_name || chr(10) ||
    '    ' || t.action_timing || ' ' || t.event_manipulation || ' ON public.' || t.event_object_table || chr(10) ||
    '    FOR EACH ROW' || chr(10) ||
    '    EXECUTE FUNCTION ' || 
    SUBSTRING(t.action_statement FROM 'EXECUTE FUNCTION ([^(]+)') || '();'
FROM information_schema.triggers t
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;

-- QUERY 4: Get all RLS policy definitions
SELECT 
    'DO $$' || chr(10) ||
    'BEGIN' || chr(10) ||
    '    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''' || p.tablename || ''') THEN' || chr(10) ||
    '        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''' || p.tablename || ''' AND policyname = ''' || p.policyname || ''') THEN' || chr(10) ||
    '            CREATE POLICY "' || p.policyname || '" ON public.' || p.tablename || chr(10) ||
    '                AS ' || p.permissive || chr(10) ||
    '                FOR ' || p.cmd || chr(10) ||
    '                TO ' || COALESCE(p.roles::text, 'public') || chr(10) ||
    COALESCE('                USING (' || p.qual || ')' || chr(10), '') ||
    COALESCE('                WITH CHECK (' || p.with_check || ')' || chr(10), '') ||
    '            ;' || chr(10) ||
    '        END IF;' || chr(10) ||
    '    END IF;' || chr(10) ||
    'END $$;'
FROM pg_policies p
WHERE p.schemaname = 'public'
ORDER BY p.tablename, p.policyname;
