/**
 * Ticketrack k6 Load Testing Suite
 * 
 * Stress tests the application with simulated concurrent users:
 * - Homepage load
 * - Events listing
 * - Event details
 * - API endpoints
 * - Ticket purchase simulation
 * 
 * Installation: brew install k6 (macOS) or https://k6.io/docs/getting-started/installation/
 * 
 * Run: k6 run tests/load/k6-load-test.js
 * Run with dashboard: k6 run --out web-dashboard tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const homepageLoad = new Trend('homepage_load_time');
const eventsLoad = new Trend('events_load_time');
const apiLatency = new Trend('api_latency');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://ticketrack.com';
const SUPABASE_URL = __ENV.SUPABASE_URL || 'https://bkvbvggngttrizbchygy.supabase.co';
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY || '';

// Test stages - ramp up, sustain, ramp down
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 50 },    // Stay at 50 users
    { duration: '1m', target: 100 },   // Spike to 100 users
    { duration: '30s', target: 100 },  // Stay at 100
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95% of requests under 3s
    http_req_failed: ['rate<0.05'],      // Less than 5% failures
    errors: ['rate<0.1'],                 // Less than 10% errors
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function randomSleep(min = 1, max = 3) {
  sleep(Math.random() * (max - min) + min);
}

function getRandomEvent(events) {
  if (!events || events.length === 0) return null;
  return events[Math.floor(Math.random() * events.length)];
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

export default function () {
  // Each virtual user runs through these scenarios
  
  group('Homepage Load', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/`);
    homepageLoad.add(Date.now() - start);
    
    const success = check(res, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage has content': (r) => r.body.length > 1000,
      'homepage loads fast': (r) => r.timings.duration < 2000,
    });
    
    errorRate.add(!success);
    randomSleep(1, 2);
  });

  group('Events Page', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/events`);
    eventsLoad.add(Date.now() - start);
    
    const success = check(res, {
      'events page status is 200': (r) => r.status === 200,
      'events page has content': (r) => r.body.length > 500,
    });
    
    errorRate.add(!success);
    randomSleep(2, 4);
  });

  // API calls (if Supabase key is provided)
  if (SUPABASE_ANON_KEY) {
    group('API - Fetch Events', () => {
      const start = Date.now();
      const res = http.get(
        `${SUPABASE_URL}/rest/v1/events?select=id,title,start_date&is_published=eq.true&limit=20`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      apiLatency.add(Date.now() - start);
      
      const success = check(res, {
        'API events status is 200': (r) => r.status === 200,
        'API returns array': (r) => {
          try {
            const data = JSON.parse(r.body);
            return Array.isArray(data);
          } catch {
            return false;
          }
        },
      });
      
      errorRate.add(!success);
      randomSleep(0.5, 1);
    });

    group('API - Fetch Single Event', () => {
      // First get list of events
      const listRes = http.get(
        `${SUPABASE_URL}/rest/v1/events?select=id&is_published=eq.true&limit=10`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );

      if (listRes.status === 200) {
        try {
          const events = JSON.parse(listRes.body);
          const event = getRandomEvent(events);
          
          if (event) {
            const start = Date.now();
            const res = http.get(
              `${SUPABASE_URL}/rest/v1/events?id=eq.${event.id}&select=*,ticket_types(*)`,
              {
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
              }
            );
            apiLatency.add(Date.now() - start);
            
            check(res, {
              'single event status is 200': (r) => r.status === 200,
            });
          }
        } catch (e) {
          console.log('Error parsing events:', e);
        }
      }
      
      randomSleep(1, 2);
    });

    group('API - Search Events', () => {
      const searchTerms = ['music', 'party', 'conference', 'lagos', 'tech', 'art'];
      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];
      
      const start = Date.now();
      const res = http.get(
        `${SUPABASE_URL}/rest/v1/events?select=id,title&title=ilike.*${term}*&limit=10`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          },
        }
      );
      apiLatency.add(Date.now() - start);
      
      check(res, {
        'search status is 200': (r) => r.status === 200,
      });
      
      randomSleep(0.5, 1);
    });
  }

  group('Static Assets', () => {
    // Test loading common static assets
    const assets = [
      '/favicon.png',
      '/ticketrackLogo.png',
    ];
    
    for (const asset of assets) {
      const res = http.get(`${BASE_URL}${asset}`);
      check(res, {
        [`${asset} loads`]: (r) => r.status === 200 || r.status === 304,
      });
    }
    
    randomSleep(0.5, 1);
  });

  // Simulate browsing behavior
  group('User Browsing Flow', () => {
    // 1. Land on homepage
    http.get(`${BASE_URL}/`);
    randomSleep(2, 4);
    
    // 2. Browse events
    http.get(`${BASE_URL}/events`);
    randomSleep(3, 6);
    
    // 3. Maybe check login page
    if (Math.random() > 0.5) {
      http.get(`${BASE_URL}/login`);
      randomSleep(1, 2);
    }
    
    // 4. Maybe check about/FAQ
    if (Math.random() > 0.7) {
      http.get(`${BASE_URL}/about`);
      randomSleep(1, 3);
    }
  });
}

// ============================================================================
// SETUP & TEARDOWN
// ============================================================================

export function setup() {
  console.log('Starting load test...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Supabase URL: ${SUPABASE_URL}`);
  
  // Verify services are up
  const res = http.get(`${BASE_URL}/`);
  if (res.status !== 200) {
    console.warn(`Warning: Base URL returned status ${res.status}`);
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nLoad test completed in ${duration.toFixed(2)} seconds`);
}

// ============================================================================
// CUSTOM SCENARIOS (can be run separately)
// ============================================================================

// Spike test - sudden traffic surge
export function spikeTest() {
  return {
    stages: [
      { duration: '10s', target: 10 },
      { duration: '1m', target: 200 },  // Spike!
      { duration: '10s', target: 200 },
      { duration: '30s', target: 0 },
    ],
  };
}

// Soak test - sustained load over time
export function soakTest() {
  return {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '30m', target: 50 },  // Sustain for 30 minutes
      { duration: '2m', target: 0 },
    ],
  };
}

// Stress test - find breaking point
export function stressTest() {
  return {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '5m', target: 300 },
      { duration: '2m', target: 0 },
    ],
  };
}
