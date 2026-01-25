-- ============================================
-- COMMUNICATION HUB - UNIFIED SCHEMA
-- ============================================
-- This migration creates the foundation for the unified Communication Hub
-- It preserves existing campaign data and adds unified tables
-- ============================================
-- 
-- RUN THIS BEFORE: sync_contacts_migration.sql
-- ============================================

-- ============================================
-- 1. UNIFIED CONTACTS TABLE
-- ============================================
-- Aggregates contacts from all sources: tickets, followers, team, imports
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Contact Information
    email VARCHAR(255),
    phone VARCHAR(20),
    full_name VARCHAR(255),
    
    -- Source Tracking
    source_type VARCHAR(50) NOT NULL, -- 'ticket', 'follower', 'team', 'imported', 'manual', 'external'
    source_id UUID, -- ID from source table (ticket_id, follower_id, etc.)
    source_metadata JSONB, -- Additional source data
    
    -- Contact Preferences
    email_opt_in BOOLEAN DEFAULT true,
    sms_opt_in BOOLEAN DEFAULT false,
    whatsapp_opt_in BOOLEAN DEFAULT false,
    push_opt_in BOOLEAN DEFAULT true,
    
    -- Segmentation & Tags
    tags TEXT[] DEFAULT '{}',
    segments TEXT[] DEFAULT '{}',
    
    -- Metadata
    first_contact_at TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    total_events_attended INTEGER DEFAULT 0,
    total_spent NUMERIC(10, 2) DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_duplicate BOOLEAN DEFAULT false,
    duplicate_of UUID REFERENCES public.contacts(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT contacts_organizer_source UNIQUE (organizer_id, source_type, source_id),
    CONSTRAINT contacts_email_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Indexes for contacts
CREATE INDEX IF NOT EXISTS idx_contacts_organizer ON public.contacts(organizer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_source ON public.contacts(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON public.contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_contacts_segments ON public.contacts USING GIN(segments);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON public.contacts(organizer_id, is_active) WHERE is_active = true;

-- ============================================
-- 2. CONTACT SOURCES TABLE
-- ============================================
-- Tracks where contacts came from for data lineage
CREATE TABLE IF NOT EXISTS public.contact_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    source_name VARCHAR(255), -- Human-readable source name
    source_metadata JSONB,
    
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    imported_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_sources_contact ON public.contact_sources(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_sources_organizer ON public.contact_sources(organizer_id);
CREATE INDEX IF NOT EXISTS idx_contact_sources_type ON public.contact_sources(source_type, source_id);

-- ============================================
-- 3. CONTACT SEGMENTS TABLE
-- ============================================
-- Predefined audience segments for targeting
CREATE TABLE IF NOT EXISTS public.contact_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Segment Criteria (stored as JSONB for flexibility)
    criteria JSONB NOT NULL, -- e.g., {"tags": ["vip"], "events_attended": {"min": 3}, "last_contact": {"days": 30}}
    
    -- Auto-update flag
    is_dynamic BOOLEAN DEFAULT true, -- If true, segment updates automatically based on criteria
    
    -- Stats
    contact_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    
    -- Metadata
    color VARCHAR(7), -- Hex color for UI
    icon VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT segments_organizer_name UNIQUE (organizer_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contact_segments_organizer ON public.contact_segments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_contact_segments_dynamic ON public.contact_segments(organizer_id, is_dynamic) WHERE is_dynamic = true;

-- ============================================
-- 4. UNIFIED COMMUNICATION CAMPAIGNS
-- ============================================
-- Replaces separate email_campaigns, sms_campaigns, whatsapp_campaigns
-- Links to old tables for backward compatibility
CREATE TABLE IF NOT EXISTS public.communication_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Campaign Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Channels (can be multiple)
    channels TEXT[] NOT NULL DEFAULT '{}', -- ['email', 'sms', 'whatsapp']
    
    -- Content (channel-specific content stored in JSONB)
    content JSONB NOT NULL, -- {"email": {"subject": "...", "body": "..."}, "sms": {"message": "..."}, "whatsapp": {"message": "..."}}
    
    -- Audience
    audience_type VARCHAR(50) NOT NULL, -- 'all_contacts', 'segment', 'event_attendees', 'followers', 'custom'
    audience_segment_id UUID REFERENCES public.contact_segments(id),
    audience_event_id UUID REFERENCES public.events(id),
    audience_custom_ids UUID[], -- Specific contact IDs
    
    -- Legacy Campaign References (for backward compatibility)
    -- Note: These are nullable and only reference if legacy tables exist
    legacy_email_campaign_id UUID,
    legacy_sms_campaign_id UUID,
    legacy_whatsapp_campaign_id UUID,
    
    -- Scheduling
    status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    
    -- Recipients
    total_recipients INTEGER DEFAULT 0,
    recipients_by_channel JSONB DEFAULT '{}', -- {"email": 100, "sms": 50, "whatsapp": 30}
    
    -- Delivery Stats
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0, -- Email opens
    clicked_count INTEGER DEFAULT 0, -- Email clicks
    read_count INTEGER DEFAULT 0, -- WhatsApp reads
    
    -- Cost Tracking
    estimated_cost NUMERIC(10, 4) DEFAULT 0,
    actual_cost NUMERIC(10, 4) DEFAULT 0,
    
    -- Metadata
    template_id UUID, -- Reference to communication_templates
    variables JSONB DEFAULT '{}', -- Template variables used
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_communication_campaigns_organizer ON public.communication_campaigns(organizer_id);
CREATE INDEX IF NOT EXISTS idx_communication_campaigns_status ON public.communication_campaigns(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_communication_campaigns_scheduled ON public.communication_campaigns(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_communication_campaigns_channels ON public.communication_campaigns USING GIN(channels);

-- ============================================
-- 5. UNIFIED MESSAGES TABLE
-- ============================================
-- All outbound messages across all channels
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.communication_campaigns(id) ON DELETE SET NULL,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    
    -- Channel & Content
    channel VARCHAR(50) NOT NULL, -- 'email', 'sms', 'whatsapp', 'push'
    to_email VARCHAR(255),
    to_phone VARCHAR(20),
    to_name VARCHAR(255),
    
    subject VARCHAR(255), -- For email
    body TEXT NOT NULL,
    
    -- Delivery Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'queued', 'sending', 'sent', 'delivered', 'failed', 'bounced'
    
    -- Provider Info
    provider VARCHAR(50), -- 'resend', 'termii', 'whatsapp_cloud', etc.
    provider_message_id VARCHAR(255),
    provider_response JSONB,
    
    -- Tracking (Email)
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0,
    
    -- Tracking (WhatsApp)
    read_at TIMESTAMPTZ,
    read_count INTEGER DEFAULT 0,
    
    -- Tracking (SMS)
    delivered_at TIMESTAMPTZ,
    
    -- Errors
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Cost
    cost NUMERIC(10, 4) DEFAULT 0,
    
    -- Timestamps
    queued_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communication_messages_campaign ON public.communication_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_organizer ON public.communication_messages(organizer_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_contact ON public.communication_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_communication_messages_channel ON public.communication_messages(channel, status);
CREATE INDEX IF NOT EXISTS idx_communication_messages_status ON public.communication_messages(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_communication_messages_created ON public.communication_messages(organizer_id, created_at DESC);

-- ============================================
-- 6. COMMUNICATION TEMPLATES
-- ============================================
-- Shared templates across all channels
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Template Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general', -- 'reminder', 'announcement', 'thank_you', 'promotional', etc.
    
    -- Multi-channel Content
    content JSONB NOT NULL, -- {"email": {"subject": "...", "body": "..."}, "sms": {"message": "..."}, "whatsapp": {"message": "..."}}
    
    -- Variables
    variables TEXT[] DEFAULT '{}', -- Available template variables
    
    -- Settings
    is_system BOOLEAN DEFAULT false, -- System templates vs organizer templates
    is_active BOOLEAN DEFAULT true,
    
    -- Usage Stats
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT templates_organizer_name UNIQUE (organizer_id, name) WHERE organizer_id IS NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_communication_templates_organizer ON public.communication_templates(organizer_id);
CREATE INDEX IF NOT EXISTS idx_communication_templates_category ON public.communication_templates(category);
CREATE INDEX IF NOT EXISTS idx_communication_templates_system ON public.communication_templates(is_system) WHERE is_system = true;

-- ============================================
-- 7. COMMUNICATION ANALYTICS (Materialized View)
-- ============================================
-- Aggregated analytics for dashboard
CREATE TABLE IF NOT EXISTS public.communication_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Time Period
    period_type VARCHAR(20) NOT NULL, -- 'day', 'week', 'month'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Channel Stats
    channel VARCHAR(50) NOT NULL,
    
    -- Metrics
    campaigns_sent INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    messages_opened INTEGER DEFAULT 0, -- Email
    messages_clicked INTEGER DEFAULT 0, -- Email
    messages_read INTEGER DEFAULT 0, -- WhatsApp
    
    -- Rates
    delivery_rate NUMERIC(5, 2) DEFAULT 0,
    open_rate NUMERIC(5, 2) DEFAULT 0,
    click_rate NUMERIC(5, 2) DEFAULT 0,
    read_rate NUMERIC(5, 2) DEFAULT 0,
    
    -- Cost
    total_cost NUMERIC(10, 4) DEFAULT 0,
    
    -- Calculated
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT analytics_organizer_period_channel UNIQUE (organizer_id, period_type, period_start, channel)
);

CREATE INDEX IF NOT EXISTS idx_communication_analytics_organizer ON public.communication_analytics(organizer_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_communication_analytics_channel ON public.communication_analytics(organizer_id, channel, period_start DESC);

-- ============================================
-- 8. FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_segments_updated_at BEFORE UPDATE ON public.contact_segments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communication_campaigns_updated_at BEFORE UPDATE ON public.communication_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communication_messages_updated_at BEFORE UPDATE ON public.communication_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_communication_templates_updated_at BEFORE UPDATE ON public.communication_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to sync contact from ticket
CREATE OR REPLACE FUNCTION sync_contact_from_ticket()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.contacts (
        organizer_id,
        email,
        phone,
        full_name,
        source_type,
        source_id,
        source_metadata,
        first_contact_at,
        last_contact_at
    )
    VALUES (
        (SELECT organizer_id FROM public.events WHERE id = NEW.event_id),
        NEW.attendee_email,
        NEW.attendee_phone,
        NEW.attendee_name,
        'ticket',
        NEW.id,
        jsonb_build_object(
            'event_id', NEW.event_id,
            'ticket_type', NEW.ticket_type_id,
            'order_id', NEW.order_id
        ),
        COALESCE(NEW.created_at, NOW()),
        NOW()
    )
    ON CONFLICT (organizer_id, source_type, source_id) 
    DO UPDATE SET
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        full_name = EXCLUDED.full_name,
        last_contact_at = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-sync contacts from tickets
CREATE TRIGGER sync_ticket_to_contact
    AFTER INSERT OR UPDATE ON public.tickets
    FOR EACH ROW
    WHEN (NEW.payment_status = 'completed')
    EXECUTE FUNCTION sync_contact_from_ticket();

-- Function to sync contact from follower
CREATE OR REPLACE FUNCTION sync_contact_from_follower()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.contacts (
        organizer_id,
        email,
        full_name,
        source_type,
        source_id,
        first_contact_at,
        last_contact_at
    )
    SELECT 
        NEW.organizer_id,
        p.email,
        p.full_name,
        'follower',
        NEW.id,
        COALESCE(NEW.created_at, NOW()),
        NOW()
    FROM public.profiles p
    WHERE p.id = NEW.user_id
    ON CONFLICT (organizer_id, source_type, source_id) 
    DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        last_contact_at = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-sync contacts from followers
CREATE TRIGGER sync_follower_to_contact
    AFTER INSERT OR UPDATE ON public.followers
    FOR EACH ROW
    EXECUTE FUNCTION sync_contact_from_follower();

-- ============================================
-- 9. COMMENTS
-- ============================================

COMMENT ON TABLE public.contacts IS 'Unified contact database aggregating all sources';
COMMENT ON TABLE public.contact_sources IS 'Tracks data lineage for contacts';
COMMENT ON TABLE public.contact_segments IS 'Audience segments for targeted campaigns';
COMMENT ON TABLE public.communication_campaigns IS 'Unified campaigns across all channels';
COMMENT ON TABLE public.communication_messages IS 'All outbound messages (email, SMS, WhatsApp)';
COMMENT ON TABLE public.communication_templates IS 'Shared templates across channels';
COMMENT ON TABLE public.communication_analytics IS 'Aggregated analytics for dashboard';

-- ============================================
-- END OF MIGRATION
-- ============================================
