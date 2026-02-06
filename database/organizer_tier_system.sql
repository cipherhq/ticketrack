-- ============================================
-- ORGANIZER TIER & DIRECT PAYOUT SYSTEM
-- ============================================
-- Automatic tier calculation based on performance
-- Direct payout gating until 5 completed events
-- ============================================

-- ============================================
-- 1. ADD NEW FIELDS TO ORGANIZERS TABLE
-- ============================================

-- Completed events tracking
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS completed_events_count INTEGER DEFAULT 0;

-- Organizer tier (auto-calculated)
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS organizer_tier VARCHAR(20) DEFAULT 'emerging';

-- Tier calculation timestamp
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS tier_calculated_at TIMESTAMPTZ;

-- Direct payout eligibility
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS direct_payout_eligible BOOLEAN DEFAULT FALSE;

-- Admin override for direct payout (bypass 5-event requirement)
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS direct_payout_override BOOLEAN DEFAULT FALSE;

ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS direct_payout_override_by UUID REFERENCES auth.users(id);

ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS direct_payout_override_at TIMESTAMPTZ;

ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS direct_payout_override_reason TEXT;

-- Performance metrics (cached for quick access)
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS refund_rate NUMERIC(5,2) DEFAULT 0;

ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS cancellation_rate NUMERIC(5,2) DEFAULT 0;

ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS chargeback_count INTEGER DEFAULT 0;

-- Required events for direct payout (configurable per organizer)
ALTER TABLE public.organizers
ADD COLUMN IF NOT EXISTS required_events_for_payout INTEGER DEFAULT 5;

-- Comments
COMMENT ON COLUMN public.organizers.organizer_tier IS 'Auto-calculated: emerging, established, premier';
COMMENT ON COLUMN public.organizers.direct_payout_eligible IS 'True when completed_events >= required_events OR admin override';
COMMENT ON COLUMN public.organizers.direct_payout_override IS 'Admin can bypass the event requirement';

-- ============================================
-- 2. FUNCTION: Calculate Organizer Metrics
-- ============================================
CREATE OR REPLACE FUNCTION calculate_organizer_metrics(p_organizer_id UUID)
RETURNS JSON AS $$
DECLARE
    v_completed_events INTEGER;
    v_cancelled_events INTEGER;
    v_total_events INTEGER;
    v_total_orders INTEGER;
    v_refunded_orders INTEGER;
    v_refund_rate NUMERIC(5,2);
    v_cancellation_rate NUMERIC(5,2);
    v_total_revenue NUMERIC(15,2);
    v_total_tickets INTEGER;
BEGIN
    -- Count completed events (events that have ended and weren't cancelled)
    SELECT COUNT(*) INTO v_completed_events
    FROM public.events
    WHERE organizer_id = p_organizer_id
    AND status = 'published'
    AND end_date < NOW()
    AND cancelled_at IS NULL;

    -- Count cancelled events
    SELECT COUNT(*) INTO v_cancelled_events
    FROM public.events
    WHERE organizer_id = p_organizer_id
    AND (status = 'cancelled' OR cancelled_at IS NOT NULL);

    -- Count total events (excluding drafts)
    SELECT COUNT(*) INTO v_total_events
    FROM public.events
    WHERE organizer_id = p_organizer_id
    AND status != 'draft';

    -- Count total completed orders
    SELECT COUNT(*) INTO v_total_orders
    FROM public.orders o
    JOIN public.events e ON o.event_id = e.id
    WHERE e.organizer_id = p_organizer_id
    AND o.status = 'completed';

    -- Count refunded orders
    SELECT COUNT(*) INTO v_refunded_orders
    FROM public.orders o
    JOIN public.events e ON o.event_id = e.id
    WHERE e.organizer_id = p_organizer_id
    AND o.status IN ('refunded', 'partially_refunded');

    -- Calculate refund rate
    IF v_total_orders > 0 THEN
        v_refund_rate := (v_refunded_orders::NUMERIC / v_total_orders::NUMERIC) * 100;
    ELSE
        v_refund_rate := 0;
    END IF;

    -- Calculate cancellation rate
    IF v_total_events > 0 THEN
        v_cancellation_rate := (v_cancelled_events::NUMERIC / v_total_events::NUMERIC) * 100;
    ELSE
        v_cancellation_rate := 0;
    END IF;

    -- Calculate total revenue
    SELECT COALESCE(SUM(o.total_amount), 0) INTO v_total_revenue
    FROM public.orders o
    JOIN public.events e ON o.event_id = e.id
    WHERE e.organizer_id = p_organizer_id
    AND o.status = 'completed';

    -- Calculate total tickets sold
    SELECT COALESCE(SUM(t.quantity), 0) INTO v_total_tickets
    FROM public.order_items t
    JOIN public.orders o ON t.order_id = o.id
    JOIN public.events e ON o.event_id = e.id
    WHERE e.organizer_id = p_organizer_id
    AND o.status = 'completed';

    RETURN json_build_object(
        'completed_events', v_completed_events,
        'cancelled_events', v_cancelled_events,
        'total_events', v_total_events,
        'total_orders', v_total_orders,
        'refunded_orders', v_refunded_orders,
        'refund_rate', ROUND(v_refund_rate, 2),
        'cancellation_rate', ROUND(v_cancellation_rate, 2),
        'total_revenue', v_total_revenue,
        'total_tickets', v_total_tickets
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. FUNCTION: Calculate & Update Organizer Tier
-- ============================================
CREATE OR REPLACE FUNCTION update_organizer_tier(p_organizer_id UUID)
RETURNS JSON AS $$
DECLARE
    v_metrics JSON;
    v_completed_events INTEGER;
    v_refund_rate NUMERIC(5,2);
    v_cancellation_rate NUMERIC(5,2);
    v_new_tier VARCHAR(20);
    v_direct_payout_eligible BOOLEAN;
    v_required_events INTEGER;
    v_has_override BOOLEAN;
BEGIN
    -- Get metrics
    v_metrics := calculate_organizer_metrics(p_organizer_id);
    v_completed_events := (v_metrics->>'completed_events')::INTEGER;
    v_refund_rate := (v_metrics->>'refund_rate')::NUMERIC;
    v_cancellation_rate := (v_metrics->>'cancellation_rate')::NUMERIC;

    -- Get organizer settings
    SELECT required_events_for_payout, direct_payout_override
    INTO v_required_events, v_has_override
    FROM public.organizers
    WHERE id = p_organizer_id;

    v_required_events := COALESCE(v_required_events, 5);

    -- Calculate tier based on metrics
    IF v_completed_events >= 10 AND v_refund_rate <= 2 AND v_cancellation_rate <= 5 THEN
        v_new_tier := 'premier';
    ELSIF v_completed_events >= 3 AND v_refund_rate <= 5 AND v_cancellation_rate <= 10 THEN
        v_new_tier := 'established';
    ELSE
        v_new_tier := 'emerging';
    END IF;

    -- Check direct payout eligibility
    v_direct_payout_eligible := v_has_override OR (v_completed_events >= v_required_events);

    -- Update organizer record
    UPDATE public.organizers
    SET
        completed_events_count = v_completed_events,
        organizer_tier = v_new_tier,
        refund_rate = v_refund_rate,
        cancellation_rate = v_cancellation_rate,
        direct_payout_eligible = v_direct_payout_eligible,
        tier_calculated_at = NOW(),
        total_events = (v_metrics->>'total_events')::INTEGER,
        total_tickets_sold = (v_metrics->>'total_tickets')::INTEGER,
        total_revenue = (v_metrics->>'total_revenue')::NUMERIC
    WHERE id = p_organizer_id;

    RETURN json_build_object(
        'organizer_id', p_organizer_id,
        'tier', v_new_tier,
        'completed_events', v_completed_events,
        'refund_rate', v_refund_rate,
        'cancellation_rate', v_cancellation_rate,
        'direct_payout_eligible', v_direct_payout_eligible,
        'metrics', v_metrics
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. FUNCTION: Admin Override Direct Payout
-- ============================================
CREATE OR REPLACE FUNCTION admin_override_direct_payout(
    p_organizer_id UUID,
    p_admin_id UUID,
    p_enable BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    UPDATE public.organizers
    SET
        direct_payout_override = p_enable,
        direct_payout_override_by = CASE WHEN p_enable THEN p_admin_id ELSE NULL END,
        direct_payout_override_at = CASE WHEN p_enable THEN NOW() ELSE NULL END,
        direct_payout_override_reason = p_reason,
        direct_payout_eligible = p_enable OR (completed_events_count >= required_events_for_payout)
    WHERE id = p_organizer_id;

    -- Log the action
    INSERT INTO public.admin_audit_logs (
        admin_id, action, entity_type, entity_id, details
    ) VALUES (
        p_admin_id,
        CASE WHEN p_enable THEN 'direct_payout_enabled' ELSE 'direct_payout_disabled' END,
        'organizer',
        p_organizer_id,
        jsonb_build_object('reason', p_reason, 'override', p_enable)
    );

    RETURN json_build_object(
        'success', true,
        'organizer_id', p_organizer_id,
        'direct_payout_override', p_enable,
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGER: Auto-update tier when event ends
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_organizer_tier_on_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Update tier when event status changes or event ends
    IF (TG_OP = 'UPDATE') THEN
        -- Event was cancelled
        IF NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN
            PERFORM update_organizer_tier(NEW.organizer_id);
        -- Event status changed to completed or published event ended
        ELSIF NEW.status = 'completed' AND OLD.status != 'completed' THEN
            PERFORM update_organizer_tier(NEW.organizer_id);
        -- Event end_date passed (check on any update)
        ELSIF NEW.end_date < NOW() AND OLD.end_date >= NOW() THEN
            PERFORM update_organizer_tier(NEW.organizer_id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_organizer_tier_update ON public.events;
CREATE TRIGGER trigger_organizer_tier_update
    AFTER UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_organizer_tier_on_event();

-- ============================================
-- 6. TRIGGER: Auto-update tier on refund
-- ============================================
CREATE OR REPLACE FUNCTION trigger_update_organizer_tier_on_refund()
RETURNS TRIGGER AS $$
DECLARE
    v_organizer_id UUID;
BEGIN
    -- Get organizer_id from the order's event
    SELECT e.organizer_id INTO v_organizer_id
    FROM public.orders o
    JOIN public.events e ON o.event_id = e.id
    WHERE o.id = NEW.order_id;

    IF v_organizer_id IS NOT NULL THEN
        PERFORM update_organizer_tier(v_organizer_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger (only if refund_requests table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refund_requests') THEN
        DROP TRIGGER IF EXISTS trigger_organizer_tier_on_refund ON public.refund_requests;
        CREATE TRIGGER trigger_organizer_tier_on_refund
            AFTER INSERT OR UPDATE ON public.refund_requests
            FOR EACH ROW
            WHEN (NEW.status IN ('approved', 'processed'))
            EXECUTE FUNCTION trigger_update_organizer_tier_on_refund();
    END IF;
END $$;

-- ============================================
-- 7. FUNCTION: Batch update all organizer tiers
-- ============================================
CREATE OR REPLACE FUNCTION batch_update_all_organizer_tiers()
RETURNS JSON AS $$
DECLARE
    v_organizer RECORD;
    v_updated INTEGER := 0;
BEGIN
    FOR v_organizer IN
        SELECT id FROM public.organizers WHERE is_active = true
    LOOP
        PERFORM update_organizer_tier(v_organizer.id);
        v_updated := v_updated + 1;
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'organizers_updated', v_updated,
        'updated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. VIEW: Organizer tier summary
-- ============================================
CREATE OR REPLACE VIEW public.organizer_tier_summary AS
SELECT
    o.id,
    o.business_name,
    o.organizer_tier,
    o.completed_events_count,
    o.refund_rate,
    o.cancellation_rate,
    o.direct_payout_eligible,
    o.direct_payout_override,
    o.required_events_for_payout,
    o.total_events,
    o.total_tickets_sold,
    o.total_revenue,
    o.tier_calculated_at,
    o.created_at,
    CASE
        WHEN o.direct_payout_override THEN 'Admin Override'
        WHEN o.completed_events_count >= o.required_events_for_payout THEN 'Unlocked'
        ELSE 'Locked (' || o.completed_events_count || '/' || o.required_events_for_payout || ' events)'
    END AS payout_status,
    o.required_events_for_payout - o.completed_events_count AS events_until_unlock
FROM public.organizers o
WHERE o.is_active = true;

-- ============================================
-- 9. INDEX for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_organizers_tier ON public.organizers(organizer_tier);
CREATE INDEX IF NOT EXISTS idx_organizers_payout_eligible ON public.organizers(direct_payout_eligible);
CREATE INDEX IF NOT EXISTS idx_events_organizer_status ON public.events(organizer_id, status);

-- ============================================
-- 10. INITIAL DATA: Update all existing organizers
-- ============================================
-- Run this once to calculate tiers for existing organizers
-- SELECT batch_update_all_organizer_tiers();

COMMENT ON FUNCTION calculate_organizer_metrics IS 'Calculate performance metrics for an organizer';
COMMENT ON FUNCTION update_organizer_tier IS 'Calculate and update organizer tier based on metrics';
COMMENT ON FUNCTION admin_override_direct_payout IS 'Admin function to override direct payout requirement';
COMMENT ON FUNCTION batch_update_all_organizer_tiers IS 'Update tiers for all active organizers';
