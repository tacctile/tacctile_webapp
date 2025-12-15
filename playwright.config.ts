/**
 * Playwright Configuration
 *
 * E2E testing configuration for Tacctile webapp.
 * Configures browser settings, test directories, and reporting options.
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables for CI/local configuration
 */
const CI = !!process.env.CI;

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test file patterns
  testMatch: '**/*.spec.ts',

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: CI,

  // Retry failed tests (more retries on CI)
  retries: CI ? 2 : 0,

  // Limit parallel workers on CI to avoid resource contention
  workers: CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    // Always use list reporter for console output
    ['list'],
    // HTML reporter for detailed results
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    // JSON reporter for CI integration
    ...(CI ? [['json', { outputFile: 'test-results/results.json' }] as const] : []),
  ],

  // Global test settings
  use: {
    // Base URL for all tests
    baseURL: 'http://localhost:5173',

    // Collect trace on first retry (useful for debugging)
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording (off by default, enable for debugging)
    video: 'retain-on-failure',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Timeout for actions (clicks, fills, etc.)
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Global timeout for each test
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 5000,
  },

  // Browser projects
  projects: [
    // Chromium (primary browser)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    // Firefox (optional - uncomment for cross-browser testing)
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //   },
    // },

    // WebKit/Safari (optional - uncomment for cross-browser testing)
    // {
    //   name: 'webkit',
    //   use: {
    //     ...devices['Desktop Safari'],
    //   },
    // },

    // Mobile viewport testing (optional)
    // {
    //   name: 'mobile-chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //   },
    // },
  ],

  // Web server configuration - start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !CI,
    timeout: 120000, // 2 minutes to start
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output directory for test artifacts
  outputDir: 'test-results/',
});
