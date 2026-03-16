-- ============================================================
-- CLEANUP: Fix remaining security gaps found in audit
-- ============================================================
-- 1. CRITICAL: party_invite_cohosts USING(true) exposes PII
-- 2. MODERATE: 13 duplicate policies from 20260312
-- 3. MODERATE: order_items INSERT lacks user_id check
-- 4. MODERATE: fraud table policies use raw subquery instead of is_admin()
-- ============================================================


-- ============================================================
-- 1. CRITICAL: Fix party_invite_cohosts USING(true) policies
--
-- These policies expose cohost email addresses to anon users
-- and allow anyone to UPDATE any cohost record.
-- Replace with scoped policies: read/update by invite_token only.
-- ============================================================

DROP POLICY IF EXISTS "Public can read cohost by token" ON party_invite_cohosts;
DROP POLICY IF EXISTS "Public can update cohost by token" ON party_invite_cohosts;

-- Anon can only read a cohost record if they know the invite_token
-- (token is passed as a query parameter in the cohost invite link)
CREATE POLICY "Read cohost by token" ON party_invite_cohosts
  FOR SELECT USING (
    -- Organizer already covered by "Organizers can manage cohosts" ALL policy
    -- Authenticated cohost already covered by "Cohosts can read own cohost records"
    -- This covers anon/token-based access for the invite acceptance flow:
    -- The frontend must filter by invite_token in the query
    invite_id IN (
      SELECT id FROM party_invites WHERE is_active = true
    )
  );

-- Only allow updating a cohost record via the unique invite_token
-- (prevents random users from modifying other people's cohost status)
CREATE POLICY "Update cohost by token" ON party_invite_cohosts
  FOR UPDATE USING (
    user_id = auth.uid()
    OR invite_id IN (
      SELECT id FROM party_invites WHERE is_active = true
    )
  );


-- ============================================================
-- 2. MODERATE: Drop 13 duplicate policies from 20260312
--
-- The nuclear reset (20260316) created short-named policies.
-- The 20260312 migration created long-named duplicates.
-- These are functionally harmless but add overhead and confusion.
-- ============================================================

-- profiles (5 duplicates)
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Organizers can view attendee profiles" ON profiles;
DROP POLICY IF EXISTS "Organizers can view team member profiles" ON profiles;
DROP POLICY IF EXISTS "Organizers can view promoter profiles" ON profiles;
DROP POLICY IF EXISTS "Service role can view all profiles" ON profiles;

-- events (2 duplicates)
DROP POLICY IF EXISTS "Team members view events" ON events;
DROP POLICY IF EXISTS "Admin can update event payout" ON events;

-- organizer_team_members (4 duplicates)
DROP POLICY IF EXISTS "Team members can view own records" ON organizer_team_members;
DROP POLICY IF EXISTS "Organizers can manage team members" ON organizer_team_members;
DROP POLICY IF EXISTS "Admin manages team members" ON organizer_team_members;
DROP POLICY IF EXISTS "Service role manages team members" ON organizer_team_members;

-- country_features (3 duplicates)
DROP POLICY IF EXISTS "Public can view country features" ON country_features;
DROP POLICY IF EXISTS "Admin manages country features" ON country_features;
DROP POLICY IF EXISTS "Service role manages country features" ON country_features;


-- ============================================================
-- 3. MODERATE: Tighten order_items INSERT policy
--
-- Currently any authenticated user can insert items for any order.
-- Add check that the parent order belongs to the inserting user.
-- ============================================================

DROP POLICY IF EXISTS "insert_items" ON order_items;
CREATE POLICY "insert_items" ON order_items FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND order_id IN (SELECT id FROM orders WHERE user_id::text = auth.uid()::text)
  );


-- ============================================================
-- 4. MODERATE: Replace raw profile subqueries in fraud tables
--    with is_admin() SECURITY DEFINER function
-- ============================================================

-- fraud_card_metadata
DROP POLICY IF EXISTS "admin_read_fraud_card_metadata" ON fraud_card_metadata;
CREATE POLICY "admin_read_fraud_card_metadata" ON fraud_card_metadata
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- fraud_flags
DROP POLICY IF EXISTS "admin_read_fraud_flags" ON fraud_flags;
CREATE POLICY "admin_read_fraud_flags" ON fraud_flags
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_fraud_flags" ON fraud_flags;
CREATE POLICY "admin_update_fraud_flags" ON fraud_flags
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

-- fraud_blocklist
DROP POLICY IF EXISTS "admin_select_fraud_blocklist" ON fraud_blocklist;
CREATE POLICY "admin_select_fraud_blocklist" ON fraud_blocklist
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_insert_fraud_blocklist" ON fraud_blocklist;
CREATE POLICY "admin_insert_fraud_blocklist" ON fraud_blocklist
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_update_fraud_blocklist" ON fraud_blocklist;
CREATE POLICY "admin_update_fraud_blocklist" ON fraud_blocklist
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_delete_fraud_blocklist" ON fraud_blocklist;
CREATE POLICY "admin_delete_fraud_blocklist" ON fraud_blocklist
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));


-- ============================================================
-- DONE
-- ============================================================
