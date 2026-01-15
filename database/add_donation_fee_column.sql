-- Add donation_fee_percentage column to countries table
-- This allows admin to configure the platform fee charged on donations for free events

-- Add the column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'countries' AND column_name = 'donation_fee_percentage'
  ) THEN
    ALTER TABLE countries ADD COLUMN donation_fee_percentage DECIMAL(5,2) DEFAULT 5.00;
    
    -- Add comment for documentation
    COMMENT ON COLUMN countries.donation_fee_percentage IS 'Platform fee percentage charged on donations for free events (e.g., 5.00 = 5%)';
  END IF;
END $$;

-- Update existing countries with default 5% if null
UPDATE countries 
SET donation_fee_percentage = 5.00 
WHERE donation_fee_percentage IS NULL;

-- Verify the column was added
SELECT code, name, default_currency, donation_fee_percentage 
FROM countries 
WHERE is_active = true 
ORDER BY name;
