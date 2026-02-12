-- Pool Payment (Flexible Split Pay) Migration
-- Adds 'pool' split type where friends contribute arbitrary amounts toward a total

-- 1. Extend split_type CHECK constraint to include 'pool'
ALTER TABLE group_split_payments
  DROP CONSTRAINT IF EXISTS group_split_payments_split_type_check;
ALTER TABLE group_split_payments
  ADD CONSTRAINT group_split_payments_split_type_check
  CHECK (split_type IN ('equal', 'custom', 'per_ticket', 'pool'));

-- 2. Add amount_collected column to track running total of contributions
ALTER TABLE group_split_payments
  ADD COLUMN IF NOT EXISTS amount_collected DECIMAL(12,2) DEFAULT 0;

-- 3. New RPC: record_pool_contribution
-- Accepts a variable contribution amount (unlike record_share_payment which uses fixed share_amount)
CREATE OR REPLACE FUNCTION record_pool_contribution(
  p_share_id UUID,
  p_amount DECIMAL,
  p_payment_reference VARCHAR,
  p_payment_method VARCHAR
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_share RECORD;
  v_split RECORD;
  v_amount_collected DECIMAL;
  v_all_paid BOOLEAN;
  v_new_status TEXT;
BEGIN
  -- Get the share
  SELECT * INTO v_share
  FROM group_split_shares
  WHERE id = p_share_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Share not found');
  END IF;

  -- Check if already paid
  IF v_share.payment_status = 'paid' THEN
    RETURN json_build_object('success', false, 'error', 'Share already paid');
  END IF;

  -- Get the split payment
  SELECT * INTO v_split
  FROM group_split_payments
  WHERE id = v_share.split_payment_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Split payment not found');
  END IF;

  -- Check if expired or cancelled
  IF v_split.status IN ('expired', 'cancelled', 'completed') THEN
    RETURN json_build_object('success', false, 'error', 'Split payment is ' || v_split.status);
  END IF;

  -- Update the share with contribution amount
  UPDATE group_split_shares
  SET share_amount = p_amount,
      payment_status = 'paid',
      payment_reference = p_payment_reference,
      payment_method = p_payment_method,
      paid_at = NOW(),
      updated_at = NOW()
  WHERE id = p_share_id;

  -- Recalculate amount_collected from all paid shares
  SELECT COALESCE(SUM(share_amount), 0) INTO v_amount_collected
  FROM group_split_shares
  WHERE split_payment_id = v_share.split_payment_id
    AND payment_status = 'paid';

  -- Determine new status
  IF v_amount_collected >= v_split.grand_total THEN
    v_new_status := 'completed';
    v_all_paid := true;
  ELSIF v_amount_collected > 0 THEN
    v_new_status := 'partial';
    v_all_paid := false;
  ELSE
    v_new_status := 'pending';
    v_all_paid := false;
  END IF;

  -- Update the split payment
  UPDATE group_split_payments
  SET amount_collected = v_amount_collected,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = v_share.split_payment_id;

  RETURN json_build_object(
    'success', true,
    'amount_collected', v_amount_collected,
    'grand_total', v_split.grand_total,
    'all_paid', v_all_paid,
    'status', v_new_status
  );
END;
$$;

-- 4. Grant execute permission
GRANT EXECUTE ON FUNCTION record_pool_contribution TO authenticated;
GRANT EXECUTE ON FUNCTION record_pool_contribution TO anon;
