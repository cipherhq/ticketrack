/**
 * Compare Functions Between Production and Dev
 */

const devFunctions = [
  "accept_team_invitation", "add_bank_account", "add_communication_credits", "add_sms_credits",
  "become_affiliate", "calculate_refund_amount", "can_organizer_receive_payout", "check_email_whitelist",
  "cleanup_expired_otps", "cleanup_old_rate_limits", "create_telegram_link_request", "decrypt_account_number",
  "deduct_communication_credits", "deduct_sms_credits", "delete_user_account", "detect_suspicious_bank_change",
  "encrypt_account_number", "ensure_single_default_bank", "generate_event_slug", "generate_invite_code",
  "generate_order_number", "generate_payout_number", "generate_qr_hash", "generate_referral_code",
  "generate_slug", "generate_support_ticket_number", "generate_ticket_number", "get_event_stats",
  "get_next_waitlist_position", "get_organizer_stats", "handle_new_user", "has_reminder_been_sent",
  "increment_ad_clicks", "increment_ad_impressions", "increment_promo_usage", "increment_promoter_clicks",
  "increment_referral_count", "is_bank_in_cooling_period", "join_waitlist", "log_bank_account_change",
  "notify_next_waitlist", "protect_role_columns", "publish_scheduled_events", "record_ticket_sale",
  "register_push_subscription", "reinstate_affiliate", "release_tickets", "reserve_tickets",
  "set_bank_cooling_period", "set_event_slug", "suspend_affiliate", "sync_organizer_email",
  "transfer_ticket", "trigger_auto_payouts", "trigger_automation_on_ticket_purchase",
  "update_comm_hub_updated_at", "update_conversation_on_message", "update_message_templates_updated_at",
  "update_organizer_event_count", "update_organizer_kyc_status", "update_platform_settings_updated_at",
  "update_promoter_sales", "update_section_capacity_from_iot", "update_support_ticket_timestamp",
  "update_updated_at_column", "validate_invite_code"
];

console.log('\n📊 Dev Functions Analysis\n');
console.log('='.repeat(70));
console.log(`Total Functions in Dev: ${devFunctions.length}`);
console.log(`Expected in Production: 103`);
console.log(`Missing: ~${103 - devFunctions.length} functions\n`);

console.log('💡 Next Steps:');
console.log('1. Run this query in PRODUCTION SQL Editor:');
console.log('   SELECT routine_name FROM information_schema.routines');
console.log('   WHERE routine_schema = \'public\' ORDER BY routine_name;');
console.log('\n2. Share the production function list');
console.log('3. I\'ll identify missing functions and create migration script\n');
