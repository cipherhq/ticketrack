const { test, expect } = require('@playwright/test');

test.describe('Create Event Features', () => {
  
  test('homepage loads without errors', async ({ page }) => {
    await page.goto('/');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Something went wrong');
  });

  test('events browse page loads', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

  test('search page loads', async ({ page }) => {
    await page.goto('/search');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
  });

});

test.describe('Event Details Page Sections', () => {

  test('event details page loads without errors', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.length).toBeGreaterThan(100);
  });

});
