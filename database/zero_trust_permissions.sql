-- Grant permissions for Zero-Trust User Management tables
-- Run this in Supabase SQL Editor after creating the tables

-- Disable RLS temporarily for admin access
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_role_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_otp DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_ip_restrictions DISABLE ROW LEVEL SECURITY;
ALTER TABLE security_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_actions_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE failed_login_attempts DISABLE ROW LEVEL SECURITY;

-- Grant full access to authenticated users (admins)
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON user_role_assignments TO authenticated;
GRANT ALL ON user_sessions TO authenticated;
GRANT ALL ON user_otp TO authenticated;
GRANT ALL ON user_ip_restrictions TO authenticated;
GRANT ALL ON security_audit_logs TO authenticated;
GRANT ALL ON user_devices TO authenticated;
GRANT ALL ON sensitive_actions_log TO authenticated;
GRANT ALL ON failed_login_attempts TO authenticated;

-- Grant read access to anon for public role info
GRANT SELECT ON user_roles TO anon;

-- Verify tables exist and have data
SELECT 'Tables Status:' as info;
SELECT 
    'user_roles' as table_name, 
    COUNT(*) as count 
FROM user_roles
UNION ALL
SELECT 'user_role_assignments', COUNT(*) FROM user_role_assignments
UNION ALL
SELECT 'user_sessions', COUNT(*) FROM user_sessions
UNION ALL
SELECT 'security_audit_logs', COUNT(*) FROM security_audit_logs
UNION ALL
SELECT 'failed_login_attempts', COUNT(*) FROM failed_login_attempts;

-- Show available roles
SELECT 'Available Roles:' as info;
SELECT name, display_name, level FROM user_roles ORDER BY level DESC;
