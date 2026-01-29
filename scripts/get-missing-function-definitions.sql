-- ============================================================================
-- GET MISSING FUNCTION DEFINITIONS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- Copy the results to add to migration script
-- ============================================================================

SELECT 
    routine_name,
    routine_type,
    data_type as return_type,
    pg_get_functiondef(p.oid) as full_definition
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE r.routine_schema = 'public'
    AND n.nspname = 'public'
    AND r.routine_name IN (
        'update_comm_hub_updated_at',
        'update_conversation_on_message',
        'update_message_templates_updated_at',
        'update_platform_settings_updated_at',
        'trigger_automation_on_ticket_purchase',
        'update_section_capacity_from_iot'
    )
ORDER BY r.routine_name;
