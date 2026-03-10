-- ============================================================
-- SECURITY HARDENING: Lock down SECURITY DEFINER functions
-- ============================================================
-- Issue 1: Functions accept arbitrary user IDs via parameter,
-- allowing anyone to enumerate admins or organizer ownership.
-- Fix: Ignore parameter, always use auth.uid() internally.
--
-- Issue 2: "Public can view organizer basic profile" exposes
-- ALL profile columns (email, phone, is_admin) for organizer users.
-- Fix: Replace with SECURITY DEFINER RPC returning only public fields.
-- ============================================================

-- ============================================================
-- 1. Harden helper functions - ignore parameter, use auth.uid()
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  -- Always use auth.uid() regardless of parameter to prevent enumeration
  SELECT id FROM organizers WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_team_member_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT organizer_id FROM organizer_team_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION is_admin(p_user_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  -- Always checks current user, not arbitrary ID
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
  );
$$;

CREATE OR REPLACE FUNCTION get_all_organizer_ids(p_user_id uuid)
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM organizers WHERE user_id = auth.uid()
  UNION
  SELECT organizer_id FROM organizer_team_members
  WHERE user_id = auth.uid() AND status = 'active';
$$;

-- ============================================================
-- 2. Fix profiles public access - use RPC instead of broad policy
-- ============================================================

-- Drop the overly broad policy that exposes ALL profile columns
DROP POLICY IF EXISTS "Public can view organizer basic profile" ON profiles;

-- Create a safe RPC that returns ONLY public fields for organizer profiles
CREATE OR REPLACE FUNCTION get_organizer_public_profile(p_organizer_user_id uuid)
RETURNS TABLE(
  id uuid,
  full_name text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.id, p.full_name::text, p.avatar_url::text
  FROM profiles p
  JOIN organizers o ON o.user_id = p.id
  WHERE p.id = p_organizer_user_id
    AND o.is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_organizer_public_profile(uuid) TO authenticated, anon;

-- ============================================================
-- DONE
-- ============================================================
