-- ============================================================
-- NUCLEAR RLS RESET: Drop ALL policies, recreate only safe ones
-- ============================================================
-- Previous incremental fixes left old policies in place.
-- This drops EVERYTHING and starts clean on problem tables.
-- ============================================================

-- ============================================================
-- Helper: Drop ALL policies on a table
-- ============================================================
CREATE OR REPLACE FUNCTION drop_all_policies(p_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
    RAISE NOTICE 'Dropped policy % on %', pol.policyname, p_table;
  END LOOP;
END;
$$;

-- ============================================================
-- Ensure SECURITY DEFINER functions exist
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT id FROM organizers WHERE user_id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION get_all_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM organizers WHERE user_id = auth.uid()
  UNION
  SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION get_team_member_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'; $$;

CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)); $$;

CREATE OR REPLACE FUNCTION get_user_ticket_event_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT DISTINCT event_id FROM tickets WHERE user_id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION get_organizer_event_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM events WHERE organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
    UNION
    SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION get_organizer_attendee_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT DISTINCT t.user_id FROM tickets t
  WHERE t.event_id IN (
    SELECT id FROM events WHERE organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
      UNION SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
    )
  );
$$;

CREATE OR REPLACE FUNCTION get_organizer_team_user_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT otm.user_id FROM organizer_team_members otm
  WHERE otm.organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION get_organizer_promoter_user_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT pr.user_id FROM promoters pr
  WHERE pr.organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
    UNION SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
  ) AND pr.user_id IS NOT NULL;
$$;

-- ============================================================
-- EVENTS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('events');
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_published" ON events FOR SELECT USING (status = 'published');
CREATE POLICY "organizer_access" ON events FOR SELECT USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
CREATE POLICY "ticket_holder_access" ON events FOR SELECT USING (id IN (SELECT get_user_ticket_event_ids()));
CREATE POLICY "admin_access" ON events FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "service_role" ON events FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- PROFILES: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('profiles');
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "own_profile_update" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "own_profile_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "admin_read" ON profiles FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "organizer_attendees" ON profiles FOR SELECT USING (id IN (SELECT get_organizer_attendee_ids()));
CREATE POLICY "organizer_team" ON profiles FOR SELECT USING (id IN (SELECT get_organizer_team_user_ids()));
CREATE POLICY "organizer_promoters" ON profiles FOR SELECT USING (id IN (SELECT get_organizer_promoter_user_ids()));
CREATE POLICY "service_role" ON profiles FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- TICKETS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('tickets');
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_tickets" ON tickets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "organizer_tickets" ON tickets FOR SELECT USING (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "insert_tickets" ON tickets FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "service_role" ON tickets FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- TICKET_TYPES: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('ticket_types');
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON ticket_types FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE status = 'published') OR event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "organizer_insert" ON ticket_types FOR INSERT WITH CHECK (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "organizer_update" ON ticket_types FOR UPDATE USING (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "organizer_delete" ON ticket_types FOR DELETE USING (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "service_role" ON ticket_types FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ORDERS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('orders');
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_orders" ON orders FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "organizer_orders" ON orders FOR SELECT USING (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "insert_orders" ON orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "service_role" ON orders FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ORGANIZERS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('organizers');
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_active" ON organizers FOR SELECT USING (is_active = true);
CREATE POLICY "own_organizer" ON organizers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_update" ON organizers FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_insert" ON organizers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "team_view" ON organizers FOR SELECT USING (id IN (SELECT get_team_member_organizer_ids(auth.uid())));
CREATE POLICY "admin_read" ON organizers FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "admin_update" ON organizers FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "service_role" ON organizers FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- PROMOTERS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('promoters');
ALTER TABLE promoters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_active" ON promoters FOR SELECT USING (status = 'active');
CREATE POLICY "own_records" ON promoters FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "organizer_manage" ON promoters FOR ALL USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));
CREATE POLICY "service_role" ON promoters FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- CATEGORIES: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('categories');
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_active" ON categories FOR SELECT USING (is_active = true);
CREATE POLICY "admin_manage" ON categories FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "service_role" ON categories FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- FOLLOWERS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('followers');
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON followers FOR SELECT USING (true);
CREATE POLICY "own_insert" ON followers FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_delete" ON followers FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "service_role" ON followers FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- SAVED_EVENTS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('saved_events');
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_read" ON saved_events FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_insert" ON saved_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_delete" ON saved_events FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "service_role" ON saved_events FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- EVENT_DAYS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('event_days');
ALTER TABLE event_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_published" ON event_days FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE status = 'published') OR event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "organizer_manage" ON event_days FOR ALL USING (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "service_role" ON event_days FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- EVENT_DAY_ACTIVITIES: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('event_day_activities');
ALTER TABLE event_day_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_published" ON event_day_activities FOR SELECT USING (
  event_day_id IN (SELECT id FROM event_days WHERE event_id IN (SELECT id FROM events WHERE status = 'published'))
);
CREATE POLICY "organizer_manage" ON event_day_activities FOR ALL USING (
  event_day_id IN (SELECT id FROM event_days WHERE event_id IN (SELECT get_organizer_event_ids()))
);
CREATE POLICY "service_role" ON event_day_activities FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- EVENT_SPEAKERS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('event_speakers');
ALTER TABLE event_speakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_published" ON event_speakers FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE status = 'published'));
CREATE POLICY "organizer_manage" ON event_speakers FOR ALL USING (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "service_role" ON event_speakers FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- EVENT_SPONSORS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('event_sponsors');
ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_published" ON event_sponsors FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE status = 'published'));
CREATE POLICY "organizer_manage" ON event_sponsors FOR ALL USING (event_id IN (SELECT get_organizer_event_ids()));
CREATE POLICY "service_role" ON event_sponsors FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- ORGANIZER_TEAM_MEMBERS: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('organizer_team_members');
ALTER TABLE organizer_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_records" ON organizer_team_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "organizer_manage" ON organizer_team_members FOR ALL USING (organizer_id IN (SELECT get_user_organizer_ids(auth.uid())));
CREATE POLICY "admin_manage" ON organizer_team_members FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "service_role" ON organizer_team_members FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- COUNTRIES: Add public read
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'countries') THEN
    PERFORM drop_all_policies('countries');
    ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "public_read" ON countries FOR SELECT USING (true);
    CREATE POLICY "service_role" ON countries FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- COUNTRY_FEATURES: Drop all, recreate safe
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'country_features') THEN
    PERFORM drop_all_policies('country_features');
    ALTER TABLE country_features ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "public_read" ON country_features FOR SELECT USING (true);
    CREATE POLICY "service_role" ON country_features FOR ALL USING (auth.role() = 'service_role');
    CREATE POLICY "admin_manage" ON country_features FOR ALL USING (is_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================
-- PLATFORM_ADVERTS: Drop all, recreate safe
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_adverts') THEN
    PERFORM drop_all_policies('platform_adverts');
    ALTER TABLE platform_adverts ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "public_read" ON platform_adverts FOR SELECT USING (true);
    CREATE POLICY "service_role" ON platform_adverts FOR ALL USING (auth.role() = 'service_role');
    CREATE POLICY "admin_manage" ON platform_adverts FOR ALL USING (is_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================
-- Clean up helper function
-- ============================================================
DROP FUNCTION IF EXISTS drop_all_policies(text);

-- ============================================================
-- DONE - Complete RLS reset with only safe policies
-- ============================================================
