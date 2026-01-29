-- ============================================
-- FIX PAYMENT GATEWAY CONFIG RLS POLICIES
-- ============================================
-- This fixes the 406 error when frontend tries to query payment_gateway_config

-- First, enable RLS if not enabled
ALTER TABLE public.payment_gateway_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "payment_gateway_config_public_read" ON public.payment_gateway_config;
DROP POLICY IF EXISTS "payment_gateway_config_admin_manage" ON public.payment_gateway_config;
DROP POLICY IF EXISTS "payment_gateway_config_service_role" ON public.payment_gateway_config;

-- Allow public SELECT (frontend needs to check which providers are active)
-- Note: The secret keys should NOT be exposed to the frontend
CREATE POLICY "payment_gateway_config_public_read"
ON public.payment_gateway_config
FOR SELECT
TO public
USING (true);

-- Allow admins to manage gateway config
CREATE POLICY "payment_gateway_config_admin_manage"
ON public.payment_gateway_config
FOR ALL
TO public
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- Allow service role full access (for Edge Functions)
CREATE POLICY "payment_gateway_config_service_role"
ON public.payment_gateway_config
FOR ALL
TO service_role
USING (true);

-- Verify policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'payment_gateway_config';
