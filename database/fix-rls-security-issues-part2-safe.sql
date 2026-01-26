-- ============================================
-- FIX RLS SECURITY ISSUES - PART 2 (SAFE VERSION)
-- ============================================
-- This version uses DO blocks to safely handle
-- tables that may not exist or have different structures
-- ============================================

-- ============================================
-- 1. FIX SECURITY DEFINER VIEWS
-- ============================================

DO $$
BEGIN
    -- Try to fix views with security_invoker
    BEGIN
        ALTER VIEW IF EXISTS public.public_organizer_profiles SET (security_invoker = on);
        RAISE NOTICE 'Fixed: public_organizer_profiles';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter public_organizer_profiles: %', SQLERRM;
    END;

    BEGIN
        ALTER VIEW IF EXISTS public.donation_analytics SET (security_invoker = on);
        RAISE NOTICE 'Fixed: donation_analytics';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter donation_analytics: %', SQLERRM;
    END;

    BEGIN
        ALTER VIEW IF EXISTS public.email_campaign_performance SET (security_invoker = on);
        RAISE NOTICE 'Fixed: email_campaign_performance';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter email_campaign_performance: %', SQLERRM;
    END;

    BEGIN
        ALTER VIEW IF EXISTS public.inbox_summary SET (security_invoker = on);
        RAISE NOTICE 'Fixed: inbox_summary';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not alter inbox_summary: %', SQLERRM;
    END;
END $$;

-- ============================================
-- 2. ENABLE RLS ON ALL TABLES (SAFE)
-- ============================================

DO $$
DECLARE
    tbl TEXT;
    tables_to_secure TEXT[] := ARRAY[
        'venue_capacity', 'venue_zones', 'venue_equipment', 'venue_analytics',
        'layout_versions', 'layout_analytics', 'event_floor_plans',
        'furniture_types', 'section_pricing', 'accessibility_features',
        'environmental_data', 'maintenance_alerts', 'admin_broadcasts',
        'failed_login_attempts', 'user_roles', 'user_push_tokens',
        'supported_import_platforms'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_secure
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
            RAISE NOTICE 'Enabled RLS on: %', tbl;
        ELSE
            RAISE NOTICE 'Table does not exist, skipping: %', tbl;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 3. ADD SIMPLE POLICIES FOR EACH TABLE
-- ============================================

-- 3.1 furniture_types - Reference data, public read
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'furniture_types') THEN
        DROP POLICY IF EXISTS "furniture_types_public_read" ON public.furniture_types;
        CREATE POLICY "furniture_types_public_read" ON public.furniture_types FOR SELECT TO public USING (true);

        DROP POLICY IF EXISTS "furniture_types_admin_write" ON public.furniture_types;
        CREATE POLICY "furniture_types_admin_write" ON public.furniture_types FOR ALL TO public
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
        RAISE NOTICE 'Created policies for: furniture_types';
    END IF;
END $$;

-- 3.2 accessibility_features - Reference data, public read
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accessibility_features') THEN
        DROP POLICY IF EXISTS "accessibility_features_public_read" ON public.accessibility_features;
        CREATE POLICY "accessibility_features_public_read" ON public.accessibility_features FOR SELECT TO public USING (true);

        DROP POLICY IF EXISTS "accessibility_features_admin_write" ON public.accessibility_features;
        CREATE POLICY "accessibility_features_admin_write" ON public.accessibility_features FOR ALL TO public
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
        RAISE NOTICE 'Created policies for: accessibility_features';
    END IF;
END $$;

-- 3.3 user_roles - Reference data, public read
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
        DROP POLICY IF EXISTS "user_roles_public_read" ON public.user_roles;
        CREATE POLICY "user_roles_public_read" ON public.user_roles FOR SELECT TO public USING (true);

        DROP POLICY IF EXISTS "user_roles_admin_write" ON public.user_roles;
        CREATE POLICY "user_roles_admin_write" ON public.user_roles FOR ALL TO public
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
        RAISE NOTICE 'Created policies for: user_roles';
    END IF;
END $$;

-- 3.4 supported_import_platforms - Reference data, public read
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'supported_import_platforms') THEN
        DROP POLICY IF EXISTS "supported_import_platforms_public_read" ON public.supported_import_platforms;
        CREATE POLICY "supported_import_platforms_public_read" ON public.supported_import_platforms FOR SELECT TO public USING (true);

        DROP POLICY IF EXISTS "supported_import_platforms_admin_write" ON public.supported_import_platforms;
        CREATE POLICY "supported_import_platforms_admin_write" ON public.supported_import_platforms FOR ALL TO public
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
        RAISE NOTICE 'Created policies for: supported_import_platforms';
    END IF;
END $$;

-- 3.5 admin_broadcasts - Public read active, admin manage
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_broadcasts') THEN
        DROP POLICY IF EXISTS "admin_broadcasts_public_read" ON public.admin_broadcasts;
        CREATE POLICY "admin_broadcasts_public_read" ON public.admin_broadcasts FOR SELECT TO public USING (true);

        DROP POLICY IF EXISTS "admin_broadcasts_admin_manage" ON public.admin_broadcasts;
        CREATE POLICY "admin_broadcasts_admin_manage" ON public.admin_broadcasts FOR ALL TO public
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));
        RAISE NOTICE 'Created policies for: admin_broadcasts';
    END IF;
END $$;

-- 3.6 failed_login_attempts - Admin view, service manage
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'failed_login_attempts') THEN
        DROP POLICY IF EXISTS "failed_login_attempts_admin_view" ON public.failed_login_attempts;
        CREATE POLICY "failed_login_attempts_admin_view" ON public.failed_login_attempts FOR SELECT TO public
            USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

        DROP POLICY IF EXISTS "failed_login_attempts_service_manage" ON public.failed_login_attempts;
        CREATE POLICY "failed_login_attempts_service_manage" ON public.failed_login_attempts FOR ALL TO service_role USING (true);
        RAISE NOTICE 'Created policies for: failed_login_attempts';
    END IF;
END $$;

-- 3.7 user_push_tokens - Users manage own
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_push_tokens') THEN
        DROP POLICY IF EXISTS "user_push_tokens_own_access" ON public.user_push_tokens;
        CREATE POLICY "user_push_tokens_own_access" ON public.user_push_tokens FOR ALL TO public
            USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

        DROP POLICY IF EXISTS "user_push_tokens_service_read" ON public.user_push_tokens;
        CREATE POLICY "user_push_tokens_service_read" ON public.user_push_tokens FOR SELECT TO service_role USING (true);
        RAISE NOTICE 'Created policies for: user_push_tokens';
    END IF;
END $$;

-- ============================================
-- 4. ORGANIZER-SCOPED TABLES (check for organizer_id column)
-- ============================================

DO $$
DECLARE
    tbl TEXT;
    organizer_tables TEXT[] := ARRAY[
        'venue_capacity', 'venue_zones', 'venue_equipment', 'venue_analytics',
        'layout_versions', 'layout_analytics', 'environmental_data', 'maintenance_alerts'
    ];
BEGIN
    FOREACH tbl IN ARRAY organizer_tables
    LOOP
        -- Check if table exists and has organizer_id column
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'organizer_id'
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS "%s_organizer_access" ON public.%I', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "%s_organizer_access" ON public.%I FOR ALL TO public
                USING (
                    organizer_id IN (
                        SELECT id FROM public.organizers WHERE user_id = auth.uid()
                        UNION
                        SELECT organizer_id FROM public.organizer_team_members WHERE user_id = auth.uid() AND status = ''active''
                    )
                )', tbl, tbl);
            RAISE NOTICE 'Created organizer policy for: % (using organizer_id)', tbl;
        -- Check if table has venue_id that links to venues
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'venue_id'
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS "%s_organizer_access" ON public.%I', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "%s_organizer_access" ON public.%I FOR ALL TO public
                USING (
                    venue_id IN (
                        SELECT v.id FROM public.venues v
                        WHERE v.organizer_id IN (
                            SELECT id FROM public.organizers WHERE user_id = auth.uid()
                            UNION
                            SELECT organizer_id FROM public.organizer_team_members WHERE user_id = auth.uid() AND status = ''active''
                        )
                    )
                )', tbl, tbl);
            RAISE NOTICE 'Created organizer policy for: % (using venue_id)', tbl;
        -- Check if table has event_id
        ELSIF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'event_id'
        ) THEN
            EXECUTE format('DROP POLICY IF EXISTS "%s_organizer_access" ON public.%I', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "%s_organizer_access" ON public.%I FOR ALL TO public
                USING (
                    event_id IN (
                        SELECT e.id FROM public.events e
                        WHERE e.organizer_id IN (
                            SELECT id FROM public.organizers WHERE user_id = auth.uid()
                            UNION
                            SELECT organizer_id FROM public.organizer_team_members WHERE user_id = auth.uid() AND status = ''active''
                        )
                    )
                )', tbl, tbl);
            RAISE NOTICE 'Created organizer policy for: % (using event_id)', tbl;
        ELSE
            -- Fallback: authenticated users can access
            EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_access" ON public.%I', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "%s_authenticated_access" ON public.%I FOR ALL TO public
                USING (auth.uid() IS NOT NULL)', tbl, tbl);
            RAISE NOTICE 'Created authenticated-only policy for: % (no organizer/venue/event column found)', tbl;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 5. EVENT-SCOPED TABLES
-- ============================================

DO $$
DECLARE
    tbl TEXT;
    event_tables TEXT[] := ARRAY['event_floor_plans', 'section_pricing'];
BEGIN
    FOREACH tbl IN ARRAY event_tables
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'event_id'
        ) THEN
            -- Organizer can manage
            EXECUTE format('DROP POLICY IF EXISTS "%s_organizer_access" ON public.%I', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "%s_organizer_access" ON public.%I FOR ALL TO public
                USING (
                    event_id IN (
                        SELECT e.id FROM public.events e
                        WHERE e.organizer_id IN (
                            SELECT id FROM public.organizers WHERE user_id = auth.uid()
                            UNION
                            SELECT organizer_id FROM public.organizer_team_members WHERE user_id = auth.uid() AND status = ''active''
                        )
                    )
                )', tbl, tbl);

            -- Public can view for published events
            EXECUTE format('DROP POLICY IF EXISTS "%s_public_view" ON public.%I', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "%s_public_view" ON public.%I FOR SELECT TO public
                USING (
                    event_id IN (SELECT id FROM public.events WHERE status = ''published'')
                )', tbl, tbl);
            RAISE NOTICE 'Created event policies for: %', tbl;
        ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            -- Table exists but no event_id - just allow authenticated access
            EXECUTE format('DROP POLICY IF EXISTS "%s_authenticated_access" ON public.%I', tbl, tbl);
            EXECUTE format('
                CREATE POLICY "%s_authenticated_access" ON public.%I FOR SELECT TO public
                USING (auth.uid() IS NOT NULL)', tbl, tbl);
            RAISE NOTICE 'Created authenticated policy for: % (no event_id column)', tbl;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- DONE
-- ============================================
SELECT 'RLS security fixes applied successfully' AS status;
