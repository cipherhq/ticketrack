-- ============================================================================
-- DRIP CAMPAIGNS SCHEMA
-- Multi-step automated message sequences with conditional branching
-- ============================================================================

-- ============================================================================
-- 1. DRIP CAMPAIGNS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.drip_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- Campaign Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Trigger
    trigger_type VARCHAR(50) NOT NULL, -- 'signup', 'purchase', 'tag_added', 'segment_enter', 'event_registration', 'manual', 'date'
    trigger_config JSONB DEFAULT '{}',
    -- Examples:
    -- signup: {}
    -- purchase: {"event_id": "uuid"}
    -- tag_added: {"tag": "vip"}
    -- segment_enter: {"segment_id": "uuid"}
    -- event_registration: {"event_id": "uuid"}
    -- date: {"date": "2024-12-25", "time": "09:00"}
    
    -- Entry conditions (who can enter)
    entry_criteria JSONB DEFAULT '{}',
    -- Example: {"segments": ["uuid"], "tags": ["vip"], "exclude_tags": ["unsubscribed"]}
    
    -- Exit conditions (when to stop the sequence)
    exit_criteria JSONB DEFAULT '{}',
    -- Example: {"purchased": true, "tag_added": "converted", "days_in_campaign": 30}
    
    -- Status
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'archived'
    
    -- Goals/Success metrics
    goal_type VARCHAR(50), -- 'purchase', 'click', 'tag_added', 'segment_enter'
    goal_config JSONB DEFAULT '{}',
    
    -- Timing
    entry_limit INTEGER, -- Max contacts that can enter (null = unlimited)
    entry_limit_period VARCHAR(20), -- 'day', 'week', 'month', 'total'
    
    -- Stats
    total_enrolled INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    total_exited_early INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Timestamps
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_campaigns_organizer ON drip_campaigns(organizer_id);
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_status ON drip_campaigns(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_trigger ON drip_campaigns(trigger_type);

-- ============================================================================
-- 2. DRIP CAMPAIGN STEPS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.drip_campaign_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- Step order
    step_number INTEGER NOT NULL,
    name VARCHAR(255),
    
    -- Timing
    delay_type VARCHAR(20) NOT NULL, -- 'immediate', 'delay', 'wait_until', 'specific_time'
    delay_value INTEGER, -- For 'delay': number of units
    delay_unit VARCHAR(20), -- 'minutes', 'hours', 'days', 'weeks'
    wait_until_time TIME, -- For 'specific_time': send at this time
    wait_until_day INTEGER[], -- Days of week (0=Sunday)
    
    -- Action
    action_type VARCHAR(50) NOT NULL, -- 'send_email', 'send_sms', 'send_whatsapp', 'add_tag', 'remove_tag', 'move_to_segment', 'webhook', 'wait_for_action'
    action_config JSONB NOT NULL,
    -- Examples:
    -- send_email: {"subject": "...", "body": "...", "template_id": "uuid"}
    -- send_sms: {"message": "..."}
    -- add_tag: {"tag": "engaged"}
    -- wait_for_action: {"action": "email_open", "timeout_hours": 24, "timeout_step_id": "uuid"}
    
    -- Conditional branching
    has_conditions BOOLEAN DEFAULT FALSE,
    conditions JSONB DEFAULT '[]',
    -- Example: [
    --   {"type": "opened_previous", "then_step_id": "uuid", "else_step_id": "uuid"},
    --   {"type": "clicked_link", "link_contains": "buy", "then_step_id": "uuid"}
    -- ]
    
    -- Stats
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT step_order_unique UNIQUE (campaign_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign ON drip_campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_order ON drip_campaign_steps(campaign_id, step_number);

-- ============================================================================
-- 3. DRIP CAMPAIGN ENROLLMENTS TABLE
-- ============================================================================
-- Tracks contacts enrolled in a drip campaign
CREATE TABLE IF NOT EXISTS public.drip_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- Current state
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'completed', 'exited', 'paused'
    current_step_id UUID REFERENCES drip_campaign_steps(id),
    current_step_number INTEGER DEFAULT 0,
    
    -- Timing
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    next_step_at TIMESTAMPTZ, -- When the next step should execute
    completed_at TIMESTAMPTZ,
    exited_at TIMESTAMPTZ,
    exit_reason VARCHAR(100), -- 'goal_reached', 'exit_criteria', 'manual', 'contact_unsubscribed'
    
    -- Goal tracking
    goal_reached BOOLEAN DEFAULT FALSE,
    goal_reached_at TIMESTAMPTZ,
    
    -- Step history stored as JSONB
    step_history JSONB DEFAULT '[]',
    -- Example: [
    --   {"step_id": "uuid", "executed_at": "timestamp", "result": "sent"},
    --   {"step_id": "uuid", "executed_at": "timestamp", "result": "opened"}
    -- ]
    
    -- Metadata
    trigger_data JSONB DEFAULT '{}', -- Data from the trigger event
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT enrollment_unique UNIQUE (campaign_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign ON drip_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_contact ON drip_enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_status ON drip_enrollments(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_next_step ON drip_enrollments(next_step_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_organizer ON drip_enrollments(organizer_id);

-- ============================================================================
-- 4. DRIP STEP EXECUTIONS TABLE
-- ============================================================================
-- Log of individual step executions
CREATE TABLE IF NOT EXISTS public.drip_step_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES drip_enrollments(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES drip_campaign_steps(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- Execution details
    status VARCHAR(20) NOT NULL, -- 'pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'skipped'
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- For send actions
    message_id UUID, -- Reference to communication_messages
    external_id VARCHAR(255), -- Provider message ID
    
    -- Engagement tracking
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    click_url TEXT,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_executions_enrollment ON drip_step_executions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_drip_executions_step ON drip_step_executions(step_id);
CREATE INDEX IF NOT EXISTS idx_drip_executions_status ON drip_step_executions(status);
CREATE INDEX IF NOT EXISTS idx_drip_executions_date ON drip_step_executions(executed_at);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_step_executions ENABLE ROW LEVEL SECURITY;

-- Drip campaigns
DROP POLICY IF EXISTS "Organizers can manage their drip campaigns" ON drip_campaigns;
CREATE POLICY "Organizers can manage their drip campaigns"
    ON drip_campaigns FOR ALL
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Drip steps
DROP POLICY IF EXISTS "Organizers can manage their drip steps" ON drip_campaign_steps;
CREATE POLICY "Organizers can manage their drip steps"
    ON drip_campaign_steps FOR ALL
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Enrollments
DROP POLICY IF EXISTS "Organizers can view enrollments" ON drip_enrollments;
CREATE POLICY "Organizers can view enrollments"
    ON drip_enrollments FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role manages enrollments" ON drip_enrollments;
CREATE POLICY "Service role manages enrollments"
    ON drip_enrollments FOR ALL
    USING (auth.role() = 'service_role');

-- Executions
DROP POLICY IF EXISTS "Organizers can view executions" ON drip_step_executions;
CREATE POLICY "Organizers can view executions"
    ON drip_step_executions FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role manages executions" ON drip_step_executions;
CREATE POLICY "Service role manages executions"
    ON drip_step_executions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Enroll a contact in a drip campaign
CREATE OR REPLACE FUNCTION enroll_in_drip_campaign(
    p_campaign_id UUID,
    p_contact_id UUID,
    p_trigger_data JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_campaign RECORD;
    v_first_step RECORD;
    v_enrollment_id UUID;
    v_next_step_at TIMESTAMPTZ;
BEGIN
    -- Get campaign
    SELECT * INTO v_campaign FROM drip_campaigns WHERE id = p_campaign_id;
    IF v_campaign IS NULL OR v_campaign.status != 'active' THEN
        RETURN NULL;
    END IF;
    
    -- Check if already enrolled
    IF EXISTS (
        SELECT 1 FROM drip_enrollments 
        WHERE campaign_id = p_campaign_id 
          AND contact_id = p_contact_id 
          AND status IN ('active', 'paused')
    ) THEN
        RETURN NULL;
    END IF;
    
    -- Get first step
    SELECT * INTO v_first_step 
    FROM drip_campaign_steps 
    WHERE campaign_id = p_campaign_id AND is_active = TRUE
    ORDER BY step_number 
    LIMIT 1;
    
    IF v_first_step IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Calculate when first step should execute
    v_next_step_at := CASE v_first_step.delay_type
        WHEN 'immediate' THEN NOW()
        WHEN 'delay' THEN NOW() + (v_first_step.delay_value || ' ' || v_first_step.delay_unit)::INTERVAL
        ELSE NOW() + INTERVAL '1 minute'
    END;
    
    -- Create enrollment
    INSERT INTO drip_enrollments (
        campaign_id, contact_id, organizer_id,
        current_step_id, current_step_number, next_step_at,
        trigger_data
    )
    VALUES (
        p_campaign_id, p_contact_id, v_campaign.organizer_id,
        v_first_step.id, v_first_step.step_number, v_next_step_at,
        p_trigger_data
    )
    RETURNING id INTO v_enrollment_id;
    
    -- Update campaign stats
    UPDATE drip_campaigns 
    SET total_enrolled = total_enrolled + 1, updated_at = NOW()
    WHERE id = p_campaign_id;
    
    RETURN v_enrollment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending drip steps to execute
CREATE OR REPLACE FUNCTION get_pending_drip_steps(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    enrollment_id UUID,
    campaign_id UUID,
    step_id UUID,
    contact_id UUID,
    organizer_id UUID,
    action_type VARCHAR,
    action_config JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS enrollment_id,
        e.campaign_id,
        e.current_step_id AS step_id,
        e.contact_id,
        e.organizer_id,
        s.action_type,
        s.action_config
    FROM drip_enrollments e
    JOIN drip_campaign_steps s ON e.current_step_id = s.id
    JOIN drip_campaigns c ON e.campaign_id = c.id
    WHERE e.status = 'active'
      AND e.next_step_at <= NOW()
      AND c.status = 'active'
      AND s.is_active = TRUE
    ORDER BY e.next_step_at
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Advance enrollment to next step
CREATE OR REPLACE FUNCTION advance_drip_enrollment(
    p_enrollment_id UUID,
    p_execution_status VARCHAR DEFAULT 'sent'
)
RETURNS VOID AS $$
DECLARE
    v_enrollment RECORD;
    v_current_step RECORD;
    v_next_step RECORD;
    v_next_step_at TIMESTAMPTZ;
BEGIN
    -- Get enrollment
    SELECT * INTO v_enrollment FROM drip_enrollments WHERE id = p_enrollment_id;
    IF v_enrollment IS NULL THEN RETURN; END IF;
    
    -- Get current step
    SELECT * INTO v_current_step FROM drip_campaign_steps WHERE id = v_enrollment.current_step_id;
    
    -- Record execution
    INSERT INTO drip_step_executions (
        enrollment_id, step_id, campaign_id, contact_id, organizer_id, status
    )
    VALUES (
        p_enrollment_id, v_current_step.id, v_enrollment.campaign_id, 
        v_enrollment.contact_id, v_enrollment.organizer_id, p_execution_status
    );
    
    -- Update step stats
    UPDATE drip_campaign_steps
    SET total_sent = total_sent + 1, updated_at = NOW()
    WHERE id = v_current_step.id;
    
    -- Get next step
    SELECT * INTO v_next_step 
    FROM drip_campaign_steps 
    WHERE campaign_id = v_enrollment.campaign_id 
      AND step_number > v_current_step.step_number
      AND is_active = TRUE
    ORDER BY step_number 
    LIMIT 1;
    
    IF v_next_step IS NULL THEN
        -- Campaign complete
        UPDATE drip_enrollments
        SET status = 'completed',
            completed_at = NOW(),
            current_step_id = NULL,
            next_step_at = NULL,
            step_history = step_history || jsonb_build_object(
                'step_id', v_current_step.id,
                'executed_at', NOW(),
                'result', p_execution_status
            ),
            updated_at = NOW()
        WHERE id = p_enrollment_id;
        
        UPDATE drip_campaigns
        SET total_completed = total_completed + 1, updated_at = NOW()
        WHERE id = v_enrollment.campaign_id;
    ELSE
        -- Move to next step
        v_next_step_at := CASE v_next_step.delay_type
            WHEN 'immediate' THEN NOW()
            WHEN 'delay' THEN NOW() + (v_next_step.delay_value || ' ' || v_next_step.delay_unit)::INTERVAL
            ELSE NOW() + INTERVAL '1 minute'
        END;
        
        UPDATE drip_enrollments
        SET current_step_id = v_next_step.id,
            current_step_number = v_next_step.step_number,
            next_step_at = v_next_step_at,
            step_history = step_history || jsonb_build_object(
                'step_id', v_current_step.id,
                'executed_at', NOW(),
                'result', p_execution_status
            ),
            updated_at = NOW()
        WHERE id = p_enrollment_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Drip campaigns schema created successfully' AS status;
