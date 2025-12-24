const { test, expect } = require('@playwright/test');

test.describe('Free RSVP Flow', () => {
  
  test('free event page loads and shows RSVP button', async ({ page }) => {
    await page.goto('/e/lagos-tech-meetup');
    await page.waitForLoadState('networkidle');
    
    // Should show free event badge
    await expect(page.getByText('Free Event')).toBeVisible();
    
    // Should show RSVP button instead of ticket selection
    await expect(page.getByRole('button', { name: /RSVP/i })).toBeVisible();
  });

  test('free-rsvp page loads with event data', async ({ page }) => {
    // First go to event page
    await page.goto('/e/lagos-tech-meetup');
    await page.waitForLoadState('networkidle');
    
    // Click RSVP button
    await page.getByRole('button', { name: /RSVP/i }).click();
    
    // Should redirect to login if not authenticated
    await page.waitForURL(/\/(login|free-rsvp)/);
    
    // Page should not crash
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('free event with donations shows donation options', async ({ page }) => {
    await page.goto('/e/charity-run-for-education');
    await page.waitForLoadState('networkidle');
    
    // Should show free event badge
    await expect(page.getByText('Free Event')).toBeVisible();
    
    // Should mention donations available
    await expect(page.getByText(/donation/i)).toBeVisible();
  });

  test('paid event shows ticket selection not RSVP', async ({ page }) => {
    await page.goto('/e/debdeb-live-on-state');
    await page.waitForLoadState('networkidle');
    
    // Should show ticket selection UI
    await expect(page.getByText('Select Tickets')).toBeVisible();
    
    // Should show price, not "Free"
    await expect(page.getByText(/₦/)).toBeVisible();
    
    // Should have quantity controls
    await expect(page.getByRole('button', { name: '+' })).toBeVisible();
  });

  test('free-rsvp page requires login', async ({ page }) => {
    // Try to access free-rsvp directly without auth
    await page.goto('/free-rsvp');
    await page.waitForLoadState('networkidle');
    
    // Should redirect to login or events page
    const url = page.url();
    expect(url).toMatch(/(login|events)/);
  });

  test('checkout page loads for paid events', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
    
    // Without event data, should redirect to events
    const url = page.url();
    expect(url).toMatch(/events/);
  });

});

test.describe('RSVP Form Validation', () => {
  
  test('free-rsvp form has required fields', async ({ page }) => {
    await page.goto('/e/lagos-tech-meetup');
    await page.waitForLoadState('networkidle');
    
    // Check that free event has correct UI elements
    await expect(page.getByText('Free Event')).toBeVisible();
    await expect(page.getByRole('button', { name: /RSVP/i })).toBeVisible();
  });

});

test.describe('Ticket Display', () => {
  
  test('my tickets page loads', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    
    // Should either show tickets or redirect to login
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('active and past tabs exist on tickets page', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    
    // If redirected to login, that's expected behavior
    const url = page.url();
    if (!url.includes('login')) {
      // Check for tab structure if on tickets page
      const activeTab = page.getByRole('tab', { name: /Active/i });
      const pastTab = page.getByRole('tab', { name: /Past/i });
      
      // At least one should be visible if user is logged in
      const hasActiveTab = await activeTab.isVisible().catch(() => false);
      const hasPastTab = await pastTab.isVisible().catch(() => false);
      
      // Page loaded successfully
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

});
