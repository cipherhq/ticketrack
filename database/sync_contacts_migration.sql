-- ============================================
-- CONTACT SYNC MIGRATION
-- ============================================
-- This script syncs existing data from tickets and followers
-- into the unified contacts table for the Communication Hub
-- ============================================
-- 
-- PREREQUISITE: Run communication_hub_schema.sql FIRST!
-- That script creates the contacts table and other required tables.
-- ============================================

-- ============================================
-- 1. SYNC CONTACTS FROM COMPLETED TICKETS
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        INSERT INTO public.contacts (
            organizer_id,
            email,
            phone,
            full_name,
            source_type,
            source_id,
            source_metadata,
            email_opt_in,
            sms_opt_in,
            whatsapp_opt_in,
            first_contact_at,
            last_contact_at,
            total_events_attended,
            total_spent
        )
        SELECT DISTINCT ON (e.organizer_id, t.attendee_email)
            e.organizer_id,
            t.attendee_email,
            t.attendee_phone,
            t.attendee_name,
            'ticket',
            t.id,
            jsonb_build_object(
                'event_id', t.event_id,
                'ticket_type_id', t.ticket_type_id,
                'order_id', t.order_id,
                'first_event_title', e.title
            ),
            true, -- email_opt_in default to true (user agreed to terms at checkout)
            true, -- sms_opt_in default to true (user agreed to terms at checkout)
            true  -- whatsapp_opt_in default to true (user agreed to terms at checkout)
            MIN(t.created_at) OVER (PARTITION BY e.organizer_id, t.attendee_email),
            MAX(t.created_at) OVER (PARTITION BY e.organizer_id, t.attendee_email),
            COUNT(*) OVER (PARTITION BY e.organizer_id, t.attendee_email),
            COALESCE(SUM(t.total_price) OVER (PARTITION BY e.organizer_id, t.attendee_email), 0)
        FROM public.tickets t
        JOIN public.events e ON t.event_id = e.id
        WHERE t.payment_status = 'completed'
            AND t.attendee_email IS NOT NULL
            AND e.organizer_id IS NOT NULL
        ON CONFLICT (organizer_id, source_type, source_id) 
        DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            full_name = EXCLUDED.full_name,
            last_contact_at = GREATEST(contacts.last_contact_at, EXCLUDED.last_contact_at),
            total_events_attended = EXCLUDED.total_events_attended,
            total_spent = EXCLUDED.total_spent,
            updated_at = NOW();
        
        RAISE NOTICE 'Synced contacts from tickets';
    ELSE
        RAISE NOTICE 'tickets table does not exist, skipping';
    END IF;
END $$;

-- ============================================
-- 2. SYNC CONTACTS FROM FOLLOWERS
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'followers') THEN
        INSERT INTO public.contacts (
            organizer_id,
            email,
            phone,
            full_name,
            source_type,
            source_id,
            email_opt_in,
            sms_opt_in,
            whatsapp_opt_in,
            first_contact_at,
            last_contact_at
        )
        SELECT 
            f.organizer_id,
            p.email,
            p.phone,
            p.full_name,
            'follower',
            f.id,
            true, -- email_opt_in default to true (user followed organizer = consent)
            true, -- sms_opt_in default to true
            true, -- whatsapp_opt_in default to true
            f.created_at,
            f.created_at
        FROM public.followers f
        JOIN public.profiles p ON f.user_id = p.id
        WHERE p.email IS NOT NULL
            AND f.organizer_id IS NOT NULL
        ON CONFLICT (organizer_id, source_type, source_id) 
        DO UPDATE SET
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            full_name = EXCLUDED.full_name,
            updated_at = NOW();
        
        RAISE NOTICE 'Synced contacts from followers';
    ELSE
        RAISE NOTICE 'followers table does not exist, skipping';
    END IF;
END $$;

-- ============================================
-- 3. SYNC CONTACTS FROM TEAM MEMBERS
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizer_team_members') THEN
        INSERT INTO public.contacts (
            organizer_id,
            email,
            full_name,
            source_type,
            source_id,
            email_opt_in,
            first_contact_at,
            last_contact_at
        )
        SELECT 
            tm.organizer_id,
            tm.email,
            tm.name,
            'team',
            tm.id,
            true,
            tm.created_at,
            tm.created_at
        FROM public.organizer_team_members tm
        WHERE tm.email IS NOT NULL
            AND tm.organizer_id IS NOT NULL
            AND tm.status IN ('active', 'pending')
        ON CONFLICT (organizer_id, source_type, source_id) 
        DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            updated_at = NOW();
        
        RAISE NOTICE 'Synced contacts from team members';
    ELSE
        RAISE NOTICE 'organizer_team_members table does not exist, skipping';
    END IF;
END $$;

-- ============================================
-- 4. UPDATE CONTACT COUNTS IN SEGMENTS
-- ============================================
-- This updates the contact_count for any existing segments
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_segments') THEN
        UPDATE public.contact_segments cs
        SET 
            contact_count = (
                SELECT COUNT(*) 
                FROM public.contacts c 
                WHERE c.organizer_id = cs.organizer_id 
                    AND c.is_active = true
                    AND (
                        cs.criteria->>'tags' IS NULL 
                        OR c.tags && ARRAY(SELECT jsonb_array_elements_text(cs.criteria->'tags'))
                    )
            ),
            last_calculated_at = NOW()
        WHERE cs.is_dynamic = true;
        
        RAISE NOTICE 'Updated contact counts in segments';
    END IF;
END $$;

-- ============================================
-- 5. CREATE DEFAULT SEGMENTS FOR ORGANIZERS
-- ============================================
DO $$
BEGIN
    -- Check if contact_segments table exists (created by communication_hub_schema.sql)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_segments') THEN
        RAISE NOTICE 'contact_segments table does not exist. Please run communication_hub_schema.sql first!';
        RETURN;
    END IF;

    -- Create an "All Contacts" segment for each organizer
    INSERT INTO public.contact_segments (
        organizer_id,
        name,
        description,
        criteria,
        is_dynamic,
        color
    )
    SELECT DISTINCT 
        id,
        'All Contacts',
        'All contacts in your database',
        '{"all": true}'::jsonb,
        true,
        '#2969FF'
    FROM public.organizers
    WHERE id NOT IN (
        SELECT organizer_id 
        FROM public.contact_segments 
        WHERE name = 'All Contacts'
    )
    ON CONFLICT DO NOTHING;

    -- Create "Recent Buyers" segment
    INSERT INTO public.contact_segments (
        organizer_id,
        name,
        description,
        criteria,
        is_dynamic,
        color
    )
    SELECT DISTINCT 
        id,
        'Recent Buyers',
        'Contacts who purchased in the last 30 days',
        '{"source_type": "ticket", "last_contact_days": 30}'::jsonb,
        true,
        '#10B981'
    FROM public.organizers
    WHERE id NOT IN (
        SELECT organizer_id 
        FROM public.contact_segments 
        WHERE name = 'Recent Buyers'
    )
    ON CONFLICT DO NOTHING;

    -- Create "VIP" segment (high spenders)
    INSERT INTO public.contact_segments (
        organizer_id,
        name,
        description,
        criteria,
        is_dynamic,
        color
    )
    SELECT DISTINCT 
        id,
        'VIP',
        'High-value customers (3+ events attended)',
        '{"events_attended_min": 3}'::jsonb,
        true,
        '#F59E0B'
    FROM public.organizers
    WHERE id NOT IN (
        SELECT organizer_id 
        FROM public.contact_segments 
        WHERE name = 'VIP'
    )
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Created default segments';
END $$;

-- ============================================
-- 6. MIGRATE LEGACY EMAIL CAMPAIGNS
-- ============================================
-- Copy legacy email campaigns to new communication_campaigns table
-- Uses DO block to handle case where email_campaigns table doesn't exist
DO $$
BEGIN
    -- Check if email_campaigns table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'email_campaigns') THEN
        INSERT INTO public.communication_campaigns (
            organizer_id,
            name,
            channels,
            content,
            audience_type,
            audience_event_id,
            legacy_email_campaign_id,
            status,
            scheduled_for,
            sent_at,
            total_recipients,
            sent_count,
            created_at,
            updated_at
        )
        SELECT 
            ec.organizer_id,
            COALESCE(ec.name, ec.subject, 'Email Campaign'),
            ARRAY['email']::TEXT[],
            jsonb_build_object(
                'email', jsonb_build_object(
                    'subject', ec.subject,
                    'body', ec.body
                )
            ),
            ec.recipient_type,
            ec.event_id,
            ec.id,
            CASE 
                WHEN ec.status = 'sent' THEN 'sent'
                WHEN ec.status = 'scheduled' THEN 'scheduled'
                ELSE 'draft'
            END,
            ec.scheduled_for,
            ec.sent_at,
            ec.total_recipients,
            ec.total_sent,
            ec.created_at,
            ec.updated_at
        FROM public.email_campaigns ec
        WHERE NOT EXISTS (
            SELECT 1 
            FROM public.communication_campaigns cc 
            WHERE cc.legacy_email_campaign_id = ec.id
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Migrated legacy email campaigns';
    ELSE
        RAISE NOTICE 'email_campaigns table does not exist, skipping migration';
    END IF;
END $$;

-- ============================================
-- 7. MIGRATE LEGACY SMS CAMPAIGNS
-- ============================================
-- Uses DO block to handle case where sms_campaigns table doesn't exist
DO $$
BEGIN
    -- Check if sms_campaigns table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sms_campaigns') THEN
        INSERT INTO public.communication_campaigns (
            organizer_id,
            name,
            channels,
            content,
            audience_type,
            audience_event_id,
            legacy_sms_campaign_id,
            status,
            sent_at,
            total_recipients,
            sent_count,
            created_at,
            updated_at
        )
        SELECT 
            sc.organizer_id,
            COALESCE(sc.name, 'SMS Campaign'),
            ARRAY['sms']::TEXT[],
            jsonb_build_object(
                'sms', jsonb_build_object(
                    'message', sc.message
                )
            ),
            sc.audience_type,
            sc.event_id,
            sc.id,
            CASE 
                WHEN sc.status = 'sent' THEN 'sent'
                WHEN sc.status = 'scheduled' THEN 'scheduled'
                ELSE 'draft'
            END,
            sc.sent_at,
            sc.total_recipients,
            sc.sent_count,
            sc.created_at,
            sc.updated_at
        FROM public.sms_campaigns sc
        WHERE NOT EXISTS (
            SELECT 1 
            FROM public.communication_campaigns cc 
            WHERE cc.legacy_sms_campaign_id = sc.id
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Migrated legacy SMS campaigns';
    ELSE
        RAISE NOTICE 'sms_campaigns table does not exist, skipping migration';
    END IF;
END $$;

-- ============================================
-- 8. UPDATE STATISTICS
-- ============================================
-- Refresh the total contact counts
SELECT 
    organizer_id,
    COUNT(*) as total_contacts,
    COUNT(CASE WHEN email IS NOT NULL THEN 1 END) as with_email,
    COUNT(CASE WHEN phone IS NOT NULL THEN 1 END) as with_phone
FROM public.contacts
WHERE is_active = true
GROUP BY organizer_id;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- The contacts table is now populated with:
-- 1. All ticket purchasers
-- 2. All followers
-- 3. All team members
-- 4. Default segments created
-- 5. Legacy campaigns migrated
-- ============================================
