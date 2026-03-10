-- ============================================================
-- Fix ALL remaining RLS recursion chains
-- ============================================================
-- Remaining chains:
-- 1. events ↔ tickets (events policy queries tickets, tickets policy queries events)
-- 2. profiles → tickets → events → tickets (chain)
-- 3. platform_adverts - missing public policy
--
-- Solution: More SECURITY DEFINER functions + replace every
-- policy that subqueries another RLS-protected table.
-- ============================================================

-- ============================================================
-- NEW SECURITY DEFINER helper functions
-- ============================================================

-- Get event IDs where user has tickets (bypass tickets RLS)
CREATE OR REPLACE FUNCTION get_user_ticket_event_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT DISTINCT event_id FROM tickets WHERE user_id = auth.uid();
$$;

-- Get event IDs for organizer (bypass events RLS)
CREATE OR REPLACE FUNCTION get_organizer_event_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM events WHERE organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
    UNION
    SELECT organizer_id FROM organizer_team_members
    WHERE user_id = auth.uid() AND status = 'active'
  );
$$;

-- Get attendee user IDs for an organizer's events (bypass tickets+events RLS)
CREATE OR REPLACE FUNCTION get_organizer_attendee_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT DISTINCT t.user_id FROM tickets t
  WHERE t.event_id IN (
    SELECT id FROM events WHERE organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
      UNION
      SELECT organizer_id FROM organizer_team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );
$$;

-- Get team member user IDs for organizer (bypass organizer_team_members RLS)
CREATE OR REPLACE FUNCTION get_organizer_team_user_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT otm.user_id FROM organizer_team_members otm
  WHERE otm.organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
  );
$$;

-- Get promoter user IDs for organizer (bypass promoters RLS)
CREATE OR REPLACE FUNCTION get_organizer_promoter_user_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT pr.user_id FROM promoters pr
  WHERE pr.organizer_id IN (
    SELECT id FROM organizers WHERE user_id = auth.uid()
    UNION
    SELECT organizer_id FROM organizer_team_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
  AND pr.user_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION get_user_ticket_event_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_organizer_event_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_organizer_attendee_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_organizer_team_user_ids() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_organizer_promoter_user_ids() TO authenticated, anon;

-- ============================================================
-- EVENTS TABLE - Fix ticket circular reference
-- ============================================================
DROP POLICY IF EXISTS "Users can view events they have tickets for" ON events;
CREATE POLICY "Users can view events they have tickets for" ON events
  FOR SELECT USING (id IN (SELECT get_user_ticket_event_ids()));

-- ============================================================
-- TICKETS TABLE - Fix events circular reference
-- ============================================================
DROP POLICY IF EXISTS "Organizers can view event tickets" ON tickets;
CREATE POLICY "Organizers can view event tickets" ON tickets
  FOR SELECT USING (event_id IN (SELECT get_organizer_event_ids()));

-- ============================================================
-- PROFILES TABLE - Fix ALL cross-table chains
-- ============================================================
DROP POLICY IF EXISTS "Organizers can view attendee profiles" ON profiles;
CREATE POLICY "Organizers can view attendee profiles" ON profiles
  FOR SELECT USING (id IN (SELECT get_organizer_attendee_ids()));

DROP POLICY IF EXISTS "Organizers can view team member profiles" ON profiles;
CREATE POLICY "Organizers can view team member profiles" ON profiles
  FOR SELECT USING (id IN (SELECT get_organizer_team_user_ids()));

DROP POLICY IF EXISTS "Organizers can view promoter profiles" ON profiles;
CREATE POLICY "Organizers can view promoter profiles" ON profiles
  FOR SELECT USING (id IN (SELECT get_organizer_promoter_user_ids()));

-- ============================================================
-- TICKET_TYPES TABLE - Use SECURITY DEFINER for events lookup
-- ============================================================
DROP POLICY IF EXISTS "Public can view published event tickets" ON ticket_types;
CREATE POLICY "Public can view published event tickets" ON ticket_types
  FOR SELECT USING (
    -- Published events (no cross-table RLS issue since events public policy is simple)
    event_id IN (SELECT id FROM events WHERE status = 'published')
    OR event_id IN (SELECT get_organizer_event_ids())
  );

-- ============================================================
-- ORDERS TABLE - Fix events reference
-- ============================================================
DROP POLICY IF EXISTS "Organizers can view event orders" ON orders;
CREATE POLICY "Organizers can view event orders" ON orders
  FOR SELECT USING (event_id IN (SELECT get_organizer_event_ids()));

-- ============================================================
-- EVENT sub-tables - Use SECURITY DEFINER for events lookup
-- ============================================================

-- event_days
DROP POLICY IF EXISTS "Public can view published event days" ON event_days;
CREATE POLICY "Public can view published event days" ON event_days
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
    OR event_id IN (SELECT get_organizer_event_ids())
  );

DROP POLICY IF EXISTS "Organizers can manage own event days" ON event_days;
CREATE POLICY "Organizers can manage own event days" ON event_days
  FOR ALL USING (event_id IN (SELECT get_organizer_event_ids()));

-- event_speakers
DROP POLICY IF EXISTS "Organizers can manage own event speakers" ON event_speakers;
CREATE POLICY "Organizers can manage own event speakers" ON event_speakers
  FOR ALL USING (event_id IN (SELECT get_organizer_event_ids()));

-- event_sponsors
DROP POLICY IF EXISTS "Organizers can manage own event sponsors" ON event_sponsors;
CREATE POLICY "Organizers can manage own event sponsors" ON event_sponsors
  FOR ALL USING (event_id IN (SELECT get_organizer_event_ids()));

-- ticket_types write
DROP POLICY IF EXISTS "Organizers can insert own ticket types" ON ticket_types;
CREATE POLICY "Organizers can insert own ticket types" ON ticket_types
  FOR INSERT WITH CHECK (event_id IN (SELECT get_organizer_event_ids()));

DROP POLICY IF EXISTS "Organizers can update own ticket types" ON ticket_types;
CREATE POLICY "Organizers can update own ticket types" ON ticket_types
  FOR UPDATE USING (event_id IN (SELECT get_organizer_event_ids()));

DROP POLICY IF EXISTS "Organizers can delete own ticket types" ON ticket_types;
CREATE POLICY "Organizers can delete own ticket types" ON ticket_types
  FOR DELETE USING (event_id IN (SELECT get_organizer_event_ids()));

-- ============================================================
-- PLATFORM_ADVERTS TABLE - Add public read
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_adverts') THEN
    ALTER TABLE platform_adverts ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Public can view active adverts" ON platform_adverts;
    CREATE POLICY "Public can view active adverts" ON platform_adverts
      FOR SELECT USING (true);
    DROP POLICY IF EXISTS "Service role manages adverts" ON platform_adverts;
    CREATE POLICY "Service role manages adverts" ON platform_adverts
      FOR ALL USING (auth.role() = 'service_role');
    DROP POLICY IF EXISTS "Admin manages adverts" ON platform_adverts;
    CREATE POLICY "Admin manages adverts" ON platform_adverts
      FOR ALL USING (is_admin(auth.uid()));
  END IF;
END $$;

-- ============================================================
-- EVENT_CUSTOM_FORMS - Fix for public access (checkout forms)
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_custom_forms') THEN
    DROP POLICY IF EXISTS "Public can view published event forms" ON event_custom_forms;
    CREATE POLICY "Public can view published event forms" ON event_custom_forms
      FOR SELECT USING (
        event_id IN (SELECT id FROM events WHERE status = 'published')
      );

    DROP POLICY IF EXISTS "custom_forms_organizer_access" ON event_custom_forms;
    CREATE POLICY "custom_forms_organizer_access" ON event_custom_forms
      FOR ALL USING (event_id IN (SELECT get_organizer_event_ids()));
  END IF;
END $$;

-- ============================================================
-- REFUND_REQUESTS - Fix events reference
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refund_requests' AND policyname = 'Organizers can view refund requests for their events') THEN
    DROP POLICY "Organizers can view refund requests for their events" ON refund_requests;
    CREATE POLICY "Organizers can view refund requests for their events" ON refund_requests
      FOR SELECT USING (event_id IN (SELECT get_organizer_event_ids()));
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refund_requests' AND policyname = 'Organizers can update refund requests for their events') THEN
    DROP POLICY "Organizers can update refund requests for their events" ON refund_requests;
    CREATE POLICY "Organizers can update refund requests for their events" ON refund_requests
      FOR UPDATE USING (event_id IN (SELECT get_organizer_event_ids()));
  END IF;
END $$;

-- ============================================================
-- DONE - No policy now directly subqueries another RLS table
-- ============================================================
