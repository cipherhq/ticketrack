# Monitoring and Testing Setup Guide

This guide covers setting up monitoring, error tracking, and testing tools for Ticketrack in production.

---

## 1. Error Tracking with Sentry

### Setup

1. **Create Sentry Account**
   - Sign up at [sentry.io](https://sentry.io)
   - Create a new project for Ticketrack
   - Select "React" as the platform

2. **Install Dependencies**
   ```bash
   npm install @sentry/react @sentry/tracing
   ```

3. **Configure Sentry in App**
   ```javascript
   // src/lib/sentry.js
   import * as Sentry from "@sentry/react";
   import { BrowserTracing } from "@sentry/tracing";

   Sentry.init({
     dsn: import.meta.env.VITE_SENTRY_DSN,
     integrations: [
       new BrowserTracing(),
     ],
     tracesSampleRate: 0.1, // 10% of transactions
     environment: import.meta.env.MODE,
     beforeSend(event, hint) {
       // Filter out sensitive data
       if (event.request) {
         delete event.request.cookies;
         delete event.request.headers?.Authorization;
       }
       return event;
     },
   });
   ```

4. **Add to App.jsx**
   ```javascript
   import './lib/sentry';
   ```

5. **Update Error Boundaries**
   - Wrap critical components with `<Sentry.ErrorBoundary>`
   - Use Sentry for manual error reporting: `Sentry.captureException(error)`

6. **Environment Variable**
   ```bash
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```

### Dashboard Setup
- Create alerts for error rate spikes
- Set up Slack/email notifications for critical errors
- Monitor performance issues (slow API calls)

---

## 2. Performance Monitoring with Vercel Analytics

### Setup (if using Vercel)

1. **Enable Vercel Analytics**
   - Go to Vercel dashboard → Project Settings → Analytics
   - Enable Web Analytics

2. **Install Vercel Analytics**
   ```bash
   npm install @vercel/analytics
   ```

3. **Add to App**
   ```javascript
   // src/App.jsx
   import { Analytics } from '@vercel/analytics/react';
   
   function App() {
     return (
       <>
         <YourApp />
         <Analytics />
       </>
     );
   }
   ```

### Alternative: Google Analytics or Plausible
- **Google Analytics**: For detailed user behavior tracking
- **Plausible**: Privacy-focused alternative

---

## 3. Uptime Monitoring with UptimeRobot

### Setup

1. **Create Account** at [uptimerobot.com](https://uptimerobot.com)

2. **Add Monitors**
   - **Homepage**: `https://your-domain.com` (HTTP(s) Monitor)
   - **API Health**: `https://your-domain.com/api/health` (HTTP(s) Monitor)
   - **Webhook Endpoint**: Monitor critical webhook endpoints

3. **Alert Settings**
   - Email alerts on downtime
   - Slack/Telegram integration for team notifications
   - Monitor interval: 5 minutes

### Create Health Check Endpoint

```javascript
// src/pages/HealthCheck.jsx (or Edge Function)
export async function GET() {
  try {
    // Check database connectivity
    const { data, error } = await supabase.from('events').select('count').limit(1);
    
    if (error) throw error;
    
    return new Response(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString() 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      status: 'unhealthy', 
      error: 'Database connection failed' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

---

## 4. E2E Testing with Playwright

### Setup

1. **Install Playwright**
   ```bash
   npm install -D @playwright/test
   npx playwright install
   ```

2. **Create Test File**
   ```javascript
   // tests/checkout-flow.spec.js
   import { test, expect } from '@playwright/test';

   test('complete checkout flow', async ({ page }) => {
     // Navigate to event
     await page.goto('/e/test-event-slug');
     
     // Select ticket
     await page.click('[data-testid="ticket-type-1"]');
     await page.fill('[data-testid="quantity"]', '2');
     await page.click('[data-testid="add-to-cart"]');
     
     // Go to checkout
     await page.click('[data-testid="checkout-button"]');
     
     // Fill checkout form
     await page.fill('[name="firstName"]', 'Test');
     await page.fill('[name="lastName"]', 'User');
     await page.fill('[name="email"]', 'test@example.com');
     
     // Verify form is filled
     await expect(page.locator('[name="firstName"]')).toHaveValue('Test');
     
     // Note: Use test payment credentials for actual payment flow
   });
   ```

3. **Run Tests**
   ```bash
   npx playwright test
   npx playwright test --ui  # Interactive mode
   ```

### Critical Test Flows

1. **User Registration/Login**
   - Sign up flow
   - Login with OTP
   - Password reset

2. **Event Checkout**
   - Select tickets
   - Apply promo code
   - Complete payment (test mode)
   - Receive confirmation

3. **Free RSVP**
   - Register for free event
   - Receive ticket email

4. **Ticket Management**
   - View tickets
   - Transfer ticket
   - Request refund

---

## 5. API Monitoring with Supabase

### Database Monitoring

1. **Enable Database Webhooks**
   - Go to Supabase Dashboard → Database → Webhooks
   - Monitor critical events (order creation, payment failures)

2. **Set Up Alerts**
   - Database connection pool exhaustion
   - Slow query alerts (>1 second)
   - Storage quota warnings

### Edge Function Monitoring

1. **View Logs**
   - Supabase Dashboard → Edge Functions → Logs
   - Filter by status code, execution time

2. **Set Up Alerts**
   - Error rate > 5%
   - Execution time > 5 seconds
   - Invocation failures

---

## 6. Log Aggregation (Optional)

### Option 1: LogRocket
- Session replay and error tracking
- See exactly what users experienced
- Useful for debugging production issues

### Option 2: LogTail / Papertrail
- Centralized log aggregation
- Search and filter logs
- Alerts on error patterns

### Option 3: Datadog / New Relic
- Full APM (Application Performance Monitoring)
- Database query performance
- Infrastructure monitoring

---

## 7. Test Data and Staging Environment

### Staging Environment Setup

1. **Create Staging Supabase Project**
   - Separate project for testing
   - Use test payment credentials

2. **Environment Variables**
   ```bash
   # .env.staging
   VITE_SUPABASE_URL=https://staging-project.supabase.co
   VITE_SUPABASE_ANON_KEY=staging-anon-key
   VITE_ENVIRONMENT=staging
   ```

3. **Test Data**
   - Create test events
   - Test organizers
   - Test payment methods

---

## 8. Monitoring Dashboard Checklist

### Essential Metrics to Track

**Performance:**
- [ ] Page load time (Target: <2s)
- [ ] API response time (Target: <500ms p95)
- [ ] Database query time (Target: <100ms p95)

**Errors:**
- [ ] Error rate (Target: <0.1%)
- [ ] 4xx errors (Target: <1%)
- [ ] 5xx errors (Target: <0.1%)

**Business:**
- [ ] Daily active users
- [ ] Events created
- [ ] Tickets sold
- [ ] Revenue
- [ ] Payment success rate (Target: >95%)

**Infrastructure:**
- [ ] Uptime (Target: >99.9%)
- [ ] Database connections
- [ ] Edge Function invocations
- [ ] Storage usage

---

## 9. Alert Configuration

### Critical Alerts (Immediate Response)

1. **Payment Processing Failures**
   - Alert: Payment success rate drops below 90%
   - Action: Immediate investigation

2. **Database Down**
   - Alert: Cannot connect to database
   - Action: Check Supabase status, notify team

3. **High Error Rate**
   - Alert: Error rate > 5% for 5 minutes
   - Action: Review error logs, check for deployment issues

### Warning Alerts (Monitor)

1. **Slow Response Times**
   - Alert: API response time > 2 seconds
   - Action: Investigate slow queries, check database load

2. **Storage Quota**
   - Alert: Storage > 80% of quota
   - Action: Plan for cleanup or upgrade

---

## 10. Quick Start Commands

```bash
# Run console log audit
node scripts/audit-console-logs.js

# Run E2E tests
npx playwright test

# Run E2E tests in UI mode
npx playwright test --ui

# Check production build
npm run build

# Deploy to staging
vercel --prod=false

# Deploy to production
vercel --prod
```

---

## Resources

- [Sentry Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Playwright Documentation](https://playwright.dev/)
- [Vercel Analytics](https://vercel.com/analytics)
- [Supabase Monitoring](https://supabase.com/docs/guides/platform/performance)

---

**Last Updated:** 2025-01-02
