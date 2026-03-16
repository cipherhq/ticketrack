-- ============================================================
-- HOTFIX: Remove duplicate RLS policies from 20260311 migration
-- ============================================================
-- The 20260311_fix_rls_recursion.sql migration ran AFTER the
-- 20260316 nuclear RLS reset, creating duplicate policies with
-- long names alongside the short-named policies from the reset.
--
-- Critical issue: Some duplicate policies create circular RLS
-- dependencies (events→tickets→events) causing infinite recursion
-- and breaking anon user access to public data.
--
-- Fix: Drop all long-named policies from 20260311, restore
-- helper functions to nuclear reset versions.
-- ============================================================

-- ============================================================
-- 1. Restore helper functions to nuclear reset versions
--    (use auth.uid() directly for consistency with existing policies)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT id FROM organizers WHERE user_id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION get_team_member_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT organizer_id FROM organizer_team_members WHERE user_id = auth.uid() AND status = 'active'; $$;

CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)); $$;

-- ============================================================
-- 2. Drop duplicate long-named policies from 20260311
-- ============================================================

-- === EVENTS ===
DROP POLICY IF EXISTS "Public can browse published events" ON events;
DROP POLICY IF EXISTS "Organizers can view own events" ON events;
DROP POLICY IF EXISTS "Users can view events they have tickets for" ON events;

-- === TICKET_TYPES ===
DROP POLICY IF EXISTS "Public can view published event tickets" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can insert own ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can update own ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Organizers can delete own ticket types" ON ticket_types;
DROP POLICY IF EXISTS "Service role manages ticket types" ON ticket_types;

-- === CATEGORIES ===
DROP POLICY IF EXISTS "Public can view active categories" ON categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON categories;
DROP POLICY IF EXISTS "Service role manages categories" ON categories;

-- === ORGANIZERS ===
DROP POLICY IF EXISTS "Public can view active organizers" ON organizers;
DROP POLICY IF EXISTS "Users can view own organizer" ON organizers;
DROP POLICY IF EXISTS "Users can update own organizer" ON organizers;
DROP POLICY IF EXISTS "Users can insert own organizer" ON organizers;
DROP POLICY IF EXISTS "Admins can view all organizers" ON organizers;
DROP POLICY IF EXISTS "Admins can update all organizers" ON organizers;
DROP POLICY IF EXISTS "Service role manages organizers" ON organizers;
DROP POLICY IF EXISTS "Team members can view organizer" ON organizers;

-- === FOLLOWERS ===
DROP POLICY IF EXISTS "Public can view followers" ON followers;
DROP POLICY IF EXISTS "Users can insert own follows" ON followers;
DROP POLICY IF EXISTS "Users can delete own follows" ON followers;
DROP POLICY IF EXISTS "Service role manages followers" ON followers;

-- === EVENT_DAYS ===
DROP POLICY IF EXISTS "Public can view published event days" ON event_days;
DROP POLICY IF EXISTS "Organizers can manage own event days" ON event_days;
DROP POLICY IF EXISTS "Service role manages event days" ON event_days;

-- === EVENT_DAY_ACTIVITIES ===
DROP POLICY IF EXISTS "Public can view published event activities" ON event_day_activities;
DROP POLICY IF EXISTS "Organizers can manage own event activities" ON event_day_activities;
DROP POLICY IF EXISTS "Service role manages event activities" ON event_day_activities;

-- === EVENT_SPONSORS ===
DROP POLICY IF EXISTS "Public can view published event sponsors" ON event_sponsors;
DROP POLICY IF EXISTS "Organizers can manage own event sponsors" ON event_sponsors;
DROP POLICY IF EXISTS "Service role manages event sponsors" ON event_sponsors;

-- === EVENT_SPEAKERS ===
DROP POLICY IF EXISTS "Public can view published event speakers" ON event_speakers;
DROP POLICY IF EXISTS "Organizers can manage own event speakers" ON event_speakers;
DROP POLICY IF EXISTS "Service role manages event speakers" ON event_speakers;

-- === ORDERS ===
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Organizers can view event orders" ON orders;
DROP POLICY IF EXISTS "Service role manages orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON orders;

-- === TICKETS ===
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Organizers can view event tickets" ON tickets;
DROP POLICY IF EXISTS "Service role manages tickets" ON tickets;
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;

-- === SAVED_EVENTS ===
DROP POLICY IF EXISTS "Users can view own saved events" ON saved_events;
DROP POLICY IF EXISTS "Users can save events" ON saved_events;
DROP POLICY IF EXISTS "Users can unsave events" ON saved_events;
DROP POLICY IF EXISTS "Service role manages saved events" ON saved_events;

-- === PROMOTERS ===
DROP POLICY IF EXISTS "Public can view active promoters" ON promoters;
DROP POLICY IF EXISTS "Organizers can manage own promoters" ON promoters;
DROP POLICY IF EXISTS "Users can view own promoter records" ON promoters;
DROP POLICY IF EXISTS "Service role manages promoters" ON promoters;

-- === PROFILES ===
DROP POLICY IF EXISTS "Public can view organizer basic profile" ON profiles;

-- ============================================================
-- DONE - Duplicate policies removed, helper functions restored.
-- The short-named policies from nuclear reset (20260316) +
-- hardening (20260317) remain intact.
-- ============================================================
