-- ============================================
-- COMMUNICATION CREDITS SYSTEM
-- ============================================
-- Credit-based system for messaging (SMS, WhatsApp, Email)
-- 1 Credit = ₦1
-- ============================================

-- ============================================
-- 1. CREDIT BALANCES
-- ============================================
CREATE TABLE IF NOT EXISTS public.communication_credit_balances (
    organizer_id UUID PRIMARY KEY REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Current balance
    balance INTEGER DEFAULT 0,
    bonus_balance INTEGER DEFAULT 0, -- Bonus credits (expire faster)
    
    -- Lifetime stats
    lifetime_purchased INTEGER DEFAULT 0,
    lifetime_bonus INTEGER DEFAULT 0,
    lifetime_used INTEGER DEFAULT 0,
    lifetime_expired INTEGER DEFAULT 0,
    
    -- Usage by channel
    email_credits_used INTEGER DEFAULT 0,
    sms_credits_used INTEGER DEFAULT 0,
    whatsapp_credits_used INTEGER DEFAULT 0,
    telegram_credits_used INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_balances_organizer ON public.communication_credit_balances(organizer_id);

-- ============================================
-- 2. CREDIT PACKAGES
-- ============================================
CREATE TABLE IF NOT EXISTS public.communication_credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Pricing
    credits INTEGER NOT NULL,
    bonus_credits INTEGER DEFAULT 0,
    price_ngn NUMERIC(10, 2) NOT NULL,
    price_usd NUMERIC(10, 2),
    
    -- Discount info
    discount_percent INTEGER DEFAULT 0,
    price_per_credit NUMERIC(10, 4),
    
    -- Display
    is_popular BOOLEAN DEFAULT false,
    badge_text VARCHAR(50), -- e.g., "Best Value", "Most Popular"
    sort_order INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default packages
INSERT INTO public.communication_credit_packages (name, description, credits, bonus_credits, price_ngn, price_usd, discount_percent, price_per_credit, is_popular, badge_text, sort_order) VALUES
    ('Starter', 'Perfect for small events', 1000, 0, 1000.00, 0.65, 0, 1.00, false, NULL, 1),
    ('Growth', 'For growing organizers', 5000, 500, 4500.00, 2.90, 10, 0.90, false, '10% Bonus', 2),
    ('Pro', 'For regular campaigners', 20000, 4000, 16000.00, 10.30, 20, 0.80, true, 'Most Popular', 3),
    ('Business', 'For high-volume senders', 50000, 15000, 35000.00, 22.60, 30, 0.70, false, 'Best Value', 4),
    ('Enterprise', 'For large organizations', 200000, 80000, 120000.00, 77.40, 40, 0.60, false, 'Maximum Savings', 5)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. CREDIT TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.communication_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    
    -- Transaction type
    type VARCHAR(50) NOT NULL, -- 'purchase', 'usage', 'refund', 'bonus', 'expiry', 'adjustment'
    
    -- Amount (positive for credit, negative for debit)
    amount INTEGER NOT NULL,
    bonus_amount INTEGER DEFAULT 0, -- If bonus credits involved
    balance_after INTEGER NOT NULL,
    bonus_balance_after INTEGER DEFAULT 0,
    
    -- Reference
    reference VARCHAR(255), -- Payment reference or campaign ID
    payment_reference VARCHAR(255), -- Paystack/Flutterwave reference
    
    -- For usage type
    channel VARCHAR(50), -- 'email', 'sms', 'whatsapp', 'telegram'
    campaign_id UUID REFERENCES public.communication_campaigns(id),
    message_count INTEGER,
    
    -- For purchase type
    package_id UUID REFERENCES public.communication_credit_packages(id),
    amount_paid NUMERIC(10, 2),
    currency VARCHAR(3),
    payment_provider VARCHAR(50), -- 'paystack', 'flutterwave', 'stripe'
    
    -- Description
    description TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_organizer ON public.communication_credit_transactions(organizer_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.communication_credit_transactions(organizer_id, type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON public.communication_credit_transactions(organizer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_campaign ON public.communication_credit_transactions(campaign_id);

-- ============================================
-- 4. CREDIT PRICING (per channel)
-- ============================================
CREATE TABLE IF NOT EXISTS public.communication_channel_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    channel VARCHAR(50) NOT NULL UNIQUE, -- 'email', 'sms', 'sms_dnd', 'whatsapp_marketing', 'whatsapp_utility', 'telegram', 'push'
    
    -- Credits per message
    credits_per_message INTEGER NOT NULL,
    
    -- Our cost (for margin calculation)
    cost_ngn NUMERIC(10, 4),
    
    -- Display info
    display_name VARCHAR(100),
    description TEXT,
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing
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

-- ============================================
-- 5. CREDIT EXPIRY TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS public.communication_credit_expiry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.communication_credit_transactions(id),
    
    -- Credit type
    is_bonus BOOLEAN DEFAULT false,
    
    -- Amounts
    original_amount INTEGER NOT NULL,
    remaining_amount INTEGER NOT NULL,
    
    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    expired BOOLEAN DEFAULT false,
    expired_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_expiry_organizer ON public.communication_credit_expiry(organizer_id);
CREATE INDEX IF NOT EXISTS idx_credit_expiry_expires ON public.communication_credit_expiry(expires_at) WHERE expired = false;

-- ============================================
-- 6. FUNCTIONS
-- ============================================

-- Function to deduct credits
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
    -- Get current balance
    SELECT balance, bonus_balance INTO v_current_balance, v_current_bonus
    FROM public.communication_credit_balances
    WHERE organizer_id = p_organizer_id
    FOR UPDATE;
    
    -- Check if enough credits
    IF (COALESCE(v_current_balance, 0) + COALESCE(v_current_bonus, 0)) < p_amount THEN
        RETURN FALSE;
    END IF;
    
    -- Deduct from bonus first, then main balance
    IF v_current_bonus >= p_amount THEN
        v_deduct_from_bonus := p_amount;
    ELSE
        v_deduct_from_bonus := COALESCE(v_current_bonus, 0);
        v_deduct_from_main := p_amount - v_deduct_from_bonus;
    END IF;
    
    v_new_balance := COALESCE(v_current_balance, 0) - v_deduct_from_main;
    v_new_bonus := COALESCE(v_current_bonus, 0) - v_deduct_from_bonus;
    
    -- Update balance
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
    
    -- Record transaction
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

-- Function to add credits (purchase)
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
    v_expiry_standard TIMESTAMPTZ;
    v_expiry_bonus TIMESTAMPTZ;
BEGIN
    -- Calculate expiry dates
    v_expiry_standard := NOW() + INTERVAL '12 months';
    v_expiry_bonus := NOW() + INTERVAL '6 months';
    
    -- Get or create balance record
    INSERT INTO public.communication_credit_balances (organizer_id, balance, bonus_balance)
    VALUES (p_organizer_id, 0, 0)
    ON CONFLICT (organizer_id) DO NOTHING;
    
    -- Get current balance
    SELECT balance, bonus_balance INTO v_current_balance, v_current_bonus
    FROM public.communication_credit_balances
    WHERE organizer_id = p_organizer_id
    FOR UPDATE;
    
    v_new_balance := COALESCE(v_current_balance, 0) + p_credits;
    v_new_bonus := COALESCE(v_current_bonus, 0) + p_bonus_credits;
    
    -- Update balance
    UPDATE public.communication_credit_balances
    SET 
        balance = v_new_balance,
        bonus_balance = v_new_bonus,
        lifetime_purchased = lifetime_purchased + p_credits,
        lifetime_bonus = lifetime_bonus + p_bonus_credits,
        updated_at = NOW()
    WHERE organizer_id = p_organizer_id;
    
    -- Record transaction
    INSERT INTO public.communication_credit_transactions (
        organizer_id, type, amount, bonus_amount, balance_after, bonus_balance_after,
        package_id, amount_paid, currency, payment_provider, payment_reference, description
    ) VALUES (
        p_organizer_id, 'purchase', p_credits, p_bonus_credits, v_new_balance, v_new_bonus,
        p_package_id, p_amount_paid, p_currency, p_payment_provider, p_payment_reference,
        COALESCE(p_description, 'Credit purchase')
    )
    RETURNING id INTO v_transaction_id;
    
    -- Record expiry for standard credits
    IF p_credits > 0 THEN
        INSERT INTO public.communication_credit_expiry (
            organizer_id, transaction_id, is_bonus, original_amount, remaining_amount, expires_at
        ) VALUES (
            p_organizer_id, v_transaction_id, false, p_credits, p_credits, v_expiry_standard
        );
    END IF;
    
    -- Record expiry for bonus credits
    IF p_bonus_credits > 0 THEN
        INSERT INTO public.communication_credit_expiry (
            organizer_id, transaction_id, is_bonus, original_amount, remaining_amount, expires_at
        ) VALUES (
            p_organizer_id, v_transaction_id, true, p_bonus_credits, p_bonus_credits, v_expiry_bonus
        );
    END IF;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. RLS POLICIES
-- ============================================

ALTER TABLE public.communication_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_channel_pricing ENABLE ROW LEVEL SECURITY;

-- Balances - organizers see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_credit_balances' AND policyname = 'credit_balances_organizer_access') THEN
        CREATE POLICY credit_balances_organizer_access ON public.communication_credit_balances
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM public.organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM public.organizer_team_members 
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- Transactions - organizers see their own
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_credit_transactions' AND policyname = 'credit_transactions_organizer_access') THEN
        CREATE POLICY credit_transactions_organizer_access ON public.communication_credit_transactions
            FOR ALL USING (
                organizer_id IN (
                    SELECT id FROM public.organizers WHERE user_id = auth.uid()
                    UNION
                    SELECT organizer_id FROM public.organizer_team_members 
                    WHERE user_id = auth.uid() AND status = 'active'
                )
            );
    END IF;
END $$;

-- Packages - everyone can read
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_credit_packages' AND policyname = 'credit_packages_read') THEN
        CREATE POLICY credit_packages_read ON public.communication_credit_packages
            FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- Channel pricing - everyone can read
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'communication_channel_pricing' AND policyname = 'channel_pricing_read') THEN
        CREATE POLICY channel_pricing_read ON public.communication_channel_pricing
            FOR SELECT USING (is_active = true);
    END IF;
END $$;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE public.communication_credit_balances IS 'Organizer credit balances for messaging';
COMMENT ON TABLE public.communication_credit_transactions IS 'Credit transaction history';
COMMENT ON TABLE public.communication_credit_packages IS 'Available credit packages for purchase';
COMMENT ON TABLE public.communication_channel_pricing IS 'Credits required per channel';
COMMENT ON TABLE public.communication_credit_expiry IS 'Credit expiry tracking';

COMMENT ON FUNCTION deduct_communication_credits IS 'Deduct credits for message sending';
COMMENT ON FUNCTION add_communication_credits IS 'Add credits from purchase';
