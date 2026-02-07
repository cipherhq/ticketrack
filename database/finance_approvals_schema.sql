-- =====================================================
-- LARGE PAYOUT APPROVALS - Database Schema
-- Multi-signature approval for payouts above threshold
-- =====================================================

-- Approval thresholds by currency
CREATE TABLE IF NOT EXISTS payout_approval_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency VARCHAR(3) NOT NULL,
  threshold_amount DECIMAL(15,2) NOT NULL,
  required_approvers INTEGER DEFAULT 1 CHECK (required_approvers > 0 AND required_approvers <= 5),

  -- Tier-based approvals
  tier_name VARCHAR(50) DEFAULT 'standard',
  tier_priority INTEGER DEFAULT 1,

  -- Who can approve at this level
  approver_roles TEXT[] DEFAULT ARRAY['finance_admin'],

  -- Time limits
  approval_timeout_hours INTEGER DEFAULT 48,
  escalation_after_hours INTEGER DEFAULT 24,

  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(currency, tier_priority)
);

-- Approval requests
CREATE TABLE IF NOT EXISTS payout_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What needs approval
  payout_queue_id UUID REFERENCES payout_queue(id),
  batch_id UUID REFERENCES payout_batches(id),
  escrow_id UUID REFERENCES escrow_balances(id),

  -- Requester
  organizer_id UUID REFERENCES organizers(id),
  requested_by UUID REFERENCES auth.users(id),
  requested_by_type VARCHAR(20) DEFAULT 'system',

  -- Amount details
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL,

  -- Threshold that triggered approval
  threshold_id UUID REFERENCES payout_approval_thresholds(id),
  required_approvals INTEGER DEFAULT 1,
  current_approvals INTEGER DEFAULT 0,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',        -- Awaiting approval
    'partially_approved', -- Some approvals received
    'approved',       -- Fully approved
    'rejected',       -- Rejected by approver
    'expired',        -- Approval timeout
    'cancelled',      -- Cancelled by requester
    'escalated'       -- Escalated to higher level
  )),

  -- Urgency
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN (
    'low', 'normal', 'high', 'urgent'
  )),
  is_escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMPTZ,
  escalated_to UUID REFERENCES auth.users(id),

  -- Context
  reason TEXT,
  supporting_documents JSONB DEFAULT '[]',
  risk_score DECIMAL(5,2),

  -- Deadlines
  expires_at TIMESTAMPTZ,

  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual approvals
CREATE TABLE IF NOT EXISTS payout_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES payout_approval_requests(id) ON DELETE CASCADE,

  -- Approver
  approver_id UUID NOT NULL REFERENCES auth.users(id),
  approver_role VARCHAR(50),
  approver_name VARCHAR(255),

  -- Decision
  decision VARCHAR(20) NOT NULL CHECK (decision IN (
    'approved', 'rejected', 'request_info'
  )),
  notes TEXT,

  -- Additional verification
  verification_method VARCHAR(50), -- 2fa, pin, signature
  verified_at TIMESTAMPTZ,

  -- Risk assessment by approver
  risk_assessment VARCHAR(20),
  risk_notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval delegation
CREATE TABLE IF NOT EXISTS approval_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Delegator
  delegator_id UUID NOT NULL REFERENCES auth.users(id),
  delegate_id UUID NOT NULL REFERENCES auth.users(id),

  -- Scope
  currency VARCHAR(3), -- NULL = all currencies
  max_amount DECIMAL(15,2), -- NULL = no limit
  organizer_id UUID REFERENCES organizers(id), -- NULL = all organizers

  -- Time range
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  -- Constraints
  max_approvals_per_day INTEGER,
  require_notification BOOLEAN DEFAULT TRUE,

  is_active BOOLEAN DEFAULT TRUE,
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Approval notifications
CREATE TABLE IF NOT EXISTS approval_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES payout_approval_requests(id) ON DELETE CASCADE,

  recipient_id UUID NOT NULL REFERENCES auth.users(id),
  notification_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) DEFAULT 'email',

  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  action_taken_at TIMESTAMPTZ,
  action_taken VARCHAR(50)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_approval_thresholds_currency ON payout_approval_thresholds(currency);
CREATE INDEX IF NOT EXISTS idx_approval_thresholds_active ON payout_approval_thresholds(is_active) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON payout_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_organizer ON payout_approval_requests(organizer_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_payout ON payout_approval_requests(payout_queue_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_batch ON payout_approval_requests(batch_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_pending ON payout_approval_requests(created_at DESC)
  WHERE status IN ('pending', 'partially_approved');
CREATE INDEX IF NOT EXISTS idx_approval_requests_expires ON payout_approval_requests(expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_approvals_request ON payout_approvals(request_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver ON payout_approvals(approver_id);

CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON approval_delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegate ON approval_delegations(delegate_id);
CREATE INDEX IF NOT EXISTS idx_delegations_active ON approval_delegations(is_active, valid_from, valid_until);

CREATE INDEX IF NOT EXISTS idx_approval_notif_request ON approval_notifications(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_notif_recipient ON approval_notifications(recipient_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE payout_approval_thresholds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_notifications ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role manages approval thresholds" ON payout_approval_thresholds;
CREATE POLICY "Service role manages approval thresholds" ON payout_approval_thresholds
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages approval requests" ON payout_approval_requests;
CREATE POLICY "Service role manages approval requests" ON payout_approval_requests
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages approvals" ON payout_approvals;
CREATE POLICY "Service role manages approvals" ON payout_approvals
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages delegations" ON approval_delegations;
CREATE POLICY "Service role manages delegations" ON approval_delegations
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages approval notifs" ON approval_notifications;
CREATE POLICY "Service role manages approval notifs" ON approval_notifications
  USING (auth.role() = 'service_role');

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Check if amount requires approval
CREATE OR REPLACE FUNCTION check_approval_required(
  p_amount DECIMAL,
  p_currency VARCHAR
)
RETURNS JSON AS $$
DECLARE
  v_threshold RECORD;
BEGIN
  SELECT * INTO v_threshold
  FROM payout_approval_thresholds
  WHERE currency = p_currency
    AND threshold_amount <= p_amount
    AND is_active = TRUE
  ORDER BY threshold_amount DESC
  LIMIT 1;

  IF v_threshold IS NULL THEN
    RETURN json_build_object(
      'requires_approval', false,
      'amount', p_amount,
      'currency', p_currency
    );
  END IF;

  RETURN json_build_object(
    'requires_approval', true,
    'threshold_id', v_threshold.id,
    'threshold_amount', v_threshold.threshold_amount,
    'required_approvers', v_threshold.required_approvers,
    'tier_name', v_threshold.tier_name,
    'timeout_hours', v_threshold.approval_timeout_hours
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create approval request
CREATE OR REPLACE FUNCTION create_approval_request(
  p_amount DECIMAL,
  p_currency VARCHAR,
  p_payout_queue_id UUID DEFAULT NULL,
  p_batch_id UUID DEFAULT NULL,
  p_escrow_id UUID DEFAULT NULL,
  p_organizer_id UUID DEFAULT NULL,
  p_requested_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_priority VARCHAR DEFAULT 'normal'
)
RETURNS JSON AS $$
DECLARE
  v_approval_check JSON;
  v_request_id UUID;
  v_threshold_id UUID;
  v_required_approvers INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_approver_emails TEXT[];
BEGIN
  -- Check if approval is required
  v_approval_check := check_approval_required(p_amount, p_currency);

  IF NOT (v_approval_check->>'requires_approval')::BOOLEAN THEN
    RETURN json_build_object(
      'success', true,
      'requires_approval', false,
      'message', 'No approval required for this amount'
    );
  END IF;

  v_threshold_id := (v_approval_check->>'threshold_id')::UUID;
  v_required_approvers := (v_approval_check->>'required_approvers')::INTEGER;
  v_expires_at := NOW() + ((v_approval_check->>'timeout_hours')::INTEGER || ' hours')::INTERVAL;

  -- Create request
  INSERT INTO payout_approval_requests (
    payout_queue_id, batch_id, escrow_id,
    organizer_id, requested_by, requested_by_type,
    amount, currency,
    threshold_id, required_approvals,
    priority, reason,
    expires_at
  ) VALUES (
    p_payout_queue_id, p_batch_id, p_escrow_id,
    p_organizer_id, p_requested_by, 'system',
    p_amount, p_currency,
    v_threshold_id, v_required_approvers,
    p_priority, p_reason,
    v_expires_at
  )
  RETURNING id INTO v_request_id;

  -- Update payout queue if applicable
  IF p_payout_queue_id IS NOT NULL THEN
    UPDATE payout_queue SET
      requires_approval = TRUE,
      approval_status = 'pending',
      updated_at = NOW()
    WHERE id = p_payout_queue_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'requires_approval', true,
    'request_id', v_request_id,
    'required_approvers', v_required_approvers,
    'expires_at', v_expires_at,
    'tier_name', v_approval_check->>'tier_name'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Submit approval decision
CREATE OR REPLACE FUNCTION submit_approval_decision(
  p_request_id UUID,
  p_approver_id UUID,
  p_decision VARCHAR,
  p_notes TEXT DEFAULT NULL,
  p_risk_assessment VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
  v_existing_approval RECORD;
  v_new_count INTEGER;
  v_approver RECORD;
BEGIN
  -- Get request
  SELECT * INTO v_request FROM payout_approval_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status NOT IN ('pending', 'partially_approved') THEN
    RETURN json_build_object('success', false, 'error', 'Request is not pending approval');
  END IF;

  -- Check if approver already submitted
  SELECT * INTO v_existing_approval
  FROM payout_approvals
  WHERE request_id = p_request_id AND approver_id = p_approver_id;

  IF v_existing_approval IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Already submitted approval');
  END IF;

  -- Get approver info
  SELECT * INTO v_approver FROM auth.users WHERE id = p_approver_id;

  -- Record approval
  INSERT INTO payout_approvals (
    request_id, approver_id, approver_role, approver_name,
    decision, notes, risk_assessment, risk_notes
  ) VALUES (
    p_request_id, p_approver_id, 'finance_admin', v_approver.email,
    p_decision, p_notes, p_risk_assessment, p_notes
  );

  -- Handle decision
  IF p_decision = 'rejected' THEN
    -- Rejection immediately rejects the request
    UPDATE payout_approval_requests SET
      status = 'rejected',
      resolved_at = NOW(),
      resolution_notes = p_notes,
      updated_at = NOW()
    WHERE id = p_request_id;

    -- Update payout queue
    IF v_request.payout_queue_id IS NOT NULL THEN
      UPDATE payout_queue SET
        status = 'cancelled',
        approval_status = 'rejected',
        updated_at = NOW()
      WHERE id = v_request.payout_queue_id;
    END IF;

    RETURN json_build_object(
      'success', true,
      'decision', 'rejected',
      'request_status', 'rejected'
    );
  END IF;

  -- Count approvals
  SELECT COUNT(*) INTO v_new_count
  FROM payout_approvals
  WHERE request_id = p_request_id AND decision = 'approved';

  -- Check if fully approved
  IF v_new_count >= v_request.required_approvals THEN
    UPDATE payout_approval_requests SET
      status = 'approved',
      current_approvals = v_new_count,
      resolved_at = NOW(),
      updated_at = NOW()
    WHERE id = p_request_id;

    -- Update payout queue to proceed
    IF v_request.payout_queue_id IS NOT NULL THEN
      UPDATE payout_queue SET
        status = 'queued',
        approval_status = 'approved',
        approved_by = p_approver_id,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = v_request.payout_queue_id;
    END IF;

    RETURN json_build_object(
      'success', true,
      'decision', 'approved',
      'request_status', 'approved',
      'approval_count', v_new_count,
      'required', v_request.required_approvals
    );
  ELSE
    -- Partially approved
    UPDATE payout_approval_requests SET
      status = 'partially_approved',
      current_approvals = v_new_count,
      updated_at = NOW()
    WHERE id = p_request_id;

    RETURN json_build_object(
      'success', true,
      'decision', 'approved',
      'request_status', 'partially_approved',
      'approval_count', v_new_count,
      'required', v_request.required_approvals,
      'remaining', v_request.required_approvals - v_new_count
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Escalate request
CREATE OR REPLACE FUNCTION escalate_approval_request(
  p_request_id UUID,
  p_escalated_by UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_request RECORD;
BEGIN
  SELECT * INTO v_request FROM payout_approval_requests WHERE id = p_request_id;
  IF v_request IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Request not found');
  END IF;

  UPDATE payout_approval_requests SET
    status = 'escalated',
    is_escalated = TRUE,
    escalated_at = NOW(),
    priority = 'urgent',
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN json_build_object('success', true, 'status', 'escalated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire old requests
CREATE OR REPLACE FUNCTION expire_pending_approvals()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE payout_approval_requests SET
    status = 'expired',
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE status IN ('pending', 'partially_approved')
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get pending approvals for user
CREATE OR REPLACE FUNCTION get_pending_approvals_for_user(
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_agg(row_to_json(r.*)) INTO v_result
  FROM (
    SELECT
      par.*,
      o.business_name as organizer_name,
      (
        SELECT json_agg(row_to_json(pa.*))
        FROM payout_approvals pa
        WHERE pa.request_id = par.id
      ) as existing_approvals
    FROM payout_approval_requests par
    LEFT JOIN organizers o ON o.id = par.organizer_id
    WHERE par.status IN ('pending', 'partially_approved')
      AND NOT EXISTS (
        SELECT 1 FROM payout_approvals pa
        WHERE pa.request_id = par.id AND pa.approver_id = p_user_id
      )
    ORDER BY
      CASE par.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        ELSE 4
      END,
      par.created_at ASC
  ) r;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Default approval thresholds
INSERT INTO payout_approval_thresholds (currency, threshold_amount, required_approvers, tier_name, tier_priority) VALUES
-- Nigerian Naira
('NGN', 500000, 1, 'Standard', 1),
('NGN', 2000000, 2, 'High Value', 2),
('NGN', 10000000, 3, 'Very High Value', 3),

-- US Dollar
('USD', 1000, 1, 'Standard', 1),
('USD', 5000, 2, 'High Value', 2),
('USD', 25000, 3, 'Very High Value', 3),

-- British Pound
('GBP', 800, 1, 'Standard', 1),
('GBP', 4000, 2, 'High Value', 2),
('GBP', 20000, 3, 'Very High Value', 3),

-- Euro
('EUR', 900, 1, 'Standard', 1),
('EUR', 4500, 2, 'High Value', 2),
('EUR', 22500, 3, 'Very High Value', 3),

-- Ghana Cedi
('GHS', 5000, 1, 'Standard', 1),
('GHS', 25000, 2, 'High Value', 2),
('GHS', 100000, 3, 'Very High Value', 3)

ON CONFLICT (currency, tier_priority) DO UPDATE SET
  threshold_amount = EXCLUDED.threshold_amount,
  required_approvers = EXCLUDED.required_approvers,
  tier_name = EXCLUDED.tier_name,
  updated_at = NOW();

-- =====================================================
-- GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION check_approval_required TO service_role;
GRANT EXECUTE ON FUNCTION create_approval_request TO service_role;
GRANT EXECUTE ON FUNCTION submit_approval_decision TO service_role;
GRANT EXECUTE ON FUNCTION escalate_approval_request TO service_role;
GRANT EXECUTE ON FUNCTION expire_pending_approvals TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_approvals_for_user TO authenticated;
