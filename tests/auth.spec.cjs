const { test, expect } = require('@playwright/test');

test.describe('Authentication', () => {
  test('login page does not show application error', async ({ page }) => {
    await page.goto('/login');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

  test('signup page does not show application error', async ({ page }) => {
    await page.goto('/signup');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

  test('forgot password page does not show application error', async ({ page }) => {
    await page.goto('/forgot-password');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });
});
