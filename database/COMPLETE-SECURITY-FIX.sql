-- ============================================================
-- COMPLETE SECURITY FIX — Run this in Supabase SQL Editor
--
-- Safe to run multiple times (uses DROP IF EXISTS / CREATE OR REPLACE)
-- Covers: profiles RLS, admin_broadcasts, tickets, email/sms limits,
--         sms packages, sms purchases, and RPC functions
-- ============================================================

-- =============================================
-- PART 1: PROFILES — Lock down overly permissive policies
-- =============================================

-- Drop the three overly permissive SELECT policies
DROP POLICY IF EXISTS "Public profiles are viewable" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can view profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_public_read" ON "public"."profiles";

-- Keep existing granular policies (listed for reference):
--   "Users can view own profile" → USING (auth.uid() = id)
--   "Users can update own profile" → USING (id = auth.uid())
--   "Users can insert own profile" → WITH CHECK (id = auth.uid())

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON "public"."profiles";
CREATE POLICY "Admins can view all profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- Organizers can view profiles of their event attendees
DROP POLICY IF EXISTS "Organizers can view attendee profiles" ON "public"."profiles";
CREATE POLICY "Organizers can view attendee profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (
    id IN (
      SELECT t.user_id FROM "public"."tickets" t
      JOIN "public"."events" e ON t.event_id = e.id
      JOIN "public"."organizers" o ON e.organizer_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

-- Organizers can view their own team members' profiles
DROP POLICY IF EXISTS "Organizers can view team member profiles" ON "public"."profiles";
CREATE POLICY "Organizers can view team member profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (
    id IN (
      SELECT otm.user_id FROM "public"."organizer_team_members" otm
      JOIN "public"."organizers" o ON otm.organizer_id = o.id
      WHERE o.user_id = auth.uid()
    )
  );

-- Organizers can view their promoters' profiles
DROP POLICY IF EXISTS "Organizers can view promoter profiles" ON "public"."profiles";
CREATE POLICY "Organizers can view promoter profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (
    id IN (
      SELECT pr.user_id FROM "public"."promoters" pr
      JOIN "public"."organizers" o ON pr.organizer_id = o.id
      WHERE o.user_id = auth.uid()
        AND pr.user_id IS NOT NULL
    )
  );

-- Finance users can view profiles (finance dashboard)
DROP POLICY IF EXISTS "Finance users can view profiles" ON "public"."profiles";
CREATE POLICY "Finance users can view profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."finance_users" fu
      WHERE fu.user_id = auth.uid() AND fu.is_active = true
    )
  );

-- Service role bypass (edge functions / webhooks)
DROP POLICY IF EXISTS "Service role can view all profiles" ON "public"."profiles";
CREATE POLICY "Service role can view all profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (auth.role() = 'service_role');


-- =============================================
-- PART 2: RPC FUNCTIONS — Secure data access without USING(true)
-- =============================================

-- Phone uniqueness check (used by phoneValidation.js)
CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text, p_exclude_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_exclude_user_id IS NOT NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles WHERE phone = p_phone AND id != p_exclude_user_id
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM profiles WHERE phone = p_phone
    );
  END IF;
END;
$$;

-- Affiliate/referral code lookup (used by WebCheckout.jsx)
CREATE OR REPLACE FUNCTION public.lookup_affiliate(p_referral_code text)
RETURNS TABLE(id uuid, email text, phone text, referral_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT p.id, p.email::text, p.phone::text, p.referral_code::text
    FROM profiles p
    WHERE p.referral_code = p_referral_code
      AND p.affiliate_status = 'approved'
    LIMIT 1;
END;
$$;

-- Increment referral count (used by WebCheckout.jsx creditAffiliate)
CREATE OR REPLACE FUNCTION public.increment_referral_count(p_referrer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = p_referrer_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_phone_exists(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_phone_exists(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_affiliate(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_affiliate(text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_referral_count(uuid) TO authenticated;


-- =============================================
-- PART 3: admin_broadcasts — Was missing RLS entirely
-- =============================================
ALTER TABLE "public"."admin_broadcasts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage broadcasts" ON "public"."admin_broadcasts";
CREATE POLICY "Admins can manage broadcasts"
  ON "public"."admin_broadcasts"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Service role full access broadcasts" ON "public"."admin_broadcasts";
CREATE POLICY "Service role full access broadcasts"
  ON "public"."admin_broadcasts"
  USING (auth.role() = 'service_role');


-- =============================================
-- PART 4: tickets — Replace INSERT WITH CHECK(true)
-- =============================================
DROP POLICY IF EXISTS "Allow ticket purchases" ON "public"."tickets";

DROP POLICY IF EXISTS "Authenticated users can purchase tickets" ON "public"."tickets";
CREATE POLICY "Authenticated users can purchase tickets"
  ON "public"."tickets"
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- =============================================
-- PART 5: email_send_limits — Replace USING(true)
-- =============================================
DROP POLICY IF EXISTS "System can manage limits" ON "public"."email_send_limits";

DROP POLICY IF EXISTS "Service role can manage email limits" ON "public"."email_send_limits";
CREATE POLICY "Service role can manage email limits"
  ON "public"."email_send_limits"
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can view email limits" ON "public"."email_send_limits";
CREATE POLICY "Admins can view email limits"
  ON "public"."email_send_limits"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- =============================================
-- PART 6: sms_usage_log — Replace USING(true)
-- =============================================
DROP POLICY IF EXISTS "System can manage usage" ON "public"."sms_usage_log";

DROP POLICY IF EXISTS "Service role can manage sms usage" ON "public"."sms_usage_log";
CREATE POLICY "Service role can manage sms usage"
  ON "public"."sms_usage_log"
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can view sms usage" ON "public"."sms_usage_log";
CREATE POLICY "Admins can view sms usage"
  ON "public"."sms_usage_log"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );


-- =============================================
-- PART 7: sms_credit_packages — Replace USING(true)
-- =============================================
DROP POLICY IF EXISTS "packages_admin" ON "public"."sms_credit_packages";

DROP POLICY IF EXISTS "Admins can manage sms packages" ON "public"."sms_credit_packages";
CREATE POLICY "Admins can manage sms packages"
  ON "public"."sms_credit_packages"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Keep existing public read policy (sms_packages_public_read)


-- =============================================
-- PART 8: sms_credit_purchases — Replace FOR UPDATE USING(true)
-- =============================================
DROP POLICY IF EXISTS "purchases_update" ON "public"."sms_credit_purchases";

-- Organizers can view their own purchase history
DROP POLICY IF EXISTS "Organizers can view own sms purchases" ON "public"."sms_credit_purchases";
CREATE POLICY "Organizers can view own sms purchases"
  ON "public"."sms_credit_purchases"
  FOR SELECT
  USING (
    organizer_id IN (
      SELECT o.id FROM "public"."organizers" o
      WHERE o.user_id = auth.uid()
    )
  );

-- Organizers can create purchases for their own org
DROP POLICY IF EXISTS "Organizers can create sms purchases" ON "public"."sms_credit_purchases";
CREATE POLICY "Organizers can create sms purchases"
  ON "public"."sms_credit_purchases"
  FOR INSERT
  WITH CHECK (
    organizer_id IN (
      SELECT o.id FROM "public"."organizers" o
      WHERE o.user_id = auth.uid()
    )
  );

-- Organizers can update their own purchases (payment status callbacks)
DROP POLICY IF EXISTS "Organizers can update own sms purchases" ON "public"."sms_credit_purchases";
CREATE POLICY "Organizers can update own sms purchases"
  ON "public"."sms_credit_purchases"
  FOR UPDATE
  USING (
    organizer_id IN (
      SELECT o.id FROM "public"."organizers" o
      WHERE o.user_id = auth.uid()
    )
  );

-- Admin full access
DROP POLICY IF EXISTS "Admins can manage all sms purchases" ON "public"."sms_credit_purchases";
CREATE POLICY "Admins can manage all sms purchases"
  ON "public"."sms_credit_purchases"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Service role full access (webhooks)
DROP POLICY IF EXISTS "Service role can manage sms purchases" ON "public"."sms_credit_purchases";
CREATE POLICY "Service role can manage sms purchases"
  ON "public"."sms_credit_purchases"
  USING (auth.role() = 'service_role');


-- =============================================
-- DONE
-- =============================================
-- After running, verify:
-- 1. Admin dashboard still shows all profiles, attendees, contacts
-- 2. Organizers can see their event attendees, team members, promoters
-- 3. Regular users can only see their own profile
-- 4. Phone validation works during signup/profile update
-- 5. Affiliate code lookup works during checkout
-- 6. SMS credit purchase flow works for organizers
