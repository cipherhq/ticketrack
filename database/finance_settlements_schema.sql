-- =====================================================
-- SETTLEMENT REPORTS - Database Schema
-- Per-provider reconciliation (Paystack, Stripe, Flutterwave)
-- =====================================================

-- Provider settlements imported from payment providers
CREATE TABLE IF NOT EXISTS provider_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider info
  provider VARCHAR(20) NOT NULL CHECK (provider IN (
    'stripe', 'paystack', 'flutterwave', 'paypal'
  )),
  settlement_id VARCHAR(100), -- Provider's settlement ID
  settlement_reference VARCHAR(100),

  -- Settlement period
  settlement_date DATE NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,

  -- Provider reported amounts
  provider_gross DECIMAL(15,2),
  provider_fees DECIMAL(15,2),
  provider_refunds DECIMAL(15,2) DEFAULT 0,
  provider_chargebacks DECIMAL(15,2) DEFAULT 0,
  provider_adjustments DECIMAL(15,2) DEFAULT 0,
  provider_net DECIMAL(15,2),

  -- Our calculated amounts
  our_gross DECIMAL(15,2) DEFAULT 0,
  our_fees DECIMAL(15,2) DEFAULT 0,
  our_refunds DECIMAL(15,2) DEFAULT 0,
  our_chargebacks DECIMAL(15,2) DEFAULT 0,
  our_net DECIMAL(15,2) DEFAULT 0,

  -- Currency
  currency VARCHAR(3) NOT NULL,

  -- Reconciliation status
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES auth.users(id),

  -- Discrepancy tracking
  discrepancy DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE(provider_net, 0) - COALESCE(our_net, 0)
  ) STORED,
  discrepancy_resolved BOOLEAN DEFAULT FALSE,
  discrepancy_notes TEXT,

  -- Bank deposit tracking
  bank_deposit_reference VARCHAR(100),
  bank_deposit_date DATE,
  bank_deposit_amount DECIMAL(15,2),
  bank_deposit_matched BOOLEAN DEFAULT FALSE,

  -- Raw data from provider
  raw_data JSONB,
  transaction_count INTEGER DEFAULT 0,

  -- Metadata
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual settlement transactions
CREATE TABLE IF NOT EXISTS settlement_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES provider_settlements(id) ON DELETE CASCADE,

  -- Provider transaction info
  provider_transaction_id VARCHAR(100),
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN (
    'charge',
    'refund',
    'chargeback',
    'chargeback_reversal',
    'fee',
    'adjustment',
    'payout'
  )),

  -- Amounts
  gross_amount DECIMAL(15,2),
  fee_amount DECIMAL(15,2),
  net_amount DECIMAL(15,2),
  currency VARCHAR(3) NOT NULL,

  -- Matching
  order_id UUID REFERENCES orders(id),
  matched BOOLEAN DEFAULT FALSE,
  match_discrepancy DECIMAL(15,2),

  -- Timestamps
  transaction_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlement sync status
CREATE TABLE IF NOT EXISTS settlement_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(20) NOT NULL,
  country_code VARCHAR(2),

  -- Last sync
  last_sync_at TIMESTAMPTZ,
  last_sync_success BOOLEAN,
  last_sync_error TEXT,

  -- Sync range
  last_synced_date DATE,
  next_sync_date DATE,

  -- Config
  sync_enabled BOOLEAN DEFAULT TRUE,
  sync_frequency_hours INTEGER DEFAULT 24,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(provider, country_code)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_settlements_provider ON provider_settlements(provider);
CREATE INDEX IF NOT EXISTS idx_settlements_date ON provider_settlements(settlement_date DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_reconciled ON provider_settlements(is_reconciled);
CREATE INDEX IF NOT EXISTS idx_settlements_currency ON provider_settlements(currency);
CREATE INDEX IF NOT EXISTS idx_settlements_discrepancy ON provider_settlements(discrepancy) WHERE discrepancy != 0;

CREATE INDEX IF NOT EXISTS idx_settlement_tx_settlement ON settlement_transactions(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_tx_type ON settlement_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_settlement_tx_order ON settlement_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_settlement_tx_matched ON settlement_transactions(matched);

CREATE INDEX IF NOT EXISTS idx_settlement_sync_provider ON settlement_sync_status(provider);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE provider_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_sync_status ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages settlements" ON provider_settlements
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages settlement tx" ON settlement_transactions
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages settlement sync" ON settlement_sync_status
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Import settlement from provider
CREATE OR REPLACE FUNCTION import_provider_settlement(
  p_provider VARCHAR,
  p_settlement_id VARCHAR,
  p_settlement_date DATE,
  p_period_start TIMESTAMPTZ,
  p_period_end TIMESTAMPTZ,
  p_provider_gross DECIMAL,
  p_provider_fees DECIMAL,
  p_provider_refunds DECIMAL,
  p_provider_chargebacks DECIMAL,
  p_provider_net DECIMAL,
  p_currency VARCHAR,
  p_raw_data JSONB DEFAULT '{}'
)
RETURNS JSON AS $$
DECLARE
  v_settlement_id UUID;
  v_our_gross DECIMAL := 0;
  v_our_fees DECIMAL := 0;
  v_our_refunds DECIMAL := 0;
  v_our_chargebacks DECIMAL := 0;
  v_our_net DECIMAL := 0;
  v_tx_count INTEGER := 0;
BEGIN
  -- Check if settlement already exists
  SELECT id INTO v_settlement_id FROM provider_settlements
  WHERE provider = p_provider AND settlement_id = p_settlement_id;

  IF v_settlement_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Settlement already imported', 'id', v_settlement_id);
  END IF;

  -- Calculate our totals from orders in this period
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(platform_fee), 0),
    COUNT(*)
  INTO v_our_gross, v_our_fees, v_tx_count
  FROM orders
  WHERE payment_provider = p_provider
    AND currency = p_currency
    AND paid_at BETWEEN p_period_start AND p_period_end
    AND status = 'completed';

  -- Calculate refunds
  SELECT COALESCE(SUM(refund_amount), 0) INTO v_our_refunds
  FROM orders
  WHERE payment_provider = p_provider
    AND currency = p_currency
    AND refunded_at BETWEEN p_period_start AND p_period_end
    AND status = 'refunded';

  -- Calculate chargebacks
  SELECT COALESCE(SUM(disputed_amount), 0) INTO v_our_chargebacks
  FROM chargebacks
  WHERE payment_provider = p_provider
    AND currency = p_currency
    AND opened_at BETWEEN p_period_start AND p_period_end;

  -- Calculate our net
  v_our_net := v_our_gross - v_our_fees - v_our_refunds - v_our_chargebacks;

  -- Insert settlement
  INSERT INTO provider_settlements (
    provider, settlement_id, settlement_date,
    period_start, period_end,
    provider_gross, provider_fees, provider_refunds, provider_chargebacks, provider_net,
    our_gross, our_fees, our_refunds, our_chargebacks, our_net,
    currency, raw_data, transaction_count
  ) VALUES (
    p_provider, p_settlement_id, p_settlement_date,
    p_period_start, p_period_end,
    p_provider_gross, p_provider_fees, p_provider_refunds, p_provider_chargebacks, p_provider_net,
    v_our_gross, v_our_fees, v_our_refunds, v_our_chargebacks, v_our_net,
    p_currency, p_raw_data, v_tx_count
  )
  RETURNING id INTO v_settlement_id;

  -- Update sync status
  INSERT INTO settlement_sync_status (provider, country_code, last_sync_at, last_sync_success, last_synced_date)
  VALUES (p_provider, NULL, NOW(), true, p_settlement_date)
  ON CONFLICT (provider, country_code)
  DO UPDATE SET
    last_sync_at = NOW(),
    last_sync_success = true,
    last_synced_date = p_settlement_date,
    updated_at = NOW();

  RETURN json_build_object(
    'success', true,
    'settlement_id', v_settlement_id,
    'discrepancy', p_provider_net - v_our_net,
    'our_gross', v_our_gross,
    'provider_gross', p_provider_gross
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Match settlement transactions with orders
CREATE OR REPLACE FUNCTION match_settlement_transactions(
  p_settlement_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_matched INTEGER := 0;
  v_unmatched INTEGER := 0;
  v_discrepancy_total DECIMAL := 0;
  v_tx RECORD;
BEGIN
  FOR v_tx IN
    SELECT * FROM settlement_transactions
    WHERE settlement_id = p_settlement_id AND NOT matched
  LOOP
    -- Try to match with order by provider transaction ID
    UPDATE settlement_transactions st SET
      order_id = o.id,
      matched = TRUE,
      match_discrepancy = st.net_amount - (o.total_amount - COALESCE(o.platform_fee, 0))
    FROM orders o
    WHERE st.id = v_tx.id
      AND o.payment_reference = v_tx.provider_transaction_id;

    IF FOUND THEN
      v_matched := v_matched + 1;
    ELSE
      v_unmatched := v_unmatched + 1;
    END IF;
  END LOOP;

  -- Calculate total discrepancy
  SELECT COALESCE(SUM(ABS(match_discrepancy)), 0) INTO v_discrepancy_total
  FROM settlement_transactions
  WHERE settlement_id = p_settlement_id AND match_discrepancy != 0;

  RETURN json_build_object(
    'success', true,
    'matched', v_matched,
    'unmatched', v_unmatched,
    'discrepancy_total', v_discrepancy_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reconcile settlement
CREATE OR REPLACE FUNCTION reconcile_settlement(
  p_settlement_id UUID,
  p_notes TEXT DEFAULT NULL,
  p_reconciled_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_settlement RECORD;
BEGIN
  SELECT * INTO v_settlement FROM provider_settlements WHERE id = p_settlement_id;

  IF v_settlement IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Settlement not found');
  END IF;

  IF v_settlement.is_reconciled THEN
    RETURN json_build_object('success', false, 'error', 'Already reconciled');
  END IF;

  UPDATE provider_settlements SET
    is_reconciled = TRUE,
    reconciled_at = NOW(),
    reconciled_by = p_reconciled_by,
    discrepancy_notes = COALESCE(p_notes, discrepancy_notes),
    discrepancy_resolved = (v_settlement.discrepancy = 0 OR p_notes IS NOT NULL),
    updated_at = NOW()
  WHERE id = p_settlement_id;

  RETURN json_build_object(
    'success', true,
    'settlement_id', p_settlement_id,
    'discrepancy', v_settlement.discrepancy
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get settlement summary
CREATE OR REPLACE FUNCTION get_settlement_summary(
  p_provider VARCHAR DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_currency VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_settlements', COUNT(*),
    'reconciled_count', COUNT(*) FILTER (WHERE is_reconciled),
    'pending_count', COUNT(*) FILTER (WHERE NOT is_reconciled),
    'with_discrepancy', COUNT(*) FILTER (WHERE discrepancy != 0),
    'total_provider_gross', COALESCE(SUM(provider_gross), 0),
    'total_our_gross', COALESCE(SUM(our_gross), 0),
    'total_discrepancy', COALESCE(SUM(discrepancy), 0),
    'by_provider', (
      SELECT json_object_agg(
        provider,
        json_build_object(
          'count', COUNT(*),
          'provider_gross', SUM(provider_gross),
          'our_gross', SUM(our_gross),
          'discrepancy', SUM(discrepancy)
        )
      )
      FROM provider_settlements ps2
      WHERE (p_provider IS NULL OR ps2.provider = p_provider)
        AND (p_start_date IS NULL OR ps2.settlement_date >= p_start_date)
        AND (p_end_date IS NULL OR ps2.settlement_date <= p_end_date)
        AND (p_currency IS NULL OR ps2.currency = p_currency)
      GROUP BY ps2.provider
    )
  ) INTO v_result
  FROM provider_settlements
  WHERE (p_provider IS NULL OR provider = p_provider)
    AND (p_start_date IS NULL OR settlement_date >= p_start_date)
    AND (p_end_date IS NULL OR settlement_date <= p_end_date)
    AND (p_currency IS NULL OR currency = p_currency);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_settlement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER settlements_updated_at
  BEFORE UPDATE ON provider_settlements
  FOR EACH ROW EXECUTE FUNCTION update_settlement_timestamp();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION import_provider_settlement TO service_role;
GRANT EXECUTE ON FUNCTION match_settlement_transactions TO service_role;
GRANT EXECUTE ON FUNCTION reconcile_settlement TO service_role;
GRANT EXECUTE ON FUNCTION get_settlement_summary TO service_role;
