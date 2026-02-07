-- =====================================================
-- ESCROW MANAGEMENT - Database Schema
-- Tracks funds held in escrow before organizer payouts
-- =====================================================

-- Escrow tracking table
-- Holds funds per organizer/event until payout eligibility
CREATE TABLE IF NOT EXISTS escrow_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  currency VARCHAR(3) NOT NULL,

  -- Financial amounts
  gross_amount DECIMAL(15,2) DEFAULT 0,
  platform_fees DECIMAL(15,2) DEFAULT 0,
  promoter_commissions DECIMAL(15,2) DEFAULT 0,
  affiliate_commissions DECIMAL(15,2) DEFAULT 0,
  chargebacks_held DECIMAL(15,2) DEFAULT 0,
  refunds_processed DECIMAL(15,2) DEFAULT 0,

  -- Calculated balance (available for payout)
  available_balance DECIMAL(15,2) GENERATED ALWAYS AS (
    gross_amount - platform_fees - promoter_commissions - affiliate_commissions - chargebacks_held - refunds_processed
  ) STORED,

  -- Payout eligibility
  payout_eligible_at TIMESTAMPTZ,
  payout_delay_days INTEGER DEFAULT 3,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Funds accumulating
    'hold',         -- Manual hold (e.g., fraud investigation)
    'eligible',     -- Ready for payout
    'processing',   -- Payout in progress
    'paid',         -- Fully paid out
    'disputed'      -- Has active chargebacks
  )),
  hold_reason TEXT,
  held_by UUID REFERENCES auth.users(id),
  held_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escrow transactions log
-- Tracks all movements in/out of escrow
CREATE TABLE IF NOT EXISTS escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID NOT NULL REFERENCES escrow_balances(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'credit_sale',           -- Ticket sale credited
    'debit_platform_fee',    -- Platform fee deducted
    'debit_promoter_comm',   -- Promoter commission deducted
    'debit_affiliate_comm',  -- Affiliate commission deducted
    'debit_refund',          -- Refund processed
    'debit_chargeback',      -- Chargeback deducted
    'credit_chargeback_won', -- Chargeback reversed (won)
    'debit_payout',          -- Payout to organizer
    'adjustment'             -- Manual adjustment
  )),

  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,
  running_balance DECIMAL(15,2),

  -- References
  order_id UUID REFERENCES orders(id),
  payout_id UUID,
  chargeback_id UUID,

  description TEXT,
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payout queue for automated processing
CREATE TABLE IF NOT EXISTS payout_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID REFERENCES escrow_balances(id),
  organizer_id UUID NOT NULL REFERENCES organizers(id),
  event_id UUID REFERENCES events(id),

  -- Payout details
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,

  -- Processing priority (1 = highest)
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

  -- Payment method
  payment_provider VARCHAR(20),
  recipient_code VARCHAR(100),
  bank_account_id UUID,

  -- Status tracking
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN (
    'queued',       -- Waiting to be processed
    'processing',   -- Being processed
    'pending',      -- Sent to provider, awaiting confirmation
    'completed',    -- Successfully paid
    'failed',       -- Payment failed
    'cancelled',    -- Manually cancelled
    'on_hold'       -- Requires manual review
  )),

  -- Approval workflow
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_status VARCHAR(20),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  -- Retry handling
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  failure_reason TEXT,

  -- Provider response
  provider_reference VARCHAR(100),
  provider_response JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_escrow_organizer ON escrow_balances(organizer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_event ON escrow_balances(event_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_balances(status);
CREATE INDEX IF NOT EXISTS idx_escrow_eligible ON escrow_balances(payout_eligible_at) WHERE status = 'eligible';
CREATE INDEX IF NOT EXISTS idx_escrow_currency ON escrow_balances(currency);

CREATE INDEX IF NOT EXISTS idx_escrow_tx_escrow ON escrow_transactions(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_type ON escrow_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_order ON escrow_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_tx_date ON escrow_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payout_queue_status ON payout_queue(status);
CREATE INDEX IF NOT EXISTS idx_payout_queue_organizer ON payout_queue(organizer_id);
CREATE INDEX IF NOT EXISTS idx_payout_queue_scheduled ON payout_queue(scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_payout_queue_retry ON payout_queue(next_retry_at) WHERE status = 'failed' AND retry_count < max_retries;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE escrow_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_queue ENABLE ROW LEVEL SECURITY;

-- Organizers can view their own escrow balances
CREATE POLICY "Organizers can view their escrow" ON escrow_balances
  FOR SELECT USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Organizers can view their escrow transactions
CREATE POLICY "Organizers can view their escrow transactions" ON escrow_transactions
  FOR SELECT USING (
    escrow_id IN (
      SELECT id FROM escrow_balances WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Organizers can view their payout queue
CREATE POLICY "Organizers can view their payout queue" ON payout_queue
  FOR SELECT USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "Service role manages escrow" ON escrow_balances
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages escrow transactions" ON escrow_transactions
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages payout queue" ON payout_queue
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Get or create escrow balance for an organizer/event
CREATE OR REPLACE FUNCTION get_or_create_escrow(
  p_organizer_id UUID,
  p_event_id UUID,
  p_currency VARCHAR
)
RETURNS UUID AS $$
DECLARE
  v_escrow_id UUID;
  v_event RECORD;
  v_delay_days INTEGER;
BEGIN
  -- Check for existing escrow
  SELECT id INTO v_escrow_id
  FROM escrow_balances
  WHERE organizer_id = p_organizer_id
    AND (event_id = p_event_id OR (event_id IS NULL AND p_event_id IS NULL))
    AND currency = p_currency;

  IF v_escrow_id IS NOT NULL THEN
    RETURN v_escrow_id;
  END IF;

  -- Calculate payout delay based on event
  IF p_event_id IS NOT NULL THEN
    SELECT * INTO v_event FROM events WHERE id = p_event_id;
    -- Larger events get longer delay
    v_delay_days := CASE
      WHEN v_event.event_type = 'concert' THEN 7
      WHEN v_event.event_type = 'conference' THEN 5
      WHEN v_event.event_type = 'webinar' THEN 0
      ELSE 3
    END;
  ELSE
    v_delay_days := 3;
  END IF;

  -- Create new escrow
  INSERT INTO escrow_balances (
    organizer_id, event_id, currency, payout_delay_days
  ) VALUES (
    p_organizer_id, p_event_id, p_currency, v_delay_days
  )
  RETURNING id INTO v_escrow_id;

  RETURN v_escrow_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Credit escrow from a completed order
CREATE OR REPLACE FUNCTION credit_escrow_from_order(
  p_order_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_event RECORD;
  v_escrow_id UUID;
  v_platform_fee DECIMAL;
  v_promoter_comm DECIMAL;
  v_affiliate_comm DECIMAL;
BEGIN
  -- Get order details
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Get event details
  SELECT * INTO v_event FROM events WHERE id = v_order.event_id;
  IF v_event IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Get or create escrow
  v_escrow_id := get_or_create_escrow(v_event.organizer_id, v_event.id, v_order.currency);

  -- Calculate fees
  v_platform_fee := COALESCE(v_order.platform_fee, 0);

  -- Get promoter commission if applicable
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_promoter_comm
  FROM promoter_sales WHERE order_id = p_order_id;

  -- Get affiliate commission if applicable
  SELECT COALESCE(SUM(commission_amount), 0) INTO v_affiliate_comm
  FROM affiliate_commissions WHERE order_id = p_order_id;

  -- Update escrow balance
  UPDATE escrow_balances SET
    gross_amount = gross_amount + v_order.total_amount,
    platform_fees = platform_fees + v_platform_fee,
    promoter_commissions = promoter_commissions + v_promoter_comm,
    affiliate_commissions = affiliate_commissions + v_affiliate_comm,
    updated_at = NOW()
  WHERE id = v_escrow_id;

  -- Log the transaction
  INSERT INTO escrow_transactions (
    escrow_id, transaction_type, amount, currency, order_id, description
  ) VALUES (
    v_escrow_id, 'credit_sale', v_order.total_amount, v_order.currency, p_order_id,
    'Sale from order ' || v_order.order_number
  );

  -- Log fee deductions
  IF v_platform_fee > 0 THEN
    INSERT INTO escrow_transactions (
      escrow_id, transaction_type, amount, currency, order_id, description
    ) VALUES (
      v_escrow_id, 'debit_platform_fee', v_platform_fee, v_order.currency, p_order_id,
      'Platform fee for order ' || v_order.order_number
    );
  END IF;

  IF v_promoter_comm > 0 THEN
    INSERT INTO escrow_transactions (
      escrow_id, transaction_type, amount, currency, order_id, description
    ) VALUES (
      v_escrow_id, 'debit_promoter_comm', v_promoter_comm, v_order.currency, p_order_id,
      'Promoter commission for order ' || v_order.order_number
    );
  END IF;

  IF v_affiliate_comm > 0 THEN
    INSERT INTO escrow_transactions (
      escrow_id, transaction_type, amount, currency, order_id, description
    ) VALUES (
      v_escrow_id, 'debit_affiliate_comm', v_affiliate_comm, v_order.currency, p_order_id,
      'Affiliate commission for order ' || v_order.order_number
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'escrow_id', v_escrow_id,
    'gross_credited', v_order.total_amount,
    'platform_fee', v_platform_fee,
    'promoter_commission', v_promoter_comm,
    'affiliate_commission', v_affiliate_comm
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark escrow as eligible for payout
CREATE OR REPLACE FUNCTION update_escrow_eligibility()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Update escrow balances where event has ended and delay period passed
  UPDATE escrow_balances eb SET
    status = 'eligible',
    payout_eligible_at = NOW(),
    updated_at = NOW()
  FROM events e
  WHERE eb.event_id = e.id
    AND eb.status = 'pending'
    AND e.end_date IS NOT NULL
    AND e.end_date + (eb.payout_delay_days || ' days')::INTERVAL < NOW()
    AND eb.available_balance > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Queue payout from escrow
CREATE OR REPLACE FUNCTION queue_payout_from_escrow(
  p_escrow_id UUID,
  p_amount DECIMAL DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_escrow RECORD;
  v_organizer RECORD;
  v_payout_amount DECIMAL;
  v_queue_id UUID;
  v_requires_approval BOOLEAN := FALSE;
BEGIN
  -- Get escrow details
  SELECT * INTO v_escrow FROM escrow_balances WHERE id = p_escrow_id;
  IF v_escrow IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Escrow not found');
  END IF;

  IF v_escrow.status NOT IN ('eligible', 'pending') THEN
    RETURN json_build_object('success', false, 'error', 'Escrow not eligible for payout');
  END IF;

  -- Determine payout amount
  v_payout_amount := COALESCE(p_amount, v_escrow.available_balance);

  IF v_payout_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'No funds available for payout');
  END IF;

  IF v_payout_amount > v_escrow.available_balance THEN
    RETURN json_build_object('success', false, 'error', 'Requested amount exceeds available balance');
  END IF;

  -- Get organizer details
  SELECT * INTO v_organizer FROM organizers WHERE id = v_escrow.organizer_id;

  -- Check if approval required (large amounts)
  SELECT COALESCE(
    (SELECT threshold_amount FROM payout_approval_thresholds
     WHERE currency = v_escrow.currency
     ORDER BY threshold_amount DESC LIMIT 1),
    1000000
  ) INTO v_requires_approval;

  v_requires_approval := v_payout_amount >= v_requires_approval;

  -- Determine payment provider
  DECLARE
    v_provider VARCHAR(20);
    v_recipient_code VARCHAR(100);
  BEGIN
    IF v_organizer.stripe_connect_id IS NOT NULL AND v_organizer.stripe_connect_status = 'active' THEN
      v_provider := 'stripe';
      v_recipient_code := v_organizer.stripe_connect_id;
    ELSIF v_organizer.paystack_subaccount_id IS NOT NULL THEN
      v_provider := 'paystack';
      v_recipient_code := v_organizer.paystack_recipient_code;
    ELSIF v_organizer.flutterwave_subaccount_id IS NOT NULL THEN
      v_provider := 'flutterwave';
      v_recipient_code := v_organizer.flutterwave_subaccount_id;
    ELSE
      v_provider := 'manual';
    END IF;

    -- Create payout queue entry
    INSERT INTO payout_queue (
      escrow_id, organizer_id, event_id, amount, currency,
      payment_provider, recipient_code, requires_approval,
      status, scheduled_for
    ) VALUES (
      p_escrow_id, v_escrow.organizer_id, v_escrow.event_id, v_payout_amount, v_escrow.currency,
      v_provider, v_recipient_code, v_requires_approval,
      CASE WHEN v_requires_approval THEN 'on_hold' ELSE 'queued' END,
      NOW()
    )
    RETURNING id INTO v_queue_id;
  END;

  -- Update escrow status
  UPDATE escrow_balances SET
    status = 'processing',
    updated_at = NOW()
  WHERE id = p_escrow_id;

  RETURN json_build_object(
    'success', true,
    'queue_id', v_queue_id,
    'amount', v_payout_amount,
    'currency', v_escrow.currency,
    'requires_approval', v_requires_approval
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_escrow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER escrow_balances_updated_at
  BEFORE UPDATE ON escrow_balances
  FOR EACH ROW EXECUTE FUNCTION update_escrow_updated_at();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION get_or_create_escrow TO authenticated;
GRANT EXECUTE ON FUNCTION credit_escrow_from_order TO service_role;
GRANT EXECUTE ON FUNCTION update_escrow_eligibility TO service_role;
GRANT EXECUTE ON FUNCTION queue_payout_from_escrow TO service_role;
