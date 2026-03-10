-- ============================================================
-- REVOKE access to sensitive columns from anon role
-- ============================================================
-- The "Public can view active organizers" RLS policy allows
-- row-level access, but we restrict COLUMN access so anonymous
-- users can't read financial/KYC/payment integration details.
-- ============================================================

-- Organizers: revoke sensitive financial columns from anon
-- (These will return NULL for unauthenticated users)
DO $$
DECLARE
  col_name TEXT;
  sensitive_cols TEXT[] := ARRAY[
    'paystack_subaccount_id',
    'paystack_subaccount_status',
    'paystack_subaccount_enabled',
    'paystack_subaccount_payouts_enabled',
    'paystack_subaccount_charges_enabled',
    'paystack_subaccount_onboarded_at',
    'paystack_recipient_code',
    'stripe_connect_id',
    'stripe_connect_status',
    'stripe_connect_enabled',
    'stripe_account_id',
    'stripe_onboarding_complete',
    'bank_name',
    'bank_code',
    'bank_account_number',
    'bank_account_name',
    'kyc_status',
    'kyc_level',
    'kyc_submitted_at',
    'kyc_approved_at',
    'kyc_rejection_reason',
    'kyc_documents',
    'payout_currency',
    'payout_schedule',
    'payout_method',
    'direct_payout_eligible',
    'direct_payout_override',
    'balance',
    'pending_balance',
    'total_payouts',
    'flutterwave_subaccount_id',
    'flutterwave_subaccount_status'
  ];
BEGIN
  FOREACH col_name IN ARRAY sensitive_cols
  LOOP
    -- Only revoke if the column actually exists on the table
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organizers'
        AND column_name = col_name
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON organizers FROM anon', col_name);
      RAISE NOTICE 'Revoked anon SELECT on organizers.%', col_name;
    END IF;
  END LOOP;
END $$;

-- Promoters: revoke sensitive commission details from anon
DO $$
DECLARE
  col_name TEXT;
  sensitive_cols TEXT[] := ARRAY[
    'commission_type',
    'commission_value',
    'commission_rate',
    'total_earnings',
    'total_sales',
    'bank_account_id',
    'payout_method'
  ];
BEGIN
  FOREACH col_name IN ARRAY sensitive_cols
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'promoters'
        AND column_name = col_name
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON promoters FROM anon', col_name);
      RAISE NOTICE 'Revoked anon SELECT on promoters.%', col_name;
    END IF;
  END LOOP;
END $$;

-- Profiles: ensure no sensitive columns visible to anon
-- (anon should only see organizer profiles via RPC now,
--  but as defense-in-depth, revoke sensitive columns too)
DO $$
DECLARE
  col_name TEXT;
  sensitive_cols TEXT[] := ARRAY[
    'phone',
    'email',
    'is_admin',
    'role',
    'affiliate_status',
    'referral_code',
    'referral_count',
    'stripe_customer_id',
    'notification_preferences',
    'otp_secret',
    'last_otp_at'
  ];
BEGIN
  FOREACH col_name IN ARRAY sensitive_cols
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name = col_name
    ) THEN
      EXECUTE format('REVOKE SELECT (%I) ON profiles FROM anon', col_name);
      RAISE NOTICE 'Revoked anon SELECT on profiles.%', col_name;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- DONE - Sensitive columns hidden from anonymous access
-- ============================================================
