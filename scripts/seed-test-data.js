/**
 * Ticketrack Test Data Seeder
 * 
 * Generates realistic test data to simulate production usage:
 * - 500+ contacts with realistic Nigerian/international names
 * - 20+ events with various ticket types
 * - 200+ ticket purchases
 * - Communication campaigns and messages
 * - Drip campaign enrollments
 * 
 * Usage: node scripts/seed-test-data.js
 * 
 * Prerequisites: npm install @faker-js/faker @supabase/supabase-js
 */

import { faker } from '@faker-js/faker';
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bkvbvggngttrizbchygy.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Nigerian-specific data
const NIGERIAN_FIRST_NAMES = [
  'Adebayo', 'Chidinma', 'Oluwaseun', 'Ngozi', 'Emeka', 'Aisha', 'Yusuf', 'Fatima',
  'Chukwuemeka', 'Oluwafemi', 'Amara', 'Obiora', 'Tochukwu', 'Adaeze', 'Ikenna',
  'Chiamaka', 'Obinna', 'Nneka', 'Chinedu', 'Ifeanyi', 'Adeola', 'Kunle', 'Tunde',
  'Bukola', 'Folake', 'Shade', 'Bola', 'Tobi', 'Damilola', 'Ayodeji', 'Temitope',
  'Olumide', 'Oluwatosin', 'Chisom', 'Kelechi', 'Nnamdi', 'Ugochukwu', 'Adaobi'
];

const NIGERIAN_LAST_NAMES = [
  'Okonkwo', 'Adeyemi', 'Ibrahim', 'Okafor', 'Mohammed', 'Eze', 'Bello', 'Abubakar',
  'Nwachukwu', 'Adebayo', 'Obi', 'Chukwu', 'Okoro', 'Adekunle', 'Ogbonna', 'Udeh',
  'Nwosu', 'Igwe', 'Onwueme', 'Okolie', 'Nwafor', 'Achebe', 'Azikiwe', 'Awolowo',
  'Soyinka', 'Okigbo', 'Amadi', 'Ekwensi', 'Omotoso', 'Osundare', 'Rotimi'
];

const LAGOS_VENUES = [
  { name: 'Eko Hotel & Suites', address: 'Plot 1415, Adetokunbo Ademola Street, Victoria Island, Lagos' },
  { name: 'The Landmark Event Centre', address: 'Plot 2 & 3, Water Corporation Drive, Victoria Island, Lagos' },
  { name: 'Federal Palace Hotel', address: '6-8 Ahmadu Bello Way, Victoria Island, Lagos' },
  { name: 'Balmoral Convention Centre', address: 'Federal Palace Hotel, Victoria Island, Lagos' },
  { name: 'Muri Okunola Park', address: 'Ahmadu Bello Way, Victoria Island, Lagos' },
  { name: 'TerraKulture', address: '1376 Tiamiyu Savage Street, Victoria Island, Lagos' },
  { name: 'Hard Rock Cafe Lagos', address: 'Landmark Village, Victoria Island, Lagos' },
  { name: 'The Wheatbaker', address: '4 Onitolo Road, Ikoyi, Lagos' },
  { name: 'Oriental Hotel', address: '3 Lekki Road, Victoria Island, Lagos' },
  { name: 'Zone Tech Park', address: 'Gbagada, Lagos' },
];

const EVENT_CATEGORIES = ['music', 'conference', 'party', 'workshop', 'networking', 'comedy', 'art', 'food'];
const EVENT_PREFIXES = ['Lagos', 'Naija', 'Afro', 'Summer', 'Winter', 'Annual', 'International', 'Ultimate'];
const EVENT_SUFFIXES = ['Festival', 'Summit', 'Experience', 'Vibes', 'Night', 'Brunch', 'Gala', 'Conference'];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function randomNigerianName() {
  const firstName = faker.helpers.arrayElement(NIGERIAN_FIRST_NAMES);
  const lastName = faker.helpers.arrayElement(NIGERIAN_LAST_NAMES);
  return { firstName, lastName, fullName: `${firstName} ${lastName}` };
}

function randomNigerianPhone() {
  // Return 11-digit Nigerian phone number (fits varchar(20))
  const prefixes = ['0803', '0805', '0806', '0807', '0808', '0809', '0810', '0813', '0814', '0816'];
  const prefix = faker.helpers.arrayElement(prefixes);
  const number = faker.string.numeric(7);
  return `${prefix}${number}`; // 11 characters total
}

function randomShortPhone() {
  // Return short international format that fits varchar(20)
  return `+1${faker.string.numeric(10)}`; // 12 characters
}

function randomEventTitle() {
  const prefix = faker.helpers.arrayElement(EVENT_PREFIXES);
  const category = faker.helpers.arrayElement(['Music', 'Tech', 'Art', 'Food', 'Comedy', 'Dance', 'Fashion', 'Business']);
  const suffix = faker.helpers.arrayElement(EVENT_SUFFIXES);
  const year = new Date().getFullYear();
  return `${prefix} ${category} ${suffix} ${year}`;
}

function randomTicketPrice() {
  const prices = [0, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 75000, 100000];
  return faker.helpers.arrayElement(prices);
}

function randomFutureDate(daysAhead = 90) {
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + daysAhead);
  return faker.date.between({ from: start, to: end });
}

function randomPastDate(daysAgo = 90) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - daysAgo);
  return faker.date.between({ from: start, to: end });
}

// ============================================================================
// DATA GENERATORS
// ============================================================================

async function getOrCreateTestOrganizer() {
  // First, check if test organizer already exists
  const { data: testOrg } = await supabase
    .from('organizers')
    .select('id, business_name')
    .eq('business_name', 'Test Events Ltd')
    .single();

  if (testOrg) {
    console.log('Using existing test organizer:', testOrg.id);
    return testOrg.id;
  }

  // Try to find ANY existing organizer to use for seeding
  const { data: anyOrg, error: anyOrgError } = await supabase
    .from('organizers')
    .select('id, business_name, email')
    .limit(1)
    .single();

  if (anyOrg) {
    console.log(`Using existing organizer: ${anyOrg.business_name} (${anyOrg.id})`);
    console.log('  Note: You can login with the organizer\'s email to see the seeded data');
    return anyOrg.id;
  }

  // No organizers exist - try to create one via auth admin
  console.log('No organizers found, attempting to create test organizer...');
  
  try {
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'test-organizer@ticketrack.com',
      password: 'TestPassword123!',
      email_confirm: true,
    });

    if (authError) {
      throw authError;
    }

    // Create organizer record
    const { data: organizer, error: orgError } = await supabase
      .from('organizers')
      .insert({
        user_id: authUser.user.id,
        business_name: 'Test Events Ltd',
        email: 'test-organizer@ticketrack.com',
        phone: '08012345678',
        description: 'Test organizer for automated testing',
        is_verified: true,
        website: 'https://ticketrack.com',
      })
      .select()
      .single();

    if (orgError) {
      throw orgError;
    }

    console.log('Created test organizer:', organizer.id);
    return organizer.id;
  } catch (error) {
    console.error('\n⚠️  Could not create test organizer automatically.');
    console.log('\nTo seed data, please either:');
    console.log('  1. Create an organizer account manually in the app first');
    console.log('  2. Or pass an existing organizer ID:');
    console.log('     ORGANIZER_ID=your-uuid npm run seed\n');
    
    // Check if ORGANIZER_ID was provided
    if (process.env.ORGANIZER_ID) {
      console.log(`Using provided ORGANIZER_ID: ${process.env.ORGANIZER_ID}`);
      return process.env.ORGANIZER_ID;
    }
    
    return null;
  }
}

async function seedContacts(organizerId, count = 500) {
  console.log(`\nSeeding ${count} contacts...`);
  
  const contacts = [];
  for (let i = 0; i < count; i++) {
    const { fullName } = randomNigerianName();
    const useNigerianPhone = Math.random() > 0.3; // 70% Nigerian
    
    contacts.push({
      organizer_id: organizerId,
      email: faker.internet.email({ firstName: fullName.split(' ')[0], lastName: fullName.split(' ')[1] }).toLowerCase(),
      phone: useNigerianPhone ? randomNigerianPhone() : randomShortPhone(),
      full_name: fullName,
      source_type: faker.helpers.arrayElement(['ticket', 'imported', 'follower', 'manual']),
      email_opt_in: Math.random() > 0.1, // 90% opted in
      sms_opt_in: Math.random() > 0.3, // 70% opted in
      whatsapp_opt_in: Math.random() > 0.4, // 60% opted in
    });
  }

  // Insert in batches
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize);
    const { error } = await supabase.from('contacts').insert(batch);
    
    if (error) {
      console.error(`Error inserting contacts batch ${i}:`, error.message);
    } else {
      inserted += batch.length;
      process.stdout.write(`\r  Inserted ${inserted}/${count} contacts`);
    }
  }
  
  console.log(`\n  ✓ Seeded ${inserted} contacts`);
  return inserted;
}

async function seedEvents(organizerId, count = 20) {
  console.log(`\nSeeding ${count} events...`);
  
  const events = [];
  for (let i = 0; i < count; i++) {
    const venue = faker.helpers.arrayElement(LAGOS_VENUES);
    const startDate = randomFutureDate(180);
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + faker.number.int({ min: 2, max: 8 }));
    
    const isFree = Math.random() > 0.8; // 20% free events
    
    // Event with required fields
    events.push({
      organizer_id: organizerId,
      title: randomEventTitle(),
      description: faker.lorem.paragraphs(3),
      category: faker.helpers.arrayElement(EVENT_CATEGORIES),
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      venue_name: venue.name,
      venue_address: venue.address,
      city: 'Lagos',
      is_free: isFree,
      currency: 'NGN',
      country_code: 'NG',
    });
  }

  const { data: insertedEvents, error } = await supabase
    .from('events')
    .insert(events)
    .select('id, title');

  if (error) {
    console.error('Error seeding events:', error);
    return [];
  }

  console.log(`  ✓ Seeded ${insertedEvents.length} events`);
  
  // Seed ticket types for each event
  await seedTicketTypes(insertedEvents);
  
  return insertedEvents;
}

async function seedTicketTypes(events) {
  console.log(`\nSeeding ticket types for ${events.length} events...`);
  
  const ticketTypes = [];
  
  for (const event of events) {
    const typeCount = faker.number.int({ min: 1, max: 4 });
    const types = ['Early Bird', 'Regular', 'VIP', 'VVIP', 'Table', 'Group'];
    const selectedTypes = faker.helpers.arrayElements(types, typeCount);
    
    for (const typeName of selectedTypes) {
      const price = randomTicketPrice();
      const qty = faker.number.int({ min: 50, max: 500 });
      ticketTypes.push({
        event_id: event.id,
        name: typeName,
        description: `${typeName} access to ${event.title}`,
        price: price,
        quantity_available: qty,
      });
    }
  }

  const { error } = await supabase.from('ticket_types').insert(ticketTypes);
  
  if (error) {
    console.error('Error seeding ticket types:', error);
  } else {
    console.log(`  ✓ Seeded ${ticketTypes.length} ticket types`);
  }
  
  return ticketTypes;
}

async function seedTicketPurchases(organizerId, count = 200) {
  console.log(`\nSeeding ${count} ticket purchases...`);
  
  // Get events and ticket types
  const { data: events } = await supabase
    .from('events')
    .select('id, title, ticket_types(id, name, price)')
    .eq('organizer_id', organizerId);

  if (!events || events.length === 0) {
    console.log('  No events found, skipping ticket purchases');
    return 0;
  }

  // Get contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, phone, full_name')
    .eq('organizer_id', organizerId)
    .limit(count);

  if (!contacts || contacts.length === 0) {
    console.log('  No contacts found, skipping ticket purchases');
    return 0;
  }

  const tickets = [];
  
  for (let i = 0; i < count; i++) {
    const contact = faker.helpers.arrayElement(contacts);
    const event = faker.helpers.arrayElement(events);
    const ticketTypes = event.ticket_types || [];
    
    if (ticketTypes.length === 0) continue;
    
    const ticketType = faker.helpers.arrayElement(ticketTypes);
    const quantity = faker.number.int({ min: 1, max: 4 });
    
    for (let q = 0; q < quantity; q++) {
      tickets.push({
        event_id: event.id,
        ticket_type_id: ticketType.id,
        attendee_name: contact.full_name,
        attendee_email: contact.email,
        attendee_phone: contact.phone,
        ticket_code: `TKT-${faker.string.alphanumeric(8).toUpperCase()}`,
        qr_code: `QR-${faker.string.alphanumeric(12).toUpperCase()}`,
        payment_status: faker.helpers.arrayElement(['completed', 'completed', 'completed', 'pending', 'failed']),
        is_checked_in: Math.random() > 0.7, // 30% checked in
      });
    }
  }

  // Insert in batches
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < tickets.length; i += batchSize) {
    const batch = tickets.slice(i, i + batchSize);
    const { error } = await supabase.from('tickets').insert(batch);
    
    if (error) {
      console.error(`Error inserting tickets batch:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  
  console.log(`  ✓ Seeded ${inserted} tickets`);
  return inserted;
}

async function seedCommunicationCampaigns(organizerId, count = 10) {
  console.log(`\nSeeding ${count} communication campaigns...`);
  
  const campaigns = [];
  
  for (let i = 0; i < count; i++) {
    const channel = faker.helpers.arrayElement(['email', 'sms', 'whatsapp']);
    const sentCount = faker.number.int({ min: 50, max: 500 });
    
    campaigns.push({
      organizer_id: organizerId,
      name: `${faker.helpers.arrayElement(['Welcome', 'Reminder', 'Thank You', 'Promo', 'Announcement'])} Campaign ${i + 1}`,
      description: faker.lorem.sentence(),
      channels: [channel],
      content: {
        [channel]: {
          subject: channel === 'email' ? faker.lorem.sentence() : undefined,
          body: faker.lorem.paragraph(),
          message: faker.lorem.paragraph(),
        }
      },
      audience_type: 'all_contacts',
      status: faker.helpers.arrayElement(['sent', 'sent', 'draft', 'scheduled']),
      sent_count: sentCount,
      delivered_count: Math.floor(sentCount * 0.95),
      opened_count: Math.floor(sentCount * 0.3),
      clicked_count: Math.floor(sentCount * 0.1),
      created_at: randomPastDate(30),
    });
  }

  const { error } = await supabase.from('communication_campaigns').insert(campaigns);
  
  if (error) {
    console.error('Error seeding campaigns:', error);
  } else {
    console.log(`  ✓ Seeded ${campaigns.length} campaigns`);
  }
}

async function seedContactScores(organizerId) {
  console.log(`\nCalculating contact scores...`);
  
  // Call the scoring function
  const { data, error } = await supabase.rpc('calculate_organizer_scores', {
    p_organizer_id: organizerId
  });

  if (error) {
    console.log('  Note: Scoring function may need to run after more data is available');
  } else {
    console.log(`  ✓ Calculated scores for ${data || 0} contacts`);
  }
}

async function seedSmartSegments(organizerId) {
  console.log(`\nCreating smart segments...`);
  
  const { error } = await supabase.rpc('create_default_smart_segments', {
    p_organizer_id: organizerId
  });

  if (error) {
    console.log('  Note: Smart segments may already exist or function not available');
  } else {
    console.log(`  ✓ Created default smart segments`);
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          TICKETRACK TEST DATA SEEDER                       ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Generating realistic test data for the application       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Get or create test organizer
    const organizerId = await getOrCreateTestOrganizer();
    
    if (!organizerId) {
      console.log('\n⚠️  No organizer found. Please create one first in the app.');
      console.log('   Then run: ORGANIZER_ID=<your-organizer-id> npm run seed\n');
      process.exit(1);
    }

    // Seed data
    await seedContacts(organizerId, 500);
    await seedEvents(organizerId, 20);
    await seedTicketPurchases(organizerId, 200);
    await seedCommunicationCampaigns(organizerId, 10);
    await seedContactScores(organizerId);
    await seedSmartSegments(organizerId);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    SEEDING COMPLETE!                       ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  Organizer ID: ${organizerId}      ║`);
    console.log('║  Login to your app to see the seeded data                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('\nSeeding failed:', error);
    process.exit(1);
  }
}

main();
