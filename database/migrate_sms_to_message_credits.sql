-- ============================================
-- MIGRATE SMS CREDITS TO MESSAGE CREDITS
-- ============================================
-- This migration moves any existing SMS credits from the old
-- organizer_sms_wallet table to the new communication_credit_balances table
-- Run this ONCE after setting up the Communication Hub

-- Check if old SMS wallet table exists
DO $$
DECLARE
    v_organizer_id UUID;
    v_sms_balance INTEGER;
    v_record RECORD;
BEGIN
    -- Check if the old table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizer_sms_wallet') THEN
        RAISE NOTICE 'Migrating SMS credits to Message Credits...';
        
        -- Loop through all organizers with SMS credits
        FOR v_record IN 
            SELECT organizer_id, balance 
            FROM organizer_sms_wallet 
            WHERE balance > 0
        LOOP
            -- Add the SMS credits to the new system
            -- We'll treat 1 SMS credit as 3 message credits (since SMS costs 3 credits)
            PERFORM add_communication_credits(
                v_record.organizer_id,
                v_record.balance * 3,  -- Convert SMS units to message credits
                0,                      -- No bonus
                NULL,                   -- No package
                0,                      -- No amount (it's a migration)
                'NGN',
                'migration',
                'SMS_MIGRATION_' || v_record.organizer_id::text,
                'Migrated from SMS Credits (' || v_record.balance || ' SMS units = ' || (v_record.balance * 3) || ' message credits)'
            );
            
            RAISE NOTICE 'Migrated % SMS credits for organizer %', v_record.balance, v_record.organizer_id;
        END LOOP;
        
        RAISE NOTICE 'Migration complete!';
    ELSE
        RAISE NOTICE 'No organizer_sms_wallet table found - nothing to migrate';
    END IF;
END $$;

-- Optional: Drop the old SMS credits tables (uncomment if you want to remove them)
-- DROP TABLE IF EXISTS organizer_sms_wallet CASCADE;
-- DROP TABLE IF EXISTS sms_balances CASCADE;
-- DROP TABLE IF EXISTS sms_credit_packages CASCADE;
-- DROP TABLE IF EXISTS sms_credit_purchases CASCADE;
-- DROP TABLE IF EXISTS sms_credit_usage CASCADE;
