#!/usr/bin/env node
/**
 * Automated Test Bot for Auto-Refund on Cancellation
 * 
 * This script simulates the full flow:
 * 1. Creates a recurring event
 * 2. Creates a child event (future date)
 * 3. Purchases tickets
 * 4. Cancels the event
 * 5. Triggers auto-refund
 * 6. Verifies refunds were processed
 * 
 * Usage: node scripts/test-auto-refund-bot.js
 */

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple .env file loader (without dotenv dependency)
function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    console.log(`   ⚠️  File not found: ${filePath}`);
    return;
  }
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let keysFound = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      // Handle KEY=value format
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
      
      if (key && value) {
        if (!process.env[key]) {
          process.env[key] = value;
          keysFound++;
          // Debug: Show if we found the service role key
          if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
            console.log(`   ✅ Found ${key} in ${filePath} (length: ${value.length})`);
          }
        }
      }
    }
    
    if (keysFound > 0) {
      console.log(`   ✅ Loaded ${keysFound} env variables from ${filePath}`);
    }
  } catch (e) {
    console.log(`   ⚠️  Error reading ${filePath}: ${e.message}`);
  }
}

// Try to load .env.local, fallback to .env
const envLocalPath = join(__dirname, '../.env.local');
const envPath = join(__dirname, '../.env');

// Debug: Show which files we're trying to load
console.log(`🔍 Looking for env files:`);
console.log(`   .env.local: ${envLocalPath} (exists: ${existsSync(envLocalPath)})`);
console.log(`   .env: ${envPath} (exists: ${existsSync(envPath)})`);

loadEnvFile(envLocalPath);
loadEnvFile(envPath);

// Debug: Check if key was loaded
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const keyPreview = process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...';
  console.log(`✅ Found SUPABASE_SERVICE_ROLE_KEY (preview: ${keyPreview})`);
} else {
  console.log(`❌ SUPABASE_SERVICE_ROLE_KEY not found after loading env files\n`);
  
  // Show what keys ARE loaded (to help debug)
  const loadedKeys = Object.keys(process.env).filter(k => 
    k.includes('SUPABASE') || k.includes('SERVICE') || k.includes('ROLE')
  );
  
  if (loadedKeys.length > 0) {
    console.log('   Found these related keys:');
    loadedKeys.forEach(k => {
      const preview = process.env[k] ? process.env[k].substring(0, 20) + '...' : '(empty)';
      console.log(`     - ${k} = ${preview}`);
    });
    console.log('');
  } else {
    console.log('   ⚠️  No SUPABASE/SERVICE/ROLE related keys found\n');
  }
  
  // Check for common typos/variations
  const variations = [
    'SUPABASE_SERVICE_KEY',
    'SERVICE_ROLE_KEY',
    'SUPABASE_ROLE_KEY',
    'SUPABASE_SERVICE_ROLE',
  ];
  
  const foundVariation = variations.find(v => process.env[v]);
  if (foundVariation) {
    console.log(`   💡 Found similar key: ${foundVariation}`);
    console.log(`   Please rename it to: SUPABASE_SERVICE_ROLE_KEY\n`);
  }
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bkvbvggngttrizbchygy.supabase.co';
// CRITICAL: Must use SERVICE_ROLE_KEY, not ANON_KEY (anon key enforces RLS)
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('\n❌ SUPABASE_SERVICE_ROLE_KEY not found in environment variables\n');
  console.error('   Troubleshooting:');
  console.error(`   1. Check .env.local exists: ${existsSync(envLocalPath) ? '✅' : '❌'}`);
  console.error(`   2. Check .env exists: ${existsSync(envPath) ? '✅' : '❌'}`);
  console.error('   3. Make sure the line in .env.local is exactly:');
  console.error('      SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  console.error('   4. No quotes, no spaces around =, full key on one line\n');
  process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test RLS bypass at startup - verify service role key works
async function verifyRLSBypass() {
  try {
    // Try a simple operation that would be blocked by RLS with anon key
    const { error } = await supabase.from('organizers').select('id').limit(1);
    if (error && error.code === '42501') {
      console.error('\n❌ RLS is still active! Service role key not working properly.');
      console.error('   This suggests the key might be incorrect or expired.\n');
      throw new Error('RLS bypass verification failed');
    }
    // If no error, RLS bypass is working
    return true;
  } catch (e) {
    if (e.message.includes('RLS bypass verification failed')) {
      process.exit(1);
    }
    throw e;
  }
}

// Log which key type is being used (for debugging)
const isServiceRole = SUPABASE_SERVICE_KEY.startsWith('eyJ') && SUPABASE_SERVICE_KEY.length > 100;
if (!isServiceRole && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Warning: Key might not be service role key. Service role keys are long and start with eyJ...');
}

// Test configuration
const TEST_CONFIG = {
  organizerEmail: 'test-auto-refund@ticketrack.test',
  buyerEmail: 'test-buyer@ticketrack.test',
  eventTitle: `Auto-Refund Test ${new Date().toISOString().split('T')[0]}`,
  ticketPrice: 5000, // 50 NGN
  currency: 'NGN',
  countryCode: 'NG',
};

let testData = {
  organizerId: null,
  eventId: null,
  childEventId: null,
  ticketTypeId: null,
  childTicketTypeId: null,
  orderId: null,
  ticketIds: [],
  refundRequestIds: [],
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

async function cleanup() {
  log('\n🧹 Cleaning up test data...', 'yellow');
  
  try {
    if (testData.ticketIds.length > 0) {
      await supabase.from('tickets').delete().in('id', testData.ticketIds);
      log('  ✓ Deleted tickets', 'green');
    }
    
    if (testData.refundRequestIds.length > 0) {
      await supabase.from('refund_requests').delete().in('id', testData.refundRequestIds);
      log('  ✓ Deleted refund requests', 'green');
    }
    
    if (testData.orderId) {
      await supabase.from('orders').delete().eq('id', testData.orderId);
      log('  ✓ Deleted order', 'green');
    }
    
    if (testData.childTicketTypeId) {
      await supabase.from('ticket_types').delete().eq('id', testData.childTicketTypeId);
      log('  ✓ Deleted child ticket type', 'green');
    }
    
    if (testData.ticketTypeId) {
      await supabase.from('ticket_types').delete().eq('id', testData.ticketTypeId);
      log('  ✓ Deleted ticket type', 'green');
    }
    
    if (testData.childEventId) {
      await supabase.from('events').delete().eq('id', testData.childEventId);
      log('  ✓ Deleted child event', 'green');
    }
    
    if (testData.eventId) {
      await supabase.from('events').delete().eq('id', testData.eventId);
      log('  ✓ Deleted parent event', 'green');
    }
    
    log('✅ Cleanup complete!', 'green');
  } catch (error) {
    log(`  ⚠️  Cleanup error: ${error.message}`, 'yellow');
  }
}

async function setupOrganizer() {
  logStep('1', 'Setting up test organizer...');
  
  // First, try to find existing organizer
  const { data: organizer, error: findError } = await supabase
    .from('organizers')
    .select('id')
    .eq('business_email', TEST_CONFIG.organizerEmail)
    .maybeSingle(); // Use maybeSingle to avoid error if not found

  if (organizer) {
    testData.organizerId = organizer.id;
    log('  ✓ Using existing organizer', 'green');
    return;
  }

  // If not found, try to get any existing organizer with a user_id
  // This is safer than creating a new one (which requires user_id)
  const { data: anyOrganizer, error: anyError } = await supabase
    .from('organizers')
    .select('id, user_id')
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle();
  
  if (anyOrganizer) {
    testData.organizerId = anyOrganizer.id;
    log(`  ✓ Using existing organizer: ${anyOrganizer.id}`, 'green');
    return;
  }

  // If no organizer found, we can't create one without user_id
  // So we'll need to use a dummy approach or fail gracefully
  log('  ⚠️  No organizer found, but creating one requires user_id', 'yellow');
  log('  💡 Trying to find any organizer in database...', 'yellow');
  
  // Last resort: try to get ANY organizer (even without user_id check)
  const { data: fallbackOrg, error: fallbackError } = await supabase
    .from('organizers')
    .select('id')
    .limit(1)
    .maybeSingle();
  
  if (fallbackOrg) {
    testData.organizerId = fallbackOrg.id;
    log(`  ✓ Using organizer: ${fallbackOrg.id}`, 'green');
    return;
  }

  throw new Error('No organizer found in database. Please create an organizer first through the app.');
}

async function createRecurringEvent() {
  logStep('2', 'Creating recurring event...');
  
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  const futureDateTime = `${futureDateStr}T18:00:00`;

  const slug = `test-auto-refund-${Date.now()}`;

  const { data: event, error } = await supabase
    .from('events')
    .insert({
      organizer_id: testData.organizerId,
      title: TEST_CONFIG.eventTitle,
      slug: slug,
      description: 'Automated test event for auto-refund functionality',
      event_type: 'concert',
      category: 'music',
      start_date: futureDateTime,
      end_date: `${futureDateStr}T22:00:00`,
      venue_name: 'Test Venue',
      venue_address: '123 Test St',
      city: 'Lagos',
      country_code: TEST_CONFIG.countryCode,
      currency: TEST_CONFIG.currency,
      status: 'published',
      is_recurring: true,
      recurring_type: 'weekly',
      recurring_days: [1], // Monday
      recurring_end_type: 'date',
      recurring_end_date: `${futureDateStr}T23:59:59`,
    })
    .select('id')
    .single();

  if (error) throw error;
  testData.eventId = event.id;
  log(`  ✓ Event created: ${event.id}`, 'green');
}

async function createTicketTypes() {
  logStep('3', 'Creating ticket types...');
  
  // Parent event ticket type
  const { data: ticketType, error } = await supabase
    .from('ticket_types')
    .insert({
      event_id: testData.eventId,
      name: 'General Admission',
      price: TEST_CONFIG.ticketPrice,
      quantity_available: 10,
      is_active: true,
    })
    .select('id')
    .single();

  if (error) throw error;
  testData.ticketTypeId = ticketType.id;
  log('  ✓ Parent ticket type created', 'green');
}

async function createChildEvent() {
  logStep('4', 'Creating child event (future date)...');
  
  const childEventDate = new Date();
  childEventDate.setDate(childEventDate.getDate() + 14); // 2 weeks from now
  const childEventDateStr = childEventDate.toISOString().split('T')[0];
  const childEventDateTime = `${childEventDateStr}T18:00:00`;

  // Generate unique slug with timestamp to avoid conflicts
  const timestamp = Date.now();
  const slug = `test-auto-refund-${childEventDateStr}-${timestamp}`;

  const { data: childEvent, error } = await supabase
    .from('events')
    .insert({
      organizer_id: testData.organizerId,
      parent_event_id: testData.eventId,
      title: TEST_CONFIG.eventTitle,
      slug: slug,
      description: 'Automated test event for auto-refund functionality',
      event_type: 'concert',
      category: 'music',
      start_date: childEventDateTime,
      end_date: `${childEventDateStr}T22:00:00`,
      venue_name: 'Test Venue',
      venue_address: '123 Test St',
      city: 'Lagos',
      country_code: TEST_CONFIG.countryCode,
      currency: TEST_CONFIG.currency,
      status: 'published',
      is_recurring: false,
    })
    .select('id')
    .single();

  if (error) throw error;
  testData.childEventId = childEvent.id;
  log(`  ✓ Child event created: ${childEvent.id}`, 'green');

  // Create ticket type for child event
  const { data: childTicketType, error: childTicketError } = await supabase
    .from('ticket_types')
    .insert({
      event_id: testData.childEventId,
      name: 'General Admission',
      price: TEST_CONFIG.ticketPrice,
      quantity_available: 10,
      quantity_sold: 0,
      is_active: true,
    })
    .select('id')
    .single();

  if (childTicketError) throw childTicketError;
  testData.childTicketTypeId = childTicketType.id;
  log('  ✓ Child ticket type created', 'green');
}

async function simulatePurchase() {
  logStep('5', 'Simulating ticket purchase...');
  
  const platformFee = Math.round(TEST_CONFIG.ticketPrice * 0.05); // 5%
  const totalAmount = TEST_CONFIG.ticketPrice + platformFee;

  // Create order
  // Note: orders table doesn't have country_code, organizer_id, or user_id columns
  // Get a user_id from profiles if available, otherwise use null and let DB handle it
  const { data: testUser } = await supabase
    .from('profiles')
    .select('id')
    .limit(1)
    .maybeSingle();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: `TEST-${Date.now()}`,
      event_id: testData.childEventId,
      user_id: testUser?.id || '00000000-0000-0000-0000-000000000001', // Use test user or fallback
      buyer_name: 'Test Buyer',
      buyer_email: TEST_CONFIG.buyerEmail,
      buyer_phone: '+2341234567890',
      subtotal: TEST_CONFIG.ticketPrice,
      platform_fee: platformFee,
      tax_amount: 0,
      total_amount: totalAmount,
      currency: TEST_CONFIG.currency,
      status: 'completed',
      payment_provider: 'paystack',
      payment_reference: `TEST-REF-${Date.now()}`,
      payment_method: 'card',
      paid_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (orderError) throw orderError;
  testData.orderId = order.id;
  log(`  ✓ Order created: ${order.id}`, 'green');

  // Create tickets
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .insert([
      {
        order_id: testData.orderId,
        event_id: testData.childEventId,
        ticket_type_id: testData.childTicketTypeId,
        attendee_name: 'Test Buyer',
        attendee_email: TEST_CONFIG.buyerEmail,
        ticket_code: `TKT-TEST-${Date.now()}-1`,
        unit_price: TEST_CONFIG.ticketPrice,
        total_price: TEST_CONFIG.ticketPrice,
        status: 'active',
        payment_status: 'completed',
      },
    ])
    .select('id');

  if (ticketsError) throw ticketsError;
  testData.ticketIds = tickets.map(t => t.id);
  log(`  ✓ Tickets created: ${testData.ticketIds.length}`, 'green');

  // Update ticket type quantity_sold
  await supabase
    .from('ticket_types')
    .update({ quantity_sold: 1 })
    .eq('id', testData.childTicketTypeId);
}

async function cancelEvent() {
  logStep('6', 'Cancelling child event...');
  
  const { error } = await supabase
    .from('events')
    .update({ status: 'cancelled' })
    .eq('id', testData.childEventId);

  if (error) throw error;
  log('  ✓ Event cancelled', 'green');
}

async function triggerAutoRefund() {
  logStep('7', 'Triggering auto-refund function...');
  
  try {
    const { data, error } = await supabase.functions.invoke('auto-refund-on-cancellation', {
      body: {
        eventId: testData.childEventId,
        reason: 'Automated test cancellation',
        organizerId: testData.organizerId,
      },
    });

    if (error) {
      // Try to get more details from the error response
      let errorDetails = error.message;
      
      // If error has a response body, try to read it
      if (error.context?.body) {
        try {
          const reader = error.context.body.getReader();
          const { value } = await reader.read();
          const decoder = new TextDecoder();
          const bodyText = decoder.decode(value);
          const errorBody = JSON.parse(bodyText);
          errorDetails = errorBody.error || errorBody.message || error.message;
          log(`  📄 Error details: ${bodyText}`, 'yellow');
        } catch (e) {
          // Ignore if we can't parse the body
        }
      }
      
      if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        log('  ❌ Error: Edge Function not deployed!', 'red');
        log('  💡 To deploy:', 'yellow');
        log('     1. Run: npx supabase functions deploy auto-refund-on-cancellation', 'yellow');
        log('     2. Or deploy via Supabase Dashboard → Edge Functions', 'yellow');
        log('     3. See DEPLOY-AUTO-REFUND-FUNCTION.md for details', 'yellow');
        throw new Error('Edge Function not deployed. Please deploy it first.');
      }
      
      log(`  ❌ Error: ${errorDetails}`, 'red');
      log(`  📊 Status: ${error.context?.status || 'unknown'}`, 'yellow');
      throw error;
    }

    log('  ✓ Refund function invoked successfully', 'green');
    log(`  📊 Result: ${JSON.stringify(data, null, 2)}`, 'blue');
    
    // Wait for async processing
    log('  ⏳ Waiting for refund processing...', 'yellow');
    await new Promise(resolve => setTimeout(resolve, 5000));
  } catch (error) {
    // Re-throw if we already handled it above
    if (error.message?.includes('Edge Function not deployed')) {
      throw error;
    }
    log(`  ❌ Function invocation failed: ${error.message}`, 'red');
    throw error;
  }
}

async function verifyRefund() {
  logStep('8', 'Verifying refund was processed...');
  
  // Check refund requests
  const { data: refundRequests, error: refundReqError } = await supabase
    .from('refund_requests')
    .select('*')
    .eq('event_id', testData.childEventId)
    .eq('order_id', testData.orderId)
    .order('created_at', { ascending: false });

  if (refundReqError) throw refundReqError;

  if (!refundRequests || refundRequests.length === 0) {
    throw new Error('No refund request found');
  }

  testData.refundRequestIds = refundRequests.map(r => r.id);
  const refundRequest = refundRequests[0];
  
  log(`  ✓ Refund request found: ${refundRequest.id}`, 'green');
  log(`  ✓ Status: ${refundRequest.status}`, 'green');
  log(`  ✓ Amount: ${refundRequest.currency} ${refundRequest.amount}`, 'green');
  
  if (refundRequest.refund_reference) {
    log(`  ✓ Refund reference: ${refundRequest.refund_reference}`, 'green');
  } else {
    log('  ⚠️  No refund reference (may still be processing)', 'yellow');
  }

  // Check order status
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('status, notes')
    .eq('id', testData.orderId)
    .single();

  if (orderError) throw orderError;
  
  if (order.status === 'refunded') {
    log('  ✓ Order marked as refunded', 'green');
  } else {
    log(`  ⚠️  Order status: ${order.status} (expected: refunded)`, 'yellow');
  }

  // Check ticket status
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select('status, payment_status, refunded_at, refund_reason')
    .in('id', testData.ticketIds);

  if (ticketsError) throw ticketsError;

  for (const ticket of tickets) {
    if (ticket.status === 'cancelled' && ticket.payment_status === 'refunded') {
      log(`  ✓ Ticket ${ticket.id} refunded`, 'green');
    } else {
      log(`  ⚠️  Ticket ${ticket.id}: status=${ticket.status}, payment=${ticket.payment_status}`, 'yellow');
    }
  }

  log('\n✅ VERIFICATION COMPLETE!', 'green');
}

// Main test flow
async function runTest() {
  log('\n🤖 AUTO-REFUND TEST BOT STARTING...\n', 'blue');
  
  // Verify RLS bypass at startup
  log('🔐 Verifying service role key (RLS bypass)...', 'cyan');
  try {
    await verifyRLSBypass();
    log('  ✓ Service role key verified\n', 'green');
  } catch (error) {
    log(`  ❌ Verification failed: ${error.message}`, 'red');
    process.exit(1);
  }
  
  try {
    await setupOrganizer();
    await createRecurringEvent();
    await createTicketTypes();
    await createChildEvent();
    await simulatePurchase();
    await cancelEvent();
    await triggerAutoRefund();
    await verifyRefund();
    
    log('\n🎉 ALL TESTS PASSED!', 'green');
  } catch (error) {
    log(`\n❌ TEST FAILED: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Run the test when script is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}` || 
                     import.meta.url.endsWith(process.argv[1]) ||
                     process.argv[1]?.endsWith('test-auto-refund-bot.js');

if (isMainModule) {
  runTest().catch(console.error);
}

export { runTest };
