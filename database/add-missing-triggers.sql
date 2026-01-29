-- ============================================================================
-- ADD MISSING FUNCTIONS AND TRIGGERS TO DEV DATABASE
-- ============================================================================
-- Run this in Dev Supabase SQL Editor
-- 
-- This adds:
-- 6 missing functions (required by triggers)
-- 9 missing triggers from production
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: CREATE MISSING FUNCTIONS
-- ============================================================================

-- Function 1: update_comm_hub_updated_at
CREATE OR REPLACE FUNCTION public.update_comm_hub_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- Function 2: update_conversation_on_message
CREATE OR REPLACE FUNCTION public.update_conversation_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE conversations
    SET 
        last_message_at = NEW.created_at,
        last_message_preview = LEFT(NEW.content, 100),
        last_message_direction = NEW.direction,
        unread_count = CASE 
            WHEN NEW.direction = 'inbound' THEN unread_count + 1
            ELSE unread_count
        END,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    
    RETURN NEW;
END;
$function$;

-- Function 3: update_message_templates_updated_at
CREATE OR REPLACE FUNCTION public.update_message_templates_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Function 4: update_platform_settings_updated_at
CREATE OR REPLACE FUNCTION public.update_platform_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Function 5: trigger_automation_on_ticket_purchase
CREATE OR REPLACE FUNCTION public.trigger_automation_on_ticket_purchase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_automation RECORD;
    v_event RECORD;
    v_context JSONB;
BEGIN
    -- Only trigger for completed payments
    IF NEW.payment_status != 'completed' THEN
        RETURN NEW;
    END IF;
    
    -- Get event details
    SELECT e.*, o.business_name as organizer_name
    INTO v_event
    FROM public.events e
    JOIN public.organizers o ON e.organizer_id = o.id
    WHERE e.id = NEW.event_id;
    
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;
    
    -- Build context for variable replacement
    v_context := jsonb_build_object(
        'attendee_name', NEW.attendee_name,
        'attendee_email', NEW.attendee_email,
        'attendee_phone', NEW.attendee_phone,
        'event_name', v_event.title,
        'event_date', to_char(v_event.start_date, 'Month DD, YYYY'),
        'event_time', to_char(v_event.start_date, 'HH12:MI AM'),
        'venue_name', COALESCE(v_event.venue_name, 'TBA'),
        'organizer_name', v_event.organizer_name,
        'ticket_id', NEW.id,
        'ticket_type', NEW.ticket_type_id
    );
    
    -- Find active automations for ticket_purchase trigger
    FOR v_automation IN
        SELECT * FROM public.communication_automations
        WHERE organizer_id = v_event.organizer_id
        AND trigger_type = 'ticket_purchase'
        AND status = 'active'
    LOOP
        -- Create automation run
        INSERT INTO public.communication_automation_runs (
            automation_id,
            organizer_id,
            ticket_id,
            event_id,
            context_data,
            status,
            started_at,
            next_action_at
        ) VALUES (
            v_automation.id,
            v_event.organizer_id,
            NEW.id,
            NEW.event_id,
            v_context,
            'running',
            NOW(),
            NOW() + (COALESCE((v_automation.actions->0->>'delay_minutes')::INTEGER, 0) * INTERVAL '1 minute')
        );
        
        -- Update automation stats
        UPDATE public.communication_automations
        SET total_triggered = total_triggered + 1,
            last_triggered_at = NOW()
        WHERE id = v_automation.id;
    END LOOP;
    
    RETURN NEW;
END;
$function$;

-- Function 6: update_section_capacity_from_iot
CREATE OR REPLACE FUNCTION public.update_section_capacity_from_iot()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;

-- ============================================================================
-- STEP 2: CREATE MISSING TRIGGERS
-- ============================================================================

-- ============================================================================
-- TRIGGER 1: update_communication_campaigns_updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_communication_campaigns_updated_at ON public.communication_campaigns;

CREATE TRIGGER update_communication_campaigns_updated_at 
BEFORE UPDATE ON public.communication_campaigns 
FOR EACH ROW 
EXECUTE FUNCTION update_comm_hub_updated_at();

-- ============================================================================
-- TRIGGER 2: update_communication_messages_updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_communication_messages_updated_at ON public.communication_messages;

CREATE TRIGGER update_communication_messages_updated_at 
BEFORE UPDATE ON public.communication_messages 
FOR EACH ROW 
EXECUTE FUNCTION update_comm_hub_updated_at();

-- ============================================================================
-- TRIGGER 3: update_contact_segments_updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_contact_segments_updated_at ON public.contact_segments;

CREATE TRIGGER update_contact_segments_updated_at 
BEFORE UPDATE ON public.contact_segments 
FOR EACH ROW 
EXECUTE FUNCTION update_comm_hub_updated_at();

-- ============================================================================
-- TRIGGER 4: update_contacts_updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_contacts_updated_at ON public.contacts;

CREATE TRIGGER update_contacts_updated_at 
BEFORE UPDATE ON public.contacts 
FOR EACH ROW 
EXECUTE FUNCTION update_comm_hub_updated_at();

-- ============================================================================
-- TRIGGER 5: trigger_update_conversation_on_message
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON public.conversation_messages;

CREATE TRIGGER trigger_update_conversation_on_message 
AFTER INSERT ON public.conversation_messages 
FOR EACH ROW 
EXECUTE FUNCTION update_conversation_on_message();

-- ============================================================================
-- TRIGGER 6: message_templates_updated_at
-- ============================================================================
-- Only create if message_templates table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_templates') THEN
        DROP TRIGGER IF EXISTS message_templates_updated_at ON public.message_templates;
        
        CREATE TRIGGER message_templates_updated_at 
        BEFORE UPDATE ON public.message_templates 
        FOR EACH ROW 
        EXECUTE FUNCTION update_message_templates_updated_at();
        
        RAISE NOTICE 'Created trigger: message_templates_updated_at';
    ELSE
        RAISE NOTICE 'Skipped trigger: message_templates_updated_at (table message_templates does not exist)';
    END IF;
END $$;

-- ============================================================================
-- TRIGGER 7: platform_settings_updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS platform_settings_updated_at ON public.platform_settings;

CREATE TRIGGER platform_settings_updated_at 
BEFORE UPDATE ON public.platform_settings 
FOR EACH ROW 
EXECUTE FUNCTION update_platform_settings_updated_at();

-- ============================================================================
-- TRIGGER 8: trigger_automation_ticket_purchase
-- ============================================================================
DROP TRIGGER IF EXISTS trigger_automation_ticket_purchase ON public.tickets;

CREATE TRIGGER trigger_automation_ticket_purchase 
AFTER INSERT OR UPDATE ON public.tickets 
FOR EACH ROW 
EXECUTE FUNCTION trigger_automation_on_ticket_purchase();

-- ============================================================================
-- TRIGGER 9: trigger_update_section_capacity
-- ============================================================================
-- Only create if venue_capacity table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venue_capacity') THEN
        DROP TRIGGER IF EXISTS trigger_update_section_capacity ON public.venue_capacity;
        
        CREATE TRIGGER trigger_update_section_capacity 
        AFTER INSERT OR UPDATE ON public.venue_capacity 
        FOR EACH ROW 
        EXECUTE FUNCTION update_section_capacity_from_iot();
        
        RAISE NOTICE 'Created trigger: trigger_update_section_capacity';
    ELSE
        RAISE NOTICE 'Skipped trigger: trigger_update_section_capacity (table venue_capacity does not exist)';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify all triggers were created:
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name IN (
        'update_communication_campaigns_updated_at',
        'update_communication_messages_updated_at',
        'update_contact_segments_updated_at',
        'update_contacts_updated_at',
        'trigger_update_conversation_on_message',
        'message_templates_updated_at',
        'platform_settings_updated_at',
        'trigger_automation_ticket_purchase',
        'trigger_update_section_capacity'
    )
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- Created 6 functions:
--   1. update_comm_hub_updated_at()
--   2. update_conversation_on_message()
--   3. update_message_templates_updated_at()
--   4. update_platform_settings_updated_at()
--   5. trigger_automation_on_ticket_purchase()
--   6. update_section_capacity_from_iot()
--
-- Created 9 triggers:
--   1. update_communication_campaigns_updated_at
--   2. update_communication_messages_updated_at
--   3. update_contact_segments_updated_at
--   4. update_contacts_updated_at
--   5. trigger_update_conversation_on_message
--   6. message_templates_updated_at
--   7. platform_settings_updated_at
--   8. trigger_automation_ticket_purchase
--   9. trigger_update_section_capacity
-- ============================================================================
