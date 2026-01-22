-- Migration: Add donation fee handling to events and donation processing fees to countries
-- Date: 2026-01-22

-- =============================================
-- PART 1: Add donation_fee_handling to events table
-- =============================================
-- This allows organizers to choose whether they absorb donation fees or pass to donors

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS donation_fee_handling TEXT DEFAULT 'absorb' 
  CHECK (donation_fee_handling IN ('absorb', 'pass_to_attendee'));

-- Add comment
COMMENT ON COLUMN public.events.donation_fee_handling IS 
  'How donation fees are handled: absorb (organizer pays from donation) or pass_to_attendee (donor pays on top)';

-- =============================================
-- PART 2: Add donation processing fee columns to countries
-- =============================================
-- This allows admin to set processing fees for donations (separate from platform fee)

ALTER TABLE public.countries
ADD COLUMN IF NOT EXISTS donation_processing_fee_pct DECIMAL(5,2) DEFAULT 2.9;

ALTER TABLE public.countries
ADD COLUMN IF NOT EXISTS donation_processing_fee_fixed DECIMAL(10,2) DEFAULT 0.30;

-- Add comments
COMMENT ON COLUMN public.countries.donation_processing_fee_pct IS 
  'Processing fee percentage for donations (e.g., 2.9 for 2.9%)';

COMMENT ON COLUMN public.countries.donation_processing_fee_fixed IS 
  'Fixed processing fee per donation transaction';

-- =============================================
-- PART 3: Update existing countries with sensible defaults
-- =============================================

-- US/UK/CA/EU - Stripe processing fees for donations
UPDATE public.countries 
SET 
  donation_processing_fee_pct = stripe_processing_fee_pct,
  donation_processing_fee_fixed = stripe_processing_fee_fixed
WHERE code IN ('US', 'GB', 'CA', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'AU', 'NZ', 'CH', 'AT');

-- Nigeria/Ghana/Kenya/SA - Paystack processing fees for donations
UPDATE public.countries 
SET 
  donation_processing_fee_pct = paystack_processing_fee_pct,
  donation_processing_fee_fixed = paystack_processing_fee_fixed
WHERE code IN ('NG', 'GH', 'KE', 'ZA');

-- =============================================
-- PART 4: Verify the changes
-- =============================================
SELECT 
  code, 
  name, 
  donation_fee_percentage,
  donation_processing_fee_pct,
  donation_processing_fee_fixed
FROM public.countries 
WHERE is_active = true
ORDER BY name;
