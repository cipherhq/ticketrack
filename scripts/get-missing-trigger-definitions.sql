-- ============================================================================
-- GET MISSING TRIGGER DEFINITIONS FROM PRODUCTION
-- ============================================================================
-- Run this in PRODUCTION SQL Editor
-- Copy the results to add to migration script
-- ============================================================================

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
    AND (
        (it.trigger_name = 'update_communication_campaigns_updated_at' AND it.event_object_table = 'communication_campaigns') OR
        (it.trigger_name = 'update_communication_messages_updated_at' AND it.event_object_table = 'communication_messages') OR
        (it.trigger_name = 'update_contact_segments_updated_at' AND it.event_object_table = 'contact_segments') OR
        (it.trigger_name = 'update_contacts_updated_at' AND it.event_object_table = 'contacts') OR
        (it.trigger_name = 'trigger_update_conversation_on_message' AND it.event_object_table = 'conversation_messages') OR
        (it.trigger_name = 'message_templates_updated_at' AND it.event_object_table = 'message_templates') OR
        (it.trigger_name = 'platform_settings_updated_at' AND it.event_object_table = 'platform_settings') OR
        (it.trigger_name = 'trigger_automation_ticket_purchase' AND it.event_object_table = 'tickets') OR
        (it.trigger_name = 'trigger_update_section_capacity' AND it.event_object_table = 'venue_capacity')
    )
ORDER BY it.event_object_table, it.trigger_name;
