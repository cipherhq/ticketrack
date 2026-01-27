-- ============================================
-- FIX ORDERS RLS - Allow users to complete their own orders
-- ============================================

-- Enable RLS on orders if not already enabled
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "orders_user_update" ON public.orders;
DROP POLICY IF EXISTS "orders_user_update_own" ON public.orders;
DROP POLICY IF EXISTS "orders_complete_own" ON public.orders;

-- Allow authenticated users to update their own PENDING orders to COMPLETED
-- This is the fallback when Stripe webhook doesn't fire (e.g., redirect before webhook)
CREATE POLICY "orders_complete_own"
ON public.orders
FOR UPDATE
TO authenticated
USING (
    user_id = auth.uid()
    AND status = 'pending'
)
WITH CHECK (
    user_id = auth.uid()
    AND status IN ('completed', 'pending', 'cancelled')
);

-- Also ensure users can SELECT their own orders
DROP POLICY IF EXISTS "orders_user_select" ON public.orders;
CREATE POLICY "orders_user_select"
ON public.orders
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow service role full access
DROP POLICY IF EXISTS "orders_service_role" ON public.orders;
CREATE POLICY "orders_service_role"
ON public.orders
FOR ALL
TO service_role
USING (true);

-- ============================================
-- DONE
-- ============================================
SELECT 'Orders RLS policies updated - users can now complete their own orders' AS status;
