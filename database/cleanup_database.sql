-- ============================================================================
-- DATABASE CLEANUP SCRIPT
-- Deletes all data but keeps specified admin user(s)
-- ============================================================================
-- 
-- USAGE:
-- 1. Replace 'bajideace@gmail.com' with your admin email(s)
-- 2. Run in Supabase SQL Editor
-- 3. This is IRREVERSIBLE - make a backup first!
--
-- ============================================================================

-- Set the admin email(s) to preserve (comma-separated if multiple)
-- These users and their organizer profiles will NOT be deleted
DO $$
DECLARE
    admin_emails TEXT[] := ARRAY['bajideace@gmail.com'];
    admin_user_ids UUID[];
    admin_organizer_ids UUID[];
BEGIN
    -- Get admin user IDs
    SELECT ARRAY_AGG(id) INTO admin_user_ids
    FROM auth.users
    WHERE email = ANY(admin_emails);
    
    -- Get admin organizer IDs
    SELECT ARRAY_AGG(id) INTO admin_organizer_ids
    FROM organizers
    WHERE user_id = ANY(admin_user_ids);
    
    RAISE NOTICE 'Preserving admin users: %', admin_user_ids;
    RAISE NOTICE 'Preserving admin organizers: %', admin_organizer_ids;
    
    -- ========================================================================
    -- PHASE 1: Delete transactional data (sales, tickets, orders)
    -- ========================================================================
    
    RAISE NOTICE 'Phase 1: Cleaning transactional data...';
    
    -- Delete ticket transfers
    DELETE FROM ticket_transfers WHERE TRUE;
    
    -- Delete check-ins
    DELETE FROM check_ins WHERE TRUE;
    
    -- Delete tickets
    DELETE FROM tickets WHERE TRUE;
    
    -- Delete orders/transactions
    DELETE FROM transactions WHERE TRUE;
    
    -- Delete payment records
    DELETE FROM payments WHERE TRUE;
    
    -- Delete refunds
    DELETE FROM refunds WHERE TRUE;
    
    -- Delete payouts
    DELETE FROM payouts WHERE TRUE;
    
    RAISE NOTICE 'Phase 1 complete.';
    
    -- ========================================================================
    -- PHASE 2: Delete event-related data
    -- ========================================================================
    
    RAISE NOTICE 'Phase 2: Cleaning event data...';
    
    -- Delete ticket types
    DELETE FROM ticket_types WHERE TRUE;
    
    -- Delete promo codes
    DELETE FROM promo_codes WHERE TRUE;
    
    -- Delete event follows
    DELETE FROM event_follows WHERE TRUE;
    
    -- Delete event views/analytics
    DELETE FROM event_views WHERE TRUE;
    
    -- Delete event promoters
    DELETE FROM event_promoters WHERE TRUE;
    
    -- Delete events (except admin's if you want to keep them)
    DELETE FROM events WHERE TRUE;
    
    RAISE NOTICE 'Phase 2 complete.';
    
    -- ========================================================================
    -- PHASE 3: Delete communication data
    -- ========================================================================
    
    RAISE NOTICE 'Phase 3: Cleaning communication data...';
    
    -- Delete messages
    DELETE FROM messages WHERE TRUE;
    
    -- Delete conversations
    DELETE FROM conversations WHERE TRUE;
    
    -- Delete email campaigns
    DELETE FROM email_campaigns WHERE TRUE;
    
    -- Delete SMS campaigns  
    DELETE FROM sms_campaigns WHERE TRUE;
    
    -- Delete notification logs
    DELETE FROM notification_logs WHERE TRUE;
    
    -- Delete automation job logs
    DELETE FROM automation_job_logs WHERE TRUE;
    
    -- Delete automation jobs
    DELETE FROM automation_jobs WHERE TRUE;
    
    -- Delete drip campaign data
    DELETE FROM drip_campaign_subscribers WHERE TRUE;
    DELETE FROM drip_campaign_emails WHERE TRUE;
    DELETE FROM drip_campaigns WHERE TRUE;
    
    RAISE NOTICE 'Phase 3 complete.';
    
    -- ========================================================================
    -- PHASE 4: Delete contact data (keep admin's contacts if needed)
    -- ========================================================================
    
    RAISE NOTICE 'Phase 4: Cleaning contact data...';
    
    -- Delete contact segment memberships
    DELETE FROM contact_segment_members WHERE TRUE;
    
    -- Delete contact tags
    DELETE FROM contact_tags WHERE TRUE;
    
    -- Delete contacts
    DELETE FROM contacts WHERE TRUE;
    
    -- Delete segments
    DELETE FROM contact_segments WHERE TRUE;
    
    -- Delete import jobs
    DELETE FROM import_jobs WHERE TRUE;
    
    -- Delete imported attendees
    DELETE FROM imported_attendees WHERE TRUE;
    
    -- Delete imported events
    DELETE FROM imported_events WHERE TRUE;
    
    RAISE NOTICE 'Phase 4 complete.';
    
    -- ========================================================================
    -- PHASE 5: Delete user data (except admin)
    -- ========================================================================
    
    RAISE NOTICE 'Phase 5: Cleaning user data (preserving admin)...';
    
    -- Delete organizer followers (except admin's followers)
    DELETE FROM organizer_followers 
    WHERE organizer_id NOT IN (SELECT unnest(admin_organizer_ids));
    
    -- Delete organizer team members (except admin's team)
    DELETE FROM organizer_team_members 
    WHERE organizer_id NOT IN (SELECT unnest(admin_organizer_ids));
    
    -- Delete bank accounts (except admin's)
    DELETE FROM bank_accounts 
    WHERE organizer_id NOT IN (SELECT unnest(admin_organizer_ids));
    
    -- Delete external platform connections (except admin's)
    DELETE FROM external_platform_connections 
    WHERE organizer_id NOT IN (SELECT unnest(admin_organizer_ids));
    
    -- Delete organizers (except admin)
    DELETE FROM organizers 
    WHERE id NOT IN (SELECT unnest(admin_organizer_ids))
    AND user_id NOT IN (SELECT unnest(admin_user_ids));
    
    -- Delete profiles (except admin)
    DELETE FROM profiles 
    WHERE id NOT IN (SELECT unnest(admin_user_ids));
    
    -- Delete users from auth.users (except admin)
    -- NOTE: This requires service role access
    DELETE FROM auth.users 
    WHERE id NOT IN (SELECT unnest(admin_user_ids));
    
    RAISE NOTICE 'Phase 5 complete.';
    
    -- ========================================================================
    -- PHASE 6: Reset sequences/counters if needed
    -- ========================================================================
    
    RAISE NOTICE 'Phase 6: Cleanup complete!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  - Preserved users: %', array_length(admin_user_ids, 1);
    RAISE NOTICE '  - Preserved organizers: %', array_length(admin_organizer_ids, 1);
    RAISE NOTICE '=========================================';
    
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify cleanup)
-- ============================================================================

-- Check remaining users
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
SELECT 'Transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'Contacts', COUNT(*) FROM contacts;
