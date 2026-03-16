-- Fraud Detection System Migration
-- Adds fraud_card_metadata, fraud_flags, fraud_blocklist tables
-- Adds fraud columns to orders table
-- Creates check_fraud_blocklist RPC

-- ============================================
-- 1. New columns on orders table
-- ============================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fraud_risk_score INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fraud_status VARCHAR(20) DEFAULT 'clean';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fraud_reviewed_by UUID REFERENCES auth.users(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fraud_reviewed_at TIMESTAMPTZ;

-- ============================================
-- 2. fraud_card_metadata table
-- ============================================
CREATE TABLE IF NOT EXISTS fraud_card_metadata (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  card_last4 VARCHAR(4),
  card_first6 VARCHAR(6),
  card_brand VARCHAR(50),
  card_type VARCHAR(20),
  card_country VARCHAR(10),
  card_bank VARCHAR(255),
  card_exp_month VARCHAR(2),
  card_exp_year VARCHAR(4),
  card_channel VARCHAR(50),
  card_signature VARCHAR(255),
  provider VARCHAR(50) NOT NULL,
  provider_transaction_id VARCHAR(255),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_card_metadata_order_id ON fraud_card_metadata(order_id);
CREATE INDEX IF NOT EXISTS idx_fraud_card_metadata_user_id ON fraud_card_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_card_metadata_card_last4 ON fraud_card_metadata(card_last4);
CREATE INDEX IF NOT EXISTS idx_fraud_card_metadata_card_first6 ON fraud_card_metadata(card_first6);
CREATE INDEX IF NOT EXISTS idx_fraud_card_metadata_card_signature ON fraud_card_metadata(card_signature);
CREATE INDEX IF NOT EXISTS idx_fraud_card_metadata_card_country ON fraud_card_metadata(card_country);

-- ============================================
-- 3. fraud_flags table
-- ============================================
CREATE TABLE IF NOT EXISTS fraud_flags (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rule_code VARCHAR(50) NOT NULL,
  rule_name VARCHAR(100) NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  details JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'confirmed')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_flags_order_id ON fraud_flags(order_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user_id ON fraud_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_status ON fraud_flags(status);
CREATE INDEX IF NOT EXISTS idx_fraud_flags_rule_code ON fraud_flags(rule_code);

-- ============================================
-- 4. fraud_blocklist table
-- ============================================
CREATE TABLE IF NOT EXISTS fraud_blocklist (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  block_type VARCHAR(30) NOT NULL CHECK (block_type IN ('email', 'phone', 'card_bin', 'ip', 'device_fingerprint', 'card_signature')),
  block_value VARCHAR(255) NOT NULL,
  reason TEXT,
  source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_rule', 'chargeback')),
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_fraud_blocklist_type_value UNIQUE (block_type, block_value)
);

CREATE INDEX IF NOT EXISTS idx_fraud_blocklist_active ON fraud_blocklist(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_fraud_blocklist_type ON fraud_blocklist(block_type);

-- ============================================
-- 5. RLS Policies
-- ============================================
ALTER TABLE fraud_card_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_blocklist ENABLE ROW LEVEL SECURITY;

-- fraud_card_metadata: admin read only
CREATE POLICY "admin_read_fraud_card_metadata" ON fraud_card_metadata
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- fraud_flags: admin read, update
CREATE POLICY "admin_read_fraud_flags" ON fraud_flags
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admin_update_fraud_flags" ON fraud_flags
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- fraud_blocklist: admin full CRUD
CREATE POLICY "admin_select_fraud_blocklist" ON fraud_blocklist
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admin_insert_fraud_blocklist" ON fraud_blocklist
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admin_update_fraud_blocklist" ON fraud_blocklist
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "admin_delete_fraud_blocklist" ON fraud_blocklist
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 6. check_fraud_blocklist RPC (SECURITY DEFINER)
-- ============================================
CREATE OR REPLACE FUNCTION check_fraud_blocklist(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocked BOOLEAN := false;
  v_reason TEXT := '';
BEGIN
  -- Check email
  IF p_email IS NOT NULL THEN
    SELECT true, reason INTO v_blocked, v_reason
    FROM fraud_blocklist
    WHERE block_type = 'email'
      AND block_value = lower(p_email)
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF v_blocked THEN
      RETURN jsonb_build_object('blocked', true, 'reason', v_reason);
    END IF;
  END IF;

  -- Check phone
  IF p_phone IS NOT NULL THEN
    SELECT true, reason INTO v_blocked, v_reason
    FROM fraud_blocklist
    WHERE block_type = 'phone'
      AND block_value = p_phone
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF v_blocked THEN
      RETURN jsonb_build_object('blocked', true, 'reason', v_reason);
    END IF;
  END IF;

  -- Check IP
  IF p_ip IS NOT NULL THEN
    SELECT true, reason INTO v_blocked, v_reason
    FROM fraud_blocklist
    WHERE block_type = 'ip'
      AND block_value = p_ip
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF v_blocked THEN
      RETURN jsonb_build_object('blocked', true, 'reason', v_reason);
    END IF;
  END IF;

  -- Check device fingerprint
  IF p_device_fingerprint IS NOT NULL THEN
    SELECT true, reason INTO v_blocked, v_reason
    FROM fraud_blocklist
    WHERE block_type = 'device_fingerprint'
      AND block_value = p_device_fingerprint
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;

    IF v_blocked THEN
      RETURN jsonb_build_object('blocked', true, 'reason', v_reason);
    END IF;
  END IF;

  RETURN jsonb_build_object('blocked', false, 'reason', '');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION check_fraud_blocklist TO authenticated;
