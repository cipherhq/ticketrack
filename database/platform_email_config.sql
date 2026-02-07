-- ============================================
-- PLATFORM EMAIL CONFIG TABLE
-- ============================================
-- Stores email service configuration (Resend)
-- ============================================

CREATE TABLE IF NOT EXISTS public.platform_email_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    provider VARCHAR(50) DEFAULT 'resend',
    api_key TEXT,
    from_email VARCHAR(255) DEFAULT 'tickets@ticketrack.com',
    from_name VARCHAR(255) DEFAULT 'Ticketrack',
    reply_to VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Add RLS
ALTER TABLE public.platform_email_config ENABLE ROW LEVEL SECURITY;

-- Only admins can access
CREATE POLICY "Admin access only" ON public.platform_email_config
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
            AND role IN ('admin', 'super_admin')
        )
    );

-- Insert default row
INSERT INTO public.platform_email_config (provider, from_email, from_name, is_active)
VALUES ('resend', 'tickets@ticketrack.com', 'Ticketrack', true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.platform_email_config IS 'Platform-wide email service configuration';
