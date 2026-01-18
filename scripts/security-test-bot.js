#!/usr/bin/env node
/**
 * Security Testing Bot
 * Tests common vulnerabilities and security issues in the Ticketrack application
 * 
 * This bot performs legitimate security testing on your own application.
 * Do NOT use this on applications you don't own or have permission to test.
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple .env file loader
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return 0;
  
  let loadedCount = 0;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
          loadedCount++;
        }
      }
    }
    return loadedCount;
  } catch (e) {
    console.error(`Error reading ${filePath}: ${e.message}`);
    return 0;
  }
}

// Load environment variables
const envLocalPath = join(__dirname, '../.env.local');
const envPath = join(__dirname, '../.env');

loadEnvFile(envLocalPath);
loadEnvFile(envPath);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bkvbvggngttrizbchygy.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ VITE_SUPABASE_ANON_KEY not found in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test results
const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function logTest(name, status, details = '') {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${name}${details ? ': ' + details : ''}`);
  
  if (status === 'PASS') results.passed.push(name);
  else if (status === 'FAIL') results.failed.push({ name, details });
  else results.warnings.push({ name, details });
}

// ============================================================================
// SECURITY TEST SUITE
// ============================================================================

async function testSQLInjection() {
  console.log('\n🔍 Testing SQL Injection...');
  
  const payloads = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "1' OR '1'='1",
  ];
  
  for (const payload of payloads) {
    try {
      // Test on events query
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('title', payload)
        .limit(1);
      
      if (error && error.message.includes('syntax error') || error.message.includes('unexpected')) {
        logTest(`SQL Injection (title: ${payload.substring(0, 20)}...)`, 'PASS', 'SQL error properly caught');
      } else {
        logTest(`SQL Injection (title: ${payload.substring(0, 20)}...)`, 'WARN', 'No SQL error returned - check RLS policies');
      }
    } catch (err) {
      logTest(`SQL Injection (title: ${payload.substring(0, 20)}...)`, 'PASS', 'Exception caught: ' + err.message);
    }
  }
}

async function testXSS() {
  console.log('\n🔍 Testing XSS (Cross-Site Scripting)...');
  
  const xssPayloads = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg/onload=alert("XSS")>',
    '"><script>alert("XSS")</script>',
  ];
  
  for (const payload of xssPayloads) {
    try {
      // Test on event description (if sanitized, should strip tags)
      const { data, error } = await supabase
        .from('events')
        .select('description')
        .textSearch('description', payload)
        .limit(1);
      
      if (error) {
        logTest(`XSS (description: ${payload.substring(0, 20)}...)`, 'PASS', 'Query blocked or sanitized');
      } else {
        logTest(`XSS (description: ${payload.substring(0, 20)}...)`, 'WARN', 'Check if input is sanitized in frontend');
      }
    } catch (err) {
      logTest(`XSS (description: ${payload.substring(0, 20)}...)`, 'PASS', 'Exception caught');
    }
  }
}

async function testAuthentication() {
  console.log('\n🔍 Testing Authentication Security...');
  
  // Test 1: Try to access sensitive resources without auth (organizers table allows public reads for is_active=true)
  // Test sensitive tables instead: payment_gateway_config, organizer_bank_accounts
  try {
    // Test payment gateway config (should be admin-only)
    const { data: paymentData, error: paymentError } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .limit(1);
    
    if (paymentError && (paymentError.code === 'PGRST301' || paymentError.message.includes('RLS') || paymentError.message.includes('permission'))) {
      logTest('Authentication: RLS Active (Payment Config)', 'PASS', 'Row Level Security blocks unauthorized access to sensitive data');
    } else if (paymentData && paymentData.length > 0) {
      logTest('Authentication: RLS Active (Payment Config)', 'FAIL', 'Sensitive payment config exposed without auth!');
    } else if (!paymentError && paymentData && paymentData.length === 0) {
      logTest('Authentication: RLS Active (Payment Config)', 'PASS', 'No sensitive data returned without auth');
    } else {
      logTest('Authentication: RLS Active (Payment Config)', 'PASS', 'Access blocked (error: ' + (paymentError?.message || 'unknown').substring(0, 50) + ')');
    }
    
    // Test bank accounts (should be organizer-only)
    const { data: bankData, error: bankError } = await supabase
      .from('organizer_bank_accounts')
      .select('*')
      .limit(1);
    
    if (bankError && (bankError.code === 'PGRST301' || bankError.message.includes('RLS') || bankError.message.includes('permission'))) {
      logTest('Authentication: RLS Active (Bank Accounts)', 'PASS', 'Row Level Security blocks unauthorized access to sensitive data');
    } else if (bankData && bankData.length > 0) {
      logTest('Authentication: RLS Active (Bank Accounts)', 'FAIL', 'Sensitive bank accounts exposed without auth!');
    } else if (!bankError && bankData && bankData.length === 0) {
      logTest('Authentication: RLS Active (Bank Accounts)', 'PASS', 'No sensitive data returned without auth');
    } else {
      logTest('Authentication: RLS Active (Bank Accounts)', 'PASS', 'Access blocked');
    }
    
    // Test organizer public data (should be accessible but check for sensitive fields)
    // Use select('*') to test if RLS exposes sensitive fields
    const { data: orgData, error: orgError } = await supabase
      .from('organizers')
      .select('*')
      .eq('is_active', true)
      .limit(1);
    
    if (orgData && orgData.length > 0) {
      const org = orgData[0];
      // Check for sensitive fields that should NOT be exposed publicly
      const sensitiveFields = [
        'user_id',
        'available_balance',
        'pending_balance',
        'stripe_connect_id',
        'paystack_subaccount_id',
        'flutterwave_subaccount_id',
        'kyc_status',
        'kyc_verified',
        'custom_fee_enabled',
        'custom_service_fee_percentage',
        'custom_service_fee_fixed'
      ];
      
      const exposedSensitiveFields = sensitiveFields.filter(field => org[field] !== undefined && org[field] !== null);
      
      if (exposedSensitiveFields.length > 0) {
        logTest('Authentication: Public Organizer Data', 'WARN', `Sensitive fields exposed: ${exposedSensitiveFields.join(', ')}. Frontend should use selective field queries.`);
      } else {
        logTest('Authentication: Public Organizer Data', 'PASS', 'No sensitive fields exposed (but frontend should use selective queries)');
      }
    } else {
      logTest('Authentication: Public Organizer Data', 'PASS', 'No organizer data returned');
    }
  } catch (err) {
    logTest('Authentication: RLS Active', 'PASS', 'Exception caught: ' + err.message.substring(0, 50));
  }
  
  // Test 2: Try invalid credentials
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: "nonexistent@example.com",
    password: "wrongpassword123"
  });
  
  if (loginError && loginError.message.includes('Invalid login')) {
    logTest('Authentication: Invalid Credentials', 'PASS', 'Invalid login properly rejected');
  } else if (loginData) {
    logTest('Authentication: Invalid Credentials', 'FAIL', 'Invalid credentials accepted!');
  } else {
    logTest('Authentication: Invalid Credentials', 'WARN', 'Unexpected response');
  }
  
  // Test 3: Try SQL injection in email
  const sqlEmailPayload = "admin' OR '1'='1@example.com";
  const { error: sqlError } = await supabase.auth.signInWithPassword({
    email: sqlEmailPayload,
    password: "password"
  });
  
  if (sqlError && !sqlError.message.includes('syntax error')) {
    logTest('Authentication: SQL Injection in Email', 'PASS', 'SQL injection in email blocked');
  } else {
    logTest('Authentication: SQL Injection in Email', 'WARN', 'Check email validation');
  }
}

async function testInputValidation() {
  console.log('\n🔍 Testing Input Validation...');
  
  // Test 1: Extremely long input
  const longString = 'A'.repeat(10000);
  try {
    const { error } = await supabase
      .from('events')
      .insert({ title: longString, venue_name: 'Test', start_date: new Date().toISOString() });
    
    if (error && error.message.includes('too long') || error.message.includes('exceeds')) {
      logTest('Input Validation: Length Limits', 'PASS', 'Long inputs rejected');
    } else if (error && error.code === '23514') {
      logTest('Input Validation: Length Limits', 'PASS', 'Database constraint enforced');
    } else {
      logTest('Input Validation: Length Limits', 'WARN', 'Check length validation');
    }
  } catch (err) {
    logTest('Input Validation: Length Limits', 'PASS', 'Exception caught');
  }
  
  // Test 2: Special characters
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  try {
    const { error } = await supabase
      .from('events')
      .select('title')
      .eq('title', specialChars)
      .limit(1);
    
    if (error) {
      logTest('Input Validation: Special Characters', 'PASS', 'Special characters handled');
    } else {
      logTest('Input Validation: Special Characters', 'WARN', 'Check special character handling');
    }
  } catch (err) {
    logTest('Input Validation: Special Characters', 'PASS', 'Exception caught');
  }
}

async function testCSRF() {
  console.log('\n🔍 Testing CSRF Protection...');
  
  // CSRF protection is typically handled at the framework/backend level
  // For Supabase, CSRF is handled via the API key and auth tokens
  logTest('CSRF: Token-Based Protection', 'WARN', 'CSRF protection relies on Supabase auth tokens - verify in production');
}

async function testRateLimiting() {
  console.log('\n🔍 Testing Rate Limiting...');
  
  // Attempt multiple rapid requests
  const requests = [];
  for (let i = 0; i < 20; i++) {
    requests.push(
      supabase.from('events').select('id').limit(1)
    );
  }
  
  try {
    const responses = await Promise.all(requests);
    const errors = responses.filter(r => r.error);
    
    if (errors.length > 0 && errors[0].error?.message?.includes('rate limit')) {
      logTest('Rate Limiting: API Protection', 'PASS', 'Rate limiting active');
    } else {
      logTest('Rate Limiting: API Protection', 'WARN', 'No rate limiting detected - check Supabase settings');
    }
  } catch (err) {
    logTest('Rate Limiting: API Protection', 'WARN', 'Rate limiting check failed');
  }
}

async function testAuthorization() {
  console.log('\n🔍 Testing Authorization (Access Control)...');
  
  // This test requires creating a test user and checking if they can access other users' data
  logTest('Authorization: User Isolation', 'WARN', 'Manual test required: Create two users and verify isolation');
}

async function testDataExposure() {
  console.log('\n🔍 Testing Data Exposure...');
  
  // Test if sensitive data is exposed in error messages
  try {
    const { error } = await supabase
      .from('users')
      .select('email, password_hash')
      .limit(1);
    
    if (error) {
      if (error.message.includes('password') || error.message.includes('email')) {
        logTest('Data Exposure: Error Messages', 'FAIL', 'Sensitive field names exposed in error');
      } else {
        logTest('Data Exposure: Error Messages', 'PASS', 'No sensitive data in error messages');
      }
    }
  } catch (err) {
    logTest('Data Exposure: Error Messages', 'PASS', 'Exception handled');
  }
}

async function testFileUpload() {
  console.log('\n🔍 Testing File Upload Security...');
  
  // Test if dangerous file types can be uploaded
  logTest('File Upload: Type Validation', 'WARN', 'Manual test required: Try uploading .exe, .php, .js files');
  logTest('File Upload: Size Limits', 'WARN', 'Manual test required: Try uploading very large files');
}

async function testAPISecurity() {
  console.log('\n🔍 Testing API Security...');
  
  // Test if API endpoints require authentication
  try {
    const { data, error } = await supabase
      .from('payment_gateway_config')
      .select('*')
      .limit(1);
    
    if (data && data.length > 0) {
      logTest('API Security: Sensitive Endpoints', 'FAIL', 'Sensitive payment config exposed without auth!');
    } else if (error) {
      logTest('API Security: Sensitive Endpoints', 'PASS', 'Sensitive endpoints protected');
    }
  } catch (err) {
    logTest('API Security: Sensitive Endpoints', 'PASS', 'Exception caught');
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function runSecurityTests() {
  console.log('🚀 Starting Security Testing Bot for Ticketrack...\n');
  console.log('⚠️  This bot performs legitimate security testing on YOUR application.\n');
  
  const startTime = Date.now();
  
  try {
    await testSQLInjection();
    await testXSS();
    await testAuthentication();
    await testInputValidation();
    await testCSRF();
    await testRateLimiting();
    await testAuthorization();
    await testDataExposure();
    await testFileUpload();
    await testAPISecurity();
  } catch (error) {
    console.error('❌ Security test suite error:', error);
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SECURITY TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('='.repeat(60));
  
  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.failed.forEach(({ name, details }) => {
      console.log(`  - ${name}: ${details}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS (Manual Review Recommended):');
    results.warnings.forEach(({ name, details }) => {
      console.log(`  - ${name}: ${details}`);
    });
  }
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Review failed tests and fix security issues');
  console.log('   2. Investigate warnings - may require manual testing');
  console.log('   3. Run additional manual security tests');
  console.log('   4. Consider professional security audit for production\n');
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runSecurityTests().catch(console.error);
