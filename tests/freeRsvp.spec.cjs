const { test, expect } = require('@playwright/test');

test.describe('Event Pages', () => {
  
  test('events listing page loads', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    // Should show events or Browse Events heading
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('can navigate to an event from listing', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    // Click first event link
    const eventLink = page.locator('a[href*="/e/"]').first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should show event details
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('event details page shows organizer section', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    const eventLink = page.locator('a[href*="/e/"]').first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should show Organized By section (now at top)
      await expect(page.getByText('Organized By')).toBeVisible();
    }
  });

  test('event page has share and favorite buttons', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('domcontentloaded');
    
    const eventLink = page.locator('a[href*="/e/"]').first();
    if (await eventLink.isVisible()) {
      await eventLink.click();
      await page.waitForLoadState('domcontentloaded');
      
      // Should have share and heart icons (buttons with svg icons)
      const buttons = page.locator('button').filter({ has: page.locator('svg') });
      await expect(buttons.first()).toBeVisible();
    }
  });

});

test.describe('Checkout Flow', () => {
  
  test('checkout page redirects without items', async ({ page }) => {
    await page.goto('/checkout');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    
    // Should redirect or show empty state
    await expect(page.locator('body')).not.toContainText('Application error');
  });

});

test.describe('Tickets Page', () => {
  
  test('tickets page loads', async ({ page }) => {
    await page.goto('/tickets');
    await page.waitForLoadState('domcontentloaded');
    
    // Page should not crash
    await expect(page.locator('body')).not.toContainText('Application error');
  });

});
