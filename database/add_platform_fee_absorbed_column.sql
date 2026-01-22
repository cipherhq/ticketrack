-- Add platform_fee_absorbed column to orders table
-- This tracks whether the organizer absorbed the platform fee (not charged to attendee)
-- Run this in Supabase SQL Editor

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS platform_fee_absorbed BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.orders.platform_fee_absorbed IS 'True if organizer absorbed the platform fee (fee_handling = absorb), false if passed to attendee';

-- Create index for queries that filter by absorbed fees
CREATE INDEX IF NOT EXISTS idx_orders_platform_fee_absorbed 
ON public.orders(platform_fee_absorbed) 
WHERE platform_fee_absorbed = true;

-- Update existing orders to have correct value based on event fee_handling
-- This sets absorbed = true for orders where the event was set to 'absorb'
UPDATE public.orders o
SET platform_fee_absorbed = true
FROM public.events e
WHERE o.event_id = e.id
AND e.fee_handling = 'absorb'
AND o.platform_fee_absorbed IS NULL;

-- Set default for remaining orders (fee was passed to attendee)
UPDATE public.orders
SET platform_fee_absorbed = false
WHERE platform_fee_absorbed IS NULL;
