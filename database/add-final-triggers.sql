-- ============================================================================
-- ADD FINAL MISSING TRIGGERS TO DEV DATABASE
-- ============================================================================
-- Run this in Dev Supabase SQL Editor
-- 
-- This adds the 2 triggers that are still missing:
-- 1. message_templates.message_templates_updated_at
-- 2. venue_capacity.trigger_update_section_capacity (for INSERT and UPDATE)
-- ============================================================================

BEGIN;

-- ============================================================================
-- TRIGGER 1: message_templates_updated_at
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_templates') THEN
        -- Ensure the function exists first
        CREATE OR REPLACE FUNCTION public.update_message_templates_updated_at()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$;
        
        DROP TRIGGER IF EXISTS message_templates_updated_at ON public.message_templates;
        
        CREATE TRIGGER message_templates_updated_at 
        BEFORE UPDATE ON public.message_templates 
        FOR EACH ROW 
        EXECUTE FUNCTION update_message_templates_updated_at();
        
        RAISE NOTICE 'Created trigger: message_templates.message_templates_updated_at';
    ELSE
        RAISE NOTICE 'Skipped trigger: message_templates.message_templates_updated_at (table message_templates does not exist)';
    END IF;
END $$;

-- ============================================================================
-- TRIGGER 2: trigger_update_section_capacity (for venue_capacity table)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venue_capacity') THEN
        -- Ensure the function exists first
        CREATE OR REPLACE FUNCTION public.update_section_capacity_from_iot()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            -- Update section capacity based on IoT zone data
            UPDATE section_capacity
            SET
                current_occupancy = NEW.current_occupancy,
                utilization_rate = (NEW.current_occupancy::DECIMAL / section_capacity.max_capacity) * 100,
                available_capacity = section_capacity.max_capacity - NEW.current_occupancy,
                last_updated = NEW.last_updated,
                updated_by_sensor = NEW.updated_by_sensor
            FROM layout_sections ls
            WHERE section_capacity.section_id = ls.id
                AND ls.iot_zone_id = NEW.zone_id
                AND section_capacity.event_id IS NOT NULL; -- Only for active events

            RETURN NEW;
        END;
        $$;
        
        DROP TRIGGER IF EXISTS trigger_update_section_capacity ON public.venue_capacity;
        
        -- Create trigger for both INSERT and UPDATE (as it appears twice in production)
        CREATE TRIGGER trigger_update_section_capacity 
        AFTER INSERT OR UPDATE ON public.venue_capacity 
        FOR EACH ROW 
        EXECUTE FUNCTION update_section_capacity_from_iot();
        
        RAISE NOTICE 'Created trigger: venue_capacity.trigger_update_section_capacity';
    ELSE
        RAISE NOTICE 'Skipped trigger: venue_capacity.trigger_update_section_capacity (table venue_capacity does not exist)';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify the triggers were created:
SELECT 
    event_object_table || '.' || trigger_name as trigger_full_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND (
        (event_object_table = 'message_templates' AND trigger_name = 'message_templates_updated_at') OR
        (event_object_table = 'venue_capacity' AND trigger_name = 'trigger_update_section_capacity')
    )
ORDER BY event_object_table, trigger_name;

-- Final count check
SELECT 
    'Total Triggers' as type,
    COUNT(*) as count
FROM information_schema.triggers
WHERE trigger_schema = 'public';
