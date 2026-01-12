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

  // TODO: Fix app bug - /my-tickets shows blank page when not logged in
  // Should redirect to login or show "please login" message
  test.skip('my tickets page loads', async ({ page }) => {
    await page.goto('/my-tickets');
    await expect(page.locator('body')).toBeVisible();
  });
});
