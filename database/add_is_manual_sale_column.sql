-- Add missing columns to orders table for manual ticket issuance

-- Add organizer_id column (references organizers table)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS organizer_id UUID REFERENCES organizers(id);

-- Add is_manual_sale column to track manually issued tickets
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_manual_sale BOOLEAN DEFAULT false;

-- Add index for organizer lookups
CREATE INDEX IF NOT EXISTS idx_orders_organizer_id ON orders(organizer_id);

-- Add index for filtering manual sales
CREATE INDEX IF NOT EXISTS idx_orders_is_manual_sale ON orders(is_manual_sale) WHERE is_manual_sale = true;
