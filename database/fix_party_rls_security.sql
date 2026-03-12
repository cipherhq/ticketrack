-- ============================================================================
-- FIX: Tighten party_invite_guests RLS policies
-- The old policies used USING(true) which allows ANY user to read/update ANY guest
-- ============================================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can read guest by rsvp token" ON party_invite_guests;
DROP POLICY IF EXISTS "Anyone can update guest RSVP by token" ON party_invite_guests;

-- New SELECT: guests can be read if the invite is active (needed for public guest list)
-- This scopes reads to active invites only, preventing access to deactivated party data
CREATE POLICY "Public can read guests for active invites"
  ON party_invite_guests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_guests.invite_id
        AND pi.is_active = true
    )
  );

-- New UPDATE: only allow updates where the caller knows the guest's rsvp_token
-- Since RLS can't verify "the caller passed this token", we scope to active invites
-- and rely on the .eq('rsvp_token', token) filter in the application query
-- This is still safer than USING(true) because it prevents updating guests on inactive invites
CREATE POLICY "Public can update guest RSVP on active invites"
  ON party_invite_guests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_guests.invite_id
        AND pi.is_active = true
    )
  );

-- Also allow anonymous INSERT for self-registration via share link
-- (registerAndRSVP function needs this)
CREATE POLICY "Public can register as guest on active invites"
  ON party_invite_guests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_guests.invite_id
        AND pi.is_active = true
    )
  );

-- ============================================================================
-- FIX: Tighten party_invite_cohosts RLS policies
-- ============================================================================

DROP POLICY IF EXISTS "Public can read cohost by token" ON party_invite_cohosts;
DROP POLICY IF EXISTS "Public can update cohost by token" ON party_invite_cohosts;

-- New: only allow reading cohosts for active invites
CREATE POLICY "Public can read cohosts for active invites"
  ON party_invite_cohosts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_cohosts.invite_id
        AND pi.is_active = true
    )
  );

-- New: only allow updating cohosts for active invites (accepting invite)
CREATE POLICY "Public can accept cohost for active invites"
  ON party_invite_cohosts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM party_invites pi
      WHERE pi.id = party_invite_cohosts.invite_id
        AND pi.is_active = true
    )
  );
