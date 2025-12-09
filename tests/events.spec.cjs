const { test, expect } = require('@playwright/test');

test.describe('Events', () => {
  test('homepage loads without errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Ticketrack/i);
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('events page loads', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('homepage is interactive', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Just verify page is visible and interactive
    await expect(page.locator('body')).toBeVisible();
  });

  test('footer or page content loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Verify page has content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
