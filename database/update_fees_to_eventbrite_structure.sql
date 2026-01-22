-- Update Ticketrack fees to match Eventbrite's fee structure
-- Run this in Supabase SQL Editor

-- =============================================================================
-- USA (USD) - 3.7% + $1.79 per ticket + 2.9% payment processing
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 3.7,
  service_fee_fixed_per_ticket = 1.79,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 2.9,
  stripe_processing_fee_fixed = 0.30,
  processing_fee_fixed_per_order = 0
WHERE code = 'US';

-- =============================================================================
-- UK (GBP) - 6.95% + £0.59 per ticket (processing INCLUDED in service fee)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,  -- Included in service fee
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'GB';

-- =============================================================================
-- Australia (AUD) - 5.35% + $1.19 AUD per ticket (processing INCLUDED)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 5.35,
  service_fee_fixed_per_ticket = 1.19,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,  -- Included in service fee
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'AU';

-- =============================================================================
-- Canada (CAD) - Match USA structure: 3.7% + $1.79 CAD + 2.9% processing
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 3.7,
  service_fee_fixed_per_ticket = 1.79,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 2.9,
  stripe_processing_fee_fixed = 0.30,
  processing_fee_fixed_per_order = 0
WHERE code = 'CA';

-- =============================================================================
-- Ireland (EUR) - Match UK structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'IE';

-- =============================================================================
-- Germany (EUR) - Match EU structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'DE';

-- =============================================================================
-- France (EUR) - Match EU structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'FR';

-- =============================================================================
-- Spain (EUR) - Match EU structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'ES';

-- =============================================================================
-- Italy (EUR) - Match EU structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'IT';

-- =============================================================================
-- Netherlands (EUR) - Match EU structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'NL';

-- =============================================================================
-- Belgium (EUR) - Match EU structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'BE';

-- =============================================================================
-- Nigeria (NGN) - Competitive rate for Africa: 5% + ₦300 + 1.5% Paystack
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 5.0,
  service_fee_fixed_per_ticket = 300,
  service_fee_cap = NULL,
  paystack_processing_fee_pct = 1.5,
  paystack_processing_fee_fixed = 100,
  processing_fee_fixed_per_order = 0
WHERE code = 'NG';

-- =============================================================================
-- Ghana (GHS) - Match Nigeria structure: 5% + GHS 5 + 1.5% processing
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 5.0,
  service_fee_fixed_per_ticket = 5.00,
  service_fee_cap = NULL,
  paystack_processing_fee_pct = 1.5,
  paystack_processing_fee_fixed = 2,
  processing_fee_fixed_per_order = 0
WHERE code = 'GH';

-- =============================================================================
-- Kenya (KES) - 5% + KES 100 + 1.5% processing
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 5.0,
  service_fee_fixed_per_ticket = 100,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'KE';

-- =============================================================================
-- South Africa (ZAR) - 5% + R 20 + processing included
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 5.0,
  service_fee_fixed_per_ticket = 20,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'ZA';

-- =============================================================================
-- New Zealand (NZD) - Match Australia: 5.35% + $1.19 NZD (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 5.35,
  service_fee_fixed_per_ticket = 1.19,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'NZ';

-- =============================================================================
-- Switzerland (CHF) - Match EU structure: 6.95% + CHF 0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'CH';

-- =============================================================================
-- Austria (EUR) - Match EU structure: 6.95% + €0.59 (processing included)
-- =============================================================================
UPDATE public.countries SET
  service_fee_percentage = 6.95,
  service_fee_fixed_per_ticket = 0.59,
  service_fee_cap = NULL,
  stripe_processing_fee_pct = 0,
  stripe_processing_fee_fixed = 0,
  processing_fee_fixed_per_order = 0
WHERE code = 'AT';

-- Verify the updates
SELECT 
  code, 
  name, 
  default_currency,
  service_fee_percentage,
  service_fee_fixed_per_ticket,
  stripe_processing_fee_pct,
  paystack_processing_fee_pct
FROM public.countries 
WHERE is_active = true
ORDER BY code;
