-- ============================================================================
-- DATABASE CLEANUP SCRIPT (Simple Version)
-- Deletes all data but keeps admin user: bajideace@gmail.com
-- ============================================================================
-- 
-- ⚠️  WARNING: This is IRREVERSIBLE! Make a backup first!
-- 
-- Run in Supabase SQL Editor
-- ============================================================================

-- Step 1: Get admin user ID (change email if needed)
-- Run this first to verify:
-- SELECT id, email FROM auth.users WHERE email = 'bajideace@gmail.com';

-- ============================================================================
-- DELETE IN ORDER (respects foreign keys)
-- ============================================================================

-- Transactional data
DELETE FROM ticket_transfers;
DELETE FROM check_ins;
DELETE FROM tickets;
DELETE FROM transactions;
DELETE FROM payments;
DELETE FROM refunds;
DELETE FROM payouts;

-- Event data
DELETE FROM ticket_types;
DELETE FROM promo_codes;
DELETE FROM event_follows;
DELETE FROM event_promoters;
DELETE FROM events;

-- Communication data
DELETE FROM messages;
DELETE FROM conversations;
DELETE FROM email_campaigns;
DELETE FROM sms_campaigns;
DELETE FROM notification_logs;
DELETE FROM automation_job_logs;
DELETE FROM automation_jobs;

-- Try to delete drip campaign data if tables exist
DO $$ BEGIN
    DELETE FROM drip_campaign_subscribers;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    DELETE FROM drip_campaign_emails;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    DELETE FROM drip_campaigns;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Contact data
DO $$ BEGIN
    DELETE FROM contact_segment_members;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    DELETE FROM contact_tags;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DELETE FROM contacts;

DO $$ BEGIN
    DELETE FROM contact_segments;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Import data
DO $$ BEGIN
    DELETE FROM import_jobs;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    DELETE FROM imported_attendees;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    DELETE FROM imported_events;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- User data (KEEP ADMIN)
-- First, delete non-admin organizer data
DELETE FROM organizer_followers 
WHERE organizer_id NOT IN (
    SELECT id FROM organizers WHERE user_id IN (
        SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
    )
);

DELETE FROM organizer_team_members 
WHERE organizer_id NOT IN (
    SELECT id FROM organizers WHERE user_id IN (
        SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
    )
);

DELETE FROM bank_accounts 
WHERE organizer_id NOT IN (
    SELECT id FROM organizers WHERE user_id IN (
        SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
    )
);

DO $$ BEGIN
    DELETE FROM external_platform_connections 
    WHERE organizer_id NOT IN (
        SELECT id FROM organizers WHERE user_id IN (
            SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
        )
    );
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Delete non-admin organizers
DELETE FROM organizers 
WHERE user_id NOT IN (
    SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
);

-- Delete non-admin profiles
DELETE FROM profiles 
WHERE id NOT IN (
    SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
);

-- Delete non-admin users
DELETE FROM auth.users 
WHERE email != 'bajideace@gmail.com';

-- ============================================================================
-- VERIFY CLEANUP
-- ============================================================================
SELECT 'Remaining Data:' as info;

SELECT 'Users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'Organizers', COUNT(*) FROM organizers
UNION ALL
SELECT 'Profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'Events', COUNT(*) FROM events
UNION ALL
SELECT 'Tickets', COUNT(*) FROM tickets
UNION ALL
SELECT 'Contacts', COUNT(*) FROM contacts;
