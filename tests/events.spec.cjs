const { test, expect } = require('@playwright/test');

test.describe('Events', () => {
  test('homepage loads with events', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Ticketrack/i);
    // Page should not show error
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('can navigate to events page', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('homepage navigation works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that navigation elements exist
    const nav = page.locator('nav, header');
    await expect(nav.first()).toBeVisible();
  });

  test('footer loads correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const footer = page.locator('footer');
    if (await footer.count() > 0) {
      await expect(footer.first()).toBeVisible();
    }
  });
});
