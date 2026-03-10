-- ============================================================
-- COMPREHENSIVE FIX: Drop ALL recursive RLS policies
-- ============================================================
-- Drops every policy that has direct cross-table subqueries
-- and replaces with versions using SECURITY DEFINER functions
-- to eliminate infinite recursion.
-- ============================================================

-- ============================================================
-- STEP 0: Ensure helper functions exist
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT id FROM organizers WHERE user_id = p_user_id; $$;

CREATE OR REPLACE FUNCTION get_team_member_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT organizer_id FROM organizer_team_members WHERE user_id = p_user_id AND status = 'active'; $$;

CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND (role = 'admin' OR is_admin = true)); $$;

-- Combined: get all organizer IDs a user can access (owner + team member)
CREATE OR REPLACE FUNCTION get_all_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM organizers WHERE user_id = p_user_id
  UNION
  SELECT organizer_id FROM organizer_team_members WHERE user_id = p_user_id AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION get_user_organizer_ids(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_team_member_organizer_ids(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_all_organizer_ids(uuid) TO authenticated, anon;

-- ============================================================
-- PROFILES TABLE - Fix self-referential and cross-table policies
-- ============================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Organizers can view attendee profiles" ON profiles;
DROP POLICY IF EXISTS "Organizers can view team member profiles" ON profiles;
DROP POLICY IF EXISTS "Organizers can view promoter profiles" ON profiles;
DROP POLICY IF EXISTS "Finance users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public can view organizer basic profile" ON profiles;

-- Admins (use SECURITY DEFINER function, no self-reference)
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (is_admin(auth.uid()));

-- Organizers see attendee profiles (use SECURITY DEFINER for organizer lookup)
CREATE POLICY "Organizers can view attendee profiles" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT t.user_id FROM tickets t
      WHERE t.event_id IN (
        SELECT id FROM events WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid()))
      )
    )
  );

-- Organizers see team member profiles
CREATE POLICY "Organizers can view team member profiles" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT otm.user_id FROM organizer_team_members otm
      WHERE otm.organizer_id IN (SELECT get_user_organizer_ids(auth.uid()))
    )
  );

-- Organizers see promoter profiles
CREATE POLICY "Organizers can view promoter profiles" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT pr.user_id FROM promoters pr
      WHERE pr.organizer_id IN (SELECT get_all_organizer_ids(auth.uid()))
        AND pr.user_id IS NOT NULL
    )
  );

-- Finance users
CREATE POLICY "Finance users can view profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM finance_users fu WHERE fu.user_id = auth.uid() AND fu.is_active = true)
  );

-- Service role
CREATE POLICY "Service role can view all profiles" ON profiles
  FOR SELECT USING (auth.role() = 'service_role');

-- Public can see active organizer profiles (for public profile pages)
CREATE POLICY "Public can view organizer basic profile" ON profiles
  FOR SELECT USING (
    id IN (SELECT user_id FROM organizers WHERE is_active = true)
  );

-- ============================================================
-- EVENTS TABLE - Drop old recursive policies, keep safe ones
-- ============================================================
DROP POLICY IF EXISTS "Managers view all events" ON events;
DROP POLICY IF EXISTS "Staff view task events" ON events;
DROP POLICY IF EXISTS "events_admin_update_payout" ON events;

-- Managers/team members view events (safe version)
CREATE POLICY "Team members view events" ON events
  FOR SELECT USING (
    organizer_id IN (SELECT get_all_organizer_ids(auth.uid()))
  );

-- Admin payout updates
CREATE POLICY "Admin can update event payout" ON events
  FOR UPDATE USING (is_admin(auth.uid()));

-- ============================================================
-- COUNTRY_FEATURES TABLE - Add public read
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'country_features') THEN
    ALTER TABLE country_features ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public can view country features" ON country_features;
    CREATE POLICY "Public can view country features" ON country_features
      FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Service role manages country features" ON country_features;
    CREATE POLICY "Service role manages country features" ON country_features
      FOR ALL USING (auth.role() = 'service_role');
    DROP POLICY IF EXISTS "Admin manages country features" ON country_features;
    CREATE POLICY "Admin manages country features" ON country_features
      FOR ALL USING (is_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================
-- Fix ALL other tables from add-missing-rls-policies.sql
-- that use direct organizer_team_members references
-- ============================================================

-- auto_responses
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'auto_responses' AND policyname = 'Organizers can manage their auto responses') THEN
    DROP POLICY "Organizers can manage their auto responses" ON auto_responses;
    CREATE POLICY "Organizers can manage their auto responses" ON auto_responses
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- communication_automation_runs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_automation_runs' AND policyname = 'automation_runs_organizer_access') THEN
    DROP POLICY "automation_runs_organizer_access" ON communication_automation_runs;
    CREATE POLICY "automation_runs_organizer_access" ON communication_automation_runs
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- communication_automations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_automations' AND policyname = 'automations_organizer_access') THEN
    DROP POLICY "automations_organizer_access" ON communication_automations;
    CREATE POLICY "automations_organizer_access" ON communication_automations
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- communication_campaigns
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_campaigns' AND policyname = 'campaigns_organizer_access') THEN
    DROP POLICY "campaigns_organizer_access" ON communication_campaigns;
    CREATE POLICY "campaigns_organizer_access" ON communication_campaigns
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- communication_credit_transactions
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_credit_transactions' AND policyname = 'credit_tx_organizer_access') THEN
    DROP POLICY "credit_tx_organizer_access" ON communication_credit_transactions;
    CREATE POLICY "credit_tx_organizer_access" ON communication_credit_transactions
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- communication_credits
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_credits' AND policyname = 'credits_organizer_access') THEN
    DROP POLICY "credits_organizer_access" ON communication_credits;
    CREATE POLICY "credits_organizer_access" ON communication_credits
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- communication_logs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_logs' AND policyname = 'logs_organizer_access') THEN
    DROP POLICY "logs_organizer_access" ON communication_logs;
    CREATE POLICY "logs_organizer_access" ON communication_logs
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- communication_templates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_templates' AND policyname = 'templates_organizer_access') THEN
    DROP POLICY "templates_organizer_access" ON communication_templates;
    CREATE POLICY "templates_organizer_access" ON communication_templates
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- contacts
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'contacts_organizer_access') THEN
    DROP POLICY "contacts_organizer_access" ON contacts;
    CREATE POLICY "contacts_organizer_access" ON contacts
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- contact_lists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_lists' AND policyname = 'contact_lists_organizer_access') THEN
    DROP POLICY "contact_lists_organizer_access" ON contact_lists;
    CREATE POLICY "contact_lists_organizer_access" ON contact_lists
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- contact_list_members
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'contact_list_members' AND policyname = 'contact_list_members_organizer_access') THEN
    DROP POLICY "contact_list_members_organizer_access" ON contact_list_members;
    CREATE POLICY "contact_list_members_organizer_access" ON contact_list_members
      FOR ALL USING (
        contact_list_id IN (
          SELECT id FROM contact_lists WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid()))
        )
      );
  END IF;
END $$;

-- drip_campaign_steps
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drip_campaign_steps' AND policyname = 'drip_steps_organizer_access') THEN
    DROP POLICY "drip_steps_organizer_access" ON drip_campaign_steps;
    CREATE POLICY "drip_steps_organizer_access" ON drip_campaign_steps
      FOR ALL USING (
        campaign_id IN (
          SELECT id FROM communication_campaigns WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid()))
        )
      );
  END IF;
END $$;

-- drip_campaign_enrollments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'drip_campaign_enrollments' AND policyname = 'drip_enrollments_organizer_access') THEN
    DROP POLICY "drip_enrollments_organizer_access" ON drip_campaign_enrollments;
    CREATE POLICY "drip_enrollments_organizer_access" ON drip_campaign_enrollments
      FOR ALL USING (
        campaign_id IN (
          SELECT id FROM communication_campaigns WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid()))
        )
      );
  END IF;
END $$;

-- event_custom_forms
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_custom_forms' AND policyname = 'custom_forms_organizer_access') THEN
    DROP POLICY "custom_forms_organizer_access" ON event_custom_forms;
    CREATE POLICY "custom_forms_organizer_access" ON event_custom_forms
      FOR ALL USING (
        event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid())))
      );
  END IF;
END $$;

-- event_custom_form_responses
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'event_custom_form_responses' AND policyname = 'custom_form_responses_organizer_access') THEN
    DROP POLICY "custom_form_responses_organizer_access" ON event_custom_form_responses;
    CREATE POLICY "custom_form_responses_organizer_access" ON event_custom_form_responses
      FOR ALL USING (
        form_id IN (
          SELECT id FROM event_custom_forms WHERE event_id IN (
            SELECT id FROM events WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid()))
          )
        )
      );
  END IF;
END $$;

-- payout_requests
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payout_requests' AND policyname = 'payout_requests_organizer_access') THEN
    DROP POLICY "payout_requests_organizer_access" ON payout_requests;
    CREATE POLICY "payout_requests_organizer_access" ON payout_requests
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- payment_gateway_config (organizer-specific)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_gateway_config' AND policyname = 'payment_config_organizer_access') THEN
    DROP POLICY "payment_config_organizer_access" ON payment_gateway_config;
    CREATE POLICY "payment_config_organizer_access" ON payment_gateway_config
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- refund_requests
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refund_requests' AND policyname = 'Organizers can view refund requests for their events') THEN
    DROP POLICY "Organizers can view refund requests for their events" ON refund_requests;
    CREATE POLICY "Organizers can view refund requests for their events" ON refund_requests
      FOR SELECT USING (
        event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid())))
      );
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refund_requests' AND policyname = 'Organizers can update refund requests for their events') THEN
    DROP POLICY "Organizers can update refund requests for their events" ON refund_requests;
    CREATE POLICY "Organizers can update refund requests for their events" ON refund_requests
      FOR UPDATE USING (
        event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_all_organizer_ids(auth.uid())))
      );
  END IF;
END $$;

-- external_platform_connections
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'external_platform_connections' AND policyname = 'ext_connections_organizer_access') THEN
    DROP POLICY "ext_connections_organizer_access" ON external_platform_connections;
    CREATE POLICY "ext_connections_organizer_access" ON external_platform_connections
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- imported_events
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'imported_events' AND policyname = 'imported_events_organizer_access') THEN
    DROP POLICY "imported_events_organizer_access" ON imported_events;
    CREATE POLICY "imported_events_organizer_access" ON imported_events
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- import_jobs
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'import_jobs' AND policyname = 'import_jobs_organizer_access') THEN
    DROP POLICY "import_jobs_organizer_access" ON import_jobs;
    CREATE POLICY "import_jobs_organizer_access" ON import_jobs
      FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
  END IF;
END $$;

-- organizer_team_members itself - ensure no recursion
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizer_team_members') THEN
    -- Drop any existing policies that might reference organizers
    DROP POLICY IF EXISTS "Team members can view own records" ON organizer_team_members;
    DROP POLICY IF EXISTS "Organizers can manage team members" ON organizer_team_members;
    DROP POLICY IF EXISTS "team_members_self_access" ON organizer_team_members;
    DROP POLICY IF EXISTS "team_members_organizer_access" ON organizer_team_members;

    ALTER TABLE organizer_team_members ENABLE ROW LEVEL SECURITY;

    -- Users can see their own team membership
    CREATE POLICY "Team members can view own records" ON organizer_team_members
      FOR SELECT USING (user_id = auth.uid());

    -- Organizers can manage their team (use SECURITY DEFINER to avoid recursion)
    CREATE POLICY "Organizers can manage team members" ON organizer_team_members
      FOR ALL USING (organizer_id IN (SELECT get_user_organizer_ids(auth.uid())));

    -- Admin access
    DROP POLICY IF EXISTS "Admin manages team members" ON organizer_team_members;
    CREATE POLICY "Admin manages team members" ON organizer_team_members
      FOR ALL USING (is_admin(auth.uid()));

    -- Service role
    DROP POLICY IF EXISTS "Service role manages team members" ON organizer_team_members;
    CREATE POLICY "Service role manages team members" ON organizer_team_members
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- Drop the duplicate "Organizers can view own events" since
-- "Team members view events" now covers both owner + team
-- ============================================================
DROP POLICY IF EXISTS "Organizers can view own events" ON events;

-- ============================================================
-- DONE
-- ============================================================
