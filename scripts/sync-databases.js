/**
 * Sync Dev Database with Production
 * 
 * This script helps identify and sync missing database objects
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
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

// Dev database
const DEV_URL = envVars.VITE_SUPABASE_URL || 'https://bnkxgyzvqpdctghrgmkr.supabase.co';
const DEV_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!DEV_KEY) {
  console.error('❌ DEV_SERVICE_ROLE_KEY not found');
  process.exit(1);
}

const devClient = createClient(DEV_URL, DEV_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function getDevObjects() {
  console.log('\n📊 Fetching Dev database objects...\n');

  // Get functions
  const { data: devFunctions, error: funcError } = await devClient
    .from('information_schema.routines')
    .select('routine_name')
    .eq('routine_schema', 'public')
    .order('routine_name');

  // Get views
  const { data: devViews, error: viewError } = await devClient
    .from('information_schema.views')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');

  // Get triggers
  const { data: devTriggers, error: triggerError } = await devClient
    .from('information_schema.triggers')
    .select('trigger_name, event_object_table')
    .eq('trigger_schema', 'public')
    .order('event_object_table, trigger_name');

  return {
    functions: (devFunctions || []).map(f => f.routine_name),
    views: (devViews || []).map(v => v.table_name),
    triggers: (devTriggers || []).map(t => `${t.event_object_table}.${t.trigger_name}`)
  };
}

async function generateSyncScript() {
  console.log('🔍 Database Sync Analysis\n');
  console.log('='.repeat(70));

  const devObjects = await getDevObjects();

  console.log('\n📋 Dev Database Objects:');
  console.log(`   Functions: ${devObjects.functions.length}`);
  console.log(`   Views: ${devObjects.views.length}`);
  console.log(`   Triggers: ${devObjects.triggers.length}`);

  // Create SQL queries for user to run in production
  const sqlQueries = `
-- ============================================================================
-- RUN THESE QUERIES IN PRODUCTION SQL EDITOR
-- ============================================================================

-- 1. Get all function names
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' ORDER BY routine_name;

-- 2. Get all view names
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' ORDER BY table_name;

-- 3. Get all trigger names
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- After getting production lists, compare with Dev:
-- ============================================================================
-- Dev Functions (${devObjects.functions.length}):
${devObjects.functions.map(f => `--   - ${f}`).join('\n')}

-- Dev Views (${devObjects.views.length}):
${devObjects.views.map(v => `--   - ${v}`).join('\n') || '--   (none)'}

-- Dev Triggers (${devTriggers.length}):
${devObjects.triggers.map(t => `--   - ${t}`).join('\n')}
`;

  // Save to file
  const outputPath = join(__dirname, '../database/SYNC_INSTRUCTIONS.md');
  writeFileSync(outputPath, sqlQueries);

  console.log('\n✅ Generated sync instructions:');
  console.log(`   ${outputPath}`);
  console.log('\n💡 Next Steps:');
  console.log('   1. Run the SQL queries in Production SQL Editor');
  console.log('   2. Compare the lists with Dev');
  console.log('   3. Share the production lists with me to create migration script');
  console.log('\n');
}

generateSyncScript().catch(console.error);
