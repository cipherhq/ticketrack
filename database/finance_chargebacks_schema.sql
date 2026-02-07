-- =====================================================
-- CHARGEBACKS/DISPUTES MANAGEMENT - Database Schema
-- Track and manage payment disputes, deduct from organizer balances
-- =====================================================

-- Main chargebacks table
CREATE TABLE IF NOT EXISTS chargebacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Order reference
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES organizers(id),
  event_id UUID REFERENCES events(id),

  -- Payment provider info
  payment_provider VARCHAR(20) NOT NULL CHECK (payment_provider IN (
    'stripe', 'paystack', 'flutterwave', 'paypal'
  )),
  provider_dispute_id VARCHAR(100),
  provider_charge_id VARCHAR(100),

  -- Financial details
  disputed_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  fee_amount DECIMAL(15,2) DEFAULT 0, -- Chargeback fee charged by provider

  -- Status tracking
  status VARCHAR(30) DEFAULT 'opened' CHECK (status IN (
    'opened',             -- Dispute just opened
    'needs_response',     -- Awaiting evidence submission
    'under_review',       -- Evidence submitted, under review
    'won',                -- Dispute won, funds returned
    'lost',               -- Dispute lost, funds forfeited
    'closed',             -- Closed without action
    'withdrawn'           -- Customer withdrew dispute
  )),

  -- Reason
  reason VARCHAR(100),
  reason_code VARCHAR(50),
  reason_description TEXT,

  -- Evidence
  evidence_due_by TIMESTAMPTZ,
  evidence_submitted_at TIMESTAMPTZ,
  evidence_documents JSONB DEFAULT '[]',

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution VARCHAR(20) CHECK (resolution IN ('won', 'lost', 'withdrawn')),
  resolution_reason TEXT,

  -- Balance impact
  deducted_from_balance BOOLEAN DEFAULT FALSE,
  deducted_amount DECIMAL(15,2),
  deducted_at TIMESTAMPTZ,
  escrow_id UUID,

  -- If recovered (won)
  recovered_at TIMESTAMPTZ,
  recovered_amount DECIMAL(15,2),

  -- Metadata
  provider_data JSONB DEFAULT '{}',
  internal_notes TEXT,

  -- Timestamps
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chargeback evidence documents
CREATE TABLE IF NOT EXISTS chargeback_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chargeback_id UUID NOT NULL REFERENCES chargebacks(id) ON DELETE CASCADE,

  -- Document info
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'receipt',
    'invoice',
    'customer_communication',
    'refund_policy',
    'terms_of_service',
    'tracking_number',
    'delivery_confirmation',
    'customer_signature',
    'event_proof',
    'ticket_scan_log',
    'other'
  )),
  document_name VARCHAR(255),
  file_path TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),

  -- Content (for text evidence)
  content TEXT,

  -- Metadata
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chargeback activity log
CREATE TABLE IF NOT EXISTS chargeback_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chargeback_id UUID NOT NULL REFERENCES chargebacks(id) ON DELETE CASCADE,

  activity_type VARCHAR(50) NOT NULL,
  description TEXT,
  old_status VARCHAR(30),
  new_status VARCHAR(30),

  performed_by UUID REFERENCES auth.users(id),
  performed_by_type VARCHAR(20) DEFAULT 'system', -- system, admin, webhook

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chargeback thresholds and alerts
CREATE TABLE IF NOT EXISTS chargeback_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Threshold type
  threshold_type VARCHAR(30) NOT NULL CHECK (threshold_type IN (
    'rate',           -- Chargeback rate (%)
    'count',          -- Total count per period
    'amount'          -- Total amount per period
  )),

  -- Values
  warning_threshold DECIMAL(10,4),
  critical_threshold DECIMAL(10,4),

  -- Period
  period_days INTEGER DEFAULT 30,
  currency VARCHAR(3),

  -- Alert settings
  alert_emails TEXT[], -- Email addresses to notify
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizer chargeback stats
CREATE TABLE IF NOT EXISTS organizer_chargeback_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Stats
  total_orders INTEGER DEFAULT 0,
  total_order_amount DECIMAL(15,2) DEFAULT 0,
  chargeback_count INTEGER DEFAULT 0,
  chargeback_amount DECIMAL(15,2) DEFAULT 0,
  chargeback_rate DECIMAL(6,4) GENERATED ALWAYS AS (
    CASE WHEN total_orders > 0
      THEN (chargeback_count::DECIMAL / total_orders::DECIMAL) * 100
      ELSE 0
    END
  ) STORED,

  -- Outcomes
  won_count INTEGER DEFAULT 0,
  lost_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,

  -- Status
  is_high_risk BOOLEAN DEFAULT FALSE,
  risk_level VARCHAR(20) DEFAULT 'normal',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organizer_id, currency, period_start, period_end)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_chargebacks_order ON chargebacks(order_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_organizer ON chargebacks(organizer_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_event ON chargebacks(event_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_status ON chargebacks(status);
CREATE INDEX IF NOT EXISTS idx_chargebacks_provider ON chargebacks(payment_provider);
CREATE INDEX IF NOT EXISTS idx_chargebacks_provider_id ON chargebacks(provider_dispute_id);
CREATE INDEX IF NOT EXISTS idx_chargebacks_opened ON chargebacks(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_chargebacks_evidence_due ON chargebacks(evidence_due_by) WHERE status = 'needs_response';

CREATE INDEX IF NOT EXISTS idx_chargeback_evidence_cb ON chargeback_evidence(chargeback_id);
CREATE INDEX IF NOT EXISTS idx_chargeback_activity_cb ON chargeback_activity_log(chargeback_id);

CREATE INDEX IF NOT EXISTS idx_organizer_cb_stats_org ON organizer_chargeback_stats(organizer_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE chargebacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chargeback_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE chargeback_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE chargeback_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_chargeback_stats ENABLE ROW LEVEL SECURITY;

-- Organizers can view their chargebacks
CREATE POLICY "Organizers view own chargebacks" ON chargebacks
  FOR SELECT USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Organizers can submit evidence
CREATE POLICY "Organizers submit chargeback evidence" ON chargeback_evidence
  FOR INSERT WITH CHECK (
    chargeback_id IN (
      SELECT id FROM chargebacks WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Organizers view own chargeback evidence" ON chargeback_evidence
  FOR SELECT USING (
    chargeback_id IN (
      SELECT id FROM chargebacks WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role full access
CREATE POLICY "Service role manages chargebacks" ON chargebacks
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages cb evidence" ON chargeback_evidence
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages cb activity" ON chargeback_activity_log
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages cb thresholds" ON chargeback_thresholds
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages cb stats" ON organizer_chargeback_stats
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Create chargeback from webhook
CREATE OR REPLACE FUNCTION create_chargeback_from_webhook(
  p_provider VARCHAR,
  p_provider_dispute_id VARCHAR,
  p_provider_charge_id VARCHAR,
  p_order_id UUID,
  p_disputed_amount DECIMAL,
  p_currency VARCHAR,
  p_reason VARCHAR,
  p_reason_code VARCHAR,
  p_evidence_due_by TIMESTAMPTZ,
  p_provider_data JSONB DEFAULT '{}'
)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_event RECORD;
  v_chargeback_id UUID;
  v_escrow_id UUID;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    -- Try to find by payment reference
    SELECT * INTO v_order FROM orders
    WHERE payment_reference = p_provider_charge_id
    LIMIT 1;
  END IF;

  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Check if chargeback already exists
  SELECT id INTO v_chargeback_id FROM chargebacks
  WHERE provider_dispute_id = p_provider_dispute_id;

  IF v_chargeback_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'chargeback_id', v_chargeback_id, 'message', 'Already exists');
  END IF;

  -- Get event details
  SELECT * INTO v_event FROM events WHERE id = v_order.event_id;

  -- Create chargeback
  INSERT INTO chargebacks (
    order_id, organizer_id, event_id,
    payment_provider, provider_dispute_id, provider_charge_id,
    disputed_amount, currency,
    status, reason, reason_code,
    evidence_due_by, provider_data
  ) VALUES (
    v_order.id, v_event.organizer_id, v_event.id,
    p_provider, p_provider_dispute_id, p_provider_charge_id,
    p_disputed_amount, p_currency,
    'needs_response', p_reason, p_reason_code,
    p_evidence_due_by, p_provider_data
  )
  RETURNING id INTO v_chargeback_id;

  -- Log activity
  INSERT INTO chargeback_activity_log (
    chargeback_id, activity_type, description, new_status, performed_by_type
  ) VALUES (
    v_chargeback_id, 'chargeback_opened',
    'Chargeback opened via ' || p_provider || ' webhook',
    'needs_response', 'webhook'
  );

  -- Deduct from escrow if exists
  SELECT id INTO v_escrow_id FROM escrow_balances
  WHERE organizer_id = v_event.organizer_id
    AND event_id = v_event.id
    AND currency = p_currency
    AND status IN ('pending', 'eligible');

  IF v_escrow_id IS NOT NULL THEN
    UPDATE escrow_balances SET
      chargebacks_held = chargebacks_held + p_disputed_amount,
      status = 'disputed',
      updated_at = NOW()
    WHERE id = v_escrow_id;

    UPDATE chargebacks SET
      deducted_from_balance = TRUE,
      deducted_amount = p_disputed_amount,
      deducted_at = NOW(),
      escrow_id = v_escrow_id
    WHERE id = v_chargeback_id;

    -- Log escrow transaction
    INSERT INTO escrow_transactions (
      escrow_id, transaction_type, amount, currency,
      chargeback_id, description
    ) VALUES (
      v_escrow_id, 'debit_chargeback', p_disputed_amount, p_currency,
      v_chargeback_id, 'Chargeback hold for dispute ' || p_provider_dispute_id
    );
  END IF;

  -- Log financial transaction
  PERFORM log_financial_transaction(
    'chargeback_debit', 'chargeback', v_chargeback_id,
    v_event.organizer_id, v_event.id, v_order.id,
    p_disputed_amount, 0, p_currency,
    p_provider, p_provider_dispute_id,
    'Chargeback opened: ' || p_reason
  );

  RETURN json_build_object(
    'success', true,
    'chargeback_id', v_chargeback_id,
    'order_id', v_order.id,
    'organizer_id', v_event.organizer_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update chargeback status
CREATE OR REPLACE FUNCTION update_chargeback_status(
  p_chargeback_id UUID,
  p_new_status VARCHAR,
  p_resolution VARCHAR DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_chargeback RECORD;
  v_old_status VARCHAR;
BEGIN
  SELECT * INTO v_chargeback FROM chargebacks WHERE id = p_chargeback_id;
  IF v_chargeback IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Chargeback not found');
  END IF;

  v_old_status := v_chargeback.status;

  -- Update chargeback
  UPDATE chargebacks SET
    status = p_new_status,
    resolution = COALESCE(p_resolution, resolution),
    resolved_at = CASE WHEN p_new_status IN ('won', 'lost', 'closed', 'withdrawn') THEN NOW() ELSE resolved_at END,
    resolution_reason = COALESCE(p_notes, resolution_reason),
    updated_at = NOW()
  WHERE id = p_chargeback_id;

  -- Log activity
  INSERT INTO chargeback_activity_log (
    chargeback_id, activity_type, description,
    old_status, new_status, performed_by_type
  ) VALUES (
    p_chargeback_id, 'status_changed',
    COALESCE(p_notes, 'Status changed from ' || v_old_status || ' to ' || p_new_status),
    v_old_status, p_new_status, 'system'
  );

  -- Handle resolution
  IF p_new_status = 'won' AND v_chargeback.escrow_id IS NOT NULL THEN
    -- Return funds to escrow
    UPDATE escrow_balances SET
      chargebacks_held = chargebacks_held - v_chargeback.disputed_amount,
      status = CASE
        WHEN chargebacks_held - v_chargeback.disputed_amount <= 0 THEN 'eligible'
        ELSE 'disputed'
      END,
      updated_at = NOW()
    WHERE id = v_chargeback.escrow_id;

    UPDATE chargebacks SET
      recovered_at = NOW(),
      recovered_amount = v_chargeback.disputed_amount
    WHERE id = p_chargeback_id;

    -- Log escrow transaction
    INSERT INTO escrow_transactions (
      escrow_id, transaction_type, amount, currency,
      chargeback_id, description
    ) VALUES (
      v_chargeback.escrow_id, 'credit_chargeback_won', v_chargeback.disputed_amount, v_chargeback.currency,
      p_chargeback_id, 'Chargeback won - funds returned'
    );

    -- Log financial transaction
    PERFORM log_financial_transaction(
      'chargeback_reversal', 'chargeback', p_chargeback_id,
      v_chargeback.organizer_id, v_chargeback.event_id, v_chargeback.order_id,
      0, v_chargeback.disputed_amount, v_chargeback.currency,
      v_chargeback.payment_provider, v_chargeback.provider_dispute_id,
      'Chargeback won - funds returned'
    );
  END IF;

  RETURN json_build_object('success', true, 'old_status', v_old_status, 'new_status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get chargeback summary for organizer
CREATE OR REPLACE FUNCTION get_organizer_chargeback_summary(
  p_organizer_id UUID,
  p_period_days INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_count', COUNT(*),
    'pending_count', COUNT(*) FILTER (WHERE status IN ('opened', 'needs_response', 'under_review')),
    'won_count', COUNT(*) FILTER (WHERE status = 'won'),
    'lost_count', COUNT(*) FILTER (WHERE status = 'lost'),
    'total_disputed', COALESCE(SUM(disputed_amount), 0),
    'pending_amount', COALESCE(SUM(disputed_amount) FILTER (WHERE status IN ('opened', 'needs_response', 'under_review')), 0),
    'lost_amount', COALESCE(SUM(disputed_amount) FILTER (WHERE status = 'lost'), 0),
    'won_amount', COALESCE(SUM(disputed_amount) FILTER (WHERE status = 'won'), 0),
    'needs_response', (
      SELECT json_agg(row_to_json(c.*))
      FROM chargebacks c
      WHERE c.organizer_id = p_organizer_id
        AND c.status = 'needs_response'
        AND c.evidence_due_by > NOW()
      ORDER BY c.evidence_due_by ASC
      LIMIT 5
    )
  ) INTO v_result
  FROM chargebacks
  WHERE organizer_id = p_organizer_id
    AND opened_at > NOW() - (p_period_days || ' days')::INTERVAL;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_chargeback_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chargebacks_updated_at
  BEFORE UPDATE ON chargebacks
  FOR EACH ROW EXECUTE FUNCTION update_chargeback_timestamp();

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default chargeback thresholds
INSERT INTO chargeback_thresholds (threshold_type, warning_threshold, critical_threshold, period_days, is_active)
VALUES
  ('rate', 0.5, 1.0, 30, true),     -- 0.5% warning, 1% critical
  ('count', 5, 10, 30, true),        -- 5 warning, 10 critical per month
  ('amount', 10000, 50000, 30, true) -- Currency-agnostic thresholds
ON CONFLICT DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION create_chargeback_from_webhook TO service_role;
GRANT EXECUTE ON FUNCTION update_chargeback_status TO service_role;
GRANT EXECUTE ON FUNCTION get_organizer_chargeback_summary TO authenticated;
