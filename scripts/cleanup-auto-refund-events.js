#!/usr/bin/env node
/**
 * Cleanup Script - Delete All Auto-Refund Test Events
 * 
 * This script deletes all test events created by the auto-refund test bot.
 * It finds events by title pattern "Auto-Refund Test" or slug pattern "test-auto-refund-"
 * 
 * Usage: node scripts/cleanup-auto-refund-events.js
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
  if (!existsSync(filePath)) return;
  
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = trimmed.substring(0, equalIndex).trim();
      const value = trimmed.substring(equalIndex + 1).trim().replace(/^["']|["']$/g, '');
      
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch (e) {
    console.log(`   ⚠️  Error reading ${filePath}: ${e.message}`);
  }
}

// Load environment variables
const envLocalPath = join(__dirname, '../.env.local');
const envPath = join(__dirname, '../.env');

loadEnvFile(envLocalPath);
loadEnvFile(envPath);

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - VITE_SUPABASE_URL or SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function cleanupAutoRefundEvents() {
  console.log('\n🧹 Starting Auto-Refund Test Events Cleanup\n');
  console.log('='.repeat(60));
  
  // Verify connection
  console.log('🔍 Verifying database connection...');
  const { error: testError } = await supabase.from('events').select('id').limit(1);
  if (testError) {
    if (testError.message.includes('Invalid API key')) {
      console.error('\n❌ Invalid API key error.');
      console.error('   This script requires SUPABASE_SERVICE_ROLE_KEY to delete events.');
      console.error('   Please check your .env.local file and ensure the key is correct.\n');
      process.exit(1);
    }
    throw testError;
  }
  console.log('✅ Database connection verified\n');
  
  try {
    // Find all events matching auto-refund test patterns
    console.log('🔍 Searching for auto-refund test events...');
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title, slug, organizer_id, is_recurring')
      .or('title.ilike.%Auto-Refund Test%,slug.ilike.test-auto-refund-%');
    
    if (eventsError) {
      throw eventsError;
    }
    
    if (!events || events.length === 0) {
      console.log('✅ No auto-refund test events found to delete.\n');
      return;
    }
    
    console.log(`📋 Found ${events.length} auto-refund test event(s) to delete:\n`);
    
    // Show what will be deleted
    events.forEach((event, index) => {
      console.log(`   ${index + 1}. ${event.title || 'Untitled'} (${event.id.substring(0, 8)}...)`);
      console.log(`      Slug: ${event.slug || 'N/A'}`);
      console.log(`      Recurring: ${event.is_recurring ? 'Yes' : 'No'}\n`);
    });
    
    // Get all event IDs (including child events if recurring)
    const eventIds = events.map(e => e.id);
    const recurringEventIds = events.filter(e => e.is_recurring).map(e => e.id);
    
    // Find child events for recurring events
    let childEventIds = [];
    if (recurringEventIds.length > 0) {
      const { data: childEvents, error: childError } = await supabase
        .from('events')
        .select('id, title')
        .in('parent_event_id', recurringEventIds);
      
      if (!childError && childEvents) {
        childEventIds = childEvents.map(e => e.id);
        console.log(`📋 Found ${childEventIds.length} child event(s) to delete:\n`);
        childEvents.forEach((event, index) => {
          console.log(`   ${index + 1}. ${event.title || 'Untitled'} (${event.id.substring(0, 8)}...)\n`);
        });
      }
    }
    
    const allEventIds = [...eventIds, ...childEventIds];
    
    if (allEventIds.length === 0) {
      console.log('✅ No events to delete.\n');
      return;
    }
    
    console.log(`\n🗑️  Deleting ${allEventIds.length} event(s) and related data...\n`);
    
    // Delete in order: tickets, ticket_types, orders, refund_requests, then events
    
    // 1. Delete tickets
    const { error: ticketsError } = await supabase
      .from('tickets')
      .delete()
      .in('event_id', allEventIds);
    
    if (ticketsError) {
      console.warn(`   ⚠️  Error deleting tickets: ${ticketsError.message}`);
    } else {
      console.log('   ✅ Deleted tickets');
    }
    
    // 2. Delete ticket types
    const { error: ticketTypesError } = await supabase
      .from('ticket_types')
      .delete()
      .in('event_id', allEventIds);
    
    if (ticketTypesError) {
      console.warn(`   ⚠️  Error deleting ticket types: ${ticketTypesError.message}`);
    } else {
      console.log('   ✅ Deleted ticket types');
    }
    
    // 3. Delete order items (for orders related to these events)
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .in('event_id', allEventIds);
    
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      
      const { error: orderItemsError } = await supabase
        .from('order_items')
        .delete()
        .in('order_id', orderIds);
      
      if (orderItemsError) {
        console.warn(`   ⚠️  Error deleting order items: ${orderItemsError.message}`);
      } else {
        console.log('   ✅ Deleted order items');
      }
    }
    
    // 4. Delete orders
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .in('id', orderIds);
      
      if (ordersError) {
        console.warn(`   ⚠️  Error deleting orders: ${ordersError.message}`);
      } else {
        console.log(`   ✅ Deleted ${orders.length} order(s)`);
      }
    }
    
    // 5. Delete refund requests (related to deleted orders)
    if (orders && orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      
      const { error: refundsError } = await supabase
        .from('refund_requests')
        .delete()
        .in('order_id', orderIds);
      
      if (refundsError) {
        console.warn(`   ⚠️  Error deleting refund requests: ${refundsError.message}`);
      } else {
        console.log('   ✅ Deleted refund requests');
      }
    }
    
    // 6. Delete child events first (if any)
    if (childEventIds.length > 0) {
      const { error: childEventsError } = await supabase
        .from('events')
        .delete()
        .in('id', childEventIds);
      
      if (childEventsError) {
        console.warn(`   ⚠️  Error deleting child events: ${childEventsError.message}`);
      } else {
        console.log(`   ✅ Deleted ${childEventIds.length} child event(s)`);
      }
    }
    
    // 7. Finally, delete parent events
    const { error: eventsDeleteError } = await supabase
      .from('events')
      .delete()
      .in('id', eventIds);
    
    if (eventsDeleteError) {
      throw eventsDeleteError;
    }
    
    console.log(`   ✅ Deleted ${eventIds.length} parent event(s)`);
    
    console.log('\n' + '='.repeat(60));
    console.log(`\n✨ Cleanup completed successfully!`);
    console.log(`   Deleted ${allEventIds.length} event(s) and all related data.\n`);
    
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

cleanupAutoRefundEvents();
