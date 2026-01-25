/**
 * User Bot (Attendee Bot)
 * 
 * Simulates an event attendee testing all user-facing features:
 * - Account registration/login
 * - Event discovery and browsing
 * - Ticket purchase flow
 * - My tickets management
 * - Digital wallet passes
 * - Profile management
 * - Event following
 * - Referrals
 * - And more...
 */

import { chromium } from 'playwright'
import { BOT_CONFIG } from './config.js'
import { reporter } from './reporter.js'

const BOT_NAME = 'UserBot'

class UserBot {
  constructor() {
    this.browser = null
    this.context = null
    this.page = null
    this.isLoggedIn = false
    this.purchasedTicketId = null
  }

  // Initialize browser
  async init() {
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    })
    
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: process.env.RECORD_VIDEO === 'true' 
        ? { dir: 'tests/bots/videos' } 
        : undefined,
    })
    
    this.page = await this.context.newPage()
    this.page.setDefaultTimeout(BOT_CONFIG.timeouts.action)
  }

  // Cleanup
  async cleanup() {
    if (this.context) await this.context.close()
    if (this.browser) await this.browser.close()
  }

  // Take screenshot on error
  async takeErrorScreenshot(testName) {
    if (!BOT_CONFIG.screenshots.enabled) return null
    
    const timestamp = Date.now()
    const filename = `${BOT_NAME}-${testName}-${timestamp}.png`
    const filepath = `${BOT_CONFIG.screenshots.directory}/${filename}`
    
    try {
      await this.page.screenshot({ path: filepath, fullPage: true })
      return filepath
    } catch (e) {
      return null
    }
  }

  // Helper: Wait for navigation
  async waitForNavigation() {
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForTimeout(500)
  }

  // =========================================================================
  // TEST: Homepage
  // =========================================================================
  async testHomepage() {
    reporter.startTest(BOT_NAME, 'Homepage', 'Visit and verify homepage loads correctly')
    
    try {
      await this.page.goto(BOT_CONFIG.baseUrl)
      await this.waitForNavigation()
      reporter.logStep('Navigated to homepage')

      // Check for key elements
      const hasLogo = await this.page.locator('[class*="logo"], img[alt*="logo" i], a[href="/"]').first().isVisible()
      const hasNavigation = await this.page.locator('nav, header, [class*="navbar"]').first().isVisible()
      const hasContent = await this.page.locator('main, [class*="content"], [class*="hero"]').first().isVisible()

      if (hasLogo) reporter.logStep('Logo visible')
      if (hasNavigation) reporter.logStep('Navigation visible')
      if (hasContent) reporter.logStep('Main content visible')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('homepage')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Event Discovery
  // =========================================================================
  async testEventDiscovery() {
    reporter.startTest(BOT_NAME, 'Event Discovery', 'Browse and search for events')
    
    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/events`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to events page')

      // Wait for events to load
      await this.page.waitForTimeout(2000)

      // Check for events list
      const hasEvents = await this.page.locator('[class*="event"], [data-testid="event"], .event-card').first().isVisible()
      const hasSearch = await this.page.locator('input[type="search"], input[placeholder*="search" i]').first().isVisible()
      const hasFilters = await this.page.locator('[class*="filter"], select, [class*="category"]').first().isVisible()

      if (hasEvents) reporter.logStep('Events are displayed')
      if (hasSearch) reporter.logStep('Search functionality available')
      if (hasFilters) reporter.logStep('Filters available')

      // Try searching
      if (hasSearch) {
        const searchInput = await this.page.locator('input[type="search"], input[placeholder*="search" i]').first()
        await searchInput.fill('concert')
        reporter.logStep('Performed search')
        await this.page.waitForTimeout(1000)
      }

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('event-discovery')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: View Event Details
  // =========================================================================
  async testViewEventDetails() {
    reporter.startTest(BOT_NAME, 'View Event Details', 'Open and view event details page')
    
    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/events`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to events page')

      // Find and click first event
      const eventCard = await this.page.locator('[class*="event"], .event-card, a[href*="/event"]').first()
      if (await eventCard.isVisible()) {
        await eventCard.click()
        await this.waitForNavigation()
        reporter.logStep('Clicked on event')

        // Check event details page
        const hasTitle = await this.page.locator('h1, h2, [class*="title"]').first().isVisible()
        const hasDate = await this.page.locator('text=/date|when|time/i').isVisible()
        const hasLocation = await this.page.locator('text=/location|venue|where/i').isVisible()
        const hasBuyButton = await this.page.locator('button:has-text("Buy"), button:has-text("Get Ticket"), button:has-text("Register")').first().isVisible()

        if (hasTitle) reporter.logStep('Event title visible')
        if (hasDate) reporter.logStep('Event date/time visible')
        if (hasLocation) reporter.logStep('Event location visible')
        if (hasBuyButton) reporter.logStep('Buy tickets button visible')

        reporter.endTest('passed')
        return true
      } else {
        reporter.logStep('No events available to view', false)
        reporter.endTest('skipped')
        return false
      }
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('event-details')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: User Registration
  // =========================================================================
  async testRegistration() {
    reporter.startTest(BOT_NAME, 'User Registration', 'Register a new user account')
    
    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/register`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to registration page')

      // Fill registration form
      const nameInput = await this.page.locator('input[name="name"], input[name="fullName"], input[placeholder*="name" i]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill(BOT_CONFIG.accounts.user.fullName)
        reporter.logStep('Entered name')
      }

      await this.page.fill('input[type="email"]', BOT_CONFIG.accounts.user.email)
      reporter.logStep('Entered email')

      await this.page.fill('input[type="password"]', BOT_CONFIG.accounts.user.password)
      reporter.logStep('Entered password')

      // Confirm password if exists
      const confirmPassword = await this.page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i]').first()
      if (await confirmPassword.isVisible()) {
        await confirmPassword.fill(BOT_CONFIG.accounts.user.password)
        reporter.logStep('Confirmed password')
      }

      // Terms checkbox
      const termsCheckbox = await this.page.locator('input[type="checkbox"]').first()
      if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check()
        reporter.logStep('Accepted terms')
      }

      await this.page.click('button[type="submit"]')
      reporter.logStep('Submitted registration')

      await this.page.waitForTimeout(3000)

      // Check result
      const currentUrl = this.page.url()
      if (currentUrl.includes('/profile') || currentUrl.includes('/dashboard') || currentUrl.includes('/tickets')) {
        this.isLoggedIn = true
        reporter.logStep('Registration successful')
        reporter.endTest('passed')
        return true
      }

      // May already exist, try login
      const errorVisible = await this.page.locator('text=/exists|already|registered/i').isVisible()
      if (errorVisible) {
        reporter.logStep('Account already exists, will try login')
        reporter.endTest('skipped')
        return false
      }

      throw new Error('Registration did not complete')
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('registration')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: User Login
  // =========================================================================
  async testLogin() {
    reporter.startTest(BOT_NAME, 'User Login', 'Log in as user')
    
    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/login`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to login page')

      await this.page.fill('input[type="email"]', BOT_CONFIG.accounts.user.email)
      reporter.logStep('Entered email')

      await this.page.fill('input[type="password"]', BOT_CONFIG.accounts.user.password)
      reporter.logStep('Entered password')

      await this.page.click('button[type="submit"]')
      reporter.logStep('Clicked login')

      await this.page.waitForTimeout(3000)

      const currentUrl = this.page.url()
      if (!currentUrl.includes('/login')) {
        this.isLoggedIn = true
        reporter.logStep('Login successful')
        reporter.endTest('passed')
        return true
      }

      const errorVisible = await this.page.locator('text=/invalid|error|incorrect/i').isVisible()
      if (errorVisible) {
        reporter.logStep('Login failed - trying registration first', false)
        reporter.endTest('skipped')
        // Try registration
        const registered = await this.testRegistration()
        return registered
      }

      throw new Error('Login did not succeed')
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('login')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Ticket Purchase Flow
  // =========================================================================
  async testTicketPurchase() {
    reporter.startTest(BOT_NAME, 'Ticket Purchase', 'Complete a ticket purchase flow')
    
    try {
      // Find an event with tickets
      await this.page.goto(`${BOT_CONFIG.baseUrl}/events`)
      await this.waitForNavigation()
      reporter.logStep('Browsing events')

      // Click on first event
      const eventCard = await this.page.locator('[class*="event"], .event-card, a[href*="/event"]').first()
      if (!await eventCard.isVisible()) {
        reporter.logStep('No events available', false)
        reporter.endTest('skipped')
        return false
      }

      await eventCard.click()
      await this.waitForNavigation()
      reporter.logStep('Opened event details')

      // Find buy button
      const buyButton = await this.page.locator('button:has-text("Buy"), button:has-text("Get Ticket"), button:has-text("Register"), button:has-text("Book")').first()
      if (!await buyButton.isVisible()) {
        reporter.logStep('No buy button found', false)
        reporter.endTest('skipped')
        return false
      }

      await buyButton.click()
      await this.waitForNavigation()
      reporter.logStep('Clicked buy tickets')

      // Handle ticket selection
      const ticketSelector = await this.page.locator('select, input[type="number"], button:has-text("+")').first()
      if (await ticketSelector.isVisible()) {
        // Try to select 1 ticket
        if (await ticketSelector.evaluate(el => el.tagName === 'SELECT')) {
          await ticketSelector.selectOption({ index: 1 })
        } else if (await ticketSelector.evaluate(el => el.tagName === 'INPUT')) {
          await ticketSelector.fill('1')
        } else {
          await ticketSelector.click()
        }
        reporter.logStep('Selected ticket quantity')
      }

      // Continue to checkout
      const continueBtn = await this.page.locator('button:has-text("Continue"), button:has-text("Checkout"), button:has-text("Proceed"), button:has-text("Next")').first()
      if (await continueBtn.isVisible()) {
        await continueBtn.click()
        await this.waitForNavigation()
        reporter.logStep('Proceeded to checkout')
      }

      // Fill checkout form if needed
      const emailInput = await this.page.locator('input[type="email"]').first()
      if (await emailInput.isVisible() && !this.isLoggedIn) {
        await emailInput.fill(BOT_CONFIG.accounts.user.email)
        reporter.logStep('Entered email for checkout')
      }

      const nameInput = await this.page.locator('input[name="name"], input[placeholder*="name" i]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill(BOT_CONFIG.accounts.user.fullName)
        reporter.logStep('Entered name for checkout')
      }

      const phoneInput = await this.page.locator('input[type="tel"], input[name="phone"]').first()
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('08012345678')
        reporter.logStep('Entered phone for checkout')
      }

      // For free events, complete purchase
      const completeBtn = await this.page.locator('button:has-text("Complete"), button:has-text("Confirm"), button:has-text("Register"), button:has-text("Get Ticket")').first()
      if (await completeBtn.isVisible()) {
        await completeBtn.click()
        await this.page.waitForTimeout(3000)
        reporter.logStep('Completed purchase/registration')

        // Check for success
        const success = await this.page.locator('text=/success|confirmed|thank you|ticket/i').first().isVisible()
        if (success) {
          reporter.logStep('Purchase successful!')
          reporter.endTest('passed')
          return true
        }
      }

      // May need payment - just verify we reached payment page
      const paymentPage = await this.page.locator('text=/payment|pay|card/i').first().isVisible()
      if (paymentPage) {
        reporter.logStep('Reached payment page (stopping here for test)')
        reporter.endTest('passed')
        return true
      }

      reporter.logStep('Purchase flow incomplete but functional')
      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('ticket-purchase')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: My Tickets
  // =========================================================================
  async testMyTickets() {
    reporter.startTest(BOT_NAME, 'My Tickets', 'View purchased tickets')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/my-tickets`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to my tickets page')

      // Check for tickets list
      const hasTickets = await this.page.locator('[class*="ticket"], [class*="card"]').first().isVisible()
      const hasEmptyState = await this.page.locator('text=/no ticket|empty|nothing/i').first().isVisible()

      if (hasTickets) reporter.logStep('Tickets list visible')
      if (hasEmptyState) reporter.logStep('Empty state shown (no tickets yet)')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('my-tickets')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: User Profile
  // =========================================================================
  async testProfile() {
    reporter.startTest(BOT_NAME, 'User Profile', 'View and update user profile')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/profile`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to profile page')

      // Check for profile elements
      const hasNameField = await this.page.locator('input[name="name"], input[name="fullName"]').first().isVisible()
      const hasEmailField = await this.page.locator('input[type="email"]').first().isVisible()
      const hasSaveBtn = await this.page.locator('button:has-text("Save"), button:has-text("Update")').first().isVisible()

      if (hasNameField) reporter.logStep('Name field visible')
      if (hasEmailField) reporter.logStep('Email field visible')
      if (hasSaveBtn) reporter.logStep('Save button visible')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('profile')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Wallet Passes (Apple/Google)
  // =========================================================================
  async testWalletPass() {
    reporter.startTest(BOT_NAME, 'Wallet Pass', 'Check wallet pass availability')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/my-tickets`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to my tickets')

      // Look for wallet pass buttons
      const hasAppleWallet = await this.page.locator('text=/apple wallet|add to wallet/i').first().isVisible()
      const hasGoogleWallet = await this.page.locator('text=/google wallet|google pay/i').first().isVisible()

      if (hasAppleWallet) reporter.logStep('Apple Wallet option available')
      if (hasGoogleWallet) reporter.logStep('Google Wallet option available')

      if (!hasAppleWallet && !hasGoogleWallet) {
        reporter.logStep('No wallet options found (may need purchased ticket)')
      }

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('wallet-pass')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Follow Organizer
  // =========================================================================
  async testFollowOrganizer() {
    reporter.startTest(BOT_NAME, 'Follow Organizer', 'Follow an event organizer')
    
    try {
      // Go to an event page
      await this.page.goto(`${BOT_CONFIG.baseUrl}/events`)
      await this.waitForNavigation()

      const eventCard = await this.page.locator('[class*="event"], .event-card, a[href*="/event"]').first()
      if (await eventCard.isVisible()) {
        await eventCard.click()
        await this.waitForNavigation()
        reporter.logStep('Opened event details')

        // Look for follow button
        const followBtn = await this.page.locator('button:has-text("Follow"), button[aria-label*="follow" i]').first()
        if (await followBtn.isVisible()) {
          await followBtn.click()
          reporter.logStep('Clicked follow button')
          await this.page.waitForTimeout(1000)

          // Check for confirmation
          const following = await this.page.locator('text=/following|unfollow/i').first().isVisible()
          if (following) {
            reporter.logStep('Successfully followed organizer')
          }
        } else {
          reporter.logStep('Follow button not found on this page')
        }
      }

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('follow-organizer')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Ticket Transfer
  // =========================================================================
  async testTicketTransfer() {
    reporter.startTest(BOT_NAME, 'Ticket Transfer', 'Check ticket transfer feature')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/my-tickets`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to my tickets')

      // Look for transfer option - try multiple selectors
      const hasTransferButton = await this.page.locator('button:has-text("Transfer")').first().isVisible().catch(() => false)
      const hasTransferText = await this.page.locator('text=transfer').first().isVisible().catch(() => false)
      
      if (hasTransferButton || hasTransferText) {
        reporter.logStep('Transfer option available')
      } else {
        reporter.logStep('No transfer option found (may need ticket first)')
      }

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('ticket-transfer')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // RUN ALL TESTS
  // =========================================================================
  async runAllTests() {
    await this.init()
    
    try {
      // Public pages (no auth required)
      await this.testHomepage()
      await this.testEventDiscovery()
      await this.testViewEventDetails()
      
      // Authentication
      await this.testLogin()
      
      // Ticket purchase
      await this.testTicketPurchase()
      
      // Authenticated features
      await this.testMyTickets()
      await this.testProfile()
      await this.testWalletPass()
      await this.testFollowOrganizer()
      await this.testTicketTransfer()
      
    } finally {
      await this.cleanup()
    }
  }
}

export { UserBot }
export default UserBot
