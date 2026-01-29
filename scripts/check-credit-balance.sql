-- Check your communication credit balance
-- Replace 'YOUR_ORGANIZER_ID' with your actual organizer ID, or use your email to find it

-- Option 1: Find your organizer ID by email
SELECT 
  o.id as organizer_id,
  o.business_name,
  u.email
FROM organizers o
JOIN auth.users u ON o.user_id = u.id
WHERE u.email = 'bajideace@gmail.com'; -- Replace with your email

-- Option 2: Check credit balance (replace ORGANIZER_ID with your organizer ID from above)
SELECT 
  balance,
  bonus_balance,
  (balance + bonus_balance) as total_balance,
  lifetime_purchased,
  lifetime_used,
  email_credits_used,
  sms_credits_used,
  whatsapp_credits_used,
  telegram_credits_used,
  updated_at
FROM communication_credit_balances
WHERE organizer_id = 'YOUR_ORGANIZER_ID'; -- Replace with your organizer ID

-- Option 3: Combined query to get everything at once
SELECT 
  o.id as organizer_id,
  o.business_name,
  u.email,
  COALESCE(ccb.balance, 0) as balance,
  COALESCE(ccb.bonus_balance, 0) as bonus_balance,
  COALESCE(ccb.balance, 0) + COALESCE(ccb.bonus_balance, 0) as total_balance,
  COALESCE(ccb.lifetime_purchased, 0) as lifetime_purchased,
  COALESCE(ccb.lifetime_used, 0) as lifetime_used,
  COALESCE(ccb.email_credits_used, 0) as email_credits_used,
  COALESCE(ccb.sms_credits_used, 0) as sms_credits_used,
  COALESCE(ccb.whatsapp_credits_used, 0) as whatsapp_credits_used,
  COALESCE(ccb.telegram_credits_used, 0) as telegram_credits_used
FROM organizers o
JOIN auth.users u ON o.user_id = u.id
LEFT JOIN communication_credit_balances ccb ON ccb.organizer_id = o.id
WHERE u.email = 'bajideace@gmail.com'; -- Replace with your email
