-- ============================================================================
-- EMAIL TRACKING SCHEMA
-- Track email opens, clicks, and engagement analytics
-- ============================================================================

-- ============================================================================
-- 1. EMAIL TRACKING EVENTS TABLE
-- ============================================================================
-- Stores individual tracking events (opens, clicks)
CREATE TABLE IF NOT EXISTS public.email_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to the original message
    message_id UUID, -- Reference to communication_messages.id
    campaign_id UUID, -- Reference to communication_campaigns.id
    
    -- Tracking identifiers
    tracking_id VARCHAR(100) NOT NULL UNIQUE, -- Unique ID embedded in pixel/link
    
    -- Event details
    event_type VARCHAR(20) NOT NULL, -- 'open', 'click'
    link_url TEXT, -- Original URL for clicks
    link_text TEXT, -- Link text (for analytics)
    link_position INTEGER, -- Position of link in email (1st, 2nd, etc.)
    
    -- Recipient info
    recipient_email VARCHAR(255),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- First occurrence
    first_event_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Client info
    user_agent TEXT,
    ip_address INET,
    device_type VARCHAR(20), -- 'desktop', 'mobile', 'tablet'
    email_client VARCHAR(50), -- 'gmail', 'outlook', 'apple_mail', etc.
    
    -- Geo info (from IP)
    country VARCHAR(2),
    city VARCHAR(100),
    
    -- Stats
    event_count INTEGER DEFAULT 1,
    last_event_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_email_tracking_message ON email_tracking_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign ON email_tracking_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_organizer ON email_tracking_events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_tracking_recipient ON email_tracking_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_tracking_date ON email_tracking_events(first_event_at);
CREATE INDEX IF NOT EXISTS idx_email_tracking_tracking_id ON email_tracking_events(tracking_id);

-- ============================================================================
-- 2. LINK TRACKING TABLE
-- ============================================================================
-- Stores shortened/wrapped links for click tracking
CREATE TABLE IF NOT EXISTS public.email_tracked_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    campaign_id UUID,
    message_id UUID,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- Link info
    short_code VARCHAR(20) NOT NULL UNIQUE, -- Short identifier for URL
    original_url TEXT NOT NULL,
    link_text TEXT,
    link_position INTEGER,
    
    -- Stats
    total_clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_links_code ON email_tracked_links(short_code);
CREATE INDEX IF NOT EXISTS idx_tracked_links_campaign ON email_tracked_links(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tracked_links_organizer ON email_tracked_links(organizer_id);

-- ============================================================================
-- 3. CAMPAIGN ANALYTICS AGGREGATES
-- ============================================================================
-- Pre-computed analytics for campaigns (updated by trigger)
CREATE TABLE IF NOT EXISTS public.email_campaign_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL UNIQUE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    
    -- Send stats
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    
    -- Engagement stats
    total_opens INTEGER DEFAULT 0,
    unique_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    
    -- Derived rates (percentage * 100 for precision)
    open_rate DECIMAL(5,2) DEFAULT 0, -- (unique_opens / total_delivered) * 100
    click_rate DECIMAL(5,2) DEFAULT 0, -- (unique_clicks / total_delivered) * 100
    click_to_open_rate DECIMAL(5,2) DEFAULT 0, -- (unique_clicks / unique_opens) * 100
    
    -- Top links (JSONB array of {url, clicks})
    top_links JSONB DEFAULT '[]'::jsonb,
    
    -- Device breakdown
    device_breakdown JSONB DEFAULT '{}'::jsonb, -- {desktop: 50, mobile: 40, tablet: 10}
    
    -- Email client breakdown
    client_breakdown JSONB DEFAULT '{}'::jsonb, -- {gmail: 60, outlook: 30, apple: 10}
    
    -- Time-based engagement
    hourly_opens JSONB DEFAULT '{}'::jsonb, -- {0: 5, 1: 3, ...}
    
    -- Timestamps
    first_open_at TIMESTAMPTZ,
    last_open_at TIMESTAMPTZ,
    first_click_at TIMESTAMPTZ,
    last_click_at TIMESTAMPTZ,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign ON email_campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_organizer ON email_campaign_analytics(organizer_id);

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaign_analytics ENABLE ROW LEVEL SECURITY;

-- Tracking events - organizers can view their own
DROP POLICY IF EXISTS "Organizers can view their tracking events" ON email_tracking_events;
CREATE POLICY "Organizers can view their tracking events"
    ON email_tracking_events FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Service role for inserts (from tracking endpoint)
DROP POLICY IF EXISTS "Service role can manage tracking events" ON email_tracking_events;
CREATE POLICY "Service role can manage tracking events"
    ON email_tracking_events FOR ALL
    USING (auth.role() = 'service_role');

-- Tracked links
DROP POLICY IF EXISTS "Organizers can view their tracked links" ON email_tracked_links;
CREATE POLICY "Organizers can view their tracked links"
    ON email_tracked_links FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can manage tracked links" ON email_tracked_links;
CREATE POLICY "Service role can manage tracked links"
    ON email_tracked_links FOR ALL
    USING (auth.role() = 'service_role');

-- Campaign analytics
DROP POLICY IF EXISTS "Organizers can view their analytics" ON email_campaign_analytics;
CREATE POLICY "Organizers can view their analytics"
    ON email_campaign_analytics FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role can manage analytics" ON email_campaign_analytics;
CREATE POLICY "Service role can manage analytics"
    ON email_campaign_analytics FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. FUNCTIONS
-- ============================================================================

-- Function to record an email tracking event
CREATE OR REPLACE FUNCTION record_email_tracking_event(
    p_tracking_id VARCHAR(100),
    p_event_type VARCHAR(20),
    p_user_agent TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_link_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_existing_id UUID;
    v_device_type VARCHAR(20);
    v_email_client VARCHAR(50);
BEGIN
    -- Detect device type from user agent
    IF p_user_agent IS NOT NULL THEN
        IF p_user_agent ILIKE '%mobile%' OR p_user_agent ILIKE '%android%' OR p_user_agent ILIKE '%iphone%' THEN
            v_device_type := 'mobile';
        ELSIF p_user_agent ILIKE '%tablet%' OR p_user_agent ILIKE '%ipad%' THEN
            v_device_type := 'tablet';
        ELSE
            v_device_type := 'desktop';
        END IF;
        
        -- Detect email client
        IF p_user_agent ILIKE '%gmail%' OR p_user_agent ILIKE '%googleimageproxy%' THEN
            v_email_client := 'gmail';
        ELSIF p_user_agent ILIKE '%outlook%' OR p_user_agent ILIKE '%microsoft%' THEN
            v_email_client := 'outlook';
        ELSIF p_user_agent ILIKE '%applemail%' OR p_user_agent ILIKE '%apple%mail%' THEN
            v_email_client := 'apple_mail';
        ELSIF p_user_agent ILIKE '%yahoo%' THEN
            v_email_client := 'yahoo';
        ELSE
            v_email_client := 'other';
        END IF;
    END IF;

    -- Check for existing event with same tracking_id and type
    SELECT id INTO v_existing_id
    FROM email_tracking_events
    WHERE tracking_id = p_tracking_id
      AND event_type = p_event_type
      AND (p_link_url IS NULL OR link_url = p_link_url);

    IF v_existing_id IS NOT NULL THEN
        -- Update existing event count
        UPDATE email_tracking_events
        SET event_count = event_count + 1,
            last_event_at = NOW()
        WHERE id = v_existing_id;
        
        RETURN v_existing_id;
    ELSE
        -- Insert new event
        INSERT INTO email_tracking_events (
            tracking_id, event_type, user_agent, ip_address, 
            device_type, email_client, link_url
        )
        VALUES (
            p_tracking_id, p_event_type, p_user_agent, p_ip_address,
            v_device_type, v_email_client, p_link_url
        )
        RETURNING id INTO v_event_id;
        
        RETURN v_event_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update campaign analytics
CREATE OR REPLACE FUNCTION update_campaign_analytics(p_campaign_id UUID)
RETURNS VOID AS $$
DECLARE
    v_organizer_id UUID;
    v_total_sent INTEGER;
    v_total_opens INTEGER;
    v_unique_opens INTEGER;
    v_total_clicks INTEGER;
    v_unique_clicks INTEGER;
BEGIN
    -- Get organizer ID and total sent from campaign
    SELECT organizer_id, 
           COALESCE((metadata->>'total_sent')::INTEGER, 0)
    INTO v_organizer_id, v_total_sent
    FROM communication_campaigns
    WHERE id = p_campaign_id;

    IF v_organizer_id IS NULL THEN
        RETURN;
    END IF;

    -- Calculate stats from tracking events
    SELECT 
        COUNT(*) FILTER (WHERE event_type = 'open'),
        COUNT(DISTINCT CASE WHEN event_type = 'open' THEN tracking_id END),
        COUNT(*) FILTER (WHERE event_type = 'click'),
        COUNT(DISTINCT CASE WHEN event_type = 'click' THEN tracking_id END)
    INTO v_total_opens, v_unique_opens, v_total_clicks, v_unique_clicks
    FROM email_tracking_events
    WHERE campaign_id = p_campaign_id;

    -- Upsert analytics
    INSERT INTO email_campaign_analytics (
        campaign_id, organizer_id,
        total_sent, total_opens, unique_opens, total_clicks, unique_clicks,
        open_rate, click_rate, click_to_open_rate,
        first_open_at, last_open_at, first_click_at, last_click_at
    )
    VALUES (
        p_campaign_id, v_organizer_id,
        v_total_sent, v_total_opens, v_unique_opens, v_total_clicks, v_unique_clicks,
        CASE WHEN v_total_sent > 0 THEN (v_unique_opens::DECIMAL / v_total_sent) * 100 ELSE 0 END,
        CASE WHEN v_total_sent > 0 THEN (v_unique_clicks::DECIMAL / v_total_sent) * 100 ELSE 0 END,
        CASE WHEN v_unique_opens > 0 THEN (v_unique_clicks::DECIMAL / v_unique_opens) * 100 ELSE 0 END,
        (SELECT MIN(first_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'open'),
        (SELECT MAX(last_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'open'),
        (SELECT MIN(first_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'click'),
        (SELECT MAX(last_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'click')
    )
    ON CONFLICT (campaign_id) DO UPDATE SET
        total_opens = EXCLUDED.total_opens,
        unique_opens = EXCLUDED.unique_opens,
        total_clicks = EXCLUDED.total_clicks,
        unique_clicks = EXCLUDED.unique_clicks,
        open_rate = EXCLUDED.open_rate,
        click_rate = EXCLUDED.click_rate,
        click_to_open_rate = EXCLUDED.click_to_open_rate,
        last_open_at = EXCLUDED.last_open_at,
        last_click_at = EXCLUDED.last_click_at,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. VIEWS
-- ============================================================================

-- Campaign performance summary view
CREATE OR REPLACE VIEW email_campaign_performance AS
SELECT 
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.organizer_id,
    c.created_at AS sent_at,
    COALESCE(a.total_sent, 0) AS total_sent,
    COALESCE(a.unique_opens, 0) AS unique_opens,
    COALESCE(a.unique_clicks, 0) AS unique_clicks,
    COALESCE(a.open_rate, 0) AS open_rate,
    COALESCE(a.click_rate, 0) AS click_rate,
    COALESCE(a.click_to_open_rate, 0) AS click_to_open_rate
FROM communication_campaigns c
LEFT JOIN email_campaign_analytics a ON c.id = a.campaign_id
WHERE 'email' = ANY(c.channels);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Email tracking schema created successfully' AS status;
