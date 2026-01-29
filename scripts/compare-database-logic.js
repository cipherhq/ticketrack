/**
 * Compare Database Logic (Functions, Triggers, Views, Cron Jobs, Policies)
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

// Production (if key available)
const PROD_URL = 'https://bkvbvggngttrizbchygy.supabase.co';
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

async function querySQL(client, query, dbName) {
  try {
    // Try using RPC if available
    const { data, error } = await client.rpc('exec_sql', { query });
    if (!error) return { data, error: null };
    
    // Fallback: return error
    return { data: null, error };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

async function getFunctions(client, dbName) {
  const query = `
    SELECT 
      routine_name,
      routine_type,
      data_type as return_type
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    ORDER BY routine_name;
  `;
  
  const { data, error } = await querySQL(client, query, dbName);
  
  if (error) {
    // Try direct query
    const { data: altData, error: altError } = await client
      .from('information_schema.routines')
      .select('routine_name, routine_type, data_type')
      .eq('routine_schema', 'public')
      .order('routine_name');
    
    return altError ? [] : (altData || []);
  }
  
  return data || [];
}

async function getViews(client, dbName) {
  const query = `
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;
  
  const { data, error } = await querySQL(client, query, dbName);
  
  if (error) {
    const { data: altData, error: altError } = await client
      .from('information_schema.views')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');
    
    return altError ? [] : (altData || []);
  }
  
  return data || [];
}

async function getTriggers(client, dbName) {
  const query = `
    SELECT 
      trigger_name,
      event_object_table,
      action_timing,
      event_manipulation
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table, trigger_name;
  `;
  
  const { data, error } = querySQL(client, query, dbName);
  
  if (error) {
    return [];
  }
  
  return data || [];
}

async function getCronJobs(client, dbName) {
  // Check if pg_cron extension exists
  const checkExtQuery = `
    SELECT EXISTS(
      SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) as exists;
  `;
  
  const { data: extData } = await querySQL(client, checkExtQuery, dbName);
  
  if (!extData || !extData[0]?.exists) {
    return { extensionExists: false, jobs: [] };
  }
  
  // Get cron jobs
  const jobsQuery = `
    SELECT 
      jobid,
      jobname,
      schedule,
      active
    FROM cron.job
    ORDER BY jobname;
  `;
  
  const { data: jobsData } = await querySQL(client, jobsQuery, dbName);
  
  return {
    extensionExists: true,
    jobs: jobsData || []
  };
}

async function getPolicies(client, dbName) {
  const query = `
    SELECT 
      schemaname,
      tablename,
      policyname,
      permissive,
      roles,
      cmd,
      qual
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `;
  
  const { data, error } = await querySQL(client, query, dbName);
  
  if (error) {
    return [];
  }
  
  return data || [];
}

async function getIndexes(client, dbName) {
  const query = `
    SELECT 
      schemaname,
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `;
  
  const { data, error } = await querySQL(client, query, dbName);
  
  if (error) {
    return [];
  }
  
  return data || [];
}

async function compareLogic() {
  console.log('\n🔍 Comparing Database Logic\n');
  console.log('='.repeat(70));

  // Get dev data
  console.log('\n📊 Fetching Dev database logic...');
  const devFunctions = await getFunctions(devClient, 'Dev');
  const devViews = await getViews(devClient, 'Dev');
  const devTriggers = await getTriggers(devClient, 'Dev');
  const devCron = await getCronJobs(devClient, 'Dev');
  const devPolicies = await getPolicies(devClient, 'Dev');
  const devIndexes = await getIndexes(devClient, 'Dev');

  console.log(`   Functions: ${devFunctions.length}`);
  console.log(`   Views: ${devViews.length}`);
  console.log(`   Triggers: ${devTriggers.length}`);
  console.log(`   Cron Jobs: ${devCron.jobs.length} (extension: ${devCron.extensionExists ? '✅' : '❌'})`);
  console.log(`   Policies: ${devPolicies.length}`);
  console.log(`   Indexes: ${devIndexes.length}`);

  // Get prod data (if available)
  let prodFunctions = [];
  let prodViews = [];
  let prodTriggers = [];
  let prodCron = { extensionExists: false, jobs: [] };
  let prodPolicies = [];
  let prodIndexes = [];

  if (prodClient) {
    console.log('\n📊 Fetching Production database logic...');
    prodFunctions = await getFunctions(prodClient, 'Production');
    prodViews = await getViews(prodClient, 'Production');
    prodTriggers = await getTriggers(prodClient, 'Production');
    prodCron = await getCronJobs(prodClient, 'Production');
    prodPolicies = await getPolicies(prodClient, 'Production');
    prodIndexes = await getIndexes(prodClient, 'Production');

    console.log(`   Functions: ${prodFunctions.length}`);
    console.log(`   Views: ${prodViews.length}`);
    console.log(`   Triggers: ${prodTriggers.length}`);
    console.log(`   Cron Jobs: ${prodCron.jobs.length} (extension: ${prodCron.extensionExists ? '✅' : '❌'})`);
    console.log(`   Policies: ${prodPolicies.length}`);
    console.log(`   Indexes: ${prodIndexes.length}`);
  } else {
    console.log('\n⚠️  Production key not found - skipping production comparison');
    console.log('   Add PROD_SERVICE_ROLE_KEY to .env.local to compare');
  }

  // Compare
  console.log('\n' + '='.repeat(70));
  console.log('📋 COMPARISON RESULTS');
  console.log('='.repeat(70));

  // Functions
  if (prodClient) {
    const funcNames = new Set(prodFunctions.map(f => f.routine_name));
    const devFuncNames = new Set(devFunctions.map(f => f.routine_name));
    const missingFuncs = [...funcNames].filter(f => !devFuncNames.has(f));
    const extraFuncs = [...devFuncNames].filter(f => !funcNames.has(f));

    console.log(`\n🔧 Functions:`);
    console.log(`   Production: ${prodFunctions.length}`);
    console.log(`   Dev: ${devFunctions.length}`);
    if (missingFuncs.length > 0) {
      console.log(`   ❌ Missing in Dev (${missingFuncs.length}):`);
      missingFuncs.forEach(f => console.log(`      - ${f}`));
    }
    if (extraFuncs.length > 0) {
      console.log(`   ⚠️  Extra in Dev (${extraFuncs.length}):`);
      extraFuncs.forEach(f => console.log(`      - ${f}`));
    }
    if (missingFuncs.length === 0 && extraFuncs.length === 0) {
      console.log(`   ✅ All functions match!`);
    }
  } else {
    console.log(`\n🔧 Functions: ${devFunctions.length} in Dev`);
  }

  // Views
  if (prodClient) {
    const viewNames = new Set(prodViews.map(v => v.table_name));
    const devViewNames = new Set(devViews.map(v => v.table_name));
    const missingViews = [...viewNames].filter(v => !devViewNames.has(v));
    const extraViews = [...devViewNames].filter(v => !viewNames.has(v));

    console.log(`\n👁️  Views:`);
    console.log(`   Production: ${prodViews.length}`);
    console.log(`   Dev: ${devViews.length}`);
    if (missingViews.length > 0) {
      console.log(`   ❌ Missing in Dev (${missingViews.length}):`);
      missingViews.forEach(v => console.log(`      - ${v}`));
    }
    if (extraViews.length > 0) {
      console.log(`   ⚠️  Extra in Dev (${extraViews.length}):`);
      extraViews.forEach(v => console.log(`      - ${v}`));
    }
    if (missingViews.length === 0 && extraViews.length === 0) {
      console.log(`   ✅ All views match!`);
    }
  } else {
    console.log(`\n👁️  Views: ${devViews.length} in Dev`);
  }

  // Triggers
  if (prodClient) {
    const triggerNames = new Set(prodTriggers.map(t => t.trigger_name));
    const devTriggerNames = new Set(devTriggers.map(t => t.trigger_name));
    const missingTriggers = [...triggerNames].filter(t => !devTriggerNames.has(t));
    const extraTriggers = [...devTriggerNames].filter(t => !triggerNames.has(t));

    console.log(`\n⚡ Triggers:`);
    console.log(`   Production: ${prodTriggers.length}`);
    console.log(`   Dev: ${devTriggers.length}`);
    if (missingTriggers.length > 0) {
      console.log(`   ❌ Missing in Dev (${missingTriggers.length}):`);
      missingTriggers.forEach(t => console.log(`      - ${t}`));
    }
    if (extraTriggers.length > 0) {
      console.log(`   ⚠️  Extra in Dev (${extraTriggers.length}):`);
      extraTriggers.forEach(t => console.log(`      - ${t}`));
    }
    if (missingTriggers.length === 0 && extraTriggers.length === 0) {
      console.log(`   ✅ All triggers match!`);
    }
  } else {
    console.log(`\n⚡ Triggers: ${devTriggers.length} in Dev`);
  }

  // Cron Jobs
  console.log(`\n⏰ Cron Jobs:`);
  if (prodClient) {
    console.log(`   Production: ${prodCron.jobs.length} jobs (extension: ${prodCron.extensionExists ? '✅' : '❌'})`);
    console.log(`   Dev: ${devCron.jobs.length} jobs (extension: ${devCron.extensionExists ? '✅' : '❌'})`);
    
    if (!devCron.extensionExists) {
      console.log(`   ❌ pg_cron extension not enabled in Dev!`);
      console.log(`   💡 Run: CREATE EXTENSION IF NOT EXISTS pg_cron;`);
    }
    
    if (prodCron.jobs.length > 0) {
      const prodJobNames = new Set(prodCron.jobs.map(j => j.jobname));
      const devJobNames = new Set(devCron.jobs.map(j => j.jobname));
      const missingJobs = [...prodJobNames].filter(j => !devJobNames.has(j));
      
      if (missingJobs.length > 0) {
        console.log(`   ❌ Missing in Dev (${missingJobs.length}):`);
        missingJobs.forEach(j => console.log(`      - ${j}`));
      }
      
      if (devCron.jobs.length === 0 && prodCron.jobs.length > 0) {
        console.log(`   ⚠️  No cron jobs in Dev! Run setup_cron_jobs_dev.sql`);
      }
    }
  } else {
    console.log(`   Dev: ${devCron.jobs.length} jobs (extension: ${devCron.extensionExists ? '✅' : '❌'})`);
    if (!devCron.extensionExists) {
      console.log(`   ❌ pg_cron extension not enabled!`);
    }
    if (devCron.jobs.length === 0) {
      console.log(`   ⚠️  No cron jobs configured!`);
    }
  }

  // Policies
  if (prodClient) {
    const policyKeys = new Set(prodPolicies.map(p => `${p.tablename}.${p.policyname}`));
    const devPolicyKeys = new Set(devPolicies.map(p => `${p.tablename}.${p.policyname}`));
    const missingPolicies = [...policyKeys].filter(p => !devPolicyKeys.has(p));
    const extraPolicies = [...devPolicyKeys].filter(p => !policyKeys.has(p));

    console.log(`\n🔒 RLS Policies:`);
    console.log(`   Production: ${prodPolicies.length}`);
    console.log(`   Dev: ${devPolicies.length}`);
    if (missingPolicies.length > 0) {
      console.log(`   ❌ Missing in Dev (${missingPolicies.length}):`);
      missingPolicies.slice(0, 10).forEach(p => console.log(`      - ${p}`));
      if (missingPolicies.length > 10) {
        console.log(`      ... and ${missingPolicies.length - 10} more`);
      }
    }
    if (extraPolicies.length > 0) {
      console.log(`   ⚠️  Extra in Dev (${extraPolicies.length}):`);
      extraPolicies.slice(0, 10).forEach(p => console.log(`      - ${p}`));
      if (extraPolicies.length > 10) {
        console.log(`      ... and ${extraPolicies.length - 10} more`);
      }
    }
    if (missingPolicies.length === 0 && extraPolicies.length === 0) {
      console.log(`   ✅ All policies match!`);
    }
  } else {
    console.log(`\n🔒 RLS Policies: ${devPolicies.length} in Dev`);
  }

  // Indexes
  if (prodClient) {
    const indexKeys = new Set(prodIndexes.map(i => `${i.tablename}.${i.indexname}`));
    const devIndexKeys = new Set(devIndexes.map(i => `${i.tablename}.${i.indexname}`));
    const missingIndexes = [...indexKeys].filter(i => !devIndexKeys.has(i));
    const extraIndexes = [...devIndexKeys].filter(i => !indexKeys.has(i));

    console.log(`\n📇 Indexes:`);
    console.log(`   Production: ${prodIndexes.length}`);
    console.log(`   Dev: ${devIndexes.length}`);
    if (missingIndexes.length > 0) {
      console.log(`   ❌ Missing in Dev (${missingIndexes.length}):`);
      missingIndexes.slice(0, 10).forEach(i => console.log(`      - ${i}`));
      if (missingIndexes.length > 10) {
        console.log(`      ... and ${missingIndexes.length - 10} more`);
      }
    }
    if (extraIndexes.length === 0 && missingIndexes.length === 0) {
      console.log(`   ✅ All indexes match!`);
    }
  } else {
    console.log(`\n📇 Indexes: ${devIndexes.length} in Dev`);
  }

  console.log('\n' + '='.repeat(70));
  console.log('💡 RECOMMENDATIONS');
  console.log('='.repeat(70));
  
  if (!devCron.extensionExists) {
    console.log('\n1. Enable pg_cron extension in Dev:');
    console.log('   CREATE EXTENSION IF NOT EXISTS pg_cron;');
    console.log('   CREATE EXTENSION IF NOT EXISTS pg_net;');
  }
  
  if (devCron.jobs.length === 0) {
    console.log('\n2. Set up cron jobs in Dev:');
    console.log('   Run: database/setup_cron_jobs_dev.sql');
  }
  
  if (prodClient && (missingPolicies.length > 0 || missingIndexes.length > 0 || missingFuncs.length > 0)) {
    console.log('\n3. Missing database objects detected - may need to run additional migrations');
  }

  console.log('\n');
}

compareLogic().catch(console.error);
