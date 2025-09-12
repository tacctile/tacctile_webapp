/**
 * Spectron integration tests for Electron main process
 * Tests the main process functionality and window management
 */

import { Application } from 'spectron';
import path from 'path';

let app: Application;

describe('Electron Application Integration', () => {
  beforeAll(async () => {
    app = new Application({
      path: require('electron'),
      args: [path.join(__dirname, '../../src/main.ts')],
      startTimeout: 10000,
      waitTimeout: 5000,
    });

    await app.start();
  });

  afterAll(async () => {
    if (app && app.isRunning()) {
      await app.stop();
    }
  });

  describe('Application Launch', () => {
    test('should launch the application', async () => {
      expect(app.isRunning()).toBe(true);
    });

    test('should have correct window count', async () => {
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).toBe(1);
    });

    test('should have correct window title', async () => {
      const title = await app.client.getTitle();
      expect(title).toBe('Ghost Hunter Toolbox');
    });
  });

  describe('Window Properties', () => {
    test('should have correct window dimensions', async () => {
      const bounds = await app.browserWindow.getBounds();
      expect(bounds.width).toBeGreaterThanOrEqual(800);
      expect(bounds.height).toBeGreaterThanOrEqual(600);
    });

    test('should be visible', async () => {
      const isVisible = await app.browserWindow.isVisible();
      expect(isVisible).toBe(true);
    });

    test('should not be minimized on launch', async () => {
      const isMinimized = await app.browserWindow.isMinimized();
      expect(isMinimized).toBe(false);
    });
  });

  describe('Security Configuration', () => {
    test('should have node integration disabled', async () => {
      const nodeIntegration = await app.webContents.executeJavaScript(`
        typeof process !== 'undefined' && process.versions && process.versions.node
      `);
      expect(nodeIntegration).toBeFalsy();
    });

    test('should have context isolation enabled', async () => {
      const contextIsolated = await app.webContents.executeJavaScript(`
        typeof window !== 'undefined' && !window.require
      `);
      expect(contextIsolated).toBe(true);
    });

    test('should have ghostHunterAPI available', async () => {
      const hasAPI = await app.webContents.executeJavaScript(`
        typeof window.ghostHunterAPI !== 'undefined'
      `);
      expect(hasAPI).toBe(true);
    });
  });

  describe('IPC Security', () => {
    test('should validate IPC channels', async () => {
      const validationWorks = await app.webContents.executeJavaScript(`
        (async () => {
          try {
            await window.ghostHunterAPI.invoke('invalid:channel');
            return false;
          } catch (error) {
            return error.message.includes('Invalid IPC channel');
          }
        })()
      `);
      expect(validationWorks).toBe(true);
    });
  });

  describe('Auto-save Integration', () => {
    test('should have auto-save API available', async () => {
      const hasAutoSave = await app.webContents.executeJavaScript(`
        typeof window.ghostHunterAPI.autoSave === 'object' &&
        typeof window.ghostHunterAPI.autoSave.save === 'function'
      `);
      expect(hasAutoSave).toBe(true);
    });

    test('should perform health check', async () => {
      const isHealthy = await app.webContents.executeJavaScript(`
        window.ghostHunterAPI.autoSave.isHealthy()
      `);
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Window Management Integration', () => {
    test('should have window manager API available', async () => {
      const hasWindowManager = await app.webContents.executeJavaScript(`
        typeof window.ghostHunterAPI.windowManager === 'object' &&
        typeof window.ghostHunterAPI.windowManager.createWindow === 'function'
      `);
      expect(hasWindowManager).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle unhandled errors gracefully', async () => {
      // Trigger an error and ensure the app doesn't crash
      await app.webContents.executeJavaScript(`
        setTimeout(() => {
          throw new Error('Test error for error handling');
        }, 100);
      `);

      // Wait a bit and check if app is still running
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(app.isRunning()).toBe(true);
    });
  });
});