-- Improved SMS Credit Packages for Nigerian Organizers
-- Optimized pricing tiers based on Termii costs (₦4 per SMS)

-- Clear existing packages (optional - remove if you want to keep existing)
-- DELETE FROM sms_credit_packages WHERE is_active = true;

-- Insert new competitive packages
INSERT INTO sms_credit_packages (name, credits, price, bonus_credits, is_popular, is_active, sort_order) VALUES
-- Starter Packages
('Starter Pack', 100, 800, 0, false, true, 1),
('Basic Pack', 250, 1800, 25, false, true, 2),

-- Popular Packages (Best Value)
('Popular Pack', 500, 3200, 100, true, true, 3),
('Growth Pack', 1000, 6000, 250, true, true, 4),

-- Business Packages
('Business Pack', 2500, 14000, 750, false, true, 5),
('Enterprise Pack', 5000, 26000, 2000, false, true, 6),

-- Bulk Packages
('Mega Pack', 10000, 48000, 5000, false, true, 7),
('Ultimate Pack', 25000, 110000, 15000, false, true, 8)

ON CONFLICT (name) DO UPDATE SET
  credits = EXCLUDED.credits,
  price = EXCLUDED.price,
  bonus_credits = EXCLUDED.bonus_credits,
  is_popular = EXCLUDED.is_popular,
  sort_order = EXCLUDED.sort_order;

-- Update package descriptions for better clarity
COMMENT ON TABLE sms_credit_packages IS 'SMS credit packages for Nigerian organizers - prices in Naira, optimized for Termii API costs';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sms_packages_active_sort ON sms_credit_packages (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_sms_packages_popular ON sms_credit_packages (is_popular) WHERE is_popular = true;

-- Verify the packages
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