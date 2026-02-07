-- =====================================================
-- PAYMENT BATCHING - Database Schema
-- Process multiple payouts in batches efficiently
-- =====================================================

-- Payout batches
CREATE TABLE IF NOT EXISTS payout_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch identification
  batch_number VARCHAR(50) UNIQUE,
  batch_type VARCHAR(30) DEFAULT 'organizer' CHECK (batch_type IN (
    'organizer',      -- Organizer payouts
    'promoter',       -- Promoter commissions
    'affiliate',      -- Affiliate commissions
    'refund',         -- Bulk refunds
    'mixed'           -- Mixed types
  )),

  -- Provider info
  provider VARCHAR(20) NOT NULL CHECK (provider IN (
    'stripe', 'paystack', 'flutterwave', 'bank_transfer', 'manual'
  )),
  provider_batch_id VARCHAR(100),
  provider_reference VARCHAR(100),

  -- Currency and amounts
  currency VARCHAR(3) NOT NULL,
  payout_count INTEGER DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_fees DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) GENERATED ALWAYS AS (total_amount - total_fees) STORED,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Batch created, not submitted
    'validating',     -- Validating recipient details
    'ready',          -- Ready to process
    'processing',     -- Being processed by provider
    'partial',        -- Some items completed
    'completed',      -- All items completed
    'failed',         -- Batch failed
    'cancelled'       -- Batch cancelled
  )),

  -- Validation
  validation_errors JSONB DEFAULT '[]',
  invalid_count INTEGER DEFAULT 0,

  -- Processing
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Results
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  success_amount DECIMAL(15,2) DEFAULT 0,
  failed_amount DECIMAL(15,2) DEFAULT 0,

  -- Provider response
  provider_response JSONB,
  error_message TEXT,

  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch items (individual payouts in a batch)
CREATE TABLE IF NOT EXISTS payout_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,

  -- Recipient
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN (
    'organizer', 'promoter', 'affiliate', 'customer'
  )),
  organizer_id UUID REFERENCES organizers(id),
  promoter_id UUID,
  affiliate_id UUID,
  user_id UUID REFERENCES auth.users(id),

  -- Recipient details (snapshot at batch time)
  recipient_name VARCHAR(255),
  recipient_email VARCHAR(255),
  bank_name VARCHAR(100),
  bank_code VARCHAR(20),
  account_number VARCHAR(50),
  recipient_code VARCHAR(100), -- Provider-specific recipient ID

  -- Amount
  amount DECIMAL(15,2) NOT NULL,
  fee DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) GENERATED ALWAYS AS (amount - fee) STORED,
  currency VARCHAR(3) NOT NULL,

  -- Reference
  escrow_id UUID,
  event_id UUID REFERENCES events(id),
  payout_queue_id UUID REFERENCES payout_queue(id),
  reference VARCHAR(100),

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Not yet processed
    'validating',     -- Being validated
    'valid',          -- Validation passed
    'invalid',        -- Validation failed
    'processing',     -- Being processed
    'completed',      -- Successfully paid
    'failed',         -- Payment failed
    'reversed',       -- Payment reversed
    'skipped'         -- Skipped (e.g., invalid)
  )),

  -- Validation
  validation_error TEXT,

  -- Provider response
  provider_transfer_id VARCHAR(100),
  provider_reference VARCHAR(100),
  provider_status VARCHAR(50),
  provider_response JSONB,
  failure_reason TEXT,

  -- Timestamps
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch processing schedule
CREATE TABLE IF NOT EXISTS batch_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Schedule config
  schedule_name VARCHAR(100) NOT NULL,
  batch_type VARCHAR(30) NOT NULL,
  provider VARCHAR(20) NOT NULL,
  currency VARCHAR(3),

  -- Timing
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN (
    'daily', 'weekly', 'biweekly', 'monthly', 'manual'
  )),
  day_of_week INTEGER, -- 0-6 for weekly
  day_of_month INTEGER, -- 1-31 for monthly
  time_of_day TIME DEFAULT '10:00',
  timezone VARCHAR(50) DEFAULT 'UTC',

  -- Thresholds
  min_items INTEGER DEFAULT 1,
  max_items INTEGER DEFAULT 100,
  min_amount DECIMAL(15,2) DEFAULT 0,
  max_amount DECIMAL(15,2) DEFAULT 10000000,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_batch_id UUID REFERENCES payout_batches(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Batch audit log
CREATE TABLE IF NOT EXISTS batch_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,

  action VARCHAR(50) NOT NULL,
  description TEXT,
  old_status VARCHAR(20),
  new_status VARCHAR(20),

  performed_by UUID REFERENCES auth.users(id),
  performed_by_type VARCHAR(20) DEFAULT 'system',

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_batches_number ON payout_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_status ON payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_provider ON payout_batches(provider);
CREATE INDEX IF NOT EXISTS idx_batches_currency ON payout_batches(currency);
CREATE INDEX IF NOT EXISTS idx_batches_type ON payout_batches(batch_type);
CREATE INDEX IF NOT EXISTS idx_batches_created ON payout_batches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON payout_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_status ON payout_batch_items(status);
CREATE INDEX IF NOT EXISTS idx_batch_items_organizer ON payout_batch_items(organizer_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_escrow ON payout_batch_items(escrow_id);

CREATE INDEX IF NOT EXISTS idx_batch_schedule_active ON batch_schedule(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_batch_schedule_next ON batch_schedule(next_run_at);

CREATE INDEX IF NOT EXISTS idx_batch_audit_batch ON batch_audit_log(batch_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages batches" ON payout_batches
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages batch items" ON payout_batch_items
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages batch schedule" ON batch_schedule
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages batch audit" ON batch_audit_log
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Generate batch number
CREATE OR REPLACE FUNCTION generate_batch_number(
  p_batch_type VARCHAR,
  p_provider VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_date VARCHAR;
  v_sequence INTEGER;
BEGIN
  v_prefix := CASE p_batch_type
    WHEN 'organizer' THEN 'ORG'
    WHEN 'promoter' THEN 'PRO'
    WHEN 'affiliate' THEN 'AFF'
    WHEN 'refund' THEN 'REF'
    ELSE 'BAT'
  END || '-' || UPPER(SUBSTRING(p_provider, 1, 3));

  v_date := TO_CHAR(NOW(), 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CAST(SUBSTRING(batch_number FROM 16 FOR 4) AS INTEGER)
  ), 0) + 1 INTO v_sequence
  FROM payout_batches
  WHERE batch_number LIKE v_prefix || '-' || v_date || '%';

  RETURN v_prefix || '-' || v_date || '-' || LPAD(v_sequence::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a new batch
CREATE OR REPLACE FUNCTION create_payout_batch(
  p_batch_type VARCHAR,
  p_provider VARCHAR,
  p_currency VARCHAR,
  p_created_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_batch_id UUID;
  v_batch_number VARCHAR;
BEGIN
  v_batch_number := generate_batch_number(p_batch_type, p_provider);

  INSERT INTO payout_batches (
    batch_number, batch_type, provider, currency, created_by
  ) VALUES (
    v_batch_number, p_batch_type, p_provider, p_currency, p_created_by
  )
  RETURNING id INTO v_batch_id;

  -- Log creation
  INSERT INTO batch_audit_log (batch_id, action, description, new_status, performed_by)
  VALUES (v_batch_id, 'batch_created', 'Batch created', 'pending', p_created_by);

  RETURN json_build_object(
    'success', true,
    'batch_id', v_batch_id,
    'batch_number', v_batch_number
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add item to batch
CREATE OR REPLACE FUNCTION add_item_to_batch(
  p_batch_id UUID,
  p_recipient_type VARCHAR,
  p_organizer_id UUID,
  p_amount DECIMAL,
  p_currency VARCHAR,
  p_escrow_id UUID DEFAULT NULL,
  p_event_id UUID DEFAULT NULL,
  p_payout_queue_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_batch RECORD;
  v_organizer RECORD;
  v_item_id UUID;
BEGIN
  -- Get batch
  SELECT * INTO v_batch FROM payout_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Batch not found');
  END IF;

  IF v_batch.status NOT IN ('pending', 'ready') THEN
    RETURN json_build_object('success', false, 'error', 'Batch is not accepting new items');
  END IF;

  -- Get organizer details
  SELECT * INTO v_organizer FROM organizers WHERE id = p_organizer_id;
  IF v_organizer IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Organizer not found');
  END IF;

  -- Add item
  INSERT INTO payout_batch_items (
    batch_id, recipient_type, organizer_id,
    recipient_name, recipient_email,
    bank_name, bank_code, account_number, recipient_code,
    amount, currency,
    escrow_id, event_id, payout_queue_id,
    reference, sort_order
  ) VALUES (
    p_batch_id, p_recipient_type, p_organizer_id,
    v_organizer.business_name, v_organizer.email,
    v_organizer.bank_name, v_organizer.bank_code, v_organizer.bank_account_number,
    v_organizer.paystack_recipient_code,
    p_amount, p_currency,
    p_escrow_id, p_event_id, p_payout_queue_id,
    'BAT-' || SUBSTRING(p_batch_id::TEXT, 1, 8) || '-' || (SELECT COUNT(*) + 1 FROM payout_batch_items WHERE batch_id = p_batch_id),
    (SELECT COUNT(*) + 1 FROM payout_batch_items WHERE batch_id = p_batch_id)
  )
  RETURNING id INTO v_item_id;

  -- Update batch totals
  UPDATE payout_batches SET
    payout_count = payout_count + 1,
    total_amount = total_amount + p_amount,
    updated_at = NOW()
  WHERE id = p_batch_id;

  RETURN json_build_object('success', true, 'item_id', v_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Validate batch items
CREATE OR REPLACE FUNCTION validate_batch(p_batch_id UUID)
RETURNS JSON AS $$
DECLARE
  v_batch RECORD;
  v_item RECORD;
  v_valid_count INTEGER := 0;
  v_invalid_count INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  SELECT * INTO v_batch FROM payout_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Batch not found');
  END IF;

  UPDATE payout_batches SET status = 'validating', updated_at = NOW() WHERE id = p_batch_id;

  FOR v_item IN SELECT * FROM payout_batch_items WHERE batch_id = p_batch_id
  LOOP
    -- Validate recipient details
    IF v_item.recipient_code IS NULL AND v_item.account_number IS NULL THEN
      UPDATE payout_batch_items SET
        status = 'invalid',
        validation_error = 'No bank account or recipient code',
        updated_at = NOW()
      WHERE id = v_item.id;

      v_invalid_count := v_invalid_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'item_id', v_item.id,
        'recipient', v_item.recipient_name,
        'error', 'No bank account or recipient code'
      );
    ELSIF v_item.amount <= 0 THEN
      UPDATE payout_batch_items SET
        status = 'invalid',
        validation_error = 'Invalid amount',
        updated_at = NOW()
      WHERE id = v_item.id;

      v_invalid_count := v_invalid_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'item_id', v_item.id,
        'recipient', v_item.recipient_name,
        'error', 'Invalid amount'
      );
    ELSE
      UPDATE payout_batch_items SET
        status = 'valid',
        validation_error = NULL,
        updated_at = NOW()
      WHERE id = v_item.id;

      v_valid_count := v_valid_count + 1;
    END IF;
  END LOOP;

  -- Update batch status
  UPDATE payout_batches SET
    status = CASE WHEN v_invalid_count = 0 THEN 'ready' ELSE 'pending' END,
    invalid_count = v_invalid_count,
    validation_errors = v_errors,
    updated_at = NOW()
  WHERE id = p_batch_id;

  -- Log validation
  INSERT INTO batch_audit_log (batch_id, action, description, new_status)
  VALUES (
    p_batch_id,
    'batch_validated',
    format('Validated: %s valid, %s invalid', v_valid_count, v_invalid_count),
    CASE WHEN v_invalid_count = 0 THEN 'ready' ELSE 'pending' END
  );

  RETURN json_build_object(
    'success', true,
    'valid_count', v_valid_count,
    'invalid_count', v_invalid_count,
    'errors', v_errors
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit batch for processing
CREATE OR REPLACE FUNCTION submit_batch(
  p_batch_id UUID,
  p_submitted_by UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_batch RECORD;
BEGIN
  SELECT * INTO v_batch FROM payout_batches WHERE id = p_batch_id;
  IF v_batch IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Batch not found');
  END IF;

  IF v_batch.status != 'ready' THEN
    RETURN json_build_object('success', false, 'error', 'Batch is not ready for submission');
  END IF;

  -- Update batch status
  UPDATE payout_batches SET
    status = 'processing',
    submitted_at = NOW(),
    submitted_by = p_submitted_by,
    updated_at = NOW()
  WHERE id = p_batch_id;

  -- Update valid items to processing
  UPDATE payout_batch_items SET
    status = 'processing',
    updated_at = NOW()
  WHERE batch_id = p_batch_id AND status = 'valid';

  -- Log submission
  INSERT INTO batch_audit_log (batch_id, action, description, old_status, new_status, performed_by)
  VALUES (p_batch_id, 'batch_submitted', 'Batch submitted for processing', 'ready', 'processing', p_submitted_by);

  RETURN json_build_object('success', true, 'batch_id', p_batch_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update batch item status
CREATE OR REPLACE FUNCTION update_batch_item_status(
  p_item_id UUID,
  p_status VARCHAR,
  p_provider_transfer_id VARCHAR DEFAULT NULL,
  p_provider_reference VARCHAR DEFAULT NULL,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_item RECORD;
  v_batch_id UUID;
BEGIN
  SELECT * INTO v_item FROM payout_batch_items WHERE id = p_item_id;
  IF v_item IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Item not found');
  END IF;

  v_batch_id := v_item.batch_id;

  UPDATE payout_batch_items SET
    status = p_status,
    provider_transfer_id = COALESCE(p_provider_transfer_id, provider_transfer_id),
    provider_reference = COALESCE(p_provider_reference, provider_reference),
    failure_reason = p_failure_reason,
    processed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE processed_at END,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_item_id;

  -- Update batch counts
  WITH item_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed') as success_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as success_amount,
      COALESCE(SUM(amount) FILTER (WHERE status = 'failed'), 0) as failed_amount
    FROM payout_batch_items
    WHERE batch_id = v_batch_id
  )
  UPDATE payout_batches SET
    success_count = item_stats.success_count,
    failed_count = item_stats.failed_count,
    success_amount = item_stats.success_amount,
    failed_amount = item_stats.failed_amount,
    status = CASE
      WHEN (SELECT COUNT(*) FROM payout_batch_items WHERE batch_id = v_batch_id AND status IN ('pending', 'processing', 'validating')) = 0
      THEN CASE
        WHEN item_stats.failed_count > 0 AND item_stats.success_count > 0 THEN 'partial'
        WHEN item_stats.failed_count > 0 THEN 'failed'
        ELSE 'completed'
      END
      ELSE 'processing'
    END,
    completed_at = CASE
      WHEN (SELECT COUNT(*) FROM payout_batch_items WHERE batch_id = v_batch_id AND status IN ('pending', 'processing', 'validating')) = 0
      THEN NOW()
      ELSE NULL
    END,
    updated_at = NOW()
  FROM item_stats
  WHERE id = v_batch_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_batch_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batches_updated_at
  BEFORE UPDATE ON payout_batches
  FOR EACH ROW EXECUTE FUNCTION update_batch_timestamp();

CREATE TRIGGER batch_items_updated_at
  BEFORE UPDATE ON payout_batch_items
  FOR EACH ROW EXECUTE FUNCTION update_batch_timestamp();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION generate_batch_number TO service_role;
GRANT EXECUTE ON FUNCTION create_payout_batch TO service_role;
GRANT EXECUTE ON FUNCTION add_item_to_batch TO service_role;
GRANT EXECUTE ON FUNCTION validate_batch TO service_role;
GRANT EXECUTE ON FUNCTION submit_batch TO service_role;
GRANT EXECUTE ON FUNCTION update_batch_item_status TO service_role;
