import { useRef, useEffect, useCallback } from 'react';

const TURNSTILE_SITE_KEY = '0x4AAAAAAACpK_YhNktQU1S5K';

export function useTurnstile() {
  const widgetId = useRef(null);
  const containerRef = useRef(null);
  const tokenRef = useRef(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    // Wait for Turnstile script to load, then render invisible widget
    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetId.current !== null) return;

      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: 'invisible',
        callback: (token) => {
          tokenRef.current = token;
          if (resolveRef.current) {
            resolveRef.current(token);
            resolveRef.current = null;
          }
        },
        'error-callback': () => {
          tokenRef.current = null;
          if (resolveRef.current) {
            resolveRef.current(null);
            resolveRef.current = null;
          }
        },
      });
    };

    // If turnstile is already loaded, render immediately
    if (window.turnstile) {
      renderWidget();
    } else {
      // Poll for turnstile to be available
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const getToken = useCallback(() => {
    return new Promise((resolve) => {
      // If we already have a token, use it and reset
      if (tokenRef.current) {
        const token = tokenRef.current;
        tokenRef.current = null;
        // Reset widget for next use
        if (widgetId.current !== null && window.turnstile) {
          window.turnstile.reset(widgetId.current);
        }
        resolve(token);
        return;
      }

      // If turnstile isn't loaded, resolve with null (allow auth without captcha)
      if (!window.turnstile || widgetId.current === null) {
        resolve(null);
        return;
      }

      // Execute and wait for callback
      resolveRef.current = resolve;
      window.turnstile.execute(widgetId.current);

      // Timeout after 10 seconds
      setTimeout(() => {
        if (resolveRef.current) {
          resolveRef.current(null);
          resolveRef.current = null;
        }
      }, 10000);
    });
  }, []);

  return { containerRef, getToken };
}
