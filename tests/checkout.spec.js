const { test, expect } = require('@playwright/test');

test.describe('Checkout Flow', () => {
  test('checkout page structure exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Basic smoke test - page loads without crashing
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('cart page loads', async ({ page }) => {
    await page.goto('/cart');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('my tickets page loads', async ({ page }) => {
    await page.goto('/my-tickets');
    await page.waitForLoadState('networkidle');
    // Should either show tickets or redirect to login
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
