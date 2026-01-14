


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."accept_team_invitation"("p_token" "uuid", "p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_member organizer_team_members%ROWTYPE;
  v_result jsonb;
BEGIN
  -- Find the invitation
  SELECT * INTO v_member 
  FROM organizer_team_members 
  WHERE invitation_token = p_token;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation token');
  END IF;
  
  IF v_member.status = 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation already accepted');
  END IF;
  
  IF v_member.invitation_expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;
  
  -- Update the member
  UPDATE organizer_team_members
  SET 
    user_id = p_user_id,
    status = 'active',
    joined_at = now(),
    updated_at = now()
  WHERE id = v_member.id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'organizer_id', v_member.organizer_id,
    'role', v_member.role
  );
END;
$$;


ALTER FUNCTION "public"."accept_team_invitation"("p_token" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_bank_account"("p_organizer_id" "uuid", "p_bank_name" "text", "p_bank_code" "text", "p_account_number" "text", "p_account_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id UUID;
  v_country_code TEXT;
  v_currency TEXT;
  v_encrypted_account BYTEA;
  v_new_id UUID;
  v_is_first BOOLEAN;
  v_encryption_key TEXT := 'ticketrack_secure_key_2024'; -- In production, use Supabase Vault
BEGIN
  -- Verify the organizer belongs to the current user
  SELECT user_id, country_code INTO v_user_id, v_country_code
  FROM organizers
  WHERE id = p_organizer_id;
  
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  -- Default country_code if not set
  IF v_country_code IS NULL THEN
    v_country_code := 'NG';
  END IF;
  
  -- Get currency from countries table
  SELECT default_currency INTO v_currency
  FROM countries
  WHERE code = v_country_code;
  
  IF v_currency IS NULL THEN
    v_currency := 'NGN'; -- Fallback for Nigeria
  END IF;
  
  -- Encrypt the account number
  v_encrypted_account := pgp_sym_encrypt(p_account_number, v_encryption_key);
  
  -- Check if this is the first account
  SELECT NOT EXISTS (
    SELECT 1 FROM bank_accounts WHERE organizer_id = p_organizer_id
  ) INTO v_is_first;
  
  -- Insert the bank account
  INSERT INTO bank_accounts (
    organizer_id,
    country_code,
    bank_name,
    account_number_encrypted,
    account_name,
    currency,
    is_default,
    is_verified,
    verified_at
  ) VALUES (
    p_organizer_id,
    v_country_code,
    p_bank_name,
    v_encrypted_account,
    p_account_name,
    v_currency,
    v_is_first,
    true,
    NOW()
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;


ALTER FUNCTION "public"."add_bank_account"("p_organizer_id" "uuid", "p_bank_name" "text", "p_bank_code" "text", "p_account_number" "text", "p_account_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_sms_credits"("p_organizer_id" "uuid", "p_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO sms_balances (organizer_id, credits, total_purchased) 
  VALUES (p_organizer_id, p_count, p_count)
  ON CONFLICT (organizer_id) 
  DO UPDATE SET 
    credits = sms_balances.credits + p_count, 
    total_purchased = sms_balances.total_purchased + p_count, 
    updated_at = NOW();
END;
$$;


ALTER FUNCTION "public"."add_sms_credits"("p_organizer_id" "uuid", "p_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."become_affiliate"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE 
  v_current_status VARCHAR(20); 
  v_new_code VARCHAR(20); 
  v_result JSON; 
BEGIN 
  SELECT affiliate_status INTO v_current_status FROM profiles WHERE id = p_user_id; 
  
  IF v_current_status = 'approved' THEN 
    SELECT json_build_object('success', true, 'message', 'Already an affiliate', 'referral_code', referral_code) 
    INTO v_result FROM profiles WHERE id = p_user_id; 
    RETURN v_result; 
  END IF; 
  
  IF v_current_status = 'suspended' THEN 
    RETURN json_build_object('success', false, 'message', 'Your affiliate account has been suspended.'); 
  END IF; 
  
  v_new_code := generate_referral_code(); 
  
  UPDATE profiles SET 
    affiliate_status = 'approved', 
    referral_code = v_new_code, 
    affiliate_balance = 0, 
    total_referral_earnings = 0, 
    referral_count = 0 
  WHERE id = p_user_id; 
  
  RETURN json_build_object('success', true, 'message', 'Welcome to the affiliate program!', 'referral_code', v_new_code); 
END; 
$$;


ALTER FUNCTION "public"."become_affiliate"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_refund_amount"("p_original_amount" numeric, "p_country_code" character varying) RETURNS TABLE("original_amount" numeric, "refund_fee" numeric, "refund_amount" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_config JSONB;
  v_fee_type TEXT;
  v_fee_value NUMERIC;
  v_min_fee NUMERIC;
  v_max_fee NUMERIC;
  v_calculated_fee NUMERIC;
BEGIN
  -- Get refund fee config for country
  SELECT cf.config INTO v_config
  FROM country_features cf
  WHERE cf.country_code = p_country_code
  AND cf.feature_id = 'refund_fee'
  AND cf.is_enabled = true;
  
  -- Default to 5% if no config found
  IF v_config IS NULL THEN
    v_fee_type := 'percentage';
    v_fee_value := 5;
    v_min_fee := 0;
    v_max_fee := 999999;
  ELSE
    v_fee_type := v_config->>'fee_type';
    v_fee_value := (v_config->>'fee_value')::NUMERIC;
    v_min_fee := COALESCE((v_config->>'min_fee')::NUMERIC, 0);
    v_max_fee := COALESCE((v_config->>'max_fee')::NUMERIC, 999999);
  END IF;
  
  -- Calculate fee
  IF v_fee_type = 'percentage' THEN
    v_calculated_fee := p_original_amount * (v_fee_value / 100);
  ELSE
    v_calculated_fee := v_fee_value;
  END IF;
  
  -- Apply min/max bounds
  v_calculated_fee := GREATEST(v_min_fee, LEAST(v_max_fee, v_calculated_fee));
  
  RETURN QUERY SELECT 
    p_original_amount,
    ROUND(v_calculated_fee, 2),
    ROUND(p_original_amount - v_calculated_fee, 2);
END;
$$;


ALTER FUNCTION "public"."calculate_refund_amount"("p_original_amount" numeric, "p_country_code" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_organizer_receive_payout"("org_id" "uuid") RETURNS TABLE("can_receive" boolean, "reason" "text", "bank_account_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  bank_record RECORD;
BEGIN
  SELECT * INTO bank_record
  FROM organizer_bank_accounts
  WHERE organizer_id = org_id
  AND is_default = TRUE
  AND is_active = TRUE
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No active bank account'::TEXT, NULL::UUID;
    RETURN;
  END IF;
  
  IF bank_record.cooling_until IS NOT NULL AND bank_record.cooling_until > NOW() THEN
    RETURN QUERY SELECT FALSE, 
      ('Bank account in security cooling period until ' || bank_record.cooling_until::TEXT)::TEXT,
      bank_record.id;
    RETURN;
  END IF;
  
  IF bank_record.is_pending_confirmation THEN
    RETURN QUERY SELECT FALSE, 'Bank account pending email confirmation'::TEXT, bank_record.id;
    RETURN;
  END IF;
  
  IF bank_record.security_locked THEN
    RETURN QUERY SELECT FALSE, ('Bank account locked: ' || COALESCE(bank_record.lock_reason, 'Security review'))::TEXT, bank_record.id;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, 'OK'::TEXT, bank_record.id;
END;
$$;


ALTER FUNCTION "public"."can_organizer_receive_payout"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_email_whitelist"("p_event_id" "uuid", "p_email" character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_whitelist_record RECORD;
BEGIN
  SELECT * INTO v_whitelist_record
  FROM event_email_whitelist
  WHERE event_id = p_event_id 
    AND LOWER(email) = LOWER(p_email);
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Your email is not on the guest list for this event');
  END IF;
  
  -- Mark as accessed
  UPDATE event_email_whitelist 
  SET has_accessed = true, accessed_at = NOW() 
  WHERE id = v_whitelist_record.id;
  
  RETURN jsonb_build_object(
    'valid', true,
    'name', v_whitelist_record.name
  );
END;
$$;


ALTER FUNCTION "public"."check_email_whitelist"("p_event_id" "uuid", "p_email" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_otps"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  DELETE FROM phone_otps WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_otps"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_rate_limits"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Delete records older than 7 days
  DELETE FROM email_rate_limits
  WHERE window_start < NOW() - INTERVAL '7 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_rate_limits"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrypt_account_number"("encrypted_number" "bytea") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_number, current_setting('app.encryption_key', true));
END;
$$;


ALTER FUNCTION "public"."decrypt_account_number"("encrypted_number" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deduct_sms_credits"("p_organizer_id" "uuid", "p_count" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE 
  current_balance INT;
BEGIN
  SELECT credits INTO current_balance 
  FROM sms_balances 
  WHERE organizer_id = p_organizer_id;
  
  IF current_balance IS NULL OR current_balance < p_count THEN 
    RETURN FALSE; 
  END IF;
  
  UPDATE sms_balances 
  SET credits = credits - p_count, 
      total_used = total_used + p_count, 
      updated_at = NOW() 
  WHERE organizer_id = p_organizer_id;
  
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."deduct_sms_credits"("p_organizer_id" "uuid", "p_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_user_account"("user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF auth.uid() != user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  DELETE FROM saved_events WHERE saved_events.user_id = user_id;
  DELETE FROM referral_earnings WHERE referral_earnings.user_id = user_id;
  
  UPDATE tickets 
  SET user_id = NULL, attendee_email = 'deleted@user.com', attendee_name = 'Deleted User'
  WHERE tickets.user_id = user_id;
  
  DELETE FROM profiles WHERE id = user_id;
  DELETE FROM auth.users WHERE id = user_id;
  
  RETURN jsonb_build_object('success', true, 'message', 'Account deleted');
END;
$$;


ALTER FUNCTION "public"."delete_user_account"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_suspicious_bank_change"("p_organizer_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_ip_address" "inet" DEFAULT NULL::"inet") RETURNS TABLE("is_suspicious" boolean, "reasons" "text"[], "should_block" boolean, "require_confirmation" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_should_block BOOLEAN := FALSE;
  v_require_confirmation BOOLEAN := FALSE;
  v_organizer RECORD;
  v_recent_changes INTEGER;
BEGIN
  SELECT o.*, o.created_at as org_created_at
  INTO v_organizer
  FROM organizers o
  WHERE o.id = p_organizer_id;
  
  -- Rule 1: Multiple changes in 24 hours
  SELECT COUNT(*) INTO v_recent_changes
  FROM bank_account_changes
  WHERE organizer_id = p_organizer_id
  AND created_at > NOW() - INTERVAL '24 hours';
  
  IF v_recent_changes >= 2 THEN
    v_reasons := array_append(v_reasons, 'Multiple bank changes in 24 hours');
    v_should_block := TRUE;
  END IF;
  
  -- Rule 2: New organizer (less than 7 days)
  IF v_organizer.org_created_at > NOW() - INTERVAL '7 days' THEN
    v_reasons := array_append(v_reasons, 'New organizer account (less than 7 days)');
    v_require_confirmation := TRUE;
  END IF;
  
  RETURN QUERY SELECT 
    array_length(v_reasons, 1) > 0,
    v_reasons,
    v_should_block,
    v_require_confirmation;
END;
$$;


ALTER FUNCTION "public"."detect_suspicious_bank_change"("p_organizer_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_ip_address" "inet") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."encrypt_account_number"("account_number" "text") RETURNS "bytea"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN pgp_sym_encrypt(account_number, current_setting('app.encryption_key', true));
END;
$$;


ALTER FUNCTION "public"."encrypt_account_number"("account_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_bank"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.is_default = TRUE THEN
    UPDATE organizer_bank_accounts
    SET is_default = FALSE
    WHERE organizer_id = NEW.organizer_id
    AND id != NEW.id
    AND is_default = TRUE;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_bank"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_event_slug"("title" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    base_slug := LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := TRIM(BOTH '-' FROM base_slug);
    final_slug := base_slug;
    
    WHILE EXISTS (SELECT 1 FROM public.events WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_event_slug"("title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_invite_code"("length" integer DEFAULT 8) RETURNS character varying
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  chars VARCHAR := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result VARCHAR := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."generate_invite_code"("length" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_number TEXT;
BEGIN
    new_number := 'TT-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_payout_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_number TEXT;
BEGIN
    new_number := 'PAY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_payout_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_qr_hash"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN ENCODE(SHA256(RANDOM()::TEXT::BYTEA || NOW()::TEXT::BYTEA), 'hex');
END;
$$;


ALTER FUNCTION "public"."generate_qr_hash"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_referral_code"() RETURNS character varying
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE 
  new_code VARCHAR(20); 
  code_exists BOOLEAN; 
BEGIN 
  LOOP 
    new_code := 'REF-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8)); 
    SELECT EXISTS(SELECT 1 FROM profiles WHERE referral_code = new_code) INTO code_exists; 
    EXIT WHEN NOT code_exists; 
  END LOOP; 
  RETURN new_code; 
END; 
$$;


ALTER FUNCTION "public"."generate_referral_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_slug"("title" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  -- Truncate to 50 chars
  base_slug := left(base_slug, 50);
  
  final_slug := base_slug;
  
  -- Check for uniqueness and add counter if needed
  WHILE EXISTS (SELECT 1 FROM events WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  
  RETURN final_slug;
END;
$$;


ALTER FUNCTION "public"."generate_slug"("title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_support_ticket_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    new_number TEXT;
BEGIN
    new_number := 'SUP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                  UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4));
    RETURN new_number;
END;
$$;


ALTER FUNCTION "public"."generate_support_ticket_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_ticket_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Get the next number
  SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM support_tickets
  WHERE ticket_number LIKE 'SR-%';
  
  -- Format as SR-00001, SR-00002, etc.
  NEW.ticket_number := 'SR-' || LPAD(next_num::TEXT, 5, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_ticket_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_stats"("p_event_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_tickets_sold', (SELECT COALESCE(SUM(quantity), 0) FROM tickets WHERE event_id = p_event_id AND payment_status = 'completed'),
    'total_revenue', (SELECT COALESCE(SUM(total_amount), 0) FROM tickets WHERE event_id = p_event_id AND payment_status = 'completed'),
    'total_checked_in', (SELECT COUNT(*) FROM tickets WHERE event_id = p_event_id AND checked_in = true),
    'total_capacity', (SELECT COALESCE(SUM(quantity), 0) FROM ticket_types WHERE event_id = p_event_id),
    'tickets_available', (SELECT COALESCE(SUM(quantity - quantity_sold), 0) FROM ticket_types WHERE event_id = p_event_id)
  ) INTO result;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_event_stats"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_waitlist_position"("p_event_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(position) + 1 FROM waitlist WHERE event_id = p_event_id),
    1
  );
END;
$$;


ALTER FUNCTION "public"."get_next_waitlist_position"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organizer_stats"("p_organizer_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_events', (SELECT COUNT(*) FROM events WHERE organizer_id = p_organizer_id),
    'published_events', (SELECT COUNT(*) FROM events WHERE organizer_id = p_organizer_id AND status = 'published'),
    'total_tickets_sold', (SELECT COALESCE(SUM(quantity), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.organizer_id = p_organizer_id AND t.payment_status = 'completed'),
    'total_revenue', (SELECT COALESCE(SUM(total_amount), 0) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.organizer_id = p_organizer_id AND t.payment_status = 'completed'),
    'total_followers', (SELECT COUNT(*) FROM followers WHERE organizer_id = p_organizer_id),
    'total_attendees', (SELECT COUNT(DISTINCT user_id) FROM tickets t JOIN events e ON t.event_id = e.id WHERE e.organizer_id = p_organizer_id AND t.payment_status = 'completed')
  ) INTO result;
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_organizer_stats"("p_organizer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    first_name, 
    last_name, 
    full_name, 
    phone,
    country_code,
    role,
    is_verified,
    is_active,
    created_at, 
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    NEW.raw_user_meta_data->>'country_code',
    'user',
    FALSE,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile creation failed: %', SQLERRM;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_reminder_been_sent"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_template_key" character varying) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM communication_logs
    WHERE event_id = p_event_id
    AND ticket_id = p_ticket_id
    AND template_key = p_template_key
    AND status = 'sent'
  );
END;
$$;


ALTER FUNCTION "public"."has_reminder_been_sent"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_template_key" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ad_clicks"("ad_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE advertisements 
  SET clicks = COALESCE(clicks, 0) + 1 
  WHERE id = ad_id;
END;
$$;


ALTER FUNCTION "public"."increment_ad_clicks"("ad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ad_impressions"("ad_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE advertisements 
  SET impressions = COALESCE(impressions, 0) + 1 
  WHERE id = ad_id;
END;
$$;


ALTER FUNCTION "public"."increment_ad_impressions"("ad_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_promo_usage"("promo_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE promo_codes 
  SET times_used = COALESCE(times_used, 0) + 1,
      updated_at = NOW()
  WHERE id = promo_id;
END;
$$;


ALTER FUNCTION "public"."increment_promo_usage"("promo_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_promoter_clicks"("promoter_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE promoters 
  SET total_clicks = COALESCE(total_clicks, 0) + 1
  WHERE id = promoter_id;
END;
$$;


ALTER FUNCTION "public"."increment_promoter_clicks"("promoter_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_referral_count"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN 
  UPDATE profiles SET referral_count = COALESCE(referral_count, 0) + 1 
  WHERE id = p_user_id AND affiliate_status = 'approved'; 
END; 
$$;


ALTER FUNCTION "public"."increment_referral_count"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_bank_in_cooling_period"("bank_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM organizer_bank_accounts
    WHERE id = bank_id
    AND cooling_until IS NOT NULL
    AND cooling_until > NOW()
  );
END;
$$;


ALTER FUNCTION "public"."is_bank_in_cooling_period"("bank_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_phone" "text", "p_quantity" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_position INT;
  v_existing_id UUID;
  v_waitlist_id UUID;
BEGIN
  -- Check if already on waitlist
  SELECT id INTO v_existing_id
  FROM waitlist
  WHERE event_id = p_event_id 
    AND email = p_email 
    AND status IN ('waiting', 'notified');
  
  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Already on waitlist',
      'code', 'ALREADY_WAITLISTED'
    );
  END IF;

  -- Get next position
  v_position := get_next_waitlist_position(p_event_id);
  
  -- Insert into waitlist
  INSERT INTO waitlist (event_id, user_id, email, name, phone, quantity_wanted, position)
  VALUES (p_event_id, p_user_id, p_email, p_name, p_phone, p_quantity, v_position)
  RETURNING id INTO v_waitlist_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'waitlist_id', v_waitlist_id,
    'position', v_position
  );
END;
$$;


ALTER FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_phone" "text", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_bank_account_change"("p_organizer_id" "uuid", "p_bank_account_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_previous_bank_name" "text" DEFAULT NULL::"text", "p_previous_account_name" "text" DEFAULT NULL::"text", "p_previous_account_number" "text" DEFAULT NULL::"text", "p_new_bank_name" "text" DEFAULT NULL::"text", "p_new_account_name" "text" DEFAULT NULL::"text", "p_new_account_number" "text" DEFAULT NULL::"text", "p_ip_address" "inet" DEFAULT NULL::"inet", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_log_id UUID;
  v_suspicious RECORD;
BEGIN
  SELECT * INTO v_suspicious
  FROM detect_suspicious_bank_change(p_organizer_id, p_user_id, p_change_type, p_ip_address);
  
  INSERT INTO bank_account_changes (
    organizer_id, bank_account_id, user_id, change_type,
    previous_bank_name, previous_account_name, previous_account_number_masked,
    new_bank_name, new_account_name, new_account_number_masked,
    ip_address, user_agent, is_suspicious, suspicious_reason, confirmation_required
  ) VALUES (
    p_organizer_id, p_bank_account_id, p_user_id, p_change_type,
    p_previous_bank_name, p_previous_account_name,
    CASE WHEN p_previous_account_number IS NOT NULL THEN '****' || RIGHT(p_previous_account_number, 4) ELSE NULL END,
    p_new_bank_name, p_new_account_name,
    CASE WHEN p_new_account_number IS NOT NULL THEN '****' || RIGHT(p_new_account_number, 4) ELSE NULL END,
    p_ip_address, p_user_agent, v_suspicious.is_suspicious,
    array_to_string(v_suspicious.reasons, '; '), v_suspicious.require_confirmation
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_bank_account_change"("p_organizer_id" "uuid", "p_bank_account_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_previous_bank_name" "text", "p_previous_account_name" "text", "p_previous_account_number" "text", "p_new_bank_name" "text", "p_new_account_name" "text", "p_new_account_number" "text", "p_ip_address" "inet", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_next_waitlist"("p_event_id" "uuid", "p_hours_valid" integer DEFAULT 24) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_next RECORD;
  v_token UUID;
BEGIN
  -- Get next waiting person
  SELECT * INTO v_next
  FROM waitlist
  WHERE event_id = p_event_id 
    AND status = 'waiting'
  ORDER BY position
  LIMIT 1
  FOR UPDATE;
  
  IF v_next IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No one on waitlist',
      'code', 'EMPTY_WAITLIST'
    );
  END IF;
  
  -- Generate purchase token
  v_token := uuid_generate_v4();
  
  -- Update status
  UPDATE waitlist
  SET 
    status = 'notified',
    notified_at = NOW(),
    expires_at = NOW() + (p_hours_valid || ' hours')::INTERVAL,
    purchase_token = v_token,
    updated_at = NOW()
  WHERE id = v_next.id;
  
  RETURN jsonb_build_object(
    'success', true,
    'waitlist_id', v_next.id,
    'email', v_next.email,
    'name', v_next.name,
    'quantity', v_next.quantity_wanted,
    'purchase_token', v_token,
    'expires_at', NOW() + (p_hours_valid || ' hours')::INTERVAL
  );
END;
$$;


ALTER FUNCTION "public"."notify_next_waitlist"("p_event_id" "uuid", "p_hours_valid" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_role_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND admin_role IN ('admin', 'super_admin')
  ) INTO is_admin;

  IF NOT is_admin THEN
    IF (OLD.role IS DISTINCT FROM NEW.role) OR (OLD.admin_role IS DISTINCT FROM NEW.admin_role) THEN
      RAISE EXCEPTION 'Only administrators can modify role columns';
    END IF;
    
    IF OLD.id != auth.uid() THEN
      RAISE EXCEPTION 'You can only update your own profile';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."protect_role_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_scheduled_events"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE events 
  SET 
    status = 'published',
    updated_at = NOW()
  WHERE 
    status = 'scheduled' 
    AND publish_at IS NOT NULL 
    AND publish_at <= NOW();
END;
$$;


ALTER FUNCTION "public"."publish_scheduled_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_ticket_sale"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.payment_status = 'completed' AND (OLD.payment_status IS NULL OR OLD.payment_status != 'completed') THEN
    -- NOTE: quantity_sold is handled by reserve_tickets RPC, not here
    
    -- Update promoter stats if applicable
    IF NEW.promoter_id IS NOT NULL THEN
      UPDATE promoters 
      SET total_sales = total_sales + 1,
          total_revenue = total_revenue + NEW.total_amount,
          total_commission = total_commission + (
            CASE 
              WHEN commission_type = 'percentage' THEN (NEW.total_amount * commission_value / 100)
              ELSE commission_value
            END
          )
      WHERE id = NEW.promoter_id;
    END IF;
    
    -- Update promo code usage if applicable
    IF NEW.promo_code_id IS NOT NULL THEN
      UPDATE promo_codes 
      SET used_count = used_count + 1 
      WHERE id = NEW.promo_code_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_ticket_sale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reinstate_affiliate"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN 
  UPDATE profiles SET affiliate_status = 'approved' 
  WHERE id = p_user_id AND affiliate_status = 'suspended'; 
  
  IF NOT FOUND THEN 
    RETURN json_build_object('success', false, 'message', 'User is not a suspended affiliate'); 
  END IF; 
  
  RETURN json_build_object('success', true, 'message', 'Affiliate reinstated'); 
END; 
$$;


ALTER FUNCTION "public"."reinstate_affiliate"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE ticket_types
  SET 
    quantity_sold = GREATEST(COALESCE(quantity_sold, 0) - p_quantity, 0),
    updated_at = NOW()
  WHERE id = p_ticket_type_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket type not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'released', p_quantity);
END;
$$;


ALTER FUNCTION "public"."release_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reserve_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_available INT;
  v_sold INT;
  v_remaining INT;
  v_ticket_name TEXT;
BEGIN
  -- Lock the row and get current values
  SELECT 
    quantity_available, 
    quantity_sold,
    name
  INTO v_available, v_sold, v_ticket_name
  FROM ticket_types
  WHERE id = p_ticket_type_id
  FOR UPDATE;

  -- Check if ticket type exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ticket type not found',
      'code', 'NOT_FOUND'
    );
  END IF;

  -- Calculate remaining
  v_remaining := v_available - COALESCE(v_sold, 0);

  -- Check availability
  IF v_remaining < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Only %s tickets remaining for %s', v_remaining, v_ticket_name),
      'code', 'INSUFFICIENT_STOCK',
      'available', v_remaining,
      'requested', p_quantity,
      'ticket_name', v_ticket_name
    );
  END IF;

  -- Reserve the tickets (increment quantity_sold)
  UPDATE ticket_types
  SET 
    quantity_sold = COALESCE(quantity_sold, 0) + p_quantity,
    updated_at = NOW()
  WHERE id = p_ticket_type_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'reserved', p_quantity,
    'remaining', v_remaining - p_quantity,
    'ticket_name', v_ticket_name
  );
END;
$$;


ALTER FUNCTION "public"."reserve_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_bank_cooling_period"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND 
    (OLD.account_number IS DISTINCT FROM NEW.account_number OR
     OLD.bank_code IS DISTINCT FROM NEW.bank_code)) THEN
    NEW.cooling_until := NOW() + INTERVAL '48 hours';
    NEW.is_verified := FALSE;
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_bank_cooling_period"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_slug"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_event_slug"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."suspend_affiliate"("p_user_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN 
  UPDATE profiles SET affiliate_status = 'suspended' 
  WHERE id = p_user_id AND affiliate_status = 'approved'; 
  
  IF NOT FOUND THEN 
    RETURN json_build_object('success', false, 'message', 'User is not an active affiliate'); 
  END IF; 
  
  RETURN json_build_object('success', true, 'message', 'Affiliate suspended'); 
END; 
$$;


ALTER FUNCTION "public"."suspend_affiliate"("p_user_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_organizer_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE organizers SET email = NEW.email WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_organizer_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."transfer_ticket"("p_ticket_id" "uuid", "p_from_user_id" "uuid", "p_to_user_email" "text", "p_payment_reference" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_ticket RECORD;
  v_event RECORD;
  v_to_user RECORD;
  v_new_qr_code TEXT;
  v_old_qr_code TEXT;
  v_original_buyer UUID;
  v_transfer_ref TEXT;
  v_original_tx_id TEXT;
BEGIN
  -- Get ticket details with payment info
  SELECT t.*, o.user_id as buyer_id, o.payment_reference as order_payment_ref
  INTO v_ticket 
  FROM tickets t
  JOIN orders o ON t.order_id = o.id
  WHERE t.id = p_ticket_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Ticket not found');
  END IF;
  
  -- Store old ticket code for audit
  v_old_qr_code := v_ticket.ticket_code;
  v_original_tx_id := v_ticket.order_payment_ref;
  
  -- Determine original buyer
  v_original_buyer := COALESCE(v_ticket.original_buyer_id, v_ticket.buyer_id);
  
  -- Only original buyer can transfer (not someone who received via transfer)
  IF v_ticket.transfer_count > 0 THEN
    RETURN json_build_object('success', false, 'message', 'This ticket has already been transferred and cannot be transferred again');
  END IF;
  
  -- Check if user is the original buyer
  IF v_original_buyer != p_from_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Only the original buyer can transfer this ticket');
  END IF;
  
  -- Get event settings
  SELECT * INTO v_event FROM events WHERE id = v_ticket.event_id;
  
  IF NOT v_event.allow_transfers THEN
    RETURN json_build_object('success', false, 'message', 'Transfers are disabled for this event');
  END IF;
  
  -- Check if ticket already used
  IF v_ticket.status = 'used' THEN
    RETURN json_build_object('success', false, 'message', 'Cannot transfer a ticket that has already been used');
  END IF;
  
  -- Check payment if fee > 0
  IF v_event.transfer_fee > 0 AND (p_payment_reference IS NULL OR p_payment_reference = '') THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Payment required',
      'requires_payment', true,
      'transfer_fee', v_event.transfer_fee,
      'currency', v_event.currency
    );
  END IF;
  
  -- Find recipient by email
  SELECT * INTO v_to_user FROM profiles WHERE LOWER(email) = LOWER(p_to_user_email);
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Recipient must have a Ticketrack account. Ask them to sign up first.');
  END IF;
  
  -- Cannot transfer to yourself
  IF v_to_user.id = p_from_user_id THEN
    RETURN json_build_object('success', false, 'message', 'Cannot transfer ticket to yourself');
  END IF;
  
  -- Generate new QR code and transfer reference
  v_new_qr_code := 'TKT-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 12));
  v_transfer_ref := 'TRF-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || NOW()::TEXT) FROM 1 FOR 8));
  
  -- Update ticket
  UPDATE tickets SET
    user_id = v_to_user.id,
    attendee_name = v_to_user.full_name,
    attendee_email = v_to_user.email,
    attendee_phone = v_to_user.phone,
    ticket_code = v_new_qr_code,
    transfer_count = 1,
    transferred_at = NOW(),
    transferred_from_user_id = p_from_user_id,
    original_buyer_id = v_original_buyer
  WHERE id = p_ticket_id;
  
  -- Log the transfer with full audit data
  INSERT INTO ticket_transfers (
    ticket_id, from_user_id, to_user_id, transfer_number, 
    fee_amount, fee_currency, event_id,
    transfer_reference, old_ticket_code, new_ticket_code,
    original_transaction_id, payment_status, payment_reference
  )
  VALUES (
    p_ticket_id, p_from_user_id, v_to_user.id, 1,
    v_event.transfer_fee, v_event.currency, v_event.id,
    v_transfer_ref, v_old_qr_code, v_new_qr_code,
    v_original_tx_id, 
    CASE WHEN v_event.transfer_fee > 0 THEN 'paid' ELSE 'free' END,
    p_payment_reference
  );
  
  RETURN json_build_object(
    'success', true, 
    'message', 'Ticket transferred successfully',
    'transfer_reference', v_transfer_ref,
    'old_ticket_code', v_old_qr_code,
    'new_ticket_code', v_new_qr_code,
    'recipient_name', v_to_user.full_name,
    'recipient_email', v_to_user.email,
    'transfer_fee', v_event.transfer_fee
  );
END;
$$;


ALTER FUNCTION "public"."transfer_ticket"("p_ticket_id" "uuid", "p_from_user_id" "uuid", "p_to_user_email" "text", "p_payment_reference" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_auto_payouts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  response_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://bkvbvggngttrizbchygy.supabase.co/functions/v1/auto-trigger-payouts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) INTO response_id;
  
  RAISE NOTICE 'Auto-payout triggered, response_id: %', response_id;
END;
$$;


ALTER FUNCTION "public"."trigger_auto_payouts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_organizer_event_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE organizers SET total_events = (
      SELECT COUNT(*) FROM events WHERE organizer_id = NEW.organizer_id AND status = 'published'
    ) WHERE id = NEW.organizer_id;
  END IF;
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.organizer_id != NEW.organizer_id) THEN
    UPDATE organizers SET total_events = (
      SELECT COUNT(*) FROM events WHERE organizer_id = OLD.organizer_id AND status = 'published'
    ) WHERE id = OLD.organizer_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."update_organizer_event_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_organizer_kyc_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE organizers 
  SET kyc_verified = (NEW.verification_level >= 1),
      kyc_level = NEW.verification_level
  WHERE id = NEW.organizer_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_organizer_kyc_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_promoter_sales"("p_promoter_id" "uuid", "p_sale_amount" numeric, "p_commission" numeric, "p_ticket_count" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE promoters 
  SET 
    total_sales = COALESCE(total_sales, 0) + p_ticket_count,
    total_revenue = COALESCE(total_revenue, 0) + p_sale_amount,
    total_earned = COALESCE(total_earned, 0) + p_commission,
    total_commission = COALESCE(total_commission, 0) + p_commission,
    updated_at = NOW()
  WHERE id = p_promoter_id;
END;
$$;


ALTER FUNCTION "public"."update_promoter_sales"("p_promoter_id" "uuid", "p_sale_amount" numeric, "p_commission" numeric, "p_ticket_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_support_ticket_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_support_ticket_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_invite_code"("p_event_id" "uuid", "p_code" character varying, "p_user_email" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
  SET current_uses = current_uses + 1 
  WHERE id = v_code_record.id;
  
  -- Record usage
  INSERT INTO invite_code_usage (invite_code_id, user_id, user_email)
  VALUES (v_code_record.id, auth.uid(), p_user_email);
  
  RETURN jsonb_build_object(
    'valid', true, 
    'code_id', v_code_record.id,
    'code_name', v_code_record.name
  );
END;
$$;


ALTER FUNCTION "public"."validate_invite_code"("p_event_id" "uuid", "p_code" character varying, "p_user_email" character varying) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_actions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "action" character varying(100) NOT NULL,
    "target_type" character varying(50),
    "target_id" "uuid",
    "details" "jsonb",
    "ip_address" character varying(45),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "recipient_type" "text" NOT NULL,
    "total_recipients" integer DEFAULT 0,
    "total_sent" integer DEFAULT 0,
    "total_failed" integer DEFAULT 0,
    "status" "text" DEFAULT 'draft'::"text",
    "scheduled_for" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_impersonation_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid" NOT NULL,
    "admin_email" "text",
    "target_organizer_id" "uuid" NOT NULL,
    "target_organizer_name" "text",
    "reason" "text",
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "actions_performed" "jsonb" DEFAULT '[]'::"jsonb",
    "target_user_id" "uuid",
    "target_user_type" character varying(20)
);


ALTER TABLE "public"."admin_impersonation_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "admin_id" "uuid",
    "action" character varying(100) NOT NULL,
    "target_type" character varying(50),
    "target_id" "uuid",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advance_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_type" "text" NOT NULL,
    "organizer_id" "uuid",
    "promoter_id" "uuid",
    "event_id" "uuid",
    "available_balance" numeric(12,2) NOT NULL,
    "advance_amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'NGN'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "transaction_reference" "text",
    "payment_method" "text",
    "payment_notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "paid_by" "uuid",
    "paid_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "advance_payments_recipient_type_check" CHECK (("recipient_type" = ANY (ARRAY['organizer'::"text", 'promoter'::"text"]))),
    CONSTRAINT "advance_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'paid'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "advance_recipient_check" CHECK (((("recipient_type" = 'organizer'::"text") AND ("organizer_id" IS NOT NULL)) OR (("recipient_type" = 'promoter'::"text") AND ("promoter_id" IS NOT NULL))))
);


ALTER TABLE "public"."advance_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advertisements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "advertiser_name" character varying(255) NOT NULL,
    "image_url" "text" NOT NULL,
    "link_url" "text",
    "position" character varying(50) NOT NULL,
    "media_type" character varying(20) DEFAULT 'image'::character varying,
    "is_active" boolean DEFAULT true,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "impressions" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "advertisements_media_type_check" CHECK ((("media_type")::"text" = ANY ((ARRAY['image'::character varying, 'video'::character varying])::"text"[]))),
    CONSTRAINT "advertisements_position_check" CHECK ((("position")::"text" = ANY ((ARRAY['top'::character varying, 'bottom'::character varying, 'left'::character varying, 'right'::character varying])::"text"[])))
);


ALTER TABLE "public"."advertisements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."affiliate_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "is_enabled" boolean DEFAULT true,
    "commission_percent" numeric DEFAULT 40,
    "min_payout" numeric DEFAULT 5000,
    "min_payout_usd" numeric DEFAULT 10,
    "min_payout_gbp" numeric DEFAULT 8,
    "cookie_days" integer DEFAULT 7,
    "payout_delay_days" integer DEFAULT 7,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."affiliate_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "action" character varying(100) NOT NULL,
    "table_name" character varying(100),
    "record_id" "uuid",
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" character varying(45),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_account_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "bank_account_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "change_type" character varying(20) NOT NULL,
    "previous_bank_name" character varying(100),
    "previous_account_name" character varying(200),
    "previous_account_number_masked" character varying(20),
    "new_bank_name" character varying(100),
    "new_account_name" character varying(200),
    "new_account_number_masked" character varying(20),
    "ip_address" "inet",
    "user_agent" "text",
    "device_fingerprint" character varying(100),
    "location_city" character varying(100),
    "location_country" character varying(100),
    "confirmation_required" boolean DEFAULT false,
    "confirmation_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "confirmation_ip" "inet",
    "is_suspicious" boolean DEFAULT false,
    "suspicious_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "bank_account_changes_change_type_check" CHECK ((("change_type")::"text" = ANY ((ARRAY['added'::character varying, 'updated'::character varying, 'removed'::character varying, 'verified'::character varying, 'locked'::character varying, 'unlocked'::character varying])::"text"[])))
);


ALTER TABLE "public"."bank_account_changes" OWNER TO "postgres";


COMMENT ON TABLE "public"."bank_account_changes" IS 'Audit log for all bank account modifications';



CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "country_code" character varying(3) NOT NULL,
    "account_name" character varying(255) NOT NULL,
    "bank_name" character varying(255) NOT NULL,
    "account_number_encrypted" "bytea" NOT NULL,
    "currency" character varying(3) NOT NULL,
    "is_default" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "routing_number" character varying(20),
    "sort_code" character varying(10),
    "transit_number" character varying(10),
    "institution_number" character varying(10),
    "account_type" character varying(20),
    "bank_code" character varying(20)
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_recipients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid",
    "email" character varying(255) NOT NULL,
    "name" character varying(255),
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "sent_at" timestamp with time zone,
    "opened_at" timestamp with time zone,
    "clicked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_recipients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "slug" character varying(100) NOT NULL,
    "icon" character varying(10),
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkin_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "event_id" "uuid",
    "device_name" character varying(100) NOT NULL,
    "device_code" character varying(20) NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_active_at" timestamp with time zone,
    "total_checkins" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checkin_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkin_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid",
    "event_id" "uuid",
    "device_id" "uuid",
    "checked_in_by" "uuid",
    "action" character varying(20) DEFAULT 'check_in'::character varying,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."checkin_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."communication_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "channel" character varying(20) DEFAULT 'email'::character varying NOT NULL,
    "template_key" character varying(100) NOT NULL,
    "recipient_email" character varying(255),
    "recipient_phone" character varying(50),
    "recipient_user_id" "uuid",
    "event_id" "uuid",
    "ticket_id" "uuid",
    "order_id" "uuid",
    "waitlist_id" "uuid",
    "subject" character varying(500),
    "status" character varying(20) DEFAULT 'queued'::character varying NOT NULL,
    "provider" character varying(50),
    "provider_message_id" character varying(255),
    "error_message" "text",
    "retry_count" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."communication_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."communication_logs" IS 'Central audit trail for all platform communications (email, SMS, push, WhatsApp)';



COMMENT ON COLUMN "public"."communication_logs"."template_key" IS 'Email template identifier, e.g., ticket_purchase, event_reminder_24h';



COMMENT ON COLUMN "public"."communication_logs"."metadata" IS 'Flexible JSON for additional context like template data';



CREATE TABLE IF NOT EXISTS "public"."countries" (
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "default_currency" "text",
    "platform_fee_percentage" numeric(5,2) DEFAULT 10,
    "service_fee_percentage" numeric(5,2) DEFAULT 5,
    "service_fee_fixed" numeric(12,2) DEFAULT 0,
    "payment_processing_fee_percentage" numeric(5,2) DEFAULT 1.5,
    "payout_fee" numeric(12,2) DEFAULT 50,
    "min_payout_amount" numeric(12,2) DEFAULT 5000,
    "payment_provider" "text" DEFAULT 'paystack'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "service_fee_fixed_per_ticket" numeric(10,2) DEFAULT 0,
    "processing_fee_fixed_per_order" numeric(10,2) DEFAULT 0,
    "service_fee_cap" numeric(10,2) DEFAULT NULL::numeric,
    "stripe_processing_fee_pct" numeric(5,2) DEFAULT 2.9,
    "stripe_processing_fee_fixed" numeric(10,2) DEFAULT 0.30,
    "paystack_processing_fee_pct" numeric(5,2) DEFAULT 1.5,
    "paystack_processing_fee_fixed" numeric(10,2) DEFAULT 100,
    "flutterwave_processing_fee_pct" numeric(5,2) DEFAULT 1.4,
    "flutterwave_processing_fee_fixed" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."countries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."country_features" (
    "country_code" "text" NOT NULL,
    "feature_id" "text" NOT NULL,
    "is_enabled" boolean DEFAULT false,
    "config" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."country_features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."currencies" (
    "code" "text" NOT NULL,
    "symbol" "text" NOT NULL,
    "name" "text" NOT NULL,
    "locale" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."currencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_field_responses" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "custom_field_id" "uuid" NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "response_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_field_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "sender_type" character varying(20) DEFAULT 'admin'::character varying,
    "organizer_id" "uuid",
    "recipient_type" character varying(50),
    "recipient_email" "text",
    "recipient_count" integer DEFAULT 0,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "template_used" character varying(100),
    "event_id" "uuid",
    "status" character varying(20) DEFAULT 'sent'::character varying,
    "error_message" "text",
    "opened_count" integer DEFAULT 0,
    "clicked_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "name" character varying(255) NOT NULL,
    "subject" character varying(255) NOT NULL,
    "body" "text" NOT NULL,
    "target_audience" character varying(50) DEFAULT 'all'::character varying,
    "recipients_count" integer DEFAULT 0,
    "sent_count" integer DEFAULT 0,
    "opened_count" integer DEFAULT 0,
    "clicked_count" integer DEFAULT 0,
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "recipient_type" "text" DEFAULT 'event_attendees'::"text",
    "scheduled_for" timestamp with time zone,
    "total_recipients" integer DEFAULT 0,
    "total_failed" integer DEFAULT 0
);


ALTER TABLE "public"."email_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_rate_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "rate_key" character varying(50) DEFAULT 'standard'::character varying NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_rate_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."email_rate_limits" IS 'Tracks email sends per user for rate limiting. Used by send-email Edge Function.';



COMMENT ON COLUMN "public"."email_rate_limits"."rate_key" IS 'Rate limit category: standard (50/hour), bulk_campaign (1000/day), admin_broadcast (10000/day)';



COMMENT ON COLUMN "public"."email_rate_limits"."window_start" IS 'Start of the rate limit window (rounded to hour for standard, day for bulk)';



COMMENT ON COLUMN "public"."email_rate_limits"."count" IS 'Number of emails sent in this window';



CREATE TABLE IF NOT EXISTS "public"."email_send_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "sent_count" integer DEFAULT 0,
    "daily_limit" integer DEFAULT 1000
);


ALTER TABLE "public"."email_send_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."email_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text",
    "variables" "text"[] DEFAULT '{}'::"text"[],
    "is_system" boolean DEFAULT false,
    "owner_type" "text" DEFAULT 'system'::"text",
    "owner_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."email_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_custom_fields" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "field_label" character varying(255) NOT NULL,
    "field_type" character varying(20) DEFAULT 'text'::character varying NOT NULL,
    "field_options" "jsonb",
    "is_required" boolean DEFAULT false,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_custom_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_day_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_day_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone,
    "description" "text",
    "location" character varying(255),
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_day_activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "day_number" integer NOT NULL,
    "date" "date" NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "title" character varying(255),
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_days" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_earnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid",
    "organizer_id" "uuid",
    "total_sales" numeric(12,2) DEFAULT 0,
    "total_tickets" integer DEFAULT 0,
    "platform_fee" numeric(10,2) DEFAULT 0,
    "payment_gateway_fee" numeric(10,2) DEFAULT 0,
    "net_earnings" numeric(12,2) DEFAULT 0,
    "amount_released" numeric(12,2) DEFAULT 0,
    "amount_pending" numeric(12,2) DEFAULT 0,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "release_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_earnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_email_whitelist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "email" character varying(255) NOT NULL,
    "name" character varying(100),
    "invited_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "has_accessed" boolean DEFAULT false,
    "accessed_at" timestamp with time zone
);


ALTER TABLE "public"."event_email_whitelist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "changed_by" "uuid",
    "change_type" character varying(50) NOT NULL,
    "previous_data" "jsonb",
    "new_data" "jsonb",
    "changed_fields" "text"[],
    "ip_address" character varying(45),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_images" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_invite_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "code" character varying(20) NOT NULL,
    "name" character varying(100),
    "max_uses" integer,
    "current_uses" integer DEFAULT 0,
    "expires_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."event_invite_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_sponsors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "logo_url" "text" NOT NULL,
    "name" character varying(255),
    "website_url" "text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."event_sponsors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "phase" "text" DEFAULT 'pre_event'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "due_date" timestamp with time zone,
    "assigned_to" "uuid",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estimated_hours" numeric(5,2),
    "labels" "text"[] DEFAULT '{}'::"text"[],
    CONSTRAINT "event_tasks_phase_check" CHECK (("phase" = ANY (ARRAY['pre_event'::"text", 'during_event'::"text", 'post_event'::"text"]))),
    CONSTRAINT "event_tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "event_tasks_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'completed'::"text", 'blocked'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."event_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "category_id" "uuid",
    "country_code" character varying(3) NOT NULL,
    "title" character varying(255) NOT NULL,
    "slug" character varying(255),
    "description" "text",
    "image_url" "text",
    "venue_name" character varying(255) NOT NULL,
    "venue_address" "text",
    "city" character varying(100) NOT NULL,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "timezone" character varying(50) DEFAULT 'Africa/Lagos'::character varying,
    "status" character varying(20) DEFAULT 'draft'::character varying,
    "is_featured" boolean DEFAULT false,
    "is_free" boolean DEFAULT false,
    "fee_handling" character varying(20) DEFAULT 'pass_to_attendee'::character varying,
    "total_capacity" integer,
    "tickets_sold" integer DEFAULT 0,
    "total_revenue" numeric(15,2) DEFAULT 0,
    "views_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_at" timestamp with time zone,
    "sponsors" "text"[] DEFAULT '{}'::"text"[],
    "event_type" character varying(100),
    "google_map_link" "text",
    "venue_type" character varying(50) DEFAULT 'indoor'::character varying,
    "seating_type" character varying(50) DEFAULT 'Standing'::character varying,
    "venue_lat" numeric(10,8),
    "venue_lng" numeric(11,8),
    "gate_opening_time" time without time zone,
    "is_multi_day" boolean DEFAULT false,
    "is_recurring" boolean DEFAULT false,
    "is_adult_only" boolean DEFAULT false,
    "is_wheelchair_accessible" boolean DEFAULT false,
    "is_byob" boolean DEFAULT false,
    "dress_code" character varying(255),
    "promo_video_url" "text",
    "category" character varying(100),
    "suspension_reason" "text",
    "suspension_note" "text",
    "suspended_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "cancelled_reason" "text",
    "cancelled_by" "uuid",
    "currency" character varying(3) DEFAULT 'NGN'::character varying NOT NULL,
    "custom_url" "text",
    "is_photography_allowed" boolean DEFAULT true,
    "is_recording_allowed" boolean DEFAULT true,
    "is_parking_available" boolean DEFAULT false,
    "is_outside_food_allowed" boolean DEFAULT false,
    "accepts_donations" boolean DEFAULT false,
    "donation_amounts" "jsonb" DEFAULT '[]'::"jsonb",
    "allow_custom_donation" boolean DEFAULT false,
    "allow_refunds" boolean DEFAULT true,
    "refund_deadline_hours" integer DEFAULT 48,
    "recurring_type" "text",
    "recurring_days" integer[],
    "recurring_end_type" "text",
    "recurring_occurrences" integer,
    "recurring_end_date" timestamp with time zone,
    "parent_event_id" "uuid",
    "max_tickets_per_order" integer DEFAULT 10,
    "visibility" character varying(20) DEFAULT 'public'::character varying,
    "access_password" "text",
    "access_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_virtual" boolean DEFAULT false,
    "streaming_url" "text",
    "streaming_platform" character varying(50),
    "recurring_pattern" "jsonb",
    "publish_at" timestamp with time zone,
    "allow_transfers" boolean DEFAULT false,
    "max_transfers" integer DEFAULT 1,
    "transfer_fee" numeric(10,2) DEFAULT 0,
    "payout_status" "text" DEFAULT 'pending'::"text",
    CONSTRAINT "events_fee_handling_check" CHECK ((("fee_handling")::"text" = ANY ((ARRAY['pass_to_attendee'::character varying, 'absorb'::character varying])::"text"[]))),
    CONSTRAINT "events_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'scheduled'::character varying, 'cancelled'::character varying, 'completed'::character varying])::"text"[])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."is_photography_allowed" IS 'Whether photography is allowed at the event';



COMMENT ON COLUMN "public"."events"."is_recording_allowed" IS 'Whether video recording is allowed';



COMMENT ON COLUMN "public"."events"."is_parking_available" IS 'Whether parking is available at venue';



COMMENT ON COLUMN "public"."events"."is_outside_food_allowed" IS 'Whether attendees can bring outside food';



COMMENT ON COLUMN "public"."events"."visibility" IS 'Event visibility: public, unlisted, password, invite_only, email_whitelist';



COMMENT ON COLUMN "public"."events"."access_password" IS 'Hashed password for password-protected events';



COMMENT ON COLUMN "public"."events"."access_settings" IS 'JSON config: {show_details_before_auth: bool, require_auth_for_purchase_only: bool}';



COMMENT ON COLUMN "public"."events"."is_virtual" IS 'Whether this is a virtual/online event';



COMMENT ON COLUMN "public"."events"."streaming_url" IS 'The streaming link (Zoom, YouTube, etc.) - revealed only to ticket holders';



COMMENT ON COLUMN "public"."events"."streaming_platform" IS 'Platform name: zoom, youtube, google_meet, twitch, other';



CREATE TABLE IF NOT EXISTS "public"."features" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text"
);


ALTER TABLE "public"."features" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "details" "jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."finance_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finance_users" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'finance_viewer'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "last_login_at" timestamp with time zone,
    CONSTRAINT "finance_users_role_check" CHECK (("role" = ANY (ARRAY['finance_viewer'::"text", 'finance_admin'::"text", 'super_admin'::"text"])))
);


ALTER TABLE "public"."finance_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "notifications_enabled" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."followers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_code_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invite_code_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_email" character varying(255),
    "used_at" timestamp with time zone DEFAULT "now"(),
    "order_id" "uuid"
);


ALTER TABLE "public"."invite_code_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kyc_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "document_type" character varying(50) NOT NULL,
    "document_url" "text" NOT NULL,
    "document_number" character varying(100),
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "expires_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kyc_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kyc_verifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "verification_level" integer DEFAULT 0,
    "bvn" character varying(11),
    "bvn_verified" boolean DEFAULT false,
    "bvn_first_name" character varying(100),
    "bvn_last_name" character varying(100),
    "bvn_dob" "date",
    "bvn_phone" character varying(20),
    "bvn_verified_at" timestamp with time zone,
    "nin" character varying(11),
    "nin_verified" boolean DEFAULT false,
    "nin_verified_at" timestamp with time zone,
    "id_type" character varying(50),
    "id_number" character varying(50),
    "id_document_url" "text",
    "id_verified" boolean DEFAULT false,
    "id_verified_at" timestamp with time zone,
    "cac_number" character varying(20),
    "cac_document_url" "text",
    "cac_verified" boolean DEFAULT false,
    "cac_verified_at" timestamp with time zone,
    "selfie_url" "text",
    "selfie_verified" boolean DEFAULT false,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "rejection_reason" "text",
    "monthly_payout_limit" numeric(12,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kyc_verifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."legal_documents" (
    "id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "version" "text" DEFAULT '1.0'::"text",
    "is_required" boolean DEFAULT true,
    "applies_to" "text" DEFAULT 'all'::"text",
    "published_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."legal_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."login_attempts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255),
    "ip_address" character varying(45) NOT NULL,
    "success" boolean NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."login_attempts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "email_marketing" boolean DEFAULT true,
    "email_transactional" boolean DEFAULT true,
    "sms_marketing" boolean DEFAULT true,
    "sms_transactional" boolean DEFAULT true,
    "whatsapp_marketing" boolean DEFAULT true,
    "push_notifications" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "subtotal" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_number" character varying(20) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "subtotal" numeric(12,2) NOT NULL,
    "platform_fee" numeric(12,2) NOT NULL,
    "tax_amount" numeric(12,2) NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "currency" character varying(3) NOT NULL,
    "payment_method" character varying(50),
    "payment_reference" character varying(255),
    "payment_provider" character varying(50) DEFAULT 'paystack'::character varying,
    "paid_at" timestamp with time zone,
    "promo_code_id" "uuid",
    "discount_amount" numeric(12,2) DEFAULT 0,
    "buyer_name" character varying(255),
    "buyer_email" character varying(255),
    "buyer_phone" character varying(20),
    "notes" "text",
    "ip_address" character varying(45),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "waitlist_id" "uuid",
    "referred_by" "uuid",
    "referral_code_used" character varying(20),
    "referral_commission" numeric DEFAULT 0,
    "referral_status" character varying(20) DEFAULT 'none'::character varying,
    "referral_ip" character varying(50),
    "is_stripe_connect" boolean DEFAULT false,
    "stripe_transfer_id" character varying(255),
    "platform_fee_amount" numeric(10,2),
    "organizer_payout_amount" numeric(10,2),
    "stripe_account_id" character varying(255),
    "stripe_fee_amount" numeric(10,2),
    CONSTRAINT "orders_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'completed'::character varying, 'failed'::character varying, 'refunded'::character varying, 'cancelled'::character varying, 'refund_pending'::character varying])::"text"[])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."waitlist_id" IS 'Links to waitlist entry if this order originated from waitlist purchase flow';



COMMENT ON COLUMN "public"."orders"."is_stripe_connect" IS 'True if payment was processed via Stripe Connect';



COMMENT ON COLUMN "public"."orders"."platform_fee_amount" IS 'Ticketrack platform fee collected on this order';



COMMENT ON COLUMN "public"."orders"."organizer_payout_amount" IS 'Amount that went to organizer via Connect';



CREATE TABLE IF NOT EXISTS "public"."organizer_bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "bank_name" character varying(100) NOT NULL,
    "bank_code" character varying(20) NOT NULL,
    "account_number" character varying(50) NOT NULL,
    "account_name" character varying(200) NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_default" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "cooling_until" timestamp with time zone,
    "confirmation_token" "uuid",
    "confirmation_expires_at" timestamp with time zone,
    "is_pending_confirmation" boolean DEFAULT false,
    "security_locked" boolean DEFAULT false,
    "lock_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizer_bank_accounts" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizer_bank_accounts" IS 'Bank accounts for organizer payouts with security features';



COMMENT ON COLUMN "public"."organizer_bank_accounts"."cooling_until" IS '48-hour security hold - no payouts until this time';



COMMENT ON COLUMN "public"."organizer_bank_accounts"."is_pending_confirmation" IS 'Requires email confirmation before activation';



CREATE TABLE IF NOT EXISTS "public"."organizer_follows" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizer_follows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_sms_wallet" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "balance" integer DEFAULT 0,
    "total_purchased" integer DEFAULT 0,
    "total_used" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizer_sms_wallet" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text",
    "role" "text" DEFAULT 'staff'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone,
    "invited_by" "uuid",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "invitation_token" "uuid" DEFAULT "gen_random_uuid"(),
    "invitation_expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval),
    "first_name" character varying(100),
    "last_name" character varying(100),
    CONSTRAINT "organizer_team_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'manager'::"text", 'coordinator'::"text", 'staff'::"text"]))),
    CONSTRAINT "organizer_team_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."organizer_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_whatsapp_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "provider" character varying(50) DEFAULT 'manual'::character varying,
    "api_key" "text",
    "phone_number_id" "text",
    "business_account_id" "text",
    "webhook_secret" "text",
    "is_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizer_whatsapp_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizer_whatsapp_wallet" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid",
    "balance" numeric(12,4) DEFAULT 0,
    "total_purchased" numeric(12,4) DEFAULT 0,
    "total_used" numeric(12,4) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organizer_whatsapp_wallet" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "business_name" character varying(255) NOT NULL,
    "business_email" character varying(255),
    "business_phone" character varying(20),
    "description" "text",
    "logo_url" "text",
    "cover_image_url" "text",
    "website_url" "text",
    "social_twitter" "text",
    "social_facebook" "text",
    "social_instagram" "text",
    "social_linkedin" "text",
    "country_code" character varying(3),
    "is_verified" boolean DEFAULT false,
    "verification_level" character varying(20),
    "verified_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "total_events" integer DEFAULT 0,
    "total_tickets_sold" integer DEFAULT 0,
    "total_revenue" numeric(15,2) DEFAULT 0,
    "average_rating" numeric(3,2) DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "banner_url" "text",
    "available_balance" numeric(12,2) DEFAULT 0,
    "pending_balance" numeric(12,2) DEFAULT 0,
    "kyc_status" character varying(50) DEFAULT 'pending'::character varying,
    "kyc_verified" boolean DEFAULT false,
    "kyc_level" integer DEFAULT 0,
    "email" character varying(255),
    "phone" character varying(50),
    "website" character varying(255),
    "location" character varying(255),
    "instagram" character varying(100),
    "twitter" character varying(100),
    "facebook" character varying(255),
    "linkedin" character varying(255),
    "is_trusted" boolean DEFAULT false,
    "trusted_at" timestamp with time zone,
    "trusted_by" "uuid",
    "custom_fee_enabled" boolean DEFAULT false,
    "custom_service_fee_percentage" numeric(5,2),
    "custom_service_fee_fixed" numeric(10,2),
    "custom_fee_set_by" "uuid",
    "custom_fee_set_at" timestamp with time zone,
    "stripe_connect_id" character varying(255),
    "stripe_connect_status" character varying(50) DEFAULT 'not_started'::character varying,
    "stripe_connect_enabled" boolean DEFAULT false,
    "stripe_connect_onboarded_at" timestamp with time zone,
    "stripe_connect_terms_accepted_at" timestamp with time zone,
    "stripe_connect_payouts_enabled" boolean DEFAULT false,
    "stripe_connect_charges_enabled" boolean DEFAULT false,
    "stripe_connect_disabled_reason" "text",
    "stripe_connect_disabled_at" timestamp with time zone,
    "stripe_connect_disabled_by" "uuid",
    "stripe_identity_session_id" "text",
    "stripe_identity_status" "text",
    "custom_service_fee_cap" numeric(10,2) DEFAULT NULL::numeric,
    CONSTRAINT "organizers_verification_level_check" CHECK ((("verification_level")::"text" = ANY ((ARRAY['bronze'::character varying, 'silver'::character varying, 'gold'::character varying])::"text"[])))
);


ALTER TABLE "public"."organizers" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organizers"."custom_fee_enabled" IS 'If true, use custom fees instead of country defaults';



COMMENT ON COLUMN "public"."organizers"."custom_service_fee_percentage" IS 'Custom service fee percentage (e.g., 3.5 for 3.5%)';



COMMENT ON COLUMN "public"."organizers"."custom_service_fee_fixed" IS 'Custom fixed service fee in organizer currency';



COMMENT ON COLUMN "public"."organizers"."stripe_connect_id" IS 'Stripe Connected Account ID (acct_xxx)';



COMMENT ON COLUMN "public"."organizers"."stripe_connect_status" IS 'Status: not_started, pending, active, restricted, disabled';



COMMENT ON COLUMN "public"."organizers"."stripe_connect_enabled" IS 'Admin toggle to enable/disable Connect for this organizer';



CREATE TABLE IF NOT EXISTS "public"."payment_gateway_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text",
    "provider" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "public_key" "text",
    "secret_key_encrypted" "text",
    "webhook_secret_encrypted" "text",
    "sandbox_mode" boolean DEFAULT true,
    "config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payment_gateway_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payout_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payout_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "gross_amount" numeric(12,2) NOT NULL,
    "net_amount" numeric(12,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payout_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payout_number" character varying(20) NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" character varying(3) NOT NULL,
    "platform_fee_deducted" numeric(12,2) NOT NULL,
    "tax_deducted" numeric(12,2) DEFAULT 0,
    "net_amount" numeric(12,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "transaction_reference" character varying(255),
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "payouts_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::"text"[])))
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phone_otps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "otp_hash" "text" NOT NULL,
    "type" "text" DEFAULT 'login'::"text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "attempts" integer DEFAULT 0,
    "verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "provider" "text"
);


ALTER TABLE "public"."phone_otps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_adverts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "position" character varying(20) DEFAULT 'top'::character varying NOT NULL,
    "advertiser_name" character varying(255),
    "image_url" "text" NOT NULL,
    "link_url" "text",
    "price" numeric(12,2) DEFAULT 0,
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true,
    "clicks" integer DEFAULT 0,
    "impressions" integer DEFAULT 0,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "media_type" character varying(10) DEFAULT 'image'::character varying
);


ALTER TABLE "public"."platform_adverts" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_adverts" IS 'Platform advertisement system. 
Ad Sizes:
- top: 1200x300px (banner below hero)
- bottom: 1200x300px (banner above download section)  
- left: 300x600px (fixed sidebar, half-page/skyscraper)
- right: 300x600px (fixed sidebar, half-page/skyscraper)';



CREATE TABLE IF NOT EXISTS "public"."platform_branding" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "company_name" "text" DEFAULT 'Ticketrack'::"text",
    "tagline" "text" DEFAULT 'Event ticketing for Africa'::"text",
    "logo_url" "text",
    "favicon_url" "text",
    "primary_color" "text" DEFAULT '#2969FF'::"text",
    "secondary_color" "text" DEFAULT '#0F0F0F'::"text",
    "support_email" "text",
    "support_phone" "text",
    "social_twitter" "text",
    "social_instagram" "text",
    "social_facebook" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_branding" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_limits" (
    "id" "text" NOT NULL,
    "country_code" "text",
    "limit_key" "text" NOT NULL,
    "limit_value" integer NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."platform_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_sms_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" character varying(50) DEFAULT 'termii'::character varying,
    "api_key" "text",
    "secret_key" "text",
    "sender_id" character varying(20) DEFAULT 'Ticketrack'::character varying,
    "is_active" boolean DEFAULT true,
    "balance" numeric(10,2) DEFAULT 0,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cost_per_sms" numeric(10,4) DEFAULT 0.85,
    "selling_price" numeric(10,4) DEFAULT 4.00,
    "currency" character varying(3) DEFAULT 'NGN'::character varying,
    "supported_countries" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."platform_sms_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_whatsapp_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" character varying(50) DEFAULT 'manual'::character varying,
    "api_key" "text",
    "phone_number_id" "text",
    "business_account_id" "text",
    "webhook_secret" "text",
    "is_verified" boolean DEFAULT false,
    "verified_at" timestamp with time zone,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_whatsapp_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" character varying(255),
    "full_name" character varying(255),
    "phone" character varying(20),
    "avatar_url" "text",
    "country_code" character varying(3),
    "role" character varying(20) DEFAULT 'user'::character varying,
    "is_verified" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "last_login_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "first_name" character varying(100),
    "last_name" character varying(100),
    "is_admin" boolean DEFAULT false,
    "admin_role" character varying(50),
    "email_notifications" boolean DEFAULT true,
    "sms_notifications" boolean DEFAULT false,
    "referral_code" character varying(20),
    "affiliate_balance" numeric DEFAULT 0,
    "total_referral_earnings" numeric DEFAULT 0,
    "referral_count" integer DEFAULT 0,
    "affiliate_status" character varying(20) DEFAULT NULL::character varying,
    "finance_access" boolean DEFAULT false,
    "city" "text",
    "country" "text",
    "birth_month" integer,
    "birth_day" integer,
    "interests" "text"[] DEFAULT '{}'::"text"[],
    "billing_address" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "profiles_birth_day_check" CHECK ((("birth_day" >= 1) AND ("birth_day" <= 31))),
    CONSTRAINT "profiles_birth_month_check" CHECK ((("birth_month" >= 1) AND ("birth_month" <= 12))),
    CONSTRAINT "profiles_role_check" CHECK ((("role")::"text" = ANY ((ARRAY['user'::character varying, 'organizer'::character varying, 'admin'::character varying])::"text"[])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promo_codes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "code" character varying(50) NOT NULL,
    "discount_type" character varying(20) NOT NULL,
    "discount_value" numeric(12,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'NGN'::character varying,
    "max_uses" integer,
    "times_used" integer DEFAULT 0,
    "min_purchase_amount" numeric(12,2) DEFAULT 0,
    "starts_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "max_discount_amount" numeric(10,2),
    "usage_limit" integer,
    CONSTRAINT "promo_codes_discount_type_check" CHECK ((("discount_type")::"text" = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::"text"[])))
);


ALTER TABLE "public"."promo_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid",
    "bank_name" character varying(100) NOT NULL,
    "account_number" character varying(20) NOT NULL,
    "account_name" character varying(255) NOT NULL,
    "bank_code" character varying(10),
    "is_primary" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "country" character varying(50) DEFAULT 'Nigeria'::character varying,
    "currency" character varying(10) DEFAULT 'NGN'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promoter_bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_clicks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid",
    "event_id" "uuid",
    "ip_address" character varying(50),
    "user_agent" "text",
    "referrer" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promoter_clicks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid",
    "event_id" "uuid",
    "commission_rate" numeric(5,2),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promoter_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid",
    "bank_account_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "payment_reference" character varying(100),
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "currency" "text" NOT NULL
);


ALTER TABLE "public"."promoter_payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoter_sales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "promoter_id" "uuid",
    "event_id" "uuid",
    "order_id" "uuid",
    "ticket_count" integer NOT NULL,
    "sale_amount" numeric(10,2) NOT NULL,
    "commission_rate" numeric(5,2) NOT NULL,
    "commission_amount" numeric(10,2) NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."promoter_sales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promoters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "full_name" character varying(255) NOT NULL,
    "email" character varying(255) NOT NULL,
    "phone" character varying(50),
    "short_code" character varying(20) NOT NULL,
    "commission_rate" numeric(5,2) DEFAULT 10.00,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "total_clicks" integer DEFAULT 0,
    "total_sales" integer DEFAULT 0,
    "total_revenue" numeric(12,2) DEFAULT 0,
    "total_earned" numeric(12,2) DEFAULT 0,
    "total_paid" numeric(12,2) DEFAULT 0,
    "profile_image" "text",
    "bio" "text",
    "social_links" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organizer_id" "uuid",
    "referral_link" "text",
    "commission_type" character varying(20) DEFAULT 'percentage'::character varying,
    "commission_value" numeric(10,2),
    "event_id" "uuid",
    "is_active" boolean DEFAULT true,
    "name" character varying(255),
    "referral_code" character varying(50),
    "total_commission" numeric(12,2) DEFAULT 0,
    "paid_commission" numeric(12,2) DEFAULT 0
);


ALTER TABLE "public"."promoters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_earnings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "buyer_id" "uuid",
    "order_amount" numeric NOT NULL,
    "platform_fee" numeric NOT NULL,
    "commission_percent" numeric NOT NULL,
    "commission_amount" numeric NOT NULL,
    "currency" character varying(10) DEFAULT 'NGN'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "available_at" timestamp with time zone,
    "ip_address" character varying(50),
    "is_flagged" boolean DEFAULT false,
    "flag_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."referral_earnings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referral_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "currency" character varying(10) DEFAULT 'NGN'::character varying,
    "bank_name" character varying(100),
    "account_number" character varying(20),
    "account_name" character varying(100),
    "payment_reference" character varying(100),
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."referral_payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refund_requests" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid",
    "user_id" "uuid",
    "reason" "text" NOT NULL,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "refund_amount" numeric(12,2),
    "admin_notes" "text",
    "processed_by" "uuid",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ticket_id" "uuid",
    "event_id" "uuid",
    "organizer_id" "uuid",
    "original_amount" numeric(10,2),
    "refund_fee" numeric(10,2) DEFAULT 0,
    "currency" character varying(3),
    "payment_provider" character varying(20),
    "payment_reference" character varying(255),
    "refund_reference" character varying(255),
    "organizer_decision" character varying(20),
    "organizer_notes" "text",
    "organizer_decided_at" timestamp with time zone,
    "organizer_decided_by" "uuid",
    "escalated_to_admin" boolean DEFAULT false,
    "escalation_reason" "text",
    "escalated_at" timestamp with time zone,
    "amount" numeric(12,2),
    "is_stripe_connect" boolean DEFAULT false,
    "platform_fee_refunded" numeric(10,2),
    "stripe_refund_id" character varying(255),
    CONSTRAINT "refund_requests_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'processed'::character varying])::"text"[])))
);


ALTER TABLE "public"."refund_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "rating" integer NOT NULL,
    "review_text" "text",
    "is_visible" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."saved_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_payment_methods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "payment_method_id" "text" NOT NULL,
    "last_four" "text" NOT NULL,
    "brand" "text",
    "exp_month" integer,
    "exp_year" integer,
    "is_default" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "saved_payment_methods_provider_check" CHECK (("provider" = ANY (ARRAY['stripe'::"text", 'paystack'::"text"])))
);


ALTER TABLE "public"."saved_payment_methods" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_type" "text" NOT NULL,
    "recipient_filter" "jsonb" DEFAULT '{}'::"jsonb",
    "recipient_count" integer DEFAULT 0,
    "template_id" "uuid",
    "subject" "text" NOT NULL,
    "body" "text" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'scheduled'::"text",
    "sent_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "processed_at" timestamp with time zone
);


ALTER TABLE "public"."scheduled_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "sender_type" character varying(20) DEFAULT 'admin'::character varying,
    "organizer_id" "uuid",
    "recipient_type" character varying(50),
    "recipient_phone" "text",
    "recipient_count" integer DEFAULT 0,
    "message" "text" NOT NULL,
    "sms_count" integer DEFAULT 1,
    "event_id" "uuid",
    "campaign_id" "uuid",
    "status" character varying(20) DEFAULT 'sent'::character varying,
    "delivery_status" "text",
    "provider_reference" "text",
    "cost" numeric(10,2) DEFAULT 0,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "credits" integer DEFAULT 0,
    "total_purchased" integer DEFAULT 0,
    "total_used" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "name" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "target_audience" character varying(50) DEFAULT 'all'::character varying,
    "recipients_count" integer DEFAULT 0,
    "sent_count" integer DEFAULT 0,
    "delivered_count" integer DEFAULT 0,
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "scheduled_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_credit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "credits" integer NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "price_per_sms" numeric(10,4) GENERATED ALWAYS AS (("price" / ("credits")::numeric)) STORED,
    "bonus_credits" integer DEFAULT 0,
    "is_popular" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_credit_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_credit_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "package_id" "uuid",
    "credits_purchased" integer NOT NULL,
    "bonus_credits" integer DEFAULT 0,
    "amount_paid" numeric(10,2) NOT NULL,
    "payment_reference" "text",
    "payment_channel" character varying(50) DEFAULT 'paystack'::character varying,
    "status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."sms_credit_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_credit_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "credits_used" integer NOT NULL,
    "sms_count" integer NOT NULL,
    "recipient_count" integer NOT NULL,
    "event_id" "uuid",
    "audit_id" "uuid",
    "balance_before" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_credit_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "campaign_id" "uuid",
    "masked_phone" "text" NOT NULL,
    "recipient_name" "text",
    "status" "text" NOT NULL,
    "error_message" "text",
    "message_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "provider" character varying(50),
    CONSTRAINT "sms_logs_status_check" CHECK (("status" = ANY (ARRAY['delivered'::"text", 'failed'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."sms_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid",
    "organizer_id" "uuid",
    "recipient_phone" character varying(20) NOT NULL,
    "recipient_name" character varying(255),
    "message" "text" NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "provider_message_id" character varying(100),
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "credits" integer NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "price_per_sms" numeric(5,2) NOT NULL,
    "is_active" boolean DEFAULT true,
    "is_featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_purchases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "package_id" "uuid",
    "credits" integer NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "payment_reference" character varying(100),
    "payment_status" character varying(50) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sms_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "event_id" "uuid",
    "recipient_count" integer NOT NULL,
    "sms_per_recipient" integer DEFAULT 1,
    "total_sms_used" integer NOT NULL,
    "message_preview" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sms_usage_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sponsor_logos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "logo_url" "text" NOT NULL,
    "sponsor_name" character varying(255),
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sponsor_logos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_connect_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" character varying(255) NOT NULL,
    "event_type" character varying(100) NOT NULL,
    "stripe_account_id" character varying(255),
    "organizer_id" "uuid",
    "payload" "jsonb",
    "processed_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_connect_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_connect_payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "event_id" "uuid",
    "stripe_payout_id" character varying(255),
    "amount" numeric(10,2) NOT NULL,
    "currency" character varying(3) NOT NULL,
    "status" character varying(50) DEFAULT 'pending'::character varying,
    "triggered_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "stripe_account_id" character varying(255),
    "triggered_by" "uuid",
    "failure_reason" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."stripe_connect_payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_ticket_replies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "user_type" "text" NOT NULL,
    "user_name" "text",
    "message" "text" NOT NULL,
    "is_internal" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "support_ticket_replies_user_type_check" CHECK (("user_type" = ANY (ARRAY['attendee'::"text", 'organizer'::"text", 'promoter'::"text", 'affiliate'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."support_ticket_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "ticket_number" character varying(20) NOT NULL,
    "user_id" "uuid",
    "subject" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "category" character varying(50) DEFAULT 'general'::character varying,
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "status" character varying(20) DEFAULT 'open'::character varying,
    "assigned_to" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "user_type" "text" DEFAULT 'attendee'::"text",
    "user_email" "text",
    "user_name" "text",
    "event_id" "uuid",
    "order_id" "uuid",
    "resolved_by" "uuid",
    CONSTRAINT "support_tickets_priority_check" CHECK ((("priority")::"text" = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'urgent'::character varying])::"text"[]))),
    CONSTRAINT "support_tickets_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'waiting'::character varying, 'resolved'::character varying, 'closed'::character varying])::"text"[]))),
    CONSTRAINT "support_tickets_user_type_check" CHECK (("user_type" = ANY (ARRAY['attendee'::"text", 'organizer'::"text", 'promoter'::"text", 'affiliate'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_subtasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "organizer_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "is_completed" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_subtasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."task_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "phase" "text" DEFAULT 'pre_event'::"text" NOT NULL,
    "is_global" boolean DEFAULT false,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."task_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_transfers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "transfer_number" integer NOT NULL,
    "fee_amount" numeric(10,2) DEFAULT 0,
    "fee_currency" character varying(3),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "transfer_reference" character varying(20),
    "old_ticket_code" character varying(50),
    "new_ticket_code" character varying(50),
    "original_transaction_id" character varying(100),
    "payment_status" character varying(20) DEFAULT 'pending'::character varying,
    "payment_reference" character varying(100),
    "event_id" "uuid"
);


ALTER TABLE "public"."ticket_transfers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" character varying(3) DEFAULT 'NGN'::character varying NOT NULL,
    "quantity_available" integer NOT NULL,
    "quantity_sold" integer DEFAULT 0,
    "max_per_order" integer DEFAULT 10,
    "min_per_order" integer DEFAULT 1,
    "sale_starts_at" timestamp with time zone,
    "sale_ends_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_refundable" boolean DEFAULT true,
    "is_table_ticket" boolean DEFAULT false,
    "seats_per_table" integer
);


ALTER TABLE "public"."ticket_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "ticket_type_id" "uuid",
    "user_id" "uuid",
    "attendee_name" character varying(255),
    "attendee_email" character varying(255),
    "attendee_phone" character varying(50),
    "ticket_code" character varying(50) NOT NULL,
    "qr_code_url" "text",
    "quantity" integer DEFAULT 1,
    "unit_price" numeric(12,2),
    "total_price" numeric(12,2),
    "currency" character varying(3) DEFAULT 'NGN'::character varying,
    "payment_reference" character varying(255),
    "payment_status" character varying(50) DEFAULT 'pending'::character varying,
    "payment_method" character varying(50),
    "is_checked_in" boolean DEFAULT false,
    "checked_in_at" timestamp with time zone,
    "checked_in_by" "uuid",
    "promo_code_id" "uuid",
    "discount_amount" numeric(12,2) DEFAULT 0,
    "status" character varying(50) DEFAULT 'active'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "checked_in" boolean DEFAULT false,
    "check_in_device_id" "uuid",
    "total_amount" numeric(10,2) DEFAULT 0,
    "qr_code" "text",
    "promoter_id" "uuid",
    "refund_reason" "text",
    "refunded_at" timestamp with time zone,
    "refund_rejection_reason" "text",
    "order_id" "uuid",
    "transfer_count" integer DEFAULT 0,
    "original_buyer_id" "uuid",
    "transferred_at" timestamp with time zone,
    "transferred_from_user_id" "uuid",
    "is_manual_issue" boolean DEFAULT false,
    "issued_by" "uuid",
    "manual_issue_type" character varying(50)
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


COMMENT ON COLUMN "public"."tickets"."is_manual_issue" IS 'True if ticket was manually issued by organizer (not purchased online)';



COMMENT ON COLUMN "public"."tickets"."issued_by" IS 'User ID of organizer/staff who issued the manual ticket';



COMMENT ON COLUMN "public"."tickets"."manual_issue_type" IS 'Reason for manual issue: complimentary, on_site_sale, vip_guest, press_media, sponsor, giveaway_winner';



CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "quantity_wanted" integer DEFAULT 1,
    "position" integer NOT NULL,
    "status" "text" DEFAULT 'waiting'::"text",
    "notified_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "purchase_token" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "waitlist_quantity_wanted_check" CHECK ((("quantity_wanted" > 0) AND ("quantity_wanted" <= 10))),
    CONSTRAINT "waitlist_status_check" CHECK (("status" = ANY (ARRAY['waiting'::"text", 'notified'::"text", 'purchased'::"text", 'expired'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid",
    "sender_type" character varying(20) DEFAULT 'admin'::character varying,
    "organizer_id" "uuid",
    "recipient_type" character varying(50),
    "recipient_phone" "text",
    "recipient_count" integer DEFAULT 0,
    "message" "text" NOT NULL,
    "event_id" "uuid",
    "status" character varying(20) DEFAULT 'sent'::character varying,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organizer_id" "uuid",
    "name" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "recipient_type" character varying(50) DEFAULT 'all'::character varying,
    "event_id" "uuid",
    "total_recipients" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_credit_packages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "credits" numeric(12,4) NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "currency" character varying(3) DEFAULT 'NGN'::character varying,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_credit_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_credit_purchases" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid",
    "package_id" "uuid",
    "amount" numeric(10,2) NOT NULL,
    "credits" numeric(12,4) NOT NULL,
    "payment_reference" character varying(100),
    "payment_status" character varying(20) DEFAULT 'pending'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_credit_purchases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_credit_usage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organizer_id" "uuid",
    "message_type" character varying(20) NOT NULL,
    "recipient_phone" character varying(20),
    "credits_used" numeric(10,4) NOT NULL,
    "meta_cost" numeric(10,4),
    "message_id" character varying(100),
    "status" character varying(20) DEFAULT 'sent'::character varying,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_credit_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_message_rates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "message_type" character varying(20) NOT NULL,
    "meta_rate" numeric(10,4) NOT NULL,
    "markup_percent" numeric(5,2) DEFAULT 95,
    "selling_rate" numeric(10,4) NOT NULL,
    "currency" character varying(3) DEFAULT 'USD'::character varying,
    "is_active" boolean DEFAULT true,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_message_rates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_broadcasts"
    ADD CONSTRAINT "admin_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_impersonation_log"
    ADD CONSTRAINT "admin_impersonation_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advertisements"
    ADD CONSTRAINT "advertisements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."affiliate_settings"
    ADD CONSTRAINT "affiliate_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_account_changes"
    ADD CONSTRAINT "bank_account_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."checkin_devices"
    ADD CONSTRAINT "checkin_devices_event_id_device_code_key" UNIQUE ("event_id", "device_code");



ALTER TABLE ONLY "public"."checkin_devices"
    ADD CONSTRAINT "checkin_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkin_logs"
    ADD CONSTRAINT "checkin_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."country_features"
    ADD CONSTRAINT "country_features_pkey" PRIMARY KEY ("country_code", "feature_id");



ALTER TABLE ONLY "public"."currencies"
    ADD CONSTRAINT "currencies_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."custom_field_responses"
    ADD CONSTRAINT "custom_field_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_audit"
    ADD CONSTRAINT "email_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_rate_limits"
    ADD CONSTRAINT "email_rate_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_rate_limits"
    ADD CONSTRAINT "email_rate_limits_user_id_rate_key_window_start_key" UNIQUE ("user_id", "rate_key", "window_start");



ALTER TABLE ONLY "public"."email_send_limits"
    ADD CONSTRAINT "email_send_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_send_limits"
    ADD CONSTRAINT "email_send_limits_sender_type_sender_id_date_key" UNIQUE ("sender_type", "sender_id", "date");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_templates"
    ADD CONSTRAINT "email_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."event_custom_fields"
    ADD CONSTRAINT "event_custom_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_day_activities"
    ADD CONSTRAINT "event_day_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_days"
    ADD CONSTRAINT "event_days_event_id_date_key" UNIQUE ("event_id", "date");



ALTER TABLE ONLY "public"."event_days"
    ADD CONSTRAINT "event_days_event_id_day_number_key" UNIQUE ("event_id", "day_number");



ALTER TABLE ONLY "public"."event_days"
    ADD CONSTRAINT "event_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_earnings"
    ADD CONSTRAINT "event_earnings_event_id_key" UNIQUE ("event_id");



ALTER TABLE ONLY "public"."event_earnings"
    ADD CONSTRAINT "event_earnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_email_whitelist"
    ADD CONSTRAINT "event_email_whitelist_event_id_email_key" UNIQUE ("event_id", "email");



ALTER TABLE ONLY "public"."event_email_whitelist"
    ADD CONSTRAINT "event_email_whitelist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_history"
    ADD CONSTRAINT "event_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_images"
    ADD CONSTRAINT "event_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_invite_codes"
    ADD CONSTRAINT "event_invite_codes_event_id_code_key" UNIQUE ("event_id", "code");



ALTER TABLE ONLY "public"."event_invite_codes"
    ADD CONSTRAINT "event_invite_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_sponsors"
    ADD CONSTRAINT "event_sponsors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_tasks"
    ADD CONSTRAINT "event_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."features"
    ADD CONSTRAINT "features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_audit_log"
    ADD CONSTRAINT "finance_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_users"
    ADD CONSTRAINT "finance_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finance_users"
    ADD CONSTRAINT "finance_users_user_id_unique" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_user_id_organizer_id_key" UNIQUE ("user_id", "organizer_id");



ALTER TABLE ONLY "public"."invite_code_usage"
    ADD CONSTRAINT "invite_code_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_documents"
    ADD CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_verifications"
    ADD CONSTRAINT "kyc_verifications_organizer_id_key" UNIQUE ("organizer_id");



ALTER TABLE ONLY "public"."kyc_verifications"
    ADD CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."legal_documents"
    ADD CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."login_attempts"
    ADD CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_bank_accounts"
    ADD CONSTRAINT "organizer_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_follows"
    ADD CONSTRAINT "organizer_follows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_follows"
    ADD CONSTRAINT "organizer_follows_user_id_organizer_id_key" UNIQUE ("user_id", "organizer_id");



ALTER TABLE ONLY "public"."organizer_sms_wallet"
    ADD CONSTRAINT "organizer_sms_wallet_organizer_id_key" UNIQUE ("organizer_id");



ALTER TABLE ONLY "public"."organizer_sms_wallet"
    ADD CONSTRAINT "organizer_sms_wallet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_team_members"
    ADD CONSTRAINT "organizer_team_members_organizer_id_email_key" UNIQUE ("organizer_id", "email");



ALTER TABLE ONLY "public"."organizer_team_members"
    ADD CONSTRAINT "organizer_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_whatsapp_config"
    ADD CONSTRAINT "organizer_whatsapp_config_organizer_id_key" UNIQUE ("organizer_id");



ALTER TABLE ONLY "public"."organizer_whatsapp_config"
    ADD CONSTRAINT "organizer_whatsapp_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizer_whatsapp_wallet"
    ADD CONSTRAINT "organizer_whatsapp_wallet_organizer_id_key" UNIQUE ("organizer_id");



ALTER TABLE ONLY "public"."organizer_whatsapp_wallet"
    ADD CONSTRAINT "organizer_whatsapp_wallet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizers"
    ADD CONSTRAINT "organizers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizers"
    ADD CONSTRAINT "organizers_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."payment_gateway_config"
    ADD CONSTRAINT "payment_gateway_config_country_code_provider_key" UNIQUE ("country_code", "provider");



ALTER TABLE ONLY "public"."payment_gateway_config"
    ADD CONSTRAINT "payment_gateway_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payout_events"
    ADD CONSTRAINT "payout_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_payout_number_key" UNIQUE ("payout_number");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phone_otps"
    ADD CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_adverts"
    ADD CONSTRAINT "platform_adverts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_branding"
    ADD CONSTRAINT "platform_branding_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_limits"
    ADD CONSTRAINT "platform_limits_country_code_limit_key_key" UNIQUE ("country_code", "limit_key");



ALTER TABLE ONLY "public"."platform_limits"
    ADD CONSTRAINT "platform_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_settings"
    ADD CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."platform_sms_config"
    ADD CONSTRAINT "platform_sms_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_whatsapp_config"
    ADD CONSTRAINT "platform_whatsapp_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_organizer_id_code_key" UNIQUE ("organizer_id", "code");



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_bank_accounts"
    ADD CONSTRAINT "promoter_bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_clicks"
    ADD CONSTRAINT "promoter_clicks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_events"
    ADD CONSTRAINT "promoter_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_events"
    ADD CONSTRAINT "promoter_events_promoter_id_event_id_key" UNIQUE ("promoter_id", "event_id");



ALTER TABLE ONLY "public"."promoter_payouts"
    ADD CONSTRAINT "promoter_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoter_sales"
    ADD CONSTRAINT "promoter_sales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_short_code_key" UNIQUE ("short_code");



ALTER TABLE ONLY "public"."referral_earnings"
    ADD CONSTRAINT "referral_earnings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referral_payouts"
    ADD CONSTRAINT "referral_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."saved_payment_methods"
    ADD CONSTRAINT "saved_payment_methods_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_payment_methods"
    ADD CONSTRAINT "saved_payment_methods_user_id_payment_method_id_key" UNIQUE ("user_id", "payment_method_id");



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_audit"
    ADD CONSTRAINT "sms_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_balances"
    ADD CONSTRAINT "sms_balances_organizer_id_key" UNIQUE ("organizer_id");



ALTER TABLE ONLY "public"."sms_balances"
    ADD CONSTRAINT "sms_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_campaigns"
    ADD CONSTRAINT "sms_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_credit_packages"
    ADD CONSTRAINT "sms_credit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_credit_purchases"
    ADD CONSTRAINT "sms_credit_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_credit_usage"
    ADD CONSTRAINT "sms_credit_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_packages"
    ADD CONSTRAINT "sms_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_purchases"
    ADD CONSTRAINT "sms_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sms_usage_log"
    ADD CONSTRAINT "sms_usage_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sponsor_logos"
    ADD CONSTRAINT "sponsor_logos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_connect_events"
    ADD CONSTRAINT "stripe_connect_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_connect_events"
    ADD CONSTRAINT "stripe_connect_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."stripe_connect_payouts"
    ADD CONSTRAINT "stripe_connect_payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_ticket_replies"
    ADD CONSTRAINT "support_ticket_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_ticket_number_key" UNIQUE ("ticket_number");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_subtasks"
    ADD CONSTRAINT "task_subtasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_transfers"
    ADD CONSTRAINT "ticket_transfers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_ticket_code_key" UNIQUE ("ticket_code");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_audit"
    ADD CONSTRAINT "whatsapp_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_broadcasts"
    ADD CONSTRAINT "whatsapp_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_credit_packages"
    ADD CONSTRAINT "whatsapp_credit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_credit_purchases"
    ADD CONSTRAINT "whatsapp_credit_purchases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_credit_usage"
    ADD CONSTRAINT "whatsapp_credit_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_message_rates"
    ADD CONSTRAINT "whatsapp_message_rates_message_type_key" UNIQUE ("message_type");



ALTER TABLE ONLY "public"."whatsapp_message_rates"
    ADD CONSTRAINT "whatsapp_message_rates_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "events_custom_url_unique" ON "public"."events" USING "btree" ("custom_url") WHERE ("custom_url" IS NOT NULL);



CREATE UNIQUE INDEX "events_slug_unique" ON "public"."events" USING "btree" ("slug") WHERE ("slug" IS NOT NULL);



CREATE INDEX "idx_admin_actions_action" ON "public"."admin_actions" USING "btree" ("action");



CREATE INDEX "idx_admin_actions_admin" ON "public"."admin_actions" USING "btree" ("admin_id");



CREATE INDEX "idx_admin_actions_created" ON "public"."admin_actions" USING "btree" ("created_at");



CREATE INDEX "idx_advance_payments_organizer" ON "public"."advance_payments" USING "btree" ("organizer_id");



CREATE INDEX "idx_advance_payments_promoter" ON "public"."advance_payments" USING "btree" ("promoter_id");



CREATE INDEX "idx_advance_payments_status" ON "public"."advance_payments" USING "btree" ("status");



CREATE INDEX "idx_audit_logs_action" ON "public"."audit_logs" USING "btree" ("action");



CREATE INDEX "idx_audit_logs_created" ON "public"."audit_logs" USING "btree" ("created_at");



CREATE INDEX "idx_audit_logs_table" ON "public"."audit_logs" USING "btree" ("table_name");



CREATE INDEX "idx_audit_logs_user" ON "public"."audit_logs" USING "btree" ("user_id");



CREATE INDEX "idx_bank_accounts_active" ON "public"."organizer_bank_accounts" USING "btree" ("organizer_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_bank_accounts_country" ON "public"."bank_accounts" USING "btree" ("country_code");



CREATE INDEX "idx_bank_accounts_default" ON "public"."organizer_bank_accounts" USING "btree" ("organizer_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_bank_accounts_organizer" ON "public"."bank_accounts" USING "btree" ("organizer_id");



CREATE INDEX "idx_bank_accounts_organizer_id" ON "public"."bank_accounts" USING "btree" ("organizer_id");



CREATE INDEX "idx_bank_accounts_pending" ON "public"."organizer_bank_accounts" USING "btree" ("confirmation_token") WHERE ("is_pending_confirmation" = true);



CREATE INDEX "idx_bank_changes_created" ON "public"."bank_account_changes" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_bank_changes_organizer" ON "public"."bank_account_changes" USING "btree" ("organizer_id");



CREATE INDEX "idx_bank_changes_suspicious" ON "public"."bank_account_changes" USING "btree" ("is_suspicious") WHERE ("is_suspicious" = true);



CREATE INDEX "idx_bank_changes_user" ON "public"."bank_account_changes" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_recipients_campaign" ON "public"."campaign_recipients" USING "btree" ("campaign_id");



CREATE INDEX "idx_checkin_devices_event" ON "public"."checkin_devices" USING "btree" ("event_id");



CREATE INDEX "idx_checkin_devices_organizer" ON "public"."checkin_devices" USING "btree" ("organizer_id");



CREATE INDEX "idx_checkin_logs_device" ON "public"."checkin_logs" USING "btree" ("device_id");



CREATE INDEX "idx_checkin_logs_event" ON "public"."checkin_logs" USING "btree" ("event_id");



CREATE INDEX "idx_checkin_logs_ticket" ON "public"."checkin_logs" USING "btree" ("ticket_id");



CREATE INDEX "idx_code_usage_code" ON "public"."invite_code_usage" USING "btree" ("invite_code_id");



CREATE INDEX "idx_comm_logs_created" ON "public"."communication_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_comm_logs_email" ON "public"."communication_logs" USING "btree" ("recipient_email");



CREATE INDEX "idx_comm_logs_event_id" ON "public"."communication_logs" USING "btree" ("event_id");



CREATE UNIQUE INDEX "idx_comm_logs_reminder_unique" ON "public"."communication_logs" USING "btree" ("event_id", "ticket_id", "template_key") WHERE (("template_key")::"text" = ANY ((ARRAY['event_reminder_24h'::character varying, 'event_reminder_1h'::character varying])::"text"[]));



CREATE INDEX "idx_comm_logs_status" ON "public"."communication_logs" USING "btree" ("status") WHERE (("status")::"text" = ANY ((ARRAY['failed'::character varying, 'queued'::character varying])::"text"[]));



CREATE INDEX "idx_comm_logs_template" ON "public"."communication_logs" USING "btree" ("template_key");



CREATE INDEX "idx_comm_logs_user_id" ON "public"."communication_logs" USING "btree" ("recipient_user_id");



CREATE INDEX "idx_custom_fields_event" ON "public"."event_custom_fields" USING "btree" ("event_id");



CREATE INDEX "idx_custom_responses_field" ON "public"."custom_field_responses" USING "btree" ("custom_field_id");



CREATE INDEX "idx_custom_responses_ticket" ON "public"."custom_field_responses" USING "btree" ("ticket_id");



CREATE INDEX "idx_email_campaigns_org" ON "public"."email_campaigns" USING "btree" ("organizer_id");



CREATE INDEX "idx_email_campaigns_organizer" ON "public"."email_campaigns" USING "btree" ("organizer_id");



CREATE INDEX "idx_email_campaigns_organizer_id" ON "public"."email_campaigns" USING "btree" ("organizer_id");



CREATE INDEX "idx_email_campaigns_status" ON "public"."email_campaigns" USING "btree" ("status");



CREATE INDEX "idx_email_rate_limits_lookup" ON "public"."email_rate_limits" USING "btree" ("user_id", "rate_key", "window_start");



CREATE INDEX "idx_email_rate_limits_user_id" ON "public"."email_rate_limits" USING "btree" ("user_id");



CREATE INDEX "idx_email_rate_limits_window" ON "public"."email_rate_limits" USING "btree" ("window_start");



CREATE INDEX "idx_email_send_limits_date" ON "public"."email_send_limits" USING "btree" ("sender_type", "sender_id", "date");



CREATE INDEX "idx_email_templates_owner" ON "public"."email_templates" USING "btree" ("owner_type", "owner_id");



CREATE INDEX "idx_email_whitelist_email" ON "public"."event_email_whitelist" USING "btree" ("email");



CREATE INDEX "idx_email_whitelist_event" ON "public"."event_email_whitelist" USING "btree" ("event_id");



CREATE INDEX "idx_event_day_activities_day_id" ON "public"."event_day_activities" USING "btree" ("event_day_id");



CREATE INDEX "idx_event_day_activities_sort" ON "public"."event_day_activities" USING "btree" ("event_day_id", "sort_order");



CREATE INDEX "idx_event_days_date" ON "public"."event_days" USING "btree" ("date");



CREATE INDEX "idx_event_days_event_id" ON "public"."event_days" USING "btree" ("event_id");



CREATE INDEX "idx_event_earnings_event" ON "public"."event_earnings" USING "btree" ("event_id");



CREATE INDEX "idx_event_earnings_organizer" ON "public"."event_earnings" USING "btree" ("organizer_id");



CREATE INDEX "idx_event_history_created_at" ON "public"."event_history" USING "btree" ("created_at");



CREATE INDEX "idx_event_history_event_id" ON "public"."event_history" USING "btree" ("event_id");



CREATE INDEX "idx_event_images_event_id" ON "public"."event_images" USING "btree" ("event_id");



CREATE INDEX "idx_event_sponsors_event_id" ON "public"."event_sponsors" USING "btree" ("event_id");



CREATE INDEX "idx_event_tasks_assigned" ON "public"."event_tasks" USING "btree" ("assigned_to");



CREATE INDEX "idx_event_tasks_event" ON "public"."event_tasks" USING "btree" ("event_id");



CREATE INDEX "idx_event_tasks_organizer" ON "public"."event_tasks" USING "btree" ("organizer_id");



CREATE INDEX "idx_events_country" ON "public"."events" USING "btree" ("country_code");



CREATE INDEX "idx_events_organizer" ON "public"."events" USING "btree" ("organizer_id");



CREATE INDEX "idx_events_publish_at" ON "public"."events" USING "btree" ("publish_at") WHERE ((("status")::"text" = 'scheduled'::"text") AND ("publish_at" IS NOT NULL));



CREATE INDEX "idx_events_start_date" ON "public"."events" USING "btree" ("start_date");



CREATE INDEX "idx_events_status" ON "public"."events" USING "btree" ("status");



CREATE INDEX "idx_followers_organizer" ON "public"."followers" USING "btree" ("organizer_id");



CREATE INDEX "idx_followers_organizer_id" ON "public"."followers" USING "btree" ("organizer_id");



CREATE INDEX "idx_followers_user" ON "public"."followers" USING "btree" ("user_id");



CREATE INDEX "idx_followers_user_id" ON "public"."followers" USING "btree" ("user_id");



CREATE INDEX "idx_invite_codes_code" ON "public"."event_invite_codes" USING "btree" ("code");



CREATE INDEX "idx_invite_codes_event" ON "public"."event_invite_codes" USING "btree" ("event_id");



CREATE INDEX "idx_kyc_documents_organizer_id" ON "public"."kyc_documents" USING "btree" ("organizer_id");



CREATE INDEX "idx_kyc_organizer" ON "public"."kyc_verifications" USING "btree" ("organizer_id");



CREATE INDEX "idx_login_attempts_created" ON "public"."login_attempts" USING "btree" ("created_at");



CREATE INDEX "idx_login_attempts_email" ON "public"."login_attempts" USING "btree" ("email");



CREATE INDEX "idx_login_attempts_ip" ON "public"."login_attempts" USING "btree" ("ip_address");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_orders_event" ON "public"."orders" USING "btree" ("event_id");



CREATE INDEX "idx_orders_is_stripe_connect" ON "public"."orders" USING "btree" ("is_stripe_connect");



CREATE INDEX "idx_orders_number" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "idx_orders_referred_by" ON "public"."orders" USING "btree" ("referred_by");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_orders_stripe_account_id" ON "public"."orders" USING "btree" ("stripe_account_id");



CREATE INDEX "idx_orders_user" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_orders_waitlist_id" ON "public"."orders" USING "btree" ("waitlist_id") WHERE ("waitlist_id" IS NOT NULL);



CREATE INDEX "idx_organizer_follows_organizer" ON "public"."organizer_follows" USING "btree" ("organizer_id");



CREATE INDEX "idx_organizer_follows_user" ON "public"."organizer_follows" USING "btree" ("user_id");



CREATE INDEX "idx_organizers_stripe_connect_id" ON "public"."organizers" USING "btree" ("stripe_connect_id");



CREATE INDEX "idx_organizers_stripe_connect_status" ON "public"."organizers" USING "btree" ("stripe_connect_status");



CREATE INDEX "idx_payout_events_event" ON "public"."payout_events" USING "btree" ("event_id");



CREATE INDEX "idx_payout_events_payout" ON "public"."payout_events" USING "btree" ("payout_id");



CREATE INDEX "idx_payouts_organizer" ON "public"."payouts" USING "btree" ("organizer_id");



CREATE INDEX "idx_payouts_organizer_id" ON "public"."payouts" USING "btree" ("organizer_id");



CREATE INDEX "idx_payouts_status" ON "public"."payouts" USING "btree" ("status");



CREATE INDEX "idx_phone_otps_expires" ON "public"."phone_otps" USING "btree" ("expires_at");



CREATE INDEX "idx_phone_otps_phone" ON "public"."phone_otps" USING "btree" ("phone");



CREATE INDEX "idx_profiles_affiliate_status" ON "public"."profiles" USING "btree" ("affiliate_status") WHERE ("affiliate_status" IS NOT NULL);



CREATE INDEX "idx_profiles_referral_code" ON "public"."profiles" USING "btree" ("referral_code");



CREATE INDEX "idx_promo_codes_code" ON "public"."promo_codes" USING "btree" ("code");



CREATE INDEX "idx_promo_codes_event" ON "public"."promo_codes" USING "btree" ("event_id");



CREATE INDEX "idx_promo_codes_org" ON "public"."promo_codes" USING "btree" ("organizer_id");



CREATE INDEX "idx_promo_codes_organizer" ON "public"."promo_codes" USING "btree" ("organizer_id");



CREATE INDEX "idx_promo_codes_organizer_id" ON "public"."promo_codes" USING "btree" ("organizer_id");



CREATE INDEX "idx_referral_earnings_flagged" ON "public"."referral_earnings" USING "btree" ("is_flagged") WHERE ("is_flagged" = true);



CREATE INDEX "idx_referral_earnings_status" ON "public"."referral_earnings" USING "btree" ("status");



CREATE INDEX "idx_referral_earnings_user" ON "public"."referral_earnings" USING "btree" ("user_id");



CREATE INDEX "idx_referral_payouts_status" ON "public"."referral_payouts" USING "btree" ("status");



CREATE INDEX "idx_referral_payouts_user" ON "public"."referral_payouts" USING "btree" ("user_id");



CREATE INDEX "idx_refund_requests_event_id" ON "public"."refund_requests" USING "btree" ("event_id");



CREATE INDEX "idx_refund_requests_order" ON "public"."refund_requests" USING "btree" ("order_id");



CREATE INDEX "idx_refund_requests_organizer_id" ON "public"."refund_requests" USING "btree" ("organizer_id");



CREATE INDEX "idx_refund_requests_status" ON "public"."refund_requests" USING "btree" ("status");



CREATE INDEX "idx_refund_requests_user_id" ON "public"."refund_requests" USING "btree" ("user_id");



CREATE INDEX "idx_reviews_event" ON "public"."reviews" USING "btree" ("event_id");



CREATE INDEX "idx_reviews_organizer" ON "public"."reviews" USING "btree" ("organizer_id");



CREATE INDEX "idx_saved_events_event_id" ON "public"."saved_events" USING "btree" ("event_id");



CREATE INDEX "idx_saved_events_user_id" ON "public"."saved_events" USING "btree" ("user_id");



CREATE INDEX "idx_saved_payment_methods_user" ON "public"."saved_payment_methods" USING "btree" ("user_id");



CREATE INDEX "idx_scheduled_emails_status" ON "public"."scheduled_emails" USING "btree" ("status", "scheduled_at");



CREATE INDEX "idx_sms_balances_org" ON "public"."sms_balances" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_balances_organizer" ON "public"."sms_balances" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_campaigns_created" ON "public"."sms_campaigns" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sms_campaigns_org" ON "public"."sms_campaigns" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_campaigns_organizer" ON "public"."sms_campaigns" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_campaigns_organizer_id" ON "public"."sms_campaigns" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_campaigns_status" ON "public"."sms_campaigns" USING "btree" ("status");



CREATE INDEX "idx_sms_logs_campaign" ON "public"."sms_logs" USING "btree" ("campaign_id");



CREATE INDEX "idx_sms_logs_created" ON "public"."sms_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_sms_logs_organizer" ON "public"."sms_logs" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_logs_status" ON "public"."sms_logs" USING "btree" ("status");



CREATE INDEX "idx_sms_messages_campaign" ON "public"."sms_messages" USING "btree" ("campaign_id");



CREATE INDEX "idx_sms_messages_organizer" ON "public"."sms_messages" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_purchases_org" ON "public"."sms_purchases" USING "btree" ("organizer_id");



CREATE INDEX "idx_sms_purchases_organizer" ON "public"."sms_purchases" USING "btree" ("organizer_id");



CREATE INDEX "idx_sponsor_logos_event_id" ON "public"."sponsor_logos" USING "btree" ("event_id");



CREATE INDEX "idx_stripe_connect_events_account" ON "public"."stripe_connect_events" USING "btree" ("stripe_account_id");



CREATE INDEX "idx_stripe_connect_payouts_event" ON "public"."stripe_connect_payouts" USING "btree" ("event_id");



CREATE INDEX "idx_stripe_connect_payouts_organizer" ON "public"."stripe_connect_payouts" USING "btree" ("organizer_id");



CREATE INDEX "idx_stripe_connect_payouts_status" ON "public"."stripe_connect_payouts" USING "btree" ("status");



CREATE INDEX "idx_support_ticket_replies_ticket_id" ON "public"."support_ticket_replies" USING "btree" ("ticket_id");



CREATE INDEX "idx_support_tickets_created_at" ON "public"."support_tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_support_tickets_event_id" ON "public"."support_tickets" USING "btree" ("event_id");



CREATE INDEX "idx_support_tickets_order_id" ON "public"."support_tickets" USING "btree" ("order_id");



CREATE INDEX "idx_support_tickets_priority" ON "public"."support_tickets" USING "btree" ("priority");



CREATE INDEX "idx_support_tickets_status" ON "public"."support_tickets" USING "btree" ("status");



CREATE INDEX "idx_support_tickets_user" ON "public"."support_tickets" USING "btree" ("user_id");



CREATE INDEX "idx_support_tickets_user_id" ON "public"."support_tickets" USING "btree" ("user_id");



CREATE INDEX "idx_task_comments_task" ON "public"."task_comments" USING "btree" ("task_id");



CREATE INDEX "idx_task_subtasks_task" ON "public"."task_subtasks" USING "btree" ("task_id");



CREATE INDEX "idx_team_members_organizer" ON "public"."organizer_team_members" USING "btree" ("organizer_id");



CREATE INDEX "idx_team_members_token" ON "public"."organizer_team_members" USING "btree" ("invitation_token");



CREATE INDEX "idx_team_members_user" ON "public"."organizer_team_members" USING "btree" ("user_id");



CREATE INDEX "idx_ticket_transfers_event" ON "public"."ticket_transfers" USING "btree" ("event_id");



CREATE INDEX "idx_ticket_transfers_reference" ON "public"."ticket_transfers" USING "btree" ("transfer_reference");



CREATE INDEX "idx_ticket_transfers_ticket_id" ON "public"."ticket_transfers" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_types_event" ON "public"."ticket_types" USING "btree" ("event_id");



CREATE INDEX "idx_tickets_event" ON "public"."tickets" USING "btree" ("event_id");



CREATE INDEX "idx_tickets_event_id" ON "public"."tickets" USING "btree" ("event_id");



CREATE INDEX "idx_tickets_manual_issue" ON "public"."tickets" USING "btree" ("is_manual_issue") WHERE ("is_manual_issue" = true);



CREATE INDEX "idx_tickets_order_id" ON "public"."tickets" USING "btree" ("order_id");



CREATE INDEX "idx_tickets_original_buyer" ON "public"."tickets" USING "btree" ("original_buyer_id");



CREATE INDEX "idx_tickets_payment_status" ON "public"."tickets" USING "btree" ("payment_status");



CREATE INDEX "idx_tickets_ticket_code" ON "public"."tickets" USING "btree" ("ticket_code");



CREATE INDEX "idx_tickets_user" ON "public"."tickets" USING "btree" ("user_id");



CREATE INDEX "idx_tickets_user_id" ON "public"."tickets" USING "btree" ("user_id");



CREATE INDEX "idx_waitlist_email" ON "public"."waitlist" USING "btree" ("email");



CREATE INDEX "idx_waitlist_event_position" ON "public"."waitlist" USING "btree" ("event_id", "position");



CREATE INDEX "idx_waitlist_event_status" ON "public"."waitlist" USING "btree" ("event_id", "status");



CREATE INDEX "idx_waitlist_token" ON "public"."waitlist" USING "btree" ("purchase_token");



CREATE UNIQUE INDEX "idx_waitlist_unique_active" ON "public"."waitlist" USING "btree" ("event_id", "email") WHERE ("status" = ANY (ARRAY['waiting'::"text", 'notified'::"text"]));



CREATE INDEX "idx_waitlist_user" ON "public"."waitlist" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_broadcasts_org" ON "public"."whatsapp_broadcasts" USING "btree" ("organizer_id");



CREATE INDEX "idx_whatsapp_broadcasts_organizer" ON "public"."whatsapp_broadcasts" USING "btree" ("organizer_id");



CREATE OR REPLACE TRIGGER "event_slug_trigger" BEFORE INSERT ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_slug"();



CREATE OR REPLACE TRIGGER "kyc_status_trigger" AFTER INSERT OR UPDATE ON "public"."kyc_verifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_organizer_kyc_status"();



CREATE OR REPLACE TRIGGER "protect_role_columns_trigger" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_role_columns"();



CREATE OR REPLACE TRIGGER "set_ticket_number" BEFORE INSERT ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."generate_ticket_number"();



CREATE OR REPLACE TRIGGER "sync_profile_email_to_organizer" AFTER UPDATE OF "email" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_organizer_email"();



CREATE OR REPLACE TRIGGER "ticket_sale_trigger" AFTER INSERT OR UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."record_ticket_sale"();



CREATE OR REPLACE TRIGGER "trigger_bank_cooling_period" BEFORE INSERT OR UPDATE ON "public"."organizer_bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."set_bank_cooling_period"();



CREATE OR REPLACE TRIGGER "trigger_single_default_bank" AFTER INSERT OR UPDATE OF "is_default" ON "public"."organizer_bank_accounts" FOR EACH ROW WHEN (("new"."is_default" = true)) EXECUTE FUNCTION "public"."ensure_single_default_bank"();



CREATE OR REPLACE TRIGGER "trigger_update_organizer_event_count" AFTER INSERT OR DELETE OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_organizer_event_count"();



CREATE OR REPLACE TRIGGER "update_bank_accounts_updated_at" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_event_day_activities_updated_at" BEFORE UPDATE ON "public"."event_day_activities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_event_days_updated_at" BEFORE UPDATE ON "public"."event_days" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizers_updated_at" BEFORE UPDATE ON "public"."organizers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payouts_updated_at" BEFORE UPDATE ON "public"."payouts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_promo_codes_updated_at" BEFORE UPDATE ON "public"."promo_codes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_refund_requests_updated_at" BEFORE UPDATE ON "public"."refund_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reviews_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_support_tickets_timestamp" BEFORE UPDATE ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."update_support_ticket_timestamp"();



CREATE OR REPLACE TRIGGER "update_support_tickets_updated_at" BEFORE UPDATE ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ticket_types_updated_at" BEFORE UPDATE ON "public"."ticket_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_actions"
    ADD CONSTRAINT "admin_actions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."admin_audit_logs"
    ADD CONSTRAINT "admin_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."admin_impersonation_log"
    ADD CONSTRAINT "admin_impersonation_log_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_impersonation_log"
    ADD CONSTRAINT "admin_impersonation_log_target_organizer_id_fkey" FOREIGN KEY ("target_organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."admin_impersonation_log"
    ADD CONSTRAINT "admin_impersonation_log_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."admin_logs"
    ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."advance_payments"
    ADD CONSTRAINT "advance_payments_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id");



ALTER TABLE ONLY "public"."affiliate_settings"
    ADD CONSTRAINT "affiliate_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."bank_account_changes"
    ADD CONSTRAINT "bank_account_changes_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."organizer_bank_accounts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bank_account_changes"
    ADD CONSTRAINT "bank_account_changes_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bank_account_changes"
    ADD CONSTRAINT "bank_account_changes_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_account_changes"
    ADD CONSTRAINT "bank_account_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_recipients"
    ADD CONSTRAINT "campaign_recipients_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkin_devices"
    ADD CONSTRAINT "checkin_devices_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkin_devices"
    ADD CONSTRAINT "checkin_devices_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkin_logs"
    ADD CONSTRAINT "checkin_logs_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checkin_logs"
    ADD CONSTRAINT "checkin_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "public"."checkin_devices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."checkin_logs"
    ADD CONSTRAINT "checkin_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."checkin_logs"
    ADD CONSTRAINT "checkin_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."communication_logs"
    ADD CONSTRAINT "communication_logs_waitlist_id_fkey" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."countries"
    ADD CONSTRAINT "countries_default_currency_fkey" FOREIGN KEY ("default_currency") REFERENCES "public"."currencies"("code");



ALTER TABLE ONLY "public"."country_features"
    ADD CONSTRAINT "country_features_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."country_features"
    ADD CONSTRAINT "country_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_field_responses"
    ADD CONSTRAINT "custom_field_responses_custom_field_id_fkey" FOREIGN KEY ("custom_field_id") REFERENCES "public"."event_custom_fields"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_field_responses"
    ADD CONSTRAINT "custom_field_responses_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_audit"
    ADD CONSTRAINT "email_audit_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."email_audit"
    ADD CONSTRAINT "email_audit_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."email_audit"
    ADD CONSTRAINT "email_audit_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_campaigns"
    ADD CONSTRAINT "email_campaigns_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."email_rate_limits"
    ADD CONSTRAINT "email_rate_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_custom_fields"
    ADD CONSTRAINT "event_custom_fields_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_day_activities"
    ADD CONSTRAINT "event_day_activities_event_day_id_fkey" FOREIGN KEY ("event_day_id") REFERENCES "public"."event_days"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_days"
    ADD CONSTRAINT "event_days_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_earnings"
    ADD CONSTRAINT "event_earnings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_earnings"
    ADD CONSTRAINT "event_earnings_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_email_whitelist"
    ADD CONSTRAINT "event_email_whitelist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_email_whitelist"
    ADD CONSTRAINT "event_email_whitelist_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_history"
    ADD CONSTRAINT "event_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_history"
    ADD CONSTRAINT "event_history_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_images"
    ADD CONSTRAINT "event_images_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_invite_codes"
    ADD CONSTRAINT "event_invite_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_invite_codes"
    ADD CONSTRAINT "event_invite_codes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_sponsors"
    ADD CONSTRAINT "event_sponsors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_tasks"
    ADD CONSTRAINT "event_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."organizer_team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."event_tasks"
    ADD CONSTRAINT "event_tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."event_tasks"
    ADD CONSTRAINT "event_tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_tasks"
    ADD CONSTRAINT "event_tasks_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."finance_audit_log"
    ADD CONSTRAINT "finance_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."finance_users"
    ADD CONSTRAINT "finance_users_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."finance_users"
    ADD CONSTRAINT "finance_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followers"
    ADD CONSTRAINT "followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_code_usage"
    ADD CONSTRAINT "invite_code_usage_invite_code_id_fkey" FOREIGN KEY ("invite_code_id") REFERENCES "public"."event_invite_codes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_code_usage"
    ADD CONSTRAINT "invite_code_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."invite_code_usage"
    ADD CONSTRAINT "invite_code_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."kyc_documents"
    ADD CONSTRAINT "kyc_documents_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_documents"
    ADD CONSTRAINT "kyc_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."kyc_verifications"
    ADD CONSTRAINT "kyc_verifications_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_referred_by_fkey" FOREIGN KEY ("referred_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_waitlist_id_fkey" FOREIGN KEY ("waitlist_id") REFERENCES "public"."waitlist"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organizer_bank_accounts"
    ADD CONSTRAINT "organizer_bank_accounts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_follows"
    ADD CONSTRAINT "organizer_follows_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_follows"
    ADD CONSTRAINT "organizer_follows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_sms_wallet"
    ADD CONSTRAINT "organizer_sms_wallet_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_team_members"
    ADD CONSTRAINT "organizer_team_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organizer_team_members"
    ADD CONSTRAINT "organizer_team_members_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_team_members"
    ADD CONSTRAINT "organizer_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organizer_whatsapp_config"
    ADD CONSTRAINT "organizer_whatsapp_config_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizer_whatsapp_wallet"
    ADD CONSTRAINT "organizer_whatsapp_wallet_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizers"
    ADD CONSTRAINT "organizers_custom_fee_set_by_fkey" FOREIGN KEY ("custom_fee_set_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organizers"
    ADD CONSTRAINT "organizers_trusted_by_fkey" FOREIGN KEY ("trusted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organizers"
    ADD CONSTRAINT "organizers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_gateway_config"
    ADD CONSTRAINT "payment_gateway_config_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payout_events"
    ADD CONSTRAINT "payout_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."payout_events"
    ADD CONSTRAINT "payout_events_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."platform_limits"
    ADD CONSTRAINT "platform_limits_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_sms_config"
    ADD CONSTRAINT "platform_sms_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."platform_whatsapp_config"
    ADD CONSTRAINT "platform_whatsapp_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promo_codes"
    ADD CONSTRAINT "promo_codes_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_bank_accounts"
    ADD CONSTRAINT "promoter_bank_accounts_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_clicks"
    ADD CONSTRAINT "promoter_clicks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."promoter_clicks"
    ADD CONSTRAINT "promoter_clicks_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_events"
    ADD CONSTRAINT "promoter_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_events"
    ADD CONSTRAINT "promoter_events_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_payouts"
    ADD CONSTRAINT "promoter_payouts_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."promoter_bank_accounts"("id");



ALTER TABLE ONLY "public"."promoter_payouts"
    ADD CONSTRAINT "promoter_payouts_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."promoter_payouts"
    ADD CONSTRAINT "promoter_payouts_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoter_sales"
    ADD CONSTRAINT "promoter_sales_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."promoter_sales"
    ADD CONSTRAINT "promoter_sales_promoter_id_fkey" FOREIGN KEY ("promoter_id") REFERENCES "public"."promoters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."promoters"
    ADD CONSTRAINT "promoters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referral_earnings"
    ADD CONSTRAINT "referral_earnings_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."referral_earnings"
    ADD CONSTRAINT "referral_earnings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."referral_earnings"
    ADD CONSTRAINT "referral_earnings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."referral_earnings"
    ADD CONSTRAINT "referral_earnings_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."referral_earnings"
    ADD CONSTRAINT "referral_earnings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."referral_payouts"
    ADD CONSTRAINT "referral_payouts_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."referral_payouts"
    ADD CONSTRAINT "referral_payouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_organizer_decided_by_fkey" FOREIGN KEY ("organizer_decided_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."refund_requests"
    ADD CONSTRAINT "refund_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_events"
    ADD CONSTRAINT "saved_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."saved_payment_methods"
    ADD CONSTRAINT "saved_payment_methods_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_emails"
    ADD CONSTRAINT "scheduled_emails_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id");



ALTER TABLE ONLY "public"."sms_audit"
    ADD CONSTRAINT "sms_audit_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."sms_campaigns"("id");



ALTER TABLE ONLY "public"."sms_audit"
    ADD CONSTRAINT "sms_audit_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."sms_audit"
    ADD CONSTRAINT "sms_audit_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."sms_audit"
    ADD CONSTRAINT "sms_audit_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."sms_balances"
    ADD CONSTRAINT "sms_balances_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_campaigns"
    ADD CONSTRAINT "sms_campaigns_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sms_campaigns"
    ADD CONSTRAINT "sms_campaigns_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_credit_purchases"
    ADD CONSTRAINT "sms_credit_purchases_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_credit_purchases"
    ADD CONSTRAINT "sms_credit_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."sms_credit_packages"("id");



ALTER TABLE ONLY "public"."sms_credit_usage"
    ADD CONSTRAINT "sms_credit_usage_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."sms_credit_usage"
    ADD CONSTRAINT "sms_credit_usage_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."sms_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sms_logs"
    ADD CONSTRAINT "sms_logs_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."sms_campaigns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sms_messages"
    ADD CONSTRAINT "sms_messages_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_purchases"
    ADD CONSTRAINT "sms_purchases_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sms_purchases"
    ADD CONSTRAINT "sms_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."sms_packages"("id");



ALTER TABLE ONLY "public"."sms_usage_log"
    ADD CONSTRAINT "sms_usage_log_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."sms_usage_log"
    ADD CONSTRAINT "sms_usage_log_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sponsor_logos"
    ADD CONSTRAINT "sponsor_logos_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stripe_connect_events"
    ADD CONSTRAINT "stripe_connect_events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."stripe_connect_payouts"
    ADD CONSTRAINT "stripe_connect_payouts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."stripe_connect_payouts"
    ADD CONSTRAINT "stripe_connect_payouts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."stripe_connect_payouts"
    ADD CONSTRAINT "stripe_connect_payouts_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."support_ticket_replies"
    ADD CONSTRAINT "support_ticket_replies_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_ticket_replies"
    ADD CONSTRAINT "support_ticket_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."task_comments"
    ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."event_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_subtasks"
    ADD CONSTRAINT "task_subtasks_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."task_subtasks"
    ADD CONSTRAINT "task_subtasks_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."event_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."task_templates"
    ADD CONSTRAINT "task_templates_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_transfers"
    ADD CONSTRAINT "ticket_transfers_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."ticket_transfers"
    ADD CONSTRAINT "ticket_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ticket_transfers"
    ADD CONSTRAINT "ticket_transfers_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_transfers"
    ADD CONSTRAINT "ticket_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ticket_types"
    ADD CONSTRAINT "ticket_types_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_check_in_device_id_fkey" FOREIGN KEY ("check_in_device_id") REFERENCES "public"."checkin_devices"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_original_buyer_id_fkey" FOREIGN KEY ("original_buyer_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "public"."ticket_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_transferred_from_user_id_fkey" FOREIGN KEY ("transferred_from_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."whatsapp_audit"
    ADD CONSTRAINT "whatsapp_audit_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id");



ALTER TABLE ONLY "public"."whatsapp_audit"
    ADD CONSTRAINT "whatsapp_audit_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."whatsapp_audit"
    ADD CONSTRAINT "whatsapp_audit_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."whatsapp_broadcasts"
    ADD CONSTRAINT "whatsapp_broadcasts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."whatsapp_broadcasts"
    ADD CONSTRAINT "whatsapp_broadcasts_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_credit_purchases"
    ADD CONSTRAINT "whatsapp_credit_purchases_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



ALTER TABLE ONLY "public"."whatsapp_credit_purchases"
    ADD CONSTRAINT "whatsapp_credit_purchases_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "public"."whatsapp_credit_packages"("id");



ALTER TABLE ONLY "public"."whatsapp_credit_usage"
    ADD CONSTRAINT "whatsapp_credit_usage_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id");



CREATE POLICY "Admins can manage admin_logs" ON "public"."admin_logs" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage affiliate settings" ON "public"."affiliate_settings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage all documents" ON "public"."kyc_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage all refunds" ON "public"."refund_requests" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ((("profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[])) OR ("profiles"."is_admin" = true))))));



CREATE POLICY "Admins can manage all support_tickets" ON "public"."support_tickets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage all waitlist" ON "public"."waitlist" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ((("profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[])) OR ("profiles"."is_admin" = true))))));



CREATE POLICY "Admins can manage countries" ON "public"."countries" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage country_features" ON "public"."country_features" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage currencies" ON "public"."currencies" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage email_audit" ON "public"."email_audit" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage features" ON "public"."features" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage finance users" ON "public"."finance_users" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = ANY ((ARRAY['super_admin'::character varying, 'admin'::character varying])::"text"[]))))));



CREATE POLICY "Admins can manage impersonation_log" ON "public"."admin_impersonation_log" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage legal_documents" ON "public"."legal_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage payment_gateway_config" ON "public"."payment_gateway_config" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage platform sms config" ON "public"."platform_sms_config" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage platform whatsapp config" ON "public"."platform_whatsapp_config" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage platform_branding" ON "public"."platform_branding" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage platform_limits" ON "public"."platform_limits" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can manage platform_settings" ON "public"."platform_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ((("profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[])) OR ("profiles"."is_admin" = true)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ((("profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[])) OR ("profiles"."is_admin" = true))))));



CREATE POLICY "Admins can manage referral earnings" ON "public"."referral_earnings" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage referral payouts" ON "public"."referral_payouts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage sms_audit" ON "public"."sms_audit" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage sms_campaigns" ON "public"."sms_campaigns" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage whatsapp_audit" ON "public"."whatsapp_audit" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can manage whatsapp_broadcasts" ON "public"."whatsapp_broadcasts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can update all orders" ON "public"."orders" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can view all bank accounts" ON "public"."organizer_bank_accounts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all bank changes" ON "public"."bank_account_changes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all campaigns" ON "public"."sms_campaigns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all communications" ON "public"."communication_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ((("profiles"."role")::"text" = ANY ((ARRAY['admin'::character varying, 'super_admin'::character varying])::"text"[])) OR ("profiles"."is_admin" = true))))));



CREATE POLICY "Admins can view all events" ON "public"."events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can view all orders" ON "public"."orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can view all organizers" ON "public"."organizers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can view all sms logs" ON "public"."sms_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all tickets" ON "public"."tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins can view all usage" ON "public"."sms_usage_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view all whatsapp configs" ON "public"."organizer_whatsapp_config" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins can view audit logs" ON "public"."admin_audit_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins full access replies" ON "public"."support_ticket_replies" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins full access tickets" ON "public"."support_tickets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Admins full access to scheduled emails" ON "public"."scheduled_emails" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Admins full access to templates" ON "public"."email_templates" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "Allow ticket purchases" ON "public"."tickets" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert clicks" ON "public"."promoter_clicks" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert responses during checkout" ON "public"."custom_field_responses" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read active promo codes" ON "public"."promo_codes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can read countries" ON "public"."countries" FOR SELECT USING (true);



CREATE POLICY "Anyone can read country_features" ON "public"."country_features" FOR SELECT USING (true);



CREATE POLICY "Anyone can read currencies" ON "public"."currencies" FOR SELECT USING (true);



CREATE POLICY "Anyone can read custom fields" ON "public"."event_custom_fields" FOR SELECT USING (true);



CREATE POLICY "Anyone can read features" ON "public"."features" FOR SELECT USING (true);



CREATE POLICY "Anyone can read legal_documents" ON "public"."legal_documents" FOR SELECT USING (true);



CREATE POLICY "Anyone can read platform_branding" ON "public"."platform_branding" FOR SELECT USING (true);



CREATE POLICY "Anyone can read platform_settings" ON "public"."platform_settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can read system templates" ON "public"."email_templates" FOR SELECT USING ((("owner_type" = 'system'::"text") OR ("is_system" = true)));



CREATE POLICY "Anyone can read their own responses" ON "public"."custom_field_responses" FOR SELECT USING (("ticket_id" IN ( SELECT "tickets"."id"
   FROM "public"."tickets"
  WHERE ("tickets"."user_id" = "auth"."uid"()))));



CREATE POLICY "Anyone can view active sms_packages" ON "public"."sms_packages" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can view affiliate settings" ON "public"."affiliate_settings" FOR SELECT USING (true);



CREATE POLICY "Anyone can view event day activities" ON "public"."event_day_activities" FOR SELECT USING (true);



CREATE POLICY "Anyone can view event days" ON "public"."event_days" FOR SELECT USING (true);



CREATE POLICY "Anyone can view event images" ON "public"."event_images" FOR SELECT USING (true);



CREATE POLICY "Anyone can view event sponsors" ON "public"."event_sponsors" FOR SELECT USING (true);



CREATE POLICY "Anyone can view global templates" ON "public"."task_templates" FOR SELECT USING ((("is_global" = true) OR ("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Anyone can view sponsor logos" ON "public"."sponsor_logos" FOR SELECT USING (true);



CREATE POLICY "Authenticated can read platform_limits" ON "public"."platform_limits" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users can insert order items" ON "public"."order_items" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Categories are viewable by everyone" ON "public"."categories" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Finance users can manage advances" ON "public"."advance_payments" USING (((EXISTS ( SELECT 1
   FROM "public"."finance_users"
  WHERE (("finance_users"."user_id" = "auth"."uid"()) AND ("finance_users"."is_active" = true)))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = ANY ((ARRAY['super_admin'::character varying, 'admin'::character varying])::"text"[])))))));



CREATE POLICY "Finance users can read audit logs" ON "public"."finance_audit_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."finance_users"
  WHERE (("finance_users"."user_id" = "auth"."uid"()) AND ("finance_users"."is_active" = true)))));



CREATE POLICY "Only admins can read payment_gateway_config" ON "public"."payment_gateway_config" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND (("profiles"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Organizers can create own campaigns" ON "public"."sms_campaigns" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can create own templates" ON "public"."email_templates" FOR INSERT WITH CHECK ((("owner_type" = 'organizer'::"text") AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Organizers can create ticket types" ON "public"."ticket_types" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "ticket_types"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can delete event images" ON "public"."event_images" FOR DELETE USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can delete own bank accounts" ON "public"."bank_accounts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "bank_accounts"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can delete own templates" ON "public"."email_templates" FOR DELETE USING ((("owner_type" = 'organizer'::"text") AND ("owner_id" = "auth"."uid"()) AND ("is_system" = false)));



CREATE POLICY "Organizers can delete promo codes" ON "public"."promo_codes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "promo_codes"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can delete sponsor logos" ON "public"."sponsor_logos" FOR DELETE USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can delete their promoters" ON "public"."promoters" FOR DELETE USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can insert own bank accounts" ON "public"."organizer_bank_accounts" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can insert sponsor logos" ON "public"."sponsor_logos" FOR INSERT WITH CHECK (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage bank accounts" ON "public"."bank_accounts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage custom fields" ON "public"."event_custom_fields" USING (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."organizer_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage email campaigns" ON "public"."email_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage email whitelist" ON "public"."event_email_whitelist" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_email_whitelist"."event_id") AND ("e"."organizer_id" IN ( SELECT "organizers"."id"
           FROM "public"."organizers"
          WHERE ("organizers"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Organizers can manage event waitlist" ON "public"."waitlist" USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("o"."id" = "e"."organizer_id")))
  WHERE (("e"."id" = "waitlist"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can manage invite codes" ON "public"."event_invite_codes" USING ((EXISTS ( SELECT 1
   FROM "public"."events" "e"
  WHERE (("e"."id" = "event_invite_codes"."event_id") AND ("e"."organizer_id" IN ( SELECT "organizers"."id"
           FROM "public"."organizers"
          WHERE ("organizers"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Organizers can manage kyc documents" ON "public"."kyc_documents" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage own broadcasts" ON "public"."whatsapp_broadcasts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage own campaigns" ON "public"."sms_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage own promo codes" ON "public"."promo_codes" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage own whatsapp config" ON "public"."organizer_whatsapp_config" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage promo codes" ON "public"."promo_codes" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage sms campaigns" ON "public"."sms_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage their event day activities" ON "public"."event_day_activities" USING (("event_day_id" IN ( SELECT "ed"."id"
   FROM ("public"."event_days" "ed"
     JOIN "public"."events" "e" ON (("ed"."event_id" = "e"."id")))
  WHERE ("e"."organizer_id" = "auth"."uid"())))) WITH CHECK (("event_day_id" IN ( SELECT "ed"."id"
   FROM ("public"."event_days" "ed"
     JOIN "public"."events" "e" ON (("ed"."event_id" = "e"."id")))
  WHERE ("e"."organizer_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage their event days" ON "public"."event_days" USING (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."organizer_id" = "auth"."uid"())))) WITH CHECK (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."organizer_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage their event sponsors" ON "public"."event_sponsors" USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("o"."id" = "e"."organizer_id")))
  WHERE ("o"."user_id" = "auth"."uid"())))) WITH CHECK (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("o"."id" = "e"."organizer_id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage their tasks" ON "public"."event_tasks" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage their team members" ON "public"."organizer_team_members" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can manage their templates" ON "public"."task_templates" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can read own templates" ON "public"."email_templates" FOR SELECT USING ((("owner_type" = 'organizer'::"text") AND ("owner_id" = "auth"."uid"())));



CREATE POLICY "Organizers can read responses" ON "public"."custom_field_responses" FOR SELECT USING (("custom_field_id" IN ( SELECT "cf"."id"
   FROM ("public"."event_custom_fields" "cf"
     JOIN "public"."events" "e" ON (("cf"."event_id" = "e"."id")))
  WHERE ("e"."organizer_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can update event images" ON "public"."event_images" FOR UPDATE USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can update event refunds" ON "public"."refund_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "refund_requests"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update orders for their events" ON "public"."orders" FOR UPDATE USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("o"."id" = "e"."organizer_id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can update own bank accounts" ON "public"."bank_accounts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "bank_accounts"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update own bank accounts" ON "public"."organizer_bank_accounts" FOR UPDATE USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can update own events" ON "public"."events" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "events"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update own templates" ON "public"."email_templates" FOR UPDATE USING ((("owner_type" = 'organizer'::"text") AND ("owner_id" = "auth"."uid"()) AND ("is_system" = false)));



CREATE POLICY "Organizers can update promo codes" ON "public"."promo_codes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "promo_codes"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update sponsor logos" ON "public"."sponsor_logos" FOR UPDATE USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can update their promoters" ON "public"."promoters" FOR UPDATE USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can update ticket types" ON "public"."ticket_types" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."events"
     JOIN "public"."organizers" ON (("organizers"."id" = "events"."organizer_id")))
  WHERE (("events"."id" = "ticket_types"."event_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can update tickets" ON "public"."tickets" FOR UPDATE USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can upload documents" ON "public"."kyc_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organizers" "o"
  WHERE (("o"."id" = "kyc_documents"."organizer_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view code usage" ON "public"."invite_code_usage" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."event_invite_codes" "ic"
     JOIN "public"."events" "e" ON (("e"."id" = "ic"."event_id")))
  WHERE (("ic"."id" = "invite_code_usage"."invite_code_id") AND ("e"."organizer_id" IN ( SELECT "organizers"."id"
           FROM "public"."organizers"
          WHERE ("organizers"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Organizers can view event refunds" ON "public"."refund_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "refund_requests"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view followers" ON "public"."followers" FOR SELECT USING ((("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Organizers can view orders for own events" ON "public"."orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."events"
     JOIN "public"."organizers" ON (("organizers"."id" = "events"."organizer_id")))
  WHERE (("events"."id" = "orders"."event_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own advances" ON "public"."advance_payments" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own bank accounts" ON "public"."bank_accounts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "bank_accounts"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own bank accounts" ON "public"."organizer_bank_accounts" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own bank changes" ON "public"."bank_account_changes" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own campaigns" ON "public"."sms_campaigns" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own documents" ON "public"."kyc_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers" "o"
  WHERE (("o"."id" = "kyc_documents"."organizer_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own email_audit" ON "public"."email_audit" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own events" ON "public"."events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "events"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own followers" ON "public"."followers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "followers"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own payout events" ON "public"."payout_events" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."payouts"
     JOIN "public"."organizers" ON (("organizers"."id" = "payouts"."organizer_id")))
  WHERE (("payouts"."id" = "payout_events"."payout_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own payouts" ON "public"."payouts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "payouts"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own promo codes" ON "public"."promo_codes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "promo_codes"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own sms logs" ON "public"."sms_logs" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own sms_audit" ON "public"."sms_audit" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own ticket types" ON "public"."ticket_types" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."events"
     JOIN "public"."organizers" ON (("organizers"."id" = "events"."organizer_id")))
  WHERE (("events"."id" = "ticket_types"."event_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view own usage" ON "public"."sms_usage_log" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view own whatsapp_audit" ON "public"."whatsapp_audit" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view refunds by organizer_id" ON "public"."refund_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers" "o"
  WHERE (("o"."id" = "refund_requests"."organizer_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view reviews for own events" ON "public"."reviews" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."organizers"
  WHERE (("organizers"."id" = "reviews"."organizer_id") AND ("organizers"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organizers can view their event tickets" ON "public"."tickets" FOR SELECT USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view their own payouts" ON "public"."stripe_connect_payouts" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view their payouts" ON "public"."payouts" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view their promoters" ON "public"."promoters" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view their tasks" ON "public"."event_tasks" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers can view their team members" ON "public"."organizer_team_members" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage campaign_recipients" ON "public"."campaign_recipients" USING (("campaign_id" IN ( SELECT "email_campaigns"."id"
   FROM "public"."email_campaigns"
  WHERE ("email_campaigns"."organizer_id" IN ( SELECT "organizers"."id"
           FROM "public"."organizers"
          WHERE ("organizers"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Organizers manage email_campaigns" ON "public"."email_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage own broadcasts" ON "public"."whatsapp_broadcasts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage own comments" ON "public"."task_comments" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage own subtasks" ON "public"."task_subtasks" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage own tasks" ON "public"."event_tasks" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage own wa purchases" ON "public"."whatsapp_credit_purchases" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage own wa usage" ON "public"."whatsapp_credit_usage" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage own wa wallet" ON "public"."organizer_whatsapp_wallet" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage promo_codes" ON "public"."promo_codes" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage sms_campaigns" ON "public"."sms_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage their sms_balances" ON "public"."sms_balances" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers manage whatsapp_broadcasts" ON "public"."whatsapp_broadcasts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers view their sms_messages" ON "public"."sms_messages" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizers view their sms_purchases" ON "public"."sms_purchases" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "Promoters can view their own payouts" ON "public"."promoter_payouts" FOR SELECT USING (("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))));



CREATE POLICY "Promoters manage own bank accounts" ON "public"."promoter_bank_accounts" USING (("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))));



CREATE POLICY "Promoters view own clicks" ON "public"."promoter_clicks" FOR SELECT USING (("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))));



CREATE POLICY "Promoters view own events" ON "public"."promoter_events" FOR SELECT USING (("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))));



CREATE POLICY "Promoters view own payouts" ON "public"."promoter_payouts" FOR SELECT USING (("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))));



CREATE POLICY "Promoters view own sales" ON "public"."promoter_sales" FOR SELECT USING (("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))));



CREATE POLICY "Public can validate invite codes" ON "public"."event_invite_codes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can validate promo codes" ON "public"."promo_codes" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view active ads" ON "public"."advertisements" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can view active adverts" ON "public"."platform_adverts" FOR SELECT USING ((("is_active" = true) AND (("now"() >= "start_date") AND ("now"() <= "end_date"))));



CREATE POLICY "Public can view active organizers" ON "public"."organizers" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Public profiles are viewable" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Public view wa packages" ON "public"."whatsapp_credit_packages" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public view wa rates" ON "public"."whatsapp_message_rates" FOR SELECT USING (true);



CREATE POLICY "Published events are viewable by everyone" ON "public"."events" FOR SELECT USING ((("status")::"text" = 'published'::"text"));



CREATE POLICY "Service role can insert communications" ON "public"."communication_logs" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Service role can manage all events" ON "public"."stripe_connect_events" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role can manage all payouts" ON "public"."stripe_connect_payouts" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access" ON "public"."organizer_bank_accounts" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access earnings" ON "public"."referral_earnings" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access on bank_changes" ON "public"."bank_account_changes" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access payouts" ON "public"."referral_payouts" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to sms_campaigns" ON "public"."sms_campaigns" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access to sms_logs" ON "public"."sms_logs" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role only" ON "public"."email_rate_limits" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role only" ON "public"."phone_otps" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "System can insert audit logs" ON "public"."admin_audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert audit logs" ON "public"."finance_audit_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can insert transfers" ON "public"."ticket_transfers" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can manage limits" ON "public"."email_send_limits" USING (true);



CREATE POLICY "System can manage usage" ON "public"."sms_usage_log" USING (true);



CREATE POLICY "System can record code usage" ON "public"."invite_code_usage" FOR INSERT WITH CHECK (true);



CREATE POLICY "Team members can view and manage tasks" ON "public"."event_tasks" USING (("organizer_id" IN ( SELECT "organizer_team_members"."organizer_id"
   FROM "public"."organizer_team_members"
  WHERE (("organizer_team_members"."user_id" = "auth"."uid"()) AND ("organizer_team_members"."status" = 'active'::"text")))));



CREATE POLICY "Team members can view attendees" ON "public"."tickets" FOR SELECT USING (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizer_team_members" "tm" ON (("tm"."organizer_id" = "e"."organizer_id")))
  WHERE (("tm"."user_id" = "auth"."uid"()) AND ("tm"."status" = 'active'::"text") AND ("tm"."role" = ANY (ARRAY['manager'::"text", 'coordinator'::"text", 'staff'::"text"]))))));



CREATE POLICY "Team members can view organizer events" ON "public"."events" FOR SELECT USING (("organizer_id" IN ( SELECT "organizer_team_members"."organizer_id"
   FROM "public"."organizer_team_members"
  WHERE (("organizer_team_members"."user_id" = "auth"."uid"()) AND ("organizer_team_members"."status" = 'active'::"text")))));



CREATE POLICY "Ticket buyers can insert responses" ON "public"."custom_field_responses" FOR INSERT WITH CHECK (("ticket_id" IN ( SELECT "tickets"."id"
   FROM "public"."tickets"
  WHERE ("tickets"."user_id" = "auth"."uid"()))));



CREATE POLICY "Ticket types viewable for published events" ON "public"."ticket_types" FOR SELECT USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."events"
  WHERE (("events"."id" = "ticket_types"."event_id") AND (("events"."status")::"text" = 'published'::"text"))))));



CREATE POLICY "Users can add payment methods" ON "public"."saved_payment_methods" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can cancel own scheduled emails" ON "public"."scheduled_emails" FOR DELETE USING ((("sender_id" = "auth"."uid"()) AND ("status" = 'scheduled'::"text")));



CREATE POLICY "Users can cancel own waitlist" ON "public"."waitlist" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can check own email whitelist" ON "public"."event_email_whitelist" FOR SELECT USING ((("email")::"text" = (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text"));



CREATE POLICY "Users can check own finance access" ON "public"."finance_users" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create orders" ON "public"."orders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create organizer profile" ON "public"."organizers" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create refund requests" ON "public"."refund_requests" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create reviews" ON "public"."reviews" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create scheduled emails" ON "public"."scheduled_emails" FOR INSERT WITH CHECK (("sender_id" = "auth"."uid"()));



CREATE POLICY "Users can create support tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create support_tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create tickets" ON "public"."support_tickets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete payment methods" ON "public"."saved_payment_methods" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can follow organizers" ON "public"."organizer_follows" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "Users can insert waitlist" ON "public"."waitlist" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can reply to own tickets" ON "public"."support_ticket_replies" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."support_tickets"
  WHERE (("support_tickets"."id" = "support_ticket_replies"."ticket_id") AND ("support_tickets"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can save events" ON "public"."saved_events" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unfollow" ON "public"."followers" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can unfollow organizers" ON "public"."organizer_follows" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unsave events" ON "public"."saved_events" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own last login" ON "public"."finance_users" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own orders" ON "public"."orders" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("buyer_email")::"text" IN ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("buyer_email")::"text" IN ( SELECT "profiles"."email"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "Users can update own organizer profile" ON "public"."organizers" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own payment methods" ON "public"."saved_payment_methods" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own pending requests" ON "public"."refund_requests" FOR UPDATE TO "authenticated" USING ((("user_id" = "auth"."uid"()) AND (("status")::"text" = 'pending'::"text")));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can update own promoter profile" ON "public"."promoters" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own reviews" ON "public"."reviews" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own scheduled emails" ON "public"."scheduled_emails" FOR UPDATE USING ((("sender_id" = "auth"."uid"()) AND ("status" = 'scheduled'::"text")));



CREATE POLICY "Users can update own tickets" ON "public"."support_tickets" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own audit logs" ON "public"."audit_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own communications" ON "public"."communication_logs" FOR SELECT TO "authenticated" USING (("recipient_user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own follows" ON "public"."followers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own follows" ON "public"."organizer_follows" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own limits" ON "public"."email_send_limits" FOR SELECT USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "Users can view own order items" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders"
  WHERE (("orders"."id" = "order_items"."order_id") AND ("orders"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own orders" ON "public"."orders" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own organizer profile" ON "public"."organizers" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own payment methods" ON "public"."saved_payment_methods" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own promoter profile" ON "public"."promoters" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own referral earnings" ON "public"."referral_earnings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own referral payouts" ON "public"."referral_payouts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own refund requests" ON "public"."refund_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own saved events" ON "public"."saved_events" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own scheduled emails" ON "public"."scheduled_emails" FOR SELECT USING (("sender_id" = "auth"."uid"()));



CREATE POLICY "Users can view own support tickets" ON "public"."support_tickets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own support_tickets" ON "public"."support_tickets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own tickets" ON "public"."support_tickets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own tickets" ON "public"."tickets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own transfers" ON "public"."ticket_transfers" FOR SELECT USING ((("auth"."uid"() = "from_user_id") OR ("auth"."uid"() = "to_user_id")));



CREATE POLICY "Users can view own waitlist" ON "public"."waitlist" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can view replies on own tickets" ON "public"."support_ticket_replies" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."support_tickets"
  WHERE (("support_tickets"."id" = "support_ticket_replies"."ticket_id") AND ("support_tickets"."user_id" = "auth"."uid"())))) AND ("is_internal" = false)));



CREATE POLICY "Users can view their team memberships" ON "public"."organizer_team_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage notification_preferences" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Verified organizers are viewable by everyone" ON "public"."organizers" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Visible reviews are viewable by everyone" ON "public"."reviews" FOR SELECT USING (("is_visible" = true));



ALTER TABLE "public"."admin_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_actions_policy" ON "public"."admin_actions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."admin_audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_impersonation_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."advance_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."advertisements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."affiliate_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_account_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bank_accounts_policy" ON "public"."bank_accounts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "bank_accounts_secure_insert" ON "public"."bank_accounts" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."campaign_recipients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkin_devices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checkin_devices_policy" ON "public"."checkin_devices" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."checkin_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checkin_logs_policy" ON "public"."checkin_logs" USING (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."organizer_id" IN ( SELECT "organizers"."id"
           FROM "public"."organizers"
          WHERE ("organizers"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."communication_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."countries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."country_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."currencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_field_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "email_campaigns_policy" ON "public"."email_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."email_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_send_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."email_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_day_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_earnings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_earnings_policy" ON "public"."event_earnings" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."event_email_whitelist" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_history_admin_all" ON "public"."event_history" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "event_history_organizer_insert" ON "public"."event_history" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "event_history"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "event_history_organizer_select" ON "public"."event_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "event_history"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."event_images" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_images_secure_insert" ON "public"."event_images" FOR INSERT WITH CHECK (("event_id" IN ( SELECT "e"."id"
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE ("o"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."event_invite_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_sponsors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_secure_insert" ON "public"."events" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finance_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "followers_delete_policy" ON "public"."followers" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "followers_organizer_policy" ON "public"."followers" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "followers_secure_insert" ON "public"."followers" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "followers_select_policy" ON "public"."followers" FOR SELECT USING (true);



ALTER TABLE "public"."invite_code_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyc_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_policy" ON "public"."kyc_verifications" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."kyc_verifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."legal_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."login_attempts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "login_attempts_admin" ON "public"."login_attempts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "login_attempts_insert" ON "public"."login_attempts" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_follows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_sms_wallet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_whatsapp_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizer_whatsapp_wallet" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packages_admin" ON "public"."sms_credit_packages" USING (true);



CREATE POLICY "packages_public_read" ON "public"."sms_credit_packages" FOR SELECT USING (("is_active" = true));



ALTER TABLE "public"."payment_gateway_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payout_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payouts_policy" ON "public"."payouts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "payouts_secure_insert" ON "public"."payouts" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."phone_otps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_adverts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_adverts_admin_only" ON "public"."platform_adverts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."platform_branding" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_sms_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_whatsapp_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_public_read" ON "public"."profiles" FOR SELECT USING (true);



ALTER TABLE "public"."promo_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promo_codes_policy" ON "public"."promo_codes" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "promo_codes_secure_insert" ON "public"."promo_codes" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "promoter_bank_access" ON "public"."promoter_bank_accounts" USING ((("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."promoter_bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promoter_clicks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_clicks_insert" ON "public"."promoter_clicks" FOR INSERT WITH CHECK (true);



CREATE POLICY "promoter_clicks_select" ON "public"."promoter_clicks" FOR SELECT USING ((("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."promoter_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_events_access" ON "public"."promoter_events" USING ((("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."promoter_payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_payouts_access" ON "public"."promoter_payouts" USING ((("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."promoter_sales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoter_sales_access" ON "public"."promoter_sales" USING ((("promoter_id" IN ( SELECT "promoters"."id"
   FROM "public"."promoters"
  WHERE ("promoters"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



ALTER TABLE "public"."promoters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "promoters_access" ON "public"."promoters" USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "promoters_secure_insert" ON "public"."promoters" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "purchases_access" ON "public"."sms_credit_purchases" USING ((("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "purchases_insert" ON "public"."sms_credit_purchases" FOR INSERT WITH CHECK (true);



CREATE POLICY "purchases_update" ON "public"."sms_credit_purchases" FOR UPDATE USING (true);



ALTER TABLE "public"."referral_earnings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referral_payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund_admin_all" ON "public"."refund_requests" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "refund_organizer_select" ON "public"."refund_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (("public"."orders" "o"
     JOIN "public"."events" "e" ON (("o"."event_id" = "e"."id")))
     JOIN "public"."organizers" "org" ON (("e"."organizer_id" = "org"."id")))
  WHERE (("o"."id" = "refund_requests"."order_id") AND ("org"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."refund_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refund_user_insert" ON "public"."refund_requests" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "refund_user_select" ON "public"."refund_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_admin" ON "public"."reviews" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "reviews_organizer_view" ON "public"."reviews" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "reviews_public_read" ON "public"."reviews" FOR SELECT USING (("is_visible" = true));



CREATE POLICY "reviews_user_manage" ON "public"."reviews" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."saved_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "saved_events_user" ON "public"."saved_events" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."saved_payment_methods" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scheduled_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_audit_admin" ON "public"."sms_audit" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_audit_organizer" ON "public"."sms_audit" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."sms_balances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_balances_admin" ON "public"."sms_balances" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_balances_organizer" ON "public"."sms_balances" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "sms_balances_policy" ON "public"."sms_balances" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."sms_campaigns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_campaigns_admin" ON "public"."sms_campaigns" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_campaigns_organizer" ON "public"."sms_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "sms_campaigns_policy" ON "public"."sms_campaigns" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."sms_credit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_credit_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_credit_usage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_log_admin" ON "public"."sms_usage_log" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_log_organizer" ON "public"."sms_usage_log" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."sms_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sms_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_messages_admin" ON "public"."sms_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_messages_organizer" ON "public"."sms_messages" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "sms_messages_policy" ON "public"."sms_messages" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."sms_packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_packages_admin" ON "public"."sms_credit_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_packages_admin_manage" ON "public"."sms_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_packages_policy" ON "public"."sms_packages" FOR SELECT USING (("is_active" = true));



CREATE POLICY "sms_packages_public_read" ON "public"."sms_credit_packages" FOR SELECT USING (true);



CREATE POLICY "sms_packages_read" ON "public"."sms_packages" FOR SELECT USING (true);



ALTER TABLE "public"."sms_purchases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_purchases_adm" ON "public"."sms_purchases" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_purchases_admin" ON "public"."sms_credit_purchases" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "sms_purchases_org" ON "public"."sms_purchases" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "sms_purchases_organizer" ON "public"."sms_credit_purchases" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "sms_purchases_policy" ON "public"."sms_purchases" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "sms_usage_admin" ON "public"."sms_credit_usage" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."sms_usage_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sms_usage_organizer" ON "public"."sms_credit_usage" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."sponsor_logos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sponsor_logos_organizer" ON "public"."sponsor_logos" USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "sponsor_logos"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "sponsor_logos_public" ON "public"."sponsor_logos" FOR SELECT USING (true);



ALTER TABLE "public"."stripe_connect_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_connect_payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_admin_all" ON "public"."support_tickets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."support_ticket_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_user_insert" ON "public"."support_tickets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "support_user_select" ON "public"."support_tickets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "support_user_update" ON "public"."support_tickets" FOR UPDATE USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."task_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_subtasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."task_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_transfers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_types_admin" ON "public"."ticket_types" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "ticket_types_manage_policy" ON "public"."ticket_types" USING (("event_id" IN ( SELECT "events"."id"
   FROM "public"."events"
  WHERE ("events"."organizer_id" IN ( SELECT "organizers"."id"
           FROM "public"."organizers"
          WHERE ("organizers"."user_id" = "auth"."uid"()))))));



CREATE POLICY "ticket_types_organizer" ON "public"."ticket_types" USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "ticket_types"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "ticket_types_public_read" ON "public"."ticket_types" FOR SELECT USING (true);



CREATE POLICY "ticket_types_select_policy" ON "public"."ticket_types" FOR SELECT USING (true);



ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tickets_admin_all" ON "public"."tickets" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "tickets_insert" ON "public"."tickets" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "tickets_organizer_select" ON "public"."tickets" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."events" "e"
     JOIN "public"."organizers" "o" ON (("e"."organizer_id" = "o"."id")))
  WHERE (("e"."id" = "tickets"."event_id") AND ("o"."user_id" = "auth"."uid"())))));



CREATE POLICY "tickets_update" ON "public"."tickets" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "tickets_user_select" ON "public"."tickets" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "usage_access" ON "public"."sms_credit_usage" USING ((("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "usage_insert" ON "public"."sms_credit_usage" FOR INSERT WITH CHECK (true);



CREATE POLICY "wa_audit_admin" ON "public"."whatsapp_audit" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "wa_audit_organizer" ON "public"."whatsapp_audit" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "wa_broadcasts_admin" ON "public"."whatsapp_broadcasts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "wa_broadcasts_organizer" ON "public"."whatsapp_broadcasts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "wa_packages_admin" ON "public"."whatsapp_credit_packages" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "wa_packages_read" ON "public"."whatsapp_credit_packages" FOR SELECT USING (true);



CREATE POLICY "wa_purchases_admin" ON "public"."whatsapp_credit_purchases" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "wa_purchases_organizer" ON "public"."whatsapp_credit_purchases" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "wa_rates_admin" ON "public"."whatsapp_message_rates" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "wa_rates_read" ON "public"."whatsapp_message_rates" FOR SELECT USING (true);



CREATE POLICY "wa_usage_admin" ON "public"."whatsapp_credit_usage" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



CREATE POLICY "wa_usage_organizer" ON "public"."whatsapp_credit_usage" FOR SELECT USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wallet_access" ON "public"."organizer_sms_wallet" USING ((("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true))))));



CREATE POLICY "wallet_secure_insert" ON "public"."organizer_sms_wallet" FOR INSERT WITH CHECK (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



CREATE POLICY "wallet_secure_update" ON "public"."organizer_sms_wallet" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."is_admin" = true)))));



ALTER TABLE "public"."whatsapp_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "whatsapp_broadcasts_policy" ON "public"."whatsapp_broadcasts" USING (("organizer_id" IN ( SELECT "organizers"."id"
   FROM "public"."organizers"
  WHERE ("organizers"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."whatsapp_credit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_credit_purchases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_credit_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_message_rates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

















































































































































































GRANT ALL ON FUNCTION "public"."accept_team_invitation"("p_token" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_team_invitation"("p_token" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_team_invitation"("p_token" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_bank_account"("p_organizer_id" "uuid", "p_bank_name" "text", "p_bank_code" "text", "p_account_number" "text", "p_account_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_bank_account"("p_organizer_id" "uuid", "p_bank_name" "text", "p_bank_code" "text", "p_account_number" "text", "p_account_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_bank_account"("p_organizer_id" "uuid", "p_bank_name" "text", "p_bank_code" "text", "p_account_number" "text", "p_account_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."add_sms_credits"("p_organizer_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."add_sms_credits"("p_organizer_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_sms_credits"("p_organizer_id" "uuid", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."become_affiliate"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."become_affiliate"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."become_affiliate"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_refund_amount"("p_original_amount" numeric, "p_country_code" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_refund_amount"("p_original_amount" numeric, "p_country_code" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_refund_amount"("p_original_amount" numeric, "p_country_code" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_organizer_receive_payout"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_organizer_receive_payout"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_organizer_receive_payout"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_email_whitelist"("p_event_id" "uuid", "p_email" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."check_email_whitelist"("p_event_id" "uuid", "p_email" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_email_whitelist"("p_event_id" "uuid", "p_email" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_otps"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_rate_limits"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrypt_account_number"("encrypted_number" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."decrypt_account_number"("encrypted_number" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrypt_account_number"("encrypted_number" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."deduct_sms_credits"("p_organizer_id" "uuid", "p_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."deduct_sms_credits"("p_organizer_id" "uuid", "p_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deduct_sms_credits"("p_organizer_id" "uuid", "p_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_account"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_suspicious_bank_change"("p_organizer_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_ip_address" "inet") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_suspicious_bank_change"("p_organizer_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_ip_address" "inet") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_suspicious_bank_change"("p_organizer_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_ip_address" "inet") TO "service_role";



GRANT ALL ON FUNCTION "public"."encrypt_account_number"("account_number" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."encrypt_account_number"("account_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."encrypt_account_number"("account_number" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_bank"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_bank"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_bank"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_event_slug"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_event_slug"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_event_slug"("title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_invite_code"("length" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."generate_invite_code"("length" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_invite_code"("length" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_payout_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_payout_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_payout_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_qr_hash"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_qr_hash"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_qr_hash"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_referral_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_support_ticket_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_support_ticket_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_support_ticket_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_event_stats"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_stats"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_stats"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_waitlist_position"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_waitlist_position"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_waitlist_position"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organizer_stats"("p_organizer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organizer_stats"("p_organizer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organizer_stats"("p_organizer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_reminder_been_sent"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_template_key" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."has_reminder_been_sent"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_template_key" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_reminder_been_sent"("p_event_id" "uuid", "p_ticket_id" "uuid", "p_template_key" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ad_clicks"("ad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ad_clicks"("ad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ad_clicks"("ad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ad_impressions"("ad_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ad_impressions"("ad_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ad_impressions"("ad_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_promo_usage"("promo_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_promo_usage"("promo_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_promo_usage"("promo_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_promoter_clicks"("promoter_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_promoter_clicks"("promoter_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_promoter_clicks"("promoter_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_referral_count"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_referral_count"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_referral_count"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_bank_in_cooling_period"("bank_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_bank_in_cooling_period"("bank_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_bank_in_cooling_period"("bank_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_phone" "text", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_phone" "text", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_user_id" "uuid", "p_email" "text", "p_name" "text", "p_phone" "text", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_bank_account_change"("p_organizer_id" "uuid", "p_bank_account_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_previous_bank_name" "text", "p_previous_account_name" "text", "p_previous_account_number" "text", "p_new_bank_name" "text", "p_new_account_name" "text", "p_new_account_number" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_bank_account_change"("p_organizer_id" "uuid", "p_bank_account_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_previous_bank_name" "text", "p_previous_account_name" "text", "p_previous_account_number" "text", "p_new_bank_name" "text", "p_new_account_name" "text", "p_new_account_number" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_bank_account_change"("p_organizer_id" "uuid", "p_bank_account_id" "uuid", "p_user_id" "uuid", "p_change_type" "text", "p_previous_bank_name" "text", "p_previous_account_name" "text", "p_previous_account_number" "text", "p_new_bank_name" "text", "p_new_account_name" "text", "p_new_account_number" "text", "p_ip_address" "inet", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_next_waitlist"("p_event_id" "uuid", "p_hours_valid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."notify_next_waitlist"("p_event_id" "uuid", "p_hours_valid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_next_waitlist"("p_event_id" "uuid", "p_hours_valid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_role_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_role_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_role_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_scheduled_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."publish_scheduled_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_scheduled_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_ticket_sale"() TO "anon";
GRANT ALL ON FUNCTION "public"."record_ticket_sale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_ticket_sale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reinstate_affiliate"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."reinstate_affiliate"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reinstate_affiliate"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."release_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."release_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."release_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."reserve_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."reserve_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reserve_tickets"("p_ticket_type_id" "uuid", "p_quantity" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_bank_cooling_period"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_bank_cooling_period"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_bank_cooling_period"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_slug"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_slug"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_slug"() TO "service_role";



GRANT ALL ON FUNCTION "public"."suspend_affiliate"("p_user_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."suspend_affiliate"("p_user_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."suspend_affiliate"("p_user_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_organizer_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_organizer_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_organizer_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."transfer_ticket"("p_ticket_id" "uuid", "p_from_user_id" "uuid", "p_to_user_email" "text", "p_payment_reference" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."transfer_ticket"("p_ticket_id" "uuid", "p_from_user_id" "uuid", "p_to_user_email" "text", "p_payment_reference" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."transfer_ticket"("p_ticket_id" "uuid", "p_from_user_id" "uuid", "p_to_user_email" "text", "p_payment_reference" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_auto_payouts"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_auto_payouts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_auto_payouts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_organizer_event_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_organizer_event_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_organizer_event_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_organizer_kyc_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_organizer_kyc_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_organizer_kyc_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_promoter_sales"("p_promoter_id" "uuid", "p_sale_amount" numeric, "p_commission" numeric, "p_ticket_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_promoter_sales"("p_promoter_id" "uuid", "p_sale_amount" numeric, "p_commission" numeric, "p_ticket_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_promoter_sales"("p_promoter_id" "uuid", "p_sale_amount" numeric, "p_commission" numeric, "p_ticket_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_support_ticket_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_support_ticket_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_support_ticket_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_invite_code"("p_event_id" "uuid", "p_code" character varying, "p_user_email" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_invite_code"("p_event_id" "uuid", "p_code" character varying, "p_user_email" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_invite_code"("p_event_id" "uuid", "p_code" character varying, "p_user_email" character varying) TO "service_role";
























GRANT ALL ON TABLE "public"."admin_actions" TO "anon";
GRANT ALL ON TABLE "public"."admin_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_actions" TO "service_role";



GRANT ALL ON TABLE "public"."admin_audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."admin_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."admin_impersonation_log" TO "anon";
GRANT ALL ON TABLE "public"."admin_impersonation_log" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_impersonation_log" TO "service_role";



GRANT ALL ON TABLE "public"."admin_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_logs" TO "service_role";



GRANT ALL ON TABLE "public"."advance_payments" TO "anon";
GRANT ALL ON TABLE "public"."advance_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."advance_payments" TO "service_role";



GRANT ALL ON TABLE "public"."advertisements" TO "anon";
GRANT ALL ON TABLE "public"."advertisements" TO "authenticated";
GRANT ALL ON TABLE "public"."advertisements" TO "service_role";



GRANT ALL ON TABLE "public"."affiliate_settings" TO "anon";
GRANT ALL ON TABLE "public"."affiliate_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."affiliate_settings" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."bank_account_changes" TO "anon";
GRANT ALL ON TABLE "public"."bank_account_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_account_changes" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_recipients" TO "anon";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_recipients" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."checkin_devices" TO "anon";
GRANT ALL ON TABLE "public"."checkin_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."checkin_devices" TO "service_role";



GRANT ALL ON TABLE "public"."checkin_logs" TO "anon";
GRANT ALL ON TABLE "public"."checkin_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."checkin_logs" TO "service_role";



GRANT ALL ON TABLE "public"."communication_logs" TO "anon";
GRANT ALL ON TABLE "public"."communication_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."communication_logs" TO "service_role";



GRANT ALL ON TABLE "public"."countries" TO "anon";
GRANT ALL ON TABLE "public"."countries" TO "authenticated";
GRANT ALL ON TABLE "public"."countries" TO "service_role";



GRANT ALL ON TABLE "public"."country_features" TO "anon";
GRANT ALL ON TABLE "public"."country_features" TO "authenticated";
GRANT ALL ON TABLE "public"."country_features" TO "service_role";



GRANT ALL ON TABLE "public"."currencies" TO "anon";
GRANT ALL ON TABLE "public"."currencies" TO "authenticated";
GRANT ALL ON TABLE "public"."currencies" TO "service_role";



GRANT ALL ON TABLE "public"."custom_field_responses" TO "anon";
GRANT ALL ON TABLE "public"."custom_field_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_field_responses" TO "service_role";



GRANT ALL ON TABLE "public"."email_audit" TO "anon";
GRANT ALL ON TABLE "public"."email_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."email_audit" TO "service_role";



GRANT ALL ON TABLE "public"."email_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."email_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."email_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."email_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."email_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."email_send_limits" TO "anon";
GRANT ALL ON TABLE "public"."email_send_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."email_send_limits" TO "service_role";



GRANT ALL ON TABLE "public"."email_templates" TO "anon";
GRANT ALL ON TABLE "public"."email_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."email_templates" TO "service_role";



GRANT ALL ON TABLE "public"."event_custom_fields" TO "anon";
GRANT ALL ON TABLE "public"."event_custom_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."event_custom_fields" TO "service_role";



GRANT ALL ON TABLE "public"."event_day_activities" TO "anon";
GRANT ALL ON TABLE "public"."event_day_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."event_day_activities" TO "service_role";



GRANT ALL ON TABLE "public"."event_days" TO "anon";
GRANT ALL ON TABLE "public"."event_days" TO "authenticated";
GRANT ALL ON TABLE "public"."event_days" TO "service_role";



GRANT ALL ON TABLE "public"."event_earnings" TO "anon";
GRANT ALL ON TABLE "public"."event_earnings" TO "authenticated";
GRANT ALL ON TABLE "public"."event_earnings" TO "service_role";



GRANT ALL ON TABLE "public"."event_email_whitelist" TO "anon";
GRANT ALL ON TABLE "public"."event_email_whitelist" TO "authenticated";
GRANT ALL ON TABLE "public"."event_email_whitelist" TO "service_role";



GRANT ALL ON TABLE "public"."event_history" TO "anon";
GRANT ALL ON TABLE "public"."event_history" TO "authenticated";
GRANT ALL ON TABLE "public"."event_history" TO "service_role";



GRANT ALL ON TABLE "public"."event_images" TO "anon";
GRANT ALL ON TABLE "public"."event_images" TO "authenticated";
GRANT ALL ON TABLE "public"."event_images" TO "service_role";



GRANT ALL ON TABLE "public"."event_invite_codes" TO "anon";
GRANT ALL ON TABLE "public"."event_invite_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."event_invite_codes" TO "service_role";



GRANT ALL ON TABLE "public"."event_sponsors" TO "anon";
GRANT ALL ON TABLE "public"."event_sponsors" TO "authenticated";
GRANT ALL ON TABLE "public"."event_sponsors" TO "service_role";



GRANT ALL ON TABLE "public"."event_tasks" TO "anon";
GRANT ALL ON TABLE "public"."event_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."event_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."features" TO "anon";
GRANT ALL ON TABLE "public"."features" TO "authenticated";
GRANT ALL ON TABLE "public"."features" TO "service_role";



GRANT ALL ON TABLE "public"."finance_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."finance_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."finance_users" TO "anon";
GRANT ALL ON TABLE "public"."finance_users" TO "authenticated";
GRANT ALL ON TABLE "public"."finance_users" TO "service_role";



GRANT ALL ON TABLE "public"."followers" TO "anon";
GRANT ALL ON TABLE "public"."followers" TO "authenticated";
GRANT ALL ON TABLE "public"."followers" TO "service_role";



GRANT ALL ON TABLE "public"."invite_code_usage" TO "anon";
GRANT ALL ON TABLE "public"."invite_code_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_code_usage" TO "service_role";



GRANT ALL ON TABLE "public"."kyc_documents" TO "anon";
GRANT ALL ON TABLE "public"."kyc_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."kyc_documents" TO "service_role";



GRANT ALL ON TABLE "public"."kyc_verifications" TO "anon";
GRANT ALL ON TABLE "public"."kyc_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."kyc_verifications" TO "service_role";



GRANT ALL ON TABLE "public"."legal_documents" TO "anon";
GRANT ALL ON TABLE "public"."legal_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."legal_documents" TO "service_role";



GRANT ALL ON TABLE "public"."login_attempts" TO "anon";
GRANT ALL ON TABLE "public"."login_attempts" TO "authenticated";
GRANT ALL ON TABLE "public"."login_attempts" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."organizer_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_follows" TO "anon";
GRANT ALL ON TABLE "public"."organizer_follows" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_follows" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_sms_wallet" TO "anon";
GRANT ALL ON TABLE "public"."organizer_sms_wallet" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_sms_wallet" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_team_members" TO "anon";
GRANT ALL ON TABLE "public"."organizer_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_whatsapp_config" TO "anon";
GRANT ALL ON TABLE "public"."organizer_whatsapp_config" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_whatsapp_config" TO "service_role";



GRANT ALL ON TABLE "public"."organizer_whatsapp_wallet" TO "anon";
GRANT ALL ON TABLE "public"."organizer_whatsapp_wallet" TO "authenticated";
GRANT ALL ON TABLE "public"."organizer_whatsapp_wallet" TO "service_role";



GRANT ALL ON TABLE "public"."organizers" TO "anon";
GRANT ALL ON TABLE "public"."organizers" TO "authenticated";
GRANT ALL ON TABLE "public"."organizers" TO "service_role";



GRANT ALL ON TABLE "public"."payment_gateway_config" TO "anon";
GRANT ALL ON TABLE "public"."payment_gateway_config" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_gateway_config" TO "service_role";



GRANT ALL ON TABLE "public"."payout_events" TO "anon";
GRANT ALL ON TABLE "public"."payout_events" TO "authenticated";
GRANT ALL ON TABLE "public"."payout_events" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."phone_otps" TO "anon";
GRANT ALL ON TABLE "public"."phone_otps" TO "authenticated";
GRANT ALL ON TABLE "public"."phone_otps" TO "service_role";



GRANT ALL ON TABLE "public"."platform_adverts" TO "anon";
GRANT ALL ON TABLE "public"."platform_adverts" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_adverts" TO "service_role";



GRANT ALL ON TABLE "public"."platform_branding" TO "anon";
GRANT ALL ON TABLE "public"."platform_branding" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_branding" TO "service_role";



GRANT ALL ON TABLE "public"."platform_limits" TO "anon";
GRANT ALL ON TABLE "public"."platform_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_limits" TO "service_role";



GRANT ALL ON TABLE "public"."platform_settings" TO "anon";
GRANT ALL ON TABLE "public"."platform_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_settings" TO "service_role";



GRANT ALL ON TABLE "public"."platform_sms_config" TO "anon";
GRANT ALL ON TABLE "public"."platform_sms_config" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_sms_config" TO "service_role";



GRANT ALL ON TABLE "public"."platform_whatsapp_config" TO "anon";
GRANT ALL ON TABLE "public"."platform_whatsapp_config" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_whatsapp_config" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promo_codes" TO "anon";
GRANT ALL ON TABLE "public"."promo_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."promo_codes" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."promoter_bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_clicks" TO "anon";
GRANT ALL ON TABLE "public"."promoter_clicks" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_clicks" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_events" TO "anon";
GRANT ALL ON TABLE "public"."promoter_events" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_events" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_payouts" TO "anon";
GRANT ALL ON TABLE "public"."promoter_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."promoter_sales" TO "anon";
GRANT ALL ON TABLE "public"."promoter_sales" TO "authenticated";
GRANT ALL ON TABLE "public"."promoter_sales" TO "service_role";



GRANT ALL ON TABLE "public"."promoters" TO "anon";
GRANT ALL ON TABLE "public"."promoters" TO "authenticated";
GRANT ALL ON TABLE "public"."promoters" TO "service_role";



GRANT ALL ON TABLE "public"."referral_earnings" TO "anon";
GRANT ALL ON TABLE "public"."referral_earnings" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_earnings" TO "service_role";



GRANT ALL ON TABLE "public"."referral_payouts" TO "anon";
GRANT ALL ON TABLE "public"."referral_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."referral_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."refund_requests" TO "anon";
GRANT ALL ON TABLE "public"."refund_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."refund_requests" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."saved_events" TO "anon";
GRANT ALL ON TABLE "public"."saved_events" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_events" TO "service_role";



GRANT ALL ON TABLE "public"."saved_payment_methods" TO "anon";
GRANT ALL ON TABLE "public"."saved_payment_methods" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_payment_methods" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_emails" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_emails" TO "service_role";



GRANT ALL ON TABLE "public"."sms_audit" TO "anon";
GRANT ALL ON TABLE "public"."sms_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_audit" TO "service_role";



GRANT ALL ON TABLE "public"."sms_balances" TO "anon";
GRANT ALL ON TABLE "public"."sms_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_balances" TO "service_role";



GRANT ALL ON TABLE "public"."sms_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."sms_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."sms_credit_packages" TO "anon";
GRANT ALL ON TABLE "public"."sms_credit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_credit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."sms_credit_purchases" TO "anon";
GRANT ALL ON TABLE "public"."sms_credit_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_credit_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."sms_credit_usage" TO "anon";
GRANT ALL ON TABLE "public"."sms_credit_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_credit_usage" TO "service_role";



GRANT ALL ON TABLE "public"."sms_logs" TO "anon";
GRANT ALL ON TABLE "public"."sms_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sms_messages" TO "anon";
GRANT ALL ON TABLE "public"."sms_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_messages" TO "service_role";



GRANT ALL ON TABLE "public"."sms_packages" TO "anon";
GRANT ALL ON TABLE "public"."sms_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_packages" TO "service_role";



GRANT ALL ON TABLE "public"."sms_purchases" TO "anon";
GRANT ALL ON TABLE "public"."sms_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."sms_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."sms_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."sms_usage_log" TO "service_role";



GRANT ALL ON TABLE "public"."sponsor_logos" TO "anon";
GRANT ALL ON TABLE "public"."sponsor_logos" TO "authenticated";
GRANT ALL ON TABLE "public"."sponsor_logos" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_connect_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_connect_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_connect_events" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_connect_payouts" TO "anon";
GRANT ALL ON TABLE "public"."stripe_connect_payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_connect_payouts" TO "service_role";



GRANT ALL ON TABLE "public"."support_ticket_replies" TO "anon";
GRANT ALL ON TABLE "public"."support_ticket_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."support_ticket_replies" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."task_comments" TO "anon";
GRANT ALL ON TABLE "public"."task_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."task_comments" TO "service_role";



GRANT ALL ON TABLE "public"."task_subtasks" TO "anon";
GRANT ALL ON TABLE "public"."task_subtasks" TO "authenticated";
GRANT ALL ON TABLE "public"."task_subtasks" TO "service_role";



GRANT ALL ON TABLE "public"."task_templates" TO "anon";
GRANT ALL ON TABLE "public"."task_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."task_templates" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_transfers" TO "anon";
GRANT ALL ON TABLE "public"."ticket_transfers" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_transfers" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_types" TO "anon";
GRANT ALL ON TABLE "public"."ticket_types" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_types" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_audit" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_audit" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_credit_packages" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_credit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_credit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_credit_purchases" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_credit_purchases" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_credit_purchases" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_credit_usage" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_credit_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_credit_usage" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_message_rates" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_message_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_message_rates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































