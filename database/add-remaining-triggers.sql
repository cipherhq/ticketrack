-- ============================================================================
-- ADD REMAINING MISSING TRIGGERS TO DEV DATABASE
-- ============================================================================
-- Run this in Dev Supabase SQL Editor
-- 
-- This adds the 3 triggers that are still missing:
-- 1. bank_accounts.update_bank_accounts_updated_at
-- 2. event_day_activities.update_event_day_activities_updated_at
-- 3. event_days.update_event_days_updated_at
-- ============================================================================

BEGIN;

-- ============================================================================
-- TRIGGER 1: update_bank_accounts_updated_at
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
        -- Ensure the function exists first
        CREATE OR REPLACE FUNCTION public.update_updated_at_column()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$;
        
        DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON public.bank_accounts;
        
        CREATE TRIGGER update_bank_accounts_updated_at 
        BEFORE UPDATE ON public.bank_accounts 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Created trigger: bank_accounts.update_bank_accounts_updated_at';
    ELSE
        RAISE NOTICE 'Skipped trigger: bank_accounts.update_bank_accounts_updated_at (table bank_accounts does not exist)';
    END IF;
END $$;

-- ============================================================================
-- TRIGGER 2: update_event_day_activities_updated_at
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_day_activities') THEN
        DROP TRIGGER IF EXISTS update_event_day_activities_updated_at ON public.event_day_activities;
        
        CREATE TRIGGER update_event_day_activities_updated_at 
        BEFORE UPDATE ON public.event_day_activities 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Created trigger: event_day_activities.update_event_day_activities_updated_at';
    ELSE
        RAISE NOTICE 'Skipped trigger: event_day_activities.update_event_day_activities_updated_at (table event_day_activities does not exist)';
    END IF;
END $$;

-- ============================================================================
-- TRIGGER 3: update_event_days_updated_at
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_days') THEN
        DROP TRIGGER IF EXISTS update_event_days_updated_at ON public.event_days;
        
        CREATE TRIGGER update_event_days_updated_at 
        BEFORE UPDATE ON public.event_days 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
        
        RAISE NOTICE 'Created trigger: event_days.update_event_days_updated_at';
    ELSE
        RAISE NOTICE 'Skipped trigger: event_days.update_event_days_updated_at (table event_days does not exist)';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify the triggers were created:
SELECT 
    event_object_table || '.' || trigger_name as trigger_full_name,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND (
        (event_object_table = 'bank_accounts' AND trigger_name = 'update_bank_accounts_updated_at') OR
        (event_object_table = 'event_day_activities' AND trigger_name = 'update_event_day_activities_updated_at') OR
        (event_object_table = 'event_days' AND trigger_name = 'update_event_days_updated_at')
    )
ORDER BY event_object_table, trigger_name;
