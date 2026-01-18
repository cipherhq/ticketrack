-- Donation Payout Schema for Ticketrack
-- Supports payouts for free event donations via Paystack (NGN, GHS) and Stripe (GBP, USD, CAD)

-- Add is_donation and payout fields to orders table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_donation') THEN
    ALTER TABLE orders ADD COLUMN is_donation BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payout_status') THEN
    ALTER TABLE orders ADD COLUMN payout_status VARCHAR(50) DEFAULT 'pending';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payout_reference') THEN
    ALTER TABLE orders ADD COLUMN payout_reference VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payout_initiated_at') THEN
    ALTER TABLE orders ADD COLUMN payout_initiated_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payout_completed_at') THEN
    ALTER TABLE orders ADD COLUMN payout_completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add Paystack recipient code to organizers table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizers' AND column_name = 'paystack_recipient_code') THEN
    ALTER TABLE organizers ADD COLUMN paystack_recipient_code VARCHAR(255);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizers' AND column_name = 'payout_currency') THEN
    ALTER TABLE organizers ADD COLUMN payout_currency VARCHAR(10) DEFAULT 'NGN';
  END IF;
END $$;

-- Create Paystack payouts table
CREATE TABLE IF NOT EXISTS paystack_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  
  -- Paystack transfer details
  transfer_code VARCHAR(255) NOT NULL,
  transfer_reference VARCHAR(255) NOT NULL UNIQUE,
  recipient_code VARCHAR(255) NOT NULL,
  
  -- Amount details
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'NGN',
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, success, failed, reversed
  failure_reason TEXT,
  
  -- Metadata
  is_donation BOOLEAN DEFAULT FALSE,
  order_ids JSONB, -- Array of order IDs included in this payout
  
  -- Audit
  triggered_by VARCHAR(50), -- 'auto', 'admin', 'organizer'
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for Paystack payouts
CREATE INDEX IF NOT EXISTS idx_paystack_payouts_organizer ON paystack_payouts(organizer_id);
CREATE INDEX IF NOT EXISTS idx_paystack_payouts_event ON paystack_payouts(event_id);
CREATE INDEX IF NOT EXISTS idx_paystack_payouts_status ON paystack_payouts(status);
CREATE INDEX IF NOT EXISTS idx_paystack_payouts_transfer_ref ON paystack_payouts(transfer_reference);
CREATE INDEX IF NOT EXISTS idx_paystack_payouts_is_donation ON paystack_payouts(is_donation);

-- Create indexes for orders donation/payout queries
CREATE INDEX IF NOT EXISTS idx_orders_is_donation ON orders(is_donation) WHERE is_donation = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_payout_status ON orders(payout_status);

-- RLS Policies for paystack_payouts
ALTER TABLE paystack_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organizers can view their payouts" ON paystack_payouts;
CREATE POLICY "Organizers can view their payouts" ON paystack_payouts
  FOR SELECT USING (
    organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage all payouts" ON paystack_payouts;
CREATE POLICY "Admins can manage all payouts" ON paystack_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to update payout status from Paystack webhook
CREATE OR REPLACE FUNCTION update_paystack_payout_status(
  p_transfer_reference VARCHAR,
  p_status VARCHAR,
  p_failure_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $func$
BEGIN
  UPDATE paystack_payouts
  SET 
    status = p_status,
    failure_reason = p_failure_reason,
    completed_at = CASE WHEN p_status IN ('success', 'failed', 'reversed') THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE transfer_reference = p_transfer_reference;
  
  -- Update related orders
  IF p_status = 'success' THEN
    UPDATE orders
    SET 
      payout_status = 'completed',
      payout_completed_at = NOW()
    WHERE payout_reference = p_transfer_reference;
  ELSIF p_status IN ('failed', 'reversed') THEN
    UPDATE orders
    SET payout_status = 'failed'
    WHERE payout_reference = p_transfer_reference;
  END IF;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for donation analyticsa
-- Note: This view depends on the is_donation column being added above
-- Create the view only if the column exists
DO $$
BEGIN
  -- Check if is_donation column exists before creating view
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_donation') THEN
    -- Drop and recreate view
    DROP VIEW IF EXISTS donation_analytics;
    
    EXECUTE '
    CREATE VIEW donation_analytics AS
    SELECT 
      e.id AS event_id,
      e.title AS event_title,
      e.organizer_id,
      o.business_name AS organizer_name,
      e.currency,
      COUNT(ord.id) AS donation_count,
      COALESCE(SUM(ord.total_amount), 0) AS total_donations,
      COALESCE(SUM(ord.platform_fee), 0) AS total_platform_fees,
      COALESCE(SUM(ord.total_amount - ord.platform_fee), 0) AS net_donations,
      COUNT(CASE WHEN ord.payout_status = ''completed'' THEN 1 END) AS paid_out_count,
      COALESCE(SUM(CASE WHEN ord.payout_status = ''completed'' THEN ord.total_amount - ord.platform_fee ELSE 0 END), 0) AS paid_out_amount,
      COALESCE(SUM(CASE WHEN ord.payout_status = ''pending'' THEN ord.total_amount - ord.platform_fee ELSE 0 END), 0) AS pending_payout_amount
    FROM events e
    JOIN organizers o ON e.organizer_id = o.id
    LEFT JOIN orders ord ON ord.event_id = e.id AND ord.is_donation = TRUE AND ord.status = ''completed''
    WHERE e.is_free = TRUE
    GROUP BY e.id, e.title, e.organizer_id, o.business_name, e.currency
    ';
    
    -- Grant access to the view
    GRANT SELECT ON donation_analytics TO authenticated;
    
    RAISE NOTICE 'donation_analytics view created successfully';
  ELSE
    RAISE NOTICE 'is_donation column not found - view will be created on next run';
  END IF;
END $$;

COMMENT ON TABLE paystack_payouts IS 'Tracks all Paystack transfer payouts to organizers (Nigeria, Ghana)';
COMMENT ON COLUMN orders.is_donation IS 'True if this order is a donation for a free event';
COMMENT ON COLUMN orders.payout_status IS 'Status of payout: pending, processing, completed, failed';
