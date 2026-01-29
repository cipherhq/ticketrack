-- ============================================================================
-- ADD ALL RLS POLICIES TO DATABASE
-- ============================================================================
-- This script adds all RLS policies from production
-- Run this in your Supabase SQL Editor
-- ============================================================================
-- Note: Policies are wrapped in DO blocks with existence checks
-- to prevent errors if tables or policies already exist
-- ============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_actions') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'admin_actions' AND policyname = 'admin_actions_policy') THEN
            CREATE POLICY "admin_actions_policy" ON public.admin_actions
                AS PERMISSIVE
                FOR ALL
                TO public
                USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.is_admin = true)))))
            ;
        END IF;
    END IF;
END $$;
