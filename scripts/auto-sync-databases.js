/**
 * Auto-Sync Dev Database with Production
 * 
 * Compares both databases and generates migration script for missing items
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

// Production
const PROD_URL = 'https://bkvbvggngttrizbchygy.supabase.co';
const PROD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI';

// Dev
const DEV_URL = envVars.VITE_SUPABASE_URL || 'https://bnkxgyzvqpdctghrgmkr.supabase.co';
const DEV_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;

const prodClient = createClient(PROD_URL, PROD_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const devClient = createClient(DEV_URL, DEV_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function querySQL(client, query) {
  try {
    // Try using RPC if available
    const { data, error } = await client.rpc('exec_sql', { query });
    if (!error && data) return { data, error: null };
    
    // Fallback: try direct query on information_schema
    return { data: null, error: 'Direct SQL not available via API' };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

async function getFunctions(client, dbName) {
  console.log(`   Fetching functions from ${dbName}...`);
  try {
    // Try direct query
    const { data, error } = await client
      .from('information_schema.routines')
      .select('routine_name, routine_type, data_type, routine_definition')
      .eq('routine_schema', 'public')
      .order('routine_name');
    
    if (error) {
      console.warn(`   Warning: Could not fetch functions from ${dbName}:`, error.message);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.warn(`   Warning: Error fetching functions from ${dbName}:`, e.message);
    return [];
  }
}

async function getViews(client, dbName) {
  console.log(`   Fetching views from ${dbName}...`);
  try {
    const { data, error } = await client
      .from('information_schema.views')
      .select('table_name, view_definition')
      .eq('table_schema', 'public')
      .order('table_name');
    
    if (error) {
      console.warn(`   Warning: Could not fetch views from ${dbName}:`, error.message);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.warn(`   Warning: Error fetching views from ${dbName}:`, e.message);
    return [];
  }
}

async function getTriggers(client, dbName) {
  console.log(`   Fetching triggers from ${dbName}...`);
  try {
    const { data, error } = await client
      .from('information_schema.triggers')
      .select('trigger_name, event_object_table, action_timing, event_manipulation, action_statement')
      .eq('trigger_schema', 'public')
      .order('event_object_table, trigger_name');
    
    if (error) {
      console.warn(`   Warning: Could not fetch triggers from ${dbName}:`, error.message);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.warn(`   Warning: Error fetching triggers from ${dbName}:`, e.message);
    return [];
  }
}

async function syncDatabases() {
  console.log('\n🔍 Auto-Syncing Dev Database with Production\n');
  console.log('='.repeat(70));

  // Get all objects from both databases
  console.log('\n📊 Fetching database objects...\n');
  
  const [prodFunctions, devFunctions] = await Promise.all([
    getFunctions(prodClient, 'Production'),
    getFunctions(devClient, 'Dev')
  ]);

  const [prodViews, devViews] = await Promise.all([
    getViews(prodClient, 'Production'),
    getViews(devClient, 'Dev')
  ]);

  const [prodTriggers, devTriggers] = await Promise.all([
    getTriggers(prodClient, 'Production'),
    getTriggers(devClient, 'Dev')
  ]);

  // Create maps for comparison
  const prodFuncMap = new Map(prodFunctions.map(f => [f.routine_name, f]));
  const devFuncMap = new Map(devFunctions.map(f => [f.routine_name, f]));
  
  const prodViewMap = new Map(prodViews.map(v => [v.table_name, v]));
  const devViewMap = new Map(devViews.map(v => [v.table_name, v]));
  
  const prodTriggerMap = new Map(prodTriggers.map(t => [`${t.event_object_table}.${t.trigger_name}`, t]));
  const devTriggerMap = new Map(devTriggers.map(t => [`${t.event_object_table}.${t.trigger_name}`, t]));

  // Find missing items
  const missingFunctions = [];
  const missingViews = [];
  const missingTriggers = [];

  for (const [name, func] of prodFuncMap.entries()) {
    if (!devFuncMap.has(name)) {
      missingFunctions.push(func);
    }
  }

  for (const [name, view] of prodViewMap.entries()) {
    if (!devViewMap.has(name)) {
      missingViews.push(view);
    }
  }

  for (const [key, trigger] of prodTriggerMap.entries()) {
    if (!devTriggerMap.has(key)) {
      missingTriggers.push(trigger);
    }
  }

  // Report results
  console.log('\n' + '='.repeat(70));
  console.log('📋 COMPARISON RESULTS');
  console.log('='.repeat(70));
  
  console.log(`\n🔧 Functions:`);
  console.log(`   Production: ${prodFunctions.length}`);
  console.log(`   Dev: ${devFunctions.length}`);
  console.log(`   Missing in Dev: ${missingFunctions.length}`);

  console.log(`\n👁️  Views:`);
  console.log(`   Production: ${prodViews.length}`);
  console.log(`   Dev: ${devViews.length}`);
  console.log(`   Missing in Dev: ${missingViews.length}`);

  console.log(`\n⚡ Triggers:`);
  console.log(`   Production: ${prodTriggers.length}`);
  console.log(`   Dev: ${devTriggers.length}`);
  console.log(`   Missing in Dev: ${missingTriggers.length}`);

  // Generate migration script
  if (missingFunctions.length > 0 || missingViews.length > 0 || missingTriggers.length > 0) {
    console.log('\n📝 Generating migration script...');
    
    let migrationSQL = `-- ============================================================================
-- SYNC MIGRATION: Add Missing Database Objects to Dev
-- ============================================================================
-- Generated: ${new Date().toISOString()}
-- 
-- This script adds missing functions, views, and triggers from production
-- Run this in Dev Supabase SQL Editor
-- ============================================================================

BEGIN;

`;

    // Add missing functions
    if (missingFunctions.length > 0) {
      migrationSQL += `-- ============================================================================
-- MISSING FUNCTIONS (${missingFunctions.length})
-- ============================================================================

`;
      missingFunctions.forEach(func => {
        migrationSQL += `-- Function: ${func.routine_name}\n`;
        if (func.routine_definition) {
          // Note: We can't get full CREATE FUNCTION statement via API
          // User needs to get it from production directly
          migrationSQL += `-- TODO: Get full CREATE FUNCTION statement for: ${func.routine_name}\n`;
          migrationSQL += `-- Type: ${func.routine_type}, Returns: ${func.data_type || 'void'}\n\n`;
        }
      });
    }

    // Add missing views
    if (missingViews.length > 0) {
      migrationSQL += `-- ============================================================================
-- MISSING VIEWS (${missingViews.length})
-- ============================================================================

`;
      missingViews.forEach(view => {
        migrationSQL += `-- View: ${view.table_name}\n`;
        if (view.view_definition) {
          migrationSQL += `CREATE OR REPLACE VIEW public.${view.table_name} AS\n`;
          migrationSQL += `${view.view_definition};\n\n`;
        }
      });
    }

    // Add missing triggers
    if (missingTriggers.length > 0) {
      migrationSQL += `-- ============================================================================
-- MISSING TRIGGERS (${missingTriggers.length})
-- ============================================================================

`;
      missingTriggers.forEach(trigger => {
        migrationSQL += `-- Trigger: ${trigger.trigger_name} on ${trigger.event_object_table}\n`;
        if (trigger.action_statement) {
          // Note: We need the full CREATE TRIGGER statement
          migrationSQL += `-- TODO: Get full CREATE TRIGGER statement\n`;
          migrationSQL += `-- Timing: ${trigger.action_timing}, Event: ${trigger.event_manipulation}\n`;
          migrationSQL += `-- Action: ${trigger.action_statement.substring(0, 100)}...\n\n`;
        }
      });
    }

    migrationSQL += `COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running, verify with:
-- SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;
-- SELECT table_name FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY event_object_table, trigger_name;
-- ============================================================================
`;

    // Save migration script
    const migrationPath = join(__dirname, '../database/sync_missing_objects.sql');
    writeFileSync(migrationPath, migrationSQL);

    console.log(`\n✅ Migration script saved: ${migrationPath}`);
    
    // Create detailed report
    let report = `# Database Sync Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `## Summary\n\n`;
    report += `- Missing Functions: ${missingFunctions.length}\n`;
    report += `- Missing Views: ${missingViews.length}\n`;
    report += `- Missing Triggers: ${missingTriggers.length}\n\n`;
    
    if (missingFunctions.length > 0) {
      report += `## Missing Functions\n\n`;
      missingFunctions.forEach(f => {
        report += `- ${f.routine_name} (${f.routine_type}, returns ${f.data_type || 'void'})\n`;
      });
      report += `\n`;
    }
    
    if (missingViews.length > 0) {
      report += `## Missing Views\n\n`;
      missingViews.forEach(v => {
        report += `- ${v.table_name}\n`;
      });
      report += `\n`;
    }
    
    if (missingTriggers.length > 0) {
      report += `## Missing Triggers\n\n`;
      missingTriggers.forEach(t => {
        report += `- ${t.trigger_name} on ${t.event_object_table} (${t.action_timing} ${t.event_manipulation})\n`;
      });
    }
    
    const reportPath = join(__dirname, '../database/SYNC_REPORT.md');
    writeFileSync(reportPath, report);
    
    console.log(`✅ Detailed report saved: ${reportPath}`);
    
    console.log('\n⚠️  NOTE:');
    console.log('   Functions and Triggers require full CREATE statements from production.');
    console.log('   Views have been included in the migration script.');
    console.log('   Run the queries in SYNC_DEV_WITH_PROD.md to get full function/trigger definitions.');
  } else {
    console.log('\n✅ No missing objects found! Databases are in sync.');
  }

  console.log('\n');
}

syncDatabases().catch(console.error);
