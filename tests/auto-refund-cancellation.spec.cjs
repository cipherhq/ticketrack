const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase client for direct database operations
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://bkvbvggngttrizbchygy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TEST_USER_ID = process.env.TEST_USER_ID; // Required: a valid user_id from auth.users

// Skip entire suite if no service role key or test user ID available
// This test requires:
// 1. SUPABASE_SERVICE_ROLE_KEY - for admin database access
// 2. TEST_USER_ID - a valid user ID to link the test organizer to
const hasRequiredEnv = !!SUPABASE_SERVICE_KEY && !!TEST_USER_ID;

// Only create client if we have the key
const supabase = hasRequiredEnv
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  : null;

// Use test.describe.skip to skip entire suite when missing required env
const describeFn = hasRequiredEnv ? test.describe : test.describe.skip;

describeFn('Auto-Refund on Event Cancellation', () => {
  let testOrganizerId;
  let testEventId;
  let testChildEventId;
  let testOrderId;
  let testTicketIds = [];
  let testUserId;

  // Setup: Create test organizer and user
  test.beforeAll(async () => {
    // Create or get test organizer
    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .select('id')
      .eq('business_email', 'test-auto-refund@ticketrack.test')
      .single();

    if (organizer) {
      testOrganizerId = organizer.id;
    } else {
      // Create test organizer with required user_id
      const { data: newOrg, error: createError } = await supabase
        .from('organizers')
        .insert({
          user_id: TEST_USER_ID,
          business_name: 'Test Auto-Refund Organizer',
          business_email: 'test-auto-refund@ticketrack.test',
          email: 'test-auto-refund@ticketrack.test',
          country_code: 'NG',
        })
        .select('id')
        .single();

      if (createError) throw createError;
      testOrganizerId = newOrg.id;
    }

    // Create or get test user
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', 'test-buyer@ticketrack.test')
      .single();

    if (user) {
      testUserId = user.id;
    } else {
      // Note: In real scenario, you'd create auth user first
      // For testing, we'll use a mock user ID
      testUserId = '00000000-0000-0000-0000-000000000001';
    }
  });

  // Cleanup: Remove test data
  test.afterAll(async () => {
    if (testTicketIds.length > 0) {
      await supabase.from('tickets').delete().in('id', testTicketIds);
    }
    if (testOrderId) {
      await supabase.from('orders').delete().eq('id', testOrderId);
    }
    if (testChildEventId) {
      await supabase.from('events').delete().eq('id', testChildEventId);
    }
    if (testEventId) {
      await supabase.from('events').delete().eq('id', testEventId);
    }
  });

  test('should automatically refund tickets when child event is cancelled', async ({ page }) => {
    // Step 1: Create a recurring event
    console.log('📅 Creating recurring event...');
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const futureDateTime = `${futureDateStr}T18:00:00`;

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        organizer_id: testOrganizerId,
        title: 'Test Auto-Refund Event',
        slug: `test-auto-refund-${Date.now()}`,
        description: 'Test event for auto-refund functionality',
        event_type: 'concert',
        category: 'music',
        start_date: futureDateTime,
        end_date: `${futureDateStr}T22:00:00`,
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
        city: 'Lagos',
        country_code: 'NG',
        currency: 'NGN',
        status: 'published',
        is_recurring: true,
        recurring_type: 'weekly',
        recurring_days: [1], // Monday
        recurring_end_type: 'date',
        recurring_end_date: `${futureDateStr}T23:59:59`,
      })
      .select('id')
      .single();

    if (eventError) throw eventError;
    testEventId = event.id;
    console.log('✅ Event created:', testEventId);

    // Step 2: Create ticket types
    const { data: ticketType, error: ticketTypeError } = await supabase
      .from('ticket_types')
      .insert({
        event_id: testEventId,
        name: 'General Admission',
        price: 5000, // 50 NGN
        quantity_available: 10,
        is_active: true,
      })
      .select('id')
      .single();

    if (ticketTypeError) throw ticketTypeError;
    console.log('✅ Ticket type created:', ticketType.id);

    // Step 3: Generate child event (simulate future date purchase)
    const childEventDate = new Date(futureDate);
    childEventDate.setDate(childEventDate.getDate() + 7); // Next week
    const childEventDateStr = childEventDate.toISOString().split('T')[0];
    const childEventDateTime = `${childEventDateStr}T18:00:00`;

    const { data: childEvent, error: childEventError } = await supabase
      .from('events')
      .insert({
        organizer_id: testOrganizerId,
        parent_event_id: testEventId,
        title: 'Test Auto-Refund Event',
        slug: `test-auto-refund-${childEventDateStr}`,
        description: 'Test event for auto-refund functionality',
        event_type: 'concert',
        category: 'music',
        start_date: childEventDateTime,
        end_date: `${childEventDateStr}T22:00:00`,
        venue_name: 'Test Venue',
        venue_address: '123 Test St',
        city: 'Lagos',
        country_code: 'NG',
        currency: 'NGN',
        status: 'published',
        is_recurring: false,
      })
      .select('id')
      .single();

    if (childEventError) throw childEventError;
    testChildEventId = childEvent.id;
    console.log('✅ Child event created:', testChildEventId);

    // Create ticket type for child event
    const { data: childTicketType, error: childTicketTypeError } = await supabase
      .from('ticket_types')
      .insert({
        event_id: testChildEventId,
        name: 'General Admission',
        price: 5000,
        quantity_available: 10,
        quantity_sold: 0,
        is_active: true,
      })
      .select('id')
      .single();

    if (childTicketTypeError) throw childTicketTypeError;
    console.log('✅ Child ticket type created:', childTicketType.id);

    // Step 4: Create a completed order (simulate purchase)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id: testChildEventId,
        user_id: testUserId,
        organizer_id: testOrganizerId,
        buyer_name: 'Test Buyer',
        buyer_email: 'test-buyer@ticketrack.test',
        buyer_phone: '+2341234567890',
        subtotal: 5000,
        platform_fee: 250,
        total_amount: 5250,
        currency: 'NGN',
        status: 'completed',
        payment_provider: 'paystack',
        payment_reference: `TEST-REF-${Date.now()}`,
        payment_method: 'card',
        country_code: 'NG',
      })
      .select('id')
      .single();

    if (orderError) throw orderError;
    testOrderId = order.id;
    console.log('✅ Order created:', testOrderId);

    // Step 5: Create tickets for the order
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .insert([
        {
          order_id: testOrderId,
          event_id: testChildEventId,
          user_id: testUserId,
          ticket_type_id: childTicketType.id,
          attendee_name: 'Test Buyer',
          attendee_email: 'test-buyer@ticketrack.test',
          ticket_code: `TKT-TEST-${Date.now()}-1`,
          unit_price: 5000,
          total_price: 5000,
          status: 'active',
          payment_status: 'completed',
        },
      ])
      .select('id');

    if (ticketsError) throw ticketsError;
    testTicketIds = tickets.map(t => t.id);
    console.log('✅ Tickets created:', testTicketIds);

    // Update ticket type quantity_sold
    await supabase
      .from('ticket_types')
      .update({ quantity_sold: 1 })
      .eq('id', childTicketType.id);

    // Step 6: Cancel the child event (this should trigger auto-refund)
    console.log('🚫 Cancelling child event...');
    const { error: cancelError } = await supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', testChildEventId);

    if (cancelError) throw cancelError;
    console.log('✅ Event cancelled');

    // Step 7: Trigger auto-refund function
    console.log('💰 Triggering auto-refund...');
    const { data: refundResult, error: refundError } = await supabase.functions.invoke('auto-refund-on-cancellation', {
      body: {
        eventId: testChildEventId,
        reason: 'Test cancellation - automated test',
        organizerId: testOrganizerId,
      },
    });

    if (refundError) {
      console.error('❌ Refund error:', refundError);
      // Don't throw - let's check what happened
    } else {
      console.log('✅ Refund function called:', refundResult);
    }

    // Wait a bit for async processing
    await page.waitForTimeout(3000);

    // Step 8: Verify refund was processed
    console.log('🔍 Verifying refund...');

    // Check refund requests
    const { data: refundRequests, error: refundReqError } = await supabase
      .from('refund_requests')
      .select('*')
      .eq('event_id', testChildEventId)
      .eq('order_id', testOrderId)
      .order('created_at', { ascending: false });

    if (refundReqError) throw refundReqError;

    expect(refundRequests).toBeTruthy();
    expect(refundRequests.length).toBeGreaterThan(0);
    console.log('✅ Refund request created:', refundRequests[0]?.id);

    const refundRequest = refundRequests[0];
    expect(refundRequest.status).toBe('processed');
    expect(refundRequest.refund_reference).toBeTruthy();
    expect(refundRequest.amount).toBe(5250); // Full order amount

    // Check order status
    const { data: updatedOrder, error: orderCheckError } = await supabase
      .from('orders')
      .select('status, notes')
      .eq('id', testOrderId)
      .single();

    if (orderCheckError) throw orderCheckError;
    expect(updatedOrder.status).toBe('refunded');
    expect(updatedOrder.notes).toContain('cancellation');
    console.log('✅ Order marked as refunded');

    // Check ticket status
    const { data: updatedTickets, error: ticketsCheckError } = await supabase
      .from('tickets')
      .select('status, payment_status, refunded_at, refund_reason')
      .in('id', testTicketIds);

    if (ticketsCheckError) throw ticketsCheckError;
    expect(updatedTickets.length).toBeGreaterThan(0);

    for (const ticket of updatedTickets) {
      expect(ticket.status).toBe('cancelled');
      expect(ticket.payment_status).toBe('refunded');
      expect(ticket.refunded_at).toBeTruthy();
      expect(ticket.refund_reason).toContain('cancellation');
    }
    console.log('✅ All tickets marked as refunded');

    console.log('🎉 Auto-refund test PASSED!');
  });

  test('should handle series cancellation with multiple child events', async () => {
    // Similar test but for cancelling entire series
    // This would test cancelSeries() functionality
    console.log('📋 Series cancellation test - TODO: Implement if needed');
  });
});
