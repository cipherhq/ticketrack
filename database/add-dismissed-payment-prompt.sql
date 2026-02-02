-- Add payment prompt dismissal and snooze columns to organizers table
-- This tracks whether the organizer has dismissed or snoozed payment gateway setup prompts

-- Separate dismissal flags for each prompt type
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS dismissed_precreate_prompt BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dismissed_postcreate_prompt BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dismissed_dashboard_banner BOOLEAN DEFAULT FALSE;

-- Snooze timestamps for "Remind me later" functionality
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS precreate_prompt_snoozed_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS postcreate_prompt_snoozed_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS dashboard_banner_snoozed_until TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN public.organizers.dismissed_precreate_prompt IS 'Whether organizer permanently dismissed the pre-create event payment prompt';
COMMENT ON COLUMN public.organizers.dismissed_postcreate_prompt IS 'Whether organizer permanently dismissed the post-create event payment prompt';
COMMENT ON COLUMN public.organizers.dismissed_dashboard_banner IS 'Whether organizer permanently dismissed the dashboard payment banner';
COMMENT ON COLUMN public.organizers.precreate_prompt_snoozed_until IS 'Timestamp until which the pre-create prompt is snoozed';
COMMENT ON COLUMN public.organizers.postcreate_prompt_snoozed_until IS 'Timestamp until which the post-create prompt is snoozed';
COMMENT ON COLUMN public.organizers.dashboard_banner_snoozed_until IS 'Timestamp until which the dashboard banner is snoozed';

-- Remove old column if it exists (from previous migration)
-- ALTER TABLE public.organizers DROP COLUMN IF EXISTS dismissed_payment_prompt;
