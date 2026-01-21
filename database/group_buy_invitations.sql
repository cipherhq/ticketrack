-- =====================================================
-- GROUP BUY INVITATIONS - Additional Schema
-- Enables email/SMS invitations for group sessions
-- =====================================================

-- Group Buy Invitations
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

-- Index for looking up invitations by email/phone
CREATE INDEX IF NOT EXISTS idx_group_invitations_email ON group_buy_invitations(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_invitations_phone ON group_buy_invitations(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_invitations_session ON group_buy_invitations(session_id);
CREATE INDEX IF NOT EXISTS idx_group_invitations_status ON group_buy_invitations(status);

-- RLS
ALTER TABLE group_buy_invitations ENABLE ROW LEVEL SECURITY;

-- Anyone can view invitations to their email
CREATE POLICY "Users can view invitations to their email" ON group_buy_invitations
  FOR SELECT USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR session_id IN (
      SELECT session_id FROM group_buy_members WHERE user_id = auth.uid()
    )
  );

-- Session members can create invitations
CREATE POLICY "Session members can create invitations" ON group_buy_invitations
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT session_id FROM group_buy_members WHERE user_id = auth.uid()
    )
  );

-- Users can update invitations to their email (accept/decline)
CREATE POLICY "Users can update their invitations" ON group_buy_invitations
  FOR UPDATE USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
