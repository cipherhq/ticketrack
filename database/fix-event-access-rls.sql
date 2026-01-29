-- ============================================
-- FIX EVENT ACCESS RLS POLICIES
-- ============================================
-- Fixes RLS for event_invite_codes and event_email_whitelist tables

-- ============================================
-- 1. EVENT_INVITE_CODES TABLE
-- ============================================

-- Enable RLS
ALTER TABLE public.event_invite_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "event_invite_codes_public_validate" ON public.event_invite_codes;
DROP POLICY IF EXISTS "event_invite_codes_organizer_manage" ON public.event_invite_codes;
DROP POLICY IF EXISTS "event_invite_codes_service_role" ON public.event_invite_codes;

-- Allow public to SELECT for code validation (needed for the validate_invite_code function)
CREATE POLICY "event_invite_codes_public_validate"
ON public.event_invite_codes
FOR SELECT
TO public
USING (true);

-- Allow organizers to manage their event's invite codes
CREATE POLICY "event_invite_codes_organizer_manage"
ON public.event_invite_codes
FOR ALL
TO public
USING (
    event_id IN (
        SELECT e.id FROM public.events e
        WHERE e.organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
            UNION
            SELECT organizer_id FROM public.organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
        )
    )
);

-- Allow service role full access
CREATE POLICY "event_invite_codes_service_role"
ON public.event_invite_codes
FOR ALL
TO service_role
USING (true);

-- ============================================
-- 2. EVENT_EMAIL_WHITELIST TABLE
-- ============================================

-- Enable RLS
ALTER TABLE public.event_email_whitelist ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "event_email_whitelist_public_check" ON public.event_email_whitelist;
DROP POLICY IF EXISTS "event_email_whitelist_organizer_manage" ON public.event_email_whitelist;
DROP POLICY IF EXISTS "event_email_whitelist_service_role" ON public.event_email_whitelist;

-- Allow public to SELECT for email checking
CREATE POLICY "event_email_whitelist_public_check"
ON public.event_email_whitelist
FOR SELECT
TO public
USING (true);

-- Allow organizers to manage their event's email whitelist
CREATE POLICY "event_email_whitelist_organizer_manage"
ON public.event_email_whitelist
FOR ALL
TO public
USING (
    event_id IN (
        SELECT e.id FROM public.events e
        WHERE e.organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
            UNION
            SELECT organizer_id FROM public.organizer_team_members WHERE user_id = auth.uid() AND status = 'active'
        )
    )
);

-- Allow service role full access
CREATE POLICY "event_email_whitelist_service_role"
ON public.event_email_whitelist
FOR ALL
TO service_role
USING (true);

-- ============================================
-- 3. VERIFY validate_invite_code FUNCTION EXISTS
-- ============================================

-- Create or replace the function
CREATE OR REPLACE FUNCTION public.validate_invite_code(
    p_event_id uuid,
    p_code character varying,
    p_user_email character varying DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code_record RECORD;
    v_result JSONB;
BEGIN
    -- Find the code
    SELECT * INTO v_code_record
    FROM event_invite_codes
    WHERE event_id = p_event_id
        AND UPPER(code) = UPPER(p_code)
        AND is_active = true;

    -- Code not found
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Invalid invite code');
    END IF;

    -- Check expiration
    IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This invite code has expired');
    END IF;

    -- Check usage limit
    IF v_code_record.max_uses IS NOT NULL AND v_code_record.current_uses >= v_code_record.max_uses THEN
        RETURN jsonb_build_object('valid', false, 'error', 'This invite code has reached its usage limit');
    END IF;

    -- Code is valid - increment usage
    UPDATE event_invite_codes
    SET current_uses = COALESCE(current_uses, 0) + 1,
        last_used_at = NOW()
    WHERE id = v_code_record.id;

    RETURN jsonb_build_object(
        'valid', true,
        'code_id', v_code_record.id,
        'code_name', v_code_record.name
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_invite_code(uuid, character varying, character varying) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(uuid, character varying, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_invite_code(uuid, character varying, character varying) TO service_role;

-- ============================================
-- 4. VERIFY check_email_whitelist FUNCTION EXISTS
-- ============================================

CREATE OR REPLACE FUNCTION public.check_email_whitelist(
    p_event_id uuid,
    p_email character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_email_record RECORD;
BEGIN
    -- Find the email
    SELECT * INTO v_email_record
    FROM event_email_whitelist
    WHERE event_id = p_event_id
        AND LOWER(email) = LOWER(p_email);

    -- Email not found
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Your email is not on the guest list');
    END IF;

    -- Update access status
    UPDATE event_email_whitelist
    SET has_accessed = true,
        accessed_at = NOW()
    WHERE id = v_email_record.id;

    RETURN jsonb_build_object(
        'valid', true,
        'email_id', v_email_record.id
    );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_email_whitelist(uuid, character varying) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_whitelist(uuid, character varying) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_email_whitelist(uuid, character varying) TO service_role;

-- ============================================
-- 5. VERIFY TABLES EXIST
-- ============================================

-- Create event_invite_codes if not exists
CREATE TABLE IF NOT EXISTS public.event_invite_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    code varchar(50) NOT NULL,
    name varchar(100),
    max_uses integer,
    current_uses integer DEFAULT 0,
    expires_at timestamp with time zone,
    is_active boolean DEFAULT true,
    last_used_at timestamp with time zone,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(event_id, code)
);

-- Ensure all columns exist (for existing tables)
ALTER TABLE public.event_invite_codes ADD COLUMN IF NOT EXISTS last_used_at timestamp with time zone;
ALTER TABLE public.event_invite_codes ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create event_email_whitelist if not exists
CREATE TABLE IF NOT EXISTS public.event_email_whitelist (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    email varchar(255) NOT NULL,
    has_accessed boolean DEFAULT false,
    accessed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(event_id, email)
);

-- ============================================
-- DONE
-- ============================================
SELECT 'Event access RLS policies fixed successfully' AS status;
