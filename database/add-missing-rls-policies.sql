-- ============================================================================
-- ADD MISSING RLS POLICIES TO DEV DATABASE
-- ============================================================================
-- This script adds RLS policies that exist in production but are missing in dev
-- Run this in DEV Supabase SQL Editor
-- ============================================================================
-- Note: Some policies may reference tables that don't exist yet in dev.
-- Those will fail gracefully and can be added later when the tables are created.
-- ============================================================================

-- ============================================================================
-- TABLE: auto_responses
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auto_responses') THEN
        CREATE POLICY "Organizers can manage their auto responses" ON public.auto_responses
            AS PERMISSIVE
            FOR ALL
            TO public
            USING (organizer_id IN ( SELECT organizers.id
               FROM organizers
              WHERE (organizers.user_id = auth.uid())));
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_automation_runs
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_automation_runs') THEN
        -- Check if policy already exists
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_automation_runs' AND policyname = 'automation_runs_organizer_access') THEN
            CREATE POLICY "automation_runs_organizer_access" ON public.communication_automation_runs
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_automations
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_automations') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_automations' AND policyname = 'automations_organizer_access') THEN
            CREATE POLICY "automations_organizer_access" ON public.communication_automations
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_campaigns
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_campaigns') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_campaigns' AND policyname = 'campaigns_organizer_access') THEN
            CREATE POLICY "campaigns_organizer_access" ON public.communication_campaigns
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_credit_balances
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_credit_balances') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_credit_balances' AND policyname = 'credit_balances_organizer_access') THEN
            CREATE POLICY "credit_balances_organizer_access" ON public.communication_credit_balances
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_credit_transactions
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_credit_transactions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND table_name = 'communication_credit_transactions' AND policyname = 'credit_transactions_organizer_access') THEN
            CREATE POLICY "credit_transactions_organizer_access" ON public.communication_credit_transactions
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_messages
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_messages') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_messages' AND policyname = 'messages_organizer_access') THEN
            CREATE POLICY "messages_organizer_access" ON public.communication_messages
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_scheduled_jobs
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_scheduled_jobs') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_scheduled_jobs' AND policyname = 'scheduled_jobs_organizer_access') THEN
            CREATE POLICY "scheduled_jobs_organizer_access" ON public.communication_scheduled_jobs
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: communication_templates
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'communication_templates') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'communication_templates' AND policyname = 'templates_access') THEN
            CREATE POLICY "templates_access" ON public.communication_templates
                AS PERMISSIVE
                FOR ALL
                TO public
                USING ((is_system = true) OR (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text)))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: contact_scores
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_scores') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_scores' AND policyname = 'Organizers can view their contact scores') THEN
            CREATE POLICY "Organizers can view their contact scores" ON public.contact_scores
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_scores' AND policyname = 'Service role manages scores') THEN
            CREATE POLICY "Service role manages scores" ON public.contact_scores
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: contact_segments
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_segments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contact_segments' AND policyname = 'segments_organizer_access') THEN
            CREATE POLICY "segments_organizer_access" ON public.contact_segments
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: conversation_messages
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_messages') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_messages' AND policyname = 'Organizers can manage their messages') THEN
            CREATE POLICY "Organizers can manage their messages" ON public.conversation_messages
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_messages' AND policyname = 'Organizers can view their messages') THEN
            CREATE POLICY "Organizers can view their messages" ON public.conversation_messages
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: conversations
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversations') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Organizers can manage their conversations') THEN
            CREATE POLICY "Organizers can manage their conversations" ON public.conversations
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'Organizers can view their conversations') THEN
            CREATE POLICY "Organizers can view their conversations" ON public.conversations
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: country_features
-- ============================================================================
-- Note: This table exists in dev, but checking if all policies are present
-- (Already exists in dev based on the list provided)

-- ============================================================================
-- TABLE: drip_campaign_steps
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drip_campaign_steps') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drip_campaign_steps' AND policyname = 'Organizers can manage their drip steps') THEN
            CREATE POLICY "Organizers can manage their drip steps" ON public.drip_campaign_steps
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: drip_campaigns
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drip_campaigns') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drip_campaigns' AND policyname = 'Organizers can manage their drip campaigns') THEN
            CREATE POLICY "Organizers can manage their drip campaigns" ON public.drip_campaigns
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: drip_enrollments (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drip_enrollments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drip_enrollments' AND policyname = 'Organizers can view enrollments') THEN
            CREATE POLICY "Organizers can view enrollments" ON public.drip_enrollments
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drip_enrollments' AND policyname = 'Service role manages enrollments') THEN
            CREATE POLICY "Service role manages enrollments" ON public.drip_enrollments
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: drip_step_executions (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'drip_step_executions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drip_step_executions' AND policyname = 'Organizers can view executions') THEN
            CREATE POLICY "Organizers can view executions" ON public.drip_step_executions
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'drip_step_executions' AND policyname = 'Service role manages executions') THEN
            CREATE POLICY "Service role manages executions" ON public.drip_step_executions
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: email_campaign_analytics (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_campaign_analytics') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_campaign_analytics' AND policyname = 'Organizers can view their analytics') THEN
            CREATE POLICY "Organizers can view their analytics" ON public.email_campaign_analytics
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_campaign_analytics' AND policyname = 'Service role can manage analytics') THEN
            CREATE POLICY "Service role can manage analytics" ON public.email_campaign_analytics
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: email_tracked_links
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_tracked_links') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_tracked_links' AND policyname = 'Organizers can view their tracked links') THEN
            CREATE POLICY "Organizers can view their tracked links" ON public.email_tracked_links
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_tracked_links' AND policyname = 'Service role can manage tracked links') THEN
            CREATE POLICY "Service role can manage tracked links" ON public.email_tracked_links
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: email_tracking_events
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_tracking_events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_tracking_events' AND policyname = 'Organizers can view their tracking events') THEN
            CREATE POLICY "Organizers can view their tracking events" ON public.email_tracking_events
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_tracking_events' AND policyname = 'Service role can manage tracking events') THEN
            CREATE POLICY "Service role can manage tracking events" ON public.email_tracking_events
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: event_group_buy_settings (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_group_buy_settings') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_group_buy_settings' AND policyname = 'Anyone can view group settings') THEN
            CREATE POLICY "Anyone can view group settings" ON public.event_group_buy_settings
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (true);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_group_buy_settings' AND policyname = 'Organizers can manage group settings') THEN
            CREATE POLICY "Organizers can manage group settings" ON public.event_group_buy_settings
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (event_id IN ( SELECT e.id
                   FROM (events e
                     JOIN organizers o ON ((e.organizer_id = o.id)))
                  WHERE (o.user_id = auth.uid())));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: event_similarity (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_similarity') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_similarity' AND policyname = 'Anyone can read similarity scores') THEN
            CREATE POLICY "Anyone can read similarity scores" ON public.event_similarity
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (true);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: events
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Managers view all events') THEN
            CREATE POLICY "Managers view all events" ON public.events
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT otm.organizer_id
                   FROM organizer_team_members otm
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text) AND (otm.role = ANY (ARRAY['owner'::text, 'manager'::text])))));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'events' AND policyname = 'Staff view task events') THEN
            CREATE POLICY "Staff view task events" ON public.events
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (id IN ( SELECT DISTINCT et.event_id
                   FROM (event_tasks et
                     JOIN organizer_team_members otm ON ((et.assigned_to = otm.id)))
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text) AND (otm.role = ANY (ARRAY['coordinator'::text, 'staff'::text])))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: event_tasks
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_tasks') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_tasks' AND policyname = 'Coordinators edit assigned tasks') THEN
            CREATE POLICY "Coordinators edit assigned tasks" ON public.event_tasks
                AS PERMISSIVE
                FOR UPDATE
                TO public
                USING (assigned_to IN ( SELECT otm.id
                   FROM organizer_team_members otm
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text) AND (otm.role = 'coordinator'::text))));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_tasks' AND policyname = 'Coordinators view all tasks') THEN
            CREATE POLICY "Coordinators view all tasks" ON public.event_tasks
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT otm.organizer_id
                   FROM organizer_team_members otm
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text) AND (otm.role = 'coordinator'::text))));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_tasks' AND policyname = 'Managers full task access') THEN
            CREATE POLICY "Managers full task access" ON public.event_tasks
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT otm.organizer_id
                   FROM organizer_team_members otm
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text) AND (otm.role = ANY (ARRAY['owner'::text, 'manager'::text])))));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'event_tasks' AND policyname = 'Staff view assigned tasks') THEN
            CREATE POLICY "Staff view assigned tasks" ON public.event_tasks
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (assigned_to IN ( SELECT otm.id
                   FROM organizer_team_members otm
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text) AND (otm.role = 'staff'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: external_platform_connections (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'external_platform_connections') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'external_platform_connections' AND policyname = 'external_platform_connections_organizer_access') THEN
            CREATE POLICY "external_platform_connections_organizer_access" ON public.external_platform_connections
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: fast_payout_requests (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fast_payout_requests') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fast_payout_requests' AND policyname = 'Organizers can create fast payout requests') THEN
            CREATE POLICY "Organizers can create fast payout requests" ON public.fast_payout_requests
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fast_payout_requests' AND policyname = 'Organizers can view their fast payout requests') THEN
            CREATE POLICY "Organizers can view their fast payout requests" ON public.fast_payout_requests
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fast_payout_requests' AND policyname = 'Service role can manage fast payouts') THEN
            CREATE POLICY "Service role can manage fast payouts" ON public.fast_payout_requests
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: fast_payout_settings (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fast_payout_settings') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fast_payout_settings' AND policyname = 'Anyone can read fast payout settings') THEN
            CREATE POLICY "Anyone can read fast payout settings" ON public.fast_payout_settings
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (true);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fast_payout_settings' AND policyname = 'Service role can update settings') THEN
            CREATE POLICY "Service role can update settings" ON public.fast_payout_settings
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: group_buy_invitations (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_buy_invitations') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_invitations' AND policyname = 'Session members can create invitations') THEN
            CREATE POLICY "Session members can create invitations" ON public.group_buy_invitations
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (session_id IN ( SELECT group_buy_members.session_id
                   FROM group_buy_members
                  WHERE (group_buy_members.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_invitations' AND policyname = 'Users can update their invitations') THEN
            CREATE POLICY "Users can update their invitations" ON public.group_buy_invitations
                AS PERMISSIVE
                FOR UPDATE
                TO public
                USING (((email)::text = (( SELECT users.email
                   FROM auth.users
                  WHERE (users.id = auth.uid())))::text));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_invitations' AND policyname = 'Users can view invitations to their email') THEN
            CREATE POLICY "Users can view invitations to their email" ON public.group_buy_invitations
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING ((((email)::text = (( SELECT users.email
                   FROM auth.users
                  WHERE (users.id = auth.uid())))::text) OR (session_id IN ( SELECT group_buy_members.session_id
                   FROM group_buy_members
                  WHERE (group_buy_members.user_id = auth.uid())))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: group_buy_members (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_buy_members') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_members' AND policyname = 'Authenticated can join') THEN
            CREATE POLICY "Authenticated can join" ON public.group_buy_members
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (auth.uid() IS NOT NULL);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_members' AND policyname = 'Members can update self') THEN
            CREATE POLICY "Members can update self" ON public.group_buy_members
                AS PERMISSIVE
                FOR UPDATE
                TO public
                USING (auth.uid() = user_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_members' AND policyname = 'Public can view members') THEN
            CREATE POLICY "Public can view members" ON public.group_buy_members
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (true);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: group_buy_messages (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_buy_messages') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_messages' AND policyname = 'Authenticated can send messages') THEN
            CREATE POLICY "Authenticated can send messages" ON public.group_buy_messages
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (auth.uid() IS NOT NULL);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_messages' AND policyname = 'Public can view messages') THEN
            CREATE POLICY "Public can view messages" ON public.group_buy_messages
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (true);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: group_buy_sessions (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_buy_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_sessions' AND policyname = 'Authenticated can create sessions') THEN
            CREATE POLICY "Authenticated can create sessions" ON public.group_buy_sessions
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (auth.uid() IS NOT NULL);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_sessions' AND policyname = 'Hosts can update sessions') THEN
            CREATE POLICY "Hosts can update sessions" ON public.group_buy_sessions
                AS PERMISSIVE
                FOR UPDATE
                TO public
                USING (auth.uid() = host_user_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_buy_sessions' AND policyname = 'Public can view active sessions') THEN
            CREATE POLICY "Public can view active sessions" ON public.group_buy_sessions
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (true);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: group_split_payments (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_split_payments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_split_payments' AND policyname = 'Group members can view split payments') THEN
            CREATE POLICY "Group members can view split payments" ON public.group_split_payments
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (session_id IN ( SELECT group_buy_members.session_id
                   FROM group_buy_members
                  WHERE (group_buy_members.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_split_payments' AND policyname = 'Initiator can create split payments') THEN
            CREATE POLICY "Initiator can create split payments" ON public.group_split_payments
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (auth.uid() = initiated_by);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_split_payments' AND policyname = 'Initiator can update split payments') THEN
            CREATE POLICY "Initiator can update split payments" ON public.group_split_payments
                AS PERMISSIVE
                FOR UPDATE
                TO public
                USING (auth.uid() = initiated_by);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: group_split_shares (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'group_split_shares') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_split_shares' AND policyname = 'System can create shares') THEN
            CREATE POLICY "System can create shares" ON public.group_split_shares
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (true);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_split_shares' AND policyname = 'Users can update their shares') THEN
            CREATE POLICY "Users can update their shares" ON public.group_split_shares
                AS PERMISSIVE
                FOR UPDATE
                TO public
                USING ((user_id = auth.uid()) OR (user_id IS NULL));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'group_split_shares' AND policyname = 'Users can view their shares') THEN
            CREATE POLICY "Users can view their shares" ON public.group_split_shares
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING ((user_id = auth.uid()) OR (split_payment_id IN ( SELECT sp.id
                   FROM (group_split_payments sp
                     JOIN group_buy_members gbm ON ((gbm.session_id = sp.session_id)))
                  WHERE (gbm.user_id = auth.uid()))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: import_jobs (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'import_jobs') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'import_jobs' AND policyname = 'import_jobs_organizer_access') THEN
            CREATE POLICY "import_jobs_organizer_access" ON public.import_jobs
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: imported_attendees (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'imported_attendees') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imported_attendees' AND policyname = 'imported_attendees_organizer_access') THEN
            CREATE POLICY "imported_attendees_organizer_access" ON public.imported_attendees
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (imported_event_id IN ( SELECT imported_events.id
                   FROM imported_events
                  WHERE (imported_events.organizer_id IN ( SELECT organizers.id
                           FROM organizers
                          WHERE (organizers.user_id = auth.uid())
                        UNION
                         SELECT organizer_team_members.organizer_id
                           FROM organizer_team_members
                          WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: imported_events (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'imported_events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'imported_events' AND policyname = 'imported_events_organizer_access') THEN
            CREATE POLICY "imported_events_organizer_access" ON public.imported_events
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())
                UNION
                 SELECT organizer_team_members.organizer_id
                   FROM organizer_team_members
                  WHERE ((organizer_team_members.user_id = auth.uid()) AND (organizer_team_members.status = 'active'::text))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: inbound_message_log (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inbound_message_log') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'inbound_message_log' AND policyname = 'Service role can access inbound log') THEN
            CREATE POLICY "Service role can access inbound log" ON public.inbound_message_log
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: iot_sensors (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'iot_sensors') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'iot_sensors' AND policyname = 'Venue owners can manage sensors') THEN
            CREATE POLICY "Venue owners can manage sensors" ON public.iot_sensors
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (venue_id IN ( SELECT venues.id
                   FROM venues
                  WHERE (venues.organizer_id = ( SELECT organizers.id
                           FROM organizers
                          WHERE (organizers.user_id = auth.uid())))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: layout_furniture (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'layout_furniture') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'layout_furniture' AND policyname = 'Venue owners can manage furniture') THEN
            CREATE POLICY "Venue owners can manage furniture" ON public.layout_furniture
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (layout_id IN ( SELECT venue_layouts.id
                   FROM venue_layouts
                  WHERE (venue_layouts.venue_id IN ( SELECT venues.id
                           FROM venues
                          WHERE (venues.organizer_id = ( SELECT organizers.id
                                   FROM organizers
                                  WHERE (organizers.user_id = auth.uid())))))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: layout_sections
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'layout_sections') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'layout_sections' AND policyname = 'Venue owners can manage sections') THEN
            CREATE POLICY "Venue owners can manage sections" ON public.layout_sections
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (layout_id IN ( SELECT venue_layouts.id
                   FROM venue_layouts
                  WHERE (venue_layouts.venue_id IN ( SELECT venues.id
                           FROM venues
                          WHERE (venues.organizer_id = ( SELECT organizers.id
                                   FROM organizers
                                  WHERE (organizers.user_id = auth.uid())))))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: message_templates (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_templates') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_templates' AND policyname = 'Organizers can create templates') THEN
            CREATE POLICY "Organizers can create templates" ON public.message_templates
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_templates' AND policyname = 'Organizers can delete their own templates') THEN
            CREATE POLICY "Organizers can delete their own templates" ON public.message_templates
                AS PERMISSIVE
                FOR DELETE
                TO public
                USING (((organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid()))) AND (is_system = false)));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_templates' AND policyname = 'Organizers can update their own templates') THEN
            CREATE POLICY "Organizers can update their own templates" ON public.message_templates
                AS PERMISSIVE
                FOR UPDATE
                TO public
                USING (((organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid()))) AND (is_system = false)));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'message_templates' AND policyname = 'Organizers can view their own templates') THEN
            CREATE POLICY "Organizers can view their own templates" ON public.message_templates
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (((organizer_id = auth.uid()) OR (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: organizer_bank_accounts
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizer_bank_accounts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'organizer_bank_accounts' AND policyname = 'Block team member bank access') THEN
            CREATE POLICY "Block team member bank access" ON public.organizer_bank_accounts
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (NOT (EXISTS ( SELECT 1
                   FROM organizer_team_members otm
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text)))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: payouts
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payouts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payouts' AND policyname = 'Block team member payout access') THEN
            CREATE POLICY "Block team member payout access" ON public.payouts
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (NOT (EXISTS ( SELECT 1
                   FROM organizer_team_members otm
                  WHERE ((otm.user_id = auth.uid()) AND (otm.status = 'active'::text)))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: paystack_payouts (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'paystack_payouts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'paystack_payouts' AND policyname = 'Admins can manage all payouts') THEN
            CREATE POLICY "Admins can manage all payouts" ON public.paystack_payouts
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (EXISTS ( SELECT 1
                   FROM profiles
                  WHERE ((profiles.id = auth.uid()) AND ((profiles.role)::text = 'admin'::text))));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'paystack_payouts' AND policyname = 'Organizers can view their payouts') THEN
            CREATE POLICY "Organizers can view their payouts" ON public.paystack_payouts
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: platform_settings
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_settings') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Only authenticated users can update settings') THEN
            CREATE POLICY "Only authenticated users can update settings" ON public.platform_settings
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'authenticated'::text);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Platform settings are viewable by everyone') THEN
            CREATE POLICY "Platform settings are viewable by everyone" ON public.platform_settings
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (true);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: promoters
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'promoters') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'promoters' AND policyname = 'promoters_public_read') THEN
            CREATE POLICY "promoters_public_read" ON public.promoters
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING ((((status)::text = 'active'::text) AND (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.is_active = true)))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: saved_events
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'saved_events') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'saved_events' AND policyname = 'Users can manage saved events') THEN
            CREATE POLICY "Users can manage saved events" ON public.saved_events
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (user_id = auth.uid());
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: section_capacity (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'section_capacity') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'section_capacity' AND policyname = 'Authenticated users can read capacity') THEN
            CREATE POLICY "Authenticated users can read capacity" ON public.section_capacity
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (auth.role() = 'authenticated'::text);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'section_capacity' AND policyname = 'Venue owners can update capacity') THEN
            CREATE POLICY "Venue owners can update capacity" ON public.section_capacity
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (layout_id IN ( SELECT venue_layouts.id
                   FROM venue_layouts
                  WHERE (venue_layouts.venue_id IN ( SELECT venues.id
                           FROM venues
                          WHERE (venues.organizer_id = ( SELECT organizers.id
                                   FROM organizers
                                  WHERE (organizers.user_id = auth.uid())))))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: segment_memberships (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'segment_memberships') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segment_memberships' AND policyname = 'Organizers can view segment memberships') THEN
            CREATE POLICY "Organizers can view segment memberships" ON public.segment_memberships
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'segment_memberships' AND policyname = 'Service role manages memberships') THEN
            CREATE POLICY "Service role manages memberships" ON public.segment_memberships
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: sensor_readings (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sensor_readings') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sensor_readings' AND policyname = 'Authenticated users can read sensor data') THEN
            CREATE POLICY "Authenticated users can read sensor data" ON public.sensor_readings
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (auth.role() = 'authenticated'::text);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sensor_readings' AND policyname = 'Sensors can insert readings') THEN
            CREATE POLICY "Sensors can insert readings" ON public.sensor_readings
                AS PERMISSIVE
                FOR INSERT
                TO public
                WITH CHECK (true);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: smart_checkins (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'smart_checkins') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'smart_checkins' AND policyname = 'Organizers can view event check-ins') THEN
            CREATE POLICY "Organizers can view event check-ins" ON public.smart_checkins
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (event_id IN ( SELECT events.id
                   FROM events
                  WHERE (events.organizer_id = ( SELECT organizers.id
                           FROM organizers
                          WHERE (organizers.user_id = auth.uid())))));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'smart_checkins' AND policyname = 'Users can view their check-ins') THEN
            CREATE POLICY "Users can view their check-ins" ON public.smart_checkins
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (attendee_id = auth.uid());
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: smart_segments
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'smart_segments') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'smart_segments' AND policyname = 'Organizers can manage their segments') THEN
            CREATE POLICY "Organizers can manage their segments" ON public.smart_segments
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'smart_segments' AND policyname = 'Organizers can view their segments') THEN
            CREATE POLICY "Organizers can view their segments" ON public.smart_segments
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (organizer_id IN ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: user_event_interactions (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_event_interactions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_event_interactions' AND policyname = 'Service role full access interactions') THEN
            CREATE POLICY "Service role full access interactions" ON public.user_event_interactions
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND table_name = 'user_event_interactions' AND policyname = 'Users can manage their interactions') THEN
            CREATE POLICY "Users can manage their interactions" ON public.user_event_interactions
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (user_id = auth.uid());
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: user_preferences (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_preferences') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_preferences' AND policyname = 'Service role full access preferences') THEN
            CREATE POLICY "Service role full access preferences" ON public.user_preferences
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_preferences' AND policyname = 'Users can manage their preferences') THEN
            CREATE POLICY "Users can manage their preferences" ON public.user_preferences
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (user_id = auth.uid());
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: user_recommendations (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_recommendations') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_recommendations' AND policyname = 'Service role full access recommendations') THEN
            CREATE POLICY "Service role full access recommendations" ON public.user_recommendations
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (auth.role() = 'service_role'::text);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_recommendations' AND policyname = 'Users can view their recommendations') THEN
            CREATE POLICY "Users can view their recommendations" ON public.user_recommendations
                AS PERMISSIVE
                FOR SELECT
                TO public
                USING (user_id = auth.uid());
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: venue_layouts (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venue_layouts') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'venue_layouts' AND policyname = 'Venue owners can manage layouts') THEN
            CREATE POLICY "Venue owners can manage layouts" ON public.venue_layouts
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (venue_id IN ( SELECT venues.id
                   FROM venues
                  WHERE (venues.organizer_id = ( SELECT organizers.id
                           FROM organizers
                          WHERE (organizers.user_id = auth.uid())))));
        END IF;
    END IF;
END $$;

-- ============================================================================
-- TABLE: venues (NEW TABLE)
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'venues') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'venues' AND policyname = 'Organizers can manage their venues') THEN
            CREATE POLICY "Organizers can manage their venues" ON public.venues
                AS PERMISSIVE
                FOR ALL
                TO public
                USING (organizer_id = ( SELECT organizers.id
                   FROM organizers
                  WHERE (organizers.user_id = auth.uid())));
        END IF;
    END IF;
END $$;
