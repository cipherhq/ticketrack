-- ============================================
-- TELEGRAM LINK REQUESTS SCHEMA
-- ============================================
-- For securely linking Telegram accounts to Ticketrack users
-- ============================================

CREATE TABLE IF NOT EXISTS public.telegram_link_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Secure token
    token VARCHAR(64) NOT NULL UNIQUE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'expired'
    
    -- Expiry
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_token ON public.telegram_link_requests(token);
CREATE INDEX IF NOT EXISTS idx_telegram_link_user ON public.telegram_link_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_status ON public.telegram_link_requests(status) WHERE status = 'pending';

-- RLS
ALTER TABLE public.telegram_link_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telegram_link_requests' AND policyname = 'telegram_link_user_access') THEN
        CREATE POLICY telegram_link_user_access ON public.telegram_link_requests
            FOR ALL USING (user_id = auth.uid());
    END IF;
END $$;

-- Function to create a link request
CREATE OR REPLACE FUNCTION create_telegram_link_request(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
BEGIN
    -- Generate secure random token
    v_token := encode(gen_random_bytes(32), 'hex');
    
    -- Cancel any existing pending requests
    UPDATE public.telegram_link_requests
    SET status = 'expired'
    WHERE user_id = p_user_id AND status = 'pending';
    
    -- Create new request (expires in 15 minutes)
    INSERT INTO public.telegram_link_requests (user_id, token, expires_at)
    VALUES (p_user_id, v_token, NOW() + INTERVAL '15 minutes');
    
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.telegram_link_requests IS 'Pending Telegram account link requests';
COMMENT ON FUNCTION create_telegram_link_request IS 'Create a new Telegram link request with a secure token';
