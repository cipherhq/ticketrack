-- ============================================================================
-- EXTERNAL EVENT IMPORTS SCHEMA
-- Import events from Eventbrite, Tix.Africa, and other platforms
-- ============================================================================

-- ============================================================================
-- 1. EXTERNAL PLATFORM CONNECTIONS
-- ============================================================================
-- Store API credentials and connection status for each platform
CREATE TABLE IF NOT EXISTS public.external_platform_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Platform info
    platform VARCHAR(50) NOT NULL, -- 'eventbrite', 'tixafrica', 'partyvest', 'afrotix'
    platform_name VARCHAR(100) NOT NULL,
    
    -- Credentials (encrypted)
    api_key TEXT,
    api_secret TEXT,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- OAuth details
    oauth_user_id VARCHAR(255),
    oauth_email VARCHAR(255),
    
    -- Connection status
    status VARCHAR(20) DEFAULT 'connected', -- 'connected', 'disconnected', 'expired', 'error'
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,
    
    -- Settings
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_frequency VARCHAR(20) DEFAULT 'daily', -- 'hourly', 'daily', 'weekly', 'manual'
    import_past_events BOOLEAN DEFAULT false,
    
    -- Custom field mappings (organizer can override defaults)
    custom_event_mappings JSONB DEFAULT '{}',
    custom_attendee_mappings JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(organizer_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_platform_connections_organizer ON external_platform_connections(organizer_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON external_platform_connections(platform);

-- ============================================================================
-- 2. IMPORTED EVENTS TRACKING
-- ============================================================================
-- Track which events were imported from external platforms
CREATE TABLE IF NOT EXISTS public.imported_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    connection_id UUID NOT NULL REFERENCES external_platform_connections(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    
    -- External platform info
    platform VARCHAR(50) NOT NULL,
    external_event_id VARCHAR(255) NOT NULL,
    external_event_url TEXT,
    
    -- Import metadata
    import_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'imported', 'updated', 'failed', 'skipped'
    import_error TEXT,
    
    -- Raw data from external platform
    external_data JSONB,
    
    -- Sync tracking
    last_synced_at TIMESTAMPTZ,
    external_updated_at TIMESTAMPTZ,
    local_updated_at TIMESTAMPTZ,
    
    -- Options
    sync_enabled BOOLEAN DEFAULT true,
    sync_attendees BOOLEAN DEFAULT true,
    sync_ticket_types BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(platform, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_imported_events_organizer ON imported_events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_imported_events_event ON imported_events(event_id);
CREATE INDEX IF NOT EXISTS idx_imported_events_platform ON imported_events(platform);
CREATE INDEX IF NOT EXISTS idx_imported_events_external_id ON imported_events(platform, external_event_id);

-- ============================================================================
-- 3. IMPORTED ATTENDEES TRACKING
-- ============================================================================
-- Track attendees imported from external platforms
CREATE TABLE IF NOT EXISTS public.imported_attendees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    imported_event_id UUID NOT NULL REFERENCES imported_events(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    
    -- External platform info
    platform VARCHAR(50) NOT NULL,
    external_attendee_id VARCHAR(255) NOT NULL,
    external_order_id VARCHAR(255),
    
    -- Attendee data
    email VARCHAR(255),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    ticket_type_name VARCHAR(255),
    
    -- Import status
    import_status VARCHAR(20) DEFAULT 'pending',
    import_error TEXT,
    
    -- Raw data
    external_data JSONB,
    
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(platform, external_attendee_id)
);

CREATE INDEX IF NOT EXISTS idx_imported_attendees_event ON imported_attendees(imported_event_id);
CREATE INDEX IF NOT EXISTS idx_imported_attendees_ticket ON imported_attendees(ticket_id);
CREATE INDEX IF NOT EXISTS idx_imported_attendees_email ON imported_attendees(email);

-- ============================================================================
-- 4. IMPORT JOBS LOG
-- ============================================================================
-- Track import job history
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES external_platform_connections(id) ON DELETE SET NULL,
    
    -- Job info
    job_type VARCHAR(50) NOT NULL, -- 'full_import', 'sync', 'single_event', 'attendees_only'
    platform VARCHAR(50) NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
    
    -- Progress
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    imported_items INTEGER DEFAULT 0,
    updated_items INTEGER DEFAULT 0,
    skipped_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Results
    error_message TEXT,
    error_details JSONB,
    result_summary JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_organizer ON import_jobs(organizer_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_created ON import_jobs(created_at DESC);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================
ALTER TABLE external_platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

-- Organizer access policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_platform_connections' AND policyname = 'external_platform_connections_organizer_access') THEN
        CREATE POLICY external_platform_connections_organizer_access ON external_platform_connections
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'imported_events' AND policyname = 'imported_events_organizer_access') THEN
        CREATE POLICY imported_events_organizer_access ON imported_events
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'imported_attendees' AND policyname = 'imported_attendees_organizer_access') THEN
        CREATE POLICY imported_attendees_organizer_access ON imported_attendees
            FOR ALL USING (
                imported_event_id IN (
                    SELECT id FROM imported_events WHERE organizer_id IN (
                        SELECT id FROM organizers WHERE user_id = auth.uid()
                        UNION
                        SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
                    )
                )
            );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_jobs' AND policyname = 'import_jobs_organizer_access') THEN
        CREATE POLICY import_jobs_organizer_access ON import_jobs
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- ============================================================================
-- 6. PLATFORM CONFIGURATIONS (Static reference data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.supported_import_platforms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    logo_url TEXT,
    description TEXT,
    
    -- API info
    api_base_url TEXT,
    auth_type VARCHAR(20), -- 'api_key', 'oauth2', 'bearer'
    oauth_url TEXT,
    
    -- Capabilities
    supports_event_import BOOLEAN DEFAULT true,
    supports_attendee_import BOOLEAN DEFAULT true,
    supports_auto_sync BOOLEAN DEFAULT true,
    
    -- Field mappings
    event_field_mappings JSONB,
    attendee_field_mappings JSONB,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert supported platforms
INSERT INTO supported_import_platforms (id, name, description, api_base_url, auth_type, supports_event_import, supports_attendee_import, event_field_mappings, attendee_field_mappings) VALUES
(
    'eventbrite',
    'Eventbrite',
    'Import events and attendees from Eventbrite',
    'https://www.eventbriteapi.com/v3',
    'oauth2',
    true,
    true,
    '{
        "name": {"source": "name.text", "type": "string"},
        "description": {"source": "description.text", "type": "string"},
        "start_date": {"source": "start.utc", "type": "datetime"},
        "end_date": {"source": "end.utc", "type": "datetime"},
        "venue_name": {"source": "venue.name", "type": "string"},
        "venue_address": {"source": "venue.address.localized_address_display", "type": "string"},
        "city": {"source": "venue.address.city", "type": "string"},
        "country_code": {"source": "venue.address.country", "type": "string"},
        "image_url": {"source": "logo.url", "type": "string"},
        "is_virtual": {"source": "online_event", "type": "boolean"},
        "is_free": {"source": "is_free", "type": "boolean"},
        "currency": {"source": "currency", "type": "string"},
        "external_url": {"source": "url", "type": "string"}
    }'::jsonb,
    '{
        "email": {"source": "profile.email", "type": "string"},
        "full_name": {"source": "profile.name", "type": "string"},
        "first_name": {"source": "profile.first_name", "type": "string"},
        "last_name": {"source": "profile.last_name", "type": "string"},
        "ticket_type": {"source": "ticket_class_name", "type": "string"},
        "order_id": {"source": "order_id", "type": "string"},
        "checked_in": {"source": "checked_in", "type": "boolean"}
    }'::jsonb
),
(
    'tixafrica',
    'Tix.Africa',
    'Import events and attendees from Tix.Africa',
    'https://api.tix.africa/v1',
    'api_key',
    true,
    true,
    '{
        "name": {"source": "title", "type": "string"},
        "description": {"source": "description", "type": "string"},
        "start_date": {"source": "start_date", "type": "datetime"},
        "end_date": {"source": "end_date", "type": "datetime"},
        "venue_name": {"source": "venue.name", "type": "string"},
        "venue_address": {"source": "venue.address", "type": "string"},
        "city": {"source": "venue.city", "type": "string"},
        "country_code": {"source": "venue.country", "type": "string"},
        "image_url": {"source": "image", "type": "string"},
        "is_virtual": {"source": "is_online", "type": "boolean"},
        "currency": {"source": "currency", "type": "string"}
    }'::jsonb,
    '{
        "email": {"source": "email", "type": "string"},
        "full_name": {"source": "name", "type": "string"},
        "phone": {"source": "phone", "type": "string"},
        "ticket_type": {"source": "ticket_name", "type": "string"},
        "order_id": {"source": "order_reference", "type": "string"}
    }'::jsonb
),
(
    'afrotix',
    'Afrotix',
    'Import events and attendees from Afrotix',
    'https://api.afrotix.com/v1',
    'api_key',
    true,
    true,
    '{
        "name": {"source": "event_name", "type": "string"},
        "description": {"source": "event_description", "type": "string"},
        "start_date": {"source": "event_date", "type": "datetime"},
        "venue_name": {"source": "venue", "type": "string"},
        "city": {"source": "city", "type": "string"},
        "image_url": {"source": "event_image", "type": "string"}
    }'::jsonb,
    '{
        "email": {"source": "attendee_email", "type": "string"},
        "full_name": {"source": "attendee_name", "type": "string"},
        "phone": {"source": "attendee_phone", "type": "string"},
        "ticket_type": {"source": "ticket_type", "type": "string"}
    }'::jsonb
),
(
    'partyvest',
    'PartyVest',
    'Import events and attendees from PartyVest',
    'https://api.partyvest.ng/v1',
    'api_key',
    true,
    true,
    '{
        "name": {"source": "event_title", "type": "string"},
        "description": {"source": "description", "type": "string"},
        "start_date": {"source": "start_datetime", "type": "datetime"},
        "venue_name": {"source": "venue_name", "type": "string"},
        "city": {"source": "location", "type": "string"},
        "image_url": {"source": "flyer_url", "type": "string"}
    }'::jsonb,
    '{
        "email": {"source": "guest_email", "type": "string"},
        "full_name": {"source": "guest_name", "type": "string"},
        "phone": {"source": "guest_phone", "type": "string"},
        "ticket_type": {"source": "ticket_category", "type": "string"}
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    event_field_mappings = EXCLUDED.event_field_mappings,
    attendee_field_mappings = EXCLUDED.attendee_field_mappings;

-- ============================================================================
-- DONE
-- ============================================================================
