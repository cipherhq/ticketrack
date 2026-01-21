-- =====================================================
-- GROUP BUY FEATURE - Database Schema
-- Enables friends to coordinate ticket purchases together
-- =====================================================

-- Group Buy Sessions
-- A session is created when someone starts a group purchase
CREATE TABLE IF NOT EXISTS group_buy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session info
  code VARCHAR(8) UNIQUE NOT NULL, -- Short shareable code (e.g., "SQUAD2026")
  name VARCHAR(100), -- Optional group name (e.g., "Sarah's Birthday Squad")
  
  -- Event reference
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Host (person who started the group)
  host_user_id UUID NOT NULL REFERENCES auth.users(id),
  host_name VARCHAR(100),
  
  -- Session timing
  expires_at TIMESTAMPTZ NOT NULL, -- When session ends
  duration_minutes INTEGER DEFAULT 60, -- How long the session lasts
  
  -- Session status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled')),
  
  -- Settings
  max_members INTEGER DEFAULT 20, -- Maximum people in group
  allow_mixed_tickets BOOLEAN DEFAULT true, -- Can members buy different ticket types?
  reserve_tickets BOOLEAN DEFAULT false, -- Hold tickets while selecting?
  
  -- Stats
  member_count INTEGER DEFAULT 1,
  completed_count INTEGER DEFAULT 0, -- Members who completed purchase
  total_tickets INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Group Buy Members
-- Track each person in a group session
CREATE TABLE IF NOT EXISTS group_buy_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session reference
  session_id UUID NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
  
  -- Member info
  user_id UUID REFERENCES auth.users(id), -- NULL if not logged in yet
  email VARCHAR(255),
  name VARCHAR(100),
  
  -- Role
  is_host BOOLEAN DEFAULT false,
  
  -- Member status
  status VARCHAR(20) DEFAULT 'invited' CHECK (status IN (
    'invited',    -- Link shared but not joined yet
    'joined',     -- Joined the lobby
    'selecting',  -- Selecting tickets
    'ready',      -- Selected tickets, ready to pay
    'paying',     -- In payment process
    'completed',  -- Purchase complete
    'dropped'     -- Left the group
  )),
  
  -- Ticket selection
  selected_tickets JSONB DEFAULT '[]', -- Array of {ticket_type_id, quantity, price}
  total_amount DECIMAL(12,2) DEFAULT 0,
  
  -- Order reference (after purchase)
  order_id UUID REFERENCES orders(id),
  
  -- Timing
  joined_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(session_id, user_id),
  UNIQUE(session_id, email)
);

-- Group Buy Messages (optional in-session chat)
CREATE TABLE IF NOT EXISTS group_buy_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
  member_id UUID REFERENCES group_buy_members(id) ON DELETE SET NULL,
  user_name VARCHAR(100),
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'chat' CHECK (message_type IN ('chat', 'system', 'notification')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group Buy Invitations
-- Track email/SMS invitations sent to friends
CREATE TABLE IF NOT EXISTS group_buy_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
  
  -- Invite target (email OR phone)
  email VARCHAR(255),
  phone VARCHAR(50),
  
  -- Inviter info
  inviter_name VARCHAR(100),
  message TEXT,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ,
  
  -- Tracking
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event Group Buy Settings
-- Organizer controls for group buying on their events
CREATE TABLE IF NOT EXISTS event_group_buy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID UNIQUE NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  
  -- Enable/disable
  enabled BOOLEAN DEFAULT true,
  
  -- Session settings
  default_duration_minutes INTEGER DEFAULT 60,
  max_duration_minutes INTEGER DEFAULT 1440, -- 24 hours max
  max_group_size INTEGER DEFAULT 20,
  
  -- Features
  allow_reservations BOOLEAN DEFAULT false, -- Hold tickets during session
  reservation_minutes INTEGER DEFAULT 10, -- How long to hold
  allow_mixed_tickets BOOLEAN DEFAULT true,
  
  -- Restrictions
  min_group_size INTEGER DEFAULT 2,
  require_all_complete BOOLEAN DEFAULT false, -- All must buy or none
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_group_sessions_event ON group_buy_sessions(event_id);
CREATE INDEX IF NOT EXISTS idx_group_sessions_host ON group_buy_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_group_sessions_code ON group_buy_sessions(code);
CREATE INDEX IF NOT EXISTS idx_group_sessions_status ON group_buy_sessions(status);
CREATE INDEX IF NOT EXISTS idx_group_sessions_expires ON group_buy_sessions(expires_at) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_group_members_session ON group_buy_members(session_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_buy_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON group_buy_members(status);

CREATE INDEX IF NOT EXISTS idx_group_messages_session ON group_buy_messages(session_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE group_buy_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_buy_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_group_buy_settings ENABLE ROW LEVEL SECURITY;

-- Sessions: Anyone can view active sessions (for joining), creators can manage
CREATE POLICY "Anyone can view active group sessions" ON group_buy_sessions
  FOR SELECT USING (status = 'active');

CREATE POLICY "Authenticated users can create group sessions" ON group_buy_sessions
  FOR INSERT WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Hosts can update their sessions" ON group_buy_sessions
  FOR UPDATE USING (auth.uid() = host_user_id);

-- Members: Session participants can view/manage
CREATE POLICY "Session members can view members" ON group_buy_members
  FOR SELECT USING (
    session_id IN (SELECT id FROM group_buy_sessions WHERE status = 'active')
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can join groups" ON group_buy_members
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Members can update their own record" ON group_buy_members
  FOR UPDATE USING (user_id = auth.uid());

-- Messages: Session participants can view/send
CREATE POLICY "Session members can view messages" ON group_buy_messages
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM group_buy_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can send messages" ON group_buy_messages
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT session_id FROM group_buy_members WHERE user_id = auth.uid()
    )
  );

-- Event settings: Organizers can manage
CREATE POLICY "Organizers can manage group settings" ON event_group_buy_settings
  FOR ALL USING (
    event_id IN (
      SELECT e.id FROM events e
      JOIN organizers o ON e.organizer_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view group settings" ON event_group_buy_settings
  FOR SELECT USING (true);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Generate unique group code
CREATE OR REPLACE FUNCTION generate_group_code()
RETURNS VARCHAR(8) AS $$
DECLARE
  chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a new group buy session
CREATE OR REPLACE FUNCTION create_group_session(
  p_event_id UUID,
  p_host_user_id UUID,
  p_host_name VARCHAR,
  p_group_name VARCHAR DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS JSON AS $$
DECLARE
  v_code VARCHAR(8);
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_settings RECORD;
BEGIN
  -- Get event settings
  SELECT * INTO v_settings FROM event_group_buy_settings WHERE event_id = p_event_id;
  
  -- Check if group buy is enabled (default true if no settings)
  IF v_settings.id IS NOT NULL AND NOT v_settings.enabled THEN
    RETURN json_build_object('success', false, 'error', 'Group buying is disabled for this event');
  END IF;
  
  -- Apply max duration limit
  IF v_settings.max_duration_minutes IS NOT NULL AND p_duration_minutes > v_settings.max_duration_minutes THEN
    p_duration_minutes := v_settings.max_duration_minutes;
  END IF;
  
  -- Generate unique code
  LOOP
    v_code := generate_group_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM group_buy_sessions WHERE code = v_code);
  END LOOP;
  
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Create session
  INSERT INTO group_buy_sessions (
    code, name, event_id, host_user_id, host_name,
    expires_at, duration_minutes,
    max_members, allow_mixed_tickets, reserve_tickets
  ) VALUES (
    v_code,
    COALESCE(p_group_name, p_host_name || '''s Group'),
    p_event_id,
    p_host_user_id,
    p_host_name,
    v_expires_at,
    p_duration_minutes,
    COALESCE(v_settings.max_group_size, 20),
    COALESCE(v_settings.allow_mixed_tickets, true),
    COALESCE(v_settings.allow_reservations, false)
  )
  RETURNING id INTO v_session_id;
  
  -- Add host as first member
  INSERT INTO group_buy_members (
    session_id, user_id, name, is_host, status, joined_at
  ) VALUES (
    v_session_id, p_host_user_id, p_host_name, true, 'joined', NOW()
  );
  
  -- Add system message
  INSERT INTO group_buy_messages (session_id, message, message_type)
  VALUES (v_session_id, p_host_name || ' created the group', 'system');
  
  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'code', v_code,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Join a group session
CREATE OR REPLACE FUNCTION join_group_session(
  p_code VARCHAR,
  p_user_id UUID,
  p_user_name VARCHAR,
  p_user_email VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_session RECORD;
  v_member_id UUID;
  v_existing_member RECORD;
BEGIN
  -- Find session
  SELECT * INTO v_session FROM group_buy_sessions 
  WHERE code = UPPER(p_code) AND status = 'active';
  
  IF v_session.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Group not found or expired');
  END IF;
  
  -- Check if expired
  IF v_session.expires_at < NOW() THEN
    UPDATE group_buy_sessions SET status = 'expired' WHERE id = v_session.id;
    RETURN json_build_object('success', false, 'error', 'This group session has expired');
  END IF;
  
  -- Check if full
  IF v_session.member_count >= v_session.max_members THEN
    RETURN json_build_object('success', false, 'error', 'This group is full');
  END IF;
  
  -- Check if already a member
  SELECT * INTO v_existing_member FROM group_buy_members 
  WHERE session_id = v_session.id AND user_id = p_user_id;
  
  IF v_existing_member.id IS NOT NULL THEN
    -- Update existing member
    UPDATE group_buy_members SET
      status = CASE WHEN status = 'dropped' THEN 'joined' ELSE status END,
      last_active_at = NOW(),
      joined_at = COALESCE(joined_at, NOW())
    WHERE id = v_existing_member.id;
    
    RETURN json_build_object(
      'success', true,
      'session_id', v_session.id,
      'member_id', v_existing_member.id,
      'rejoined', true
    );
  END IF;
  
  -- Add new member
  INSERT INTO group_buy_members (
    session_id, user_id, email, name, status, joined_at
  ) VALUES (
    v_session.id, p_user_id, p_user_email, p_user_name, 'joined', NOW()
  )
  RETURNING id INTO v_member_id;
  
  -- Update session member count
  UPDATE group_buy_sessions SET 
    member_count = member_count + 1,
    updated_at = NOW()
  WHERE id = v_session.id;
  
  -- Add system message
  INSERT INTO group_buy_messages (session_id, message, message_type)
  VALUES (v_session.id, p_user_name || ' joined the group', 'system');
  
  RETURN json_build_object(
    'success', true,
    'session_id', v_session.id,
    'member_id', v_member_id,
    'event_id', v_session.event_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update member ticket selection
CREATE OR REPLACE FUNCTION update_member_selection(
  p_member_id UUID,
  p_selected_tickets JSONB,
  p_total_amount DECIMAL
)
RETURNS JSON AS $$
BEGIN
  UPDATE group_buy_members SET
    selected_tickets = p_selected_tickets,
    total_amount = p_total_amount,
    status = CASE 
      WHEN jsonb_array_length(p_selected_tickets) > 0 THEN 'ready'
      ELSE 'selecting'
    END,
    last_active_at = NOW(),
    updated_at = NOW()
  WHERE id = p_member_id;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark member as completed (after payment)
CREATE OR REPLACE FUNCTION complete_group_member(
  p_member_id UUID,
  p_order_id UUID,
  p_ticket_count INTEGER,
  p_amount DECIMAL
)
RETURNS JSON AS $$
DECLARE
  v_session_id UUID;
BEGIN
  -- Update member
  UPDATE group_buy_members SET
    status = 'completed',
    order_id = p_order_id,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_member_id
  RETURNING session_id INTO v_session_id;
  
  -- Update session stats
  UPDATE group_buy_sessions SET
    completed_count = completed_count + 1,
    total_tickets = total_tickets + p_ticket_count,
    total_amount = total_amount + p_amount,
    updated_at = NOW()
  WHERE id = v_session_id;
  
  -- Add system message
  INSERT INTO group_buy_messages (session_id, member_id, message, message_type)
  SELECT v_session_id, p_member_id, name || ' completed their purchase! 🎉', 'system'
  FROM group_buy_members WHERE id = p_member_id;
  
  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire old sessions (run via cron)
CREATE OR REPLACE FUNCTION expire_group_sessions()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE group_buy_sessions 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REALTIME
-- =====================================================

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE group_buy_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE group_buy_members;
ALTER PUBLICATION supabase_realtime ADD TABLE group_buy_messages;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION create_group_session TO authenticated;
GRANT EXECUTE ON FUNCTION join_group_session TO authenticated;
GRANT EXECUTE ON FUNCTION update_member_selection TO authenticated;
GRANT EXECUTE ON FUNCTION complete_group_member TO authenticated;
