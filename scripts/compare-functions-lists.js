/**
 * Compare Production and Dev Function Lists
 */

const prodFunctions = [
  "accept_team_invitation", "add_bank_account", "add_communication_credits", "add_sms_credits",
  "advance_drip_enrollment", "become_affiliate", "calculate_contact_engagement", "calculate_contact_rfm",
  "calculate_layout_capacity", "calculate_organizer_scores", "calculate_refund_amount",
  "can_organizer_receive_payout", "check_email_whitelist", "check_fast_payout_eligibility",
  "cleanup_expired_otps", "cleanup_expired_sessions", "cleanup_old_rate_limits",
  "complete_group_member", "create_default_smart_segments", "create_fast_payout_request",
  "create_group_session", "create_section_capacity_for_event", "create_split_payment",
  "create_telegram_link_request", "decrypt_account_number", "deduct_communication_credits",
  "deduct_sms_credits", "delete_user_account", "detect_suspicious_bank_change",
  "encrypt_account_number", "enroll_in_drip_campaign", "ensure_single_default_bank",
  "expire_group_sessions", "expire_split_payments", "find_or_create_conversation",
  "generate_event_slug", "generate_group_code", "generate_invite_code",
  "generate_order_number", "generate_payout_number", "generate_qr_hash",
  "generate_referral_code", "generate_slug", "generate_support_ticket_number",
  "generate_ticket_number", "get_event_stats", "get_inferred_preferences",
  "get_next_waitlist_position", "get_organizer_stats", "get_pending_drip_steps",
  "get_personalized_recommendations", "get_share_by_token", "get_split_payment",
  "handle_new_user", "has_reminder_been_sent", "increment_ad_clicks",
  "increment_ad_impressions", "increment_promo_usage", "increment_promoter_clicks",
  "increment_referral_count", "is_bank_in_cooling_period", "join_group_session",
  "join_waitlist", "log_bank_account_change", "log_security_event",
  "mark_conversation_read", "mark_reminder_sent", "notify_next_waitlist",
  "protect_role_columns", "publish_scheduled_events", "record_email_tracking_event",
  "record_event_interaction", "record_share_payment", "record_ticket_sale",
  "register_push_subscription", "reinstate_affiliate", "release_tickets",
  "reserve_tickets", "schedule_event_reminders", "set_bank_cooling_period",
  "set_event_slug", "suspend_affiliate", "sync_organizer_email",
  "toggle_saved_event", "transfer_ticket", "trigger_auto_payouts",
  "trigger_automation_on_ticket_purchase", "update_campaign_analytics",
  "update_comm_hub_updated_at", "update_conversation_on_message", "update_member_selection",
  "update_message_templates_updated_at", "update_organizer_event_count",
  "update_organizer_kyc_status", "update_paystack_payout_status",
  "update_platform_settings_updated_at", "update_promoter_sales",
  "update_section_capacity_from_iot", "update_smart_segment_counts",
  "update_support_ticket_timestamp"
];

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

const prodSet = new Set(prodFunctions);
const devSet = new Set(devFunctions);

const missing = prodFunctions.filter(f => !devSet.has(f));
const extra = devFunctions.filter(f => !prodSet.has(f));

console.log('\n📊 Function Comparison Results\n');
console.log('='.repeat(70));
console.log(`Production Functions: ${prodFunctions.length}`);
console.log(`Dev Functions: ${devFunctions.length}`);
console.log(`Missing in Dev: ${missing.length}`);
if (extra.length > 0) {
  console.log(`Extra in Dev: ${extra.length}`);
}

if (missing.length > 0) {
  console.log('\n❌ Missing Functions in Dev:\n');
  missing.forEach((f, i) => {
    console.log(`   ${(i + 1).toString().padStart(2, ' ')}. ${f}`);
  });
  
  console.log('\n📝 SQL Query to Get Definitions:\n');
  console.log('Run this in PRODUCTION SQL Editor:\n');
  console.log('SELECT');
  console.log('    routine_name,');
  console.log('    pg_get_functiondef(p.oid) as definition');
  console.log('FROM information_schema.routines r');
  console.log('JOIN pg_proc p ON p.proname = r.routine_name');
  console.log('JOIN pg_namespace n ON n.oid = p.pronamespace');
  console.log('WHERE r.routine_schema = \'public\'');
  console.log('    AND n.nspname = \'public\'');
  console.log(`    AND r.routine_name IN (${missing.map(f => `'${f}'`).join(', ')});`);
  console.log('\n');
} else {
  console.log('\n✅ All functions match!\n');
}

if (extra.length > 0) {
  console.log('\n⚠️  Extra Functions in Dev (not in production):\n');
  extra.forEach(f => console.log(`   - ${f}`));
}
