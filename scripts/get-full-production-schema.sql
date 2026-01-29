-- ============================================================================
-- GET FULL PRODUCTION SCHEMA
-- ============================================================================
-- Run this in PRODUCTION Supabase SQL Editor
-- This generates SQL to recreate all database objects
-- ============================================================================

-- ============================================================================
-- 1. ALL FUNCTIONS
-- ============================================================================
SELECT 
    '-- Function: ' || routine_name || E'\n' ||
    pg_get_functiondef(p.oid) || E';\n\n' as function_sql
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.routine_schema = 'public'
    AND n.nspname = 'public'
    AND r.routine_type = 'FUNCTION'
ORDER BY r.routine_name;

-- ============================================================================
-- 2. ALL VIEWS
-- ============================================================================
SELECT 
    '-- View: ' || table_name || E'\n' ||
    'CREATE OR REPLACE VIEW public.' || table_name || ' AS ' || E'\n' ||
    view_definition || E';\n\n' as view_sql
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- 3. ALL TRIGGERS
-- ============================================================================
SELECT 
    '-- Trigger: ' || trigger_name || ' on ' || event_object_table || E'\n' ||
    'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON public.' || event_object_table || E';\n' ||
    'CREATE TRIGGER ' || trigger_name || E'\n' ||
    '    ' || action_timing || ' ' || 
    CASE 
        WHEN event_manipulation = 'INSERT' THEN 'INSERT'
        WHEN event_manipulation = 'UPDATE' THEN 'UPDATE'
        WHEN event_manipulation = 'DELETE' THEN 'DELETE'
        ELSE event_manipulation
    END || E' ON public.' || event_object_table || E'\n' ||
    '    FOR EACH ROW' || E'\n' ||
    '    EXECUTE FUNCTION ' || 
    REPLACE(REPLACE(action_statement, 'EXECUTE FUNCTION ', ''), '()', '') || E'();\n\n' as trigger_sql
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- 4. ALL RLS POLICIES
-- ============================================================================
SELECT 
    '-- Policy: ' || policyname || ' on ' || tablename || E'\n' ||
    'DO $$' || E'\n' ||
    'BEGIN' || E'\n' ||
    '    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''' || tablename || ''') THEN' || E'\n' ||
    '        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''' || tablename || ''' AND policyname = ''' || policyname || ''') THEN' || E'\n' ||
    '            CREATE POLICY "' || policyname || '" ON public.' || tablename || E'\n' ||
    '                AS ' || permissive || E'\n' ||
    '                FOR ' || cmd || E'\n' ||
    '                TO ' || COALESCE(roles::text, 'public') || E'\n' ||
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
    'END $$;' || E'\n\n' as policy_sql
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
