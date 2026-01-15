-- Add transfer_fee_percentage column to countries table
-- This allows admin to configure the platform fee charged on ticket transfers

-- Add the column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'countries' AND column_name = 'transfer_fee_percentage'
  ) THEN
    ALTER TABLE countries ADD COLUMN transfer_fee_percentage DECIMAL(5,2) DEFAULT 10.00;
    
    -- Add comment for documentation
    COMMENT ON COLUMN countries.transfer_fee_percentage IS 'Platform fee percentage charged on ticket transfers (e.g., 10.00 = 10%)';
  END IF;
END $$;

-- Update existing countries with default 10% if null
UPDATE countries 
SET transfer_fee_percentage = 10.00 
WHERE transfer_fee_percentage IS NULL;

-- Verify the column was added
SELECT code, name, default_currency, transfer_fee_percentage 
FROM countries 
WHERE is_active = true 
ORDER BY name;