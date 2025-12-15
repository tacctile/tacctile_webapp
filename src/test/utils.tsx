/**
 * Test Utilities
 *
 * Custom render function and utilities for testing React components.
 * This file provides a custom render function that wraps components
 * with necessary providers (Router, Theme, etc.)
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, MemoryRouter, MemoryRouterProps } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// ============================================================================
// THEME CONFIGURATION
// ============================================================================

// Create a default theme for testing (matches Tacctile's dark theme)
const defaultTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#19abb5',
    },
    secondary: {
      main: '#ff6b6b',
    },
    background: {
      default: '#0d0d0d',
      paper: '#1a1a1a',
    },
  },
});

// ============================================================================
// PROVIDER WRAPPER
// ============================================================================

interface WrapperProps {
  children: ReactNode;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial route entries for MemoryRouter */
  initialEntries?: MemoryRouterProps['initialEntries'];
  /** Use BrowserRouter instead of MemoryRouter */
  useBrowserRouter?: boolean;
  /** Custom theme override */
  theme?: ReturnType<typeof createTheme>;
}

/**
 * Creates a wrapper component with all necessary providers
 */
function createWrapper(options: CustomRenderOptions = {}) {
  const { initialEntries = ['/'], useBrowserRouter = false, theme = defaultTheme } = options;

  return function Wrapper({ children }: WrapperProps) {
    const Router = useBrowserRouter ? BrowserRouter : MemoryRouter;
    const routerProps = useBrowserRouter ? {} : { initialEntries };

    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router {...routerProps}>{children}</Router>
      </ThemeProvider>
    );
  };
}

// ============================================================================
// CUSTOM RENDER FUNCTION
// ============================================================================

/**
 * Custom render function that wraps components with necessary providers.
 *
 * @example
 * ```tsx
 * // Basic usage
 * const { getByText } = renderWithProviders(<MyComponent />);
 *
 * // With initial route
 * renderWithProviders(<MyComponent />, { initialEntries: ['/dashboard'] });
 *
 * // With user event setup
 * const { user, getByRole } = renderWithProviders(<MyComponent />);
 * await user.click(getByRole('button'));
 * ```
 */
export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const { initialEntries, useBrowserRouter, theme, ...renderOptions } = options;

  // Setup user-event
  const user = userEvent.setup();

  // Render with wrapper
  const result = render(ui, {
    wrapper: createWrapper({ initialEntries, useBrowserRouter, theme }),
    ...renderOptions,
  });

  return {
    ...result,
    user,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wait for a condition to be true (polling-based)
 *
 * @example
 * ```tsx
 * await waitForCondition(() => store.getState().isLoaded);
 * ```
 */
export async function waitForCondition(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (condition()) {
        resolve();
        return;
      }

      if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
        return;
      }

      setTimeout(check, interval);
    };

    check();
  });
}

/**
 * Create a mock function that resolves after a delay
 *
 * @example
 * ```tsx
 * const mockFetch = createDelayedMock({ data: 'test' }, 100);
 * ```
 */
export function createDelayedMock<T>(value: T, delayMs = 0): () => Promise<T> {
  return () => new Promise((resolve) => setTimeout(() => resolve(value), delayMs));
}

/**
 * Create a mock function that rejects after a delay
 *
 * @example
 * ```tsx
 * const mockFetch = createDelayedReject(new Error('Network error'), 100);
 * ```
 */
export function createDelayedReject(error: Error, delayMs = 0): () => Promise<never> {
  return () => new Promise((_, reject) => setTimeout(() => reject(error), delayMs));
}

/**
 * Helper to simulate file input
 *
 * @example
 * ```tsx
 * const file = createMockFile('test.mp3', 'audio/mpeg');
 * await user.upload(input, file);
 * ```
 */
export function createMockFile(
  name: string,
  type: string,
  content: string | ArrayBuffer = ''
): File {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

/**
 * Helper to create mock audio file with proper structure
 */
export function createMockAudioFile(name = 'test-audio.mp3'): File {
  // Create a minimal valid audio file structure
  return createMockFile(name, 'audio/mpeg', 'mock-audio-data');
}

/**
 * Helper to create mock image file
 */
export function createMockImageFile(name = 'test-image.jpg'): File {
  // 1x1 transparent PNG
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return createMockFile(name, 'image/png', new Blob([array]).toString());
}

/**
 * Helper to create mock video file
 */
export function createMockVideoFile(name = 'test-video.mp4'): File {
  return createMockFile(name, 'video/mp4', 'mock-video-data');
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Re-export everything from testing-library for convenience
export * from '@testing-library/react';
export { userEvent };

// Export the default render as well for cases where providers aren't needed
export { render };
