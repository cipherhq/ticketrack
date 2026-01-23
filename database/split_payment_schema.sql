-- =====================================================
-- SPLIT PAYMENT FEATURE - Database Schema
-- Enables group members to split ticket costs
-- =====================================================

-- Split Payment Sessions
-- Created when a group decides to split payment for tickets
CREATE TABLE IF NOT EXISTS group_split_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to group session
  session_id UUID NOT NULL REFERENCES group_buy_sessions(id) ON DELETE CASCADE,
  
  -- Who initiated the split
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  
  -- What's being split
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ticket_selection JSONB NOT NULL, -- Array of {ticket_type_id, name, quantity, price}
  
  -- Totals
  total_amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  service_fee DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) NOT NULL, -- total_amount + service_fee
  
  -- Split configuration
  split_type VARCHAR(20) DEFAULT 'equal' CHECK (split_type IN ('equal', 'custom', 'per_ticket')),
  member_count INTEGER NOT NULL DEFAULT 2,
  amount_per_share DECIMAL(12,2), -- For equal splits
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Waiting for members to pay
    'partial',      -- Some members have paid
    'completed',    -- All members paid, order created
    'expired',      -- Payment deadline passed
    'cancelled',    -- Host cancelled
    'refunding',    -- Processing refunds
    'refunded'      -- All refunds processed
  )),
  
  -- Timing
  expires_at TIMESTAMPTZ NOT NULL, -- Deadline for all payments
  reminder_sent_at TIMESTAMPTZ, -- Last reminder sent
  
  -- Result
  order_id UUID REFERENCES orders(id), -- Created when all shares paid
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Individual Share Payments
-- Track each member's share and payment status
CREATE TABLE IF NOT EXISTS group_split_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to split payment
  split_payment_id UUID NOT NULL REFERENCES group_split_payments(id) ON DELETE CASCADE,
  
  -- Member info
  user_id UUID REFERENCES auth.users(id),
  member_id UUID REFERENCES group_buy_members(id),
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  phone VARCHAR(50),
  
  -- Share details
  share_amount DECIMAL(12,2) NOT NULL,
  share_percentage DECIMAL(5,2), -- For display (e.g., 25.00%)
  tickets_allocated INTEGER DEFAULT 0, -- For per_ticket splits
  
  -- Payment
  payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN (
    'unpaid',       -- Not yet paid
    'pending',      -- Payment initiated
    'paid',         -- Successfully paid
    'failed',       -- Payment failed
    'refunded'      -- Refunded
  )),
  payment_reference VARCHAR(100), -- Payment gateway reference
  payment_method VARCHAR(50),
  paid_at TIMESTAMPTZ,
  
  -- Unique payment link token
  payment_token UUID DEFAULT gen_random_uuid(),
  token_expires_at TIMESTAMPTZ,
  
  -- Reminders
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_split_payments_session ON group_split_payments(session_id);
CREATE INDEX IF NOT EXISTS idx_split_payments_status ON group_split_payments(status);
CREATE INDEX IF NOT EXISTS idx_split_payments_expires ON group_split_payments(expires_at) WHERE status IN ('pending', 'partial');

CREATE INDEX IF NOT EXISTS idx_split_shares_payment ON group_split_shares(split_payment_id);
CREATE INDEX IF NOT EXISTS idx_split_shares_user ON group_split_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_split_shares_token ON group_split_shares(payment_token);
CREATE INDEX IF NOT EXISTS idx_split_shares_status ON group_split_shares(payment_status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE group_split_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_split_shares ENABLE ROW LEVEL SECURITY;

-- Split payments: Members of the group can view
CREATE POLICY "Group members can view split payments" ON group_split_payments
  FOR SELECT USING (
    session_id IN (
      SELECT session_id FROM group_buy_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Initiator can create split payments" ON group_split_payments
  FOR INSERT WITH CHECK (auth.uid() = initiated_by);

CREATE POLICY "Initiator can update split payments" ON group_split_payments
  FOR UPDATE USING (auth.uid() = initiated_by);

-- Shares: Users can view their own shares or if they're in the group
CREATE POLICY "Users can view their shares" ON group_split_shares
  FOR SELECT USING (
    user_id = auth.uid()
    OR split_payment_id IN (
      SELECT sp.id FROM group_split_payments sp
      JOIN group_buy_members gbm ON gbm.session_id = sp.session_id
      WHERE gbm.user_id = auth.uid()
    )
  );

CREATE POLICY "System can create shares" ON group_split_shares
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their shares" ON group_split_shares
  FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Create a split payment for a group
CREATE OR REPLACE FUNCTION create_split_payment(
  p_session_id UUID,
  p_ticket_selection JSONB,
  p_total_amount DECIMAL,
  p_currency VARCHAR,
  p_service_fee DECIMAL,
  p_member_emails JSONB, -- Array of {email, name, user_id?}
  p_split_type VARCHAR DEFAULT 'equal',
  p_deadline_hours INTEGER DEFAULT 24
)
RETURNS JSON AS $$
DECLARE
  v_user_id UUID;
  v_split_id UUID;
  v_member JSONB;
  v_member_count INTEGER;
  v_amount_per_share DECIMAL;
  v_grand_total DECIMAL;
  v_expires_at TIMESTAMPTZ;
  v_event_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Get event_id from session
  SELECT event_id INTO v_event_id FROM group_buy_sessions WHERE id = p_session_id;
  IF v_event_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Session not found');
  END IF;
  
  -- Calculate totals
  v_member_count := jsonb_array_length(p_member_emails);
  IF v_member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Need at least 2 members to split');
  END IF;
  
  v_grand_total := p_total_amount + COALESCE(p_service_fee, 0);
  v_amount_per_share := ROUND(v_grand_total / v_member_count, 2);
  v_expires_at := NOW() + (p_deadline_hours || ' hours')::INTERVAL;
  
  -- Create split payment
  INSERT INTO group_split_payments (
    session_id, initiated_by, event_id, ticket_selection,
    total_amount, currency, service_fee, grand_total,
    split_type, member_count, amount_per_share,
    status, expires_at
  ) VALUES (
    p_session_id, v_user_id, v_event_id, p_ticket_selection,
    p_total_amount, p_currency, p_service_fee, v_grand_total,
    p_split_type, v_member_count, v_amount_per_share,
    'pending', v_expires_at
  )
  RETURNING id INTO v_split_id;
  
  -- Create shares for each member
  FOR v_member IN SELECT * FROM jsonb_array_elements(p_member_emails)
  LOOP
    INSERT INTO group_split_shares (
      split_payment_id,
      user_id,
      email,
      name,
      share_amount,
      share_percentage,
      token_expires_at
    ) VALUES (
      v_split_id,
      (v_member->>'user_id')::UUID,
      v_member->>'email',
      v_member->>'name',
      v_amount_per_share,
      ROUND(100.0 / v_member_count, 2),
      v_expires_at
    );
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'split_payment_id', v_split_id,
    'amount_per_share', v_amount_per_share,
    'member_count', v_member_count,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get split payment details with shares
CREATE OR REPLACE FUNCTION get_split_payment(p_split_id UUID)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'split_payment', row_to_json(sp.*),
    'shares', (
      SELECT json_agg(row_to_json(ss.*))
      FROM group_split_shares ss
      WHERE ss.split_payment_id = sp.id
    ),
    'event', (
      SELECT row_to_json(e.*)
      FROM events e
      WHERE e.id = sp.event_id
    ),
    'paid_count', (
      SELECT COUNT(*) FROM group_split_shares
      WHERE split_payment_id = sp.id AND payment_status = 'paid'
    ),
    'total_paid', (
      SELECT COALESCE(SUM(share_amount), 0) FROM group_split_shares
      WHERE split_payment_id = sp.id AND payment_status = 'paid'
    )
  ) INTO v_result
  FROM group_split_payments sp
  WHERE sp.id = p_split_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get share by payment token (for pay-your-share links)
CREATE OR REPLACE FUNCTION get_share_by_token(p_token UUID)
RETURNS JSON AS $$
DECLARE
  v_share RECORD;
  v_split RECORD;
  v_event RECORD;
BEGIN
  -- Get share
  SELECT * INTO v_share FROM group_split_shares 
  WHERE payment_token = p_token AND token_expires_at > NOW();
  
  IF v_share.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired payment link');
  END IF;
  
  -- Get split payment
  SELECT * INTO v_split FROM group_split_payments WHERE id = v_share.split_payment_id;
  
  -- Get event
  SELECT * INTO v_event FROM events WHERE id = v_split.event_id;
  
  RETURN json_build_object(
    'success', true,
    'share', row_to_json(v_share),
    'split_payment', row_to_json(v_split),
    'event', row_to_json(v_event)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record a share payment
CREATE OR REPLACE FUNCTION record_share_payment(
  p_share_id UUID,
  p_payment_reference VARCHAR,
  p_payment_method VARCHAR
)
RETURNS JSON AS $$
DECLARE
  v_split_id UUID;
  v_paid_count INTEGER;
  v_total_count INTEGER;
  v_split RECORD;
BEGIN
  -- Update share
  UPDATE group_split_shares SET
    payment_status = 'paid',
    payment_reference = p_payment_reference,
    payment_method = p_payment_method,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_share_id AND payment_status != 'paid'
  RETURNING split_payment_id INTO v_split_id;
  
  IF v_split_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Share not found or already paid');
  END IF;
  
  -- Check if all shares are paid
  SELECT COUNT(*) FILTER (WHERE payment_status = 'paid'),
         COUNT(*)
  INTO v_paid_count, v_total_count
  FROM group_split_shares
  WHERE split_payment_id = v_split_id;
  
  -- Update split payment status
  IF v_paid_count = v_total_count THEN
    UPDATE group_split_payments SET
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = v_split_id;
  ELSIF v_paid_count > 0 THEN
    UPDATE group_split_payments SET
      status = 'partial',
      updated_at = NOW()
    WHERE id = v_split_id;
  END IF;
  
  SELECT * INTO v_split FROM group_split_payments WHERE id = v_split_id;
  
  RETURN json_build_object(
    'success', true,
    'paid_count', v_paid_count,
    'total_count', v_total_count,
    'all_paid', v_paid_count = v_total_count,
    'status', v_split.status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Send reminder (just updates the tracking, actual email sent by app)
CREATE OR REPLACE FUNCTION mark_reminder_sent(p_share_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE group_split_shares SET
    reminder_count = reminder_count + 1,
    last_reminder_at = NOW(),
    updated_at = NOW()
  WHERE id = p_share_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire old split payments (run via cron)
CREATE OR REPLACE FUNCTION expire_split_payments()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE group_split_payments 
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'partial') AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE group_split_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE group_split_shares;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION create_split_payment TO authenticated;
GRANT EXECUTE ON FUNCTION get_split_payment TO authenticated;
GRANT EXECUTE ON FUNCTION get_share_by_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_share_payment TO authenticated;
GRANT EXECUTE ON FUNCTION mark_reminder_sent TO authenticated;
