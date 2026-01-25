# TickeTrack Bot Testing System

Automated testing bots that simulate real users to test every feature of the application.

## Overview

| Bot | Role | Tests |
|-----|------|-------|
| **OrganizerBot** | Event organizer | Login, Create Event, Manage Events, Analytics, Communications, Payouts, Team, etc. |
| **UserBot** | Event attendee | Homepage, Browse Events, Purchase Tickets, My Tickets, Profile, Wallet Pass, etc. |

## Quick Start

```bash
# Run all bots (headless)
npm run test:bots

# Run with browser visible
npm run test:bots:headed

# Run slowly for debugging
npm run test:bots:slow

# Run only organizer bot
npm run test:bots:organizer

# Run only user bot
npm run test:bots:user
```

## Features Tested

### Organizer Bot Tests

| # | Test | Description |
|---|------|-------------|
| 1 | Login/Register | Authenticate as organizer |
| 2 | Create Event | Create new event with tickets |
| 3 | View Events | List all events |
| 4 | Analytics | View dashboard analytics |
| 5 | Communication Hub | Access email, SMS, WhatsApp |
| 6 | Contacts | Manage contact list |
| 7 | Payouts | View earnings and payouts |
| 8 | Profile | Update organizer profile |
| 9 | Promo Codes | Create discount codes |
| 10 | Team | Manage team members |
| 11 | Check-in | Access check-in features |

### User Bot Tests

| # | Test | Description |
|---|------|-------------|
| 1 | Homepage | Verify homepage loads |
| 2 | Event Discovery | Browse and search events |
| 3 | Event Details | View event information |
| 4 | Login/Register | Authenticate as user |
| 5 | Ticket Purchase | Complete purchase flow |
| 6 | My Tickets | View purchased tickets |
| 7 | Profile | Manage user profile |
| 8 | Wallet Pass | Check Apple/Google Wallet |
| 9 | Follow Organizer | Follow event organizers |
| 10 | Ticket Transfer | Transfer tickets to others |

## Configuration

Edit `tests/bots/config.js` to customize:

```javascript
export const BOT_CONFIG = {
  baseUrl: 'http://localhost:5173',
  
  accounts: {
    organizer: {
      email: 'bajideace@gmail.com',
      password: 'Babajide1$$',
    },
    user: {
      email: 'bcadepoju@gmail.com',
      password: 'Babajide1$$',
    },
  },
  
  // Timeouts, screenshots, reports...
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | Application URL | `http://localhost:5173` |
| `HEADLESS` | Run without browser UI | `true` |
| `SLOW_MO` | Delay between actions (ms) | `0` |
| `RECORD_VIDEO` | Record test videos | `false` |

## Test Reports

Reports are saved to `tests/bots/reports/`:

- **JSON Report**: `bot-test-report-{timestamp}.json`
- **HTML Report**: `bot-test-report-{timestamp}.html`

### Report Contents

- Overall summary (total, passed, failed, skipped)
- Individual test results with steps
- Errors and stack traces
- Screenshots on failure
- Duration statistics

## Screenshots

Failed tests automatically capture screenshots to `tests/bots/screenshots/`:

```
OrganizerBot-login-1706123456789.png
UserBot-ticket-purchase-1706123456790.png
```

## Extending the Bots

### Add a New Organizer Test

```javascript
// In organizer-bot.js

async testNewFeature() {
  reporter.startTest(BOT_NAME, 'New Feature', 'Description of the test')
  
  try {
    await this.page.goto(`${BOT_CONFIG.baseUrl}/organizer/new-feature`)
    reporter.logStep('Navigated to page')
    
    // Perform test actions...
    
    reporter.endTest('passed')
    return true
  } catch (error) {
    const screenshot = await this.takeErrorScreenshot('new-feature')
    reporter.logError(error, screenshot)
    reporter.endTest('failed', screenshot)
    return false
  }
}

// Add to runAllTests():
async runAllTests() {
  // ...existing tests...
  await this.testNewFeature()
}
```

### Add a New User Test

Same pattern in `user-bot.js`.

## Troubleshooting

### Bot can't log in
- Ensure the test accounts exist in the database
- Check if email verification is required
- Verify credentials in `config.js`

### Tests timeout
- Increase timeouts in `config.js`
- Run with `--slow` flag to debug
- Check network connectivity

### Screenshots not saving
- Ensure `tests/bots/screenshots/` directory exists
- Check file permissions

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Bot Tests
  run: npm run test:bots
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
```

## Output Example

```
╔══════════════════════════════════════════════════════════════╗
║   🤖  T I C K E T R A C K   B O T   T E S T E R  🤖          ║
╚══════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════
🤖 BOT TEST RUN STARTED
════════════════════════════════════════════════════════════════

▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓  ORGANIZER BOT - Testing Event Management Features
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

──────────────────────────────────────────────────────
🔄 [OrganizerBot] Login
   Log in as organizer or register new account
   ✓ Navigated to login page
   ✓ Entered email
   ✓ Entered password
   ✓ Clicked login button
   ✓ Successfully logged in
   ✓ PASSED (2.34s)

──────────────────────────────────────────────────────
🔄 [OrganizerBot] Create Event
   Create a new event with ticket types
   ✓ Navigated to create event page
   ✓ Entered event title
   ...

════════════════════════════════════════════════════════════════
🤖 BOT TEST RUN COMPLETED
════════════════════════════════════════════════════════════════

SUMMARY:
  Total:   21
  Passed:  18
  Failed:  2
  Skipped: 1

ISSUES FOUND:
  1. [OrganizerBot] Team Management
     - Element not found: button:has-text("Invite")
  2. [UserBot] Ticket Transfer
     - Timeout waiting for selector
```
