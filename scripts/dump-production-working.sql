-- ============================================================================
-- DUMP PRODUCTION SCHEMA - WORKING VERSION
-- ============================================================================
-- Run each query SEPARATELY in Production SQL Editor
-- Copy the results column and save to a file
-- ============================================================================

-- ============================================================================
-- QUERY 1: ALL FUNCTIONS
-- ============================================================================
-- Run this query, copy the "function_sql" column values
SELECT 
    pg_get_functiondef(p.oid) || ';' as function_sql
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ============================================================================
-- QUERY 2: ALL VIEWS
-- ============================================================================
-- Run this query, copy the "view_sql" column values
SELECT 
    'CREATE OR REPLACE VIEW public.' || table_name || ' AS ' || view_definition || ';' as view_sql
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================================
-- QUERY 3: ALL TRIGGERS
-- ============================================================================
-- Run this query, copy the "trigger_sql" column values
SELECT 
    'DROP TRIGGER IF EXISTS ' || trigger_name || ' ON public.' || event_object_table || '; ' ||
    'CREATE TRIGGER ' || trigger_name || ' ' ||
    action_timing || ' ' || event_manipulation || ' ON public.' || event_object_table || ' ' ||
    'FOR EACH ROW EXECUTE FUNCTION ' || 
    REGEXP_REPLACE(action_statement, '.*EXECUTE FUNCTION ([^(]+).*', '\1') || '();' as trigger_sql
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- QUERY 4: ALL RLS POLICIES  
-- ============================================================================
-- Run this query, copy the "policy_sql" column values
SELECT 
    'DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ''public'' AND table_name = ''' || tablename || ''') THEN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = ''public'' AND tablename = ''' || tablename || ''' AND policyname = ''' || policyname || ''') THEN CREATE POLICY "' || policyname || '" ON public.' || tablename || ' AS ' || permissive || ' FOR ' || cmd || ' TO ' || COALESCE(roles::text, 'public') ||
    CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END ||
    CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END ||
    '; END IF; END IF; END $$;' as policy_sql
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
