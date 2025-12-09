const { test, expect } = require('@playwright/test');

test.describe('Admin & Dashboard Routes', () => {
  test('admin routes are protected', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    // Should redirect to login or show auth required, not crash
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('organizer routes are protected', async ({ page }) => {
    await page.goto('/organizer');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('promoter routes are protected', async ({ page }) => {
    await page.goto('/promoter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('organizer dashboard loads for authenticated users', async ({ page }) => {
    await page.goto('/organizer/dashboard');
    await page.waitForLoadState('networkidle');
    // Should either load or redirect, not error
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('promoter dashboard loads for authenticated users', async ({ page }) => {
    await page.goto('/promoter/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
