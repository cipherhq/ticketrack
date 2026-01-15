-- Add multi-currency support to affiliate_settings table
-- Run this in Supabase SQL Editor

-- Add new currency columns if they don't exist
DO $$ 
BEGIN
  -- Add min_payout_ngn (rename from min_payout for clarity)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_settings' AND column_name = 'min_payout_ngn'
  ) THEN
    ALTER TABLE affiliate_settings ADD COLUMN min_payout_ngn DECIMAL(15,2) DEFAULT 5000;
  END IF;

  -- Add min_payout_ghs for Ghana
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_settings' AND column_name = 'min_payout_ghs'
  ) THEN
    ALTER TABLE affiliate_settings ADD COLUMN min_payout_ghs DECIMAL(15,2) DEFAULT 50;
  END IF;

  -- Add min_payout_cad for Canada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_settings' AND column_name = 'min_payout_cad'
  ) THEN
    ALTER TABLE affiliate_settings ADD COLUMN min_payout_cad DECIMAL(15,2) DEFAULT 15;
  END IF;

  -- Ensure min_payout_usd exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_settings' AND column_name = 'min_payout_usd'
  ) THEN
    ALTER TABLE affiliate_settings ADD COLUMN min_payout_usd DECIMAL(15,2) DEFAULT 10;
  END IF;

  -- Ensure min_payout_gbp exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'affiliate_settings' AND column_name = 'min_payout_gbp'
  ) THEN
    ALTER TABLE affiliate_settings ADD COLUMN min_payout_gbp DECIMAL(15,2) DEFAULT 8;
  END IF;
END $$;

-- Copy existing min_payout to min_payout_ngn if min_payout_ngn is null
UPDATE affiliate_settings 
SET min_payout_ngn = COALESCE(min_payout, 5000)
WHERE min_payout_ngn IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN affiliate_settings.min_payout_ngn IS 'Minimum payout threshold in Nigerian Naira';
COMMENT ON COLUMN affiliate_settings.min_payout_usd IS 'Minimum payout threshold in US Dollars';
COMMENT ON COLUMN affiliate_settings.min_payout_gbp IS 'Minimum payout threshold in British Pounds';
COMMENT ON COLUMN affiliate_settings.min_payout_ghs IS 'Minimum payout threshold in Ghanaian Cedi';
COMMENT ON COLUMN affiliate_settings.min_payout_cad IS 'Minimum payout threshold in Canadian Dollars';

-- Also ensure referral_earnings has currency column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'referral_earnings' AND column_name = 'currency'
  ) THEN
    ALTER TABLE referral_earnings ADD COLUMN currency VARCHAR(3) DEFAULT 'NGN';
  END IF;
END $$;

-- Verify the changes
SELECT 'Affiliate Settings Columns:' as info;
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'affiliate_settings'
ORDER BY ordinal_position;

-- Show current settings
SELECT 'Current Settings:' as info;
SELECT 
  is_enabled,
  commission_percent,
  min_payout_ngn,
  min_payout_usd,
  min_payout_gbp,
  min_payout_ghs,
  min_payout_cad,
  cookie_days,
  payout_delay_days
FROM affiliate_settings
LIMIT 1;
