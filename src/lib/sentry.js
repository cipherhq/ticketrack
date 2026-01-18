import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
    
    integrations: [
      // Modern Sentry React SDK v10 uses integration functions instead of classes
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Mask all text content and user input to protect privacy
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Tracing - Capture 10% of transactions for performance monitoring
    tracesSampleRate: 0.1,
    
    // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
    tracePropagationTargets: [
      "localhost",
      /^https:\/\/.*\.supabase\.co\/rest\/v1\//,
      /^https:\/\/.*\.supabase\.functions\.supabase\.co/,
    ],
    
    // Session Replay
    // Sample 10% of sessions in production (you may want to change it to 100% while in development)
    replaysSessionSampleRate: import.meta.env.DEV ? 1.0 : 0.1,
    // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur
    replaysOnErrorSampleRate: 1.0,
    
    // Enable logs to be sent to Sentry
    enableLogs: true,
    
    beforeSend(event, hint) {
      // Filter out development errors (redundant check, but keeping for clarity)
      if (import.meta.env.DEV) {
        return null;
      }
      
      // Sanitize sensitive data
      if (event.request) {
        // Remove sensitive headers
        if (event.request.headers) {
          delete event.request.headers.Authorization;
          delete event.request.headers["authorization"];
        }
        // Remove sensitive cookies
        if (event.request.cookies) {
          delete event.request.cookies.supabase_auth_token;
          delete event.request.cookies["supabase.auth.token"];
        }
      }
      
      // Remove sensitive data from user context
      if (event.user) {
        // Keep only non-sensitive user data
        event.user = {
          id: event.user.id,
          username: event.user.username,
          // Don't include email in production logs (handled by sendDefaultPii and beforeSend)
        };
      }
      
      return event;
    },
  });
}

export default Sentry;
