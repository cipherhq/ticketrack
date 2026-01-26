-- ============================================
-- FIX RLS SECURITY ISSUES - PART 2
-- ============================================
-- Fixes remaining 22 security issues from Supabase Security Advisor
-- ============================================

-- ============================================
-- 1. FIX SECURITY DEFINER VIEWS
-- ============================================
-- The previous approach used PostgreSQL 15+ syntax.
-- Using ALTER VIEW instead for compatibility.

-- 1.1 public_organizer_profiles
ALTER VIEW IF EXISTS public.public_organizer_profiles SET (security_invoker = on);

-- 1.2 donation_analytics
ALTER VIEW IF EXISTS public.donation_analytics SET (security_invoker = on);

-- 1.3 email_campaign_performance
ALTER VIEW IF EXISTS public.email_campaign_performance SET (security_invoker = on);

-- 1.4 inbox_summary
ALTER VIEW IF EXISTS public.inbox_summary SET (security_invoker = on);

-- ============================================
-- 2. ENABLE RLS ON REMAINING TABLES
-- ============================================

-- Venue Management Tables
ALTER TABLE IF EXISTS public.venue_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.venue_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.venue_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.venue_analytics ENABLE ROW LEVEL SECURITY;

-- Layout/Floor Plan Tables
ALTER TABLE IF EXISTS public.layout_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.layout_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.event_floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.furniture_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.section_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.accessibility_features ENABLE ROW LEVEL SECURITY;

-- Environmental/IoT Tables
ALTER TABLE IF EXISTS public.environmental_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.maintenance_alerts ENABLE ROW LEVEL SECURITY;

-- Admin/System Tables
ALTER TABLE IF EXISTS public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.failed_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supported_import_platforms ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. VENUE MANAGEMENT POLICIES
-- These are organizer-scoped tables
-- ============================================

-- 3.1 venue_capacity - Organizer manages their venue capacity
DROP POLICY IF EXISTS "venue_capacity_organizer_access" ON public.venue_capacity;
CREATE POLICY "venue_capacity_organizer_access" ON public.venue_capacity
    FOR ALL TO public
    USING (
        venue_id IN (
            SELECT v.id FROM public.venues v
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- 3.2 venue_zones - Organizer manages venue zones
DROP POLICY IF EXISTS "venue_zones_organizer_access" ON public.venue_zones;
CREATE POLICY "venue_zones_organizer_access" ON public.venue_zones
    FOR ALL TO public
    USING (
        venue_id IN (
            SELECT v.id FROM public.venues v
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- 3.3 venue_equipment - Organizer manages venue equipment
DROP POLICY IF EXISTS "venue_equipment_organizer_access" ON public.venue_equipment;
CREATE POLICY "venue_equipment_organizer_access" ON public.venue_equipment
    FOR ALL TO public
    USING (
        venue_id IN (
            SELECT v.id FROM public.venues v
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- 3.4 venue_analytics - Organizer views venue analytics
DROP POLICY IF EXISTS "venue_analytics_organizer_access" ON public.venue_analytics;
CREATE POLICY "venue_analytics_organizer_access" ON public.venue_analytics
    FOR SELECT TO public
    USING (
        venue_id IN (
            SELECT v.id FROM public.venues v
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- Service role can insert analytics
DROP POLICY IF EXISTS "venue_analytics_service_insert" ON public.venue_analytics;
CREATE POLICY "venue_analytics_service_insert" ON public.venue_analytics
    FOR INSERT TO service_role
    WITH CHECK (true);

-- ============================================
-- 4. LAYOUT/FLOOR PLAN POLICIES
-- ============================================

-- 4.1 layout_versions - Organizer manages layout versions
DROP POLICY IF EXISTS "layout_versions_organizer_access" ON public.layout_versions;
CREATE POLICY "layout_versions_organizer_access" ON public.layout_versions
    FOR ALL TO public
    USING (
        venue_id IN (
            SELECT v.id FROM public.venues v
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- 4.2 layout_analytics - Organizer views, service writes
DROP POLICY IF EXISTS "layout_analytics_organizer_view" ON public.layout_analytics;
CREATE POLICY "layout_analytics_organizer_view" ON public.layout_analytics
    FOR SELECT TO public
    USING (
        layout_id IN (
            SELECT lv.id FROM public.layout_versions lv
            JOIN public.venues v ON lv.venue_id = v.id
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

DROP POLICY IF EXISTS "layout_analytics_service_manage" ON public.layout_analytics;
CREATE POLICY "layout_analytics_service_manage" ON public.layout_analytics
    FOR ALL TO service_role
    USING (true);

-- 4.3 event_floor_plans - Organizer manages event floor plans
DROP POLICY IF EXISTS "event_floor_plans_organizer_access" ON public.event_floor_plans;
CREATE POLICY "event_floor_plans_organizer_access" ON public.event_floor_plans
    FOR ALL TO public
    USING (
        event_id IN (
            SELECT e.id FROM public.events e
            WHERE e.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- Public can view floor plans for public events (for seat selection)
DROP POLICY IF EXISTS "event_floor_plans_public_view" ON public.event_floor_plans;
CREATE POLICY "event_floor_plans_public_view" ON public.event_floor_plans
    FOR SELECT TO public
    USING (
        event_id IN (
            SELECT id FROM public.events
            WHERE status = 'published' AND is_active = true
        )
    );

-- 4.4 furniture_types - Reference data, public read
DROP POLICY IF EXISTS "furniture_types_public_read" ON public.furniture_types;
CREATE POLICY "furniture_types_public_read" ON public.furniture_types
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "furniture_types_admin_write" ON public.furniture_types;
CREATE POLICY "furniture_types_admin_write" ON public.furniture_types
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- 4.5 section_pricing - Organizer manages pricing
DROP POLICY IF EXISTS "section_pricing_organizer_access" ON public.section_pricing;
CREATE POLICY "section_pricing_organizer_access" ON public.section_pricing
    FOR ALL TO public
    USING (
        event_id IN (
            SELECT e.id FROM public.events e
            WHERE e.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

-- Public can view pricing for published events
DROP POLICY IF EXISTS "section_pricing_public_view" ON public.section_pricing;
CREATE POLICY "section_pricing_public_view" ON public.section_pricing
    FOR SELECT TO public
    USING (
        event_id IN (
            SELECT id FROM public.events
            WHERE status = 'published' AND is_active = true
        )
    );

-- 4.6 accessibility_features - Reference data, public read
DROP POLICY IF EXISTS "accessibility_features_public_read" ON public.accessibility_features;
CREATE POLICY "accessibility_features_public_read" ON public.accessibility_features
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "accessibility_features_admin_write" ON public.accessibility_features;
CREATE POLICY "accessibility_features_admin_write" ON public.accessibility_features
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- ============================================
-- 5. ENVIRONMENTAL/IoT POLICIES
-- ============================================

-- 5.1 environmental_data - Organizer views, service writes
DROP POLICY IF EXISTS "environmental_data_organizer_view" ON public.environmental_data;
CREATE POLICY "environmental_data_organizer_view" ON public.environmental_data
    FOR SELECT TO public
    USING (
        venue_id IN (
            SELECT v.id FROM public.venues v
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

DROP POLICY IF EXISTS "environmental_data_service_manage" ON public.environmental_data;
CREATE POLICY "environmental_data_service_manage" ON public.environmental_data
    FOR ALL TO service_role
    USING (true);

-- 5.2 maintenance_alerts - Organizer manages alerts
DROP POLICY IF EXISTS "maintenance_alerts_organizer_access" ON public.maintenance_alerts;
CREATE POLICY "maintenance_alerts_organizer_access" ON public.maintenance_alerts
    FOR ALL TO public
    USING (
        venue_id IN (
            SELECT v.id FROM public.venues v
            WHERE v.organizer_id IN (
                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                UNION
                SELECT organizer_id FROM public.organizer_team_members
                WHERE user_id = auth.uid() AND status = 'active'
            )
        )
    );

DROP POLICY IF EXISTS "maintenance_alerts_service_manage" ON public.maintenance_alerts;
CREATE POLICY "maintenance_alerts_service_manage" ON public.maintenance_alerts
    FOR ALL TO service_role
    USING (true);

-- ============================================
-- 6. ADMIN/SYSTEM POLICIES
-- ============================================

-- 6.1 admin_broadcasts - Admin creates, all authenticated read
DROP POLICY IF EXISTS "admin_broadcasts_public_read" ON public.admin_broadcasts;
CREATE POLICY "admin_broadcasts_public_read" ON public.admin_broadcasts
    FOR SELECT TO public
    USING (
        is_active = true
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
    );

DROP POLICY IF EXISTS "admin_broadcasts_admin_manage" ON public.admin_broadcasts;
CREATE POLICY "admin_broadcasts_admin_manage" ON public.admin_broadcasts
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- 6.2 failed_login_attempts - Service role only (security)
DROP POLICY IF EXISTS "failed_login_attempts_service_only" ON public.failed_login_attempts;
CREATE POLICY "failed_login_attempts_service_only" ON public.failed_login_attempts
    FOR ALL TO service_role
    USING (true);

-- Admin can view for monitoring
DROP POLICY IF EXISTS "failed_login_attempts_admin_view" ON public.failed_login_attempts;
CREATE POLICY "failed_login_attempts_admin_view" ON public.failed_login_attempts
    FOR SELECT TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- 6.3 user_roles - Reference data, public read needed for role checks
DROP POLICY IF EXISTS "user_roles_public_read" ON public.user_roles;
CREATE POLICY "user_roles_public_read" ON public.user_roles
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
CREATE POLICY "user_roles_admin_write" ON public.user_roles
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- 6.4 user_push_tokens - Users manage own tokens only
DROP POLICY IF EXISTS "user_push_tokens_own_access" ON public.user_push_tokens;
CREATE POLICY "user_push_tokens_own_access" ON public.user_push_tokens
    FOR ALL TO public
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Service role can send push notifications
DROP POLICY IF EXISTS "user_push_tokens_service_read" ON public.user_push_tokens;
CREATE POLICY "user_push_tokens_service_read" ON public.user_push_tokens
    FOR SELECT TO service_role
    USING (true);

-- 6.5 supported_import_platforms - Reference data, public read
DROP POLICY IF EXISTS "supported_import_platforms_public_read" ON public.supported_import_platforms;
CREATE POLICY "supported_import_platforms_public_read" ON public.supported_import_platforms
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "supported_import_platforms_admin_write" ON public.supported_import_platforms;
CREATE POLICY "supported_import_platforms_admin_write" ON public.supported_import_platforms
    FOR ALL TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- ============================================
-- SUMMARY OF ACCESS PATTERNS
-- ============================================
--
-- PUBLIC READ (no auth required):
-- - furniture_types, accessibility_features, user_roles,
--   supported_import_platforms, admin_broadcasts (active only)
--
-- PUBLIC READ FOR PUBLISHED EVENTS:
-- - event_floor_plans, section_pricing
--
-- ORGANIZER-SCOPED (owner + team):
-- - venue_capacity, venue_zones, venue_equipment, venue_analytics
-- - layout_versions, layout_analytics, event_floor_plans, section_pricing
-- - environmental_data, maintenance_alerts
--
-- USER-SCOPED (own data only):
-- - user_push_tokens
--
-- ADMIN ONLY:
-- - failed_login_attempts (view), admin_broadcasts (manage)
--
-- SERVICE ROLE:
-- - environmental_data, venue_analytics, layout_analytics,
--   maintenance_alerts, failed_login_attempts
-- ============================================
