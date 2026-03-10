-- ============================================================
-- Fix Public Data Access Policies
-- ============================================================
-- Problem: Previous security hardening removed/didn't add public
-- SELECT policies on key tables, breaking event browsing and
-- organizer profiles for anonymous/unauthenticated users.
--
-- This migration adds proper read policies while keeping
-- write operations secured.
-- ============================================================

-- ============================================================
-- 1. EVENTS TABLE
-- Allow anyone to view published events
-- ============================================================
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can browse published events" ON events;
CREATE POLICY "Public can browse published events" ON events
  FOR SELECT
  USING (status = 'published');

-- Organizers can view ALL their own events (any status)
DROP POLICY IF EXISTS "Organizers can view own events" ON events;
CREATE POLICY "Organizers can view own events" ON events
  FOR SELECT
  USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Authenticated users can view events they have tickets for
DROP POLICY IF EXISTS "Users can view events they have tickets for" ON events;
CREATE POLICY "Users can view events they have tickets for" ON events
  FOR SELECT
  USING (
    id IN (
      SELECT event_id FROM tickets WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 2. TICKET_TYPES TABLE
-- Allow anyone to view ticket types for published events
-- ============================================================
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published event tickets" ON ticket_types;
CREATE POLICY "Public can view published event tickets" ON ticket_types
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
  );

-- Organizers can view/manage their own event ticket types
DROP POLICY IF EXISTS "Organizers can view own ticket types" ON ticket_types;
CREATE POLICY "Organizers can view own ticket types" ON ticket_types
  FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Organizers can insert own ticket types" ON ticket_types;
CREATE POLICY "Organizers can insert own ticket types" ON ticket_types
  FOR INSERT
  WITH CHECK (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Organizers can update own ticket types" ON ticket_types;
CREATE POLICY "Organizers can update own ticket types" ON ticket_types
  FOR UPDATE
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Organizers can delete own ticket types" ON ticket_types;
CREATE POLICY "Organizers can delete own ticket types" ON ticket_types
  FOR DELETE
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role can manage all ticket types (for webhooks/edge functions)
DROP POLICY IF EXISTS "Service role manages ticket types" ON ticket_types;
CREATE POLICY "Service role manages ticket types" ON ticket_types
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 3. CATEGORIES TABLE
-- Allow anyone to view active categories
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active categories" ON categories;
CREATE POLICY "Public can view active categories" ON categories
  FOR SELECT
  USING (is_active = true);

-- Admins can manage all categories
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
CREATE POLICY "Admins can manage categories" ON categories
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

-- Service role can manage categories
DROP POLICY IF EXISTS "Service role manages categories" ON categories;
CREATE POLICY "Service role manages categories" ON categories
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 4. ORGANIZERS TABLE
-- Allow anyone to view active organizer profiles
-- ============================================================
ALTER TABLE organizers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active organizers" ON organizers;
CREATE POLICY "Public can view active organizers" ON organizers
  FOR SELECT
  USING (is_active = true);

-- Users can view their own organizer record (even if inactive)
DROP POLICY IF EXISTS "Users can view own organizer" ON organizers;
CREATE POLICY "Users can view own organizer" ON organizers
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can update their own organizer record
DROP POLICY IF EXISTS "Users can update own organizer" ON organizers;
CREATE POLICY "Users can update own organizer" ON organizers
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can create their own organizer record
DROP POLICY IF EXISTS "Users can insert own organizer" ON organizers;
CREATE POLICY "Users can insert own organizer" ON organizers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can view all organizers
DROP POLICY IF EXISTS "Admins can view all organizers" ON organizers;
CREATE POLICY "Admins can view all organizers" ON organizers
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

-- Admins can update all organizers
DROP POLICY IF EXISTS "Admins can update all organizers" ON organizers;
CREATE POLICY "Admins can update all organizers" ON organizers
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role manages organizers" ON organizers;
CREATE POLICY "Service role manages organizers" ON organizers
  FOR ALL
  USING (auth.role() = 'service_role');

-- Team members can view their organizer
DROP POLICY IF EXISTS "Team members can view organizer" ON organizers;
CREATE POLICY "Team members can view organizer" ON organizers
  FOR SELECT
  USING (
    id IN (
      SELECT organizer_id FROM organizer_team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ============================================================
-- 5. FOLLOWERS TABLE
-- Allow public read (for follower counts on profiles)
-- ============================================================
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view followers" ON followers;
CREATE POLICY "Public can view followers" ON followers
  FOR SELECT
  USING (true);

-- Authenticated users can follow/unfollow
DROP POLICY IF EXISTS "Users can insert own follows" ON followers;
CREATE POLICY "Users can insert own follows" ON followers
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own follows" ON followers;
CREATE POLICY "Users can delete own follows" ON followers
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "Service role manages followers" ON followers;
CREATE POLICY "Service role manages followers" ON followers
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 6. EVENT_DAYS TABLE
-- Allow public read for published events
-- ============================================================
ALTER TABLE event_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published event days" ON event_days;
CREATE POLICY "Public can view published event days" ON event_days
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
  );

-- Organizers can manage their event days
DROP POLICY IF EXISTS "Organizers can manage own event days" ON event_days;
CREATE POLICY "Organizers can manage own event days" ON event_days
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role manages event days" ON event_days;
CREATE POLICY "Service role manages event days" ON event_days
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 7. EVENT_DAY_ACTIVITIES TABLE
-- Allow public read for published events
-- ============================================================
ALTER TABLE event_day_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published event activities" ON event_day_activities;
CREATE POLICY "Public can view published event activities" ON event_day_activities
  FOR SELECT
  USING (
    event_day_id IN (
      SELECT id FROM event_days WHERE event_id IN (
        SELECT id FROM events WHERE status = 'published'
      )
    )
  );

-- Organizers can manage their event activities
DROP POLICY IF EXISTS "Organizers can manage own event activities" ON event_day_activities;
CREATE POLICY "Organizers can manage own event activities" ON event_day_activities
  FOR ALL
  USING (
    event_day_id IN (
      SELECT id FROM event_days WHERE event_id IN (
        SELECT id FROM events WHERE organizer_id IN (
          SELECT id FROM organizers WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role manages event activities" ON event_day_activities;
CREATE POLICY "Service role manages event activities" ON event_day_activities
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 8. EVENT_SPONSORS TABLE
-- Allow public read for published events
-- ============================================================
ALTER TABLE event_sponsors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published event sponsors" ON event_sponsors;
CREATE POLICY "Public can view published event sponsors" ON event_sponsors
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
  );

-- Organizers can manage their event sponsors
DROP POLICY IF EXISTS "Organizers can manage own event sponsors" ON event_sponsors;
CREATE POLICY "Organizers can manage own event sponsors" ON event_sponsors
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role manages event sponsors" ON event_sponsors;
CREATE POLICY "Service role manages event sponsors" ON event_sponsors
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 9. EVENT_SPEAKERS TABLE
-- Allow public read for published events
-- ============================================================
ALTER TABLE event_speakers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published event speakers" ON event_speakers;
CREATE POLICY "Public can view published event speakers" ON event_speakers
  FOR SELECT
  USING (
    event_id IN (SELECT id FROM events WHERE status = 'published')
  );

-- Organizers can manage their event speakers
DROP POLICY IF EXISTS "Organizers can manage own event speakers" ON event_speakers;
CREATE POLICY "Organizers can manage own event speakers" ON event_speakers
  FOR ALL
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role manages event speakers" ON event_speakers;
CREATE POLICY "Service role manages event speakers" ON event_speakers
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 10. ORDERS TABLE
-- Users can view own orders, service role full access
-- ============================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders
  FOR SELECT
  USING (user_id::text = auth.uid()::text);

-- Organizers can view orders for their events
DROP POLICY IF EXISTS "Organizers can view event orders" ON orders;
CREATE POLICY "Organizers can view event orders" ON orders
  FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role full access (for webhooks, edge functions)
DROP POLICY IF EXISTS "Service role manages orders" ON orders;
CREATE POLICY "Service role manages orders" ON orders
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can create orders (checkout)
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;
CREATE POLICY "Authenticated users can create orders" ON orders
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 11. TICKETS TABLE
-- Users can view own tickets
-- ============================================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
CREATE POLICY "Users can view own tickets" ON tickets
  FOR SELECT
  USING (user_id = auth.uid());

-- Organizers can view tickets for their events
DROP POLICY IF EXISTS "Organizers can view event tickets" ON tickets;
CREATE POLICY "Organizers can view event tickets" ON tickets
  FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM events WHERE organizer_id IN (
        SELECT id FROM organizers WHERE user_id = auth.uid()
      )
    )
  );

-- Service role full access (for webhooks creating tickets)
DROP POLICY IF EXISTS "Service role manages tickets" ON tickets;
CREATE POLICY "Service role manages tickets" ON tickets
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can create tickets (purchase flow)
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
CREATE POLICY "Authenticated users can create tickets" ON tickets
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- 12. SAVED_EVENTS TABLE
-- Users can manage own saved events
-- ============================================================
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved events" ON saved_events;
CREATE POLICY "Users can view own saved events" ON saved_events
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can save events" ON saved_events;
CREATE POLICY "Users can save events" ON saved_events
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can unsave events" ON saved_events;
CREATE POLICY "Users can unsave events" ON saved_events
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "Service role manages saved events" ON saved_events;
CREATE POLICY "Service role manages saved events" ON saved_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 13. PROMOTERS TABLE
-- Public can view active promoters (for referral lookups)
-- ============================================================
ALTER TABLE promoters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promoters_public_read" ON promoters;
DROP POLICY IF EXISTS "Public can view active promoters" ON promoters;
CREATE POLICY "Public can view active promoters" ON promoters
  FOR SELECT
  USING (status = 'active');

-- Organizers can manage their promoters
DROP POLICY IF EXISTS "Organizers can manage own promoters" ON promoters;
CREATE POLICY "Organizers can manage own promoters" ON promoters
  FOR ALL
  USING (
    organizer_id IN (
      SELECT id FROM organizers WHERE user_id = auth.uid()
    )
  );

-- Users can view their own promoter records
DROP POLICY IF EXISTS "Users can view own promoter records" ON promoters;
CREATE POLICY "Users can view own promoter records" ON promoters
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role full access
DROP POLICY IF EXISTS "Service role manages promoters" ON promoters;
CREATE POLICY "Service role manages promoters" ON promoters
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- 14. PROFILES TABLE
-- Add public read for basic profile info needed by organizer pages
-- (The user's own profile is already covered by existing policies)
-- ============================================================

-- Organizer's profile info visible on their public profile page
-- This is accessed when showing organizer avatar/name on event pages
DROP POLICY IF EXISTS "Public can view organizer basic profile" ON profiles;
CREATE POLICY "Public can view organizer basic profile" ON profiles
  FOR SELECT
  USING (
    id IN (SELECT user_id FROM organizers WHERE is_active = true)
  );

-- ============================================================
-- DONE
-- ============================================================
