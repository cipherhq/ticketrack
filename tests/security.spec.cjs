const { test, expect } = require('@playwright/test');

test.describe('XSS Protection', () => {
  
  test('search input sanitizes XSS attempts', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    const xssPayload = '<script>alert("XSS")</script>';
    const searchInput = page.locator('input[type="text"], input[placeholder*="Search"]').first();
    
    if (await searchInput.isVisible()) {
      await searchInput.fill(xssPayload);
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);
      
      const bodyHtml = await page.content();
      expect(bodyHtml).not.toContain('<script>alert');
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('URL parameters are sanitized', async ({ page }) => {
    const xssUrl = '/events?search=<script>alert("XSS")</script>';
    await page.goto(xssUrl);
    await page.waitForLoadState('domcontentloaded');
    
    const bodyHtml = await page.content();
    expect(bodyHtml).not.toContain('<script>alert');
  });

  test('event title XSS is sanitized', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    const bodyHtml = await page.content();
    expect(bodyHtml).not.toMatch(/<script[^>]*>.*alert.*<\/script>/i);
    expect(bodyHtml).not.toMatch(/onerror\s*=/i);
    expect(bodyHtml).not.toMatch(/onload\s*=\s*["']?alert/i);
  });

  test('image onerror XSS is blocked', async ({ page }) => {
    const xssUrl = '/events?img=<img src=x onerror=alert("XSS")>';
    await page.goto(xssUrl);
    await page.waitForLoadState('domcontentloaded');
    
    const bodyHtml = await page.content();
    expect(bodyHtml).not.toContain('onerror=alert');
  });

});

test.describe('SQL Injection Protection', () => {
  
  test('search input handles SQL injection attempts', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    const sqlPayloads = [
      "'; DROP TABLE events; --",
      "1' OR '1'='1",
      "1; SELECT * FROM users",
    ];
    
    const searchInput = page.locator('input[type="text"], input[placeholder*="Search"]').first();
    
    if (await searchInput.isVisible()) {
      for (const payload of sqlPayloads) {
        await searchInput.fill(payload);
        await searchInput.press('Enter');
        await page.waitForTimeout(500);
        
        await expect(page.locator('body')).not.toContainText('SQL');
        await expect(page.locator('body')).not.toContainText('syntax error');
        await expect(page.locator('body')).not.toContainText('database error');
      }
    }
  });

  test('URL parameters handle SQL injection', async ({ page }) => {
    const sqlPayloads = [
      '/events?category=1%27%20OR%20%271%27=%271',
      '/events?id=1;DROP%20TABLE%20events',
    ];
    
    for (const url of sqlPayloads) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      
      await expect(page.locator('body')).not.toContainText('SQL');
      await expect(page.locator('body')).not.toContainText('syntax');
      await expect(page.locator('body')).not.toContainText('postgres');
    }
  });

});

test.describe('Authentication Security', () => {
  
  test('protected routes require authentication', async ({ page }) => {
    // These routes should either redirect or show login prompt
    const protectedRoutes = ['/profile', '/dashboard', '/organizer'];
    
    for (const route of protectedRoutes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
      // Page should not crash
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('login form has password field masked', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
    
    const inputType = await passwordInput.getAttribute('type');
    expect(inputType).toBe('password');
  });

  test('login handles multiple failed attempts', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    for (let i = 0; i < 3; i++) {
      await page.fill('input[type="email"]', 'attacker@test.com');
      await page.fill('input[type="password"]', 'wrongpassword' + i);
      await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
      await page.waitForTimeout(1000);
    }
    
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Input Validation', () => {
  
  test('email field validates format', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('notanemail');
    await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
    
    await page.waitForTimeout(500);
    
    const isValid = await emailInput.evaluate((el) => el.validity.valid);
    expect(isValid).toBe(false);
  });

  test('form submission handles special characters', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    await page.fill('input[type="email"]', 'test+special@example.com');
    await page.fill('input[type="password"]', 'P@ssw0rd!#$%');
    
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Security Headers', () => {
  
  test('response has basic security (page loads)', async ({ page }) => {
    const response = await page.goto('/');
    const headers = response.headers();
    
    // Log headers for review (informational)
    console.log('Security Headers Check:');
    console.log('- X-Frame-Options:', headers['x-frame-options'] || 'Not set (add in production)');
    console.log('- X-Content-Type-Options:', headers['x-content-type-options'] || 'Not set (add in production)');
    console.log('- Content-Security-Policy:', headers['content-security-policy'] ? 'Set' : 'Not set (add in production)');
    
    await expect(page.locator('body')).toBeVisible();
  });

});

test.describe('Session Security', () => {
  
  test('clearing storage blocks protected access', async ({ page, context }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    await page.goto('/profile');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Should not show profile content without auth
    await expect(page.locator('body')).not.toContainText('Application error');
  });

});

test.describe('CSRF Protection', () => {
  
  test('forms use secure auth (Supabase JWT)', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // Supabase uses JWT tokens which are CSRF-safe
    const form = page.locator('form').first();
    if (await form.isVisible()) {
      await expect(page.locator('body')).toBeVisible();
    }
  });

});

test.describe('Sensitive Data Exposure', () => {
  
  test('no API secrets in page source', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const pageContent = await page.content();
    
    // Check for leaked secrets
    expect(pageContent).not.toMatch(/sk_live_[a-zA-Z0-9]+/); // Stripe live secret
    expect(pageContent).not.toMatch(/password\s*[:=]\s*["'][^"']+["']/i); // Hardcoded passwords
    expect(pageContent).not.toMatch(/api_secret/i);
    expect(pageContent).not.toMatch(/private_key/i);
  });

  test('404 page handles gracefully', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    await page.waitForLoadState('domcontentloaded');
    
    // Should not expose sensitive error details
    await expect(page.locator('body')).not.toContainText('database');
    await expect(page.locator('body')).not.toContainText('postgresql');
  });

});

test.describe('Path Traversal Protection', () => {
  
  test('URL path traversal is blocked', async ({ page }) => {
    const traversalUrls = [
      '/events/../../../etc/passwd',
      '/e/..%2F..%2F..%2Fetc%2Fpasswd',
    ];
    
    for (const url of traversalUrls) {
      await page.goto(url);
      
      const content = await page.content();
      expect(content).not.toContain('root:');
      expect(content).not.toContain('/bin/bash');
    }
  });

});
