const { test, expect } = require('@playwright/test');

test.describe('Events', () => {
  test('homepage loads without errors', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Something went wrong');
  });

  test('events page loads without errors', async ({ page }) => {
    await page.goto('/events');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

  test('homepage has content', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(100);
  });
});
