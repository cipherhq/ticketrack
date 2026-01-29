-- ============================================================================
-- ADD MISSING VIEWS TO DEV DATABASE
-- ============================================================================
-- Run this in Dev Supabase SQL Editor
-- 
-- This adds 4 missing views from production:
-- 1. donation_analytics
-- 2. email_campaign_performance
-- 3. inbox_summary
-- 4. public_organizer_profiles
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: ADD MISSING COLUMNS (if needed)
-- ============================================================================

-- Add missing columns to orders table if they don't exist
DO $$ 
BEGIN
  -- Add is_donation column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'is_donation') THEN
    ALTER TABLE public.orders ADD COLUMN is_donation BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added is_donation column to orders table';
  ELSE
    RAISE NOTICE 'is_donation column already exists';
  END IF;
  
  -- Add payout_status column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'orders' 
                 AND column_name = 'payout_status') THEN
    ALTER TABLE public.orders ADD COLUMN payout_status VARCHAR(50) DEFAULT 'pending';
    RAISE NOTICE 'Added payout_status column to orders table';
  ELSE
    RAISE NOTICE 'payout_status column already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: CREATE VIEWS
-- ============================================================================

-- ============================================================================
-- VIEW 1: donation_analytics
-- ============================================================================
CREATE OR REPLACE VIEW public.donation_analytics AS
 SELECT e.id AS event_id,
    e.title AS event_title,
    e.organizer_id,
    o.business_name AS organizer_name,
    e.currency,
    count(ord.id) AS donation_count,
    COALESCE(sum(ord.total_amount), (0)::numeric) AS total_donations,
    COALESCE(sum(ord.platform_fee), (0)::numeric) AS total_platform_fees,
    COALESCE(sum((ord.total_amount - ord.platform_fee)), (0)::numeric) AS net_donations,
    count(
        CASE
            WHEN ((ord.payout_status)::text = 'completed'::text) THEN 1
            ELSE NULL::integer
        END) AS paid_out_count,
    COALESCE(sum(
        CASE
            WHEN ((ord.payout_status)::text = 'completed'::text) THEN (ord.total_amount - ord.platform_fee)
            ELSE (0)::numeric
        END), (0)::numeric) AS paid_out_amount,
    COALESCE(sum(
        CASE
            WHEN ((ord.payout_status)::text = 'pending'::text) THEN (ord.total_amount - ord.platform_fee)
            ELSE (0)::numeric
        END), (0)::numeric) AS pending_payout_amount
   FROM ((events e
     JOIN organizers o ON ((e.organizer_id = o.id)))
     LEFT JOIN orders ord ON (((ord.event_id = e.id) AND (ord.is_donation = true) AND ((ord.status)::text = 'completed'::text))))
  WHERE (e.is_free = true)
  GROUP BY e.id, e.title, e.organizer_id, o.business_name, e.currency;

-- ============================================================================
-- VIEW 2: email_campaign_performance
-- ============================================================================
-- Only create if email_campaign_analytics table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_schema = 'public' 
               AND table_name = 'email_campaign_analytics') THEN
        EXECUTE 'CREATE OR REPLACE VIEW public.email_campaign_performance AS
                 SELECT c.id AS campaign_id,
                    c.name AS campaign_name,
                    c.organizer_id,
                    c.created_at AS sent_at,
                    COALESCE(a.total_sent, 0) AS total_sent,
                    COALESCE(a.unique_opens, 0) AS unique_opens,
                    COALESCE(a.unique_clicks, 0) AS unique_clicks,
                    COALESCE(a.open_rate, (0)::numeric) AS open_rate,
                    COALESCE(a.click_rate, (0)::numeric) AS click_rate,
                    COALESCE(a.click_to_open_rate, (0)::numeric) AS click_to_open_rate
                   FROM (communication_campaigns c
                     LEFT JOIN email_campaign_analytics a ON ((c.id = a.campaign_id)))
                  WHERE (''email''::text = ANY (c.channels))';
        RAISE NOTICE 'Created view: email_campaign_performance';
    ELSE
        RAISE NOTICE 'Skipped view: email_campaign_performance (table email_campaign_analytics does not exist)';
    END IF;
END $$;

-- ============================================================================
-- VIEW 3: inbox_summary
-- ============================================================================
CREATE OR REPLACE VIEW public.inbox_summary AS
 SELECT organizer_id,
    channel,
    count(*) AS total_conversations,
    count(*) FILTER (WHERE ((status)::text = 'open'::text)) AS open_conversations,
    sum(unread_count) AS total_unread,
    max(last_message_at) AS latest_message
   FROM conversations
  GROUP BY organizer_id, channel;

-- ============================================================================
-- VIEW 4: public_organizer_profiles
-- ============================================================================
CREATE OR REPLACE VIEW public.public_organizer_profiles AS
 SELECT id,
    business_name,
    business_email,
    business_phone,
    description,
    logo_url,
    cover_image_url,
    banner_url,
    website_url,
    website,
    social_twitter,
    social_facebook,
    social_instagram,
    social_linkedin,
    twitter,
    facebook,
    instagram,
    linkedin,
    country_code,
    location,
    is_verified,
    verification_level,
    verified_at,
    is_active,
    total_events,
    total_tickets_sold,
    total_revenue,
    average_rating,
    created_at,
    is_trusted,
    trusted_at
   FROM organizers
  WHERE (is_active = true);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Verify all views were created:
SELECT 
    table_name as view_name
FROM information_schema.views
WHERE table_schema = 'public'
    AND table_name IN (
        'donation_analytics',
        'email_campaign_performance',
        'inbox_summary',
        'public_organizer_profiles'
    )
ORDER BY table_name;

-- ============================================================================
-- NOTE: These views depend on the following tables/views:
-- ============================================================================
-- donation_analytics:
--   - events, organizers, orders
--   - Requires: is_donation column on orders table
--
-- email_campaign_performance:
--   - communication_campaigns
--   - email_campaign_analytics (may need to check if this table/view exists)
--
-- inbox_summary:
--   - conversations
--
-- public_organizer_profiles:
--   - organizers
-- ============================================================================
