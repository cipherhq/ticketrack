import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first, but only accept explicit 'dark' choice
    // Default everything else to 'light' for bright dashboards
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      // Only respect 'dark' if explicitly set, otherwise default to light
      if (stored === 'dark') {
        return 'dark';
      }
      // Reset any 'system' preference to 'light' for consistent experience
      if (stored === 'system') {
        localStorage.setItem('theme', 'light');
      }
    }
    return 'light'; // Default to light mode (bright)
  });

  const [resolvedTheme, setResolvedTheme] = useState('light');

  // Update resolved theme based on system preference or explicit choice
  useEffect(() => {
    const updateResolvedTheme = () => {
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(systemPrefersDark ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme);
      }
    };

    updateResolvedTheme();

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply dark class to document element - only on admin/organizer/finance/promoter dashboards
  useEffect(() => {
    const root = document.documentElement;
    const path = window.location.pathname;
    const isDashboardRoute = path.startsWith('/admin') ||
                             path.startsWith('/organizer') ||
                             path.startsWith('/finance') ||
                             path.startsWith('/promoter');

    if (resolvedTheme === 'dark' && isDashboardRoute) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  // Listen for route changes to update dark mode
  useEffect(() => {
    const handleRouteChange = () => {
      const root = document.documentElement;
      const path = window.location.pathname;
      const isDashboardRoute = path.startsWith('/admin') ||
                               path.startsWith('/organizer') ||
                               path.startsWith('/finance') ||
                               path.startsWith('/promoter');

      if (resolvedTheme === 'dark' && isDashboardRoute) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', handleRouteChange);

    // Create a MutationObserver to watch for URL changes (for SPA navigation)
    const observer = new MutationObserver(handleRouteChange);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      observer.disconnect();
    };
  }, [resolvedTheme]);

  // Persist theme choice
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setThemeMode = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
      setTheme(newTheme);
    }
  };

  const toggleTheme = () => {
    // Simple toggle between light and dark only
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme: setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
