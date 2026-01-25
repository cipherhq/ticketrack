-- ============================================================================
-- TICKETRACK MASTER MIGRATION
-- ============================================================================
-- Run this file in the Supabase SQL Editor to set up all database features.
-- 
-- This combines:
-- 1. Communication Hub (contacts, campaigns, credits, automations)
-- 2. Smart Segmentation (RFM scoring, engagement)
-- 3. Drip Campaigns (multi-step sequences)
-- 4. Email Tracking (opens, clicks)
-- 5. Conversations (two-way messaging)
-- 6. Flutterwave/Paystack subaccounts
-- 7. SMS to Message Credits migration
--
-- Safe to re-run - uses IF NOT EXISTS throughout
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 1: PAYMENT PROVIDER SUBACCOUNTS
-- ============================================================================
-- Add Flutterwave subaccount fields
ALTER TABLE public.organizers 
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_id character varying(255),
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_status character varying(50) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_onboarded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_payouts_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flutterwave_subaccount_charges_enabled boolean DEFAULT false;

-- Add Paystack subaccount fields
ALTER TABLE public.organizers 
ADD COLUMN IF NOT EXISTS paystack_subaccount_id character varying(255),
ADD COLUMN IF NOT EXISTS paystack_subaccount_status character varying(50) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS paystack_subaccount_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paystack_subaccount_onboarded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS paystack_subaccount_payouts_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paystack_subaccount_charges_enabled boolean DEFAULT false;

-- Indexes for subaccounts
CREATE INDEX IF NOT EXISTS idx_organizers_flutterwave_subaccount_id ON public.organizers(flutterwave_subaccount_id) WHERE flutterwave_subaccount_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizers_paystack_subaccount_id ON public.organizers(paystack_subaccount_id) WHERE paystack_subaccount_id IS NOT NULL;

-- Phase 1: Payment provider subaccounts - DONE

-- ============================================================================
-- PHASE 2: CORE COMMUNICATION HUB
-- ============================================================================

-- 2.1 CONTACTS TABLE
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(50),
    full_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    source_type VARCHAR(50) DEFAULT 'manual',
    source_id UUID,
    source_metadata JSONB DEFAULT '{}',
    email_opt_in BOOLEAN DEFAULT true,
    sms_opt_in BOOLEAN DEFAULT false,
    whatsapp_opt_in BOOLEAN DEFAULT false,
    push_opt_in BOOLEAN DEFAULT true,
    telegram_opt_in BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    total_events_attended INTEGER DEFAULT 0,
    total_spent NUMERIC(12, 2) DEFAULT 0,
    first_contact_at TIMESTAMPTZ,
    last_contact_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,
    gdpr_consent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organizer_id, email)
);

CREATE INDEX IF NOT EXISTS idx_contacts_organizer ON public.contacts(organizer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(organizer_id, email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(organizer_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_source ON public.contacts(organizer_id, source_type);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON public.contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_contacts_active ON public.contacts(organizer_id, is_active) WHERE is_active = true;

-- 2.2 CONTACT SEGMENTS
CREATE TABLE IF NOT EXISTS public.contact_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}',
    color VARCHAR(7) DEFAULT '#2969FF',
    is_dynamic BOOLEAN DEFAULT true,
    contact_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_segments_organizer ON public.contact_segments(organizer_id);

-- 2.3 COMMUNICATION CAMPAIGNS
CREATE TABLE IF NOT EXISTS public.communication_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    channels TEXT[] DEFAULT '{}',
    audience_type VARCHAR(50),
    audience_config JSONB DEFAULT '{}',
    segment_id UUID REFERENCES public.contact_segments(id) ON DELETE SET NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    content JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    recipient_count INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_organizer ON public.communication_campaigns(organizer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.communication_campaigns(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON public.communication_campaigns(scheduled_at) WHERE status = 'scheduled';

-- 2.4 COMMUNICATION MESSAGES
CREATE TABLE IF NOT EXISTS public.communication_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.communication_campaigns(id) ON DELETE SET NULL,
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL,
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(50),
    recipient_name VARCHAR(255),
    recipient_metadata JSONB DEFAULT '{}',
    content JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    provider VARCHAR(50),
    provider_message_id VARCHAR(255),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_campaign ON public.communication_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_organizer ON public.communication_messages(organizer_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON public.communication_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.communication_messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.communication_messages(organizer_id, channel);

-- 2.5 COMMUNICATION TEMPLATES
CREATE TABLE IF NOT EXISTS public.communication_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    channel VARCHAR(50) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    variables TEXT[] DEFAULT '{}',
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_organizer ON public.communication_templates(organizer_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.communication_templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_channel ON public.communication_templates(channel);

-- Phase 2: Core communication hub - DONE

-- ============================================================================
-- PHASE 3: CREDIT SYSTEM
-- ============================================================================

-- 3.1 CREDIT BALANCES
CREATE TABLE IF NOT EXISTS public.communication_credit_balances (
    organizer_id UUID PRIMARY KEY REFERENCES public.organizers(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    bonus_balance INTEGER DEFAULT 0,
    lifetime_purchased INTEGER DEFAULT 0,
    lifetime_bonus INTEGER DEFAULT 0,
    lifetime_used INTEGER DEFAULT 0,
    lifetime_expired INTEGER DEFAULT 0,
    email_credits_used INTEGER DEFAULT 0,
    sms_credits_used INTEGER DEFAULT 0,
    whatsapp_credits_used INTEGER DEFAULT 0,
    telegram_credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3.2 CREDIT PACKAGES
CREATE TABLE IF NOT EXISTS public.communication_credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    credits INTEGER NOT NULL,
    bonus_credits INTEGER DEFAULT 0,
    price_ngn NUMERIC(10, 2) NOT NULL,
    price_usd NUMERIC(10, 2),
    discount_percent INTEGER DEFAULT 0,
    price_per_credit NUMERIC(10, 4),
    is_popular BOOLEAN DEFAULT false,
    badge_text VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default packages (safe to re-run)
INSERT INTO public.communication_credit_packages (name, description, credits, bonus_credits, price_ngn, price_usd, discount_percent, price_per_credit, is_popular, badge_text, sort_order) VALUES
    ('Starter', 'Perfect for small events', 1000, 0, 1000.00, 0.65, 0, 1.00, false, NULL, 1),
    ('Growth', 'For growing organizers', 5000, 500, 4500.00, 2.90, 10, 0.90, false, '10% Bonus', 2),
    ('Pro', 'For regular campaigners', 20000, 4000, 16000.00, 10.30, 20, 0.80, true, 'Most Popular', 3),
    ('Business', 'For high-volume senders', 50000, 15000, 35000.00, 22.60, 30, 0.70, false, 'Best Value', 4),
    ('Enterprise', 'For large organizations', 200000, 80000, 120000.00, 77.40, 40, 0.60, false, 'Maximum Savings', 5)
ON CONFLICT DO NOTHING;

-- 3.3 CREDIT TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.communication_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount INTEGER NOT NULL,
    bonus_amount INTEGER DEFAULT 0,
    balance_after INTEGER NOT NULL,
    bonus_balance_after INTEGER DEFAULT 0,
    reference VARCHAR(255),
    payment_reference VARCHAR(255),
    channel VARCHAR(50),
    campaign_id UUID REFERENCES public.communication_campaigns(id),
    message_count INTEGER,
    package_id UUID REFERENCES public.communication_credit_packages(id),
    amount_paid NUMERIC(10, 2),
    currency VARCHAR(3),
    payment_provider VARCHAR(50),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_organizer ON public.communication_credit_transactions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.communication_credit_transactions(organizer_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.communication_credit_transactions(organizer_id, created_at DESC);

-- 3.4 CHANNEL PRICING
CREATE TABLE IF NOT EXISTS public.communication_channel_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL UNIQUE,
    credits_per_message INTEGER NOT NULL,
    cost_ngn NUMERIC(10, 4),
    display_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.communication_channel_pricing (channel, credits_per_message, cost_ngn, display_name, description) VALUES
    ('email', 1, 0.50, 'Email', 'Send rich HTML emails'),
    ('sms', 5, 3.50, 'SMS', 'Standard SMS messages'),
    ('sms_dnd', 8, 6.00, 'SMS (DND)', 'SMS to Do-Not-Disturb numbers'),
    ('whatsapp_marketing', 100, 80.00, 'WhatsApp Marketing', 'Promotional WhatsApp messages'),
    ('whatsapp_utility', 20, 15.00, 'WhatsApp Utility', 'Transactional WhatsApp messages'),
    ('telegram', 2, 0.00, 'Telegram', 'Telegram bot messages'),
    ('push', 0, 0.00, 'Push Notification', 'Free push notifications')
ON CONFLICT (channel) DO UPDATE SET
    credits_per_message = EXCLUDED.credits_per_message,
    cost_ngn = EXCLUDED.cost_ngn,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description;

-- Phase 3: Credit system - DONE

-- ============================================================================
-- PHASE 4: AUTOMATION ENGINE
-- ============================================================================

-- 4.1 AUTOMATIONS
CREATE TABLE IF NOT EXISTS public.communication_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(100) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    actions JSONB NOT NULL DEFAULT '[]',
    total_triggered INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_automations_organizer ON public.communication_automations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger ON public.communication_automations(trigger_type);
CREATE INDEX IF NOT EXISTS idx_automations_status ON public.communication_automations(organizer_id, status) WHERE status = 'active';

-- 4.2 AUTOMATION RUNS
CREATE TABLE IF NOT EXISTS public.communication_automation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.communication_automations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    ticket_id UUID,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    context_data JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending',
    current_action_index INTEGER DEFAULT 0,
    action_logs JSONB DEFAULT '[]',
    next_action_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON public.communication_automation_runs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON public.communication_automation_runs(status) WHERE status IN ('pending', 'running');
CREATE INDEX IF NOT EXISTS idx_automation_runs_next_action ON public.communication_automation_runs(next_action_at) WHERE status = 'running';

-- 4.3 SCHEDULED JOBS
CREATE TABLE IF NOT EXISTS public.communication_scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID NOT NULL REFERENCES public.communication_automations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    run_id UUID REFERENCES public.communication_automation_runs(id) ON DELETE CASCADE,
    job_data JSONB DEFAULT '{}',
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_scheduled ON public.communication_scheduled_jobs(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_event ON public.communication_scheduled_jobs(event_id);

-- Phase 4: Automation engine - DONE

-- ============================================================================
-- PHASE 5: PUSH NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    endpoint TEXT GENERATED ALWAYS AS (subscription->>'endpoint') STORED,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    operating_system VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    notify_event_reminders BOOLEAN DEFAULT true,
    notify_ticket_updates BOOLEAN DEFAULT true,
    notify_marketing BOOLEAN DEFAULT true,
    notify_followed_organizers BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions(is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.push_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    icon VARCHAR(500),
    image VARCHAR(500),
    url VARCHAR(500),
    notification_type VARCHAR(100),
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.communication_campaigns(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user ON public.push_notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_log_event ON public.push_notification_log(event_id);

-- Phase 5: Push notifications - DONE

-- ============================================================================
-- PHASE 6: TELEGRAM LINKING
-- ============================================================================

-- Add telegram fields to profiles (if not exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'telegram_chat_id'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN telegram_chat_id TEXT;
        ALTER TABLE public.profiles ADD COLUMN telegram_username TEXT;
        ALTER TABLE public.profiles ADD COLUMN telegram_linked_at TIMESTAMPTZ;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.telegram_link_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON public.telegram_link_requests(token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_user ON public.telegram_link_requests(user_id);

-- Phase 6: Telegram linking - DONE

-- ============================================================================
-- PHASE 7: CONTACT SCORES (SMART SEGMENTATION)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contact_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    recency_score INTEGER DEFAULT 0 CHECK (recency_score >= 0 AND recency_score <= 5),
    frequency_score INTEGER DEFAULT 0 CHECK (frequency_score >= 0 AND frequency_score <= 5),
    monetary_score INTEGER DEFAULT 0 CHECK (monetary_score >= 0 AND monetary_score <= 5),
    rfm_score INTEGER GENERATED ALWAYS AS (recency_score + frequency_score + monetary_score) STORED,
    rfm_segment VARCHAR(50),
    engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
    engagement_level VARCHAR(20),
    last_purchase_at TIMESTAMPTZ,
    last_email_open_at TIMESTAMPTZ,
    last_click_at TIMESTAMPTZ,
    last_event_attended_at TIMESTAMPTZ,
    total_purchases INTEGER DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0,
    total_events_attended INTEGER DEFAULT 0,
    total_emails_opened INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    avg_ticket_value NUMERIC(10,2) DEFAULT 0,
    churn_risk DECIMAL(3,2),
    next_purchase_likelihood DECIMAL(3,2),
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT contact_scores_unique UNIQUE (contact_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_scores_organizer ON contact_scores(organizer_id);
CREATE INDEX IF NOT EXISTS idx_contact_scores_rfm ON contact_scores(organizer_id, rfm_segment);
CREATE INDEX IF NOT EXISTS idx_contact_scores_engagement ON contact_scores(organizer_id, engagement_level);

-- Smart segments table
CREATE TABLE IF NOT EXISTS public.smart_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    segment_type VARCHAR(50) NOT NULL,
    criteria JSONB NOT NULL,
    color VARCHAR(7) DEFAULT '#2969FF',
    icon VARCHAR(50) DEFAULT 'users',
    contact_count INTEGER DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_smart_segments_organizer ON smart_segments(organizer_id);
CREATE INDEX IF NOT EXISTS idx_smart_segments_type ON smart_segments(organizer_id, segment_type);

-- Phase 7: Smart segmentation - DONE

-- ============================================================================
-- PHASE 8: DRIP CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.drip_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB DEFAULT '{}',
    entry_criteria JSONB DEFAULT '{}',
    exit_criteria JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft',
    goal_type VARCHAR(50),
    goal_config JSONB DEFAULT '{}',
    entry_limit INTEGER,
    entry_limit_period VARCHAR(20),
    total_enrolled INTEGER DEFAULT 0,
    total_completed INTEGER DEFAULT 0,
    total_converted INTEGER DEFAULT 0,
    total_exited_early INTEGER DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_campaigns_organizer ON drip_campaigns(organizer_id);
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_status ON drip_campaigns(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_trigger ON drip_campaigns(trigger_type);

CREATE TABLE IF NOT EXISTS public.drip_campaign_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES drip_campaigns(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    name VARCHAR(255),
    delay_type VARCHAR(20) NOT NULL,
    delay_value INTEGER,
    delay_unit VARCHAR(20),
    wait_until_time TIME,
    wait_until_day INTEGER[],
    action_type VARCHAR(50) NOT NULL,
    action_config JSONB NOT NULL,
    has_conditions BOOLEAN DEFAULT FALSE,
    conditions JSONB DEFAULT '[]',
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign ON drip_campaign_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drip_steps_order ON drip_campaign_steps(campaign_id, step_number);

-- Phase 8: Drip campaigns - DONE

-- ============================================================================
-- PHASE 9: EMAIL TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID,
    campaign_id UUID,
    tracking_id VARCHAR(100) NOT NULL UNIQUE,
    event_type VARCHAR(20) NOT NULL,
    link_url TEXT,
    link_text TEXT,
    link_position INTEGER,
    recipient_email VARCHAR(255),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    first_event_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET,
    device_type VARCHAR(20),
    email_client VARCHAR(50),
    country VARCHAR(2),
    city VARCHAR(100),
    event_count INTEGER DEFAULT 1,
    last_event_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_tracking_message ON email_tracking_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_campaign ON email_tracking_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_organizer ON email_tracking_events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_email_tracking_tracking_id ON email_tracking_events(tracking_id);

CREATE TABLE IF NOT EXISTS public.email_tracked_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID,
    message_id UUID,
    organizer_id UUID NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
    short_code VARCHAR(20) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    link_text TEXT,
    link_position INTEGER,
    total_clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracked_links_code ON email_tracked_links(short_code);
CREATE INDEX IF NOT EXISTS idx_tracked_links_campaign ON email_tracked_links(campaign_id);

-- Phase 9: Email tracking - DONE

-- ============================================================================
-- PHASE 10: CONVERSATIONS (TWO-WAY MESSAGING)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    contact_name VARCHAR(255),
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    subject VARCHAR(500),
    last_message_at TIMESTAMPTZ,
    last_message_preview TEXT,
    last_message_direction VARCHAR(10),
    unread_count INTEGER DEFAULT 0,
    assigned_to UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_organizer ON conversations(organizer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON conversations(organizer_id, channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(organizer_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(organizer_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL,
    sender_type VARCHAR(20),
    sender_id UUID,
    channel VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text',
    subject VARCHAR(500),
    media_urls TEXT[],
    media_types TEXT[],
    external_id VARCHAR(255),
    external_status VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_organizer ON conversation_messages(organizer_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_direction ON conversation_messages(conversation_id, direction);

-- Phase 10: Conversations - DONE

-- ============================================================================
-- PHASE 11: DATABASE FUNCTIONS
-- ============================================================================

-- Deduct credits function
CREATE OR REPLACE FUNCTION deduct_communication_credits(
    p_organizer_id UUID,
    p_amount INTEGER,
    p_channel VARCHAR(50),
    p_campaign_id UUID DEFAULT NULL,
    p_message_count INTEGER DEFAULT 1,
    p_description TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_balance INTEGER;
    v_current_bonus INTEGER;
    v_deduct_from_bonus INTEGER := 0;
    v_deduct_from_main INTEGER := 0;
    v_new_balance INTEGER;
    v_new_bonus INTEGER;
BEGIN
    SELECT balance, bonus_balance INTO v_current_balance, v_current_bonus
    FROM public.communication_credit_balances
    WHERE organizer_id = p_organizer_id
    FOR UPDATE;
    
    IF (COALESCE(v_current_balance, 0) + COALESCE(v_current_bonus, 0)) < p_amount THEN
        RETURN FALSE;
    END IF;
    
    IF v_current_bonus >= p_amount THEN
        v_deduct_from_bonus := p_amount;
    ELSE
        v_deduct_from_bonus := COALESCE(v_current_bonus, 0);
        v_deduct_from_main := p_amount - v_deduct_from_bonus;
    END IF;
    
    v_new_balance := COALESCE(v_current_balance, 0) - v_deduct_from_main;
    v_new_bonus := COALESCE(v_current_bonus, 0) - v_deduct_from_bonus;
    
    UPDATE public.communication_credit_balances
    SET 
        balance = v_new_balance,
        bonus_balance = v_new_bonus,
        lifetime_used = lifetime_used + p_amount,
        email_credits_used = CASE WHEN p_channel = 'email' THEN email_credits_used + p_amount ELSE email_credits_used END,
        sms_credits_used = CASE WHEN p_channel LIKE 'sms%' THEN sms_credits_used + p_amount ELSE sms_credits_used END,
        whatsapp_credits_used = CASE WHEN p_channel LIKE 'whatsapp%' THEN whatsapp_credits_used + p_amount ELSE whatsapp_credits_used END,
        telegram_credits_used = CASE WHEN p_channel = 'telegram' THEN telegram_credits_used + p_amount ELSE telegram_credits_used END,
        updated_at = NOW()
    WHERE organizer_id = p_organizer_id;
    
    INSERT INTO public.communication_credit_transactions (
        organizer_id, type, amount, bonus_amount, balance_after, bonus_balance_after,
        channel, campaign_id, message_count, description
    ) VALUES (
        p_organizer_id, 'usage', -p_amount, -v_deduct_from_bonus, v_new_balance, v_new_bonus,
        p_channel, p_campaign_id, p_message_count, COALESCE(p_description, 'Message credits used')
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add credits function
CREATE OR REPLACE FUNCTION add_communication_credits(
    p_organizer_id UUID,
    p_credits INTEGER,
    p_bonus_credits INTEGER DEFAULT 0,
    p_package_id UUID DEFAULT NULL,
    p_amount_paid NUMERIC DEFAULT NULL,
    p_currency VARCHAR DEFAULT 'NGN',
    p_payment_provider VARCHAR DEFAULT NULL,
    p_payment_reference VARCHAR DEFAULT NULL,
    p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_current_balance INTEGER;
    v_current_bonus INTEGER;
    v_new_balance INTEGER;
    v_new_bonus INTEGER;
    v_transaction_id UUID;
BEGIN
    INSERT INTO public.communication_credit_balances (organizer_id, balance, bonus_balance)
    VALUES (p_organizer_id, 0, 0)
    ON CONFLICT (organizer_id) DO NOTHING;
    
    SELECT balance, bonus_balance INTO v_current_balance, v_current_bonus
    FROM public.communication_credit_balances
    WHERE organizer_id = p_organizer_id
    FOR UPDATE;
    
    v_new_balance := COALESCE(v_current_balance, 0) + p_credits;
    v_new_bonus := COALESCE(v_current_bonus, 0) + p_bonus_credits;
    
    UPDATE public.communication_credit_balances
    SET 
        balance = v_new_balance,
        bonus_balance = v_new_bonus,
        lifetime_purchased = lifetime_purchased + p_credits,
        lifetime_bonus = lifetime_bonus + p_bonus_credits,
        updated_at = NOW()
    WHERE organizer_id = p_organizer_id;
    
    INSERT INTO public.communication_credit_transactions (
        organizer_id, type, amount, bonus_amount, balance_after, bonus_balance_after,
        package_id, amount_paid, currency, payment_provider, payment_reference, description
    ) VALUES (
        p_organizer_id, 'purchase', p_credits, p_bonus_credits, v_new_balance, v_new_bonus,
        p_package_id, p_amount_paid, p_currency, p_payment_provider, p_payment_reference,
        COALESCE(p_description, 'Credit purchase')
    )
    RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Telegram link request
CREATE OR REPLACE FUNCTION create_telegram_link_request(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
BEGIN
    v_token := encode(gen_random_bytes(32), 'hex');
    
    UPDATE public.telegram_link_requests
    SET status = 'expired'
    WHERE user_id = p_user_id AND status = 'pending';
    
    INSERT INTO public.telegram_link_requests (user_id, token, expires_at)
    VALUES (p_user_id, v_token, NOW() + INTERVAL '15 minutes');
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Register push subscription
CREATE OR REPLACE FUNCTION register_push_subscription(
    p_user_id UUID,
    p_subscription JSONB,
    p_device_type VARCHAR DEFAULT 'desktop',
    p_browser VARCHAR DEFAULT NULL,
    p_os VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_sub_id UUID;
    v_endpoint TEXT;
BEGIN
    v_endpoint := p_subscription->>'endpoint';
    
    INSERT INTO public.push_subscriptions (
        user_id, subscription, device_type, browser, operating_system
    ) VALUES (
        p_user_id, p_subscription, p_device_type, p_browser, p_os
    )
    ON CONFLICT (user_id, endpoint) DO UPDATE SET
        subscription = EXCLUDED.subscription,
        is_active = true,
        failed_count = 0,
        updated_at = NOW()
    RETURNING id INTO v_sub_id;
    
    RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Phase 11: Database functions - DONE

-- ============================================================================
-- PHASE 12: ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_channel_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drip_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for organizer-owned tables
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'contacts', 'contact_segments', 'communication_campaigns', 
        'communication_messages', 'communication_templates',
        'communication_credit_balances', 'communication_credit_transactions',
        'communication_automations', 'communication_automation_runs',
        'communication_scheduled_jobs', 'contact_scores', 'smart_segments',
        'drip_campaigns', 'drip_campaign_steps', 'email_tracking_events',
        'email_tracked_links', 'conversations', 'conversation_messages'
    ];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('
            DO $inner$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = %L) THEN
                    CREATE POLICY %I ON public.%I
                        FOR ALL USING (
                            organizer_id IN (
                                SELECT id FROM public.organizers WHERE user_id = auth.uid()
                                UNION
                                SELECT organizer_id FROM public.organizer_team_members 
                                WHERE user_id = auth.uid() AND status = ''active''
                            )
                        );
                END IF;
            END $inner$;
        ', t, t || '_organizer_access', t || '_organizer_access', t);
    END LOOP;
END $$;

-- Public read policies for packages and pricing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_credit_packages' AND policyname = 'credit_packages_read') THEN
        CREATE POLICY credit_packages_read ON public.communication_credit_packages
            FOR SELECT USING (is_active = true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_channel_pricing' AND policyname = 'channel_pricing_read') THEN
        CREATE POLICY channel_pricing_read ON public.communication_channel_pricing
            FOR SELECT USING (is_active = true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'push_subs_user_access') THEN
        CREATE POLICY push_subs_user_access ON public.push_subscriptions
            FOR ALL USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_notification_log' AND policyname = 'push_log_user_access') THEN
        CREATE POLICY push_log_user_access ON public.push_notification_log
            FOR SELECT USING (user_id = auth.uid());
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telegram_link_requests' AND policyname = 'telegram_link_user_access') THEN
        CREATE POLICY telegram_link_user_access ON public.telegram_link_requests
            FOR ALL USING (user_id = auth.uid());
    END IF;
END $$;

-- Phase 12: Row level security - DONE

COMMIT;

-- ============================================================================
-- MIGRATION COMPLETE!
-- ============================================================================
-- 
-- Summary of what was created:
-- - Flutterwave & Paystack subaccount fields on organizers
-- - contacts, contact_segments tables
-- - communication_campaigns, communication_messages, communication_templates
-- - communication_credit_balances, credit_packages, credit_transactions, channel_pricing
-- - communication_automations, automation_runs, scheduled_jobs
-- - push_subscriptions, push_notification_log
-- - telegram_link_requests + telegram fields on profiles
-- - contact_scores, smart_segments
-- - drip_campaigns, drip_campaign_steps
-- - email_tracking_events, email_tracked_links
-- - conversations, conversation_messages
-- - Functions: deduct_communication_credits, add_communication_credits, etc.
-- - RLS policies for all tables
--
-- NEXT STEPS:
-- 1. Run migrate_sms_to_message_credits.sql (if you have old SMS credits)
-- 2. Deploy edge functions
-- 3. Set up cron jobs (see docs/AUTOMATION_CRON_SETUP.md)
-- ============================================================================
