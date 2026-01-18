const { test, expect } = require('@playwright/test');

test.describe('Checkout Flow', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Browse Events' }).first()).toBeVisible();
  });

  test('cart page loads', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('button', { name: 'Browse Events' }).first()).toBeVisible();
  });

  test('my tickets page redirects to login when not logged in', async ({ page }) => {
    await page.goto('/my-tickets');
    // Should redirect to login page
    await page.waitForURL(/.*\/login.*/, { timeout: 5000 });
    await expect(page.url()).toContain('/login');
  });
});
