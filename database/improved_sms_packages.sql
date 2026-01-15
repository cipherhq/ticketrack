-- Improved SMS Credit Packages for Nigerian Organizers
-- Optimized pricing tiers based on Termii costs (₦4 per SMS)
-- Safe approach: Keep existing packages, add new ones, mark old ones as inactive

-- First, deactivate all existing packages (don't delete due to foreign keys)
UPDATE sms_credit_packages SET is_active = false WHERE is_active = true;

-- Insert new competitive packages with unique names to avoid conflicts
INSERT INTO sms_credit_packages (name, credits, price, bonus_credits, is_popular, is_active, sort_order) VALUES
-- Starter Packages
('Starter Pack 2024', 100, 800, 0, false, true, 1),
('Basic Pack 2024', 250, 1800, 25, false, true, 2),

-- Popular Packages (Best Value)
('Popular Pack 2024', 500, 3200, 100, true, true, 3),
('Growth Pack 2024', 1000, 6000, 250, true, true, 4),

-- Business Packages
('Business Pack 2024', 2500, 14000, 750, false, true, 5),
('Enterprise Pack 2024', 5000, 26000, 2000, false, true, 6),

-- Bulk Packages
('Mega Pack 2024', 10000, 48000, 5000, false, true, 7),
('Ultimate Pack 2024', 25000, 110000, 15000, false, true, 8)

ON CONFLICT DO NOTHING;

-- Update package descriptions for better clarity
COMMENT ON TABLE sms_credit_packages IS 'SMS credit packages for Nigerian organizers - prices in Naira, optimized for Termii API costs';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sms_packages_active_sort ON sms_credit_packages (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_sms_packages_popular ON sms_credit_packages (is_popular) WHERE is_popular = true;

-- Show current package status
SELECT 
  'ACTIVE PACKAGES' as status,
  COUNT(*) as count
FROM sms_credit_packages 
WHERE is_active = true;

-- Verify the new packages
SELECT 
  name,
  credits,
  price,
  bonus_credits,
  (credits + bonus_credits) as total_credits,
  ROUND(price::numeric / (credits + bonus_credits), 2) as price_per_sms,
  ROUND(((credits + bonus_credits) * 4)::numeric, 2) as our_cost,
  ROUND((price - (credits + bonus_credits) * 4)::numeric, 2) as profit,
  is_popular,
  sort_order
FROM sms_credit_packages 
WHERE is_active = true 
ORDER BY sort_order;

-- Show old packages (now inactive but still referenced)
SELECT 
  'INACTIVE PACKAGES (Historical)' as status,
  COUNT(*) as count
FROM sms_credit_packages 
WHERE is_active = false;