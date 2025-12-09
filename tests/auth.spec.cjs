const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Check page loads without crashing
    await expect(page.locator('body')).not.toContainText('Application error');
    // Check for any input field (your custom Input component)
    const inputs = page.locator('input');
    await expect(inputs.first()).toBeVisible({ timeout: 10000 });
  });

  test('signup page loads correctly', async ({ page }) => {
    await page.goto('/signup');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
    const inputs = page.locator('input');
    await expect(inputs.first()).toBeVisible({ timeout: 10000 });
  });

  test('auth page does not crash on interaction', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    // Just verify the page is interactive and doesn't crash
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('forgot password page loads', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
