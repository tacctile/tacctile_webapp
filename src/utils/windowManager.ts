/**
 * Window state persistence and multi-window management
 * Integrates with electron-window-manager for advanced window handling
 */

import { BrowserWindow, screen } from 'electron';
import WindowManager from 'electron-window-manager';
import { autoSave } from './autoSave';

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
}

export interface WindowConfig {
  name: string;
  url?: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  frame?: boolean;
  show?: boolean;
  webPreferences?: any;
}

class GhostHunterWindowManager {
  private windowManager: typeof WindowManager;
  private windowStates: Map<string, WindowState> = new Map();

  constructor() {
    this.windowManager = WindowManager;
    this.loadWindowStates();
  }

  /**
   * Create and manage a new window
   */
  public createWindow(config: WindowConfig): BrowserWindow {
    const savedState = this.getWindowState(config.name);
    const windowOptions = this.buildWindowOptions(config, savedState);

    // Create window using electron-window-manager
    const window = this.windowManager.createNew(config.name, config.name, config.url || '', null, windowOptions);

    if (savedState) {
      this.restoreWindowState(window, savedState);
    }

    this.setupWindowStateTracking(window, config.name);
    
    return window;
  }

  /**
   * Get existing window by name
   */
  public getWindow(name: string): BrowserWindow | null {
    return this.windowManager.get(name) || null;
  }

  /**
   * Close window by name
   */
  public closeWindow(name: string): void {
    const window = this.getWindow(name);
    if (window) {
      this.saveWindowState(window, name);
      window.close();
    }
  }

  /**
   * Close all windows except main
   */
  public closeAllExcept(mainWindowName: string): void {
    const allWindows = BrowserWindow.getAllWindows();
    const mainWindow = this.getWindow(mainWindowName);
    
    allWindows.forEach(window => {
      if (window !== mainWindow) {
        const name = this.findWindowName(window);
        if (name) {
          this.saveWindowState(window, name);
        }
        window.close();
      }
    });
  }

  /**
   * Show window and bring to front
   */
  public showWindow(name: string): void {
    const window = this.getWindow(name);
    if (window) {
      window.show();
      window.focus();
    }
  }

  /**
   * Hide window
   */
  public hideWindow(name: string): void {
    const window = this.getWindow(name);
    if (window) {
      this.saveWindowState(window, name);
      window.hide();
    }
  }

  /**
   * Check if window exists and is visible
   */
  public isWindowVisible(name: string): boolean {
    const window = this.getWindow(name);
    return window ? window.isVisible() : false;
  }

  /**
   * Get list of all managed windows
   */
  public getAllWindowNames(): string[] {
    return this.windowManager.getAll().map(window => window.name || 'unnamed');
  }

  /**
   * Save window state for a specific window
   */
  public saveWindowState(window: BrowserWindow, name: string): void {
    if (window.isDestroyed()) return;

    const state: WindowState = {
      x: window.getBounds().x,
      y: window.getBounds().y,
      width: window.getBounds().width,
      height: window.getBounds().height,
      isMaximized: window.isMaximized(),
      isFullScreen: window.isFullScreen(),
    };

    this.windowStates.set(name, state);
    this.saveWindowStates();
  }

  /**
   * Restore window state
   */
  public restoreWindowState(window: BrowserWindow, state: WindowState): void {
    if (this.isValidPosition(state.x, state.y, state.width, state.height)) {
      window.setBounds({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
      });
    }

    if (state.isMaximized) {
      window.maximize();
    }

    if (state.isFullScreen) {
      window.setFullScreen(true);
    }
  }

  /**
   * Get saved window state
   */
  private getWindowState(name: string): WindowState | null {
    return this.windowStates.get(name) || null;
  }

  /**
   * Build window options with defaults and saved state
   */
  private buildWindowOptions(config: WindowConfig, savedState?: WindowState | null): any {
    const options = {
      width: savedState?.width || config.width,
      height: savedState?.height || config.height,
      minWidth: config.minWidth || 400,
      minHeight: config.minHeight || 300,
      frame: config.frame !== false,
      show: config.show !== false,
      webPreferences: config.webPreferences || {
        nodeIntegration: false,
        contextIsolation: true,
      },
    };

    // Set position if saved state is available and valid
    if (savedState && this.isValidPosition(savedState.x, savedState.y, savedState.width, savedState.height)) {
      options.x = savedState.x;
      options.y = savedState.y;
    }

    return options;
  }

  /**
   * Setup event listeners for window state tracking
   */
  private setupWindowStateTracking(window: BrowserWindow, name: string): void {
    const saveState = () => this.saveWindowState(window, name);

    // Save state on various window events
    window.on('resize', saveState);
    window.on('move', saveState);
    window.on('maximize', saveState);
    window.on('unmaximize', saveState);
    window.on('enter-full-screen', saveState);
    window.on('leave-full-screen', saveState);

    // Save state before closing
    window.on('close', () => saveState());
  }

  /**
   * Check if window position is valid (within screen bounds)
   */
  private isValidPosition(x: number, y: number, width: number, height: number): boolean {
    const displays = screen.getAllDisplays();
    
    return displays.some(display => {
      const bounds = display.workArea;
      return (
        x >= bounds.x &&
        y >= bounds.y &&
        x + width <= bounds.x + bounds.width &&
        y + height <= bounds.y + bounds.height
      );
    });
  }

  /**
   * Find window name by BrowserWindow instance
   */
  private findWindowName(window: BrowserWindow): string | null {
    const managedWindows = this.windowManager.getAll();
    const found = managedWindows.find(w => w.object === window);
    return found?.name || null;
  }

  /**
   * Load window states from persistent storage
   */
  private loadWindowStates(): void {
    try {
      const savedStates = autoSave.load<Record<string, WindowState>>('windowStates');
      if (savedStates) {
        this.windowStates = new Map(Object.entries(savedStates));
      }
    } catch (error) {
      console.error('Failed to load window states:', error);
    }
  }

  /**
   * Save window states to persistent storage
   */
  private saveWindowStates(): void {
    try {
      const statesObject = Object.fromEntries(this.windowStates);
      autoSave.save('windowStates', statesObject);
    } catch (error) {
      console.error('Failed to save window states:', error);
    }
  }

  /**
   * Save all current window states
   */
  public saveAllWindowStates(): void {
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(window => {
      const name = this.findWindowName(window);
      if (name) {
        this.saveWindowState(window, name);
      }
    });
  }

  /**
   * Clean up - save all states before app quit
   */
  public cleanup(): void {
    this.saveAllWindowStates();
  }
}

// Export singleton instance
export const windowManager = new GhostHunterWindowManager();
export default windowManager;