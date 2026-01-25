-- ============================================
-- FIX CONTACT OPT-INS
-- ============================================
-- This script ensures all existing contacts have proper opt-in settings
-- By default, users who purchased tickets or followed have given consent
-- ============================================

-- Update all existing contacts with phone numbers to have SMS and WhatsApp opt-in
UPDATE contacts 
SET 
  sms_opt_in = true, 
  whatsapp_opt_in = true,
  email_opt_in = COALESCE(email_opt_in, true)
WHERE phone IS NOT NULL
  AND (sms_opt_in IS NULL OR sms_opt_in = false);

-- Also ensure email opt-in is true for contacts with email
UPDATE contacts
SET email_opt_in = true
WHERE email IS NOT NULL
  AND (email_opt_in IS NULL OR email_opt_in = false);

-- Update contacts table defaults for future inserts
ALTER TABLE contacts 
  ALTER COLUMN email_opt_in SET DEFAULT true,
  ALTER COLUMN sms_opt_in SET DEFAULT true,
  ALTER COLUMN whatsapp_opt_in SET DEFAULT true;

-- Verify the update
SELECT 
  COUNT(*) as total_contacts,
  COUNT(*) FILTER (WHERE email_opt_in = true) as email_opted_in,
  COUNT(*) FILTER (WHERE sms_opt_in = true) as sms_opted_in,
  COUNT(*) FILTER (WHERE whatsapp_opt_in = true) as whatsapp_opted_in
FROM contacts;
