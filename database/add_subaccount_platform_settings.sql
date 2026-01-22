-- Add platform settings for Paystack and Flutterwave subaccount fees
-- Run this in Supabase SQL Editor

-- Paystack subaccount platform fee percentage
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'paystack_subaccount_platform_fee_percentage',
  '5',
  'Platform fee percentage for Paystack subaccounts (organizer gets 100% - this percentage)',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Flutterwave subaccount platform fee percentage
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'flutterwave_subaccount_platform_fee_percentage',
  '5',
  'Platform fee percentage for Flutterwave subaccounts (organizer gets 100% - this percentage)',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Enable Paystack subaccounts globally
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'paystack_subaccount_enabled',
  'true',
  'Enable Paystack subaccount feature for Nigerian organizers',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Enable Flutterwave subaccounts globally  
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'flutterwave_subaccount_enabled',
  'true',
  'Enable Flutterwave subaccount feature for Ghana/Kenya/SA organizers',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Eligible countries for Paystack subaccounts (JSON array)
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'paystack_subaccount_countries',
  '["NG"]',
  'Countries eligible for Paystack subaccounts (JSON array of country codes)',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Eligible countries for Flutterwave subaccounts (JSON array)
INSERT INTO platform_settings (key, value, description, updated_at)
VALUES (
  'flutterwave_subaccount_countries',
  '["NG","GH","KE","ZA"]',
  'Countries eligible for Flutterwave subaccounts (JSON array of country codes)',
  NOW()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
