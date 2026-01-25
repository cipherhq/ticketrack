-- ============================================================================
-- CONVERSATIONS & TWO-WAY MESSAGING SCHEMA
-- Enables organizers to receive and respond to messages from contacts
-- ============================================================================

-- ============================================================================
-- 1. CONVERSATIONS TABLE
-- ============================================================================
-- A conversation is a thread between an organizer and a contact across any channel
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    
    -- Contact info (kept even if contact deleted)
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    contact_name VARCHAR(255),
    
    -- Channel and status
    channel VARCHAR(20) NOT NULL, -- 'sms', 'whatsapp', 'email', 'telegram'
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'closed', 'archived', 'spam'
    
    -- Conversation metadata
    subject VARCHAR(500), -- For email threads
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    last_message_direction VARCHAR(10), -- 'inbound', 'outbound'
    
    -- Unread tracking
    unread_count INTEGER DEFAULT 0,
    
    -- Assignment (for team support)
    assigned_to UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,
    
    -- Tags/labels for organization
    tags TEXT[] DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_organizer ON conversations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(organizer_id, channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(contact_phone) WHERE contact_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_email ON conversations(contact_email) WHERE contact_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(organizer_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON conversations(organizer_id, unread_count) WHERE unread_count > 0;

-- ============================================================================
-- 2. CONVERSATION MESSAGES TABLE
-- ============================================================================
-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Direction and sender
    direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
    sender_type VARCHAR(20), -- 'contact', 'organizer', 'system', 'auto'
    sender_id UUID, -- user_id if organizer sent it
    
    -- Message content
    channel VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text', -- 'text', 'image', 'audio', 'document', 'template'
    
    -- For email
    subject VARCHAR(500),
    
    -- Media attachments
    media_urls TEXT[],
    media_types TEXT[],
    
    -- External IDs for tracking
    external_id VARCHAR(255), -- Provider message ID (Termii, Twilio, Meta, etc.)
    external_status VARCHAR(50), -- 'delivered', 'read', 'failed', etc.
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Read status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_organizer ON conversation_messages(organizer_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_direction ON conversation_messages(conversation_id, direction);
CREATE INDEX IF NOT EXISTS idx_conv_messages_external ON conversation_messages(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON conversation_messages(conversation_id, created_at DESC);

-- ============================================================================
-- 3. AUTO RESPONSES TABLE
-- ============================================================================
-- Automated responses that can be triggered
CREATE TABLE IF NOT EXISTS public.auto_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Trigger conditions
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(20), -- NULL = all channels
    trigger_type VARCHAR(50) NOT NULL, -- 'first_message', 'keyword', 'after_hours', 'always'
    trigger_keywords TEXT[], -- For keyword triggers
    
    -- Response content
    response_message TEXT NOT NULL,
    response_delay_seconds INTEGER DEFAULT 0, -- Delay before sending
    
    -- Conditions
    active_hours_start TIME, -- NULL = always active
    active_hours_end TIME,
    active_days INTEGER[], -- 0=Sunday, 1=Monday, etc.
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Stats
    times_triggered INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_responses_organizer ON auto_responses(organizer_id);
CREATE INDEX IF NOT EXISTS idx_auto_responses_active ON auto_responses(organizer_id, is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 4. INBOUND MESSAGE LOG TABLE
-- ============================================================================
-- Raw log of all inbound messages for debugging
CREATE TABLE IF NOT EXISTS public.inbound_message_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source
    channel VARCHAR(20) NOT NULL,
    provider VARCHAR(50), -- 'termii', 'twilio', 'meta', 'resend'
    
    -- Raw data
    raw_payload JSONB NOT NULL,
    
    -- Parsed data
    from_number VARCHAR(50),
    from_email VARCHAR(255),
    to_number VARCHAR(50),
    to_email VARCHAR(255),
    message_content TEXT,
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    conversation_id UUID REFERENCES conversations(id),
    error_message TEXT,
    
    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbound_log_channel ON inbound_message_log(channel);
CREATE INDEX IF NOT EXISTS idx_inbound_log_processed ON inbound_message_log(processed) WHERE processed = FALSE;
CREATE INDEX IF NOT EXISTS idx_inbound_log_from ON inbound_message_log(from_number) WHERE from_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbound_log_received ON inbound_message_log(received_at DESC);

-- ============================================================================
-- 5. RLS POLICIES
-- ============================================================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_message_log ENABLE ROW LEVEL SECURITY;

-- Conversations
DROP POLICY IF EXISTS "Organizers can view their conversations" ON conversations;
CREATE POLICY "Organizers can view their conversations"
    ON conversations FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Organizers can manage their conversations" ON conversations;
CREATE POLICY "Organizers can manage their conversations"
    ON conversations FOR ALL
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Conversation messages
DROP POLICY IF EXISTS "Organizers can view their messages" ON conversation_messages;
CREATE POLICY "Organizers can view their messages"
    ON conversation_messages FOR SELECT
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Organizers can manage their messages" ON conversation_messages;
CREATE POLICY "Organizers can manage their messages"
    ON conversation_messages FOR ALL
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Auto responses
DROP POLICY IF EXISTS "Organizers can manage their auto responses" ON auto_responses;
CREATE POLICY "Organizers can manage their auto responses"
    ON auto_responses FOR ALL
    USING (organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid()));

-- Inbound log - service role only (no direct user access)
DROP POLICY IF EXISTS "Service role can access inbound log" ON inbound_message_log;
CREATE POLICY "Service role can access inbound log"
    ON inbound_message_log FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- Function to find or create a conversation
CREATE OR REPLACE FUNCTION find_or_create_conversation(
    p_organizer_id UUID,
    p_channel VARCHAR(20),
    p_contact_phone VARCHAR(50) DEFAULT NULL,
    p_contact_email VARCHAR(255) DEFAULT NULL,
    p_contact_name VARCHAR(255) DEFAULT NULL,
    p_subject VARCHAR(500) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_contact_id UUID;
BEGIN
    -- Try to find existing open conversation
    IF p_contact_phone IS NOT NULL THEN
        SELECT id INTO v_conversation_id
        FROM conversations
        WHERE organizer_id = p_organizer_id
          AND channel = p_channel
          AND contact_phone = p_contact_phone
          AND status = 'open'
        ORDER BY last_message_at DESC
        LIMIT 1;
    ELSIF p_contact_email IS NOT NULL THEN
        SELECT id INTO v_conversation_id
        FROM conversations
        WHERE organizer_id = p_organizer_id
          AND channel = p_channel
          AND contact_email = p_contact_email
          AND status = 'open'
        ORDER BY last_message_at DESC
        LIMIT 1;
    END IF;

    -- If no existing conversation, create new one
    IF v_conversation_id IS NULL THEN
        -- Try to find contact
        IF p_contact_phone IS NOT NULL THEN
            SELECT id INTO v_contact_id
            FROM contacts
            WHERE organizer_id = p_organizer_id
              AND phone = p_contact_phone
            LIMIT 1;
        ELSIF p_contact_email IS NOT NULL THEN
            SELECT id INTO v_contact_id
            FROM contacts
            WHERE organizer_id = p_organizer_id
              AND email = p_contact_email
            LIMIT 1;
        END IF;

        INSERT INTO conversations (
            organizer_id, contact_id, channel,
            contact_phone, contact_email, contact_name, subject
        )
        VALUES (
            p_organizer_id, v_contact_id, p_channel,
            p_contact_phone, p_contact_email, p_contact_name, p_subject
        )
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_conversation_on_message ON conversation_messages;
CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_message();

-- Function to mark conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_read(p_conversation_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Update unread count
    UPDATE conversations
    SET unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
    
    -- Mark all inbound messages as read
    UPDATE conversation_messages
    SET is_read = TRUE, read_at = NOW()
    WHERE conversation_id = p_conversation_id
      AND direction = 'inbound'
      AND is_read = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. VIEWS
-- ============================================================================

-- Inbox view with unread counts per organizer
CREATE OR REPLACE VIEW inbox_summary AS
SELECT 
    organizer_id,
    channel,
    COUNT(*) as total_conversations,
    COUNT(*) FILTER (WHERE status = 'open') as open_conversations,
    SUM(unread_count) as total_unread,
    MAX(last_message_at) as latest_message
FROM conversations
GROUP BY organizer_id, channel;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Conversations schema created successfully' AS status;
