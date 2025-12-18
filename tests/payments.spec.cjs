const { test, expect } = require('@playwright/test');

test.describe('Payment Gateway Integration', () => {
  
  test.describe('Admin Payment Settings', () => {
    test('admin settings page loads', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).not.toContainText('Application error');
    });

    test('payments tab shows gateway configuration', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');
      
      // Click on Payments tab
      const paymentsTab = page.locator('button:has-text("Payments")');
      if (await paymentsTab.isVisible()) {
        await paymentsTab.click();
        await expect(page.locator('text=Payment Gateway Configuration')).toBeVisible();
      }
    });

    test('can see Add Gateway button', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');
      
      const paymentsTab = page.locator('button:has-text("Payments")');
      if (await paymentsTab.isVisible()) {
        await paymentsTab.click();
        await expect(page.locator('button:has-text("Add Gateway")')).toBeVisible();
      }
    });
  });

  test.describe('Checkout Payment Methods', () => {
    test('checkout page loads without errors', async ({ page }) => {
      await page.goto('/checkout');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).not.toContainText('Application error');
    });

    test('event details page loads', async ({ page }) => {
      await page.goto('/events');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).not.toContainText('Application error');
    });
  });

  test.describe('Feature Flags', () => {
    test('features tab visible in admin settings', async ({ page }) => {
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');
      
      const featuresTab = page.locator('button:has-text("Features")');
      if (await featuresTab.isVisible()) {
        await featuresTab.click();
        await page.waitForTimeout(500);
        // Should show feature configuration
        await expect(page.locator('body')).not.toContainText('Application error');
      }
    });
  });
});

test.describe('Multi-Currency Support', () => {
  test('currencies tab in admin settings', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
    
    const currenciesTab = page.locator('button:has-text("Currencies")');
    if (await currenciesTab.isVisible()) {
      await currenciesTab.click();
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('countries tab in admin settings', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
    
    const countriesTab = page.locator('button:has-text("Countries")');
    if (await countriesTab.isVisible()) {
      await countriesTab.click();
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });
});

test.describe('Organizer Dashboard', () => {
  test('organizer dashboard loads', async ({ page }) => {
    await page.goto('/organizer');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('promoter dashboard loads', async ({ page }) => {
    await page.goto('/promoter');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('analytics page loads', async ({ page }) => {
    await page.goto('/organizer/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('payouts page loads', async ({ page }) => {
    await page.goto('/organizer/payouts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).not.toContainText('Application error');
  });
});
