-- ============================================================================
-- GET MISSING OBJECTS - Run in PRODUCTION SQL Editor
-- ============================================================================
-- Copy the results and share them to generate migration script
-- ============================================================================

-- 1. ALL FUNCTIONS (with full definitions)
SELECT 
    'FUNCTION' as object_type,
    routine_name as name,
    routine_type,
    data_type as return_type,
    pg_get_functiondef(p.oid) as full_definition
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.routine_schema = 'public'
    AND n.nspname = 'public'
ORDER BY r.routine_name;

-- 2. ALL VIEWS (with full definitions)
SELECT 
    'VIEW' as object_type,
    table_name as name,
    view_definition as full_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. ALL TRIGGERS (with full definitions)
SELECT 
    'TRIGGER' as object_type,
    trigger_name as name,
    event_object_table as table_name,
    action_timing,
    event_manipulation,
    pg_get_triggerdef(t.oid) as full_definition
FROM information_schema.triggers it
JOIN pg_trigger t ON t.tgname = it.trigger_name
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE it.trigger_schema = 'public'
    AND n.nspname = 'public'
    AND NOT t.tgisinternal
ORDER BY it.event_object_table, it.trigger_name;

-- ============================================================================
-- ALTERNATIVE: Get just names for quick comparison
-- ============================================================================

-- Functions (names only)
SELECT 'FUNCTION' as type, routine_name as name
FROM information_schema.routines 
WHERE routine_schema = 'public' 
ORDER BY routine_name;

-- Views (names only)
SELECT 'VIEW' as type, table_name as name
FROM information_schema.views 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Triggers (names only)
SELECT 'TRIGGER' as type, trigger_name as name, event_object_table as table_name
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table, trigger_name;
