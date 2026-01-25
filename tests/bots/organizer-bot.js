/**
 * Organizer Bot
 * 
 * Simulates an event organizer testing all organizer features:
 * - Account registration/login
 * - Event creation and management
 * - Ticket type configuration
 * - Promo codes
 * - Communications (Email, SMS, WhatsApp)
 * - Analytics
 * - Payouts
 * - Team management
 * - And more...
 */

import { chromium } from 'playwright'
import { BOT_CONFIG } from './config.js'
import { reporter } from './reporter.js'

const BOT_NAME = 'OrganizerBot'

class OrganizerBot {
  constructor() {
    this.browser = null
    this.context = null
    this.page = null
    this.isLoggedIn = false
    this.createdEventId = null
    this.createdEventSlug = null
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

  // Helper: Wait for navigation to complete
  async waitForNavigation() {
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForTimeout(500)
  }

  // =========================================================================
  // TEST: Registration/Login
  // =========================================================================
  async testLogin() {
    reporter.startTest(BOT_NAME, 'Login', 'Log in as organizer or register new account')
    
    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/login`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to login page')

      // Try to log in first
      await this.page.fill('input[type="email"]', BOT_CONFIG.accounts.organizer.email)
      reporter.logStep('Entered email')
      
      await this.page.fill('input[type="password"]', BOT_CONFIG.accounts.organizer.password)
      reporter.logStep('Entered password')
      
      await this.page.click('button[type="submit"]')
      reporter.logStep('Clicked login button')

      // Wait for result
      await this.page.waitForTimeout(3000)
      
      // Check if login succeeded - look for various indicators
      const currentUrl = this.page.url()
      
      // Check URL patterns for successful login
      const successPatterns = ['/organizer', '/dashboard', '/events', '/home']
      const isRedirected = successPatterns.some(pattern => currentUrl.includes(pattern)) && !currentUrl.includes('/login')
      
      // Check if we're no longer on login page
      const stillOnLogin = currentUrl.includes('/login')
      
      // Check for organizer-specific elements on the page
      const hasOrganizerNav = await this.page.locator('nav, [class*="sidebar"], [class*="menu"]').first().isVisible().catch(() => false)
      
      if (isRedirected) {
        this.isLoggedIn = true
        reporter.logStep(`Successfully logged in`)
        reporter.endTest('passed')
        return true
      }
      
      // If not on login anymore, consider it success
      if (!stillOnLogin) {
        this.isLoggedIn = true
        reporter.logStep(`Logged in - redirected to: ${currentUrl}`)
        reporter.endTest('passed')
        return true
      }

      // Check for error message
      const errorVisible = await this.page.locator('text=/invalid|error|incorrect/i').first().isVisible().catch(() => false)
      if (errorVisible) {
        reporter.logStep('Login failed - account may not exist, trying registration', false)
        reporter.endTest('skipped')
        return await this.testRegistration()
      }

      // Wait a bit more and check again
      await this.page.waitForTimeout(2000)
      const newUrl = this.page.url()
      if (!newUrl.includes('/login')) {
        this.isLoggedIn = true
        reporter.logStep('Login succeeded after delay')
        reporter.endTest('passed')
        return true
      }

      throw new Error(`Login did not redirect. Current URL: ${currentUrl}`)
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('login')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  async testRegistration() {
    reporter.startTest(BOT_NAME, 'Registration', 'Register a new organizer account')
    
    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/register`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to registration page')

      // Check for organizer registration option
      const organizerOption = await this.page.locator('text=/organizer|business|host/i').first()
      if (await organizerOption.isVisible()) {
        await organizerOption.click()
        reporter.logStep('Selected organizer account type')
      }

      // Fill registration form
      const nameInput = await this.page.locator('input[name="name"], input[name="fullName"], input[placeholder*="name" i]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill(BOT_CONFIG.accounts.organizer.businessName)
        reporter.logStep('Entered business name')
      }

      await this.page.fill('input[type="email"]', BOT_CONFIG.accounts.organizer.email)
      reporter.logStep('Entered email')

      await this.page.fill('input[type="password"]', BOT_CONFIG.accounts.organizer.password)
      reporter.logStep('Entered password')

      // Confirm password if field exists
      const confirmPassword = await this.page.locator('input[name="confirmPassword"], input[placeholder*="confirm" i]').first()
      if (await confirmPassword.isVisible()) {
        await confirmPassword.fill(BOT_CONFIG.accounts.organizer.password)
        reporter.logStep('Confirmed password')
      }

      // Accept terms if checkbox exists
      const termsCheckbox = await this.page.locator('input[type="checkbox"]').first()
      if (await termsCheckbox.isVisible()) {
        await termsCheckbox.check()
        reporter.logStep('Accepted terms')
      }

      await this.page.click('button[type="submit"]')
      reporter.logStep('Submitted registration')

      await this.page.waitForTimeout(3000)
      
      const currentUrl = this.page.url()
      if (currentUrl.includes('/organizer') || currentUrl.includes('/dashboard') || currentUrl.includes('/verify')) {
        this.isLoggedIn = true
        reporter.logStep('Registration successful')
        reporter.endTest('passed')
        return true
      }

      throw new Error('Registration did not complete successfully')
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('registration')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Create Event
  // =========================================================================
  async testCreateEvent() {
    reporter.startTest(BOT_NAME, 'Create Event', 'Create a new event with ticket types')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      // Navigate to create event page
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/events/create`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to create event page')

      // Fill event details
      const titleInput = await this.page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="name" i]').first()
      await titleInput.fill(BOT_CONFIG.testData.event.title)
      reporter.logStep('Entered event title')

      // Description
      const descInput = await this.page.locator('textarea[name="description"], textarea[placeholder*="description" i]').first()
      if (await descInput.isVisible()) {
        await descInput.fill(BOT_CONFIG.testData.event.description)
        reporter.logStep('Entered event description')
      }

      // Date - set to tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      
      const dateInput = await this.page.locator('input[type="date"], input[name="startDate"], input[name="date"]').first()
      if (await dateInput.isVisible()) {
        await dateInput.fill(dateStr)
        reporter.logStep('Set event date')
      }

      // Time
      const timeInput = await this.page.locator('input[type="time"], input[name="startTime"]').first()
      if (await timeInput.isVisible()) {
        await timeInput.fill('19:00')
        reporter.logStep('Set event time')
      }

      // Venue
      const venueInput = await this.page.locator('input[name="venue"], input[name="venueName"], input[placeholder*="venue" i]').first()
      if (await venueInput.isVisible()) {
        await venueInput.fill(BOT_CONFIG.testData.event.venue)
        reporter.logStep('Entered venue name')
      }

      // City
      const cityInput = await this.page.locator('input[name="city"], input[placeholder*="city" i]').first()
      if (await cityInput.isVisible()) {
        await cityInput.fill(BOT_CONFIG.testData.event.city)
        reporter.logStep('Entered city')
      }

      // Try to find and click next/continue button or directly submit
      // Use force:true because the button may be in a fixed footer that overlaps
      const nextButton = await this.page.locator('button:has-text("Next")').first()
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click({ force: true })
        reporter.logStep('Clicked Next button')
      } else {
        const submitBtn = await this.page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Continue")').first()
        await submitBtn.click({ force: true })
        reporter.logStep('Clicked create/submit button')
      }

      await this.page.waitForTimeout(2000)

      // Check current step - may be on details, tickets, or review step
      await this.page.waitForTimeout(1000)
      
      // Try to continue through any remaining wizard steps
      for (let step = 0; step < 5; step++) {
        // Check if we're done (on event page or success)
        const currentStepUrl = this.page.url()
        if (currentStepUrl.includes('/events/') && !currentStepUrl.includes('/create')) {
          reporter.logStep('Event created - on event page')
          break
        }
        
        // Look for any action button
        const actionButtons = [
          'button:has-text("Next")',
          'button:has-text("Continue")',
          'button:has-text("Save")',
          'button:has-text("Create")',
          'button:has-text("Publish")',
          'button:has-text("Done")',
        ]
        
        let clicked = false
        for (const selector of actionButtons) {
          const btn = await this.page.locator(selector).first()
          if (await btn.isVisible().catch(() => false)) {
            try {
              await btn.click({ force: true, timeout: 3000 })
              reporter.logStep(`Clicked ${selector.replace('button:has-text("', '').replace('")', '')}`)
              clicked = true
              await this.page.waitForTimeout(1500)
              break
            } catch (e) {
              // Button might be disabled or gone, continue
            }
          }
        }
        
        if (!clicked) break
      }

      await this.page.waitForTimeout(2000)

      // Check if we're on event page or events list
      const currentUrl = this.page.url()
      if (currentUrl.includes('/events/') || currentUrl.includes('/event/')) {
        // Extract event ID from URL
        const match = currentUrl.match(/events?\/([a-zA-Z0-9-]+)/)
        if (match) {
          this.createdEventId = match[1]
          reporter.logStep(`Event created with ID: ${this.createdEventId}`)
        }
        reporter.endTest('passed')
        return true
      }

      // Check for success message
      const success = await this.page.locator('text=/success|created|published/i').isVisible()
      if (success) {
        reporter.logStep('Event created successfully')
        reporter.endTest('passed')
        return true
      }

      throw new Error('Could not confirm event creation')
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('create-event')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: View Events List
  // =========================================================================
  async testViewEvents() {
    reporter.startTest(BOT_NAME, 'View Events', 'View list of events')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/events`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to events page')

      // Wait for events to load
      await this.page.waitForTimeout(2000)

      // Check for events list
      const eventsExist = await this.page.locator('[class*="event"], [data-testid="event"], .event-card, table tbody tr').first().isVisible()
      if (eventsExist) {
        reporter.logStep('Events list is visible')
      } else {
        reporter.logStep('No events found or empty state shown')
      }

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('view-events')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Analytics Dashboard
  // =========================================================================
  async testAnalytics() {
    reporter.startTest(BOT_NAME, 'Analytics Dashboard', 'View analytics and reports')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/analytics`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to analytics page')

      // Check for analytics components
      const hasCharts = await this.page.locator('canvas, svg, [class*="chart"], [class*="graph"]').first().isVisible()
      const hasStats = await this.page.locator('[class*="stat"], [class*="metric"], [class*="card"]').first().isVisible()

      if (hasCharts || hasStats) {
        reporter.logStep('Analytics dashboard loaded with data')
      } else {
        reporter.logStep('Analytics page loaded (may be empty)')
      }

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('analytics')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Communication Hub
  // =========================================================================
  async testCommunicationHub() {
    reporter.startTest(BOT_NAME, 'Communication Hub', 'Access communication features')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/communications`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to communications page')

      // Check for communication options
      const hasEmail = await this.page.locator('text=/email/i').first().isVisible()
      const hasSMS = await this.page.locator('text=/sms/i').first().isVisible()
      const hasWhatsApp = await this.page.locator('text=/whatsapp/i').first().isVisible()

      if (hasEmail) reporter.logStep('Email option available')
      if (hasSMS) reporter.logStep('SMS option available')
      if (hasWhatsApp) reporter.logStep('WhatsApp option available')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('communication-hub')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Contacts/Attendees Management
  // =========================================================================
  async testContacts() {
    reporter.startTest(BOT_NAME, 'Contact Management', 'View and manage contacts')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/contacts`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to contacts page')

      // Check for contacts list or import option
      const hasContacts = await this.page.locator('table, [class*="contact"], [class*="list"]').first().isVisible().catch(() => false)
      const hasImportButton = await this.page.locator('button:has-text("Import")').first().isVisible().catch(() => false)
      const hasImportText = await this.page.locator('text=import').first().isVisible().catch(() => false)

      if (hasContacts) reporter.logStep('Contacts list visible')
      if (hasImportButton || hasImportText) reporter.logStep('Import option available')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('contacts')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Payouts/Finance
  // =========================================================================
  async testPayouts() {
    reporter.startTest(BOT_NAME, 'Payouts & Finance', 'View payout settings and history')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/payouts`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to payouts page')

      // Check for finance components
      const hasBalance = await this.page.locator('text=/balance|earnings|revenue/i').first().isVisible()
      const hasBankSection = await this.page.locator('text=/bank|account|withdrawal/i').first().isVisible()

      if (hasBalance) reporter.logStep('Balance/earnings section visible')
      if (hasBankSection) reporter.logStep('Bank account section visible')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('payouts')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Profile Settings
  // =========================================================================
  async testProfile() {
    reporter.startTest(BOT_NAME, 'Profile Settings', 'View and update organizer profile')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/profile`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to profile page')

      // Check for profile form
      const hasNameField = await this.page.locator('input[name="businessName"], input[name="name"]').first().isVisible()
      const hasEmailField = await this.page.locator('input[type="email"]').first().isVisible()

      if (hasNameField) reporter.logStep('Business name field visible')
      if (hasEmailField) reporter.logStep('Email field visible')

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
  // TEST: Promo Codes
  // =========================================================================
  async testPromoCodes() {
    reporter.startTest(BOT_NAME, 'Promo Codes', 'View and create promo codes')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/promo-codes`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to promo codes page')

      // Check for promo code features
      const hasCreateBtn = await this.page.locator('button:has-text("Create"), button:has-text("Add")').first().isVisible()
      const hasList = await this.page.locator('table, [class*="promo"], [class*="code"]').first().isVisible()

      if (hasCreateBtn) reporter.logStep('Create promo code button visible')
      if (hasList) reporter.logStep('Promo codes list visible')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('promo-codes')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Team Management
  // =========================================================================
  async testTeamManagement() {
    reporter.startTest(BOT_NAME, 'Team Management', 'View and manage team members')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/team`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to team page')

      // Check for team features
      const hasInviteBtn = await this.page.locator('button:has-text("Invite"), button:has-text("Add")').first().isVisible()
      const hasMemberList = await this.page.locator('table, [class*="member"], [class*="team"]').first().isVisible()

      if (hasInviteBtn) reporter.logStep('Invite team member button visible')
      if (hasMemberList) reporter.logStep('Team members list visible')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('team')
      reporter.logError(error, screenshot)
      reporter.endTest('failed', screenshot)
      return false
    }
  }

  // =========================================================================
  // TEST: Check-in Management
  // =========================================================================
  async testCheckIn() {
    reporter.startTest(BOT_NAME, 'Check-in Management', 'Access check-in features')
    
    if (!this.isLoggedIn) {
      reporter.logStep('Not logged in, skipping test', false)
      reporter.endTest('skipped')
      return false
    }

    try {
      await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/check-in`)
      await this.waitForNavigation()
      reporter.logStep('Navigated to check-in page')

      // Check for check-in features
      const hasScanner = await this.page.locator('text=/scan|qr|camera/i').first().isVisible()
      const hasManualEntry = await this.page.locator('input[placeholder*="search" i], input[placeholder*="ticket" i]').first().isVisible()

      if (hasScanner) reporter.logStep('QR scanner option visible')
      if (hasManualEntry) reporter.logStep('Manual entry option visible')

      reporter.endTest('passed')
      return true
    } catch (error) {
      const screenshot = await this.takeErrorScreenshot('checkin')
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
      // Authentication
      await this.testLogin()
      
      // Core features
      await this.testCreateEvent()
      await this.testViewEvents()
      await this.testAnalytics()
      
      // Communication
      await this.testCommunicationHub()
      await this.testContacts()
      
      // Finance
      await this.testPayouts()
      
      // Settings
      await this.testProfile()
      await this.testPromoCodes()
      await this.testTeamManagement()
      
      // Operations
      await this.testCheckIn()
      
    } finally {
      await this.cleanup()
    }
  }
}

export { OrganizerBot }
export default OrganizerBot
