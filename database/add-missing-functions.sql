-- ============================================================================
-- ADD MISSING FUNCTIONS TO DEV DATABASE
-- ============================================================================
-- This script adds 36 functions that exist in production but are missing in dev
-- Run this in DEV Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- FUNCTION 1: advance_drip_enrollment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.advance_drip_enrollment(p_enrollment_id uuid, p_execution_status character varying DEFAULT 'sent'::character varying)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_enrollment RECORD;
    v_current_step RECORD;
    v_next_step RECORD;
    v_next_step_at TIMESTAMPTZ;
BEGIN
    -- Get enrollment
    SELECT * INTO v_enrollment FROM drip_enrollments WHERE id = p_enrollment_id;
    IF v_enrollment IS NULL THEN RETURN; END IF;
    
    -- Get current step
    SELECT * INTO v_current_step FROM drip_campaign_steps WHERE id = v_enrollment.current_step_id;
    
    -- Record execution
    INSERT INTO drip_step_executions (
        enrollment_id, step_id, campaign_id, contact_id, organizer_id, status
    )
    VALUES (
        p_enrollment_id, v_current_step.id, v_enrollment.campaign_id, 
        v_enrollment.contact_id, v_enrollment.organizer_id, p_execution_status
    );
    
    -- Update step stats
    UPDATE drip_campaign_steps
    SET total_sent = total_sent + 1, updated_at = NOW()
    WHERE id = v_current_step.id;
    
    -- Get next step
    SELECT * INTO v_next_step 
    FROM drip_campaign_steps 
    WHERE campaign_id = v_enrollment.campaign_id 
      AND step_number > v_current_step.step_number
      AND is_active = TRUE
    ORDER BY step_number 
    LIMIT 1;
    
    IF v_next_step IS NULL THEN
        -- Campaign complete
        UPDATE drip_enrollments
        SET status = 'completed',
            completed_at = NOW(),
            current_step_id = NULL,
            next_step_at = NULL,
            step_history = step_history || jsonb_build_object(
                'step_id', v_current_step.id,
                'executed_at', NOW(),
                'result', p_execution_status
            ),
            updated_at = NOW()
        WHERE id = p_enrollment_id;
        
        UPDATE drip_campaigns
        SET total_completed = total_completed + 1, updated_at = NOW()
        WHERE id = v_enrollment.campaign_id;
    ELSE
        -- Move to next step
        v_next_step_at := CASE v_next_step.delay_type
            WHEN 'immediate' THEN NOW()
            WHEN 'delay' THEN NOW() + (v_next_step.delay_value || ' ' || v_next_step.delay_unit)::INTERVAL
            ELSE NOW() + INTERVAL '1 minute'
        END;
        
        UPDATE drip_enrollments
        SET current_step_id = v_next_step.id,
            current_step_number = v_next_step.step_number,
            next_step_at = v_next_step_at,
            step_history = step_history || jsonb_build_object(
                'step_id', v_current_step.id,
                'executed_at', NOW(),
                'result', p_execution_status
            ),
            updated_at = NOW()
        WHERE id = p_enrollment_id;
    END IF;
END;
$function$;

-- ============================================================================
-- FUNCTION 2: calculate_contact_engagement
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_contact_engagement(p_contact_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_organizer_id UUID;
    v_email_opens INTEGER;
    v_clicks INTEGER;
    v_last_open TIMESTAMPTZ;
    v_last_click TIMESTAMPTZ;
    v_days_since_engagement INTEGER;
    v_engagement_score INTEGER;
    v_engagement_level VARCHAR(20);
BEGIN
    SELECT organizer_id INTO v_organizer_id FROM contacts WHERE id = p_contact_id;
    IF v_organizer_id IS NULL THEN RETURN; END IF;

    -- Get email engagement from tracking events
    SELECT 
        COUNT(*) FILTER (WHERE event_type = 'open'),
        COUNT(*) FILTER (WHERE event_type = 'click'),
        MAX(first_event_at) FILTER (WHERE event_type = 'open'),
        MAX(first_event_at) FILTER (WHERE event_type = 'click')
    INTO v_email_opens, v_clicks, v_last_open, v_last_click
    FROM email_tracking_events
    WHERE organizer_id = v_organizer_id
      AND recipient_email = (SELECT email FROM contacts WHERE id = p_contact_id);

    -- Calculate days since last engagement
    v_days_since_engagement := COALESCE(
        EXTRACT(DAY FROM NOW() - GREATEST(v_last_open, v_last_click))::INTEGER, 
        999
    );

    -- Calculate engagement score (0-100)
    -- Components: opens (40%), clicks (40%), recency (20%)
    v_engagement_score := LEAST(100, (
        LEAST(v_email_opens, 10) * 4 +  -- Up to 40 points for opens
        LEAST(v_clicks, 10) * 4 +        -- Up to 40 points for clicks
        CASE                              -- Up to 20 points for recency
            WHEN v_days_since_engagement <= 7 THEN 20
            WHEN v_days_since_engagement <= 14 THEN 15
            WHEN v_days_since_engagement <= 30 THEN 10
            WHEN v_days_since_engagement <= 60 THEN 5
            ELSE 0
        END
    ));

    -- Determine engagement level
    v_engagement_level := CASE
        WHEN v_engagement_score >= 70 THEN 'highly_engaged'
        WHEN v_engagement_score >= 40 THEN 'engaged'
        WHEN v_engagement_score >= 20 THEN 'passive'
        ELSE 'disengaged'
    END;

    -- Upsert scores
    INSERT INTO contact_scores (
        contact_id, organizer_id,
        engagement_score, engagement_level,
        total_emails_opened, total_clicks,
        last_email_open_at, last_click_at,
        calculated_at
    )
    VALUES (
        p_contact_id, v_organizer_id,
        v_engagement_score, v_engagement_level,
        v_email_opens, v_clicks,
        v_last_open, v_last_click,
        NOW()
    )
    ON CONFLICT (contact_id) DO UPDATE SET
        engagement_score = EXCLUDED.engagement_score,
        engagement_level = EXCLUDED.engagement_level,
        total_emails_opened = EXCLUDED.total_emails_opened,
        total_clicks = EXCLUDED.total_clicks,
        last_email_open_at = EXCLUDED.last_email_open_at,
        last_click_at = EXCLUDED.last_click_at,
        calculated_at = NOW(),
        updated_at = NOW();
END;
$function$;

-- ============================================================================
-- FUNCTION 3: calculate_contact_rfm
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_contact_rfm(p_contact_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_organizer_id UUID;
    v_last_purchase TIMESTAMPTZ;
    v_total_purchases INTEGER;
    v_total_spent NUMERIC;
    v_days_since_purchase INTEGER;
    v_recency INTEGER;
    v_frequency INTEGER;
    v_monetary INTEGER;
    v_segment VARCHAR(50);
BEGIN
    -- Get organizer ID
    SELECT organizer_id INTO v_organizer_id FROM contacts WHERE id = p_contact_id;
    IF v_organizer_id IS NULL THEN RETURN; END IF;

    -- Get purchase metrics from tickets
    SELECT 
        MAX(t.created_at),
        COUNT(DISTINCT t.id),
        COALESCE(SUM(t.total_amount), 0)
    INTO v_last_purchase, v_total_purchases, v_total_spent
    FROM tickets t
    JOIN contacts c ON (c.email = t.attendee_email OR c.phone = t.attendee_phone)
    WHERE c.id = p_contact_id
      AND t.payment_status = 'completed';

    -- Calculate days since last purchase
    v_days_since_purchase := COALESCE(EXTRACT(DAY FROM NOW() - v_last_purchase)::INTEGER, 999);

    -- Recency Score (1-5)
    v_recency := CASE
        WHEN v_days_since_purchase <= 30 THEN 5
        WHEN v_days_since_purchase <= 60 THEN 4
        WHEN v_days_since_purchase <= 90 THEN 3
        WHEN v_days_since_purchase <= 180 THEN 2
        ELSE 1
    END;

    -- Frequency Score (1-5)
    v_frequency := CASE
        WHEN v_total_purchases >= 10 THEN 5
        WHEN v_total_purchases >= 5 THEN 4
        WHEN v_total_purchases >= 3 THEN 3
        WHEN v_total_purchases >= 1 THEN 2
        ELSE 1
    END;

    -- Monetary Score (1-5) - adjust thresholds based on your business
    v_monetary := CASE
        WHEN v_total_spent >= 50000 THEN 5  -- ₦50k+
        WHEN v_total_spent >= 20000 THEN 4  -- ₦20k+
        WHEN v_total_spent >= 10000 THEN 3  -- ₦10k+
        WHEN v_total_spent >= 5000 THEN 2   -- ₦5k+
        ELSE 1
    END;

    -- Determine RFM Segment
    v_segment := CASE
        WHEN v_recency >= 4 AND v_frequency >= 4 AND v_monetary >= 4 THEN 'champions'
        WHEN v_recency >= 3 AND v_frequency >= 3 THEN 'loyal'
        WHEN v_recency >= 4 AND v_frequency <= 2 THEN 'new_customers'
        WHEN v_recency >= 3 AND v_frequency >= 2 THEN 'potential'
        WHEN v_recency <= 2 AND v_frequency >= 3 THEN 'at_risk'
        WHEN v_recency <= 2 AND v_frequency <= 2 AND v_monetary >= 3 THEN 'hibernating'
        WHEN v_recency = 1 AND v_frequency = 1 THEN 'lost'
        ELSE 'other'
    END;

    -- Upsert scores
    INSERT INTO contact_scores (
        contact_id, organizer_id,
        recency_score, frequency_score, monetary_score, rfm_segment,
        last_purchase_at, total_purchases, total_spent,
        avg_ticket_value, calculated_at
    )
    VALUES (
        p_contact_id, v_organizer_id,
        v_recency, v_frequency, v_monetary, v_segment,
        v_last_purchase, v_total_purchases, v_total_spent,
        CASE WHEN v_total_purchases > 0 THEN v_total_spent / v_total_purchases ELSE 0 END,
        NOW()
    )
    ON CONFLICT (contact_id) DO UPDATE SET
        recency_score = EXCLUDED.recency_score,
        frequency_score = EXCLUDED.frequency_score,
        monetary_score = EXCLUDED.monetary_score,
        rfm_segment = EXCLUDED.rfm_segment,
        last_purchase_at = EXCLUDED.last_purchase_at,
        total_purchases = EXCLUDED.total_purchases,
        total_spent = EXCLUDED.total_spent,
        avg_ticket_value = EXCLUDED.avg_ticket_value,
        calculated_at = NOW(),
        updated_at = NOW();
END;
$function$;

-- ============================================================================
-- FUNCTION 4: calculate_layout_capacity
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_layout_capacity(layout_uuid uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
  total_capacity INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(capacity), 0)
  INTO total_capacity
  FROM layout_sections
  WHERE layout_id = layout_uuid;

  RETURN total_capacity;
END;
$function$;

-- ============================================================================
-- FUNCTION 5: calculate_organizer_scores
-- ============================================================================
CREATE OR REPLACE FUNCTION public.calculate_organizer_scores(p_organizer_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_contact RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_contact IN 
        SELECT id FROM contacts 
        WHERE organizer_id = p_organizer_id AND is_active = TRUE
    LOOP
        PERFORM calculate_contact_rfm(v_contact.id);
        PERFORM calculate_contact_engagement(v_contact.id);
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$function$;

-- ============================================================================
-- FUNCTION 6: check_fast_payout_eligibility
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_fast_payout_eligibility(p_organizer_id uuid, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_organizer RECORD;
  v_settings RECORD;
  v_total_sold INTEGER;
  v_total_available INTEGER;
  v_sales_percentage DECIMAL;
  v_available_earnings DECIMAL;
  v_already_paid DECIMAL;
  v_cap_percentage DECIMAL;
  v_max_payout DECIMAL;
  v_pending_requests INTEGER;
  v_last_request TIMESTAMPTZ;
  v_currency VARCHAR(3);
BEGIN
  -- Get settings
  SELECT * INTO v_settings FROM fast_payout_settings LIMIT 1;
  
  IF NOT v_settings.enabled THEN
    RETURN json_build_object('eligible', false, 'reason', 'Fast payout is currently disabled');
  END IF;
  
  -- Get organizer
  SELECT * INTO v_organizer FROM organizers WHERE id = p_organizer_id;
  
  IF v_organizer IS NULL THEN
    RETURN json_build_object('eligible', false, 'reason', 'Organizer not found');
  END IF;
  
  -- Check KYC
  IF v_settings.require_kyc AND NOT COALESCE(v_organizer.kyc_verified, false) AND v_organizer.kyc_status != 'approved' THEN
    RETURN json_build_object('eligible', false, 'reason', 'KYC verification required');
  END IF;
  
  -- Check if using subaccount (they don't need fast payout)
  IF v_organizer.paystack_subaccount_id IS NOT NULL AND v_organizer.paystack_subaccount_status = 'active' THEN
    RETURN json_build_object('eligible', false, 'reason', 'Subaccount organizers receive instant payouts automatically');
  END IF;
  
  -- Calculate ticket sales and earnings
  IF p_event_id IS NOT NULL THEN
    -- Single event
    SELECT 
      COALESCE(SUM(tt.quantity_sold), 0),
      COALESCE(SUM(tt.quantity), 0),
      e.currency
    INTO v_total_sold, v_total_available, v_currency
    FROM events e
    LEFT JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.id = p_event_id AND e.organizer_id = p_organizer_id
    GROUP BY e.currency;
    
    -- Get available earnings (completed orders minus platform fees, minus already paid out)
    SELECT COALESCE(SUM(o.total_amount - COALESCE(o.platform_fee, 0)), 0)
    INTO v_available_earnings
    FROM orders o
    WHERE o.event_id = p_event_id
      AND o.status = 'completed'
      AND o.payout_status = 'pending';
  ELSE
    -- All events for organizer
    SELECT 
      COALESCE(SUM(tt.quantity_sold), 0),
      COALESCE(SUM(tt.quantity), 0)
    INTO v_total_sold, v_total_available
    FROM events e
    JOIN ticket_types tt ON tt.event_id = e.id
    WHERE e.organizer_id = p_organizer_id;
    
    SELECT COALESCE(SUM(o.total_amount - COALESCE(o.platform_fee, 0)), 0)
    INTO v_available_earnings
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE e.organizer_id = p_organizer_id
      AND o.status = 'completed'
      AND o.payout_status = 'pending';
    
    v_currency := v_organizer.payout_currency;
  END IF;
  
  -- Calculate sales percentage
  IF v_total_available > 0 THEN
    v_sales_percentage := (v_total_sold::DECIMAL / v_total_available::DECIMAL) * 100;
  ELSE
    v_sales_percentage := 0;
  END IF;
  
  -- Check minimum sales threshold
  IF v_sales_percentage < v_settings.min_ticket_sales_percentage THEN
    RETURN json_build_object(
      'eligible', false, 
      'reason', format('Minimum %s%% ticket sales required. Current: %s%%', 
        v_settings.min_ticket_sales_percentage, ROUND(v_sales_percentage, 1)),
      'sales_percentage', v_sales_percentage,
      'required_percentage', v_settings.min_ticket_sales_percentage
    );
  END IF;
  
  -- Determine cap based on trust level
  v_cap_percentage := CASE 
    WHEN v_organizer.is_trusted THEN v_settings.cap_trusted
    WHEN v_organizer.verification_level = 'gold' THEN v_settings.cap_gold
    WHEN v_organizer.verification_level = 'silver' THEN v_settings.cap_silver
    ELSE v_settings.cap_bronze
  END;
  
  -- Calculate max payout amount
  v_max_payout := v_available_earnings * (v_cap_percentage / 100);
  
  IF v_max_payout <= 0 THEN
    RETURN json_build_object('eligible', false, 'reason', 'No available earnings for fast payout');
  END IF;
  
  -- Check for recent requests (cooldown)
  SELECT COUNT(*), MAX(requested_at)
  INTO v_pending_requests, v_last_request
  FROM fast_payout_requests
  WHERE organizer_id = p_organizer_id
    AND (p_event_id IS NULL OR event_id = p_event_id)
    AND status NOT IN ('completed', 'rejected', 'cancelled', 'failed');
  
  IF v_pending_requests > 0 THEN
    RETURN json_build_object('eligible', false, 'reason', 'You have a pending fast payout request');
  END IF;
  
  IF v_last_request IS NOT NULL AND v_last_request > NOW() - (v_settings.cooldown_hours || ' hours')::INTERVAL THEN
    RETURN json_build_object(
      'eligible', false, 
      'reason', format('Please wait %s hours between requests', v_settings.cooldown_hours)
    );
  END IF;
  
  -- Check max requests per event
  IF p_event_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_pending_requests
    FROM fast_payout_requests
    WHERE event_id = p_event_id AND status = 'completed';
    
    IF v_pending_requests >= v_settings.max_requests_per_event THEN
      RETURN json_build_object('eligible', false, 'reason', 'Maximum fast payout requests reached for this event');
    END IF;
  END IF;
  
  -- Eligible!
  RETURN json_build_object(
    'eligible', true,
    'available_earnings', v_available_earnings,
    'max_payout', v_max_payout,
    'cap_percentage', v_cap_percentage,
    'fee_percentage', v_settings.fee_percentage,
    'sales_percentage', v_sales_percentage,
    'currency', v_currency,
    'trust_level', COALESCE(v_organizer.verification_level, 'bronze'),
    'is_trusted', COALESCE(v_organizer.is_trusted, false)
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 7: cleanup_expired_sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE user_sessions 
    SET is_active = false, 
        ended_at = NOW(), 
        end_reason = 'timeout'
    WHERE expires_at < NOW() 
        AND is_active = true;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$function$;

-- ============================================================================
-- FUNCTION 8: complete_group_member
-- ============================================================================
CREATE OR REPLACE FUNCTION public.complete_group_member(p_member_id uuid, p_order_id uuid, p_ticket_count integer, p_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session_id UUID;
BEGIN
  -- Update member
  UPDATE group_buy_members SET
    status = 'completed',
    order_id = p_order_id,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_member_id
  RETURNING session_id INTO v_session_id;
  
  -- Update session stats
  UPDATE group_buy_sessions SET
    completed_count = completed_count + 1,
    total_tickets = total_tickets + p_ticket_count,
    total_amount = total_amount + p_amount,
    updated_at = NOW()
  WHERE id = v_session_id;
  
  -- Add system message
  INSERT INTO group_buy_messages (session_id, member_id, message, message_type)
  SELECT v_session_id, p_member_id, name || ' completed their purchase! 🎉', 'system'
  FROM group_buy_members WHERE id = p_member_id;
  
  RETURN json_build_object('success', true);
END;
$function$;

-- ============================================================================
-- FUNCTION 9: create_default_smart_segments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_default_smart_segments(p_organizer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- RFM Segments
    INSERT INTO smart_segments (organizer_id, name, description, segment_type, criteria, color, icon, is_system)
    VALUES
        (p_organizer_id, 'Champions', 'Best customers - recent, frequent, high spenders', 'rfm', 
         '{"rfm_segment": "champions"}', '#10B981', 'trophy', TRUE),
        (p_organizer_id, 'Loyal Customers', 'Regular customers with consistent purchases', 'rfm',
         '{"rfm_segment": "loyal"}', '#3B82F6', 'heart', TRUE),
        (p_organizer_id, 'Potential Loyalists', 'Recent customers who could become loyal', 'rfm',
         '{"rfm_segment": "potential"}', '#8B5CF6', 'trending-up', TRUE),
        (p_organizer_id, 'At Risk', 'Previously active but haven''t purchased recently', 'rfm',
         '{"rfm_segment": "at_risk"}', '#F59E0B', 'alert-triangle', TRUE),
        (p_organizer_id, 'Hibernating', 'Low activity, but previously valuable', 'rfm',
         '{"rfm_segment": "hibernating"}', '#6B7280', 'moon', TRUE),
        (p_organizer_id, 'Lost', 'No recent activity, low value', 'rfm',
         '{"rfm_segment": "lost"}', '#EF4444', 'user-x', TRUE)
    ON CONFLICT DO NOTHING;
    
    -- Engagement Segments
    INSERT INTO smart_segments (organizer_id, name, description, segment_type, criteria, color, icon, is_system)
    VALUES
        (p_organizer_id, 'Super Engaged', 'Opens and clicks on most communications', 'engagement',
         '{"engagement_level": "highly_engaged"}', '#10B981', 'zap', TRUE),
        (p_organizer_id, 'Active Readers', 'Regularly opens emails', 'engagement',
         '{"engagement_level": "engaged"}', '#3B82F6', 'eye', TRUE),
        (p_organizer_id, 'Passive Subscribers', 'Occasional engagement', 'engagement',
         '{"engagement_level": "passive"}', '#F59E0B', 'clock', TRUE),
        (p_organizer_id, 'Disengaged', 'Rarely opens or clicks', 'engagement',
         '{"engagement_level": "disengaged"}', '#EF4444', 'eye-off', TRUE)
    ON CONFLICT DO NOTHING;
    
    -- Behavioral Segments
    INSERT INTO smart_segments (organizer_id, name, description, segment_type, criteria, color, icon, is_system)
    VALUES
        (p_organizer_id, 'Recent Purchasers', 'Purchased in last 30 days', 'behavioral',
         '{"last_purchase_days": {"max": 30}}', '#10B981', 'shopping-bag', TRUE),
        (p_organizer_id, 'VIP Spenders', 'Spent over ₦50,000 total', 'behavioral',
         '{"total_spent": {"min": 50000}}', '#8B5CF6', 'crown', TRUE),
        (p_organizer_id, 'Frequent Attendees', 'Attended 3+ events', 'behavioral',
         '{"total_events": {"min": 3}}', '#3B82F6', 'calendar-check', TRUE),
        (p_organizer_id, 'First-Time Buyers', 'Only 1 purchase', 'behavioral',
         '{"total_purchases": {"equals": 1}}', '#06B6D4', 'user-plus', TRUE)
    ON CONFLICT DO NOTHING;
END;
$function$;

-- ============================================================================
-- FUNCTION 10: create_fast_payout_request
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_fast_payout_request(p_organizer_id uuid, p_amount numeric, p_event_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_eligibility JSON;
  v_settings RECORD;
  v_fee_amount DECIMAL;
  v_net_amount DECIMAL;
  v_request_id UUID;
  v_order_ids UUID[];
  v_organizer RECORD;
BEGIN
  -- Check eligibility
  v_eligibility := check_fast_payout_eligibility(p_organizer_id, p_event_id);
  
  IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
    RETURN json_build_object('success', false, 'error', v_eligibility->>'reason');
  END IF;
  
  -- Validate amount
  IF p_amount > (v_eligibility->>'max_payout')::DECIMAL THEN
    RETURN json_build_object(
      'success', false, 
      'error', format('Amount exceeds maximum payout of %s', v_eligibility->>'max_payout')
    );
  END IF;
  
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid amount');
  END IF;
  
  -- Get settings
  SELECT * INTO v_settings FROM fast_payout_settings LIMIT 1;
  
  -- Calculate fee
  v_fee_amount := ROUND(p_amount * v_settings.fee_percentage, 2);
  v_net_amount := p_amount - v_fee_amount;
  
  -- Get organizer info
  SELECT * INTO v_organizer FROM organizers WHERE id = p_organizer_id;
  
  -- Get order IDs to include
  IF p_event_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_order_ids
    FROM orders
    WHERE event_id = p_event_id
      AND status = 'completed'
      AND payout_status = 'pending';
  ELSE
    SELECT ARRAY_AGG(o.id) INTO v_order_ids
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE e.organizer_id = p_organizer_id
      AND o.status = 'completed'
      AND o.payout_status = 'pending';
  END IF;
  
  -- Create request
  INSERT INTO fast_payout_requests (
    organizer_id,
    event_id,
    gross_amount,
    fee_percentage,
    fee_amount,
    net_amount,
    currency,
    ticket_sales_percentage,
    organizer_trust_level,
    payout_cap_percentage,
    status,
    order_ids
  ) VALUES (
    p_organizer_id,
    p_event_id,
    p_amount,
    v_settings.fee_percentage,
    v_fee_amount,
    v_net_amount,
    v_eligibility->>'currency',
    (v_eligibility->>'sales_percentage')::DECIMAL,
    v_eligibility->>'trust_level',
    (v_eligibility->>'cap_percentage')::DECIMAL,
    'approved', -- Auto-approve if eligibility passed
    v_order_ids
  )
  RETURNING id INTO v_request_id;
  
  -- Update timestamp
  UPDATE fast_payout_requests SET approved_at = NOW() WHERE id = v_request_id;
  
  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'gross_amount', p_amount,
    'fee_amount', v_fee_amount,
    'net_amount', v_net_amount,
    'currency', v_eligibility->>'currency'
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 11: create_group_session
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_group_session(p_event_id uuid, p_host_user_id uuid, p_host_name character varying, p_group_name character varying DEFAULT NULL::character varying, p_duration_minutes integer DEFAULT 60)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_code VARCHAR(8);
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_settings RECORD;
BEGIN
  -- Get event settings
  SELECT * INTO v_settings FROM event_group_buy_settings WHERE event_id = p_event_id;
  
  -- Check if group buy is enabled (default true if no settings)
  IF v_settings.id IS NOT NULL AND NOT v_settings.enabled THEN
    RETURN json_build_object('success', false, 'error', 'Group buying is disabled for this event');
  END IF;
  
  -- Apply max duration limit
  IF v_settings.max_duration_minutes IS NOT NULL AND p_duration_minutes > v_settings.max_duration_minutes THEN
    p_duration_minutes := v_settings.max_duration_minutes;
  END IF;
  
  -- Generate unique code
  LOOP
    v_code := generate_group_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM group_buy_sessions WHERE code = v_code);
  END LOOP;
  
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Create session
  INSERT INTO group_buy_sessions (
    code, name, event_id, host_user_id, host_name,
    expires_at, duration_minutes,
    max_members, allow_mixed_tickets, reserve_tickets
  ) VALUES (
    v_code,
    COALESCE(p_group_name, p_host_name || '''s Group'),
    p_event_id,
    p_host_user_id,
    p_host_name,
    v_expires_at,
    p_duration_minutes,
    COALESCE(v_settings.max_group_size, 20),
    COALESCE(v_settings.allow_mixed_tickets, true),
    COALESCE(v_settings.allow_reservations, false)
  )
  RETURNING id INTO v_session_id;
  
  -- Add host as first member
  INSERT INTO group_buy_members (
    session_id, user_id, name, is_host, status, joined_at
  ) VALUES (
    v_session_id, p_host_user_id, p_host_name, true, 'joined', NOW()
  );
  
  -- Add system message
  INSERT INTO group_buy_messages (session_id, message, message_type)
  VALUES (v_session_id, p_host_name || ' created the group', 'system');
  
  RETURN json_build_object(
    'success', true,
    'session_id', v_session_id,
    'code', v_code,
    'expires_at', v_expires_at
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 12: create_section_capacity_for_event
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_section_capacity_for_event(event_uuid uuid, layout_uuid uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO section_capacity (layout_id, section_id, event_id, max_capacity, available_capacity)
  SELECT layout_uuid, id, event_uuid, capacity, capacity
  FROM layout_sections
  WHERE layout_id = layout_uuid;
END;
$function$;

-- ============================================================================
-- FUNCTION 13: create_split_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_split_payment(p_session_id uuid, p_ticket_selection jsonb, p_total_amount numeric, p_currency character varying, p_service_fee numeric, p_member_emails jsonb, p_split_type character varying DEFAULT 'equal'::character varying, p_deadline_hours integer DEFAULT 24)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_split_id UUID;
  v_member JSONB;
  v_member_count INTEGER;
  v_amount_per_share DECIMAL;
  v_grand_total DECIMAL;
  v_expires_at TIMESTAMPTZ;
  v_event_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;
  
  -- Get event_id from session
  SELECT event_id INTO v_event_id FROM group_buy_sessions WHERE id = p_session_id;
  IF v_event_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Session not found');
  END IF;
  
  -- Calculate totals
  v_member_count := jsonb_array_length(p_member_emails);
  IF v_member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'Need at least 2 members to split');
  END IF;
  
  v_grand_total := p_total_amount + COALESCE(p_service_fee, 0);
  v_amount_per_share := ROUND(v_grand_total / v_member_count, 2);
  v_expires_at := NOW() + (p_deadline_hours || ' hours')::INTERVAL;
  
  -- Create split payment
  INSERT INTO group_split_payments (
    session_id, initiated_by, event_id, ticket_selection,
    total_amount, currency, service_fee, grand_total,
    split_type, member_count, amount_per_share,
    status, expires_at
  ) VALUES (
    p_session_id, v_user_id, v_event_id, p_ticket_selection,
    p_total_amount, p_currency, p_service_fee, v_grand_total,
    p_split_type, v_member_count, v_amount_per_share,
    'pending', v_expires_at
  )
  RETURNING id INTO v_split_id;
  
  -- Create shares for each member
  FOR v_member IN SELECT * FROM jsonb_array_elements(p_member_emails)
  LOOP
    INSERT INTO group_split_shares (
      split_payment_id,
      user_id,
      email,
      name,
      share_amount,
      share_percentage,
      token_expires_at
    ) VALUES (
      v_split_id,
      (v_member->>'user_id')::UUID,
      v_member->>'email',
      v_member->>'name',
      v_amount_per_share,
      ROUND(100.0 / v_member_count, 2),
      v_expires_at
    );
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'split_payment_id', v_split_id,
    'amount_per_share', v_amount_per_share,
    'member_count', v_member_count,
    'expires_at', v_expires_at
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 14: enroll_in_drip_campaign
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enroll_in_drip_campaign(p_campaign_id uuid, p_contact_id uuid, p_trigger_data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_campaign RECORD;
    v_first_step RECORD;
    v_enrollment_id UUID;
    v_next_step_at TIMESTAMPTZ;
BEGIN
    -- Get campaign
    SELECT * INTO v_campaign FROM drip_campaigns WHERE id = p_campaign_id;
    IF v_campaign IS NULL OR v_campaign.status != 'active' THEN
        RETURN NULL;
    END IF;
    
    -- Check if already enrolled
    IF EXISTS (
        SELECT 1 FROM drip_enrollments 
        WHERE campaign_id = p_campaign_id 
          AND contact_id = p_contact_id 
          AND status IN ('active', 'paused')
    ) THEN
        RETURN NULL;
    END IF;
    
    -- Get first step
    SELECT * INTO v_first_step 
    FROM drip_campaign_steps 
    WHERE campaign_id = p_campaign_id AND is_active = TRUE
    ORDER BY step_number 
    LIMIT 1;
    
    IF v_first_step IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Calculate when first step should execute
    v_next_step_at := CASE v_first_step.delay_type
        WHEN 'immediate' THEN NOW()
        WHEN 'delay' THEN NOW() + (v_first_step.delay_value || ' ' || v_first_step.delay_unit)::INTERVAL
        ELSE NOW() + INTERVAL '1 minute'
    END;
    
    -- Create enrollment
    INSERT INTO drip_enrollments (
        campaign_id, contact_id, organizer_id,
        current_step_id, current_step_number, next_step_at,
        trigger_data
    )
    VALUES (
        p_campaign_id, p_contact_id, v_campaign.organizer_id,
        v_first_step.id, v_first_step.step_number, v_next_step_at,
        p_trigger_data
    )
    RETURNING id INTO v_enrollment_id;
    
    -- Update campaign stats
    UPDATE drip_campaigns 
    SET total_enrolled = total_enrolled + 1, updated_at = NOW()
    WHERE id = p_campaign_id;
    
    RETURN v_enrollment_id;
END;
$function$;

-- ============================================================================
-- FUNCTION 15: expire_group_sessions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_group_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE group_buy_sessions 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'active' AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ============================================================================
-- FUNCTION 16: expire_split_payments
-- ============================================================================
CREATE OR REPLACE FUNCTION public.expire_split_payments()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE group_split_payments 
  SET status = 'expired', updated_at = NOW()
  WHERE status IN ('pending', 'partial') AND expires_at < NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

-- ============================================================================
-- FUNCTION 17: find_or_create_conversation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_or_create_conversation(p_organizer_id uuid, p_channel character varying, p_contact_phone character varying DEFAULT NULL::character varying, p_contact_email character varying DEFAULT NULL::character varying, p_contact_name character varying DEFAULT NULL::character varying, p_subject character varying DEFAULT NULL::character varying)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_conversation_id UUID;
    v_contact_id UUID;
BEGIN
    -- Try to find existing open conversation
    IF p_contact_phone IS NOT NULL THEN
        SELECT id INTO v_conversation_id
        FROM conversations
        WHERE organizer_id = p_organizer_id
          AND channel = p_channel
          AND contact_phone = p_contact_phone
          AND status = 'open'
        ORDER BY last_message_at DESC
        LIMIT 1;
    ELSIF p_contact_email IS NOT NULL THEN
        SELECT id INTO v_conversation_id
        FROM conversations
        WHERE organizer_id = p_organizer_id
          AND channel = p_channel
          AND contact_email = p_contact_email
          AND status = 'open'
        ORDER BY last_message_at DESC
        LIMIT 1;
    END IF;

    -- If no existing conversation, create new one
    IF v_conversation_id IS NULL THEN
        -- Try to find contact
        IF p_contact_phone IS NOT NULL THEN
            SELECT id INTO v_contact_id
            FROM contacts
            WHERE organizer_id = p_organizer_id
              AND phone = p_contact_phone
            LIMIT 1;
        ELSIF p_contact_email IS NOT NULL THEN
            SELECT id INTO v_contact_id
            FROM contacts
            WHERE organizer_id = p_organizer_id
              AND email = p_contact_email
            LIMIT 1;
        END IF;

        INSERT INTO conversations (
            organizer_id, contact_id, channel,
            contact_phone, contact_email, contact_name, subject
        )
        VALUES (
            p_organizer_id, v_contact_id, p_channel,
            p_contact_phone, p_contact_email, p_contact_name, p_subject
        )
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$function$;

-- ============================================================================
-- FUNCTION 18: generate_group_code
-- ============================================================================
CREATE OR REPLACE FUNCTION public.generate_group_code()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
  chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$function$;

-- ============================================================================
-- FUNCTION 19: get_inferred_preferences
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_inferred_preferences(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_categories TEXT[];
  v_event_types TEXT[];
  v_cities TEXT[];
BEGIN
  -- Get categories from purchased events
  SELECT ARRAY_AGG(DISTINCT e.category) FILTER (WHERE e.category IS NOT NULL)
  INTO v_categories
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.user_id = p_user_id AND o.status = 'completed';
  
  -- Get event types from purchased events
  SELECT ARRAY_AGG(DISTINCT e.event_type) FILTER (WHERE e.event_type IS NOT NULL)
  INTO v_event_types
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.user_id = p_user_id AND o.status = 'completed';
  
  -- Get cities from purchased events
  SELECT ARRAY_AGG(DISTINCT e.city) FILTER (WHERE e.city IS NOT NULL)
  INTO v_cities
  FROM orders o
  JOIN events e ON e.id = o.event_id
  WHERE o.user_id = p_user_id AND o.status = 'completed';
  
  RETURN json_build_object(
    'categories', COALESCE(v_categories, '{}'),
    'event_types', COALESCE(v_event_types, '{}'),
    'cities', COALESCE(v_cities, '{}')
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 20: get_pending_drip_steps
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pending_drip_steps(p_limit integer DEFAULT 100)
 RETURNS TABLE(enrollment_id uuid, campaign_id uuid, step_id uuid, contact_id uuid, organizer_id uuid, action_type character varying, action_config jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        e.id AS enrollment_id,
        e.campaign_id,
        e.current_step_id AS step_id,
        e.contact_id,
        e.organizer_id,
        s.action_type,
        s.action_config
    FROM drip_enrollments e
    JOIN drip_campaign_steps s ON e.current_step_id = s.id
    JOIN drip_campaigns c ON e.campaign_id = c.id
    WHERE e.status = 'active'
      AND e.next_step_at <= NOW()
      AND c.status = 'active'
      AND s.is_active = TRUE
    ORDER BY e.next_step_at
    LIMIT p_limit;
END;
$function$;

-- ============================================================================
-- FUNCTION 21: get_personalized_recommendations
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_personalized_recommendations(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0)
 RETURNS TABLE(event_id uuid, title character varying, slug character varying, image_url text, start_date timestamp with time zone, end_date timestamp with time zone, venue_name character varying, city character varying, currency character varying, min_price numeric, event_type character varying, category character varying, recommendation_score numeric, recommendation_reasons text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_preferences JSON;
  v_has_history BOOLEAN;
BEGIN
  -- Get inferred preferences
  v_preferences := get_inferred_preferences(p_user_id);
  
  -- Check if user has any purchase history
  SELECT EXISTS(
    SELECT 1 FROM orders WHERE user_id = p_user_id AND status = 'completed' LIMIT 1
  ) INTO v_has_history;
  
  IF v_has_history THEN
    -- Personalized recommendations based on history
    RETURN QUERY
    SELECT DISTINCT ON (e.id)
      e.id,
      e.title,
      e.slug,
      e.image_url,
      e.start_date,
      e.end_date,
      e.venue_name,
      e.city,
      e.currency,
      (SELECT MIN(tt.price) FROM ticket_types tt WHERE tt.event_id = e.id AND tt.is_active = true) as min_price,
      e.event_type,
      e.category,
      CASE
        -- Higher score for matching category
        WHEN e.category = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'categories'))) THEN 0.8
        -- Higher score for matching event type
        WHEN e.event_type = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'event_types'))) THEN 0.7
        -- Higher score for matching city
        WHEN e.city = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'cities'))) THEN 0.6
        ELSE 0.4
      END::DECIMAL as recommendation_score,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN e.category = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'categories'))) 
          THEN 'Based on events you''ve attended' END,
        CASE WHEN e.city = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'cities'))) 
          THEN 'Popular in ' || e.city END,
        CASE WHEN e.event_type = ANY(ARRAY(SELECT json_array_elements_text(v_preferences->'event_types'))) 
          THEN 'Similar to your interests' END
      ], NULL) as recommendation_reasons
    FROM events e
    WHERE e.status = 'published'
      AND e.start_date > NOW()
      AND e.id NOT IN (SELECT o.event_id FROM orders o WHERE o.user_id = p_user_id)
    ORDER BY e.id, recommendation_score DESC, e.start_date ASC
    LIMIT p_limit OFFSET p_offset;
  ELSE
    -- New user: return trending/popular events
    RETURN QUERY
    SELECT 
      e.id,
      e.title,
      e.slug,
      e.image_url,
      e.start_date,
      e.end_date,
      e.venue_name,
      e.city,
      e.currency,
      (SELECT MIN(tt.price) FROM ticket_types tt WHERE tt.event_id = e.id AND tt.is_active = true) as min_price,
      e.event_type,
      e.category,
      0.5::DECIMAL as recommendation_score,
      ARRAY['Trending near you', 'Popular this week']::TEXT[] as recommendation_reasons
    FROM events e
    WHERE e.status = 'published'
      AND e.start_date > NOW()
    ORDER BY e.start_date ASC
    LIMIT p_limit OFFSET p_offset;
  END IF;
END;
$function$;

-- ============================================================================
-- FUNCTION 22: get_share_by_token
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_share_by_token(p_token uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_share RECORD;
  v_split RECORD;
  v_event RECORD;
BEGIN
  -- Get share
  SELECT * INTO v_share FROM group_split_shares 
  WHERE payment_token = p_token AND token_expires_at > NOW();
  
  IF v_share.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired payment link');
  END IF;
  
  -- Get split payment
  SELECT * INTO v_split FROM group_split_payments WHERE id = v_share.split_payment_id;
  
  -- Get event
  SELECT * INTO v_event FROM events WHERE id = v_split.event_id;
  
  RETURN json_build_object(
    'success', true,
    'share', row_to_json(v_share),
    'split_payment', row_to_json(v_split),
    'event', row_to_json(v_event)
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 23: get_split_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_split_payment(p_split_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'split_payment', row_to_json(sp.*),
    'shares', (
      SELECT json_agg(row_to_json(ss.*))
      FROM group_split_shares ss
      WHERE ss.split_payment_id = sp.id
    ),
    'event', (
      SELECT row_to_json(e.*)
      FROM events e
      WHERE e.id = sp.event_id
    ),
    'paid_count', (
      SELECT COUNT(*) FROM group_split_shares
      WHERE split_payment_id = sp.id AND payment_status = 'paid'
    ),
    'total_paid', (
      SELECT COALESCE(SUM(share_amount), 0) FROM group_split_shares
      WHERE split_payment_id = sp.id AND payment_status = 'paid'
    )
  ) INTO v_result
  FROM group_split_payments sp
  WHERE sp.id = p_split_id;
  
  RETURN v_result;
END;
$function$;

-- ============================================================================
-- FUNCTION 24: join_group_session
-- ============================================================================
CREATE OR REPLACE FUNCTION public.join_group_session(p_code character varying, p_user_id uuid, p_user_name character varying, p_user_email character varying DEFAULT NULL::character varying)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session RECORD;
  v_member_id UUID;
  v_existing_member RECORD;
BEGIN
  -- Find session
  SELECT * INTO v_session FROM group_buy_sessions 
  WHERE code = UPPER(p_code) AND status = 'active';
  
  IF v_session.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Group not found or expired');
  END IF;
  
  -- Check if expired
  IF v_session.expires_at < NOW() THEN
    UPDATE group_buy_sessions SET status = 'expired' WHERE id = v_session.id;
    RETURN json_build_object('success', false, 'error', 'This group session has expired');
  END IF;
  
  -- Check if full
  IF v_session.member_count >= v_session.max_members THEN
    RETURN json_build_object('success', false, 'error', 'This group is full');
  END IF;
  
  -- Check if already a member
  SELECT * INTO v_existing_member FROM group_buy_members 
  WHERE session_id = v_session.id AND user_id = p_user_id;
  
  IF v_existing_member.id IS NOT NULL THEN
    -- Update existing member
    UPDATE group_buy_members SET
      status = CASE WHEN status = 'dropped' THEN 'joined' ELSE status END,
      last_active_at = NOW(),
      joined_at = COALESCE(joined_at, NOW())
    WHERE id = v_existing_member.id;
    
    RETURN json_build_object(
      'success', true,
      'session_id', v_session.id,
      'member_id', v_existing_member.id,
      'rejoined', true
    );
  END IF;
  
  -- Add new member
  INSERT INTO group_buy_members (
    session_id, user_id, email, name, status, joined_at
  ) VALUES (
    v_session.id, p_user_id, p_user_email, p_user_name, 'joined', NOW()
  )
  RETURNING id INTO v_member_id;
  
  -- Update session member count
  UPDATE group_buy_sessions SET 
    member_count = member_count + 1,
    updated_at = NOW()
  WHERE id = v_session.id;
  
  -- Add system message
  INSERT INTO group_buy_messages (session_id, message, message_type)
  VALUES (v_session.id, p_user_name || ' joined the group', 'system');
  
  RETURN json_build_object(
    'success', true,
    'session_id', v_session.id,
    'member_id', v_member_id,
    'event_id', v_session.event_id
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 25: log_security_event
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_security_event(p_user_id uuid, p_session_id uuid, p_event_type text, p_event_category text, p_description text, p_resource_type text DEFAULT NULL::text, p_resource_id uuid DEFAULT NULL::uuid, p_old_values jsonb DEFAULT NULL::jsonb, p_new_values jsonb DEFAULT NULL::jsonb, p_ip_address inet DEFAULT NULL::inet, p_risk_level text DEFAULT 'low'::text, p_success boolean DEFAULT true, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO security_audit_logs (
        user_id, session_id, event_type, event_category, description,
        resource_type, resource_id, old_values, new_values,
        ip_address, risk_level, success, metadata
    ) VALUES (
        p_user_id, p_session_id, p_event_type, p_event_category, p_description,
        p_resource_type, p_resource_id, p_old_values, p_new_values,
        p_ip_address, p_risk_level, p_success, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$function$;

-- ============================================================================
-- FUNCTION 26: mark_conversation_read
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- Update unread count
    UPDATE conversations
    SET unread_count = 0, updated_at = NOW()
    WHERE id = p_conversation_id;
    
    -- Mark all inbound messages as read
    UPDATE conversation_messages
    SET is_read = TRUE, read_at = NOW()
    WHERE conversation_id = p_conversation_id
      AND direction = 'inbound'
      AND is_read = FALSE;
END;
$function$;

-- ============================================================================
-- FUNCTION 27: mark_reminder_sent
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_reminder_sent(p_share_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE group_split_shares SET
    reminder_count = reminder_count + 1,
    last_reminder_at = NOW(),
    updated_at = NOW()
  WHERE id = p_share_id;
END;
$function$;

-- ============================================================================
-- FUNCTION 28: record_email_tracking_event
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_email_tracking_event(p_tracking_id character varying, p_event_type character varying, p_user_agent text DEFAULT NULL::text, p_ip_address inet DEFAULT NULL::inet, p_link_url text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_event_id UUID;
    v_existing_id UUID;
    v_device_type VARCHAR(20);
    v_email_client VARCHAR(50);
BEGIN
    -- Detect device type from user agent
    IF p_user_agent IS NOT NULL THEN
        IF p_user_agent ILIKE '%mobile%' OR p_user_agent ILIKE '%android%' OR p_user_agent ILIKE '%iphone%' THEN
            v_device_type := 'mobile';
        ELSIF p_user_agent ILIKE '%tablet%' OR p_user_agent ILIKE '%ipad%' THEN
            v_device_type := 'tablet';
        ELSE
            v_device_type := 'desktop';
        END IF;
        
        -- Detect email client
        IF p_user_agent ILIKE '%gmail%' OR p_user_agent ILIKE '%googleimageproxy%' THEN
            v_email_client := 'gmail';
        ELSIF p_user_agent ILIKE '%outlook%' OR p_user_agent ILIKE '%microsoft%' THEN
            v_email_client := 'outlook';
        ELSIF p_user_agent ILIKE '%applemail%' OR p_user_agent ILIKE '%apple%mail%' THEN
            v_email_client := 'apple_mail';
        ELSIF p_user_agent ILIKE '%yahoo%' THEN
            v_email_client := 'yahoo';
        ELSE
            v_email_client := 'other';
        END IF;
    END IF;

    -- Check for existing event with same tracking_id and type
    SELECT id INTO v_existing_id
    FROM email_tracking_events
    WHERE tracking_id = p_tracking_id
      AND event_type = p_event_type
      AND (p_link_url IS NULL OR link_url = p_link_url);

    IF v_existing_id IS NOT NULL THEN
        -- Update existing event count
        UPDATE email_tracking_events
        SET event_count = event_count + 1,
            last_event_at = NOW()
        WHERE id = v_existing_id;
        
        RETURN v_existing_id;
    ELSE
        -- Insert new event
        INSERT INTO email_tracking_events (
            tracking_id, event_type, user_agent, ip_address, 
            device_type, email_client, link_url
        )
        VALUES (
            p_tracking_id, p_event_type, p_user_agent, p_ip_address,
            v_device_type, v_email_client, p_link_url
        )
        RETURNING id INTO v_event_id;
        
        RETURN v_event_id;
    END IF;
END;
$function$;

-- ============================================================================
-- FUNCTION 29: record_event_interaction
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_event_interaction(p_user_id uuid, p_event_id uuid, p_interaction_type character varying, p_source character varying DEFAULT NULL::character varying)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO user_event_interactions (user_id, event_id, interaction_type, source)
  VALUES (p_user_id, p_event_id, p_interaction_type, p_source)
  ON CONFLICT DO NOTHING;
END;
$function$;

-- ============================================================================
-- FUNCTION 30: record_share_payment
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_share_payment(p_share_id uuid, p_payment_reference character varying, p_payment_method character varying)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_split_id UUID;
  v_paid_count INTEGER;
  v_total_count INTEGER;
  v_split RECORD;
BEGIN
  -- Update share
  UPDATE group_split_shares SET
    payment_status = 'paid',
    payment_reference = p_payment_reference,
    payment_method = p_payment_method,
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = p_share_id AND payment_status != 'paid'
  RETURNING split_payment_id INTO v_split_id;
  
  IF v_split_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Share not found or already paid');
  END IF;
  
  -- Check if all shares are paid
  SELECT COUNT(*) FILTER (WHERE payment_status = 'paid'),
         COUNT(*)
  INTO v_paid_count, v_total_count
  FROM group_split_shares
  WHERE split_payment_id = v_split_id;
  
  -- Update split payment status
  IF v_paid_count = v_total_count THEN
    UPDATE group_split_payments SET
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = v_split_id;
  ELSIF v_paid_count > 0 THEN
    UPDATE group_split_payments SET
      status = 'partial',
      updated_at = NOW()
    WHERE id = v_split_id;
  END IF;
  
  SELECT * INTO v_split FROM group_split_payments WHERE id = v_split_id;
  
  RETURN json_build_object(
    'success', true,
    'paid_count', v_paid_count,
    'total_count', v_total_count,
    'all_paid', v_paid_count = v_total_count,
    'status', v_split.status
  );
END;
$function$;

-- ============================================================================
-- FUNCTION 31: schedule_event_reminders
-- ============================================================================
CREATE OR REPLACE FUNCTION public.schedule_event_reminders(p_event_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_event RECORD;
    v_automation RECORD;
    v_ticket RECORD;
    v_reminder_time TIMESTAMPTZ;
    v_jobs_created INTEGER := 0;
BEGIN
    -- Get event details
    SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
    
    IF NOT FOUND OR v_event.start_date < NOW() THEN
        RETURN 0;
    END IF;
    
    -- Find active reminder automations for this organizer
    FOR v_automation IN
        SELECT * FROM public.communication_automations
        WHERE organizer_id = v_event.organizer_id
        AND trigger_type LIKE 'event_reminder_%'
        AND status = 'active'
        AND (trigger_config->>'eventId' IS NULL OR trigger_config->>'eventId' = p_event_id::TEXT)
    LOOP
        -- Calculate reminder time based on trigger type
        CASE v_automation.trigger_type
            WHEN 'event_reminder_7d' THEN
                v_reminder_time := v_event.start_date - INTERVAL '7 days';
            WHEN 'event_reminder_1d' THEN
                v_reminder_time := v_event.start_date - INTERVAL '1 day';
            WHEN 'event_reminder_2h' THEN
                v_reminder_time := v_event.start_date - INTERVAL '2 hours';
            ELSE
                CONTINUE;
        END CASE;
        
        -- Skip if reminder time has passed
        IF v_reminder_time < NOW() THEN
            CONTINUE;
        END IF;
        
        -- Create scheduled job for each ticket holder
        FOR v_ticket IN
            SELECT * FROM public.tickets
            WHERE event_id = p_event_id
            AND payment_status = 'completed'
        LOOP
            -- Check if job already exists
            IF NOT EXISTS (
                SELECT 1 FROM public.communication_scheduled_jobs
                WHERE automation_id = v_automation.id
                AND event_id = p_event_id
                AND contact_id = (
                    SELECT id FROM public.contacts
                    WHERE organizer_id = v_event.organizer_id
                    AND email = v_ticket.attendee_email
                    LIMIT 1
                )
                AND job_type = 'event_reminder'
            ) THEN
                INSERT INTO public.communication_scheduled_jobs (
                    automation_id,
                    organizer_id,
                    job_type,
                    event_id,
                    job_data,
                    scheduled_for
                ) VALUES (
                    v_automation.id,
                    v_event.organizer_id,
                    'event_reminder',
                    p_event_id,
                    jsonb_build_object(
                        'ticket_id', v_ticket.id,
                        'attendee_name', v_ticket.attendee_name,
                        'attendee_email', v_ticket.attendee_email,
                        'attendee_phone', v_ticket.attendee_phone
                    ),
                    v_reminder_time
                );
                
                v_jobs_created := v_jobs_created + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN v_jobs_created;
END;
$function$;

-- ============================================================================
-- FUNCTION 32: toggle_saved_event
-- ============================================================================
CREATE OR REPLACE FUNCTION public.toggle_saved_event(p_user_id uuid, p_event_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM saved_events WHERE user_id = p_user_id AND event_id = p_event_id) INTO v_exists;
  
  IF v_exists THEN
    DELETE FROM saved_events WHERE user_id = p_user_id AND event_id = p_event_id;
    RETURN false; -- Now unsaved
  ELSE
    INSERT INTO saved_events (user_id, event_id) VALUES (p_user_id, p_event_id);
    -- Also record as interaction
    PERFORM record_event_interaction(p_user_id, p_event_id, 'like', 'direct');
    RETURN true; -- Now saved
  END IF;
END;
$function$;

-- ============================================================================
-- FUNCTION 33: update_campaign_analytics
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_campaign_analytics(p_campaign_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_organizer_id UUID;
    v_total_sent INTEGER;
    v_total_opens INTEGER;
    v_unique_opens INTEGER;
    v_total_clicks INTEGER;
    v_unique_clicks INTEGER;
BEGIN
    -- Get organizer ID and total sent from campaign
    SELECT organizer_id, 
           COALESCE((metadata->>'total_sent')::INTEGER, 0)
    INTO v_organizer_id, v_total_sent
    FROM communication_campaigns
    WHERE id = p_campaign_id;

    IF v_organizer_id IS NULL THEN
        RETURN;
    END IF;

    -- Calculate stats from tracking events
    SELECT 
        COUNT(*) FILTER (WHERE event_type = 'open'),
        COUNT(DISTINCT CASE WHEN event_type = 'open' THEN tracking_id END),
        COUNT(*) FILTER (WHERE event_type = 'click'),
        COUNT(DISTINCT CASE WHEN event_type = 'click' THEN tracking_id END)
    INTO v_total_opens, v_unique_opens, v_total_clicks, v_unique_clicks
    FROM email_tracking_events
    WHERE campaign_id = p_campaign_id;

    -- Upsert analytics
    INSERT INTO email_campaign_analytics (
        campaign_id, organizer_id,
        total_sent, total_opens, unique_opens, total_clicks, unique_clicks,
        open_rate, click_rate, click_to_open_rate,
        first_open_at, last_open_at, first_click_at, last_click_at
    )
    VALUES (
        p_campaign_id, v_organizer_id,
        v_total_sent, v_total_opens, v_unique_opens, v_total_clicks, v_unique_clicks,
        CASE WHEN v_total_sent > 0 THEN (v_unique_opens::DECIMAL / v_total_sent) * 100 ELSE 0 END,
        CASE WHEN v_total_sent > 0 THEN (v_unique_clicks::DECIMAL / v_total_sent) * 100 ELSE 0 END,
        CASE WHEN v_unique_opens > 0 THEN (v_unique_clicks::DECIMAL / v_unique_opens) * 100 ELSE 0 END,
        (SELECT MIN(first_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'open'),
        (SELECT MAX(last_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'open'),
        (SELECT MIN(first_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'click'),
        (SELECT MAX(last_event_at) FROM email_tracking_events WHERE campaign_id = p_campaign_id AND event_type = 'click')
    )
    ON CONFLICT (campaign_id) DO UPDATE SET
        total_opens = EXCLUDED.total_opens,
        unique_opens = EXCLUDED.unique_opens,
        total_clicks = EXCLUDED.total_clicks,
        unique_clicks = EXCLUDED.unique_clicks,
        open_rate = EXCLUDED.open_rate,
        click_rate = EXCLUDED.click_rate,
        click_to_open_rate = EXCLUDED.click_to_open_rate,
        last_open_at = EXCLUDED.last_open_at,
        last_click_at = EXCLUDED.last_click_at,
        updated_at = NOW();
END;
$function$;

-- ============================================================================
-- FUNCTION 34: update_member_selection
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_member_selection(p_member_id uuid, p_selected_tickets jsonb, p_total_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE group_buy_members SET
    selected_tickets = p_selected_tickets,
    total_amount = p_total_amount,
    status = CASE 
      WHEN jsonb_array_length(p_selected_tickets) > 0 THEN 'ready'
      ELSE 'selecting'
    END,
    last_active_at = NOW(),
    updated_at = NOW()
  WHERE id = p_member_id;
  
  RETURN json_build_object('success', true);
END;
$function$;

-- ============================================================================
-- FUNCTION 35: update_paystack_payout_status
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_paystack_payout_status(p_transfer_reference character varying, p_status character varying, p_failure_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE paystack_payouts
  SET 
    status = p_status,
    failure_reason = p_failure_reason,
    completed_at = CASE WHEN p_status IN ('success', 'failed', 'reversed') THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE transfer_reference = p_transfer_reference;
  
  -- Update related orders
  IF p_status = 'success' THEN
    UPDATE orders
    SET 
      payout_status = 'completed',
      payout_completed_at = NOW()
    WHERE payout_reference = p_transfer_reference;
  ELSIF p_status IN ('failed', 'reversed') THEN
    UPDATE orders
    SET payout_status = 'failed'
    WHERE payout_reference = p_transfer_reference;
  END IF;
END;
$function$;

-- ============================================================================
-- FUNCTION 36: update_smart_segment_counts
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_smart_segment_counts(p_organizer_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_segment RECORD;
    v_count INTEGER;
BEGIN
    FOR v_segment IN 
        SELECT id, criteria FROM smart_segments WHERE organizer_id = p_organizer_id
    LOOP
        -- Count contacts matching segment criteria
        -- This is a simplified version - real implementation would parse criteria JSONB
        SELECT COUNT(*) INTO v_count
        FROM segment_memberships
        WHERE segment_id = v_segment.id AND is_active = TRUE;
        
        UPDATE smart_segments
        SET contact_count = v_count, 
            last_calculated_at = NOW(),
            updated_at = NOW()
        WHERE id = v_segment.id;
    END LOOP;
END;
$function$;
