-- =====================================================
-- FAST PAYOUT FEATURE - Database Schema
-- Enables organizers to request early payouts (before event ends)
-- with a 0.5% fee, available at 50% ticket sales
-- =====================================================

-- Fast Payout Requests
-- Track all fast payout requests from organizers
CREATE TABLE IF NOT EXISTS fast_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Organizer info
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  
  -- What's being paid out
  event_id UUID REFERENCES events(id) ON DELETE SET NULL, -- NULL for multi-event payout
  
  -- Amounts
  gross_amount DECIMAL(12,2) NOT NULL, -- Amount before fee
  fee_percentage DECIMAL(5,4) DEFAULT 0.005, -- 0.5% = 0.005
  fee_amount DECIMAL(12,2) NOT NULL, -- Calculated fee
  net_amount DECIMAL(12,2) NOT NULL, -- Amount organizer receives
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  
  -- Eligibility snapshot at time of request
  ticket_sales_percentage DECIMAL(5,2), -- e.g., 65.50%
  total_tickets_sold INTEGER,
  total_tickets_available INTEGER,
  organizer_trust_level VARCHAR(20), -- bronze, silver, gold
  payout_cap_percentage DECIMAL(5,2), -- 70% for regular, 85% for trusted, etc.
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Request submitted
    'approved',     -- Auto-approved or manually approved
    'processing',   -- Payout being processed
    'completed',    -- Payout successful
    'failed',       -- Payout failed
    'rejected',     -- Request rejected (fraud, etc.)
    'cancelled'     -- Organizer cancelled request
  )),
  
  -- Processing details
  payment_provider VARCHAR(20), -- paystack, flutterwave
  transfer_reference VARCHAR(100),
  transfer_code VARCHAR(100),
  failure_reason TEXT,
  
  -- Audit
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id), -- NULL for auto-approval
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Order tracking (which orders are included in this payout)
  order_ids UUID[] DEFAULT '{}',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fast Payout Settings (global platform settings)
-- These can be managed via admin panel
CREATE TABLE IF NOT EXISTS fast_payout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Feature toggle
  enabled BOOLEAN DEFAULT true,
  
  -- Fee configuration
  fee_percentage DECIMAL(5,4) DEFAULT 0.005, -- 0.5%
  
  -- Eligibility thresholds
  min_ticket_sales_percentage DECIMAL(5,2) DEFAULT 50.00, -- 50%
  
  -- Caps by trust level (percentage of available earnings)
  cap_bronze DECIMAL(5,2) DEFAULT 70.00, -- 70%
  cap_silver DECIMAL(5,2) DEFAULT 80.00, -- 80%
  cap_gold DECIMAL(5,2) DEFAULT 90.00, -- 90%
  cap_trusted DECIMAL(5,2) DEFAULT 95.00, -- 95% for manually trusted organizers
  
  -- Requirements
  require_kyc BOOLEAN DEFAULT true,
  require_bank_verified BOOLEAN DEFAULT true,
  
  -- Limits
  max_requests_per_event INTEGER DEFAULT 3, -- Max fast payout requests per event
  cooldown_hours INTEGER DEFAULT 24, -- Hours between requests
  
  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default settings
INSERT INTO fast_payout_settings (id, enabled, fee_percentage)
VALUES (gen_random_uuid(), true, 0.005)
ON CONFLICT DO NOTHING;

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_fast_payout_organizer ON fast_payout_requests(organizer_id);
CREATE INDEX IF NOT EXISTS idx_fast_payout_event ON fast_payout_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_fast_payout_status ON fast_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_fast_payout_requested ON fast_payout_requests(requested_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE fast_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE fast_payout_settings ENABLE ROW LEVEL SECURITY;

-- Organizers can view their own requests
CREATE POLICY "Organizers can view their fast payout requests" ON fast_payout_requests
  FOR SELECT USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Organizers can create requests
CREATE POLICY "Organizers can create fast payout requests" ON fast_payout_requests
  FOR INSERT WITH CHECK (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Service role can manage all
CREATE POLICY "Service role can manage fast payouts" ON fast_payout_requests
  USING (auth.role() = 'service_role');

-- Settings are read-only for everyone, writable by service role
CREATE POLICY "Anyone can read fast payout settings" ON fast_payout_settings
  FOR SELECT USING (true);

CREATE POLICY "Service role can update settings" ON fast_payout_settings
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Check if organizer is eligible for fast payout
CREATE OR REPLACE FUNCTION check_fast_payout_eligibility(
  p_organizer_id UUID,
  p_event_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_organizer RECORD;
  v_settings RECORD;
  v_total_sold INTEGER;
  v_total_available INTEGER;
  v_sales_percentage DECIMAL;
  v_available_earnings DECIMAL;
  v_already_paid DECIMAL;
  v_cap_percentage DECIMAL;
  v_max_payout DECIMAL;
  v_pending_requests INTEGER;
  v_last_request TIMESTAMPTZ;
  v_currency VARCHAR(3);
BEGIN
  -- Get settings
  SELECT * INTO v_settings FROM fast_payout_settings LIMIT 1;
  
  IF NOT v_settings.enabled THEN
    RETURN json_build_object('eligible', false, 'reason', 'Fast payout is currently disabled');
  END IF;
  
  -- Get organizer
  SELECT * INTO v_organizer FROM organizers WHERE id = p_organizer_id;
  
  IF v_organizer IS NULL THEN
    RETURN json_build_object('eligible', false, 'reason', 'Organizer not found');
  END IF;
  
  -- Check KYC
  IF v_settings.require_kyc AND NOT COALESCE(v_organizer.kyc_verified, false) AND v_organizer.kyc_status != 'approved' THEN
    RETURN json_build_object('eligible', false, 'reason', 'KYC verification required');
  END IF;
  
  -- Check if using subaccount (they don't need fast payout)
  IF v_organizer.paystack_subaccount_id IS NOT NULL AND v_organizer.paystack_subaccount_status = 'active' THEN
    RETURN json_build_object('eligible', false, 'reason', 'Subaccount organizers receive instant payouts automatically');
  END IF;
  
  -- Calculate ticket sales and earnings
  IF p_event_id IS NOT NULL THEN
    -- Single event
    SELECT 
      COALESCE(SUM(tt.quantity_sold), 0),
      COALESCE(SUM(tt.quantity), 0),
      e.currency
    INTO v_total_sold, v_total_available, v_currency
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.id = p_event_id AND e.organizer_id = p_organizer_id
    GROUP BY e.currency;
    
    -- Get available earnings (completed orders minus platform fees, minus already paid out)
    SELECT COALESCE(SUM(o.total_amount - COALESCE(o.platform_fee, 0)), 0)
    INTO v_available_earnings
    FROM orders o
    WHERE o.event_id = p_event_id
      AND o.status = 'completed'
      AND o.payout_status = 'pending';
  ELSE
    -- All events for organizer
    SELECT 
      COALESCE(SUM(tt.quantity_sold), 0),
      COALESCE(SUM(tt.quantity), 0)
    INTO v_total_sold, v_total_available
    FROM events e
    JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.organizer_id = p_organizer_id;
    
    SELECT COALESCE(SUM(o.total_amount - COALESCE(o.platform_fee, 0)), 0)
    INTO v_available_earnings
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE e.organizer_id = p_organizer_id
      AND o.status = 'completed'
      AND o.payout_status = 'pending';
    
    v_currency := v_organizer.payout_currency;
  END IF;
  
  -- Calculate sales percentage
  IF v_total_available > 0 THEN
    v_sales_percentage := (v_total_sold::DECIMAL / v_total_available::DECIMAL) * 100;
  ELSE
    v_sales_percentage := 0;
  END IF;
  
  -- Check minimum sales threshold
  IF v_sales_percentage < v_settings.min_ticket_sales_percentage THEN
    RETURN json_build_object(
      'eligible', false, 
      'reason', format('Minimum %s%% ticket sales required. Current: %s%%', 
        v_settings.min_ticket_sales_percentage, ROUND(v_sales_percentage, 1)),
      'sales_percentage', v_sales_percentage,
      'required_percentage', v_settings.min_ticket_sales_percentage
    );
  END IF;
  
  -- Determine cap based on trust level
  v_cap_percentage := CASE 
    WHEN v_organizer.is_trusted THEN v_settings.cap_trusted
    WHEN v_organizer.verification_level = 'gold' THEN v_settings.cap_gold
    WHEN v_organizer.verification_level = 'silver' THEN v_settings.cap_silver
    ELSE v_settings.cap_bronze
  END;
  
  -- Calculate max payout amount
  v_max_payout := v_available_earnings * (v_cap_percentage / 100);
  
  IF v_max_payout <= 0 THEN
    RETURN json_build_object('eligible', false, 'reason', 'No available earnings for fast payout');
  END IF;
  
  -- Check for recent requests (cooldown)
  SELECT COUNT(*), MAX(requested_at)
  INTO v_pending_requests, v_last_request
  FROM fast_payout_requests
  WHERE organizer_id = p_organizer_id
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND status NOT IN ('completed', 'rejected', 'cancelled', 'failed');
  
  IF v_pending_requests > 0 THEN
    RETURN json_build_object('eligible', false, 'reason', 'You have a pending fast payout request');
  END IF;
  
  IF v_last_request IS NOT NULL AND v_last_request > NOW() - (v_settings.cooldown_hours || ' hours')::INTERVAL THEN
    RETURN json_build_object(
      'eligible', false, 
      'reason', format('Please wait %s hours between requests', v_settings.cooldown_hours)
    );
  END IF;
  
  -- Check max requests per event
  IF p_event_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_pending_requests
    FROM fast_payout_requests
    WHERE event_id = p_event_id AND status = 'completed';
    
    IF v_pending_requests >= v_settings.max_requests_per_event THEN
      RETURN json_build_object('eligible', false, 'reason', 'Maximum fast payout requests reached for this event');
    END IF;
  END IF;
  
  -- Eligible!
  RETURN json_build_object(
    'eligible', true,
    'available_earnings', v_available_earnings,
    'max_payout', v_max_payout,
    'cap_percentage', v_cap_percentage,
    'fee_percentage', v_settings.fee_percentage,
    'sales_percentage', v_sales_percentage,
    'currency', v_currency,
    'trust_level', COALESCE(v_organizer.verification_level, 'bronze'),
    'is_trusted', COALESCE(v_organizer.is_trusted, false)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a fast payout request
CREATE OR REPLACE FUNCTION create_fast_payout_request(
  p_organizer_id UUID,
  p_amount DECIMAL,
  p_event_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_eligibility JSON;
  v_settings RECORD;
  v_fee_amount DECIMAL;
  v_net_amount DECIMAL;
  v_request_id UUID;
  v_order_ids UUID[];
  v_organizer RECORD;
BEGIN
  -- Check eligibility
  v_eligibility := check_fast_payout_eligibility(p_organizer_id, p_event_id);
  
  IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
    RETURN json_build_object('success', false, 'error', v_eligibility->>'reason');
  END IF;
  
  -- Validate amount
  IF p_amount > (v_eligibility->>'max_payout')::DECIMAL THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Amount exceeds maximum payout of %s', v_eligibility->>'max_payout')
    );
  END IF;
  
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Get settings
  SELECT * INTO v_settings FROM fast_payout_settings LIMIT 1;
  
  -- Calculate fee
  v_fee_amount := ROUND(p_amount * v_settings.fee_percentage, 2);
  v_net_amount := p_amount - v_fee_amount;
  
  -- Get organizer info
  SELECT * INTO v_organizer FROM organizers WHERE id = p_organizer_id;
  
  -- Get order IDs to include
  IF p_event_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_order_ids
    FROM orders
    WHERE event_id = p_event_id
      AND status = 'completed'
      AND payout_status = 'pending';
  ELSE
    SELECT ARRAY_AGG(o.id) INTO v_order_ids
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE e.organizer_id = p_organizer_id
      AND o.status = 'completed'
      AND o.payout_status = 'pending';
  END IF;
  
  -- Create request
  INSERT INTO fast_payout_requests (
    organizer_id,
    event_id,
    gross_amount,
    fee_percentage,
    fee_amount,
    net_amount,
    currency,
    ticket_sales_percentage,
    organizer_trust_level,
    payout_cap_percentage,
    status,
    order_ids
  ) VALUES (
    p_organizer_id,
    p_event_id,
    p_amount,
    v_settings.fee_percentage,
    v_fee_amount,
    v_net_amount,
    v_eligibility->>'currency',
    (v_eligibility->>'sales_percentage')::DECIMAL,
    v_eligibility->>'trust_level',
    (v_eligibility->>'cap_percentage')::DECIMAL,
    'approved', -- Auto-approve if eligibility passed
    v_order_ids
  )
  RETURNING id INTO v_request_id;
  
  -- Update timestamp
  UPDATE fast_payout_requests SET approved_at = NOW() WHERE id = v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'gross_amount', p_amount,
    'fee_amount', v_fee_amount,
    'net_amount', v_net_amount,
    'currency', v_eligibility->>'currency'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION check_fast_payout_eligibility TO authenticated;
GRANT EXECUTE ON FUNCTION create_fast_payout_request TO authenticated;
