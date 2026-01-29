/**
 * Identify Missing Triggers
 */

const prodTriggers = [
  { trigger_name: "update_bank_accounts_updated_at", event_object_table: "bank_accounts" },
  { trigger_name: "update_communication_campaigns_updated_at", event_object_table: "communication_campaigns" },
  { trigger_name: "update_communication_messages_updated_at", event_object_table: "communication_messages" },
  { trigger_name: "update_contact_segments_updated_at", event_object_table: "contact_segments" },
  { trigger_name: "update_contacts_updated_at", event_object_table: "contacts" },
  { trigger_name: "trigger_update_conversation_on_message", event_object_table: "conversation_messages" },
  { trigger_name: "update_event_day_activities_updated_at", event_object_table: "event_day_activities" },
  { trigger_name: "update_event_days_updated_at", event_object_table: "event_days" },
  { trigger_name: "event_slug_trigger", event_object_table: "events" },
  { trigger_name: "trigger_update_organizer_event_count", event_object_table: "events" },
  { trigger_name: "trigger_update_organizer_event_count", event_object_table: "events" },
  { trigger_name: "trigger_update_organizer_event_count", event_object_table: "events" },
  { trigger_name: "update_events_updated_at", event_object_table: "events" },
  { trigger_name: "kyc_status_trigger", event_object_table: "kyc_verifications" },
  { trigger_name: "kyc_status_trigger", event_object_table: "kyc_verifications" },
  { trigger_name: "message_templates_updated_at", event_object_table: "message_templates" },
  { trigger_name: "update_orders_updated_at", event_object_table: "orders" },
  { trigger_name: "trigger_bank_cooling_period", event_object_table: "organizer_bank_accounts" },
  { trigger_name: "trigger_bank_cooling_period", event_object_table: "organizer_bank_accounts" },
  { trigger_name: "trigger_single_default_bank", event_object_table: "organizer_bank_accounts" },
  { trigger_name: "trigger_single_default_bank", event_object_table: "organizer_bank_accounts" },
  { trigger_name: "update_organizers_updated_at", event_object_table: "organizers" },
  { trigger_name: "update_payouts_updated_at", event_object_table: "payouts" },
  { trigger_name: "platform_settings_updated_at", event_object_table: "platform_settings" },
  { trigger_name: "protect_role_columns_trigger", event_object_table: "profiles" },
  { trigger_name: "sync_profile_email_to_organizer", event_object_table: "profiles" },
  { trigger_name: "update_profiles_updated_at", event_object_table: "profiles" },
  { trigger_name: "update_promo_codes_updated_at", event_object_table: "promo_codes" },
  { trigger_name: "update_refund_requests_updated_at", event_object_table: "refund_requests" },
  { trigger_name: "update_reviews_updated_at", event_object_table: "reviews" },
  { trigger_name: "set_ticket_number", event_object_table: "support_tickets" },
  { trigger_name: "update_support_tickets_timestamp", event_object_table: "support_tickets" },
  { trigger_name: "update_support_tickets_updated_at", event_object_table: "support_tickets" },
  { trigger_name: "update_ticket_types_updated_at", event_object_table: "ticket_types" },
  { trigger_name: "ticket_sale_trigger", event_object_table: "tickets" },
  { trigger_name: "ticket_sale_trigger", event_object_table: "tickets" },
  { trigger_name: "trigger_automation_ticket_purchase", event_object_table: "tickets" },
  { trigger_name: "trigger_automation_ticket_purchase", event_object_table: "tickets" },
  { trigger_name: "trigger_update_section_capacity", event_object_table: "venue_capacity" },
  { trigger_name: "trigger_update_section_capacity", event_object_table: "venue_capacity" }
];

const devTriggers = [
  { name: "update_bank_accounts_updated_at", table_name: "bank_accounts" },
  { name: "update_event_day_activities_updated_at", table_name: "event_day_activities" },
  { name: "update_event_days_updated_at", table_name: "event_days" },
  { name: "event_slug_trigger", table_name: "events" },
  { name: "trigger_update_organizer_event_count", table_name: "events" },
  { name: "trigger_update_organizer_event_count", table_name: "events" },
  { name: "trigger_update_organizer_event_count", table_name: "events" },
  { name: "update_events_updated_at", table_name: "events" },
  { name: "kyc_status_trigger", table_name: "kyc_verifications" },
  { name: "kyc_status_trigger", table_name: "kyc_verifications" },
  { name: "update_orders_updated_at", table_name: "orders" },
  { name: "trigger_bank_cooling_period", table_name: "organizer_bank_accounts" },
  { name: "trigger_bank_cooling_period", table_name: "organizer_bank_accounts" },
  { name: "trigger_single_default_bank", table_name: "organizer_bank_accounts" },
  { name: "trigger_single_default_bank", table_name: "organizer_bank_accounts" },
  { name: "update_organizers_updated_at", table_name: "organizers" },
  { name: "update_payouts_updated_at", table_name: "payouts" },
  { name: "protect_role_columns_trigger", table_name: "profiles" },
  { name: "sync_profile_email_to_organizer", table_name: "profiles" },
  { name: "update_profiles_updated_at", table_name: "profiles" },
  { name: "update_promo_codes_updated_at", table_name: "promo_codes" },
  { name: "update_refund_requests_updated_at", table_name: "refund_requests" },
  { name: "update_reviews_updated_at", table_name: "reviews" },
  { name: "set_ticket_number", table_name: "support_tickets" },
  { name: "update_support_tickets_timestamp", table_name: "support_tickets" },
  { name: "update_support_tickets_updated_at", table_name: "support_tickets" },
  { name: "update_ticket_types_updated_at", table_name: "ticket_types" },
  { name: "ticket_sale_trigger", table_name: "tickets" },
  { name: "ticket_sale_trigger", table_name: "tickets" }
];

// Create unique sets
const prodSet = new Set();
prodTriggers.forEach(t => {
  const key = `${t.event_object_table}.${t.trigger_name}`;
  prodSet.add(key);
});

const devSet = new Set();
devTriggers.forEach(t => {
  const key = `${t.table_name}.${t.name}`;
  devSet.add(key);
});

// Find missing
const missing = [];
prodTriggers.forEach(t => {
  const key = `${t.event_object_table}.${t.trigger_name}`;
  if (!devSet.has(key)) {
    // Check if we already added this (avoid duplicates)
    if (!missing.find(m => m.key === key)) {
      missing.push({ key, ...t });
    }
  }
});

console.log('\n📊 Trigger Comparison Results\n');
console.log('='.repeat(70));
console.log(`Production Triggers (unique): ${prodSet.size}`);
console.log(`Dev Triggers (unique): ${devSet.size}`);
console.log(`Missing in Dev: ${missing.length}\n`);

if (missing.length > 0) {
  console.log('❌ Missing Triggers in Dev:\n');
  missing.forEach(t => {
    console.log(`   - ${t.trigger_name} on ${t.event_object_table}`);
  });
  
  console.log('\n📝 SQL Query to Get Definitions:\n');
  console.log('Run this in PRODUCTION SQL Editor:\n');
  console.log('SELECT');
  console.log('    it.trigger_name,');
  console.log('    it.event_object_table,');
  console.log('    pg_get_triggerdef(t.oid) as definition');
  console.log('FROM information_schema.triggers it');
  console.log('JOIN pg_trigger t ON t.tgname = it.trigger_name');
  console.log('JOIN pg_class c ON c.oid = t.tgrelid');
  console.log('JOIN pg_namespace n ON n.oid = c.relnamespace');
  console.log('WHERE it.trigger_schema = \'public\'');
  console.log('    AND n.nspname = \'public\'');
  console.log('    AND NOT t.tgisinternal');
  console.log(`    AND (${missing.map((t, i) => `(it.trigger_name = '${t.trigger_name}' AND it.event_object_table = '${t.event_object_table}')`).join(' OR ')});`);
  console.log('\n');
} else {
  console.log('✅ All triggers match!\n');
}
