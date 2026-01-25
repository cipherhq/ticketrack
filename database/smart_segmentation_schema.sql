-- ============================================================================
-- SMART SEGMENTATION SCHEMA
-- RFM Scoring, Engagement Scoring, and Predictive Segments
-- ============================================================================

-- ============================================================================
-- 1. CONTACT SCORES TABLE
-- ============================================================================
-- Stores computed scores for each contact
CREATE TABLE IF NOT EXISTS public.contact_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- RFM Scores (1-5 scale, 5 is best)
    recency_score INTEGER DEFAULT 0 CHECK (recency_score >= 0 AND recency_score <= 5),
    frequency_score INTEGER DEFAULT 0 CHECK (frequency_score >= 0 AND frequency_score <= 5),
    monetary_score INTEGER DEFAULT 0 CHECK (monetary_score >= 0 AND monetary_score <= 5),
    rfm_score INTEGER GENERATED ALWAYS AS (recency_score + frequency_score + monetary_score) STORED,
    rfm_segment VARCHAR(50), -- 'champions', 'loyal', 'potential', 'at_risk', 'hibernating', 'lost'
    
    -- Engagement Score (0-100)
    engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
    engagement_level VARCHAR(20), -- 'highly_engaged', 'engaged', 'passive', 'disengaged'
    
    -- Activity metrics
    last_purchase_at TIMESTAMPTZ,
    last_email_open_at TIMESTAMPTZ,
    last_click_at TIMESTAMPTZ,
    last_event_attended_at TIMESTAMPTZ,
    
    -- Aggregates
    total_purchases INTEGER DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0,
    total_events_attended INTEGER DEFAULT 0,
    total_emails_opened INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    avg_ticket_value NUMERIC(10,2) DEFAULT 0,
    
    -- Predictions
    churn_risk DECIMAL(3,2), -- 0.00 to 1.00 probability of churning
    next_purchase_likelihood DECIMAL(3,2), -- 0.00 to 1.00
    
    -- Timestamps
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT contact_scores_unique UNIQUE (contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_scores_organizer ON contact_scores(organizer_id);
CREATE INDEX IF NOT EXISTS idx_contact_scores_rfm ON contact_scores(organizer_id, rfm_segment);
CREATE INDEX IF NOT EXISTS idx_contact_scores_engagement ON contact_scores(organizer_id, engagement_level);
CREATE INDEX IF NOT EXISTS idx_contact_scores_rfm_score ON contact_scores(organizer_id, rfm_score DESC);
CREATE INDEX IF NOT EXISTS idx_contact_scores_engagement_score ON contact_scores(organizer_id, engagement_score DESC);

-- ============================================================================
-- 2. PREDEFINED SMART SEGMENTS
-- ============================================================================
-- System-defined segments based on scoring
CREATE TABLE IF NOT EXISTS public.smart_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- Segment info
    name VARCHAR(100) NOT NULL,
    description TEXT,
    segment_type VARCHAR(50) NOT NULL, -- 'rfm', 'engagement', 'behavioral', 'predictive'
    
    -- Criteria (computed automatically)
    criteria JSONB NOT NULL,
    -- Examples:
    -- RFM: {"rfm_segment": "champions"}
    -- Engagement: {"engagement_level": "highly_engaged"}
    -- Behavioral: {"last_purchase_days": {"max": 30}, "total_purchases": {"min": 3}}
    -- Predictive: {"churn_risk": {"max": 0.3}}
    
    -- UI
    color VARCHAR(7) DEFAULT '#2969FF',
    icon VARCHAR(50) DEFAULT 'users',
    
    -- Stats
    contact_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    
    -- System vs Custom
    is_system BOOLEAN DEFAULT FALSE, -- System segments can't be deleted
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_segments_organizer ON smart_segments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_smart_segments_type ON smart_segments(organizer_id, segment_type);

-- ============================================================================
-- 3. SEGMENT MEMBERSHIP TABLE
-- ============================================================================
-- Tracks which contacts belong to which segments
CREATE TABLE IF NOT EXISTS public.segment_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES smart_segments(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- When they entered/exited the segment
    entered_at TIMESTAMPTZ DEFAULT NOW(),
    exited_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- For tracking segment transitions
    previous_segment_id UUID REFERENCES smart_segments(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT segment_membership_unique UNIQUE (segment_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_segment_membership_segment ON segment_memberships(segment_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_segment_membership_contact ON segment_memberships(contact_id);
CREATE INDEX IF NOT EXISTS idx_segment_membership_organizer ON segment_memberships(organizer_id);

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE contact_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE segment_memberships ENABLE ROW LEVEL SECURITY;

-- Contact scores
DROP POLICY IF EXISTS "Organizers can view their contact scores" ON contact_scores;
CREATE POLICY "Organizers can view their contact scores"
    ON contact_scores FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role manages scores" ON contact_scores;
CREATE POLICY "Service role manages scores"
    ON contact_scores FOR ALL
    USING (auth.role() = 'service_role');

-- Smart segments
DROP POLICY IF EXISTS "Organizers can view their segments" ON smart_segments;
CREATE POLICY "Organizers can view their segments"
    ON smart_segments FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Organizers can manage their segments" ON smart_segments;
CREATE POLICY "Organizers can manage their segments"
    ON smart_segments FOR ALL
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Segment memberships
DROP POLICY IF EXISTS "Organizers can view segment memberships" ON segment_memberships;
CREATE POLICY "Organizers can view segment memberships"
    ON segment_memberships FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role manages memberships" ON segment_memberships;
CREATE POLICY "Service role manages memberships"
    ON segment_memberships FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. SCORING FUNCTIONS
-- ============================================================================

-- Calculate RFM scores for a contact
CREATE OR REPLACE FUNCTION calculate_contact_rfm(p_contact_id UUID)
RETURNS VOID AS $$
DECLARE
    v_organizer_id UUID;
    v_last_purchase TIMESTAMPTZ;
    v_total_purchases INTEGER;
    v_total_spent NUMERIC;
    v_days_since_purchase INTEGER;
    v_recency INTEGER;
    v_frequency INTEGER;
    v_monetary INTEGER;
    v_segment VARCHAR(50);
BEGIN
    -- Get organizer ID
    SELECT organizer_id INTO v_organizer_id FROM contacts WHERE id = p_contact_id;
    IF v_organizer_id IS NULL THEN RETURN; END IF;

    -- Get purchase metrics from tickets
    SELECT 
        MAX(t.created_at),
        COUNT(DISTINCT t.id),
        COALESCE(SUM(t.total_amount), 0)
    INTO v_last_purchase, v_total_purchases, v_total_spent
    FROM tickets t
    JOIN contacts c ON (c.email = t.attendee_email OR c.phone = t.attendee_phone)
    WHERE c.id = p_contact_id
      AND t.payment_status = 'completed';

    -- Calculate days since last purchase
    v_days_since_purchase := COALESCE(EXTRACT(DAY FROM NOW() - v_last_purchase)::INTEGER, 999);

    -- Recency Score (1-5)
    v_recency := CASE
        WHEN v_days_since_purchase <= 30 THEN 5
        WHEN v_days_since_purchase <= 60 THEN 4
        WHEN v_days_since_purchase <= 90 THEN 3
        WHEN v_days_since_purchase <= 180 THEN 2
        ELSE 1
    END;

    -- Frequency Score (1-5)
    v_frequency := CASE
        WHEN v_total_purchases >= 10 THEN 5
        WHEN v_total_purchases >= 5 THEN 4
        WHEN v_total_purchases >= 3 THEN 3
        WHEN v_total_purchases >= 1 THEN 2
        ELSE 1
    END;

    -- Monetary Score (1-5) - adjust thresholds based on your business
    v_monetary := CASE
        WHEN v_total_spent >= 50000 THEN 5  -- ₦50k+
        WHEN v_total_spent >= 20000 THEN 4  -- ₦20k+
        WHEN v_total_spent >= 10000 THEN 3  -- ₦10k+
        WHEN v_total_spent >= 5000 THEN 2   -- ₦5k+
        ELSE 1
    END;

    -- Determine RFM Segment
    v_segment := CASE
        WHEN v_recency >= 4 AND v_frequency >= 4 AND v_monetary >= 4 THEN 'champions'
        WHEN v_recency >= 3 AND v_frequency >= 3 THEN 'loyal'
        WHEN v_recency >= 4 AND v_frequency <= 2 THEN 'new_customers'
        WHEN v_recency >= 3 AND v_frequency >= 2 THEN 'potential'
        WHEN v_recency <= 2 AND v_frequency >= 3 THEN 'at_risk'
        WHEN v_recency <= 2 AND v_frequency <= 2 AND v_monetary >= 3 THEN 'hibernating'
        WHEN v_recency = 1 AND v_frequency = 1 THEN 'lost'
        ELSE 'other'
    END;

    -- Upsert scores
    INSERT INTO contact_scores (
        contact_id, organizer_id,
        recency_score, frequency_score, monetary_score, rfm_segment,
        last_purchase_at, total_purchases, total_spent,
        avg_ticket_value, calculated_at
    )
    VALUES (
        p_contact_id, v_organizer_id,
        v_recency, v_frequency, v_monetary, v_segment,
        v_last_purchase, v_total_purchases, v_total_spent,
        CASE WHEN v_total_purchases > 0 THEN v_total_spent / v_total_purchases ELSE 0 END,
        NOW()
    )
    ON CONFLICT (contact_id) DO UPDATE SET
        recency_score = EXCLUDED.recency_score,
        frequency_score = EXCLUDED.frequency_score,
        monetary_score = EXCLUDED.monetary_score,
        rfm_segment = EXCLUDED.rfm_segment,
        last_purchase_at = EXCLUDED.last_purchase_at,
        total_purchases = EXCLUDED.total_purchases,
        total_spent = EXCLUDED.total_spent,
        avg_ticket_value = EXCLUDED.avg_ticket_value,
        calculated_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate engagement score for a contact
CREATE OR REPLACE FUNCTION calculate_contact_engagement(p_contact_id UUID)
RETURNS VOID AS $$
DECLARE
    v_organizer_id UUID;
    v_email_opens INTEGER;
    v_clicks INTEGER;
    v_last_open TIMESTAMPTZ;
    v_last_click TIMESTAMPTZ;
    v_days_since_engagement INTEGER;
    v_engagement_score INTEGER;
    v_engagement_level VARCHAR(20);
BEGIN
    SELECT organizer_id INTO v_organizer_id FROM contacts WHERE id = p_contact_id;
    IF v_organizer_id IS NULL THEN RETURN; END IF;

    -- Get email engagement from tracking events
    SELECT 
        COUNT(*) FILTER (WHERE event_type = 'open'),
        COUNT(*) FILTER (WHERE event_type = 'click'),
        MAX(first_event_at) FILTER (WHERE event_type = 'open'),
        MAX(first_event_at) FILTER (WHERE event_type = 'click')
    INTO v_email_opens, v_clicks, v_last_open, v_last_click
    FROM email_tracking_events
    WHERE organizer_id = v_organizer_id
      AND recipient_email = (SELECT email FROM contacts WHERE id = p_contact_id);

    -- Calculate days since last engagement
    v_days_since_engagement := COALESCE(
        EXTRACT(DAY FROM NOW() - GREATEST(v_last_open, v_last_click))::INTEGER, 
        999
    );

    -- Calculate engagement score (0-100)
    -- Components: opens (40%), clicks (40%), recency (20%)
    v_engagement_score := LEAST(100, (
        LEAST(v_email_opens, 10) * 4 +  -- Up to 40 points for opens
        LEAST(v_clicks, 10) * 4 +        -- Up to 40 points for clicks
        CASE                              -- Up to 20 points for recency
            WHEN v_days_since_engagement <= 7 THEN 20
            WHEN v_days_since_engagement <= 14 THEN 15
            WHEN v_days_since_engagement <= 30 THEN 10
            WHEN v_days_since_engagement <= 60 THEN 5
            ELSE 0
        END
    ));

    -- Determine engagement level
    v_engagement_level := CASE
        WHEN v_engagement_score >= 70 THEN 'highly_engaged'
        WHEN v_engagement_score >= 40 THEN 'engaged'
        WHEN v_engagement_score >= 20 THEN 'passive'
        ELSE 'disengaged'
    END;

    -- Upsert scores
    INSERT INTO contact_scores (
        contact_id, organizer_id,
        engagement_score, engagement_level,
        total_emails_opened, total_clicks,
        last_email_open_at, last_click_at,
        calculated_at
    )
    VALUES (
        p_contact_id, v_organizer_id,
        v_engagement_score, v_engagement_level,
        v_email_opens, v_clicks,
        v_last_open, v_last_click,
        NOW()
    )
    ON CONFLICT (contact_id) DO UPDATE SET
        engagement_score = EXCLUDED.engagement_score,
        engagement_level = EXCLUDED.engagement_level,
        total_emails_opened = EXCLUDED.total_emails_opened,
        total_clicks = EXCLUDED.total_clicks,
        last_email_open_at = EXCLUDED.last_email_open_at,
        last_click_at = EXCLUDED.last_click_at,
        calculated_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate all scores for an organizer's contacts
CREATE OR REPLACE FUNCTION calculate_organizer_scores(p_organizer_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_contact RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_contact IN 
        SELECT id FROM contacts 
        WHERE organizer_id = p_organizer_id AND is_active = TRUE
    LOOP
        PERFORM calculate_contact_rfm(v_contact.id);
        PERFORM calculate_contact_engagement(v_contact.id);
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update smart segment counts
CREATE OR REPLACE FUNCTION update_smart_segment_counts(p_organizer_id UUID)
RETURNS VOID AS $$
DECLARE
    v_segment RECORD;
    v_count INTEGER;
BEGIN
    FOR v_segment IN 
        SELECT id, criteria FROM smart_segments WHERE organizer_id = p_organizer_id
    LOOP
        -- Count contacts matching segment criteria
        -- This is a simplified version - real implementation would parse criteria JSONB
        SELECT COUNT(*) INTO v_count
        FROM segment_memberships
        WHERE segment_id = v_segment.id AND is_active = TRUE;
        
        UPDATE smart_segments
        SET contact_count = v_count, 
            last_calculated_at = NOW(),
            updated_at = NOW()
        WHERE id = v_segment.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. INITIALIZE DEFAULT SMART SEGMENTS FOR ORGANIZER
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_smart_segments(p_organizer_id UUID)
RETURNS VOID AS $$
BEGIN
    -- RFM Segments
    INSERT INTO smart_segments (organizer_id, name, description, segment_type, criteria, color, icon, is_system)
    VALUES
        (p_organizer_id, 'Champions', 'Best customers - recent, frequent, high spenders', 'rfm', 
         '{"rfm_segment": "champions"}', '#10B981', 'trophy', TRUE),
        (p_organizer_id, 'Loyal Customers', 'Regular customers with consistent purchases', 'rfm',
         '{"rfm_segment": "loyal"}', '#3B82F6', 'heart', TRUE),
        (p_organizer_id, 'Potential Loyalists', 'Recent customers who could become loyal', 'rfm',
         '{"rfm_segment": "potential"}', '#8B5CF6', 'trending-up', TRUE),
        (p_organizer_id, 'At Risk', 'Previously active but haven''t purchased recently', 'rfm',
         '{"rfm_segment": "at_risk"}', '#F59E0B', 'alert-triangle', TRUE),
        (p_organizer_id, 'Hibernating', 'Low activity, but previously valuable', 'rfm',
         '{"rfm_segment": "hibernating"}', '#6B7280', 'moon', TRUE),
        (p_organizer_id, 'Lost', 'No recent activity, low value', 'rfm',
         '{"rfm_segment": "lost"}', '#EF4444', 'user-x', TRUE)
    ON CONFLICT DO NOTHING;
    
    -- Engagement Segments
    INSERT INTO smart_segments (organizer_id, name, description, segment_type, criteria, color, icon, is_system)
    VALUES
        (p_organizer_id, 'Super Engaged', 'Opens and clicks on most communications', 'engagement',
         '{"engagement_level": "highly_engaged"}', '#10B981', 'zap', TRUE),
        (p_organizer_id, 'Active Readers', 'Regularly opens emails', 'engagement',
         '{"engagement_level": "engaged"}', '#3B82F6', 'eye', TRUE),
        (p_organizer_id, 'Passive Subscribers', 'Occasional engagement', 'engagement',
         '{"engagement_level": "passive"}', '#F59E0B', 'clock', TRUE),
        (p_organizer_id, 'Disengaged', 'Rarely opens or clicks', 'engagement',
         '{"engagement_level": "disengaged"}', '#EF4444', 'eye-off', TRUE)
    ON CONFLICT DO NOTHING;
    
    -- Behavioral Segments
    INSERT INTO smart_segments (organizer_id, name, description, segment_type, criteria, color, icon, is_system)
    VALUES
        (p_organizer_id, 'Recent Purchasers', 'Purchased in last 30 days', 'behavioral',
         '{"last_purchase_days": {"max": 30}}', '#10B981', 'shopping-bag', TRUE),
        (p_organizer_id, 'VIP Spenders', 'Spent over ₦50,000 total', 'behavioral',
         '{"total_spent": {"min": 50000}}', '#8B5CF6', 'crown', TRUE),
        (p_organizer_id, 'Frequent Attendees', 'Attended 3+ events', 'behavioral',
         '{"total_events": {"min": 3}}', '#3B82F6', 'calendar-check', TRUE),
        (p_organizer_id, 'First-Time Buyers', 'Only 1 purchase', 'behavioral',
         '{"total_purchases": {"equals": 1}}', '#06B6D4', 'user-plus', TRUE)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Smart segmentation schema created successfully' AS status;
