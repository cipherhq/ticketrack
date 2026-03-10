-- ============================================================
-- Fix RLS Infinite Recursion
-- ============================================================
-- Problem: Policies on organizers reference organizer_team_members,
-- and organizer_team_members policies reference organizers,
-- causing infinite recursion on every query.
--
-- Solution: Use SECURITY DEFINER functions that bypass RLS
-- to break the circular dependency chain.
-- ============================================================

-- ============================================================
-- STEP 1: Create helper functions (SECURITY DEFINER = bypass RLS)
-- ============================================================

-- Get organizer IDs owned by a user (direct ownership)
CREATE OR REPLACE FUNCTION get_user_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM organizers WHERE user_id = p_user_id;
$$;

-- Get organizer IDs where user is a team member
CREATE OR REPLACE FUNCTION get_team_member_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organizer_id FROM organizer_team_members
  WHERE user_id = p_user_id AND status = 'active';
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_user_id AND (role = 'admin' OR is_admin = true)
  );
$$;

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION get_user_organizer_ids(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_team_member_organizer_ids(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated, anon;

-- ============================================================
-- STEP 2: Drop ALL policies from the previous migration
-- that could cause recursion, then recreate safely
-- ============================================================

-- === EVENTS ===
DROP POLICY IF EXISTS "Public can browse published events" ON events;
DROP POLICY IF EXISTS "Organizers can view own events" ON events;
DROP POLICY IF EXISTS "Users can view events they have tickets for" ON events;

CREATE POLICY "Public can browse published events" ON events
  FOR SELECT USING (status = 'published');

CREATE POLICY "Organizers can view own events" ON events
  FOR SELECT USING (organizer_id IN (SELECT get_user_organizer_ids(auth.uid())));

CREATE POLICY "Users can view events they have tickets for" ON events
  FOR SELECT USING (
    id IN (SELECT event_id FROM tickets WHERE user_id = auth.uid())
  );

-- === TICKET_TYPES ===
DROP POLICY IF EXISTS "Public can view published event tickets" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can view own ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can insert own ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can update own ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can delete own ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Service role manages ticket types" ON ticket_types;

CREATE POLICY "Public can view published event tickets" ON ticket_types
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
    OR event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Organizers can insert own ticket types" ON ticket_types
  FOR INSERT WITH CHECK (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Organizers can update own ticket types" ON ticket_types
  FOR UPDATE USING (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Organizers can delete own ticket types" ON ticket_types
  FOR DELETE USING (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Service role manages ticket types" ON ticket_types
  FOR ALL USING (auth.role() = 'service_role');

-- === CATEGORIES ===
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Service role manages categories" ON categories;

CREATE POLICY "Public can view active categories" ON categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Service role manages categories" ON categories
  FOR ALL USING (auth.role() = 'service_role');

-- === ORGANIZERS ===
DROP POLICY IF EXISTS "Public can view active organizers" ON organizers;
DROP POLICY IF EXISTS "Users can view own organizer" ON organizers;
DROP POLICY IF EXISTS "Users can update own organizer" ON organizers;
DROP POLICY IF EXISTS "Users can insert own organizer" ON organizers;
DROP POLICY IF EXISTS "Admins can view all organizers" ON organizers;
DROP POLICY IF EXISTS "Admins can update all organizers" ON organizers;
DROP POLICY IF EXISTS "Service role manages organizers" ON organizers;
DROP POLICY IF EXISTS "Team members can view organizer" ON organizers;

CREATE POLICY "Public can view active organizers" ON organizers
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view own organizer" ON organizers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own organizer" ON organizers
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own organizer" ON organizers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all organizers" ON organizers
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all organizers" ON organizers
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Service role manages organizers" ON organizers
  FOR ALL USING (auth.role() = 'service_role');

-- Team members use SECURITY DEFINER function (no recursion)
CREATE POLICY "Team members can view organizer" ON organizers
  FOR SELECT USING (
    id IN (SELECT get_team_member_organizer_ids(auth.uid()))
  );

-- === FOLLOWERS ===
DROP POLICY IF EXISTS "Public can view followers" ON followers;
DROP POLICY IF EXISTS "Users can insert own follows" ON followers;
DROP POLICY IF EXISTS "Users can delete own follows" ON followers;
DROP POLICY IF EXISTS "Service role manages followers" ON followers;

CREATE POLICY "Public can view followers" ON followers
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own follows" ON followers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own follows" ON followers
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Service role manages followers" ON followers
  FOR ALL USING (auth.role() = 'service_role');

-- === EVENT_DAYS ===
DROP POLICY IF EXISTS "Public can view published event days" ON event_days;
DROP POLICY IF EXISTS "Organizers can manage own event days" ON event_days;
DROP POLICY IF EXISTS "Service role manages event days" ON event_days;

CREATE POLICY "Public can view published event days" ON event_days
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
    OR event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Organizers can manage own event days" ON event_days
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Service role manages event days" ON event_days
  FOR ALL USING (auth.role() = 'service_role');

-- === EVENT_DAY_ACTIVITIES ===
DROP POLICY IF EXISTS "Public can view published event activities" ON event_day_activities;
DROP POLICY IF EXISTS "Organizers can manage own event activities" ON event_day_activities;
DROP POLICY IF EXISTS "Service role manages event activities" ON event_day_activities;

CREATE POLICY "Public can view published event activities" ON event_day_activities
  FOR SELECT USING (
    event_day_id IN (
      SELECT id FROM event_days WHERE event_id IN (
        SELECT id FROM events WHERE status = 'published'
      )
    )
  );

CREATE POLICY "Organizers can manage own event activities" ON event_day_activities
  FOR ALL USING (
    event_day_id IN (
      SELECT id FROM event_days WHERE event_id IN (
        SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid()))
      )
    )
  );

CREATE POLICY "Service role manages event activities" ON event_day_activities
  FOR ALL USING (auth.role() = 'service_role');

-- === EVENT_SPONSORS ===
DROP POLICY IF EXISTS "Public can view published event sponsors" ON event_sponsors;
DROP POLICY IF EXISTS "Organizers can manage own event sponsors" ON event_sponsors;
DROP POLICY IF EXISTS "Service role manages event sponsors" ON event_sponsors;

CREATE POLICY "Public can view published event sponsors" ON event_sponsors
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
  );

CREATE POLICY "Organizers can manage own event sponsors" ON event_sponsors
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Service role manages event sponsors" ON event_sponsors
  FOR ALL USING (auth.role() = 'service_role');

-- === EVENT_SPEAKERS ===
DROP POLICY IF EXISTS "Public can view published event speakers" ON event_speakers;
DROP POLICY IF EXISTS "Organizers can manage own event speakers" ON event_speakers;
DROP POLICY IF EXISTS "Service role manages event speakers" ON event_speakers;

CREATE POLICY "Public can view published event speakers" ON event_speakers
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
  );

CREATE POLICY "Organizers can manage own event speakers" ON event_speakers
  FOR ALL USING (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Service role manages event speakers" ON event_speakers
  FOR ALL USING (auth.role() = 'service_role');

-- === ORDERS ===
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Organizers can view event orders" ON orders;
DROP POLICY IF EXISTS "Service role manages orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;

CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT USING (user_id::text = auth.uid()::text);

CREATE POLICY "Organizers can view event orders" ON orders
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Service role manages orders" ON orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can create orders" ON orders
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- === TICKETS ===
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Organizers can view event tickets" ON tickets;
DROP POLICY IF EXISTS "Service role manages tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;

CREATE POLICY "Users can view own tickets" ON tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Organizers can view event tickets" ON tickets
  FOR SELECT USING (
    event_id IN (SELECT id FROM events WHERE organizer_id IN (SELECT get_user_organizer_ids(auth.uid())))
  );

CREATE POLICY "Service role manages tickets" ON tickets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated users can create tickets" ON tickets
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- === SAVED_EVENTS ===
DROP POLICY IF EXISTS "Users can view own saved events" ON saved_events;
DROP POLICY IF EXISTS "Users can save events" ON saved_events;
DROP POLICY IF EXISTS "Users can unsave events" ON saved_events;
DROP POLICY IF EXISTS "Service role manages saved events" ON saved_events;

CREATE POLICY "Users can view own saved events" ON saved_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can save events" ON saved_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unsave events" ON saved_events
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Service role manages saved events" ON saved_events
  FOR ALL USING (auth.role() = 'service_role');

-- === PROMOTERS ===
DROP POLICY IF EXISTS "promoters_public_read" ON promoters;
DROP POLICY IF EXISTS "Public can view active promoters" ON promoters;
DROP POLICY IF EXISTS "Organizers can manage own promoters" ON promoters;
DROP POLICY IF EXISTS "Users can view own promoter records" ON promoters;
DROP POLICY IF EXISTS "Service role manages promoters" ON promoters;

CREATE POLICY "Public can view active promoters" ON promoters
  FOR SELECT USING (status = 'active');

CREATE POLICY "Organizers can manage own promoters" ON promoters
  FOR ALL USING (
    organizer_id IN (SELECT get_user_organizer_ids(auth.uid()))
  );

CREATE POLICY "Users can view own promoter records" ON promoters
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role manages promoters" ON promoters
  FOR ALL USING (auth.role() = 'service_role');

-- === PROFILES ===
DROP POLICY IF EXISTS "Public can view organizer basic profile" ON profiles;
CREATE POLICY "Public can view organizer basic profile" ON profiles
  FOR SELECT USING (
    id IN (SELECT user_id FROM organizers WHERE is_active = true)
  );

-- ============================================================
-- DONE - All cross-table references now use SECURITY DEFINER
-- functions, breaking the infinite recursion chain.
-- ============================================================
