-- ============================================================================
-- SAFE DATABASE CLEANUP - Only deletes from existing tables
-- Keeps: bajideace@gmail.com
-- ============================================================================

-- First, let's see what tables exist
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Delete from tables that likely exist (wrapped in exception handlers)

-- Tickets and transactions
DO $$ BEGIN DELETE FROM tickets; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM transactions; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM payments; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM refunds; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM payouts; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM ticket_transfers; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM check_ins; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Events
DO $$ BEGIN DELETE FROM ticket_types; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM promo_codes; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM event_follows; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM event_promoters; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM event_views; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM events; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Communications
DO $$ BEGIN DELETE FROM messages; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM conversations; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM email_campaigns; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM sms_campaigns; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM notification_logs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM automation_job_logs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM automation_jobs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM drip_campaign_subscribers; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM drip_campaign_emails; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM drip_campaigns; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Contacts
DO $$ BEGIN DELETE FROM contact_segment_members; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM contact_tags; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM contacts; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM contact_segments; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Imports
DO $$ BEGIN DELETE FROM import_jobs; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM imported_attendees; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM imported_events; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DELETE FROM external_platform_connections; EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- User-related (keep admin)
DO $$ 
BEGIN 
    DELETE FROM organizer_followers 
    WHERE organizer_id NOT IN (
        SELECT id FROM organizers WHERE user_id IN (
            SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
        )
    );
EXCEPTION WHEN undefined_table THEN NULL; 
END $$;

DO $$ 
BEGIN 
    DELETE FROM organizer_team_members 
    WHERE organizer_id NOT IN (
        SELECT id FROM organizers WHERE user_id IN (
            SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
        )
    );
EXCEPTION WHEN undefined_table THEN NULL; 
END $$;

DO $$ 
BEGIN 
    DELETE FROM bank_accounts 
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
-- VERIFY
-- ============================================================================
SELECT 'Users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL SELECT 'Organizers', COUNT(*) FROM organizers
UNION ALL SELECT 'Profiles', COUNT(*) FROM profiles
UNION ALL SELECT 'Events', COUNT(*) FROM events
UNION ALL SELECT 'Tickets', COUNT(*) FROM tickets
UNION ALL SELECT 'Contacts', COUNT(*) FROM contacts;
