-- Add Flutterwave subaccount fields to organizers table
-- Add Paystack subaccount field as well for completeness

-- Add Flutterwave subaccount fields
ALTER TABLE public.organizers 
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_id character varying(255),
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_status character varying(50) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_onboarded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_payouts_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_charges_enabled boolean DEFAULT false;

-- Add Paystack subaccount fields (if not already present)
ALTER TABLE public.organizers 
ADD COLUMN IF NOT EXISTS paystack_subaccount_id character varying(255),
ADD COLUMN IF NOT EXISTS paystack_subaccount_status character varying(50) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS paystack_subaccount_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paystack_subaccount_onboarded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paystack_subaccount_payouts_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paystack_subaccount_charges_enabled boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN public.organizers.flutterwave_subaccount_id IS 'Flutterwave Subaccount ID for direct payouts';
COMMENT ON COLUMN public.organizers.flutterwave_subaccount_status IS 'Status: not_started, pending, active, restricted, disabled';
COMMENT ON COLUMN public.organizers.flutterwave_subaccount_enabled IS 'Admin toggle to enable/disable Flutterwave subaccount for this organizer';
COMMENT ON COLUMN public.organizers.paystack_subaccount_id IS 'Paystack Subaccount ID for direct payouts';
COMMENT ON COLUMN public.organizers.paystack_subaccount_status IS 'Status: not_started, pending, active, restricted, disabled';
COMMENT ON COLUMN public.organizers.paystack_subaccount_enabled IS 'Admin toggle to enable/disable Paystack subaccount for this organizer';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizers_flutterwave_subaccount_id ON public.organizers(flutterwave_subaccount_id) WHERE flutterwave_subaccount_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizers_paystack_subaccount_id ON public.organizers(paystack_subaccount_id) WHERE paystack_subaccount_id IS NOT NULL;