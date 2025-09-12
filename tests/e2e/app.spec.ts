/**
 * End-to-end tests for Ghost Hunter Toolbox application
 * Uses Playwright for browser-based testing of the Electron app
 */

import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../../src/main.ts')],
    executablePath: require('electron'), // Use local electron
  });

  // Get the first window
  page = await electronApp.firstWindow();
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Ghost Hunter Toolbox Application', () => {
  test('should launch successfully', async () => {
    // Wait for the app to load
    await page.waitForLoadState('domcontentloaded');
    
    // Check if the window is visible
    expect(await page.isVisible('body')).toBe(true);
  });

  test('should have correct title', async () => {
    // Check window title
    const title = await page.title();
    expect(title).toContain('Ghost Hunter Toolbox');
  });

  test('should have secure context', async () => {
    // Verify that the app runs in a secure context
    const isSecureContext = await page.evaluate(() => window.isSecureContext);
    expect(isSecureContext).toBe(true);
  });

  test('should have ghostHunterAPI available', async () => {
    // Check if the context bridge API is available
    const hasAPI = await page.evaluate(() => {
      return typeof (window as any).ghostHunterAPI !== 'undefined';
    });
    expect(hasAPI).toBe(true);
  });

  test('should have security utilities in API', async () => {
    // Test security utilities
    const hasSecurityUtils = await page.evaluate(() => {
      const api = (window as any).ghostHunterAPI;
      return api && api.security && typeof api.security.sanitizeHtml === 'function';
    });
    expect(hasSecurityUtils).toBe(true);
  });

  test('should sanitize HTML correctly', async () => {
    // Test HTML sanitization
    const sanitizedHtml = await page.evaluate(() => {
      const api = (window as any).ghostHunterAPI;
      return api.security.sanitizeHtml('<p>Safe content</p><script>alert("xss")</script>');
    });
    
    expect(sanitizedHtml).toBe('<p>Safe content</p>');
    expect(sanitizedHtml).not.toContain('<script>');
  });

  test('should validate file types correctly', async () => {
    // Test file type validation
    const isValidImage = await page.evaluate(() => {
      const api = (window as any).ghostHunterAPI;
      return api.security.validateFileType('image.jpg', ['jpg', 'png', 'gif']);
    });
    
    const isInvalidFile = await page.evaluate(() => {
      const api = (window as any).ghostHunterAPI;
      return api.security.validateFileType('malicious.exe', ['jpg', 'png', 'gif']);
    });
    
    expect(isValidImage).toBe(true);
    expect(isInvalidFile).toBe(false);
  });

  test('should block invalid IPC channels', async () => {
    // Test that invalid IPC channels are blocked
    const errorThrown = await page.evaluate(async () => {
      try {
        const api = (window as any).ghostHunterAPI;
        await api.invoke('invalid:channel', 'test');
        return false;
      } catch (error) {
        return error.message.includes('Invalid IPC channel');
      }
    });
    
    expect(errorThrown).toBe(true);
  });

  test('should have auto-save functionality', async () => {
    // Test auto-save API availability
    const hasAutoSave = await page.evaluate(() => {
      const api = (window as any).ghostHunterAPI;
      return api && api.autoSave && typeof api.autoSave.save === 'function';
    });
    expect(hasAutoSave).toBe(true);
  });

  test('should have auto-backup functionality', async () => {
    // Test auto-backup API availability
    const hasAutoBackup = await page.evaluate(() => {
      const api = (window as any).ghostHunterAPI;
      return api && api.autoBackup && typeof api.autoBackup.start === 'function';
    });
    expect(hasAutoBackup).toBe(true);
  });

  test('should have window management functionality', async () => {
    // Test window manager API availability
    const hasWindowManager = await page.evaluate(() => {
      const api = (window as any).ghostHunterAPI;
      return api && api.windowManager && typeof api.windowManager.createWindow === 'function';
    });
    expect(hasWindowManager).toBe(true);
  });
});