-- Zero-Trust User Management & Security System
-- Comprehensive role-based access control with audit logging

-- 1. USER ROLES AND PERMISSIONS SYSTEM
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 1, -- 1=lowest, 10=highest
    can_create_users BOOLEAN DEFAULT false,
    can_modify_roles BOOLEAN DEFAULT false,
    can_view_audit_logs BOOLEAN DEFAULT false,
    can_access_finance BOOLEAN DEFAULT false,
    can_process_payouts BOOLEAN DEFAULT false,
    can_approve_refunds BOOLEAN DEFAULT false,
    can_manage_events BOOLEAN DEFAULT false,
    can_manage_organizers BOOLEAN DEFAULT false,
    can_view_reports BOOLEAN DEFAULT false,
    can_manage_settings BOOLEAN DEFAULT false,
    max_concurrent_sessions INTEGER DEFAULT 3,
    requires_otp BOOLEAN DEFAULT true,
    ip_restrictions BOOLEAN DEFAULT false,
    session_timeout_minutes INTEGER DEFAULT 480, -- 8 hours
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default roles
INSERT INTO user_roles (name, display_name, description, level, can_create_users, can_modify_roles, can_view_audit_logs, can_access_finance, can_process_payouts, can_approve_refunds, can_manage_events, can_manage_organizers, can_view_reports, can_manage_settings, requires_otp, session_timeout_minutes) VALUES

-- Super Admin (Level 10) - Full access
('super_admin', 'Super Administrator', 'Full system access with all permissions', 10, true, true, true, true, true, true, true, true, true, true, true, 720),

-- Finance Admin (Level 9) - Financial operations
('finance_admin', 'Finance Administrator', 'Full financial system access including payouts', 9, false, false, true, true, true, true, false, false, true, false, true, 480),

-- Account Admin (Level 8) - Account management
('account_admin', 'Account Administrator', 'User and account management, can process payouts', 8, true, false, true, true, true, true, true, true, true, false, true, 480),

-- Operations Manager (Level 7) - Day-to-day operations
('operations_manager', 'Operations Manager', 'Event and organizer management, reports access', 7, false, false, true, false, false, true, true, true, true, false, true, 480),

-- Finance User (Level 6) - View-only finance access
('finance_user', 'Finance User', 'View financial reports, approve refunds only', 6, false, false, false, true, false, true, false, false, true, false, true, 480),

-- Support Manager (Level 5) - Customer support management
('support_manager', 'Support Manager', 'Manage customer support and basic operations', 5, false, false, false, false, false, true, true, true, true, false, true, 480),

-- Support Agent (Level 3) - Basic support
('support_agent', 'Support Agent', 'Basic customer support access', 3, false, false, false, false, false, false, false, true, false, false, true, 480),

-- Read Only (Level 1) - View only access
('read_only', 'Read Only User', 'View-only access to reports and data', 1, false, false, false, false, false, false, false, false, true, false, true, 480)

ON CONFLICT (name) DO NOTHING;

-- 2. USER ASSIGNMENTS WITH EXPIRATION
CREATE TABLE IF NOT EXISTS user_role_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role_id UUID NOT NULL REFERENCES user_roles(id),
    assigned_by UUID, -- User who assigned this role
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = never expires
    is_active BOOLEAN DEFAULT true,
    reason TEXT, -- Why this role was assigned
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    revoked_reason TEXT,
    UNIQUE(user_id, role_id) -- One role per user (can be extended to multiple)
);

-- 3. OTP AUTHENTICATION SYSTEM
CREATE TABLE IF NOT EXISTS user_otp (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL, -- Hashed OTP for security
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    is_verified BOOLEAN DEFAULT false,
    purpose VARCHAR(50) DEFAULT 'login' -- login, password_reset, sensitive_action
);

-- 4. SESSION MANAGEMENT
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    device_info TEXT,
    ip_address INET,
    user_agent TEXT,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    ended_at TIMESTAMPTZ,
    end_reason VARCHAR(50) -- logout, timeout, forced, security
);

-- 5. IP RESTRICTIONS
CREATE TABLE IF NOT EXISTS user_ip_restrictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    ip_address INET NOT NULL,
    subnet_mask INTEGER DEFAULT 32, -- For IP ranges
    description TEXT,
    is_allowed BOOLEAN DEFAULT true, -- true=whitelist, false=blacklist
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- 6. COMPREHENSIVE AUDIT LOGGING
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID, -- NULL for system events
    session_id UUID,
    event_type VARCHAR(100) NOT NULL, -- login, logout, role_change, payout, etc.
    event_category VARCHAR(50) NOT NULL, -- security, finance, admin, system
    description TEXT NOT NULL,
    resource_type VARCHAR(100), -- user, role, payout, event, etc.
    resource_id UUID,
    old_values JSONB, -- Previous state
    new_values JSONB, -- New state
    ip_address INET,
    user_agent TEXT,
    device_info TEXT,
    risk_level VARCHAR(20) DEFAULT 'low', -- low, medium, high, critical
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    metadata JSONB, -- Additional context
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. DEVICE TRACKING
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(200),
    device_type VARCHAR(50), -- desktop, mobile, tablet
    browser VARCHAR(100),
    os VARCHAR(100),
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    is_trusted BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    login_count INTEGER DEFAULT 1,
    location_history JSONB DEFAULT '[]'::jsonb,
    UNIQUE(user_id, device_fingerprint)
);

-- 8. SENSITIVE ACTIONS LOG (for payouts, etc.)
CREATE TABLE IF NOT EXISTS sensitive_actions_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- process_payout, approve_refund, create_admin_user
    resource_type VARCHAR(100),
    resource_id UUID,
    amount_involved DECIMAL(15,2), -- For financial actions
    currency VARCHAR(3),
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    approval_reason TEXT,
    rejected_by UUID,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    otp_verified BOOLEAN DEFAULT false,
    ip_address INET,
    device_fingerprint VARCHAR(255),
    metadata JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 9. FAILED LOGIN ATTEMPTS (Brute Force Protection)
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255),
    phone_number VARCHAR(20),
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempt_count INTEGER DEFAULT 1,
    first_attempt TIMESTAMPTZ DEFAULT NOW(),
    last_attempt TIMESTAMPTZ DEFAULT NOW(),
    is_blocked BOOLEAN DEFAULT false,
    blocked_until TIMESTAMPTZ,
    reason VARCHAR(200)
);

-- 10. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_expires_at ON user_role_assignments(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_otp_user_id ON user_otp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_otp_expires_at ON user_otp(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_at ON security_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sensitive_actions_log_user_id ON sensitive_actions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sensitive_actions_log_status ON sensitive_actions_log(status);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip ON failed_login_attempts(ip_address);

-- 11. Helper Functions

-- Function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(p_user_id UUID, p_permission TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    has_perm BOOLEAN := false;
BEGIN
    SELECT CASE 
        WHEN p_permission = 'can_create_users' THEN r.can_create_users
        WHEN p_permission = 'can_modify_roles' THEN r.can_modify_roles
        WHEN p_permission = 'can_view_audit_logs' THEN r.can_view_audit_logs
        WHEN p_permission = 'can_access_finance' THEN r.can_access_finance
        WHEN p_permission = 'can_process_payouts' THEN r.can_process_payouts
        WHEN p_permission = 'can_approve_refunds' THEN r.can_approve_refunds
        WHEN p_permission = 'can_manage_events' THEN r.can_manage_events
        WHEN p_permission = 'can_manage_organizers' THEN r.can_manage_organizers
        WHEN p_permission = 'can_view_reports' THEN r.can_view_reports
        WHEN p_permission = 'can_manage_settings' THEN r.can_manage_settings
        ELSE false
    END INTO has_perm
    FROM user_role_assignments ura
    JOIN user_roles r ON ura.role_id = r.id
    WHERE ura.user_id = p_user_id 
        AND ura.is_active = true 
        AND r.is_active = true
        AND (ura.expires_at IS NULL OR ura.expires_at > NOW());
    
    RETURN COALESCE(has_perm, false);
END;
$$ LANGUAGE plpgsql;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID,
    p_session_id UUID,
    p_event_type TEXT,
    p_event_category TEXT,
    p_description TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_risk_level TEXT DEFAULT 'low',
    p_success BOOLEAN DEFAULT true,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO security_audit_logs (
        user_id, session_id, event_type, event_category, description,
        resource_type, resource_id, old_values, new_values,
        ip_address, risk_level, success, metadata
    ) VALUES (
        p_user_id, p_session_id, p_event_type, p_event_category, p_description,
        p_resource_type, p_resource_id, p_old_values, p_new_values,
        p_ip_address, p_risk_level, p_success, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS INTEGER AS $$
DECLARE
    cleaned_count INTEGER;
BEGIN
    UPDATE user_sessions 
    SET is_active = false, 
        ended_at = NOW(), 
        end_reason = 'timeout'
    WHERE expires_at < NOW() 
        AND is_active = true;
    
    GET DIAGNOSTICS cleaned_count = ROW_COUNT;
    RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql;

-- Verification queries
SELECT 'Zero-Trust User Management System Created Successfully!' as status;

SELECT 'User Roles:' as info, COUNT(*) as count FROM user_roles;
SELECT 'Default Roles Created:' as info, name, display_name, level FROM user_roles ORDER BY level DESC;