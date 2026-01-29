#!/usr/bin/env node
/**
 * Execute SQL file against Supabase database using direct PostgreSQL connection
 * Usage: node scripts/execute-sql.js <sql-file-path>
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '../.env.development') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.development');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('❌ Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

// Construct direct database connection string
// Supabase uses connection pooling, but we can try direct connection
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// For direct connection: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres

async function executeSQL(sql, connectionString) {
  try {
    // Dynamic import of pg
    const { default: pg } = await import('pg');
    const { Client } = pg;

    const client = new Client({
      connectionString: connectionString,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Connected to database\n');

    // Split SQL into statements and execute
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim().length === 0) continue;

      try {
        console.log(`[${i + 1}/${statements.length}] Executing...`);
        await client.query(statement);
        console.log(`✅ Statement ${i + 1} executed successfully\n`);
      } catch (error) {
        // Some errors are expected (like IF NOT EXISTS)
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)\n`);
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.log(`SQL: ${statement.substring(0, 150)}...\n`);
        }
      }
    }

    await client.end();
    console.log('✅ All statements executed');
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    throw error;
  }
}

async function main() {
  const sqlFile = process.argv[2] || join(__dirname, '../database/add_flutterwave_subaccount_fields.sql');
  
  if (!sqlFile) {
    console.error('❌ Please provide a SQL file path');
    process.exit(1);
  }

  try {
    console.log(`📄 Reading SQL file: ${sqlFile}\n`);
    const sql = readFileSync(sqlFile, 'utf-8');
    
    // Try to construct connection string
    // Note: This requires the database password, which is typically the service role key
    // But Supabase uses a different password for direct DB connections
    // We'll need to use the Management API or get the actual DB password
    
    console.log('⚠️  Direct PostgreSQL connection requires database password.');
    console.log('⚠️  Service role key cannot be used for direct DB connections.\n');
    console.log('📋 Alternative: Using Supabase Management API...\n');
    
    // Use Supabase Management API instead
    const managementApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    // Split and execute statements via Management API
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\s*$/));

    console.log(`📝 Found ${statements.length} SQL statements\n`);
    console.log('⚠️  Supabase Management API requires access token.');
    console.log('⚠️  Please run this SQL manually in Supabase SQL Editor, or:');
    console.log('   1. Get Supabase access token: supabase login');
    console.log('   2. Use: supabase db push (after linking project)');
    console.log('\n📄 SQL file ready at:', sqlFile);
    console.log('\n💡 Quick copy command:');
    console.log(`   cat ${sqlFile} | pbcopy`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
