-- ============================================================
-- FIX: Lock down profiles table RLS policies
--
-- PROBLEM: Three policies with USING (true) allow ANY user
-- (including anonymous) to read ALL profile data (email, phone, name).
--
-- This migration replaces them with properly scoped policies.
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Drop the three overly permissive SELECT policies
DROP POLICY IF EXISTS "Public profiles are viewable" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can view profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "profiles_public_read" ON "public"."profiles";

-- 2. Keep existing granular policies (these already exist, listed for reference):
--    - "Users can view own profile" → USING (auth.uid() = id)
--    - "Users can update own profile" → USING (id = auth.uid())
--    - "Users can insert own profile" → WITH CHECK (id = auth.uid())

-- 3. Add: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles" p
      WHERE p.id = auth.uid() AND p.is_admin = true
    )
  );

-- 4. Add: Organizers can view profiles of their event attendees
--    (covers: refunds page, communication hub, attendee lists)
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

-- 5. Add: Organizers can view their own team members' profiles
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

-- 6. Add: Organizers can view their promoters' profiles
--    (covers: OrganizerPromoters, PromoterManagement)
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

-- 7. Add: Finance users can view profiles (needed for finance dashboard)
CREATE POLICY "Finance users can view profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."finance_users" fu
      WHERE fu.user_id = auth.uid() AND fu.is_active = true
    )
  );

-- 8. Service role bypass (for edge functions / webhooks)
CREATE POLICY "Service role can view all profiles"
  ON "public"."profiles"
  FOR SELECT
  USING (auth.role() = 'service_role');

-- 9. Secure RPC function for phone uniqueness check
--    (replaces direct profile query in phoneValidation.js)
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

-- 10. Secure RPC function for affiliate/referral code lookup
--     (replaces direct profile query in WebCheckout.jsx)
--     Returns fields needed for fraud detection (self-referral, same email/phone)
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

-- 11. Secure RPC to increment referral count on affiliate profile
--     (replaces direct profile update in WebCheckout.jsx creditAffiliate)
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_phone_exists(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_phone_exists(text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.lookup_affiliate(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_affiliate(text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_referral_count(uuid) TO authenticated;
