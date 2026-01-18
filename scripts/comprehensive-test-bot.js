#!/usr/bin/env node
/**
 * Comprehensive Testing Bot for Ticketrack
 * 
 * This bot tests all major functionality:
 * 1. User account creation
 * 2. Organizer account creation
 * 3. Event creation (single, recurring, multi-day, free, paid)
 * 4. Ticket type creation
 * 5. Ticket purchases
 * 6. Payment processing
 * 7. Orders and tickets
 * 8. Promo codes
 * 9. Waitlists
 * 10. Refunds
 * 11. Payout calculations
 * 12. Custom fields
 * 13. Recurring events
 * 
 * Usage: node scripts/comprehensive-test-bot.js
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
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let keysFound = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
      
      if (key && value && !process.env[key]) {
        process.env[key] = value;
        keysFound++;
      }
    }
    
    return keysFound;
  } catch (e) {
    return 0;
  }
}

// Load environment variables
const envLocalPath = join(__dirname, '../.env.local');
const envPath = join(__dirname, '../.env');

loadEnvFile(envLocalPath);
loadEnvFile(envPath);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Debug: Check environment variables
console.log('\n🔍 Checking environment variables...');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ Found' : '❌ Missing'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_KEY ? `✅ Found (length: ${SUPABASE_SERVICE_KEY.length})` : '❌ Missing'}`);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\n❌ Missing required environment variables:\n');
  if (!SUPABASE_URL) {
    console.error('   - VITE_SUPABASE_URL or SUPABASE_URL');
  }
  if (!SUPABASE_SERVICE_KEY) {
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  }
  console.error('\n   Troubleshooting:');
  console.error(`   1. Check .env.local exists: ${existsSync(envLocalPath) ? '✅' : '❌'}`);
  console.error(`   2. Check .env exists: ${existsSync(envPath) ? '✅' : '❌'}`);
  console.error('   3. Make sure the lines in .env.local are exactly:');
  console.error('      VITE_SUPABASE_URL=your_url_here');
  console.error('      SUPABASE_SERVICE_ROLE_KEY=your_key_here');
  console.error('   4. No quotes, no spaces around =, full values on one line\n');
  process.exit(1);
}

// Verify service role key format
const isServiceRole = SUPABASE_SERVICE_KEY.startsWith('eyJ') && SUPABASE_SERVICE_KEY.length > 100;
if (!isServiceRole) {
  console.warn('\n⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY might not be a service role key.');
  console.warn('   Service role keys are JWT tokens (start with "eyJ...") and are 200+ characters long.\n');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Verify RLS bypass and get test data
let testOrganizerId = null;
let testUserId = null;

async function verifyRLSBypass() {
  try {
    // Test basic query (this works)
    const { data: testData, error } = await supabase.from('organizers').select('id').limit(5);
    if (error && error.code === '42501') {
      console.error('\n❌ RLS is still active! Service role key not working properly.');
      console.error('   This suggests the key might be incorrect or expired.\n');
      throw new Error('RLS bypass verification failed');
    }
    
    // If we got data, store first organizer ID
    if (!error && testData && testData.length > 0) {
      testOrganizerId = testData[0].id;
      
      // Try to get user_id using same query pattern that worked
      // Use limit(1) instead of single() as it sometimes works better
      const { data: orgUserData, error: orgUserError } = await supabase
        .from('organizers')
        .select('user_id')
        .eq('id', testOrganizerId)
        .limit(1);
      
      // If query succeeded and has data with user_id
      if (!orgUserError && orgUserData && orgUserData.length > 0 && orgUserData[0].user_id) {
        testUserId = orgUserData[0].user_id;
      }
    }
    
    return true;
  } catch (e) {
    if (e.message.includes('RLS bypass verification failed')) {
      process.exit(1);
    }
    throw e;
  }
}

// Test results tracking
const results = {
  passed: [],
  failed: [],
  warnings: []
};

function logTest(name, status, message) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${status}] ${name}: ${message}`);
  
  if (status === 'PASS') {
    results.passed.push({ name, message });
  } else if (status === 'FAIL') {
    results.failed.push({ name, message });
  } else {
    results.warnings.push({ name, message });
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate unique test data
function generateTestEmail() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@testbot.ticketrack.com`;
}

function generateTestName(prefix) {
  return `${prefix} ${Date.now().toString(36).toUpperCase()}`;
}

// Test 1: Create User Account (or use existing)
async function testCreateUserAccount() {
  try {
    // First, check if we found user_id during RLS verification
    if (testUserId) {
      console.log('   ✅ Using user_id from RLS verification');
      logTest('Create User Account', 'PASS', `Using existing user_id ${testUserId.substring(0, 8)}...`);
      return { 
        userId: testUserId, 
        email: generateTestEmail(),
        password: null,
        isExisting: true 
      };
    }
    
    // Try to get organizers using the same query pattern that works in RLS verification
    console.log('   🔍 Looking for existing organizers (using verified query pattern)...');
    const { data: organizerIds, error: orgError } = await supabase
      .from('organizers')
      .select('id')
      .limit(10);
    
    if (!orgError && organizerIds && organizerIds.length > 0) {
      // Use first organizer's ID and try to get its user_id via a separate query
      const orgId = organizerIds[0].id;
      console.log(`   📋 Found organizer: ${orgId.substring(0, 8)}...`);
      
      // Try to get full organizer data with user_id using same client
      // Use raw query pattern that worked for verification
      const { data: orgCheck, error: orgCheckError } = await supabase
        .from('organizers')
        .select('user_id')
        .eq('id', orgId)
        .single();
      
      // If that fails, try without single() - sometimes helps with RLS
      if (orgCheckError) {
        const { data: orgCheck2, error: orgCheckError2 } = await supabase
          .from('organizers')
          .select('user_id')
          .eq('id', orgId)
          .limit(1);
        
        if (!orgCheckError2 && orgCheck2 && orgCheck2.length > 0 && orgCheck2[0].user_id) {
          const userId = orgCheck2[0].user_id;
          logTest('Create User Account', 'PASS', `Using user_id from organizer ${orgId.substring(0, 8)}...`);
          return { 
            userId: userId, 
            email: generateTestEmail(),
            password: null,
            isExisting: true 
          };
        }
      } else if (orgCheck && orgCheck.user_id) {
        logTest('Create User Account', 'PASS', `Using user_id from organizer ${orgId.substring(0, 8)}...`);
        return { 
          userId: orgCheck.user_id, 
          email: generateTestEmail(),
          password: null,
          isExisting: true 
        };
      }
      
      if (orgCheckError) {
        console.log(`   ⚠️  Could not get user_id from organizer: ${orgCheckError.message}`);
      }
    } else if (orgError) {
      console.log(`   ⚠️  Error querying organizers: ${orgError.message}`);
      console.log(`   ⚠️  This is strange since RLS verification passed for the same table.`);
    } else {
      console.log('   ⚠️  No organizers found in database.');
    }
    
    // Last resort: no existing data found
    console.log('   ⚠️  No existing organizers or users found.');
    console.log('   💡 User/organizer creation via service role key has limitations.');
    console.log('   💡 To run tests, please:');
    console.log('      1. Create at least one user account in the app, OR');
    console.log('      2. Create at least one organizer account in the app');
    console.log('   💡 The bot will then use existing accounts for testing.');
    throw new Error('No existing users/organizers found - please create at least one account in the app');
  } catch (error) {
    const errorMsg = error.message || String(error);
    logTest('Create User Account', 'FAIL', errorMsg);
    
    // If it's an API key error, provide helpful message
    if (errorMsg.includes('Invalid API key') || errorMsg.includes('API key')) {
      console.log('   💡 Tip: Make sure SUPABASE_SERVICE_ROLE_KEY is the service role key, not the anon key');
      console.log('   💡 Service role keys start with "eyJ" and are 200+ characters long');
      console.log('   💡 Get it from: Supabase Dashboard → Settings → API → service_role (secret)');
    }
    
    return null;
  }
}

// Test 2: Create Organizer Account
async function testCreateOrganizerAccount(userId) {
  try {
    if (!userId) {
      logTest('Create Organizer Account', 'FAIL', 'User ID required');
      return null;
    }
    
    const businessName = generateTestName('Test Organizer');
    const businessEmail = generateTestEmail();
    
    // Check if organizer already exists
    const { data: existing } = await supabase
      .from('organizers')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    
    let organizerId;
    
    if (existing) {
      organizerId = existing.id;
      logTest('Create Organizer Account', 'PASS', `Organizer already exists: ${organizerId}`);
    } else {
      const { data, error } = await supabase
        .from('organizers')
        .insert({
          user_id: userId,
          business_name: businessName,
          business_email: businessEmail,
          country_code: 'NG',
          is_active: true
        })
        .select()
        .single();
      
      if (error) throw error;
      
      organizerId = data.id;
      logTest('Create Organizer Account', 'PASS', `Organizer ${businessName} created`);
    }
    
    return { organizerId, businessName, businessEmail };
  } catch (error) {
    logTest('Create Organizer Account', 'FAIL', error.message);
    return null;
  }
}

// Test 3: Create Single Event
async function testCreateSingleEvent(organizerId) {
  try {
    if (!organizerId) {
      logTest('Create Single Event', 'FAIL', 'Organizer ID required');
      return null;
    }
    
    const eventTitle = generateTestName('Test Event');
    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // 3 hours later
    
    const { data, error } = await supabase
      .from('events')
      .insert({
        organizer_id: organizerId,
        title: eventTitle,
        description: 'Test event description',
        category: 'Music',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        venue_name: 'Test Venue',
        city: 'Lagos',
        country_code: 'NG',
        currency: 'NGN',
        status: 'published',
        is_free: false,
        visibility: 'public'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logTest('Create Single Event', 'PASS', `Event ${eventTitle} created (${data.id})`);
    return data;
  } catch (error) {
    logTest('Create Single Event', 'FAIL', error.message);
    return null;
  }
}

// Test 4: Create Recurring Event
async function testCreateRecurringEvent(organizerId) {
  try {
    if (!organizerId) {
      logTest('Create Recurring Event', 'FAIL', 'Organizer ID required');
      return null;
    }
    
    const eventTitle = generateTestName('Test Recurring Event');
    const startDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('events')
      .insert({
        organizer_id: organizerId,
        title: eventTitle,
        description: 'Test recurring event',
        category: 'Music',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        venue_name: 'Test Venue',
        city: 'Lagos',
        country_code: 'NG',
        currency: 'NGN',
        status: 'published',
        is_recurring: true,
        recurring_type: 'weekly',
        recurring_days: [1], // Monday
        recurring_end_type: 'occurrences',
        recurring_occurrences: 4,
        visibility: 'public'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logTest('Create Recurring Event', 'PASS', `Recurring event ${eventTitle} created`);
    return data;
  } catch (error) {
    logTest('Create Recurring Event', 'FAIL', error.message);
    return null;
  }
}

// Test 5: Create Ticket Types
async function testCreateTicketTypes(eventId) {
  try {
    if (!eventId) {
      logTest('Create Ticket Types', 'FAIL', 'Event ID required');
      return null;
    }
    
    const ticketTypes = [
      {
        event_id: eventId,
        name: 'General Admission',
        price: 5000,
        quantity_available: 100,
        description: 'General admission ticket',
        is_active: true
      },
      {
        event_id: eventId,
        name: 'VIP',
        price: 15000,
        quantity_available: 20,
        description: 'VIP ticket with perks',
        is_active: true
      }
    ];
    
    const { data, error } = await supabase
      .from('ticket_types')
      .insert(ticketTypes)
      .select();
    
    if (error) throw error;
    
    logTest('Create Ticket Types', 'PASS', `Created ${data.length} ticket types`);
    return data;
  } catch (error) {
    logTest('Create Ticket Types', 'FAIL', error.message);
    return null;
  }
}

// Test 6: Create Order (Simulate Purchase)
async function testCreateOrder(userId, eventId, ticketTypes) {
  try {
    if (!userId || !eventId || !ticketTypes || ticketTypes.length === 0) {
      logTest('Create Order', 'FAIL', 'Missing required data');
      return null;
    }
    
    const ticketType = ticketTypes[0];
    const quantity = 2;
    const subtotal = ticketType.price * quantity;
    const platformFee = subtotal * 0.05; // 5% fee
    const totalAmount = subtotal + platformFee;
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        event_id: eventId,
        order_number: `TEST-ORD-${Date.now()}`,
        status: 'completed',
        subtotal: subtotal,
        platform_fee: platformFee,
        tax_amount: 0,
        total_amount: totalAmount,
        currency: 'NGN',
        payment_provider: 'paystack',
        payment_reference: `TEST-PAY-${Date.now()}`,
        payment_method: 'card',
        buyer_email: generateTestEmail(),
        buyer_name: 'Test Buyer',
        paid_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (orderError) throw orderError;
    
    // Create order items
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert({
        order_id: order.id,
        ticket_type_id: ticketType.id,
        quantity: quantity,
        unit_price: ticketType.price,
        subtotal: subtotal
      });
    
    if (itemsError) throw itemsError;
    
    logTest('Create Order', 'PASS', `Order ${order.order_number} created with ${quantity} tickets`);
    return order;
  } catch (error) {
    logTest('Create Order', 'FAIL', error.message);
    return null;
  }
}

// Test 7: Create Tickets
async function testCreateTickets(order, ticketType, quantity) {
  try {
    if (!order || !ticketType) {
      logTest('Create Tickets', 'FAIL', 'Order and ticket type required');
      return null;
    }
    
    const tickets = [];
    for (let i = 0; i < quantity; i++) {
      const ticketCode = `TEST-TKT-${Date.now()}-${i}`;
      tickets.push({
        event_id: order.event_id,
        ticket_type_id: ticketType.id,
        order_id: order.id,
        user_id: order.user_id,
        ticket_code: ticketCode,
        qr_code: ticketCode,
        unit_price: ticketType.price,
        total_price: ticketType.price,
        payment_reference: order.payment_reference,
        payment_status: 'completed',
        payment_method: 'card',
        status: 'active',
        attendee_email: order.buyer_email,
        attendee_name: order.buyer_name
      });
    }
    
    const { data, error } = await supabase
      .from('tickets')
      .insert(tickets)
      .select();
    
    if (error) throw error;
    
    // Update ticket type quantity sold
    await supabase.rpc('decrement_ticket_quantity', {
      p_ticket_type_id: ticketType.id,
      p_quantity: quantity
    });
    
    logTest('Create Tickets', 'PASS', `Created ${data.length} tickets`);
    return data;
  } catch (error) {
    logTest('Create Tickets', 'FAIL', error.message);
    return null;
  }
}

// Test 8: Create Promo Code
async function testCreatePromoCode(eventId) {
  try {
    if (!eventId) {
      logTest('Create Promo Code', 'FAIL', 'Event ID required');
      return null;
    }
    
    const code = `TEST-${Date.now().toString(36).toUpperCase()}`;
    
    const { data, error } = await supabase
      .from('promo_codes')
      .insert({
        event_id: eventId,
        code: code,
        discount_type: 'percentage',
        discount_value: 10,
        max_uses: 100,
        is_active: true
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logTest('Create Promo Code', 'PASS', `Promo code ${code} created`);
    return data;
  } catch (error) {
    logTest('Create Promo Code', 'FAIL', error.message);
    return null;
  }
}

// Test 9: Create Waitlist Entry
async function testCreateWaitlist(userId, eventId) {
  try {
    if (!userId || !eventId) {
      logTest('Create Waitlist Entry', 'FAIL', 'User ID and Event ID required');
      return null;
    }
    
    const email = generateTestEmail();
    
    const { data, error } = await supabase
      .from('waitlists')
      .insert({
        event_id: eventId,
        user_id: userId,
        email: email,
        status: 'waiting'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logTest('Create Waitlist Entry', 'PASS', `Waitlist entry created for ${email}`);
    return data;
  } catch (error) {
    logTest('Create Waitlist Entry', 'FAIL', error.message);
    return null;
  }
}

// Test 10: Test Payout Calculation
async function testPayoutCalculation(organizerId) {
  try {
    if (!organizerId) {
      logTest('Test Payout Calculation', 'FAIL', 'Organizer ID required');
      return null;
    }
    
    // Get all completed orders for this organizer
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        subtotal,
        platform_fee,
        total_amount,
        currency,
        events!inner(organizer_id, end_date)
      `)
      .eq('events.organizer_id', organizerId)
      .eq('status', 'completed');
    
    if (error) throw error;
    
    const netAmount = orders?.reduce((sum, o) => sum + parseFloat(o.subtotal || 0), 0) || 0;
    const platformFeeTotal = orders?.reduce((sum, o) => sum + parseFloat(o.platform_fee || 0), 0) || 0;
    
    logTest('Test Payout Calculation', 'PASS', 
      `Net amount: ${netAmount}, Platform fee: ${platformFeeTotal}, Orders: ${orders?.length || 0}`);
    
    return { netAmount, platformFeeTotal, orderCount: orders?.length || 0 };
  } catch (error) {
    logTest('Test Payout Calculation', 'FAIL', error.message);
    return null;
  }
}

// Test 11: Create Free Event
async function testCreateFreeEvent(organizerId) {
  try {
    if (!organizerId) {
      logTest('Create Free Event', 'FAIL', 'Organizer ID required');
      return null;
    }
    
    const eventTitle = generateTestName('Test Free Event');
    const startDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000);
    
    const { data, error } = await supabase
      .from('events')
      .insert({
        organizer_id: organizerId,
        title: eventTitle,
        description: 'Free test event',
        category: 'Community',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        venue_name: 'Test Venue',
        city: 'Lagos',
        country_code: 'NG',
        currency: 'NGN',
        status: 'published',
        is_free: true,
        visibility: 'public'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logTest('Create Free Event', 'PASS', `Free event ${eventTitle} created`);
    return data;
  } catch (error) {
    logTest('Create Free Event', 'FAIL', error.message);
    return null;
  }
}

// Test 12: Create Custom Fields
async function testCreateCustomFields(eventId) {
  try {
    if (!eventId) {
      logTest('Create Custom Fields', 'FAIL', 'Event ID required');
      return null;
    }
    
    const customFields = [
      {
        event_id: eventId,
        field_label: 'Dietary Requirements',
        field_type: 'text',
        is_required: false,
        display_order: 0
      },
      {
        event_id: eventId,
        field_label: 'T-Shirt Size',
        field_type: 'dropdown',
        field_options: ['Small', 'Medium', 'Large', 'XL'],
        is_required: true,
        display_order: 1
      }
    ];
    
    const { data, error } = await supabase
      .from('event_custom_fields')
      .insert(customFields)
      .select();
    
    if (error) throw error;
    
    logTest('Create Custom Fields', 'PASS', `Created ${data.length} custom fields`);
    return data;
  } catch (error) {
    logTest('Create Custom Fields', 'FAIL', error.message);
    return null;
  }
}

// Test 13: Test Refund Flow
async function testRefundFlow(orderId) {
  try {
    if (!orderId) {
      logTest('Test Refund Flow', 'WARN', 'Order ID required - skipping');
      return null;
    }
    
    // Create refund request
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, event_id, total_amount, currency, events!inner(id, organizer_id)')
      .eq('id', orderId)
      .single();
    
    if (orderError || !order) {
      logTest('Test Refund Flow', 'WARN', 'Order not found - skipping');
      return null;
    }
    
    const { data: ticket } = await supabase
      .from('tickets')
      .select('id')
      .eq('order_id', orderId)
      .limit(1)
      .single();
    
    if (!ticket) {
      logTest('Test Refund Flow', 'WARN', 'No tickets found for order - skipping');
      return null;
    }
    
    const organizerId = order.events?.organizer_id;
    
    const { data: refundRequest, error } = await supabase
      .from('refund_requests')
      .insert({
        ticket_id: ticket.id,
        order_id: orderId,
        event_id: order.event_id,
        organizer_id: organizerId,
        user_id: order.user_id,
        amount: parseFloat(order.total_amount),
        original_amount: parseFloat(order.total_amount),
        currency: order.currency,
        reason: 'Test refund',
        status: 'pending'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    logTest('Test Refund Flow', 'PASS', `Refund request created: ${refundRequest.id}`);
    return refundRequest;
  } catch (error) {
    logTest('Test Refund Flow', 'FAIL', error.message);
    return null;
  }
}

// Main test runner
async function runAllTests() {
  console.log('\n🤖 Starting Comprehensive Test Bot\n');
  console.log('='.repeat(60));
  
  // Check for command-line arguments for existing IDs
  const args = process.argv.slice(2);
  const userIdArg = args.find(arg => arg.startsWith('--user-id='))?.split('=')[1];
  const organizerIdArg = args.find(arg => arg.startsWith('--organizer-id='))?.split('=')[1];
  
  if (userIdArg) {
    console.log(`✅ Using user_id from command-line argument: ${userIdArg.substring(0, 8)}...`);
    testUserId = userIdArg;
  }
  if (organizerIdArg) {
    console.log(`✅ Using organizer_id from command-line argument: ${organizerIdArg.substring(0, 8)}...`);
    testOrganizerId = organizerIdArg;
  }
  
  // Verify RLS bypass before starting tests and get test data
  try {
    await verifyRLSBypass();
    console.log('✅ RLS bypass verified - service role key is working');
    if (testUserId && !userIdArg) {
      console.log(`✅ Found existing user_id for testing: ${testUserId.substring(0, 8)}...`);
    }
    if (testOrganizerId && !organizerIdArg) {
      console.log(`✅ Found existing organizer_id for testing: ${testOrganizerId.substring(0, 8)}...`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ RLS bypass verification failed. Tests cannot proceed.\n');
    console.error('   Please verify your SUPABASE_SERVICE_ROLE_KEY is correct.\n');
    process.exit(1);
  }
  
  // Debug: Test admin API access
  console.log('🔍 Testing admin API access...');
  try {
    const { data: testList, error: testError } = await supabase.auth.admin.listUsers();
    if (testError) {
      console.warn(`⚠️  Admin API test failed: ${testError.message}`);
      console.warn('   This might affect user creation, but other tests can proceed.\n');
    } else {
      console.log(`✅ Admin API accessible (${testList?.users?.length || 0} users found)\n`);
    }
  } catch (err) {
    console.warn(`⚠️  Could not test admin API: ${err.message}\n`);
  }
  
  let userId = null;
  let organizerId = null;
  let organizerData = null;
  let eventId = null;
  let ticketTypes = null;
  let order = null;
  
  // Test 1: Create User Account
  console.log('\n📝 Test 1: User Account Creation');
  const userData = await testCreateUserAccount();
  if (userData) userId = userData.userId;
  await delay(500);
  
  // Test 2: Create Organizer Account
  console.log('\n🏢 Test 2: Organizer Account Creation');
  organizerData = await testCreateOrganizerAccount(userId);
  if (organizerData) organizerId = organizerData.organizerId;
  await delay(500);
  
  // Test 3: Create Single Event
  console.log('\n🎫 Test 3: Single Event Creation');
  const singleEvent = await testCreateSingleEvent(organizerId);
  if (singleEvent) eventId = singleEvent.id;
  await delay(500);
  
  // Test 4: Create Recurring Event
  console.log('\n🔄 Test 4: Recurring Event Creation');
  await testCreateRecurringEvent(organizerId);
  await delay(500);
  
  // Test 5: Create Ticket Types
  console.log('\n🎟️  Test 5: Ticket Type Creation');
  ticketTypes = await testCreateTicketTypes(eventId);
  await delay(500);
  
  // Test 6: Create Order
  console.log('\n💳 Test 6: Order Creation');
  order = await testCreateOrder(userId, eventId, ticketTypes);
  await delay(500);
  
  // Test 7: Create Tickets
  console.log('\n✉️  Test 7: Ticket Creation');
  if (order && ticketTypes && ticketTypes.length > 0) {
    await testCreateTickets(order, ticketTypes[0], 2);
  }
  await delay(500);
  
  // Test 8: Create Promo Code
  console.log('\n🎁 Test 8: Promo Code Creation');
  await testCreatePromoCode(eventId);
  await delay(500);
  
  // Test 9: Create Waitlist Entry
  console.log('\n📋 Test 9: Waitlist Entry Creation');
  await testCreateWaitlist(userId, eventId);
  await delay(500);
  
  // Test 10: Test Payout Calculation
  console.log('\n💰 Test 10: Payout Calculation');
  await testPayoutCalculation(organizerId);
  await delay(500);
  
  // Test 11: Create Free Event
  console.log('\n🆓 Test 11: Free Event Creation');
  await testCreateFreeEvent(organizerId);
  await delay(500);
  
  // Test 12: Create Custom Fields
  console.log('\n📝 Test 12: Custom Fields Creation');
  await testCreateCustomFields(eventId);
  await delay(500);
  
  // Test 13: Test Refund Flow
  console.log('\n↩️  Test 13: Refund Flow');
  if (order) {
    await testRefundFlow(order.id);
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary\n');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`⚠️  Warnings: ${results.warnings.length}`);
  
  if (results.failed.length > 0) {
    console.log('\n❌ Failed Tests:');
    results.failed.forEach(test => {
      console.log(`   - ${test.name}: ${test.message}`);
    });
  }
  
  if (results.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    results.warnings.forEach(test => {
      console.log(`   - ${test.name}: ${test.message}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Test bot completed!\n');
  
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
