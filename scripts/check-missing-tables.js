/**
 * Check Missing Tables in Dev
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env.local');
const envFile = readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const client = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const prodTables = [
  'admin_actions', 'admin_audit_logs', 'admin_broadcasts', 'admin_impersonation_log', 'admin_logs',
  'advance_payments', 'advertisements', 'affiliate_settings', 'audit_logs', 'bank_account_changes',
  'bank_accounts', 'campaign_recipients', 'categories', 'checkin_devices', 'checkin_logs',
  'communication_automation_runs', 'communication_automations', 'communication_campaigns',
  'communication_channel_pricing', 'communication_credit_balances', 'communication_credit_packages',
  'communication_credit_transactions', 'communication_logs', 'communication_messages',
  'communication_scheduled_jobs', 'communication_templates', 'contact_scores', 'contact_segments',
  'contacts', 'conversation_messages', 'conversations', 'countries', 'country_features', 'currencies',
  'custom_field_responses', 'drip_campaign_steps', 'drip_campaigns', 'email_audit', 'email_campaigns',
  'email_rate_limits', 'email_send_limits', 'email_templates', 'email_tracked_links',
  'email_tracking_events', 'event_custom_fields', 'event_day_activities', 'event_days',
  'event_earnings', 'event_email_whitelist', 'event_history', 'event_images', 'event_invite_codes',
  'event_sponsors', 'event_tasks', 'events', 'features', 'finance_audit_log', 'finance_users',
  'followers', 'invite_code_usage', 'kyc_documents', 'kyc_verifications', 'legal_documents',
  'login_attempts', 'notification_preferences', 'order_items', 'orders', 'organizer_bank_accounts',
  'organizer_follows', 'organizer_sms_wallet', 'organizer_team_members', 'organizer_whatsapp_config',
  'organizer_whatsapp_wallet', 'organizers', 'payment_gateway_config', 'payout_events', 'payouts',
  'phone_otps', 'platform_adverts', 'platform_branding', 'platform_limits', 'platform_settings',
  'platform_sms_config', 'platform_whatsapp_config', 'profiles', 'promo_codes', 'promoter_bank_accounts',
  'promoter_clicks', 'promoter_events', 'promoter_payouts', 'promoter_sales', 'promoters',
  'push_notification_log', 'push_subscriptions', 'referral_earnings', 'referral_payouts',
  'refund_requests', 'reviews', 'saved_events', 'saved_payment_methods'
];

console.log(`\n🔍 Checking ${prodTables.length} tables in Dev database...\n`);

const results = { exists: [], missing: [] };

for (const table of prodTables) {
  try {
    const { error } = await client.from(table).select('*').limit(0);
    if (error && error.code === 'PGRST116') {
      results.missing.push(table);
      process.stdout.write('❌');
    } else {
      results.exists.push(table);
      process.stdout.write('.');
    }
  } catch (e) {
    results.missing.push(table);
    process.stdout.write('❌');
  }
}

console.log('\n\n' + '='.repeat(60));
console.log('📊 RESULTS');
console.log('='.repeat(60));
console.log(`✅ Exists in Dev: ${results.exists.length}/${prodTables.length}`);
console.log(`❌ Missing in Dev: ${results.missing.length}/${prodTables.length}`);

if (results.missing.length > 0) {
  console.log('\n❌ Missing Tables:');
  results.missing.forEach(t => console.log(`   - ${t}`));
} else {
  console.log('\n✅ All tables exist!');
}

console.log('\n');
