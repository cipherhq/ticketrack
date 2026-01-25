-- ============================================
-- COMMUNICATION AUTOMATIONS SCHEMA
-- ============================================
-- Automation engine for event reminders, follow-ups, and triggered messages
-- ============================================

-- ============================================
-- 1. AUTOMATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.communication_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Automation info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Trigger configuration
    trigger_type VARCHAR(100) NOT NULL, -- 'ticket_purchase', 'event_reminder_7d', 'cart_abandoned', etc.
    trigger_config JSONB DEFAULT '{}', -- Additional trigger settings (event_id, conditions, etc.)
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'draft'
    
    -- Actions (array of action objects)
    actions JSONB NOT NULL DEFAULT '[]', -- [{channel, delay_minutes, content}]
    
    -- Stats
    total_triggered INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_automations_organizer ON public.communication_automations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON public.communication_automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_status ON public.communication_automations(organizer_id, status) WHERE status = 'active';

-- ============================================
-- 2. AUTOMATION RUNS TABLE
-- ============================================
-- Tracks individual execution instances of automations
CREATE TABLE IF NOT EXISTS public.communication_automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.communication_automations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Target
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    ticket_id UUID, -- Reference to ticket if triggered by purchase
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    
    -- Context data for variable replacement
    context_data JSONB DEFAULT '{}',
    
    -- Progress tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    current_action_index INTEGER DEFAULT 0,
    
    -- Action execution log
    action_logs JSONB DEFAULT '[]', -- [{action_index, status, sent_at, message_id, error}]
    
    -- Scheduling
    next_action_at TIMESTAMPTZ,
    
    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON public.communication_automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_organizer ON public.communication_automation_runs(organizer_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON public.communication_automation_runs(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_automation_runs_next_action ON public.communication_automation_runs(next_action_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_automation_runs_contact ON public.communication_automation_runs(contact_id);

-- ============================================
-- 3. SCHEDULED AUTOMATION JOBS
-- ============================================
-- For event reminders that need to be scheduled in advance
CREATE TABLE IF NOT EXISTS public.communication_scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.communication_automations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- What to execute
    job_type VARCHAR(100) NOT NULL, -- 'event_reminder', 'automation_action', 'scheduled_campaign'
    
    -- Target
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    run_id UUID REFERENCES public.communication_automation_runs(id) ON DELETE CASCADE,
    
    -- Job data
    job_data JSONB DEFAULT '{}',
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    processed_at TIMESTAMPTZ,
    error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled ON public.communication_scheduled_jobs(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_event ON public.communication_scheduled_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_automation ON public.communication_scheduled_jobs(automation_id);

-- ============================================
-- 4. TRIGGER: Auto-trigger on ticket purchase
-- ============================================
CREATE OR REPLACE FUNCTION trigger_automation_on_ticket_purchase()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger (check if exists first)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_automation_ticket_purchase') THEN
        CREATE TRIGGER trigger_automation_ticket_purchase
            AFTER INSERT OR UPDATE ON public.tickets
            FOR EACH ROW
            EXECUTE FUNCTION trigger_automation_on_ticket_purchase();
    END IF;
END $$;

-- ============================================
-- 5. FUNCTION: Schedule event reminders
-- ============================================
CREATE OR REPLACE FUNCTION schedule_event_reminders(p_event_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_event RECORD;
    v_automation RECORD;
    v_ticket RECORD;
    v_reminder_time TIMESTAMPTZ;
    v_jobs_created INTEGER := 0;
BEGIN
    -- Get event details
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    
    IF NOT FOUND OR v_event.start_date < NOW() THEN
        RETURN 0;
    END IF;
    
    -- Find active reminder automations for this organizer
    FOR v_automation IN
        SELECT * FROM public.communication_automations
        WHERE organizer_id = v_event.organizer_id
        AND trigger_type LIKE 'event_reminder_%'
        AND status = 'active'
        AND (trigger_config->>'eventId' IS NULL OR trigger_config->>'eventId' = p_event_id::TEXT)
    LOOP
        -- Calculate reminder time based on trigger type
        CASE v_automation.trigger_type
            WHEN 'event_reminder_7d' THEN
                v_reminder_time := v_event.start_date - INTERVAL '7 days';
            WHEN 'event_reminder_1d' THEN
                v_reminder_time := v_event.start_date - INTERVAL '1 day';
            WHEN 'event_reminder_2h' THEN
                v_reminder_time := v_event.start_date - INTERVAL '2 hours';
            ELSE
                CONTINUE;
        END CASE;
        
        -- Skip if reminder time has passed
        IF v_reminder_time < NOW() THEN
            CONTINUE;
        END IF;
        
        -- Create scheduled job for each ticket holder
        FOR v_ticket IN
            SELECT * FROM public.tickets
            WHERE event_id = p_event_id
            AND payment_status = 'completed'
        LOOP
            -- Check if job already exists
            IF NOT EXISTS (
                SELECT 1 FROM public.communication_scheduled_jobs
                WHERE automation_id = v_automation.id
                AND event_id = p_event_id
                AND contact_id = (
                    SELECT id FROM public.contacts
                    WHERE organizer_id = v_event.organizer_id
                    AND email = v_ticket.attendee_email
                    LIMIT 1
                )
                AND job_type = 'event_reminder'
            ) THEN
                INSERT INTO public.communication_scheduled_jobs (
                    automation_id,
                    organizer_id,
                    job_type,
                    event_id,
                    job_data,
                    scheduled_for
                ) VALUES (
                    v_automation.id,
                    v_event.organizer_id,
                    'event_reminder',
                    p_event_id,
                    jsonb_build_object(
                        'ticket_id', v_ticket.id,
                        'attendee_name', v_ticket.attendee_name,
                        'attendee_email', v_ticket.attendee_email,
                        'attendee_phone', v_ticket.attendee_phone
                    ),
                    v_reminder_time
                );
                
                v_jobs_created := v_jobs_created + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN v_jobs_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. RLS POLICIES
-- ============================================

ALTER TABLE public.communication_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- Automations - organizers see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_automations' AND policyname = 'automations_organizer_access') THEN
        CREATE POLICY automations_organizer_access ON public.communication_automations
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM public.organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM public.organizer_team_members 
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- Runs - organizers see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_automation_runs' AND policyname = 'automation_runs_organizer_access') THEN
        CREATE POLICY automation_runs_organizer_access ON public.communication_automation_runs
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM public.organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM public.organizer_team_members 
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- Scheduled jobs - organizers see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_scheduled_jobs' AND policyname = 'scheduled_jobs_organizer_access') THEN
        CREATE POLICY scheduled_jobs_organizer_access ON public.communication_scheduled_jobs
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM public.organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM public.organizer_team_members 
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.communication_automations IS 'Automation definitions for triggered messages';
COMMENT ON TABLE public.communication_automation_runs IS 'Individual automation execution instances';
COMMENT ON TABLE public.communication_scheduled_jobs IS 'Scheduled jobs for future execution';

COMMENT ON FUNCTION trigger_automation_on_ticket_purchase IS 'Triggers automations when a ticket is purchased';
COMMENT ON FUNCTION schedule_event_reminders IS 'Schedules reminder jobs for an event';
