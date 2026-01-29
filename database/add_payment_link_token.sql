-- Add payment_link_token column to orders table
-- This token is used for payment link functionality where organizers can send
-- a payment link to attendees for completing their purchase

-- Add the column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_link_token VARCHAR(64);

-- Add unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_link_token
ON orders(payment_link_token)
WHERE payment_link_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN orders.payment_link_token IS 'Unique token for payment link functionality. Used when organizer sends payment link to attendee.';
