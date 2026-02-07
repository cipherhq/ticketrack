-- =====================================================
-- FINANCIAL AUDIT LOG - Database Schema
-- Complete trail of all financial movements
-- =====================================================

-- Main financial transactions log
CREATE TABLE IF NOT EXISTS financial_transactions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Transaction classification
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
    -- Revenue
    'ticket_sale',
    'donation',
    'merchandise_sale',
    'addon_sale',
    'group_booking',

    -- Fees
    'platform_fee_collected',
    'payment_processor_fee',
    'fast_payout_fee',
    'refund_fee',

    -- Commissions
    'promoter_commission',
    'affiliate_commission',

    -- Payouts
    'organizer_payout',
    'promoter_payout',
    'affiliate_payout',

    -- Refunds & Disputes
    'refund_issued',
    'chargeback_debit',
    'chargeback_reversal',

    -- Adjustments
    'manual_adjustment',
    'currency_conversion',
    'bank_reconciliation'
  )),

  -- Reference tracking
  reference_type VARCHAR(50), -- order, payout, chargeback, adjustment, etc.
  reference_id UUID,

  -- Entity associations
  organizer_id UUID REFERENCES organizers(id),
  event_id UUID REFERENCES events(id),
  order_id UUID REFERENCES orders(id),

  -- Financial details
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) NOT NULL,
  running_balance DECIMAL(15,2),

  -- Exchange rate (for multi-currency)
  exchange_rate DECIMAL(15,6),
  original_currency VARCHAR(3),
  original_amount DECIMAL(15,2),

  -- Payment provider info
  payment_provider VARCHAR(20),
  provider_reference VARCHAR(100),
  provider_fee DECIMAL(15,2),

  -- Description
  description TEXT,
  internal_notes TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Audit info
  created_by UUID REFERENCES auth.users(id),
  created_by_type VARCHAR(20) DEFAULT 'system', -- system, admin, user
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily ledger summary for quick reporting
CREATE TABLE IF NOT EXISTS daily_ledger_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL,

  -- Revenue
  gross_revenue DECIMAL(15,2) DEFAULT 0,
  ticket_sales DECIMAL(15,2) DEFAULT 0,
  donations DECIMAL(15,2) DEFAULT 0,
  other_revenue DECIMAL(15,2) DEFAULT 0,

  -- Platform income
  platform_fees DECIMAL(15,2) DEFAULT 0,
  fast_payout_fees DECIMAL(15,2) DEFAULT 0,
  refund_fees DECIMAL(15,2) DEFAULT 0,

  -- Costs
  payment_processor_fees DECIMAL(15,2) DEFAULT 0,
  refunds_issued DECIMAL(15,2) DEFAULT 0,
  chargebacks DECIMAL(15,2) DEFAULT 0,

  -- Commissions paid
  promoter_commissions DECIMAL(15,2) DEFAULT 0,
  affiliate_commissions DECIMAL(15,2) DEFAULT 0,

  -- Payouts
  organizer_payouts DECIMAL(15,2) DEFAULT 0,

  -- Counts
  order_count INTEGER DEFAULT 0,
  refund_count INTEGER DEFAULT 0,
  chargeback_count INTEGER DEFAULT 0,
  payout_count INTEGER DEFAULT 0,

  -- Net
  net_revenue DECIMAL(15,2) GENERATED ALWAYS AS (
    platform_fees + fast_payout_fees + refund_fees - payment_processor_fees
  ) STORED,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(ledger_date, currency)
);

-- Account ledger for double-entry bookkeeping
CREATE TABLE IF NOT EXISTS account_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  account_code VARCHAR(20) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK (account_type IN (
    'asset',
    'liability',
    'equity',
    'revenue',
    'expense'
  )),

  -- Balance
  balance DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',

  -- Parent account for hierarchy
  parent_account_id UUID REFERENCES account_ledger(id),

  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(account_code, currency)
);

-- Ledger entries for double-entry
CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Journal entry reference
  journal_entry_id UUID NOT NULL,
  entry_date DATE NOT NULL,

  -- Account
  account_id UUID NOT NULL REFERENCES account_ledger(id),

  -- Double-entry
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,

  -- Reference
  transaction_log_id UUID REFERENCES financial_transactions_log(id),
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fin_tx_log_type ON financial_transactions_log(transaction_type);
CREATE INDEX IF NOT EXISTS idx_fin_tx_log_ref ON financial_transactions_log(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_log_organizer ON financial_transactions_log(organizer_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_log_event ON financial_transactions_log(event_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_log_order ON financial_transactions_log(order_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_log_date ON financial_transactions_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_tx_log_currency ON financial_transactions_log(currency);
CREATE INDEX IF NOT EXISTS idx_fin_tx_log_provider ON financial_transactions_log(payment_provider);

CREATE INDEX IF NOT EXISTS idx_daily_ledger_date ON daily_ledger_summary(ledger_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_ledger_currency ON daily_ledger_summary(currency);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_journal ON ledger_entries(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_date ON ledger_entries(entry_date DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE financial_transactions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_ledger_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- Organizers can view their own transactions
CREATE POLICY "Organizers view own transactions" ON financial_transactions_log
  FOR SELECT USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Service role has full access
CREATE POLICY "Service role manages fin tx log" ON financial_transactions_log
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages daily ledger" ON daily_ledger_summary
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages account ledger" ON account_ledger
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages ledger entries" ON ledger_entries
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Log a financial transaction
CREATE OR REPLACE FUNCTION log_financial_transaction(
  p_transaction_type VARCHAR,
  p_reference_type VARCHAR,
  p_reference_id UUID,
  p_organizer_id UUID,
  p_event_id UUID,
  p_order_id UUID,
  p_debit_amount DECIMAL,
  p_credit_amount DECIMAL,
  p_currency VARCHAR,
  p_payment_provider VARCHAR,
  p_provider_reference VARCHAR,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO financial_transactions_log (
    transaction_type, reference_type, reference_id,
    organizer_id, event_id, order_id,
    debit_amount, credit_amount, currency,
    payment_provider, provider_reference,
    description, metadata,
    created_by_type
  ) VALUES (
    p_transaction_type, p_reference_type, p_reference_id,
    p_organizer_id, p_event_id, p_order_id,
    p_debit_amount, p_credit_amount, p_currency,
    p_payment_provider, p_provider_reference,
    p_description, p_metadata,
    'system'
  )
  RETURNING id INTO v_log_id;

  -- Update daily ledger summary
  PERFORM update_daily_ledger_summary(
    CURRENT_DATE,
    p_currency,
    p_transaction_type,
    COALESCE(p_credit_amount, 0) - COALESCE(p_debit_amount, 0)
  );

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update daily ledger summary
CREATE OR REPLACE FUNCTION update_daily_ledger_summary(
  p_date DATE,
  p_currency VARCHAR,
  p_transaction_type VARCHAR,
  p_amount DECIMAL
)
RETURNS VOID AS $$
BEGIN
  -- Insert or get existing record
  INSERT INTO daily_ledger_summary (ledger_date, currency)
  VALUES (p_date, p_currency)
  ON CONFLICT (ledger_date, currency) DO NOTHING;

  -- Update the appropriate column
  CASE p_transaction_type
    WHEN 'ticket_sale' THEN
      UPDATE daily_ledger_summary
      SET ticket_sales = ticket_sales + p_amount,
          gross_revenue = gross_revenue + p_amount,
          order_count = order_count + 1,
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'donation' THEN
      UPDATE daily_ledger_summary
      SET donations = donations + p_amount,
          gross_revenue = gross_revenue + p_amount,
          order_count = order_count + 1,
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'platform_fee_collected' THEN
      UPDATE daily_ledger_summary
      SET platform_fees = platform_fees + p_amount,
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'payment_processor_fee' THEN
      UPDATE daily_ledger_summary
      SET payment_processor_fees = payment_processor_fees + ABS(p_amount),
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'refund_issued' THEN
      UPDATE daily_ledger_summary
      SET refunds_issued = refunds_issued + ABS(p_amount),
          refund_count = refund_count + 1,
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'chargeback_debit' THEN
      UPDATE daily_ledger_summary
      SET chargebacks = chargebacks + ABS(p_amount),
          chargeback_count = chargeback_count + 1,
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'organizer_payout' THEN
      UPDATE daily_ledger_summary
      SET organizer_payouts = organizer_payouts + ABS(p_amount),
          payout_count = payout_count + 1,
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'promoter_commission' THEN
      UPDATE daily_ledger_summary
      SET promoter_commissions = promoter_commissions + ABS(p_amount),
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    WHEN 'affiliate_commission' THEN
      UPDATE daily_ledger_summary
      SET affiliate_commissions = affiliate_commissions + ABS(p_amount),
          updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;

    ELSE
      -- For other types, just update timestamp
      UPDATE daily_ledger_summary
      SET updated_at = NOW()
      WHERE ledger_date = p_date AND currency = p_currency;
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get transaction summary for date range
CREATE OR REPLACE FUNCTION get_transaction_summary(
  p_start_date DATE,
  p_end_date DATE,
  p_currency VARCHAR DEFAULT NULL,
  p_organizer_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(credit_amount) FILTER (WHERE transaction_type IN ('ticket_sale', 'donation')), 0),
    'total_fees', COALESCE(SUM(credit_amount) FILTER (WHERE transaction_type = 'platform_fee_collected'), 0),
    'total_refunds', COALESCE(SUM(debit_amount) FILTER (WHERE transaction_type = 'refund_issued'), 0),
    'total_chargebacks', COALESCE(SUM(debit_amount) FILTER (WHERE transaction_type = 'chargeback_debit'), 0),
    'total_payouts', COALESCE(SUM(debit_amount) FILTER (WHERE transaction_type = 'organizer_payout'), 0),
    'transaction_count', COUNT(*),
    'by_type', json_object_agg(
      transaction_type,
      json_build_object(
        'count', COUNT(*),
        'total_debit', SUM(debit_amount),
        'total_credit', SUM(credit_amount)
      )
    )
  ) INTO v_result
  FROM financial_transactions_log
  WHERE created_at::DATE BETWEEN p_start_date AND p_end_date
    AND (p_currency IS NULL OR currency = p_currency)
    AND (p_organizer_id IS NULL OR organizer_id = p_organizer_id);

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Create default chart of accounts
INSERT INTO account_ledger (account_code, account_name, account_type, description) VALUES
-- Assets
('1000', 'Cash', 'asset', 'Cash and bank balances'),
('1100', 'Accounts Receivable', 'asset', 'Money owed to platform'),
('1200', 'Escrow Holdings', 'asset', 'Funds held for organizers'),

-- Liabilities
('2000', 'Accounts Payable', 'liability', 'Money owed by platform'),
('2100', 'Organizer Payables', 'liability', 'Pending organizer payouts'),
('2200', 'Promoter Payables', 'liability', 'Pending promoter commissions'),

-- Revenue
('4000', 'Platform Fee Revenue', 'revenue', 'Platform fees collected'),
('4100', 'Fast Payout Fee Revenue', 'revenue', 'Fast payout fees collected'),
('4200', 'Other Revenue', 'revenue', 'Miscellaneous revenue'),

-- Expenses
('5000', 'Payment Processing Fees', 'expense', 'Stripe, Paystack, etc. fees'),
('5100', 'Refund Costs', 'expense', 'Costs associated with refunds'),
('5200', 'Chargeback Costs', 'expense', 'Chargeback fees and losses')

ON CONFLICT (account_code, currency) DO NOTHING;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION log_financial_transaction TO service_role;
GRANT EXECUTE ON FUNCTION update_daily_ledger_summary TO service_role;
GRANT EXECUTE ON FUNCTION get_transaction_summary TO authenticated;
