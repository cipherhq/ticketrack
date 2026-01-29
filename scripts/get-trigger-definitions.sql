-- ============================================================================
-- GET TRIGGER DEFINITIONS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- Copy the results to generate migration script
-- ============================================================================

-- Get all trigger definitions
SELECT 
    it.trigger_name,
    it.event_object_table,
    it.action_timing,
    it.event_manipulation,
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
-- GET DEV TRIGGERS (for comparison)
-- ============================================================================
-- Run this in DEV SQL Editor to see what exists
-- ============================================================================

SELECT 
    trigger_name,
    event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
