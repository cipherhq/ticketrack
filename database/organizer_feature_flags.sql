-- ============================================
-- ORGANIZER FEATURE FLAGS SYSTEM
-- ============================================
-- Allows admins to enable/disable features per organizer
-- ============================================

-- ============================================
-- 1. ADD FEATURE FLAG FIELDS TO ORGANIZERS
-- ============================================

-- SMS notifications
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_sms_enabled BOOLEAN DEFAULT TRUE;

-- WhatsApp notifications
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_whatsapp_enabled BOOLEAN DEFAULT TRUE;

-- Email notifications (rarely disabled, but option exists)
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_email_enabled BOOLEAN DEFAULT TRUE;

-- Direct payment (Stripe Connect / Paystack / Flutterwave subaccounts)
-- When disabled, organizer uses escrow payout only
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_direct_payment_enabled BOOLEAN DEFAULT TRUE;

-- Group buy / split payments
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_group_buy_enabled BOOLEAN DEFAULT TRUE;

-- Promoter/affiliate system
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_promoters_enabled BOOLEAN DEFAULT TRUE;

-- Custom event URLs
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_custom_urls_enabled BOOLEAN DEFAULT TRUE;

-- Discount codes
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_discount_codes_enabled BOOLEAN DEFAULT TRUE;

-- Waitlist feature
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_waitlist_enabled BOOLEAN DEFAULT TRUE;

-- Reserved seating (not implemented yet - commented out)
-- ALTER TABLE public.organizers
-- ADD COLUMN IF NOT EXISTS feature_reserved_seating_enabled BOOLEAN DEFAULT TRUE;

-- Multi-day events
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_multiday_events_enabled BOOLEAN DEFAULT TRUE;

-- Recurring events
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_recurring_events_enabled BOOLEAN DEFAULT TRUE;

-- Event sponsors section
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_sponsors_enabled BOOLEAN DEFAULT TRUE;

-- Fast payout (instant/same-day payouts)
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_fast_payout_enabled BOOLEAN DEFAULT TRUE;

-- Payment links
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_payment_links_enabled BOOLEAN DEFAULT TRUE;

-- Feature flags metadata (who disabled and why)
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_flags_updated_by UUID REFERENCES auth.users(id);

ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS feature_flags_updated_at TIMESTAMPTZ;

-- ============================================
-- 2. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON COLUMN public.organizers.feature_sms_enabled IS 'Enable/disable SMS notifications for this organizer';
COMMENT ON COLUMN public.organizers.feature_whatsapp_enabled IS 'Enable/disable WhatsApp notifications for this organizer';
COMMENT ON COLUMN public.organizers.feature_email_enabled IS 'Enable/disable email notifications for this organizer';
COMMENT ON COLUMN public.organizers.feature_direct_payment_enabled IS 'Enable/disable direct payment (Stripe Connect/Paystack/Flutterwave). When disabled, uses escrow only.';
COMMENT ON COLUMN public.organizers.feature_group_buy_enabled IS 'Enable/disable group buy / split payment feature';
COMMENT ON COLUMN public.organizers.feature_promoters_enabled IS 'Enable/disable promoter/affiliate system';
COMMENT ON COLUMN public.organizers.feature_custom_urls_enabled IS 'Enable/disable custom event URLs';
COMMENT ON COLUMN public.organizers.feature_discount_codes_enabled IS 'Enable/disable discount/promo codes';
COMMENT ON COLUMN public.organizers.feature_waitlist_enabled IS 'Enable/disable waitlist feature';
-- COMMENT ON COLUMN public.organizers.feature_reserved_seating_enabled IS 'Enable/disable reserved seating'; -- not implemented yet
COMMENT ON COLUMN public.organizers.feature_multiday_events_enabled IS 'Enable/disable multi-day events';
COMMENT ON COLUMN public.organizers.feature_recurring_events_enabled IS 'Enable/disable recurring events';
COMMENT ON COLUMN public.organizers.feature_sponsors_enabled IS 'Enable/disable event sponsors section';
COMMENT ON COLUMN public.organizers.feature_fast_payout_enabled IS 'Enable/disable fast/instant payouts';
COMMENT ON COLUMN public.organizers.feature_payment_links_enabled IS 'Enable/disable payment links feature';

-- ============================================
-- 3. FUNCTION: Update organizer feature flags
-- ============================================

CREATE OR REPLACE FUNCTION update_organizer_feature_flags(
    p_organizer_id UUID,
    p_admin_id UUID,
    p_flags JSONB
)
RETURNS JSON AS $$
DECLARE
    v_key TEXT;
    v_value BOOLEAN;
    v_sql TEXT;
    v_changes JSONB := '{}';
BEGIN
    -- Loop through each flag in the JSONB object
    FOR v_key, v_value IN SELECT * FROM jsonb_each(p_flags)
    LOOP
        -- Only update valid feature flag columns
        IF v_key IN (
            'feature_sms_enabled',
            'feature_whatsapp_enabled',
            'feature_email_enabled',
            'feature_direct_payment_enabled',
            'feature_group_buy_enabled',
            'feature_promoters_enabled',
            'feature_custom_urls_enabled',
            'feature_discount_codes_enabled',
            'feature_waitlist_enabled',
            -- 'feature_reserved_seating_enabled', -- not implemented yet
            'feature_multiday_events_enabled',
            'feature_recurring_events_enabled',
            'feature_sponsors_enabled',
            'feature_fast_payout_enabled',
            'feature_payment_links_enabled'
        ) THEN
            -- Build and execute dynamic SQL
            EXECUTE format(
                'UPDATE public.organizers SET %I = $1, feature_flags_updated_by = $2, feature_flags_updated_at = NOW() WHERE id = $3',
                v_key
            ) USING (v_value::TEXT)::BOOLEAN, p_admin_id, p_organizer_id;

            v_changes := v_changes || jsonb_build_object(v_key, v_value);
        END IF;
    END LOOP;

    -- Log the action
    INSERT INTO public.admin_audit_logs (
        admin_id, action, entity_type, entity_id, details
    ) VALUES (
        p_admin_id,
        'feature_flags_updated',
        'organizer',
        p_organizer_id,
        jsonb_build_object('changes', v_changes)
    );

    RETURN json_build_object(
        'success', true,
        'organizer_id', p_organizer_id,
        'changes', v_changes
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. VIEW: Organizer feature flags summary
-- ============================================

CREATE OR REPLACE VIEW public.organizer_feature_flags_summary AS
SELECT
    o.id,
    o.business_name,
    o.feature_sms_enabled,
    o.feature_whatsapp_enabled,
    o.feature_email_enabled,
    o.feature_direct_payment_enabled,
    o.feature_group_buy_enabled,
    o.feature_promoters_enabled,
    o.feature_custom_urls_enabled,
    o.feature_discount_codes_enabled,
    o.feature_waitlist_enabled,
    -- o.feature_reserved_seating_enabled, -- not implemented yet
    o.feature_multiday_events_enabled,
    o.feature_recurring_events_enabled,
    o.feature_sponsors_enabled,
    o.feature_fast_payout_enabled,
    o.feature_payment_links_enabled,
    o.feature_flags_updated_at,
    -- Count disabled features
    (
        CASE WHEN NOT COALESCE(o.feature_sms_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_whatsapp_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_email_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_direct_payment_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_group_buy_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_promoters_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_custom_urls_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_discount_codes_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_waitlist_enabled, TRUE) THEN 1 ELSE 0 END +
        -- CASE WHEN NOT COALESCE(o.feature_reserved_seating_enabled, TRUE) THEN 1 ELSE 0 END + -- not implemented yet
        CASE WHEN NOT COALESCE(o.feature_multiday_events_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_recurring_events_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_sponsors_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_fast_payout_enabled, TRUE) THEN 1 ELSE 0 END +
        CASE WHEN NOT COALESCE(o.feature_payment_links_enabled, TRUE) THEN 1 ELSE 0 END
    ) AS disabled_features_count
FROM public.organizers o
WHERE o.is_active = true;

COMMENT ON FUNCTION update_organizer_feature_flags IS 'Admin function to update feature flags for an organizer';
