-- Add payment tracking columns to platform_adverts table
-- Run this in Supabase SQL Editor

-- Add payment_status column (pending, paid)
ALTER TABLE public.platform_adverts 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' 
  CHECK (payment_status IN ('pending', 'paid'));

-- Add paid_at timestamp
ALTER TABLE public.platform_adverts 
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Add currency column for multi-currency support
ALTER TABLE public.platform_adverts 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'NGN';

-- Add invoice_number for tracking
ALTER TABLE public.platform_adverts 
ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- Add payment_reference for external payment tracking
ALTER TABLE public.platform_adverts 
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Add payment_method (bank_transfer, card, cash, etc.)
ALTER TABLE public.platform_adverts 
ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Add notes field for any payment notes
ALTER TABLE public.platform_adverts 
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- Create index for faster payment status queries
CREATE INDEX IF NOT EXISTS idx_platform_adverts_payment_status 
ON public.platform_adverts(payment_status);

-- Create index for faster date range queries
CREATE INDEX IF NOT EXISTS idx_platform_adverts_dates 
ON public.platform_adverts(start_date, end_date);

-- Update existing ads to have pending status if null
UPDATE public.platform_adverts 
SET payment_status = 'pending' 
WHERE payment_status IS NULL;

-- Grant RLS policies for admin access
ALTER TABLE public.platform_adverts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage all adverts" ON public.platform_adverts;
DROP POLICY IF EXISTS "Public can view active adverts" ON public.platform_adverts;

-- Create policy for admins to manage all adverts
CREATE POLICY "Admins can manage all adverts"
ON public.platform_adverts
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'super_admin')
  )
);

-- Create policy for public to view active adverts on the homepage
CREATE POLICY "Public can view active adverts"
ON public.platform_adverts
FOR SELECT
USING (is_active = true);
