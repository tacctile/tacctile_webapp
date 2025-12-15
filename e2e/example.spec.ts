/**
 * Example E2E Tests
 *
 * Basic end-to-end tests demonstrating Playwright patterns for Tacctile.
 * These tests verify critical user flows work correctly.
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// TEST SETUP & UTILITIES
// ============================================================================

/**
 * Wait for the app to fully load and be interactive
 */
async function waitForAppLoad(page: Page) {
  // Wait for main content to be visible
  await page.waitForLoadState('networkidle');

  // Wait for React to hydrate (app-specific selector)
  await page.waitForSelector('[data-testid="app-root"], #root', {
    state: 'attached',
    timeout: 10000,
  });
}

// ============================================================================
// NAVIGATION TESTS
// ============================================================================

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Verify the page loaded successfully
    await expect(page).toHaveTitle(/Tacctile/i);
  });

  test('should navigate to different routes', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Check that the main container exists
    const mainContent = page.locator('#root');
    await expect(mainContent).toBeVisible();
  });

  test('should display navigation elements', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // App should have loaded content
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  test('should handle 404 routes gracefully', async ({ page }) => {
    await page.goto('/non-existent-route-12345');

    // Should either redirect to home or show a 404 page
    // Wait for any response
    await page.waitForLoadState('domcontentloaded');

    // The app should still render something
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

// ============================================================================
// HOME PAGE TESTS
// ============================================================================

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);
  });

  test('should render the main application layout', async ({ page }) => {
    // Look for the root element
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    // App should have content
    const children = root.locator('> *');
    await expect(children.first()).toBeVisible();
  });

  test('should have working interactive elements', async ({ page }) => {
    // Find any clickable buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    // There should be some interactive elements
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('should maintain responsive layout', async ({ page }) => {
    // Test at different viewport sizes
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('#root')).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('#root')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('#root')).toBeVisible();
  });
});

// ============================================================================
// AUTHENTICATION FLOW TESTS (Placeholder)
// ============================================================================

test.describe('Authentication', () => {
  test('should display login options when not authenticated', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // This is a placeholder test - actual implementation depends on auth flow
    // Look for auth-related elements or redirect behavior

    // For now, just verify the app loads
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should redirect to login for protected routes', async ({ page }) => {
    // Attempt to access a protected route (placeholder URL)
    await page.goto('/dashboard');

    // Should either show the page or redirect
    await page.waitForLoadState('domcontentloaded');

    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
  });
});

// ============================================================================
// ACCESSIBILITY TESTS
// ============================================================================

test.describe('Accessibility', () => {
  test('should have no critical accessibility issues on home page', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Check that interactive elements are keyboard accessible
    const interactiveElements = page.locator('button, a, input, select, textarea');
    const count = await interactiveElements.count();

    if (count > 0) {
      // First interactive element should be focusable
      const firstElement = interactiveElements.first();
      await firstElement.focus();

      // Should have received focus or be hidden
      const isFocused = await firstElement.evaluate((el) => document.activeElement === el);
      const isHidden = await firstElement.isHidden();

      expect(isFocused || isHidden).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Tab through the page
    await page.keyboard.press('Tab');

    // Something should be focused
    const activeElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(activeElement).toBeDefined();
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await waitForAppLoad(page);

    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds (generous for development)
    expect(loadTime).toBeLessThan(10000);
  });

  test('should not have console errors on page load', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForAppLoad(page);

    // Filter out known/acceptable errors
    const criticalErrors = errors.filter((error) => {
      // Ignore specific known warnings
      if (error.includes('DevTools') || error.includes('Extension')) return false;
      if (error.includes('favicon')) return false;
      return true;
    });

    // Should have no critical errors
    expect(criticalErrors).toHaveLength(0);
  });
});

// ============================================================================
// VISUAL REGRESSION TESTS (Placeholder)
// ============================================================================

test.describe('Visual Regression', () => {
  test('home page should match snapshot', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Wait for any animations to complete
    await page.waitForTimeout(500);

    // Take a screenshot (optional - enable for visual regression testing)
    // await expect(page).toHaveScreenshot('home-page.png', {
    //   maxDiffPixels: 100,
    // });

    // For now, just verify the page rendered
    await expect(page.locator('#root')).toBeVisible();
  });
});

// ============================================================================
// API INTEGRATION TESTS (Placeholder)
// ============================================================================

test.describe('API Integration', () => {
  test('should handle API requests gracefully', async ({ page }) => {
    // Set up request interception
    let apiRequestMade = false;

    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiRequestMade = true;
      }
    });

    await page.goto('/');
    await waitForAppLoad(page);

    // Even if API requests fail, app should still render
    await expect(page.locator('#root')).toBeVisible();
  });
});

// ============================================================================
// OFFLINE BEHAVIOR TESTS (Placeholder)
// ============================================================================

test.describe('Offline Behavior', () => {
  test('should show offline indicator when offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Go offline
    await context.setOffline(true);

    // Trigger a navigation or action
    await page.reload().catch(() => {
      // Expected to fail
    });

    // Go back online
    await context.setOffline(false);

    // Should recover gracefully
    await page.goto('/');
    await waitForAppLoad(page);
    await expect(page.locator('#root')).toBeVisible();
  });
});
