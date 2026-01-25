/**
 * Account Recovery Flow Test
 * 
 * Tests the phone number recovery flow
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5175';

async function testAccountRecoveryFlow() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('\n🧪 Testing Account Recovery Flow\n');
  console.log('='.repeat(50));

  try {
    // Test 1: Navigate to login page
    console.log('\n📍 Test 1: Navigate to Login Page');
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    console.log('✅ Login page loaded');
    
    // Wait for page to render
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/01-login-page.png' });
    
    // Test 2: Find "Lost phone access?" link
    console.log('\n📍 Test 2: Find "Lost phone access?" link');
    
    // Check if the link is visible
    const lostPhoneLink = page.locator('text=Lost phone access?').first();
    const isVisible = await lostPhoneLink.isVisible().catch(() => false);
    
    if (!isVisible) {
      // Try alternative link text
      const altLink = page.locator('text=Lost access to phone?').first();
      const altVisible = await altLink.isVisible().catch(() => false);
      
      if (altVisible) {
        console.log('✅ Found "Lost access to phone?" link');
        await altLink.click();
      } else {
        console.log('⚠️ Link not visible on current login method, switching to email login');
        
        // Try clicking email tab if available
        const emailTab = page.locator('button:has-text("Email"), [data-value="email"]').first();
        if (await emailTab.isVisible().catch(() => false)) {
          await emailTab.click();
          await page.waitForTimeout(500);
        }
        
        // Now try to find the link
        const emailLostLink = page.locator('text=Lost phone access?, text=Lost access to phone?').first();
        if (await emailLostLink.isVisible().catch(() => false)) {
          await emailLostLink.click();
          console.log('✅ Clicked "Lost phone access?" link');
        } else {
          // Navigate directly to recovery page
          console.log('⚠️ Navigating directly to /account-recovery');
          await page.goto(`${BASE_URL}/account-recovery`);
        }
      }
    } else {
      await lostPhoneLink.click();
      console.log('✅ Clicked "Lost phone access?" link');
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Take screenshot of recovery page
    await page.screenshot({ path: 'tests/screenshots/02-recovery-options.png' });
    
    // Test 3: Verify recovery page loaded
    console.log('\n📍 Test 3: Verify Recovery Page');
    const pageTitle = await page.locator('text=Account Recovery').first();
    if (await pageTitle.isVisible()) {
      console.log('✅ Account Recovery page loaded');
    } else {
      console.log('❌ Recovery page title not found');
    }
    
    // Test 4: Test Email Recovery option
    console.log('\n📍 Test 4: Test Email Recovery Option');
    const emailRecoveryBtn = page.locator('text=Reset via Email').first();
    if (await emailRecoveryBtn.isVisible()) {
      await emailRecoveryBtn.click();
      await page.waitForTimeout(500);
      
      // Verify email form appeared
      const emailInput = page.locator('input[type="email"]').first();
      if (await emailInput.isVisible()) {
        console.log('✅ Email recovery form displayed');
        
        // Fill in email
        await emailInput.fill('test@example.com');
        await page.screenshot({ path: 'tests/screenshots/03-email-recovery-form.png' });
        console.log('✅ Email filled in form');
        
        // Go back
        const backBtn = page.locator('button:has-text("Back")').first();
        if (await backBtn.isVisible()) {
          await backBtn.click();
          await page.waitForTimeout(500);
        }
      }
    } else {
      console.log('⚠️ Email recovery button not found');
    }
    
    // Test 5: Test Contact Support option
    console.log('\n📍 Test 5: Test Contact Support Option');
    const supportBtn = page.locator('text=Contact Support').first();
    if (await supportBtn.isVisible()) {
      await supportBtn.click();
      await page.waitForTimeout(500);
      
      // Verify support form appeared
      const emailField = page.locator('#support-email').first();
      if (await emailField.isVisible()) {
        console.log('✅ Support request form displayed');
        
        // Fill in form
        await emailField.fill('test@example.com');
        
        const newPhoneField = page.locator('#new-phone').first();
        if (await newPhoneField.isVisible()) {
          await newPhoneField.fill('+2348012345678');
        }
        
        const reasonSelect = page.locator('#reason').first();
        if (await reasonSelect.isVisible()) {
          await reasonSelect.selectOption('lost');
        }
        
        await page.screenshot({ path: 'tests/screenshots/04-support-request-form.png' });
        console.log('✅ Support form filled');
      }
    } else {
      console.log('⚠️ Contact Support button not found');
    }
    
    // Test 6: Navigate back to login
    console.log('\n📍 Test 6: Navigate back to Login');
    const backToLogin = page.locator('text=Back to Login').first();
    if (await backToLogin.isVisible()) {
      await backToLogin.click();
      await page.waitForLoadState('networkidle');
      console.log('✅ Navigated back to login');
    } else {
      // Try clicking the back button
      const backBtn = page.locator('button:has-text("Back")').first();
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(500);
        
        // Now find Back to Login
        const loginLink = page.locator('text=Back to Login').first();
        if (await loginLink.isVisible()) {
          await loginLink.click();
          console.log('✅ Navigated back to login');
        }
      }
    }
    
    await page.screenshot({ path: 'tests/screenshots/05-back-to-login.png' });
    
    console.log('\n' + '='.repeat(50));
    console.log('🎉 Account Recovery Flow Test Complete!');
    console.log('='.repeat(50));
    console.log('\n📸 Screenshots saved to tests/screenshots/');
    
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    await page.screenshot({ path: 'tests/screenshots/error-screenshot.png' });
  } finally {
    // Keep browser open for 5 seconds to see results
    console.log('\n⏳ Closing browser in 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

// Run the test
testAccountRecoveryFlow().catch(console.error);
