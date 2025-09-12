/**
 * Theme Manager Utility
 * Handles light/dark theme switching and persistence
 */

export type Theme = 'light' | 'dark' | 'system';

class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme = 'dark';
  private mediaQuery: MediaQueryList | null = null;

  private constructor() {
    this.init();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private init() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') as Theme;
    
    if (savedTheme) {
      this.setTheme(savedTheme);
    } else {
      // Default to dark theme for ghost hunting app
      this.setTheme('dark');
    }

    // Listen for system theme changes
    if (window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQuery.addEventListener('change', this.handleSystemThemeChange);
    }
  }

  private handleSystemThemeChange = (e: MediaQueryListEvent) => {
    if (this.currentTheme === 'system') {
      this.applyTheme(e.matches ? 'dark' : 'light');
    }
  };

  public setTheme(theme: Theme) {
    this.currentTheme = theme;
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.applyTheme(prefersDark ? 'dark' : 'light');
    } else {
      this.applyTheme(theme);
    }
  }

  private applyTheme(theme: 'light' | 'dark') {
    const root = document.documentElement;
    
    // Set data attribute for CSS
    root.setAttribute('data-theme', theme);
    
    // Add/remove classes
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    // Dispatch custom event for React components
    window.dispatchEvent(new CustomEvent('themechange', { 
      detail: { theme } 
    }));

    // Update meta theme-color for browser chrome
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#0a0a0a' : '#f5f5f5');
    }
  }

  public getTheme(): Theme {
    return this.currentTheme;
  }

  public getActiveTheme(): 'light' | 'dark' {
    if (this.currentTheme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.currentTheme;
  }

  public toggleTheme() {
    const newTheme = this.getActiveTheme() === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  public destroy() {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', this.handleSystemThemeChange);
    }
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance();

// React hook for theme management
import { useEffect, useState } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(themeManager.getActiveTheme());

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setTheme(customEvent.detail.theme);
    };

    window.addEventListener('themechange', handleThemeChange);
    
    return () => {
      window.removeEventListener('themechange', handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    themeManager.toggleTheme();
  };

  const setThemeMode = (mode: Theme) => {
    themeManager.setTheme(mode);
  };

  return {
    theme,
    toggleTheme,
    setTheme: setThemeMode,
    isDark: theme === 'dark',
    isLight: theme === 'light'
  };
}

export default themeManager;