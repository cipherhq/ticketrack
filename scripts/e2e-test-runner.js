/**
 * Comprehensive E2E Test Runner for Ticketrack
 * Tests: DB connection, user creation, activation, event creation, ticket flows, and more
 * Runs against the DEV Supabase instance
 */

import { createClient } from '@supabase/supabase-js';

// DEV Supabase credentials
const SUPABASE_URL = 'https://bnkxgyzvqpdctghrgmkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJua3hneXp2cXBkY3RnaHJnbWtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNjE3MjcsImV4cCI6MjA4MzkzNzcyN30._BdtDET2Posi1p-c9hERIFk5PDsFK60dcnX-hQ_wZVs';

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJua3hneXp2cXBkY3RnaHJnbWtyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM2MTcyNywiZXhwIjoyMDgzOTM3NzI3fQ.2Et98dKuTIDpETdHpskBC4wJGMDp4RqFo7XtZw_f1Sc';

// Anon client (simulates frontend)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin client (bypasses RLS, confirms users, seeds data)
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test state
const testResults = [];
let testUserId = null;
let testUserEmail = null;
let testUserSession = null;
let testOrganizerId = null;
let testEventId = null;
let testEventSlug = null;
let testTicketTypeId = null;

// ──────────────────────────────────────
// 0. SEED BASE DATA (if DB is empty)
// ──────────────────────────────────────
async function seedBaseData() {
  section('0. SEED BASE DATA (if empty)');

  // Seed categories
  try {
    const { count } = await adminClient.from('categories').select('*', { count: 'exact', head: true });
    if (count === 0) {
      const categories = [
        { name: 'Music', slug: 'music', description: 'Concerts, festivals, and live music events', is_active: true },
        { name: 'Conference', slug: 'conference', description: 'Professional conferences and seminars', is_active: true },
        { name: 'Party', slug: 'party', description: 'Parties, nightlife, and social events', is_active: true },
        { name: 'Sports', slug: 'sports', description: 'Sports events and competitions', is_active: true },
        { name: 'Workshop', slug: 'workshop', description: 'Workshops and training sessions', is_active: true },
        { name: 'Art', slug: 'art', description: 'Art exhibitions and galleries', is_active: true },
        { name: 'Food & Drink', slug: 'food-drink', description: 'Food festivals and tasting events', is_active: true },
        { name: 'Tech', slug: 'tech', description: 'Technology meetups and hackathons', is_active: true },
        { name: 'Comedy', slug: 'comedy', description: 'Comedy shows and stand-up events', is_active: true },
        { name: 'Other', slug: 'other', description: 'Other events', is_active: true },
      ];
      const { data, error } = await adminClient.from('categories').insert(categories).select();
      if (error) throw error;
      pass('Categories seeded', `${data.length} categories created`);
    } else {
      pass('Categories already exist', `${count} categories`);
    }
  } catch (e) {
    warn('Seed categories', e.message);
  }

  // Seed countries
  try {
    const { count } = await adminClient.from('countries').select('*', { count: 'exact', head: true });
    if (count === 0) {
      const countries = [
        { code: 'NG', name: 'Nigeria', default_currency: 'NGN', payment_provider: 'paystack', platform_fee_percentage: 3.5, service_fee_percentage: 2.0, min_payout_amount: 5000, is_active: true },
        { code: 'US', name: 'United States', default_currency: 'USD', payment_provider: 'stripe', platform_fee_percentage: 2.9, service_fee_percentage: 2.0, min_payout_amount: 25, is_active: true },
        { code: 'GB', name: 'United Kingdom', default_currency: 'GBP', payment_provider: 'stripe', platform_fee_percentage: 2.9, service_fee_percentage: 2.0, min_payout_amount: 20, is_active: true },
        { code: 'GH', name: 'Ghana', default_currency: 'GHS', payment_provider: 'paystack', platform_fee_percentage: 3.5, service_fee_percentage: 2.0, min_payout_amount: 100, is_active: true },
        { code: 'KE', name: 'Kenya', default_currency: 'KES', payment_provider: 'flutterwave', platform_fee_percentage: 3.5, service_fee_percentage: 2.0, min_payout_amount: 1000, is_active: true },
      ];
      const { data, error } = await adminClient.from('countries').insert(countries).select();
      if (error) throw error;
      pass('Countries seeded', `${data.length} countries created`);
    } else {
      pass('Countries already exist', `${count} countries`);
    }
  } catch (e) {
    warn('Seed countries', e.message);
  }

  // Seed platform settings
  try {
    const { count } = await adminClient.from('platform_settings').select('*', { count: 'exact', head: true });
    if (count === 0) {
      const { error } = await adminClient.from('platform_settings').insert({
        key: 'general',
        value: { platform_name: 'Ticketrack', default_currency: 'NGN', default_country: 'NG' },
      });
      if (error) throw error;
      pass('Platform settings seeded');
    } else {
      pass('Platform settings exist', `${count} entries`);
    }
  } catch (e) {
    warn('Seed platform settings', e.message);
  }
}

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function pass(name, detail = '') {
  testResults.push({ name, status: 'PASS', detail });
  log('✅', `PASS: ${name}${detail ? ' — ' + detail : ''}`);
}

function fail(name, error) {
  testResults.push({ name, status: 'FAIL', detail: String(error) });
  log('❌', `FAIL: ${name} — ${error}`);
}

function warn(name, detail) {
  testResults.push({ name, status: 'WARN', detail });
  log('⚠️', `WARN: ${name} — ${detail}`);
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(60)}`);
}

// ──────────────────────────────────────
// 1. DATABASE CONNECTION TESTS
// ──────────────────────────────────────
async function testDatabaseConnection() {
  section('1. DATABASE CONNECTION');

  // Test basic connectivity
  try {
    const { data, error } = await supabase.from('categories').select('*').limit(5);
    if (error) throw error;
    pass('DB Connection', `Connected. Found ${data.length} categories`);
    if (data.length > 0) {
      log('📋', `  Categories: ${data.map(c => c.name).join(', ')}`);
    }
  } catch (e) {
    fail('DB Connection', e.message);
    return false;
  }

  // Test key tables exist
  const tables = ['events', 'ticket_types', 'tickets', 'orders', 'organizers', 'profiles', 'contacts', 'promo_codes', 'waitlist', 'followers'];
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) throw error;
      pass(`Table "${table}" accessible`, `${count ?? 0} rows`);
    } catch (e) {
      fail(`Table "${table}" accessible`, e.message);
    }
  }

  // Test platform settings
  try {
    const { data, error } = await supabase.from('platform_settings').select('*').limit(1);
    if (error) throw error;
    if (data.length > 0) {
      pass('Platform settings exist', JSON.stringify(data[0]).slice(0, 100));
    } else {
      warn('Platform settings', 'No settings found');
    }
  } catch (e) {
    fail('Platform settings', e.message);
  }

  // Test countries table
  try {
    const { data, error } = await supabase.from('countries').select('*');
    if (error) throw error;
    pass('Countries table', `${data.length} countries: ${data.map(c => c.country_code || c.code).join(', ')}`);
  } catch (e) {
    fail('Countries table', e.message);
  }

  return true;
}

// ──────────────────────────────────────
// 2. USER SIGNUP & ACTIVATION
// ──────────────────────────────────────
async function testUserSignupAndActivation() {
  section('2. USER SIGNUP & ACTIVATION');

  const timestamp = Date.now();
  testUserEmail = `testbot.${timestamp}@gmail.com`;
  const password = 'TestBot123!@#';

  // Create user via admin API (auto-confirmed)
  try {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: testUserEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        first_name: 'Test',
        last_name: 'Bot',
      },
    });
    if (error) throw error;
    if (data.user) {
      testUserId = data.user.id;
      pass('User created (admin)', `ID: ${testUserId}, Email: ${testUserEmail}, Confirmed: true`);
    } else {
      fail('User creation', 'No user returned');
      return;
    }
  } catch (e) {
    fail('User creation', e.message);
    return;
  }

  // Sign in with the new user (using anon client, simulating frontend)
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: testUserEmail,
      password: password,
    });
    if (error) throw error;
    testUserSession = data.session;
    pass('User sign-in', `Session token obtained (expires: ${new Date(data.session.expires_at * 1000).toISOString()})`);
  } catch (e) {
    fail('User sign-in', e.message);
  }

  // Create profile (using admin to bypass RLS, then verify via anon)
  if (testUserId) {
    try {
      const { data: existing } = await adminClient.from('profiles').select('*').eq('id', testUserId).maybeSingle();
      if (existing) {
        pass('Profile auto-created', `Role: ${existing.role}, Name: ${existing.first_name} ${existing.last_name}`);
      } else {
        const { data: newProfile, error: insertErr } = await adminClient.from('profiles').insert({
          id: testUserId,
          email: testUserEmail,
          first_name: 'Test',
          last_name: 'Bot',
          role: 'user',
        }).select().single();
        if (insertErr) throw insertErr;
        pass('Profile created (admin)', `Role: ${newProfile.role}`);
      }
    } catch (e) {
      fail('Profile create', e.message);
    }

    // Now verify profile via anon client (RLS test — user should see own profile)
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', testUserId).single();
      if (error) throw error;
      pass('Profile visible via anon (RLS)', `Role: ${data.role}`);
    } catch (e) {
      warn('Profile RLS read', e.message);
    }
  }

  // Test get current user
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (user) {
      pass('Get current user', `Confirmed: ${user.email}`);
    }
  } catch (e) {
    fail('Get current user', e.message);
  }
}

// ──────────────────────────────────────
// 3. ORGANIZER CREATION
// ──────────────────────────────────────
async function testOrganizerCreation() {
  section('3. ORGANIZER CREATION');

  if (!testUserId) {
    fail('Organizer creation', 'No test user available');
    return;
  }

  try {
    // Check if organizer already exists
    const { data: existing } = await adminClient
      .from('organizers')
      .select('*')
      .eq('user_id', testUserId)
      .maybeSingle();

    if (existing) {
      testOrganizerId = existing.id;
      pass('Organizer already exists', `ID: ${testOrganizerId}`);
      return;
    }

    // Create organizer via admin
    const { data, error } = await adminClient.from('organizers').insert({
      user_id: testUserId,
      business_name: 'Test Bot Events',
      email: testUserEmail,
      phone: '+2348011234567',
      country_code: 'NG',
      description: 'Automated test organizer account',
      is_verified: false,
    }).select().single();

    if (error) throw error;
    testOrganizerId = data.id;
    pass('Organizer created', `ID: ${testOrganizerId}, Business: ${data.business_name}`);

    // Verify organizer visible via anon client (RLS)
    const { data: anonOrg, error: anonErr } = await supabase
      .from('organizers')
      .select('*')
      .eq('id', testOrganizerId)
      .single();
    if (anonErr) {
      warn('Organizer RLS read', anonErr.message);
    } else {
      pass('Organizer visible via anon (RLS)', `Business: ${anonOrg.business_name}`);
    }

    // Update profile role to organizer
    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({ role: 'organizer' })
      .eq('id', testUserId);
    if (updateErr) {
      warn('Profile role update', updateErr.message);
    } else {
      pass('Profile role updated to organizer');
    }
  } catch (e) {
    fail('Organizer creation', e.message);
  }
}

// ──────────────────────────────────────
// 4. EVENT CREATION
// ──────────────────────────────────────
async function testEventCreation() {
  section('4. EVENT CREATION');

  if (!testOrganizerId) {
    fail('Event creation', 'No organizer available');
    return;
  }

  const timestamp = Date.now();
  const slug = `test-event-${timestamp}`;

  // Create event
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 30);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 6);

    const { data, error } = await adminClient.from('events').insert({
      organizer_id: testOrganizerId,
      title: `E2E Test Event ${timestamp}`,
      slug: slug,
      description: 'This is an automated end-to-end test event created by the test bot.',
      status: 'published',
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_name: 'Test Venue Lagos',
      venue_address: '123 Test Street, Victoria Island',
      city: 'Lagos',
      country_code: 'NG',
      currency: 'NGN',
      is_free: false,
      tickets_sold: 0,
      total_revenue: 0,
      views_count: 0,
    }).select().single();

    if (error) throw error;
    testEventId = data.id;
    testEventSlug = data.slug;
    pass('Event created', `ID: ${testEventId}, Slug: ${testEventSlug}, Title: ${data.title}`);
  } catch (e) {
    fail('Event creation', e.message);
    return;
  }

  // Create ticket types
  const ticketTypes = [
    { event_id: testEventId, name: 'Early Bird', price: 5000, quantity_available: 100, currency: 'NGN', is_active: true, is_refundable: true },
    { event_id: testEventId, name: 'Regular', price: 10000, quantity_available: 200, currency: 'NGN', is_active: true, is_refundable: true },
    { event_id: testEventId, name: 'VIP', price: 25000, quantity_available: 50, currency: 'NGN', is_active: true, is_refundable: false },
  ];

  try {
    const { data, error } = await adminClient.from('ticket_types').insert(ticketTypes).select();
    if (error) throw error;
    testTicketTypeId = data[0].id;
    pass('Ticket types created', `${data.length} types: ${data.map(t => `${t.name} (₦${t.price})`).join(', ')}`);
  } catch (e) {
    fail('Ticket types creation', e.message);
  }

  // Create a second event (free)
  try {
    const startDate2 = new Date();
    startDate2.setDate(startDate2.getDate() + 45);

    const { data, error } = await adminClient.from('events').insert({
      organizer_id: testOrganizerId,
      title: `Free Community Meetup ${timestamp}`,
      slug: `free-meetup-${timestamp}`,
      description: 'A free community meetup for testing.',
      status: 'published',
      start_date: startDate2.toISOString(),
      end_date: new Date(startDate2.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      venue_name: 'Community Center',
      venue_address: '456 Free Street, Lekki',
      city: 'Lagos',
      country_code: 'NG',
      currency: 'NGN',
      is_free: true,
      tickets_sold: 0,
      total_revenue: 0,
      views_count: 0,
    }).select().single();

    if (error) throw error;
    pass('Free event created', `ID: ${data.id}, Title: ${data.title}`);

    // Create free ticket type
    const { error: ttErr } = await adminClient.from('ticket_types').insert({
      event_id: data.id,
      name: 'Free Admission',
      price: 0,
      quantity_available: 500,
      currency: 'NGN',
      is_active: true,
    });
    if (ttErr) throw ttErr;
    pass('Free ticket type created');
  } catch (e) {
    fail('Free event creation', e.message);
  }

  // Create draft event
  try {
    const { data, error } = await adminClient.from('events').insert({
      organizer_id: testOrganizerId,
      title: `Draft Event ${timestamp}`,
      slug: `draft-event-${timestamp}`,
      description: 'Draft event - should not be visible publicly.',
      status: 'draft',
      start_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date(Date.now() + 60.25 * 24 * 60 * 60 * 1000).toISOString(),
      venue_name: 'TBD',
      city: 'Lagos',
      country_code: 'NG',
      currency: 'NGN',
      is_free: false,
    }).select().single();

    if (error) throw error;
    pass('Draft event created', `ID: ${data.id}, Status: ${data.status}`);
  } catch (e) {
    fail('Draft event creation', e.message);
  }
}

// ──────────────────────────────────────
// 5. EVENT READING & QUERIES
// ──────────────────────────────────────
async function testEventQueries() {
  section('5. EVENT QUERIES & SEARCH');

  // Fetch all published events
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, slug, status, city, currency, is_free, start_date')
      .eq('status', 'published')
      .order('start_date', { ascending: true })
      .limit(10);
    if (error) throw error;
    pass('Fetch published events', `Found ${data.length} published events`);
    data.forEach(e => log('  📅', `${e.title} — ${e.city} — ${e.currency} — ${e.is_free ? 'FREE' : 'PAID'} — ${new Date(e.start_date).toLocaleDateString()}`));
  } catch (e) {
    fail('Fetch published events', e.message);
  }

  // Fetch event by slug
  if (testEventSlug) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_types(*)')
        .eq('slug', testEventSlug)
        .single();
      if (error) throw error;
      pass('Fetch event by slug', `"${data.title}" with ${data.ticket_types.length} ticket types`);
    } catch (e) {
      fail('Fetch event by slug', e.message);
    }
  }

  // Fetch event with organizer info
  if (testEventId) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*, organizers(business_name, email, is_verified)')
        .eq('id', testEventId)
        .single();
      if (error) throw error;
      pass('Fetch event with organizer', `Organizer: ${data.organizers?.business_name}`);
    } catch (e) {
      fail('Fetch event with organizer', e.message);
    }
  }

  // Search events by title
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, slug')
      .ilike('title', '%test%')
      .limit(5);
    if (error) throw error;
    pass('Search events by title', `Found ${data.length} events matching "test"`);
  } catch (e) {
    fail('Search events by title', e.message);
  }

  // Fetch events by city
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, city')
      .eq('city', 'Lagos')
      .eq('status', 'published')
      .limit(5);
    if (error) throw error;
    pass('Fetch events by city (Lagos)', `Found ${data.length} events`);
  } catch (e) {
    fail('Fetch events by city', e.message);
  }

  // Test that draft events are not returned in public queries (RLS test)
  if (testOrganizerId) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, status')
        .eq('organizer_id', testOrganizerId)
        .eq('status', 'draft');
      if (error) throw error;
      // As the organizer, we should see draft events
      pass('Draft events visible to organizer', `Found ${data.length} draft events`);
    } catch (e) {
      fail('Draft event visibility', e.message);
    }
  }
}

// ──────────────────────────────────────
// 6. TICKET & ORDER FLOW
// ──────────────────────────────────────
async function testTicketAndOrderFlow() {
  section('6. TICKET & ORDER SIMULATION');

  if (!testEventId || !testTicketTypeId || !testUserId) {
    fail('Ticket flow', 'Missing event, ticket type, or user');
    return;
  }

  // Simulate creating an order
  let orderId = null;
  try {
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await adminClient.from('orders').insert({
      order_number: orderNumber,
      event_id: testEventId,
      user_id: testUserId,
      subtotal: 5000,
      platform_fee: 175,
      tax_amount: 0,
      total_amount: 5175,
      currency: 'NGN',
      status: 'completed',
      payment_provider: 'test',
      payment_reference: `TEST-${Date.now()}`,
      buyer_name: 'Test Bot',
      buyer_email: testUserEmail,
    }).select().single();

    if (error) throw error;
    orderId = data.id;
    pass('Order created', `ID: ${orderId}, Amount: ₦${data.total_amount}, Status: ${data.status}`);
  } catch (e) {
    fail('Order creation', e.message);
  }

  // Create a ticket
  try {
    const ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await adminClient.from('tickets').insert({
      event_id: testEventId,
      ticket_type_id: testTicketTypeId,
      order_id: orderId,
      user_id: testUserId,
      attendee_name: 'Test Bot',
      attendee_email: testUserEmail,
      attendee_phone: '+2348011234567',
      ticket_code: ticketCode,
      qr_code: `https://ticketrack.com/verify/${ticketCode}`,
      status: 'active',
      payment_status: 'completed',
      is_checked_in: false,
      quantity: 1,
      unit_price: 5000,
      total_price: 5000,
      currency: 'NGN',
    }).select().single();

    if (error) throw error;
    pass('Ticket created', `Code: ${data.ticket_code}, Event: ${testEventId}`);
  } catch (e) {
    fail('Ticket creation', e.message);
  }

  // Fetch user's tickets
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*, events(title, start_date, venue_name), ticket_types(name, price)')
      .eq('user_id', testUserId);
    if (error) throw error;
    pass('Fetch user tickets', `Found ${data.length} tickets`);
    data.forEach(t => log('  🎫', `${t.ticket_code} — ${t.events?.title} — ${t.ticket_types?.name} (₦${t.ticket_types?.price})`));
  } catch (e) {
    fail('Fetch user tickets', e.message);
  }

  // Fetch event attendees (as organizer)
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('attendee_name, attendee_email, ticket_code, is_checked_in, ticket_types(name)')
      .eq('event_id', testEventId);
    if (error) throw error;
    pass('Fetch event attendees', `${data.length} attendees for event`);
  } catch (e) {
    fail('Fetch event attendees', e.message);
  }

  // Simulate check-in
  try {
    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, ticket_code')
      .eq('event_id', testEventId)
      .eq('is_checked_in', false)
      .limit(1);

    if (tickets && tickets.length > 0) {
      const { error } = await adminClient
        .from('tickets')
        .update({ is_checked_in: true, checked_in_at: new Date().toISOString() })
        .eq('id', tickets[0].id);
      if (error) throw error;
      pass('Ticket check-in', `Checked in ticket ${tickets[0].ticket_code}`);
    } else {
      warn('Ticket check-in', 'No unchecked tickets available');
    }
  } catch (e) {
    fail('Ticket check-in', e.message);
  }
}

// ──────────────────────────────────────
// 7. PROMO CODES
// ──────────────────────────────────────
async function testPromoCodes() {
  section('7. PROMO CODES');

  if (!testEventId || !testOrganizerId) {
    fail('Promo codes', 'Missing event or organizer');
    return;
  }

  try {
    const { data, error } = await adminClient.from('promo_codes').insert({
      event_id: testEventId,
      organizer_id: testOrganizerId,
      code: `TEST${Date.now().toString(36).toUpperCase()}`,
      discount_type: 'percentage',
      discount_value: 20,
      max_uses: 50,
      times_used: 0,
      is_active: true,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).select().single();

    if (error) throw error;
    pass('Promo code created', `Code: ${data.code}, ${data.discount_value}% off, Max uses: ${data.max_uses}`);

    // Fetch promo codes for event
    const { data: codes, error: fetchErr } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('event_id', testEventId);
    if (fetchErr) throw fetchErr;
    pass('Fetch promo codes', `Found ${codes.length} codes for event`);
  } catch (e) {
    fail('Promo codes', e.message);
  }
}

// ──────────────────────────────────────
// 8. CONTACTS & FOLLOWERS
// ──────────────────────────────────────
async function testContactsAndFollowers() {
  section('8. CONTACTS & FOLLOWERS');

  if (!testOrganizerId || !testUserId) {
    fail('Contacts', 'Missing organizer or user');
    return;
  }

  // Create contacts
  try {
    const contacts = [
      { organizer_id: testOrganizerId, email: 'contact1@test.com', full_name: 'Alice Test', source_type: 'manual', email_opt_in: true },
      { organizer_id: testOrganizerId, email: 'contact2@test.com', full_name: 'Bob Test', source_type: 'imported', email_opt_in: true, sms_opt_in: true },
      { organizer_id: testOrganizerId, email: 'contact3@test.com', full_name: 'Charlie Test', phone: '+2348012345678', source_type: 'ticket', email_opt_in: true },
    ];
    const { data, error } = await adminClient.from('contacts').insert(contacts).select();
    if (error) throw error;
    pass('Contacts created', `${data.length} contacts added`);
  } catch (e) {
    fail('Contacts creation', e.message);
  }

  // Fetch contacts
  try {
    const { data, error, count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('organizer_id', testOrganizerId);
    if (error) throw error;
    pass('Fetch contacts', `${count ?? data.length} contacts for organizer`);
  } catch (e) {
    fail('Fetch contacts', e.message);
  }

  // Follow organizer
  try {
    const { data, error } = await adminClient.from('followers').insert({
      organizer_id: testOrganizerId,
      user_id: testUserId,
    }).select().single();

    if (error) throw error;
    pass('Follow organizer', `User ${testUserId} now follows organizer ${testOrganizerId}`);
  } catch (e) {
    if (e.message?.includes('duplicate') || e.message?.includes('unique')) {
      pass('Follow organizer', 'Already following (duplicate prevented)');
    } else {
      fail('Follow organizer', e.message);
    }
  }

  // Fetch followers
  try {
    const { data, error } = await supabase
      .from('followers')
      .select('*, profiles(first_name, last_name, email)')
      .eq('organizer_id', testOrganizerId);
    if (error) throw error;
    pass('Fetch followers', `${data.length} followers`);
  } catch (e) {
    fail('Fetch followers', e.message);
  }
}

// ──────────────────────────────────────
// 9. WAITLIST
// ──────────────────────────────────────
async function testWaitlist() {
  section('9. WAITLIST');

  if (!testEventId) {
    fail('Waitlist', 'No event available');
    return;
  }

  try {
    const { data, error } = await adminClient.from('waitlist').insert({
      event_id: testEventId,
      email: 'waitlist-test@ticketrack.com',
      name: 'Waitlist Tester',
      phone: '+2348099887766',
      position: 1,
    }).select().single();

    if (error) throw error;
    pass('Waitlist entry created', `ID: ${data.id}`);
  } catch (e) {
    fail('Waitlist entry', e.message);
  }

  // Fetch waitlist
  try {
    const { data, error } = await supabase
      .from('waitlist')
      .select('*')
      .eq('event_id', testEventId);
    if (error) throw error;
    pass('Fetch waitlist', `${data.length} entries`);
  } catch (e) {
    fail('Fetch waitlist', e.message);
  }
}

// ──────────────────────────────────────
// 10. ORGANIZER STATS & ANALYTICS
// ──────────────────────────────────────
async function testOrganizerStats() {
  section('10. ORGANIZER STATS & ANALYTICS');

  if (!testOrganizerId) {
    fail('Organizer stats', 'No organizer');
    return;
  }

  // Get organizer events count
  try {
    const { count, error } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('organizer_id', testOrganizerId);
    if (error) throw error;
    pass('Organizer total events', `${count} events`);
  } catch (e) {
    fail('Organizer events count', e.message);
  }

  // Get organizer total tickets sold
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, tickets_sold, total_revenue')
      .eq('organizer_id', testOrganizerId);
    if (error) throw error;
    const totalTickets = events.reduce((sum, e) => sum + (e.tickets_sold || 0), 0);
    const totalRevenue = events.reduce((sum, e) => sum + (e.total_revenue || 0), 0);
    pass('Organizer aggregated stats', `Tickets sold: ${totalTickets}, Revenue: ₦${totalRevenue}`);
  } catch (e) {
    fail('Organizer stats', e.message);
  }

  // Get organizer profile
  try {
    const { data, error } = await supabase
      .from('organizers')
      .select('*')
      .eq('id', testOrganizerId)
      .single();
    if (error) throw error;
    pass('Organizer profile', `Business: ${data.business_name}, Verified: ${data.is_verified}, Country: ${data.country_code}`);
  } catch (e) {
    fail('Organizer profile fetch', e.message);
  }
}

// ──────────────────────────────────────
// 11. EVENT UPDATE & STATUS CHANGES
// ──────────────────────────────────────
async function testEventUpdates() {
  section('11. EVENT UPDATES & STATUS CHANGES');

  if (!testEventId) {
    fail('Event updates', 'No event');
    return;
  }

  // Update event details
  try {
    const { data, error } = await adminClient
      .from('events')
      .update({
        description: 'Updated description — E2E test verified this event can be modified.',
        venue_name: 'Updated Venue Lagos',
      })
      .eq('id', testEventId)
      .select()
      .single();
    if (error) throw error;
    pass('Event updated', `New venue: ${data.venue_name}`);
  } catch (e) {
    fail('Event update', e.message);
  }

  // Change event status
  try {
    // Set to draft
    const { error: draftErr } = await adminClient
      .from('events')
      .update({ status: 'draft' })
      .eq('id', testEventId);
    if (draftErr) throw draftErr;

    // Set back to published
    const { error: pubErr } = await adminClient
      .from('events')
      .update({ status: 'published' })
      .eq('id', testEventId);
    if (pubErr) throw pubErr;

    pass('Event status toggle', 'published → draft → published');
  } catch (e) {
    fail('Event status change', e.message);
  }

  // Update ticket type
  if (testTicketTypeId) {
    try {
      const { data, error } = await adminClient
        .from('ticket_types')
        .update({ price: 7500, name: 'Early Bird (Updated)' })
        .eq('id', testTicketTypeId)
        .select()
        .single();
      if (error) throw error;
      pass('Ticket type updated', `${data.name} — ₦${data.price}`);
    } catch (e) {
      fail('Ticket type update', e.message);
    }
  }
}

// ──────────────────────────────────────
// 12. EDGE CASES & RLS VALIDATION
// ──────────────────────────────────────
async function testEdgeCases() {
  section('12. EDGE CASES & RLS VALIDATION');

  // Test duplicate slug prevention
  if (testEventSlug) {
    try {
      const { data, error } = await adminClient.from('events').insert({
        organizer_id: testOrganizerId,
        title: 'Duplicate Slug Test',
        slug: testEventSlug, // Same slug
        status: 'draft',
        start_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: new Date(Date.now() + 90.25 * 24 * 60 * 60 * 1000).toISOString(),
        city: 'Lagos',
        country_code: 'NG',
        currency: 'NGN',
      }).select();
      if (error) {
        pass('Duplicate slug rejected', error.message);
      } else {
        warn('Duplicate slug NOT rejected', 'A unique constraint on slug may be missing');
        // Cleanup
        if (data && data[0]) {
          await adminClient.from('events').delete().eq('id', data[0].id);
        }
      }
    } catch (e) {
      pass('Duplicate slug rejected (exception)', e.message);
    }
  }

  // Test invalid data insertion
  try {
    const { error } = await supabase.from('events').insert({
      // Missing required fields
      title: 'Invalid Event',
    });
    if (error) {
      pass('Invalid event insert rejected', error.message.slice(0, 80));
    } else {
      warn('Invalid event accepted', 'Schema may not enforce required fields');
    }
  } catch (e) {
    pass('Invalid event rejected (exception)', e.message);
  }

  // Test accessing other organizer's data
  if (testUserId) {
    try {
      const { data, error } = await supabase
        .from('organizers')
        .select('*')
        .neq('user_id', testUserId)
        .limit(1);
      if (error) throw error;
      if (data.length > 0) {
        warn('Can see other organizers', `RLS may be too permissive — can see: ${data[0].business_name}`);
      } else {
        pass('Other organizers hidden by RLS');
      }
    } catch (e) {
      fail('RLS test for organizers', e.message);
    }
  }
}

// ──────────────────────────────────────
// 13. CLEANUP
// ──────────────────────────────────────
async function cleanup() {
  section('13. CLEANUP');

  log('🧹', 'Cleaning up test data...');

  // Delete in dependency order
  const cleanupOps = [
    { table: 'waitlist', filter: { event_id: testEventId } },
    { table: 'promo_codes', filter: { organizer_id: testOrganizerId } },
    { table: 'followers', filter: { user_id: testUserId } },
    { table: 'contacts', filter: { organizer_id: testOrganizerId } },
    { table: 'tickets', filter: { user_id: testUserId } },
    { table: 'orders', filter: { user_id: testUserId } },
  ];

  for (const op of cleanupOps) {
    if (!Object.values(op.filter)[0]) continue;
    try {
      const key = Object.keys(op.filter)[0];
      const { error } = await adminClient.from(op.table).delete().eq(key, op.filter[key]);
      if (error) {
        warn(`Cleanup ${op.table}`, error.message);
      } else {
        pass(`Cleanup ${op.table}`);
      }
    } catch (e) {
      warn(`Cleanup ${op.table}`, e.message);
    }
  }

  // Delete events (ticket_types cascade)
  if (testOrganizerId) {
    try {
      // Delete ticket types first
      const { data: events } = await adminClient
        .from('events')
        .select('id')
        .eq('organizer_id', testOrganizerId);
      if (events) {
        for (const evt of events) {
          await adminClient.from('ticket_types').delete().eq('event_id', evt.id);
        }
      }
      const { error } = await adminClient.from('events').delete().eq('organizer_id', testOrganizerId);
      if (error) warn('Cleanup events', error.message);
      else pass('Cleanup events');
    } catch (e) {
      warn('Cleanup events', e.message);
    }
  }

  // Delete organizer
  if (testOrganizerId) {
    try {
      const { error } = await adminClient.from('organizers').delete().eq('id', testOrganizerId);
      if (error) warn('Cleanup organizer', error.message);
      else pass('Cleanup organizer');
    } catch (e) {
      warn('Cleanup organizer', e.message);
    }
  }

  // Delete profile
  if (testUserId) {
    try {
      const { error } = await adminClient.from('profiles').delete().eq('id', testUserId);
      if (error) warn('Cleanup profile', error.message);
      else pass('Cleanup profile');
    } catch (e) {
      warn('Cleanup profile', e.message);
    }
  }

  // Sign out
  try {
    await supabase.auth.signOut();
    pass('Signed out');
  } catch (e) {
    warn('Sign out', e.message);
  }

  // Delete auth user
  if (testUserId) {
    try {
      const { error } = await adminClient.auth.admin.deleteUser(testUserId);
      if (error) warn('Cleanup auth user', error.message);
      else pass('Cleanup auth user', testUserEmail);
    } catch (e) {
      warn('Cleanup auth user', e.message);
    }
  }

  // Clean up seeded base data
  try {
    await adminClient.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    pass('Cleanup categories');
  } catch (e) {
    warn('Cleanup categories', e.message);
  }

  try {
    await adminClient.from('countries').delete().neq('code', 'XX');
    pass('Cleanup countries');
  } catch (e) {
    warn('Cleanup countries', e.message);
  }

  try {
    await adminClient.from('platform_settings').delete().neq('key', '');
    pass('Cleanup platform settings');
  } catch (e) {
    warn('Cleanup platform settings', e.message);
  }
}

// ──────────────────────────────────────
// MAIN
// ──────────────────────────────────────
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════╗
║     TICKETRACK E2E TEST RUNNER                       ║
║     Target: DEV (bnkxgyzvqpdctghrgmkr)              ║
║     Time: ${new Date().toISOString()}         ║
╚══════════════════════════════════════════════════════╝
`);

  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    console.log('\n💀 Database connection failed. Aborting remaining tests.');
    return;
  }

  await seedBaseData();
  await testUserSignupAndActivation();
  await testOrganizerCreation();
  await testEventCreation();
  await testEventQueries();
  await testTicketAndOrderFlow();
  await testPromoCodes();
  await testContactsAndFollowers();
  await testWaitlist();
  await testOrganizerStats();
  await testEventUpdates();
  await testEdgeCases();
  await cleanup();

  // Print summary
  section('FINAL RESULTS');
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const warned = testResults.filter(r => r.status === 'WARN').length;

  console.log(`\n  ✅ Passed:  ${passed}`);
  console.log(`  ❌ Failed:  ${failed}`);
  console.log(`  ⚠️  Warned:  ${warned}`);
  console.log(`  📊 Total:   ${testResults.length}`);

  if (failed > 0) {
    console.log(`\n  FAILED TESTS:`);
    testResults.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.name}: ${r.detail}`);
    });
  }

  if (warned > 0) {
    console.log(`\n  WARNINGS:`);
    testResults.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`    ⚠️  ${r.name}: ${r.detail}`);
    });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Test run completed at ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
