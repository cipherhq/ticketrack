-- ============================================================
-- FIX: Remaining RLS security vulnerabilities
-- Run this in Supabase SQL Editor
-- ============================================================

-- =====================
-- 1. admin_broadcasts — NO RLS at all
-- =====================
ALTER TABLE "public"."admin_broadcasts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage broadcasts"
  ON "public"."admin_broadcasts"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

CREATE POLICY "Service role full access broadcasts"
  ON "public"."admin_broadcasts"
  USING (auth.role() = 'service_role');

-- =====================
-- 2. tickets — "Allow ticket purchases" INSERT WITH CHECK (true)
--    Replace with authenticated-only insert
-- =====================
DROP POLICY IF EXISTS "Allow ticket purchases" ON "public"."tickets";

CREATE POLICY "Authenticated users can purchase tickets"
  ON "public"."tickets"
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================
-- 3. email_send_limits — USING (true) with no FOR clause = full access
-- =====================
DROP POLICY IF EXISTS "System can manage limits" ON "public"."email_send_limits";

CREATE POLICY "Service role can manage email limits"
  ON "public"."email_send_limits"
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view email limits"
  ON "public"."email_send_limits"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =====================
-- 4. sms_usage_log — USING (true) with no FOR clause = full access
-- =====================
DROP POLICY IF EXISTS "System can manage usage" ON "public"."sms_usage_log";

CREATE POLICY "Service role can manage sms usage"
  ON "public"."sms_usage_log"
  USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view sms usage"
  ON "public"."sms_usage_log"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- =====================
-- 5. sms_credit_packages — "packages_admin" USING (true) = full access
--    Keep public read, restrict writes to admin/service
-- =====================
DROP POLICY IF EXISTS "packages_admin" ON "public"."sms_credit_packages";

CREATE POLICY "Admins can manage sms packages"
  ON "public"."sms_credit_packages"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Public read policies already exist (sms_packages_public_read) — keep those

-- =====================
-- 6. sms_credit_purchases — "purchases_update" FOR UPDATE USING (true)
--    Allow organizers to manage their own purchases + admin/service full access
-- =====================
DROP POLICY IF EXISTS "purchases_update" ON "public"."sms_credit_purchases";

-- Organizers can read their own purchase history
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
CREATE POLICY "Organizers can create sms purchases"
  ON "public"."sms_credit_purchases"
  FOR INSERT
  WITH CHECK (
    organizer_id IN (
      SELECT o.id FROM "public"."organizers" o
      WHERE o.user_id = auth.uid()
    )
  );

-- Organizers can update their own purchases (e.g. payment status after Paystack callback)
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
CREATE POLICY "Admins can manage all sms purchases"
  ON "public"."sms_credit_purchases"
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
      WHERE id = auth.uid() AND is_admin = true
    )
  );

-- Service role full access (for webhooks)
CREATE POLICY "Service role can manage sms purchases"
  ON "public"."sms_credit_purchases"
  USING (auth.role() = 'service_role');
