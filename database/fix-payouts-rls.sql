-- ============================================================================
-- Fix Payouts RLS Policies
-- ============================================================================
-- Allow admins/finance users to insert and manage payouts
-- ============================================================================

-- ============================================================================
-- Step 1: Create helper function for admin check
-- ============================================================================
CREATE OR REPLACE FUNCTION is_admin_or_finance()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role IN ('admin', 'finance'))
  );
$$;

GRANT EXECUTE ON FUNCTION is_admin_or_finance() TO authenticated;

-- ============================================================================
-- Step 2: Fix payouts table RLS
-- ============================================================================

-- Enable RLS
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Block team member payout access" ON payouts;
DROP POLICY IF EXISTS "payouts_admin_all" ON payouts;
DROP POLICY IF EXISTS "payouts_organizer_select" ON payouts;
DROP POLICY IF EXISTS "Admins can manage payouts" ON payouts;
DROP POLICY IF EXISTS "Organizers can view their payouts" ON payouts;

-- Create clean admin policy for all operations
CREATE POLICY "payouts_admin_all" ON payouts
FOR ALL USING (
  is_admin_or_finance()
);

-- Allow organizers to view their own payouts
CREATE POLICY "payouts_organizer_select" ON payouts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organizers o
    WHERE o.id = organizer_id AND o.user_id = auth.uid()
  )
);

-- ============================================================================
-- Step 3: Fix promoter_payouts table RLS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promoter_payouts') THEN
    -- Enable RLS
    ALTER TABLE promoter_payouts ENABLE ROW LEVEL SECURITY;

    -- Drop old policies
    DROP POLICY IF EXISTS "promoter_payouts_admin_all" ON promoter_payouts;
    DROP POLICY IF EXISTS "promoter_payouts_organizer_select" ON promoter_payouts;
    DROP POLICY IF EXISTS "Admins can manage promoter payouts" ON promoter_payouts;

    -- Admin can do all operations
    CREATE POLICY "promoter_payouts_admin_all" ON promoter_payouts
    FOR ALL USING (
      is_admin_or_finance()
    );

    -- Promoters can view their own payouts
    CREATE POLICY "promoter_payouts_promoter_select" ON promoter_payouts
    FOR SELECT USING (
      promoter_id IN (
        SELECT id FROM promoters WHERE user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ============================================================================
-- Step 4: Ensure events update works for payout_status
-- ============================================================================

-- Admins should be able to update events payout_status
DROP POLICY IF EXISTS "events_admin_update_payout" ON events;
CREATE POLICY "events_admin_update_payout" ON events
FOR UPDATE USING (
  is_admin_or_finance()
);

-- ============================================================================
-- Step 5: Fix promoter_sales update for paid status
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'promoter_sales') THEN
    ALTER TABLE promoter_sales ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "promoter_sales_admin_update" ON promoter_sales;
    CREATE POLICY "promoter_sales_admin_update" ON promoter_sales
    FOR UPDATE USING (
      is_admin_or_finance()
    );
  END IF;
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('payouts', 'promoter_payouts', 'promoter_sales')
-- ORDER BY tablename, policyname;
