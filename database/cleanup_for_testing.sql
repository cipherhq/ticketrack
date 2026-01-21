-- ============================================
-- CLEANUP SCRIPT FOR FINAL TESTING
-- Keep organizer: bajideace@gmail.com
-- Delete: All events, all other organizers
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- DELETE IN ORDER (respecting ALL foreign keys)
-- ============================================

-- 1. Delete SMS and WhatsApp usage
DELETE FROM sms_credit_usage WHERE true;
DELETE FROM whatsapp_credit_usage WHERE true;
DELETE FROM sms_campaigns WHERE true;
DELETE FROM whatsapp_broadcasts WHERE true;

-- 2. Delete email campaigns
DELETE FROM email_campaigns WHERE true;
DELETE FROM email_campaign_recipients WHERE true;

-- 3. Delete waitlist data
DELETE FROM waitlist_entries WHERE true;
DELETE FROM waitlist_notifications WHERE true;

-- 4. Delete check-in data
DELETE FROM check_in_sessions WHERE true;

-- 5. Delete all tickets
DELETE FROM tickets WHERE true;

-- 6. Delete all orders  
DELETE FROM orders WHERE true;

-- 7. Delete all ticket types
DELETE FROM ticket_types WHERE true;

-- 8. Delete group buy data
DELETE FROM group_buy_messages WHERE true;
DELETE FROM group_buy_members WHERE true;
DELETE FROM group_buy_invitations WHERE true;
DELETE FROM group_buy_sessions WHERE true;
DELETE FROM event_group_buy_settings WHERE true;

-- 9. Delete event access settings
DELETE FROM event_access_settings WHERE true;

-- 10. Delete custom form fields/responses
DELETE FROM custom_form_responses WHERE true;
DELETE FROM custom_form_fields WHERE true;

-- 11. Delete all events
DELETE FROM events WHERE true;

-- 12. Delete promo codes
DELETE FROM promo_codes WHERE true;

-- 13. Delete promoter data
DELETE FROM promoter_sales WHERE true;
DELETE FROM promoters WHERE true;

-- 14. Delete refund requests
DELETE FROM refund_requests WHERE true;

-- 15. Delete ticket transfers
DELETE FROM ticket_transfers WHERE true;

-- 16. Delete followers
DELETE FROM followers WHERE true;

-- 17. Delete venue data
DELETE FROM layout_furniture WHERE true;
DELETE FROM layout_sections WHERE true;
DELETE FROM venue_layouts WHERE true;
DELETE FROM venues WHERE true;

-- 18. Delete event place layouts
DELETE FROM event_floor_plans WHERE true;

-- 19. Delete support tickets
DELETE FROM support_tickets WHERE true;

-- 20. Delete team members for other organizers
DELETE FROM team_members 
WHERE organizer_id NOT IN (
  SELECT o.id FROM organizers o
  JOIN auth.users u ON o.user_id = u.id
  WHERE u.email = 'bajideace@gmail.com'
);

-- 21. Delete payout records for other organizers
DELETE FROM payouts 
WHERE organizer_id NOT IN (
  SELECT o.id FROM organizers o
  JOIN auth.users u ON o.user_id = u.id
  WHERE u.email = 'bajideace@gmail.com'
);

-- 22. Delete SMS/WhatsApp credits for other organizers
DELETE FROM sms_credits 
WHERE organizer_id NOT IN (
  SELECT o.id FROM organizers o
  JOIN auth.users u ON o.user_id = u.id
  WHERE u.email = 'bajideace@gmail.com'
);

DELETE FROM whatsapp_credits 
WHERE organizer_id NOT IN (
  SELECT o.id FROM organizers o
  JOIN auth.users u ON o.user_id = u.id
  WHERE u.email = 'bajideace@gmail.com'
);

-- 23. Delete all organizers EXCEPT bajideace@gmail.com
DELETE FROM organizers 
WHERE user_id NOT IN (
  SELECT id FROM auth.users WHERE email = 'bajideace@gmail.com'
);

-- ============================================
-- VERIFY CLEANUP
-- ============================================
SELECT 'Events' as table_name, COUNT(*) as count FROM events
UNION ALL
SELECT 'Organizers', COUNT(*) FROM organizers
UNION ALL
SELECT 'Tickets', COUNT(*) FROM tickets
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Ticket Types', COUNT(*) FROM ticket_types;

-- Show remaining organizer
SELECT o.id, o.name, o.email, u.email as user_email
FROM organizers o
JOIN auth.users u ON o.user_id = u.id;
