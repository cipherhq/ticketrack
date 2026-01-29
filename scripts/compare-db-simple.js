/**
 * Simple Database Comparison
 * 
 * Compares production and dev databases by checking for common tables
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../.env.local');
const envFile = readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

// Known tables from master_migration.sql
const EXPECTED_TABLES = [
  'profiles',
  'organizers',
  'events',
  'ticket_types',
  'tickets',
  'orders',
  'order_items',
  'contacts',
  'communication_campaigns',
  'communication_logs',
  'communication_credits',
  'automation_jobs',
  'automation_templates',
  'drip_campaigns',
  'drip_campaign_steps',
  'external_import_platforms',
  'external_import_jobs',
  'external_import_mappings',
  'external_imported_events',
  'external_imported_attendees',
  'payouts',
  'payout_transactions',
  'refunds',
  'split_payments',
  'split_payment_shares',
  'wallet_passes',
  'event_analytics',
  'ticket_analytics',
  'organizer_analytics',
  'custom_forms',
  'custom_form_responses',
  'event_access_logs',
  'ticket_transfers',
  'event_reminders',
  'event_favorites',
  'event_reviews',
  'event_tags',
  'event_tag_assignments',
  'organizer_subscriptions',
  'organizer_settings',
  'notification_preferences',
  'email_templates',
  'sms_templates',
  'whatsapp_templates',
  'telegram_templates',
  'push_notification_templates',
  'webhook_endpoints',
  'webhook_logs',
  'api_keys',
  'api_key_usage',
  'audit_logs',
  'system_settings',
  'feature_flags',
  'a_b_tests',
  'a_b_test_variants',
  'a_b_test_results',
];

// Production
const PROD_URL = 'https://bkvbvggngttrizbchygy.supabase.co';
// Note: You'll need to add PROD_SERVICE_ROLE_KEY to .env.local
const PROD_KEY = process.env.PROD_SERVICE_ROLE_KEY || envVars.PROD_SERVICE_ROLE_KEY;

// Dev
const DEV_URL = envVars.VITE_SUPABASE_URL || 'https://bnkxgyzvqpdctghrgmkr.supabase.co';
const DEV_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!DEV_KEY) {
  console.error('❌ DEV_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const prodClient = PROD_KEY ? createClient(PROD_URL, PROD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
}) : null;

const devClient = createClient(DEV_URL, DEV_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkTable(client, tableName, dbName) {
  try {
    const { data, error } = await client
      .from(tableName)
      .select('*')
      .limit(0);
    
    if (error && error.code === 'PGRST116') {
      return { exists: false, error: 'Table not found' };
    }
    if (error) {
      return { exists: false, error: error.message };
    }
    return { exists: true };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

async function compareTables() {
  console.log('\n🔍 Comparing Database Tables\n');
  console.log('='.repeat(70));

  const results = {
    prod: {},
    dev: {},
    missing: [],
    extra: []
  };

  // Check dev tables
  console.log('\n📊 Checking Dev Database...');
  for (const table of EXPECTED_TABLES) {
    const result = await checkTable(devClient, table, 'Dev');
    results.dev[table] = result.exists;
    if (result.exists) {
      process.stdout.write('.');
    } else {
      process.stdout.write('❌');
    }
  }

  // Check prod tables (if key available)
  if (prodClient) {
    console.log('\n\n📊 Checking Production Database...');
    for (const table of EXPECTED_TABLES) {
      const result = await checkTable(prodClient, table, 'Production');
      results.prod[table] = result.exists;
      if (result.exists) {
        process.stdout.write('.');
      } else {
        process.stdout.write('❌');
      }
    }
  } else {
    console.log('\n⚠️  Production key not found - skipping production check');
    console.log('   Add PROD_SERVICE_ROLE_KEY to .env.local to compare');
  }

  // Find differences
  if (prodClient) {
    for (const table of EXPECTED_TABLES) {
      if (results.prod[table] && !results.dev[table]) {
        results.missing.push(table);
      }
      if (!results.prod[table] && results.dev[table]) {
        results.extra.push(table);
      }
    }
  }

  // Report
  console.log('\n\n' + '='.repeat(70));
  console.log('📋 RESULTS');
  console.log('='.repeat(70));

  const devCount = Object.values(results.dev).filter(v => v).length;
  console.log(`\n✅ Dev Database: ${devCount}/${EXPECTED_TABLES.length} tables found`);

  if (prodClient) {
    const prodCount = Object.values(results.prod).filter(v => v).length;
    console.log(`✅ Production: ${prodCount}/${EXPECTED_TABLES.length} tables found`);
  }

  if (results.missing.length > 0) {
    console.log(`\n❌ Missing in Dev (${results.missing.length}):`);
    results.missing.forEach(t => console.log(`   - ${t}`));
  }

  if (results.extra.length > 0) {
    console.log(`\n⚠️  Extra in Dev (${results.extra.length}):`);
    results.extra.forEach(t => console.log(`   - ${t}`));
  }

  if (results.missing.length === 0 && results.extra.length === 0 && prodClient) {
    console.log('\n✅ All tables match!');
  }

  // Detailed table status
  console.log('\n📊 Detailed Status:\n');
  EXPECTED_TABLES.forEach(table => {
    const devStatus = results.dev[table] ? '✅' : '❌';
    const prodStatus = prodClient ? (results.prod[table] ? '✅' : '❌') : '?';
    console.log(`   ${devStatus} ${prodStatus} ${table}`);
  });

  console.log('\n');
}

compareTables().catch(console.error);
