-- ============================================
-- PUSH NOTIFICATIONS SCHEMA
-- ============================================
-- Web Push Notification support for event reminders and marketing
-- ============================================

-- ============================================
-- 1. PUSH SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Web Push subscription object (endpoint, keys, etc.)
    subscription JSONB NOT NULL,
    endpoint TEXT GENERATED ALWAYS AS (subscription->>'endpoint') STORED,
    
    -- Device info
    device_type VARCHAR(50), -- 'desktop', 'mobile', 'tablet'
    browser VARCHAR(100),
    operating_system VARCHAR(100),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Preferences
    notify_event_reminders BOOLEAN DEFAULT true,
    notify_ticket_updates BOOLEAN DEFAULT true,
    notify_marketing BOOLEAN DEFAULT true,
    notify_followed_organizers BOOLEAN DEFAULT true,
    
    -- Tracking
    last_used_at TIMESTAMPTZ,
    failed_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions(is_active) WHERE is_active = true;

-- ============================================
-- 2. PUSH NOTIFICATION LOG
-- ============================================
CREATE TABLE IF NOT EXISTS public.push_notification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID REFERENCES public.push_subscriptions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Notification content
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    icon VARCHAR(500),
    image VARCHAR(500),
    url VARCHAR(500),
    
    -- Type
    notification_type VARCHAR(100), -- 'event_reminder', 'ticket_purchase', 'marketing', etc.
    
    -- References
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    organizer_id UUID REFERENCES public.organizers(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES public.communication_campaigns(id) ON DELETE SET NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'clicked'
    error_message TEXT,
    
    -- Tracking
    sent_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_log_user ON public.push_notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_push_log_event ON public.push_notification_log(event_id);
CREATE INDEX IF NOT EXISTS idx_push_log_status ON public.push_notification_log(status);

-- ============================================
-- 3. ADD TELEGRAM CHAT ID TO PROFILES
-- ============================================
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

-- ============================================
-- 4. RLS POLICIES
-- ============================================

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notification_log ENABLE ROW LEVEL SECURITY;

-- Users manage their own subscriptions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'push_subs_user_access') THEN
        CREATE POLICY push_subs_user_access ON public.push_subscriptions
            FOR ALL USING (user_id = auth.uid());
    END IF;
END $$;

-- Users see their own notifications
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'push_notification_log' AND policyname = 'push_log_user_access') THEN
        CREATE POLICY push_log_user_access ON public.push_notification_log
            FOR SELECT USING (user_id = auth.uid());
    END IF;
END $$;

-- ============================================
-- 5. FUNCTION TO REGISTER PUSH SUBSCRIPTION
-- ============================================
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
    
    -- Upsert subscription
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

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.push_subscriptions IS 'Web Push notification subscriptions per user device';
COMMENT ON TABLE public.push_notification_log IS 'Log of all push notifications sent';
COMMENT ON FUNCTION register_push_subscription IS 'Register or update a push subscription for a user';
