-- ============================================================
-- COMPREHENSIVE SECURITY HARDENING
-- ============================================================
-- Fixes:
--   A. Missing write policies on events/orders/tickets (broken functionality)
--   B. Tightened INSERT policies (user_id = auth.uid())
--   C. Column-level security on organizers (sensitive fields)
--   D. Uncovered tables: promo_codes, waitlist, event_invite_codes,
--      event_email_whitelist, order_items
--   E. platform_adverts: replace USING(true) with active+date filter
-- ============================================================

-- ============================================================
-- Recreate drop_all_policies helper (dropped at end of previous migration)
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
-- A. EVENTS: Add missing write policies for organizers
-- ============================================================
-- Currently only has SELECT + admin ALL. Organizers can't create/edit/delete.
CREATE POLICY "organizer_insert" ON events FOR INSERT
  WITH CHECK (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));

CREATE POLICY "organizer_update" ON events FOR UPDATE
  USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));

CREATE POLICY "organizer_delete" ON events FOR DELETE
  USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));

-- ============================================================
-- A. ORDERS: Add missing update policy
-- ============================================================
-- Users need to update their own orders after payment callbacks.
CREATE POLICY "own_orders_update" ON orders FOR UPDATE
  USING (user_id::text = auth.uid()::text);

-- Admin full access on orders (currently missing)
CREATE POLICY "admin_orders" ON orders FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================================
-- A. TICKETS: Add missing update policy for organizer check-ins
-- ============================================================
CREATE POLICY "organizer_update_tickets" ON tickets FOR UPDATE
  USING (event_id IN (SELECT get_organizer_event_ids()));

-- Admin full access on tickets (currently missing)
CREATE POLICY "admin_tickets" ON tickets FOR ALL
  USING (is_admin(auth.uid()));

-- ============================================================
-- B. TIGHTEN INSERT POLICIES — add user_id = auth.uid() check
-- ============================================================
-- Tickets: drop existing permissive insert, recreate with user_id check
DROP POLICY IF EXISTS "insert_tickets" ON tickets;
CREATE POLICY "insert_tickets" ON tickets FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

-- Orders: drop existing permissive insert, recreate with user_id check
DROP POLICY IF EXISTS "insert_orders" ON orders;
CREATE POLICY "insert_orders" ON orders FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id::text = auth.uid()::text);

-- ============================================================
-- C. COLUMN-LEVEL SECURITY on organizers table
-- ============================================================
-- Revoke access to sensitive columns from authenticated role.
-- Public/anon SELECT is governed by RLS (only sees is_active = true rows),
-- but any authenticated user seeing those rows should not get these columns.
REVOKE SELECT (
  stripe_connect_id,
  stripe_connect_status,
  stripe_connect_enabled,
  stripe_connect_onboarded_at,
  stripe_connect_terms_accepted_at,
  stripe_connect_payouts_enabled,
  stripe_connect_charges_enabled,
  stripe_connect_disabled_reason,
  stripe_connect_disabled_at,
  stripe_connect_disabled_by,
  stripe_identity_session_id,
  stripe_identity_status,
  kyc_status,
  kyc_verified,
  kyc_level,
  total_revenue,
  available_balance,
  pending_balance,
  custom_fee_enabled,
  custom_service_fee_percentage,
  custom_service_fee_fixed,
  custom_service_fee_cap,
  custom_fee_set_by,
  custom_fee_set_at
) ON organizers FROM authenticated;

-- Also revoke from anon
REVOKE SELECT (
  stripe_connect_id,
  stripe_connect_status,
  stripe_connect_enabled,
  stripe_connect_onboarded_at,
  stripe_connect_terms_accepted_at,
  stripe_connect_payouts_enabled,
  stripe_connect_charges_enabled,
  stripe_connect_disabled_reason,
  stripe_connect_disabled_at,
  stripe_connect_disabled_by,
  stripe_identity_session_id,
  stripe_identity_status,
  kyc_status,
  kyc_verified,
  kyc_level,
  total_revenue,
  available_balance,
  pending_balance,
  custom_fee_enabled,
  custom_service_fee_percentage,
  custom_service_fee_fixed,
  custom_service_fee_cap,
  custom_fee_set_by,
  custom_fee_set_at
) ON organizers FROM anon;

-- RPC: Get all columns for the caller's OWN organizer record
CREATE OR REPLACE FUNCTION get_my_organizer_full()
RETURNS SETOF organizers
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT * FROM organizers WHERE user_id = auth.uid();
$$;

-- RPC: Get all columns for a specific organizer (admin/finance only)
CREATE OR REPLACE FUNCTION get_organizer_for_finance(p_organizer_id uuid)
RETURNS SETOF organizers
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT o.* FROM organizers o
  WHERE o.id = p_organizer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR role = 'finance' OR is_admin = true)
    );
$$;

-- RPC: Get all columns for a specific organizer (admin only)
CREATE OR REPLACE FUNCTION get_organizer_for_admin(p_organizer_id uuid)
RETURNS SETOF organizers
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT o.* FROM organizers o
  WHERE o.id = p_organizer_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND (role = 'admin' OR is_admin = true)
    );
$$;

-- ============================================================
-- D. PROMO_CODES: Drop all, recreate with SECURITY DEFINER helpers
-- ============================================================
SELECT drop_all_policies('promo_codes');
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_active" ON promo_codes FOR SELECT
  USING (is_active = true);

CREATE POLICY "organizer_manage" ON promo_codes FOR ALL
  USING (organizer_id IN (SELECT get_all_organizer_ids(auth.uid())));

CREATE POLICY "admin_manage" ON promo_codes FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "service_role" ON promo_codes FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- D. WAITLIST: Drop all, recreate safe
-- ============================================================
SELECT drop_all_policies('waitlist');
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_waitlist" ON waitlist FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "own_insert" ON waitlist FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND user_id = auth.uid());

CREATE POLICY "own_update" ON waitlist FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "organizer_manage" ON waitlist FOR ALL
  USING (event_id IN (SELECT get_organizer_event_ids()));

CREATE POLICY "admin_manage" ON waitlist FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "service_role" ON waitlist FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- D. EVENT_INVITE_CODES: Drop all, remove USING(true), use helpers
-- ============================================================
SELECT drop_all_policies('event_invite_codes');
ALTER TABLE event_invite_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_manage" ON event_invite_codes FOR ALL
  USING (event_id IN (SELECT get_organizer_event_ids()));

CREATE POLICY "admin_manage" ON event_invite_codes FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "service_role" ON event_invite_codes FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- D. EVENT_EMAIL_WHITELIST: Drop all, use helpers
-- ============================================================
SELECT drop_all_policies('event_email_whitelist');
ALTER TABLE event_email_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizer_manage" ON event_email_whitelist FOR ALL
  USING (event_id IN (SELECT get_organizer_event_ids()));

CREATE POLICY "admin_manage" ON event_email_whitelist FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "service_role" ON event_email_whitelist FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- D. ORDER_ITEMS: Create helper, drop all, recreate safe
-- ============================================================
-- Helper: get order IDs belonging to the current user
CREATE OR REPLACE FUNCTION get_user_order_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM orders WHERE user_id::text = auth.uid()::text;
$$;

-- Helper: get order IDs for events the organizer manages
CREATE OR REPLACE FUNCTION get_organizer_order_ids()
RETURNS SETOF uuid
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT id FROM orders WHERE event_id IN (SELECT get_organizer_event_ids());
$$;

SELECT drop_all_policies('order_items');
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_items" ON order_items FOR SELECT
  USING (order_id IN (SELECT get_user_order_ids()));

CREATE POLICY "organizer_items" ON order_items FOR SELECT
  USING (order_id IN (SELECT get_organizer_order_ids()));

CREATE POLICY "insert_items" ON order_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "admin_manage" ON order_items FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "service_role" ON order_items FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- E. PLATFORM_ADVERTS: Replace USING(true) with active + date filter
-- ============================================================
SELECT drop_all_policies('platform_adverts');
ALTER TABLE platform_adverts ENABLE ROW LEVEL SECURITY;

-- Public can only see active ads within their date window
CREATE POLICY "public_active_adverts" ON platform_adverts FOR SELECT
  USING (is_active = true AND now() >= start_date AND now() <= end_date);

CREATE POLICY "admin_manage" ON platform_adverts FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "service_role" ON platform_adverts FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Clean up helper function
-- ============================================================
DROP FUNCTION IF EXISTS drop_all_policies(text);

-- ============================================================
-- DONE — Comprehensive security hardening complete
-- ============================================================
