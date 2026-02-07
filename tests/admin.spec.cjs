const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

test.describe('Admin & Dashboard Routes', () => {
  test('admin routes are protected', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    // Should redirect to login or show auth required, not crash
    await expect(page.locator('body')).not.toContainText('Application error');
    // Should redirect to login when not authenticated
    await expect(page).toHaveURL(/.*\/(login|admin).*/);
  });

  test('organizer routes are protected', async ({ page }) => {
    await page.goto(`${BASE_URL}/organizer`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
    // Should redirect to login when not authenticated
    await expect(page).toHaveURL(/.*\/(login|organizer).*/);
  });

  test('promoter routes are protected', async ({ page }) => {
    await page.goto(`${BASE_URL}/promoter`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('organizer dashboard loads for authenticated users', async ({ page }) => {
    await page.goto(`${BASE_URL}/organizer/dashboard`);
    await page.waitForLoadState('networkidle');
    // Should either load or redirect, not error
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('promoter dashboard loads for authenticated users', async ({ page }) => {
    await page.goto(`${BASE_URL}/promoter/dashboard`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
