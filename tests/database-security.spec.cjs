const { test, expect } = require('@playwright/test');

// Supabase anon key for your project
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI4MjMxMTgsImV4cCI6MjA0ODM5OTExOH0.5v8maJmcYWbNj_3zWfGSvShtZlU8K79N6fPrGLLs9s4';
const SUPABASE_URL = 'https://bkvbvggngttrizbchygy.supabase.co';

test.describe('API Authorization Security', () => {
  
  test('unauthenticated user cannot access user profiles API', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/profiles`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    // Should return empty array (RLS blocks) or auth error
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('unauthenticated user cannot access orders API', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/orders`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('unauthenticated user cannot access tickets API', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/tickets`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('unauthenticated user cannot access payouts API', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/payouts`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('unauthenticated user cannot access refunds API', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/refunds`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('unauthenticated user cannot access organizer_stripe_accounts', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/organizer_stripe_accounts`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

});

test.describe('Public Data Access (via App)', () => {
  
  test('public can view events page', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    // Events should load for public users
    await expect(page.locator('body')).not.toContainText('Application error');
    // Should see some event content or "no events" message
    await expect(page.locator('body')).toBeVisible();
  });

  test('public can view event details', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    // Click first event if available
    const eventLink = page.locator('a[href*="/e/"]').first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should show event details
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('public can view ticket prices', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    const eventLink = page.locator('a[href*="/e/"]').first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should see pricing info (Free or currency symbol)
      const hasPricing = await page.locator('body').textContent();
      expect(hasPricing.match(/Free|₦|\$|£|GH₵/)).toBeTruthy();
    }
  });

});

test.describe('Write Protection', () => {
  
  test('unauthenticated user cannot INSERT into profiles', async ({ request }) => {
    const response = await request.post(`${SUPABASE_URL}/rest/v1/profiles`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      data: { id: '00000000-0000-0000-0000-000000000000', email: 'hacker@test.com' }
    });
    
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('unauthenticated user cannot INSERT into orders', async ({ request }) => {
    const response = await request.post(`${SUPABASE_URL}/rest/v1/orders`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      data: { user_id: '00000000-0000-0000-0000-000000000000', total_amount: 0 }
    });
    
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('unauthenticated user cannot INSERT into tickets', async ({ request }) => {
    const response = await request.post(`${SUPABASE_URL}/rest/v1/tickets`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      data: { user_id: '00000000-0000-0000-0000-000000000000', status: 'active' }
    });
    
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('unauthenticated user cannot UPDATE events', async ({ request }) => {
    const response = await request.patch(`${SUPABASE_URL}/rest/v1/events?id=eq.00000000-0000-0000-0000-000000000000`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      data: { title: 'HACKED EVENT' }
    });
    
    // RLS blocks update - either error or no rows affected
    expect([204, 401, 403, 404]).toContain(response.status());
  });

  test('unauthenticated user cannot DELETE events', async ({ request }) => {
    const response = await request.delete(`${SUPABASE_URL}/rest/v1/events?id=eq.00000000-0000-0000-0000-000000000000`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    expect([204, 401, 403, 404]).toContain(response.status());
  });

});

test.describe('Sensitive Data Protection', () => {
  
  test('cannot access admin_users table', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/admin_users`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('cannot access api_keys table', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/api_keys`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('cannot access audit_logs directly', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/audit_logs`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('cannot access platform_settings', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/platform_settings`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

});

test.describe('Financial Data Protection', () => {
  
  test('cannot access payout_batches', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/payout_batches`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('cannot access withdrawal_requests', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/withdrawal_requests`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

  test('cannot access organizer_balances', async ({ request }) => {
    const response = await request.get(`${SUPABASE_URL}/rest/v1/organizer_balances`, {
      headers: { 'apikey': ANON_KEY, 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    expect(data.length === 0 || response.status() >= 400).toBeTruthy();
  });

});
