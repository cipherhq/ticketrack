-- ============================================
-- FIX RLS SECURITY ISSUES
-- ============================================
-- This migration enables RLS and adds policies
-- for all tables flagged by Supabase Security Advisor
-- ============================================

-- ============================================
-- 1. ENABLE RLS ON ALL AFFECTED TABLES
-- ============================================

ALTER TABLE IF EXISTS public.countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communication_credit_expiry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_feature_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_ip_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sensitive_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.feature_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.country_features ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. COUNTRIES TABLE POLICIES
-- Reference data: Public read, admin write
-- ============================================

DROP POLICY IF EXISTS "countries_public_read" ON public.countries;
CREATE POLICY "countries_public_read" ON public.countries
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "countries_admin_write" ON public.countries;
CREATE POLICY "countries_admin_write" ON public.countries
    FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

-- ============================================
-- 3. FEATURE_CATEGORIES TABLE POLICIES
-- Reference data: Public read, admin write
-- ============================================

DROP POLICY IF EXISTS "feature_categories_public_read" ON public.feature_categories;
CREATE POLICY "feature_categories_public_read" ON public.feature_categories
    FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "feature_categories_admin_write" ON public.feature_categories;
CREATE POLICY "feature_categories_admin_write" ON public.feature_categories
    FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

-- ============================================
-- 4. COUNTRY_FEATURES TABLE POLICIES
-- Feature flags: Authenticated read enabled, admin write
-- ============================================

DROP POLICY IF EXISTS "country_features_read_enabled" ON public.country_features;
CREATE POLICY "country_features_read_enabled" ON public.country_features
    FOR SELECT
    TO public
    USING (true);  -- Need to read all for feature flag checks

DROP POLICY IF EXISTS "country_features_admin_write" ON public.country_features;
CREATE POLICY "country_features_admin_write" ON public.country_features
    FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

-- ============================================
-- 5. COMMUNICATION_CREDIT_EXPIRY TABLE POLICIES
-- Organizer access to own records, service role manages
-- ============================================

DROP POLICY IF EXISTS "credit_expiry_organizer_read" ON public.communication_credit_expiry;
CREATE POLICY "credit_expiry_organizer_read" ON public.communication_credit_expiry
    FOR SELECT
    TO public
    USING (
        organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
            UNION
            SELECT organizer_id FROM public.organizer_team_members
            WHERE user_id = auth.uid() AND status = 'active'
        )
    );

DROP POLICY IF EXISTS "credit_expiry_service_manage" ON public.communication_credit_expiry;
CREATE POLICY "credit_expiry_service_manage" ON public.communication_credit_expiry
    FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- 6. ADMIN_FEATURE_LOGS TABLE POLICIES
-- Audit trail: Admin read, service role write (immutable)
-- ============================================

DROP POLICY IF EXISTS "admin_feature_logs_admin_read" ON public.admin_feature_logs;
CREATE POLICY "admin_feature_logs_admin_read" ON public.admin_feature_logs
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

DROP POLICY IF EXISTS "admin_feature_logs_service_insert" ON public.admin_feature_logs;
CREATE POLICY "admin_feature_logs_service_insert" ON public.admin_feature_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================
-- 7. USER_ROLE_ASSIGNMENTS TABLE POLICIES
-- Critical RBAC: Users see own, super admins manage
-- ============================================

DROP POLICY IF EXISTS "user_role_assignments_view_own" ON public.user_role_assignments;
CREATE POLICY "user_role_assignments_view_own" ON public.user_role_assignments
    FOR SELECT
    TO public
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_role_assignments_admin_manage" ON public.user_role_assignments;
CREATE POLICY "user_role_assignments_admin_manage" ON public.user_role_assignments
    FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

-- ============================================
-- 8. USER_SESSIONS TABLE POLICIES
-- Security: Users see/manage own, admins view all
-- ============================================

DROP POLICY IF EXISTS "user_sessions_view_own" ON public.user_sessions;
CREATE POLICY "user_sessions_view_own" ON public.user_sessions
    FOR SELECT
    TO public
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_sessions_manage_own" ON public.user_sessions;
CREATE POLICY "user_sessions_manage_own" ON public.user_sessions
    FOR UPDATE
    TO public
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_sessions_admin_view" ON public.user_sessions;
CREATE POLICY "user_sessions_admin_view" ON public.user_sessions
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

DROP POLICY IF EXISTS "user_sessions_service_manage" ON public.user_sessions;
CREATE POLICY "user_sessions_service_manage" ON public.user_sessions
    FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- 9. USER_OTP TABLE POLICIES
-- Critical auth: Service role ONLY (never expose to clients)
-- ============================================

DROP POLICY IF EXISTS "user_otp_service_only" ON public.user_otp;
CREATE POLICY "user_otp_service_only" ON public.user_otp
    FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- 10. USER_IP_RESTRICTIONS TABLE POLICIES
-- Security config: Users see own, admins manage
-- ============================================

DROP POLICY IF EXISTS "user_ip_restrictions_view_own" ON public.user_ip_restrictions;
CREATE POLICY "user_ip_restrictions_view_own" ON public.user_ip_restrictions
    FOR SELECT
    TO public
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_ip_restrictions_admin_manage" ON public.user_ip_restrictions;
CREATE POLICY "user_ip_restrictions_admin_manage" ON public.user_ip_restrictions
    FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

DROP POLICY IF EXISTS "user_ip_restrictions_service_read" ON public.user_ip_restrictions;
CREATE POLICY "user_ip_restrictions_service_read" ON public.user_ip_restrictions
    FOR SELECT
    TO service_role
    USING (true);

-- ============================================
-- 11. SECURITY_AUDIT_LOGS TABLE POLICIES
-- Compliance: Admin read, service write (immutable)
-- ============================================

DROP POLICY IF EXISTS "security_audit_logs_admin_read" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_admin_read" ON public.security_audit_logs
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

DROP POLICY IF EXISTS "security_audit_logs_service_insert" ON public.security_audit_logs;
CREATE POLICY "security_audit_logs_service_insert" ON public.security_audit_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- ============================================
-- 12. USER_DEVICES TABLE POLICIES
-- Device security: Users manage own, admins can block
-- ============================================

DROP POLICY IF EXISTS "user_devices_view_own" ON public.user_devices;
CREATE POLICY "user_devices_view_own" ON public.user_devices
    FOR SELECT
    TO public
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_devices_manage_own" ON public.user_devices;
CREATE POLICY "user_devices_manage_own" ON public.user_devices
    FOR UPDATE
    TO public
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_devices_admin_manage" ON public.user_devices;
CREATE POLICY "user_devices_admin_manage" ON public.user_devices
    FOR ALL
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

DROP POLICY IF EXISTS "user_devices_service_manage" ON public.user_devices;
CREATE POLICY "user_devices_service_manage" ON public.user_devices
    FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- 13. SENSITIVE_ACTIONS_LOG TABLE POLICIES
-- Financial compliance: Users create own, approvers review
-- ============================================

DROP POLICY IF EXISTS "sensitive_actions_view_own" ON public.sensitive_actions_log;
CREATE POLICY "sensitive_actions_view_own" ON public.sensitive_actions_log
    FOR SELECT
    TO public
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "sensitive_actions_create_own" ON public.sensitive_actions_log;
CREATE POLICY "sensitive_actions_create_own" ON public.sensitive_actions_log
    FOR INSERT
    TO public
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "sensitive_actions_admin_view" ON public.sensitive_actions_log;
CREATE POLICY "sensitive_actions_admin_view" ON public.sensitive_actions_log
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

DROP POLICY IF EXISTS "sensitive_actions_admin_update" ON public.sensitive_actions_log;
CREATE POLICY "sensitive_actions_admin_update" ON public.sensitive_actions_log
    FOR UPDATE
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND is_admin = true
        )
    );

DROP POLICY IF EXISTS "sensitive_actions_service_manage" ON public.sensitive_actions_log;
CREATE POLICY "sensitive_actions_service_manage" ON public.sensitive_actions_log
    FOR ALL
    TO service_role
    USING (true);

-- ============================================
-- 14. FIX SECURITY DEFINER VIEWS
-- ============================================
-- These views were flagged for using SECURITY DEFINER
-- which bypasses RLS. Recreate with SECURITY INVOKER.
-- ============================================

-- 14.1 public_organizer_profiles - Public organizer data
DROP VIEW IF EXISTS public.public_organizer_profiles;
CREATE VIEW public.public_organizer_profiles
WITH (security_invoker = true)
AS
SELECT id,
    business_name,
    business_email,
    business_phone,
    description,
    logo_url,
    cover_image_url,
    banner_url,
    website_url,
    website,
    social_twitter,
    social_facebook,
    social_instagram,
    social_linkedin,
    twitter,
    facebook,
    instagram,
    linkedin,
    country_code,
    location,
    is_verified,
    verification_level,
    verified_at,
    is_active,
    total_events,
    total_tickets_sold,
    total_revenue,
    average_rating,
    created_at,
    is_trusted,
    slug
FROM organizers
WHERE is_active = true;

-- Grant public read access to the view
GRANT SELECT ON public.public_organizer_profiles TO anon, authenticated;

-- 14.2 donation_analytics - Donation stats per event (organizer-scoped)
DROP VIEW IF EXISTS public.donation_analytics;
CREATE VIEW public.donation_analytics
WITH (security_invoker = true)
AS
SELECT e.id AS event_id,
    e.title AS event_title,
    e.organizer_id,
    o.business_name AS organizer_name,
    e.currency,
    count(ord.id) AS donation_count,
    COALESCE(sum(ord.total_amount), (0)::numeric) AS total_donations,
    COALESCE(sum(ord.platform_fee), (0)::numeric) AS total_platform_fees,
    COALESCE(sum((ord.total_amount - ord.platform_fee)), (0)::numeric) AS net_donations,
    count(
        CASE
            WHEN ((ord.payout_status)::text = 'completed'::text) THEN 1
            ELSE NULL::integer
        END) AS paid_out_count,
    COALESCE(sum(
        CASE
            WHEN ((ord.payout_status)::text = 'completed'::text) THEN (ord.total_amount - ord.platform_fee)
            ELSE (0)::numeric
        END), (0)::numeric) AS paid_out_amount,
    COALESCE(sum(
        CASE
            WHEN ((ord.payout_status)::text = 'pending'::text) THEN (ord.total_amount - ord.platform_fee)
            ELSE (0)::numeric
        END), (0)::numeric) AS pending_payout_amount
FROM ((events e
    JOIN organizers o ON ((e.organizer_id = o.id)))
    LEFT JOIN orders ord ON (((ord.event_id = e.id) AND (ord.is_donation = true) AND ((ord.status)::text = 'completed'::text))))
WHERE (e.is_free = true)
GROUP BY e.id, e.title, e.organizer_id, o.business_name, e.currency;

GRANT SELECT ON public.donation_analytics TO authenticated;

-- 14.3 email_campaign_performance - Email campaign metrics (organizer-scoped)
-- Only create if email_campaign_analytics table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_campaign_analytics') THEN
        DROP VIEW IF EXISTS public.email_campaign_performance;
        EXECUTE 'CREATE VIEW public.email_campaign_performance
        WITH (security_invoker = true)
        AS
        SELECT c.id AS campaign_id,
            c.name AS campaign_name,
            c.organizer_id,
            c.created_at AS sent_at,
            COALESCE(a.total_sent, 0) AS total_sent,
            COALESCE(a.unique_opens, 0) AS unique_opens,
            COALESCE(a.unique_clicks, 0) AS unique_clicks,
            COALESCE(a.open_rate, (0)::numeric) AS open_rate,
            COALESCE(a.click_rate, (0)::numeric) AS click_rate,
            COALESCE(a.click_to_open_rate, (0)::numeric) AS click_to_open_rate
        FROM (communication_campaigns c
            LEFT JOIN email_campaign_analytics a ON ((c.id = a.campaign_id)))
        WHERE (''email''::text = ANY (c.channels))';

        GRANT SELECT ON public.email_campaign_performance TO authenticated;
        RAISE NOTICE 'Recreated view: email_campaign_performance with SECURITY INVOKER';
    ELSE
        RAISE NOTICE 'Skipped view: email_campaign_performance (table email_campaign_analytics does not exist)';
    END IF;
END $$;

-- 14.4 inbox_summary - Conversation summary (organizer-scoped)
-- Only create if conversations table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversations') THEN
        DROP VIEW IF EXISTS public.inbox_summary;
        CREATE VIEW public.inbox_summary
        WITH (security_invoker = true)
        AS
        SELECT organizer_id,
            channel,
            count(*) AS total_conversations,
            count(*) FILTER (WHERE ((status)::text = 'open'::text)) AS open_conversations,
            sum(unread_count) AS total_unread,
            max(last_message_at) AS latest_message
        FROM conversations
        GROUP BY organizer_id, channel;

        GRANT SELECT ON public.inbox_summary TO authenticated;
        RAISE NOTICE 'Recreated view: inbox_summary with SECURITY INVOKER';
    ELSE
        RAISE NOTICE 'Skipped view: inbox_summary (table conversations does not exist)';
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after applying to verify RLS is enabled:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- AND tablename IN (
--     'countries', 'communication_credit_expiry', 'admin_feature_logs',
--     'user_role_assignments', 'user_sessions', 'user_otp',
--     'user_ip_restrictions', 'security_audit_logs', 'user_devices',
--     'sensitive_actions_log', 'feature_categories', 'country_features'
-- );
--
-- Expected: rowsecurity = true for all tables
-- ============================================
