#!/bin/bash
set -e
cd ~/Desktop/ticketrack
echo "🚀 Starting..."
mkdir -p supabase/migrations
cat > supabase/migrations/20241230_affiliate_optin.sql << 'SQLEND'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS affiliate_status VARCHAR(20) DEFAULT NULL;
UPDATE profiles SET referral_code = NULL, affiliate_balance = 0, total_referral_earnings = 0, referral_count = 0, affiliate_status = NULL WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_status ON profiles(affiliate_status) WHERE affiliate_status IS NOT NULL;
CREATE OR REPLACE FUNCTION generate_referral_code() RETURNS VARCHAR(20) AS $$ DECLARE new_code VARCHAR(20); code_exists BOOLEAN; BEGIN LOOP new_code := 'REF-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)); SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists; EXIT WHEN NOT code_exists; END LOOP; RETURN new_code; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION become_affiliate(p_user_id UUID) RETURNS JSON AS $$ DECLARE v_current_status VARCHAR(20); v_new_code VARCHAR(20); v_result JSON; BEGIN SELECT affiliate_status INTO v_current_status FROM profiles WHERE id = p_user_id; IF v_current_status = 'approved' THEN SELECT json_build_object('success', true, 'message', 'Already an affiliate', 'referral_code', referral_code) INTO v_result FROM profiles WHERE id = p_user_id; RETURN v_result; END IF; IF v_current_status = 'suspended' THEN RETURN json_build_object('success', false, 'message', 'Your affiliate account has been suspended.'); END IF; v_new_code := generate_referral_code(); UPDATE profiles SET affiliate_status = 'approved', referral_code = v_new_code, affiliate_balance = 0, total_referral_earnings = 0, referral_count = 0 WHERE id = p_user_id; RETURN json_build_object('success', true, 'message', 'Welcome to the affiliate program!', 'referral_code', v_new_code); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION increment_referral_count(p_user_id UUID) RETURNS VOID AS $$ BEGIN UPDATE profiles SET referral_count = COALESCE(referral_count, 0) + 1 WHERE id = p_user_id AND affiliate_status = 'approved'; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION suspend_affiliate(p_user_id UUID, p_reason TEXT DEFAULT NULL) RETURNS JSON AS $$ BEGIN UPDATE profiles SET affiliate_status = 'suspended' WHERE id = p_user_id AND affiliate_status = 'approved'; IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Not an active affiliate'); END IF; RETURN json_build_object('success', true, 'message', 'Affiliate suspended'); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION reinstate_affiliate(p_user_id UUID) RETURNS JSON AS $$ BEGIN UPDATE profiles SET affiliate_status = 'approved' WHERE id = p_user_id AND affiliate_status = 'suspended'; IF NOT FOUND THEN RETURN json_build_object('success', false, 'message', 'Not suspended'); END IF; RETURN json_build_object('success', true, 'message', 'Affiliate reinstated'); END; $$ LANGUAGE plpgsql SECURITY DEFINER;
SQLEND
echo "✅ SQL created"
sed -i '' "s/.select('referral_code, affiliate_balance, total_referral_earnings, referral_count')/.select('referral_code, affiliate_balance, total_referral_earnings, referral_count, affiliate_status')/g" src/pages/AttendeeProfile.jsx
sed -i '' "s/.select('id, email, phone, referral_code')/.select('id, email, phone, referral_code, affiliate_status')/g" src/pages/WebCheckout.jsx
sed -i '' "s/.eq('referral_code', affiliateCode)$/.eq('referral_code', affiliateCode).eq('affiliate_status', 'approved')/g" src/pages/WebCheckout.jsx
sed -i '' "s/.select('id, email, phone, full_name, referral_code, affiliate_balance, total_referral_earnings, referral_count, created_at')/.select('id, email, phone, full_name, referral_code, affiliate_balance, total_referral_earnings, referral_count, affiliate_status, created_at')/g" src/pages/admin/AdminAffiliatesManagement.jsx
sed -i '' "s/.not('referral_code', 'is', null)/.not('affiliate_status', 'is', null)/g" src/pages/admin/AdminAffiliatesManagement.jsx
echo "✅ Files patched"
echo ""
echo "SQL file created at: supabase/migrations/20241230_affiliate_optin.sql"
echo "Copy this SQL to Supabase SQL Editor and run it."
