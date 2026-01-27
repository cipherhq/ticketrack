/**
 * Fix Orders Without Tickets
 *
 * Detects and fixes completed orders that have order_items but no tickets.
 * This can happen when webhooks fail or edge functions crash.
 *
 * Usage:
 *   node scripts/fix-orders-without-tickets.js              # Dry run - report only
 *   node scripts/fix-orders-without-tickets.js --fix        # Fix all orphaned orders
 *   node scripts/fix-orders-without-tickets.js --fix --order <id>  # Fix specific order
 *
 * Prerequisites:
 *   - SUPABASE_SERVICE_ROLE_KEY environment variable must be set
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bkvbvggngttrizbchygy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=your-key node scripts/fix-orders-without-tickets.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const orderIdArg = args.indexOf('--order');
const SPECIFIC_ORDER_ID = orderIdArg !== -1 ? args[orderIdArg + 1] : null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateTicketCode() {
  return "TKT" + Date.now().toString(36).toUpperCase() +
         Math.random().toString(36).substring(2, 8).toUpperCase();
}

function formatCurrency(amount, currency) {
  return `${currency} ${parseFloat(amount).toLocaleString()}`;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function findOrphanedOrders() {
  console.log('\nSearching for completed orders without tickets...\n');

  // Build query
  let query = supabase
    .from('orders')
    .select(`
      id,
      order_number,
      user_id,
      event_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      status,
      total_amount,
      currency,
      payment_reference,
      payment_method,
      payment_provider,
      created_at,
      paid_at,
      events(title),
      order_items(id, ticket_type_id, quantity, unit_price, ticket_types(name))
    `)
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  // Filter by specific order if provided
  if (SPECIFIC_ORDER_ID) {
    query = query.eq('id', SPECIFIC_ORDER_ID);
  }

  const { data: completedOrders, error: ordersError } = await query;

  if (ordersError) {
    console.error('Error fetching orders:', ordersError);
    process.exit(1);
  }

  if (!completedOrders || completedOrders.length === 0) {
    console.log('No completed orders found.');
    return [];
  }

  console.log(`Found ${completedOrders.length} completed orders. Checking for missing tickets...\n`);

  const orphanedOrders = [];

  for (const order of completedOrders) {
    // Skip orders with no order_items
    if (!order.order_items || order.order_items.length === 0) {
      continue;
    }

    // Check if tickets exist for this order
    const { count, error: countError } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id);

    if (countError) {
      console.error(`Error checking tickets for order ${order.id}:`, countError);
      continue;
    }

    // If no tickets exist, this is an orphaned order
    if (count === 0) {
      orphanedOrders.push(order);
    }
  }

  return orphanedOrders;
}

async function reportOrphanedOrders(orders) {
  if (orders.length === 0) {
    console.log('No orphaned orders found. All completed orders have tickets.');
    return;
  }

  console.log('=' .repeat(80));
  console.log(`ORPHANED ORDERS FOUND: ${orders.length}`);
  console.log('=' .repeat(80));

  for (const order of orders) {
    const totalTickets = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

    console.log(`\nOrder ID: ${order.id}`);
    console.log(`  Order Number: ${order.order_number}`);
    console.log(`  Event: ${order.events?.title || 'Unknown'}`);
    console.log(`  Buyer: ${order.buyer_name} <${order.buyer_email}>`);
    console.log(`  Amount: ${formatCurrency(order.total_amount, order.currency)}`);
    console.log(`  Payment: ${order.payment_provider || 'unknown'} (${order.payment_reference || 'no ref'})`);
    console.log(`  Created: ${new Date(order.created_at).toLocaleString()}`);
    console.log(`  Order Items: ${order.order_items.length} types, ${totalTickets} tickets total`);

    for (const item of order.order_items) {
      console.log(`    - ${item.ticket_types?.name || 'Unknown'}: ${item.quantity} x ${formatCurrency(item.unit_price, order.currency)}`);
    }
  }

  console.log('\n' + '=' .repeat(80));
  console.log(`To fix these orders, run: node scripts/fix-orders-without-tickets.js --fix`);
  console.log('=' .repeat(80) + '\n');
}

async function createTicketsForOrder(order) {
  const ticketsToCreate = [];

  for (const item of order.order_items) {
    for (let i = 0; i < item.quantity; i++) {
      const ticketCode = generateTicketCode();
      ticketsToCreate.push({
        event_id: order.event_id,
        ticket_type_id: item.ticket_type_id,
        user_id: order.user_id,
        attendee_email: order.buyer_email,
        attendee_name: order.buyer_name,
        attendee_phone: order.buyer_phone || null,
        ticket_code: ticketCode,
        qr_code: ticketCode,
        unit_price: item.unit_price,
        total_price: item.unit_price,
        payment_reference: order.payment_reference,
        payment_status: "completed",
        payment_method: order.payment_method || order.payment_provider || "card",
        order_id: order.id,
        status: "active",
      });
    }
  }

  // Insert tickets
  const { data: newTickets, error: ticketError } = await supabase
    .from('tickets')
    .insert(ticketsToCreate)
    .select();

  if (ticketError) {
    console.error(`  ERROR creating tickets for order ${order.id}:`, ticketError.message);
    return { success: false, error: ticketError };
  }

  console.log(`  Created ${newTickets.length} tickets`);

  // Decrement ticket quantities
  for (const item of order.order_items) {
    const { error: rpcError } = await supabase.rpc('decrement_ticket_quantity', {
      p_ticket_type_id: item.ticket_type_id,
      p_quantity: item.quantity,
    });

    if (rpcError) {
      console.warn(`  Warning: Failed to decrement quantity for ticket type ${item.ticket_type_id}:`, rpcError.message);
    }
  }

  return { success: true, tickets: newTickets };
}

async function fixOrphanedOrders(orders) {
  console.log('\n' + '=' .repeat(80));
  console.log(`FIXING ${orders.length} ORPHANED ORDERS`);
  console.log('=' .repeat(80) + '\n');

  let successCount = 0;
  let failCount = 0;

  for (const order of orders) {
    const totalTickets = order.order_items.reduce((sum, item) => sum + item.quantity, 0);

    console.log(`\nProcessing: ${order.order_number} (${order.id})`);
    console.log(`  Event: ${order.events?.title || 'Unknown'}`);
    console.log(`  Buyer: ${order.buyer_name} <${order.buyer_email}>`);
    console.log(`  Expected tickets: ${totalTickets}`);

    const result = await createTicketsForOrder(order);

    if (result.success) {
      successCount++;
      console.log(`  SUCCESS: Order fixed`);
    } else {
      failCount++;
      console.log(`  FAILED: ${result.error?.message || 'Unknown error'}`);
    }
  }

  console.log('\n' + '=' .repeat(80));
  console.log('SUMMARY');
  console.log('=' .repeat(80));
  console.log(`Total orders processed: ${orders.length}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log('=' .repeat(80) + '\n');
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          FIX ORDERS WITHOUT TICKETS                            ║');
  console.log('╠════════════════════════════════════════════════════════════════╣');
  if (FIX_MODE) {
    console.log('║  Mode: FIX - Will create missing tickets                       ║');
  } else {
    console.log('║  Mode: DRY RUN - Report only, no changes                       ║');
  }
  if (SPECIFIC_ORDER_ID) {
    console.log(`║  Target: Order ${SPECIFIC_ORDER_ID.substring(0, 36)}... ║`);
  } else {
    console.log('║  Target: All completed orders                                  ║');
  }
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    // Find orphaned orders
    const orphanedOrders = await findOrphanedOrders();

    if (orphanedOrders.length === 0) {
      console.log('\nNo orphaned orders found. All completed orders have tickets.\n');
      process.exit(0);
    }

    if (FIX_MODE) {
      await fixOrphanedOrders(orphanedOrders);
    } else {
      await reportOrphanedOrders(orphanedOrders);
    }

  } catch (error) {
    console.error('\nScript failed:', error);
    process.exit(1);
  }
}

main();
