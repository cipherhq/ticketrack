-- Fix RLS Policies for Public Access
-- This ensures users, organizers, promoters, affiliates, and admin tables are visible to application users

-- =============================================================================
-- PROFILES TABLE
-- =============================================================================
-- Already has public read access via "profiles_public_read" policy
-- No changes needed

-- =============================================================================
-- ORGANIZERS TABLE  
-- =============================================================================
-- Already has public read access via "Verified organizers are viewable by everyone" policy
-- This allows: USING (("is_active" = true))
-- No changes needed

-- =============================================================================
-- PROMOTERS TABLE
-- =============================================================================
-- Currently only visible to owners and admins
-- Add public read policy for active promoters

DROP POLICY IF EXISTS "promoters_public_read" ON "public"."promoters";

CREATE POLICY "promoters_public_read" 
ON "public"."promoters" 
FOR SELECT 
USING (
  "status" = 'active' 
  AND "organizer_id" IN (
    SELECT "id" FROM "public"."organizers" WHERE "is_active" = true
  )
);

-- =============================================================================
-- AFFILIATES (via profiles table)
-- =============================================================================
-- Affiliates are stored in the profiles table with affiliate_status
-- Profiles table already has public read access
-- No changes needed for affiliates visibility

-- =============================================================================
-- ADMIN TABLE ACCESS
-- =============================================================================
-- Admin tables should remain restricted to admins only
-- No changes needed

-- =============================================================================
-- VERIFY POLICIES
-- =============================================================================

-- Check that profiles are publicly readable
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('profiles', 'organizers', 'promoters')
ORDER BY tablename, policyname;
