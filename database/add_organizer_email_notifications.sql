-- Add organizer email notification setting to events table
-- Allows organizers to enable/disable email notifications for ticket purchases/RSVPs

ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS notify_organizer_on_sale BOOLEAN DEFAULT true;

-- Add comment explaining the column
COMMENT ON COLUMN public.events.notify_organizer_on_sale IS 
'When true, organizer receives email notifications for each ticket purchase/RSVP. Default is true.';

-- Update existing events to have notifications enabled (default behavior)
UPDATE public.events 
SET notify_organizer_on_sale = true 
WHERE notify_organizer_on_sale IS NULL;
