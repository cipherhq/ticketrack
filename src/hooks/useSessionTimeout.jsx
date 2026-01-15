import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Default timeout: 30 minutes of inactivity
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
// Warning before timeout: 5 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000;

/**
 * Session timeout hook that logs out users after inactivity
 * 
 * @param {Object} options
 * @param {number} options.timeoutMs - Timeout duration in milliseconds (default: 30 minutes)
 * @param {number} options.warningMs - Warning before timeout in milliseconds (default: 5 minutes)
 * @param {function} options.onTimeout - Callback when session times out
 * @param {function} options.onWarning - Callback when warning is triggered
 * @param {boolean} options.enabled - Whether timeout is enabled (default: true)
 */
export function useSessionTimeout({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  warningMs = WARNING_BEFORE_MS,
  onTimeout,
  onWarning,
  enabled = true,
} = {}) {
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const countdownRef = useRef(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setShowWarning(false);
    setRemainingTime(0);
  }, []);

  // Handle session timeout
  const handleTimeout = useCallback(async () => {
    clearTimers();
    
    // Log the timeout event
    console.log('Session timed out due to inactivity');
    
    // Sign out the user
    await supabase.auth.signOut();
    
    // Call custom handler if provided
    if (onTimeout) {
      onTimeout();
    } else {
      // Default: redirect to login with message
      window.location.href = '/login?reason=session_timeout';
    }
  }, [clearTimers, onTimeout]);

  // Handle warning trigger
  const handleWarning = useCallback(() => {
    setShowWarning(true);
    setRemainingTime(Math.floor(warningMs / 1000));
    
    // Start countdown
    countdownRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    if (onWarning) {
      onWarning();
    }
  }, [warningMs, onWarning]);

  // Reset the timeout timer
  const resetTimeout = useCallback(() => {
    if (!enabled) return;
    
    clearTimers();
    
    // Set warning timer (timeout - warning duration)
    const warningTime = timeoutMs - warningMs;
    if (warningTime > 0) {
      warningRef.current = setTimeout(handleWarning, warningTime);
    }
    
    // Set timeout timer
    timeoutRef.current = setTimeout(handleTimeout, timeoutMs);
  }, [enabled, timeoutMs, warningMs, clearTimers, handleWarning, handleTimeout]);

  // Extend session (user clicked "Stay logged in")
  const extendSession = useCallback(() => {
    resetTimeout();
  }, [resetTimeout]);

  // Activity events to monitor
  const activityEvents = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ];

  // Throttled activity handler
  const lastActivityRef = useRef(Date.now());
  const handleActivity = useCallback(() => {
    const now = Date.now();
    // Only reset if it's been at least 1 second since last activity
    if (now - lastActivityRef.current > 1000) {
      lastActivityRef.current = now;
      // Only reset if warning is not showing
      if (!showWarning) {
        resetTimeout();
      }
    }
  }, [resetTimeout, showWarning]);

  // Set up event listeners
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    // Initial timeout setup
    resetTimeout();

    // Add activity listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      clearTimers();
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimeout, handleActivity, clearTimers]);

  // Format remaining time as MM:SS
  const formatRemainingTime = useCallback(() => {
    const minutes = Math.floor(remainingTime / 60);
    const seconds = remainingTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingTime]);

  return {
    showWarning,
    remainingTime,
    formatRemainingTime,
    extendSession,
    resetTimeout,
  };
}

/**
 * Session timeout provider component
 * Wrap your app with this to enable session timeout
 */
export function SessionTimeoutProvider({ children, ...options }) {
  const { showWarning, formatRemainingTime, extendSession } = useSessionTimeout(options);

  return (
    <>
      {children}
      
      {/* Session Timeout Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Session Expiring Soon
              </h2>
              <p className="text-gray-600 mb-4">
                Your session will expire in <span className="font-bold text-orange-600">{formatRemainingTime()}</span> due to inactivity.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => window.location.href = '/login'}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Log Out
                </button>
                <button
                  onClick={extendSession}
                  className="px-4 py-2 text-white bg-[#2969FF] rounded-xl hover:bg-[#1e4fd6] transition-colors"
                >
                  Stay Logged In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default useSessionTimeout;
