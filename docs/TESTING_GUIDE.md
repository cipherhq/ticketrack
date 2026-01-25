# Ticketrack Testing Guide

Complete guide for testing the Ticketrack application with automated tools.

## Configuration

| Variable | Value |
|----------|-------|
| Supabase URL | `https://bkvbvggngttrizbchygy.supabase.co` |
| Supabase Anon Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDU4OTcsImV4cCI6MjA2MjcyMTg5N30.n1Fb99MdoQaj2n6zfazZlPSz0bVbeHwXwDBfTpiNxGA` |
| Service Role Key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI` |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed test data
npm run seed

# 3. Run E2E tests
npm run test:e2e

# 4. Run load tests (requires k6)
npm run test:load
```

---

## 1. Seed Script (Fake Data Generator)

Generates realistic test data including Nigerian names, phone numbers, and venues.

### What it creates:
- **500+ contacts** with realistic names/emails/phones
- **20+ events** with various ticket types
- **200+ ticket purchases**
- **10+ communication campaigns**
- **Smart segment scores**

### Usage:

```bash
# Set your service role key
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI"

# Run seeder
npm run seed
```

> **Note:** The service_role key has admin privileges. Never expose it in frontend code or commit to public repos.

### Test Organizer Credentials:
- **Email:** `test-organizer@ticketrack.com`
- **Password:** `TestPassword123!`

---

## 2. E2E Tests (Playwright)

Automated browser testing that simulates human-like interactions.

### Tests included:
- Authentication (login, logout, errors)
- Event discovery and browsing
- Organizer dashboard navigation
- Create event flow
- Ticket purchase flow
- Mobile responsiveness
- Performance checks
- Accessibility checks
- Error handling

### Commands:

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run with browser visible
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e-comprehensive.spec.js

# Run in debug mode
npx playwright test --debug

# Generate HTML report
npx playwright show-report
```

### Configuration:
Edit `playwright.config.js` to change:
- Base URL
- Browser (Chrome, Firefox, Safari)
- Timeout settings
- Screenshots/videos

---

## 3. Load Testing (k6)

Stress test the application with simulated concurrent users.

### Installation:

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux
sudo apt-get install k6
```

### Test Scenarios:

| Scenario | Users | Duration | Purpose |
|----------|-------|----------|---------|
| Default | 10→100 | ~6 min | Standard load test |
| Spike | 10→200 | ~2 min | Sudden traffic surge |
| Soak | 50 | 30 min | Sustained load |
| Stress | 100→300 | ~20 min | Find breaking point |

### Commands:

```bash
# Run default load test
npm run test:load

# Run with custom base URL
BASE_URL=https://ticketrack.com k6 run tests/load/k6-load-test.js

# Run with Supabase API testing (anon key is public)
SUPABASE_URL=https://bkvbvggngttrizbchygy.supabase.co \
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNDU4OTcsImV4cCI6MjA2MjcyMTg5N30.n1Fb99MdoQaj2n6zfazZlPSz0bVbeHwXwDBfTpiNxGA \
k6 run tests/load/k6-load-test.js

# Run with web dashboard
k6 run --out web-dashboard tests/load/k6-load-test.js
```

### Metrics tracked:
- **http_req_duration** - Response times
- **http_req_failed** - Failure rate
- **homepage_load_time** - Homepage specific
- **events_load_time** - Events page specific
- **api_latency** - API response times

### Thresholds:
- 95% of requests under 3 seconds
- Less than 5% request failures
- Less than 10% error rate

---

## 4. Running All Tests

### Full Test Suite:

```bash
# 1. Start dev server
npm run dev

# 2. In another terminal, run tests
npm run test:e2e

# 3. Generate report
npx playwright show-report
```

### CI/CD Integration:

```yaml
# GitHub Actions example
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 5. Test Data Cleanup

```sql
-- Run in Supabase SQL Editor to clean test data
DELETE FROM tickets WHERE attendee_email LIKE '%test%';
DELETE FROM contacts WHERE email LIKE '%faker%' OR email LIKE '%test%';
DELETE FROM events WHERE title LIKE '%Test%';
DELETE FROM organizers WHERE business_name = 'Test Events Ltd';
```

---

## 6. Troubleshooting

### Common Issues:

**Seed script fails:**
```bash
# Make sure service role key is set
echo $SUPABASE_SERVICE_ROLE_KEY

# Or run with inline env vars
SUPABASE_URL=https://bkvbvggngttrizbchygy.supabase.co \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdmJ2Z2duZ3R0cml6YmNoeWd5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNzMyMSwiZXhwIjoyMDgwMTAzMzIxfQ.HuxKaRzcMeX0gxz1f3f7-SsSFbbIRWShAk9Eog6rRBI" \
npm run seed
```

**E2E tests timeout:**
```bash
# Increase timeout in playwright.config.js
timeout: 60 * 1000  # 60 seconds
```

**k6 not found:**
```bash
# Install k6
brew install k6  # macOS
```

**Tests fail on CI:**
- Ensure dev server is running or using correct BASE_URL
- Check if Playwright browsers are installed

---

## 7. Best Practices

1. **Run seed before tests** - Ensures data exists
2. **Use headed mode for debugging** - See what's happening
3. **Check reports after failures** - Screenshots help debug
4. **Run load tests on staging** - Don't stress production
5. **Clean up test data periodically** - Keeps DB clean

---

## Resources

- [Playwright Docs](https://playwright.dev/docs/intro)
- [k6 Docs](https://k6.io/docs/)
- [Faker.js Docs](https://fakerjs.dev/guide/)
