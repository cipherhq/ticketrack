# Error Tracking Setup Guide

This document describes how to set up error tracking for Ticketrack using Sentry.

## Overview

Error tracking allows you to:
- Monitor production errors in real-time
- Track error rates and trends
- Get alerts on critical failures
- Debug issues with stack traces and context

## Sentry Setup

### 1. Install Sentry

```bash
npm install @sentry/react @sentry/tracing
```

### 2. Initialize Sentry

Create `src/lib/sentry.js`:

```javascript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      new BrowserTracing(),
    ],
    tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
    beforeSend(event, hint) {
      // Filter out development errors
      if (import.meta.env.DEV) {
        return null;
      }
      
      // Sanitize sensitive data
      if (event.request) {
        // Remove sensitive headers
        delete event.request.headers?.Authorization;
        delete event.request.cookies?.supabase_auth_token;
      }
      
      return event;
    },
  });
}

export default Sentry;
```

### 3. Add to Main Entry Point

Update `src/main.jsx`:

```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import './lib/sentry' // Initialize Sentry before App
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### 4. Wrap App with Sentry Error Boundary

Update `src/App.jsx`:

```javascript
import * as Sentry from "@sentry/react";

// Wrap your App component
const SentryApp = Sentry.withErrorBoundary(App, {
  fallback: ({ error, resetError }) => (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-4">We've been notified and are working on it.</p>
        <button onClick={resetError} className="btn-primary">
          Try again
        </button>
      </div>
    </div>
  ),
});

// Use SentryApp instead of App in your render
```

### 5. Environment Variables

Add to `.env.local` (development):
```env
VITE_SENTRY_DSN=your-sentry-dsn-here
```

Add to Vercel (production):
- Project Settings > Environment Variables
- Add `VITE_SENTRY_DSN` for Production, Preview, and Development environments

### 6. Get Sentry DSN

1. Sign up at https://sentry.io
2. Create a new project (React)
3. Copy the DSN from project settings
4. Add to environment variables

## Usage

### Manual Error Reporting

```javascript
import * as Sentry from "@sentry/react";

try {
  // Your code
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

### Adding User Context

```javascript
import * as Sentry from "@sentry/react";

Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});
```

### Performance Monitoring

Automatic performance monitoring is enabled via `BrowserTracing`. You can also manually track:

```javascript
import * as Sentry from "@sentry/react";

const transaction = Sentry.startTransaction({
  name: "Checkout Flow",
});

// Your code

transaction.finish();
```

## Alternative: LogRocket or Rollbar

If you prefer alternatives:

### LogRocket
- Real-time session replay
- Console logs and network requests
- Install: `npm install logrocket`

### Rollbar
- Error tracking with source maps
- Install: `npm install rollbar`

## Best Practices

1. **Filter Sensitive Data**: Always sanitize before sending to Sentry
2. **Sample Rate**: Use 0.1 (10%) for performance monitoring to avoid overhead
3. **Environment-Based**: Only enable in production
4. **User Context**: Set user info for better debugging
5. **Release Tracking**: Tag releases for easier debugging

## Monitoring

Once set up:
- Visit your Sentry dashboard to view errors
- Set up alerts for critical errors
- Monitor error rates over time
- Use releases to track which version introduced issues

## Next Steps

After setup:
1. Test error tracking with a test error
2. Set up alerts for critical errors
3. Monitor error rates in production
4. Review and fix errors regularly
