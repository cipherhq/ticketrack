import { useRef, useEffect, useCallback } from 'react';

const TURNSTILE_SITE_KEY = '0x4AAAAAAACpMqi7-vfAut2mI';

export function useTurnstile() {
  const widgetId = useRef(null);
  const containerRef = useRef(null);
  const tokenRef = useRef(null);
  const resolveRef = useRef(null);

  useEffect(() => {
    let interval = null;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current) return;
      if (widgetId.current !== null) {
        try { window.turnstile.remove(widgetId.current); } catch (_) {}
        widgetId.current = null;
      }

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
        'error-callback': (errorCode) => {
          console.warn('[Turnstile] Error:', errorCode);
          tokenRef.current = null;
          if (resolveRef.current) {
            resolveRef.current(null);
            resolveRef.current = null;
          }
        },
        'expired-callback': () => {
          tokenRef.current = null;
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          interval = null;
          renderWidget();
        }
      }, 200);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch (_) {}
        widgetId.current = null;
      }
    };
  }, []);

  const getToken = useCallback(() => {
    return new Promise((resolve) => {
      // If we already have a fresh token from auto-execution, use it
      if (tokenRef.current) {
        const token = tokenRef.current;
        tokenRef.current = null;
        resolve(token);
        // Reset for next use
        if (widgetId.current !== null && window.turnstile) {
          try { window.turnstile.reset(widgetId.current); } catch (_) {}
        }
        return;
      }

      if (!window.turnstile || widgetId.current === null) {
        resolve(null);
        return;
      }

      // No token yet — reset and wait for callback
      resolveRef.current = resolve;
      try {
        window.turnstile.reset(widgetId.current);
      } catch (_) {
        resolveRef.current = null;
        resolve(null);
      }

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
