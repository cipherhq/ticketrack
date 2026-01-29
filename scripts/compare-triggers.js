/**
 * Compare Triggers and Generate Migration
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

// Create unique set (remove duplicates)
const uniqueProdTriggers = new Map();
prodTriggers.forEach(t => {
  const key = `${t.event_object_table}.${t.trigger_name}`;
  if (!uniqueProdTriggers.has(key)) {
    uniqueProdTriggers.set(key, t);
  }
});

console.log('\n📊 Production Triggers Analysis\n');
console.log('='.repeat(70));
console.log(`Total triggers (with duplicates): ${prodTriggers.length}`);
console.log(`Unique triggers: ${uniqueProdTriggers.size}`);
console.log('\nUnique Triggers by Table:\n');

const byTable = {};
uniqueProdTriggers.forEach((trigger, key) => {
  const table = trigger.event_object_table;
  if (!byTable[table]) byTable[table] = [];
  byTable[table].push(trigger.trigger_name);
});

Object.keys(byTable).sort().forEach(table => {
  console.log(`  ${table}:`);
  byTable[table].forEach(trigger => {
    console.log(`    - ${trigger}`);
  });
});

console.log('\n💡 Next Steps:');
console.log('1. Run this query in DEV SQL Editor to get dev triggers:');
console.log('   SELECT trigger_name, event_object_table FROM information_schema.triggers');
console.log('   WHERE trigger_schema = \'public\' ORDER BY event_object_table, trigger_name;');
console.log('\n2. Then run this in PRODUCTION to get full trigger definitions:');
console.log('   SELECT trigger_name, event_object_table, pg_get_triggerdef(t.oid) as definition');
console.log('   FROM information_schema.triggers it');
console.log('   JOIN pg_trigger t ON t.tgname = it.trigger_name');
console.log('   JOIN pg_class c ON c.oid = t.tgrelid');
console.log('   JOIN pg_namespace n ON n.oid = c.relnamespace');
console.log('   WHERE it.trigger_schema = \'public\' AND n.nspname = \'public\'');
console.log('   AND NOT t.tgisinternal');
console.log('   ORDER BY it.event_object_table, it.trigger_name;');
console.log('\n');
