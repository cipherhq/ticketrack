-- ============================================
-- COMMUNICATION HUB - COMPLETE MIGRATION
-- ============================================
-- This is a combined file that includes:
-- 1. Schema creation (tables, indexes, triggers)
-- 2. Data sync from existing tables
-- 
-- Run this ONCE to set up the Communication Hub
-- ============================================

-- ============================================
-- PART 1: CREATE TABLES
-- ============================================

-- 1.1 UNIFIED CONTACTS TABLE
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

-- 1.2 CONTACT SEGMENTS TABLE
CREATE TABLE IF NOT EXISTS public.contact_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Segment Criteria (stored as JSONB for flexibility)
    criteria JSONB NOT NULL DEFAULT '{}',
    
    -- Auto-update flag
    is_dynamic BOOLEAN DEFAULT true,
    
    -- Stats
    contact_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    
    -- Metadata
    color VARCHAR(7),
    icon VARCHAR(50),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT segments_organizer_name UNIQUE (organizer_id, name)
);

CREATE INDEX IF NOT EXISTS idx_contact_segments_organizer ON public.contact_segments(organizer_id);

-- 1.3 UNIFIED COMMUNICATION CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.communication_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Campaign Info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Channels (can be multiple)
    channels TEXT[] NOT NULL DEFAULT '{}',
    
    -- Content (channel-specific content stored in JSONB)
    content JSONB NOT NULL DEFAULT '{}',
    
    -- Audience
    audience_type VARCHAR(50) NOT NULL DEFAULT 'all_contacts',
    audience_segment_id UUID REFERENCES public.contact_segments(id),
    audience_event_id UUID REFERENCES public.events(id),
    audience_custom_ids UUID[],
    
    -- Legacy Campaign References (for backward compatibility)
    legacy_email_campaign_id UUID,
    legacy_sms_campaign_id UUID,
    legacy_whatsapp_campaign_id UUID,
    
    -- Scheduling
    status VARCHAR(50) DEFAULT 'draft',
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    
    -- Recipients
    total_recipients INTEGER DEFAULT 0,
    recipients_by_channel JSONB DEFAULT '{}',
    
    -- Delivery Stats
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    
    -- Cost Tracking
    estimated_cost NUMERIC(10, 4) DEFAULT 0,
    actual_cost NUMERIC(10, 4) DEFAULT 0,
    
    -- Metadata
    template_id UUID,
    variables JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_communication_campaigns_organizer ON public.communication_campaigns(organizer_id);
CREATE INDEX IF NOT EXISTS idx_communication_campaigns_status ON public.communication_campaigns(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_communication_campaigns_scheduled ON public.communication_campaigns(scheduled_for) WHERE status = 'scheduled';

-- 1.4 UNIFIED MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.communication_campaigns(id) ON DELETE SET NULL,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    
    -- Channel & Content
    channel VARCHAR(50) NOT NULL,
    to_email VARCHAR(255),
    to_phone VARCHAR(20),
    to_name VARCHAR(255),
    
    subject VARCHAR(255),
    body TEXT NOT NULL,
    
    -- Delivery Status
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Provider Info
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    provider_response JSONB,
    
    -- Tracking
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    
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

-- 1.5 COMMUNICATION TEMPLATES
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    
    content JSONB NOT NULL DEFAULT '{}',
    variables TEXT[] DEFAULT '{}',
    
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_communication_templates_organizer ON public.communication_templates(organizer_id);

-- ============================================
-- PART 2: FUNCTIONS & TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comm_hub_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers (use IF NOT EXISTS pattern)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contacts_updated_at') THEN
        CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
            FOR EACH ROW EXECUTE FUNCTION update_comm_hub_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contact_segments_updated_at') THEN
        CREATE TRIGGER update_contact_segments_updated_at BEFORE UPDATE ON public.contact_segments
            FOR EACH ROW EXECUTE FUNCTION update_comm_hub_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_communication_campaigns_updated_at') THEN
        CREATE TRIGGER update_communication_campaigns_updated_at BEFORE UPDATE ON public.communication_campaigns
            FOR EACH ROW EXECUTE FUNCTION update_comm_hub_updated_at();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_communication_messages_updated_at') THEN
        CREATE TRIGGER update_communication_messages_updated_at BEFORE UPDATE ON public.communication_messages
            FOR EACH ROW EXECUTE FUNCTION update_comm_hub_updated_at();
    END IF;
END $$;

-- ============================================
-- PART 3: SYNC EXISTING DATA
-- ============================================

-- 3.1 SYNC CONTACTS FROM TICKETS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        INSERT INTO public.contacts (
            organizer_id,
            email,
            phone,
            full_name,
            source_type,
            source_id,
            source_metadata,
            email_opt_in,
            first_contact_at,
            last_contact_at
        )
        SELECT DISTINCT ON (e.organizer_id, t.attendee_email)
            e.organizer_id,
            t.attendee_email,
            t.attendee_phone,
            t.attendee_name,
            'ticket',
            t.id,
            jsonb_build_object('event_id', t.event_id, 'first_event', e.title),
            true,
            t.created_at,
            t.created_at
        FROM public.tickets t
        JOIN public.events e ON t.event_id = e.id
        WHERE t.payment_status = 'completed'
            AND t.attendee_email IS NOT NULL
            AND e.organizer_id IS NOT NULL
        ON CONFLICT (organizer_id, source_type, source_id) 
        DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            full_name = EXCLUDED.full_name,
            last_contact_at = GREATEST(contacts.last_contact_at, EXCLUDED.last_contact_at),
            updated_at = NOW();
        
        RAISE NOTICE 'Synced contacts from tickets';
    ELSE
        RAISE NOTICE 'tickets table does not exist, skipping';
    END IF;
END $$;

-- 3.2 SYNC CONTACTS FROM FOLLOWERS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followers') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        INSERT INTO public.contacts (
            organizer_id,
            email,
            phone,
            full_name,
            source_type,
            source_id,
            email_opt_in,
            first_contact_at,
            last_contact_at
        )
        SELECT 
            f.organizer_id,
            p.email,
            p.phone,
            p.full_name,
            'follower',
            f.id,
            true,
            f.created_at,
            f.created_at
        FROM public.followers f
        JOIN public.profiles p ON f.user_id = p.id
        WHERE p.email IS NOT NULL
            AND f.organizer_id IS NOT NULL
        ON CONFLICT (organizer_id, source_type, source_id) 
        DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            full_name = EXCLUDED.full_name,
            updated_at = NOW();
        
        RAISE NOTICE 'Synced contacts from followers';
    ELSE
        RAISE NOTICE 'followers or profiles table does not exist, skipping';
    END IF;
END $$;

-- 3.3 CREATE DEFAULT SEGMENTS
DO $$
BEGIN
    -- Create an "All Contacts" segment for each organizer that doesn't have one
    INSERT INTO public.contact_segments (organizer_id, name, description, criteria, is_dynamic, color)
    SELECT id, 'All Contacts', 'All contacts in your database', '{"all": true}'::jsonb, true, '#2969FF'
    FROM public.organizers
    WHERE id NOT IN (SELECT organizer_id FROM public.contact_segments WHERE name = 'All Contacts')
    ON CONFLICT DO NOTHING;

    -- Create "Recent Buyers" segment
    INSERT INTO public.contact_segments (organizer_id, name, description, criteria, is_dynamic, color)
    SELECT id, 'Recent Buyers', 'Purchased in the last 30 days', '{"source_type": "ticket", "last_contact_days": 30}'::jsonb, true, '#10B981'
    FROM public.organizers
    WHERE id NOT IN (SELECT organizer_id FROM public.contact_segments WHERE name = 'Recent Buyers')
    ON CONFLICT DO NOTHING;

    -- Create "VIP" segment
    INSERT INTO public.contact_segments (organizer_id, name, description, criteria, is_dynamic, color)
    SELECT id, 'VIP', 'High-value customers (3+ events)', '{"events_attended_min": 3}'::jsonb, true, '#F59E0B'
    FROM public.organizers
    WHERE id NOT IN (SELECT organizer_id FROM public.contact_segments WHERE name = 'VIP')
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created default segments';
END $$;

-- ============================================
-- PART 4: RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;

-- Contacts policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'contacts_organizer_access') THEN
        CREATE POLICY contacts_organizer_access ON public.contacts
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

-- Segments policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_segments' AND policyname = 'segments_organizer_access') THEN
        CREATE POLICY segments_organizer_access ON public.contact_segments
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

-- Campaigns policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_campaigns' AND policyname = 'campaigns_organizer_access') THEN
        CREATE POLICY campaigns_organizer_access ON public.communication_campaigns
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

-- Messages policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_messages' AND policyname = 'messages_organizer_access') THEN
        CREATE POLICY messages_organizer_access ON public.communication_messages
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

-- Templates policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_templates' AND policyname = 'templates_access') THEN
        CREATE POLICY templates_access ON public.communication_templates
            FOR ALL USING (
                is_system = true 
                OR organizer_id IN (
                    SELECT id FROM public.organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM public.organizer_team_members 
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- ============================================
-- PART 5: COMMENTS
-- ============================================

COMMENT ON TABLE public.contacts IS 'Unified contact database for Communication Hub';
COMMENT ON TABLE public.contact_segments IS 'Audience segments for targeted campaigns';
COMMENT ON TABLE public.communication_campaigns IS 'Unified campaigns across email, SMS, WhatsApp';
COMMENT ON TABLE public.communication_messages IS 'All outbound messages with tracking';
COMMENT ON TABLE public.communication_templates IS 'Reusable message templates';

-- ============================================
-- MIGRATION COMPLETE!
-- ============================================
SELECT 
    'Communication Hub setup complete!' as status,
    (SELECT COUNT(*) FROM public.contacts) as total_contacts,
    (SELECT COUNT(*) FROM public.contact_segments) as total_segments;
