import { EventEmitter } from 'events';
import { BrowserWindow, BrowserWindowConstructorOptions, ipcMain } from 'electron';
import {
  WindowConfiguration,
  WindowSpawnConfig,
  WindowType,
  DisplayInfo,
  WindowPosition,
  WindowSize,
  WindowOptions,
  WindowLifecycle,
  PositionAnchor,
  TitleBarStyle,
  ActiveWindow
} from '../types';
import { DisplayDetectionManager } from '../display/DisplayDetectionManager';

export class WindowSpawner extends EventEmitter {
  private displayManager: DisplayDetectionManager;
  private windows: Map<string, BrowserWindow> = new Map();
  private windowConfigs: Map<string, WindowConfiguration> = new Map();
  private parentChildRelations: Map<string, string[]> = new Map(); // parent -> children
  private childParentRelations: Map<string, string> = new Map(); // child -> parent
  private windowIdCounter = 1;
  private logger: any;

  constructor(displayManager: DisplayDetectionManager) {
    super();
    this.displayManager = displayManager;
    this.logger = console; // Replace with actual logger
    this.setupEventListeners();
    this.registerIPCHandlers();
  }

  private setupEventListeners(): void {
    // Listen for display changes to handle window repositioning
    this.displayManager.on('display-removed', (event) => {
      this.handleDisplayRemoved(event.display);
    });

    this.displayManager.on('display-changed', (event) => {
      this.handleDisplayChanged(event.displays, event.change);
    });
  }

  private registerIPCHandlers(): void {
    // IPC handlers for window management from renderer processes
    ipcMain.handle('spawn-window', async (event, config: WindowSpawnConfig) => {
      return this.spawnWindow(config);
    });

    ipcMain.handle('close-window', async (event, windowId: string) => {
      return this.closeWindow(windowId);
    });

    ipcMain.handle('update-window', async (event, windowId: string, updates: Partial<WindowConfiguration>) => {
      return this.updateWindow(windowId, updates);
    });

    ipcMain.handle('get-window-info', async (event, windowId: string) => {
      return this.getWindowInfo(windowId);
    });

    ipcMain.handle('list-windows', async () => {
      return this.listActiveWindows();
    });
  }

  public async spawnWindow(config: WindowSpawnConfig): Promise<string> {
    try {
      this.logger.info('Spawning window:', config.windowType, 'on display:', config.targetDisplayId);

      // Validate target display
      const targetDisplay = this.displayManager.getDisplay(config.targetDisplayId);
      if (!targetDisplay) {
        throw new Error(`Target display ${config.targetDisplayId} not found`);
      }

      // Generate unique window ID
      const windowId = `window_${config.windowType}_${this.windowIdCounter++}_${Date.now()}`;

      // Calculate window position and size
      const finalPosition = this.calculateFinalPosition(config.position, targetDisplay, config.size);
      const finalSize = this.calculateFinalSize(config.size, targetDisplay);

      // Create window configuration
      const windowConfig: WindowConfiguration = {
        id: windowId,
        title: this.generateWindowTitle(config.windowType),
        displayId: config.targetDisplayId,
        bounds: {
          x: finalPosition.x,
          y: finalPosition.y,
          width: finalSize.width,
          height: finalSize.height
        },
        windowType: config.windowType,
        alwaysOnTop: config.options.alwaysOnTop || false,
        resizable: config.options.resizable !== false,
        minimizable: config.options.minimizable !== false,
        maximizable: config.options.maximizable !== false,
        closable: config.options.closable !== false,
        fullscreenable: true,
        transparent: config.options.transparent || false,
        opacity: config.options.opacity || 1.0,
        hasShadow: true,
        focusable: config.options.focusable !== false,
        skipTaskbar: config.options.skipTaskbar || false,
        kiosk: config.options.kiosk || false,
        frame: config.options.frame !== false,
        show: config.options.show !== false,
        parent: config.parentWindowId,
        modal: config.options.modal || false,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: true,
          webSecurity: true
        }
      };

      // Convert to Electron BrowserWindow options
      const electronOptions = this.convertToElectronOptions(windowConfig, targetDisplay);

      // Create the window
      const browserWindow = new BrowserWindow(electronOptions);

      // Set up window event handlers
      this.setupWindowEventHandlers(browserWindow, windowConfig, config.lifecycle);

      // Store references
      this.windows.set(windowId, browserWindow);
      this.windowConfigs.set(windowId, windowConfig);

      // Handle parent-child relationships
      if (config.parentWindowId) {
        this.establishParentChildRelation(config.parentWindowId, windowId);
      }

      // Load appropriate content based on window type
      await this.loadWindowContent(browserWindow, config.windowType);

      // Apply lifecycle settings
      this.applyLifecycleSettings(browserWindow, config.lifecycle);

      this.emit('window-spawned', {
        windowId,
        config: windowConfig,
        browserWindow
      });

      this.logger.info(`Window spawned successfully: ${windowId}`);
      return windowId;

    } catch (error) {
      this.logger.error('Failed to spawn window:', error);
      this.emit('window-spawn-error', { error, config });
      throw error;
    }
  }

  private calculateFinalPosition(
    position: WindowPosition,
    display: DisplayInfo,
    size: WindowSize
  ): { x: number; y: number } {
    let x = position.x;
    let y = position.y;

    // Apply anchor positioning
    switch (position.anchor) {
      case PositionAnchor.TOP_LEFT:
        // x, y already correct
        break;
      case PositionAnchor.TOP_CENTER:
        x = display.workArea.x + (display.workArea.width - size.width) / 2;
        break;
      case PositionAnchor.TOP_RIGHT:
        x = display.workArea.x + display.workArea.width - size.width;
        break;
      case PositionAnchor.CENTER_LEFT:
        y = display.workArea.y + (display.workArea.height - size.height) / 2;
        break;
      case PositionAnchor.CENTER:
        x = display.workArea.x + (display.workArea.width - size.width) / 2;
        y = display.workArea.y + (display.workArea.height - size.height) / 2;
        break;
      case PositionAnchor.CENTER_RIGHT:
        x = display.workArea.x + display.workArea.width - size.width;
        y = display.workArea.y + (display.workArea.height - size.height) / 2;
        break;
      case PositionAnchor.BOTTOM_LEFT:
        y = display.workArea.y + display.workArea.height - size.height;
        break;
      case PositionAnchor.BOTTOM_CENTER:
        x = display.workArea.x + (display.workArea.width - size.width) / 2;
        y = display.workArea.y + display.workArea.height - size.height;
        break;
      case PositionAnchor.BOTTOM_RIGHT:
        x = display.workArea.x + display.workArea.width - size.width;
        y = display.workArea.y + display.workArea.height - size.height;
        break;
    }

    // Apply offset if provided
    if (position.offset) {
      x += position.offset.x;
      y += position.offset.y;
    }

    // Ensure window stays within display bounds
    x = Math.max(display.bounds.x, Math.min(x, display.bounds.x + display.bounds.width - size.width));
    y = Math.max(display.bounds.y, Math.min(y, display.bounds.y + display.bounds.height - size.height));

    return { x, y };
  }

  private calculateFinalSize(size: WindowSize, display: DisplayInfo): { width: number; height: number } {
    let width = size.width;
    let height = size.height;

    // Apply minimum constraints
    if (size.minWidth) width = Math.max(width, size.minWidth);
    if (size.minHeight) height = Math.max(height, size.minHeight);

    // Apply maximum constraints
    if (size.maxWidth) width = Math.min(width, size.maxWidth);
    if (size.maxHeight) height = Math.min(height, size.maxHeight);

    // Apply aspect ratio if specified
    if (size.aspectRatio) {
      const currentRatio = width / height;
      if (Math.abs(currentRatio - size.aspectRatio) > 0.01) {
        // Adjust height to maintain aspect ratio
        height = width / size.aspectRatio;
        
        // Re-apply constraints
        if (size.minHeight) height = Math.max(height, size.minHeight);
        if (size.maxHeight) height = Math.min(height, size.maxHeight);
        
        // If height was constrained, adjust width
        width = height * size.aspectRatio;
      }
    }

    // Ensure size doesn't exceed display work area
    const maxWidth = display.workArea.width * 0.95; // Leave some margin
    const maxHeight = display.workArea.height * 0.95;
    
    width = Math.min(width, maxWidth);
    height = Math.min(height, maxHeight);

    return { width: Math.round(width), height: Math.round(height) };
  }

  private generateWindowTitle(windowType: WindowType): string {
    const titleMap: Record<WindowType, string> = {
      [WindowType.MAIN_CONTROL]: 'Investigation Control Center',
      [WindowType.MONITORING_DISPLAY]: 'Live Monitoring Dashboard',
      [WindowType.DATA_STREAM]: 'Data Stream Viewer',
      [WindowType.EMF_VISUALIZATION]: 'EMF Field Visualization',
      [WindowType.AUDIO_ANALYZER]: 'Audio Frequency Analyzer',
      [WindowType.CAMERA_FEED]: '360° Camera Feed',
      [WindowType.CORRELATION_MATRIX]: 'Multi-Source Correlation Analysis',
      [WindowType.ENVIRONMENTAL_METRICS]: 'Environmental Metrics Monitor',
      [WindowType.SESSION_TIMELINE]: 'Investigation Timeline',
      [WindowType.ALERT_PANEL]: 'Alert Management Panel',
      [WindowType.SETTINGS_PANEL]: 'System Settings',
      [WindowType.DEBUG_CONSOLE]: 'Debug Console'
    };

    return titleMap[windowType] || `${windowType} Window`;
  }

  private convertToElectronOptions(
    config: WindowConfiguration,
    display: DisplayInfo
  ): BrowserWindowConstructorOptions {
    return {
      x: config.bounds.x,
      y: config.bounds.y,
      width: config.bounds.width,
      height: config.bounds.height,
      title: config.title,
      alwaysOnTop: config.alwaysOnTop,
      autoHideMenuBar: true,
      backgroundColor: '#000000',
      closable: config.closable,
      frame: config.frame,
      fullscreenable: config.fullscreenable,
      hasShadow: config.hasShadow,
      kiosk: config.kiosk,
      maximizable: config.maximizable,
      minimizable: config.minimizable,
      modal: config.modal,
      movable: true,
      opacity: config.opacity,
      resizable: config.resizable,
      show: config.show,
      skipTaskbar: config.skipTaskbar,
      titleBarStyle: this.getTitleBarStyle(config.windowType),
      transparent: config.transparent,
      useContentSize: false,
      webPreferences: {
        nodeIntegration: config.webPreferences.nodeIntegration,
        contextIsolation: config.webPreferences.contextIsolation,
        enableRemoteModule: config.webPreferences.enableRemoteModule,
        webSecurity: config.webPreferences.webSecurity,
        allowRunningInsecureContent: false,
        experimentalFeatures: true
      },
      icon: this.getWindowIcon(config.windowType)
    };
  }

  private getTitleBarStyle(windowType: WindowType): 'default' | 'hidden' | 'hiddenInset' | 'customButtonsOnHover' {
    const hiddenTitleBarTypes = [
      WindowType.MONITORING_DISPLAY,
      WindowType.DATA_STREAM,
      WindowType.EMF_VISUALIZATION,
      WindowType.CAMERA_FEED
    ];

    return hiddenTitleBarTypes.includes(windowType) ? 'hidden' : 'default';
  }

  private getWindowIcon(windowType: WindowType): string | undefined {
    // Return appropriate icon path based on window type
    const iconMap: Record<WindowType, string> = {
      [WindowType.MAIN_CONTROL]: './assets/icons/control.png',
      [WindowType.MONITORING_DISPLAY]: './assets/icons/monitor.png',
      [WindowType.DATA_STREAM]: './assets/icons/stream.png',
      [WindowType.EMF_VISUALIZATION]: './assets/icons/emf.png',
      [WindowType.AUDIO_ANALYZER]: './assets/icons/audio.png',
      [WindowType.CAMERA_FEED]: './assets/icons/camera.png',
      [WindowType.CORRELATION_MATRIX]: './assets/icons/correlation.png',
      [WindowType.ENVIRONMENTAL_METRICS]: './assets/icons/environment.png',
      [WindowType.SESSION_TIMELINE]: './assets/icons/timeline.png',
      [WindowType.ALERT_PANEL]: './assets/icons/alert.png',
      [WindowType.SETTINGS_PANEL]: './assets/icons/settings.png',
      [WindowType.DEBUG_CONSOLE]: './assets/icons/debug.png'
    };

    return iconMap[windowType];
  }

  private setupWindowEventHandlers(
    window: BrowserWindow,
    config: WindowConfiguration,
    lifecycle: WindowLifecycle
  ): void {
    const windowId = config.id;

    // Window lifecycle events
    window.on('ready-to-show', () => {
      if (lifecycle.autoShow && !config.show) {
        if (lifecycle.showTimeout) {
          setTimeout(() => window.show(), lifecycle.showTimeout);
        } else {
          window.show();
        }
      }
      this.emit('window-ready', { windowId, window });
    });

    window.on('show', () => {
      this.emit('window-shown', { windowId, window });
    });

    window.on('hide', () => {
      this.emit('window-hidden', { windowId, window });
    });

    window.on('focus', () => {
      this.emit('window-focused', { windowId, window });
    });

    window.on('blur', () => {
      this.emit('window-blurred', { windowId, window });
    });

    window.on('minimize', () => {
      this.emit('window-minimized', { windowId, window });
    });

    window.on('maximize', () => {
      this.emit('window-maximized', { windowId, window });
    });

    window.on('restore', () => {
      this.emit('window-restored', { windowId, window });
    });

    window.on('resize', () => {
      const bounds = window.getBounds();
      config.bounds = bounds;
      this.emit('window-resized', { windowId, window, bounds });
    });

    window.on('move', () => {
      const bounds = window.getBounds();
      config.bounds = bounds;
      this.emit('window-moved', { windowId, window, bounds });
    });

    window.on('enter-full-screen', () => {
      this.emit('window-fullscreen-enter', { windowId, window });
    });

    window.on('leave-full-screen', () => {
      this.emit('window-fullscreen-exit', { windowId, window });
    });

    window.on('closed', () => {
      this.handleWindowClosed(windowId, lifecycle);
    });

    window.on('unresponsive', () => {
      this.logger.warn(`Window ${windowId} became unresponsive`);
      this.emit('window-unresponsive', { windowId, window });
    });

    window.on('responsive', () => {
      this.logger.info(`Window ${windowId} became responsive again`);
      this.emit('window-responsive', { windowId, window });
    });

    // Web contents events
    window.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      this.logger.error(`Window ${windowId} failed to load:`, errorDescription);
      this.emit('window-load-failed', { windowId, window, errorCode, errorDescription });
    });

    window.webContents.on('did-finish-load', () => {
      this.emit('window-loaded', { windowId, window });
    });

    window.webContents.on('crashed', (event, killed) => {
      this.logger.error(`Window ${windowId} crashed:`, { killed });
      this.emit('window-crashed', { windowId, window, killed });
    });
  }

  private async loadWindowContent(window: BrowserWindow, windowType: WindowType): Promise<void> {
    const contentMap: Record<WindowType, string> = {
      [WindowType.MAIN_CONTROL]: '/main-control',
      [WindowType.MONITORING_DISPLAY]: '/monitoring-display',
      [WindowType.DATA_STREAM]: '/data-stream',
      [WindowType.EMF_VISUALIZATION]: '/emf-visualization',
      [WindowType.AUDIO_ANALYZER]: '/audio-analyzer',
      [WindowType.CAMERA_FEED]: '/camera-feed',
      [WindowType.CORRELATION_MATRIX]: '/correlation-matrix',
      [WindowType.ENVIRONMENTAL_METRICS]: '/environmental-metrics',
      [WindowType.SESSION_TIMELINE]: '/session-timeline',
      [WindowType.ALERT_PANEL]: '/alert-panel',
      [WindowType.SETTINGS_PANEL]: '/settings',
      [WindowType.DEBUG_CONSOLE]: '/debug-console'
    };

    const contentPath = contentMap[windowType] || '/default';
    
    if (process.env.NODE_ENV === 'development') {
      await window.loadURL(`http://localhost:3000${contentPath}`);
      window.webContents.openDevTools();
    } else {
      await window.loadFile(`dist/renderer/index.html${contentPath}`);
    }
  }

  private applyLifecycleSettings(window: BrowserWindow, lifecycle: WindowLifecycle): void {
    // Store lifecycle settings for later use
    const config = this.windowConfigs.get(window.id.toString());
    if (config) {
      // Settings are applied through event handlers
    }
  }

  private establishParentChildRelation(parentId: string, childId: string): void {
    // Add child to parent's children list
    if (!this.parentChildRelations.has(parentId)) {
      this.parentChildRelations.set(parentId, []);
    }
    this.parentChildRelations.get(parentId)!.push(childId);

    // Set parent for child
    this.childParentRelations.set(childId, parentId);

    // Set actual parent window in Electron
    const parentWindow = this.windows.get(parentId);
    const childWindow = this.windows.get(childId);
    
    if (parentWindow && childWindow) {
      childWindow.setParentWindow(parentWindow);
    }
  }

  private handleWindowClosed(windowId: string, lifecycle: WindowLifecycle): void {
    this.logger.info(`Window closed: ${windowId}`);

    // Handle child windows if this is a parent
    const children = this.parentChildRelations.get(windowId);
    if (children) {
      for (const childId of children) {
        if (lifecycle.closeWithParent) {
          this.closeWindow(childId);
        }
      }
      this.parentChildRelations.delete(windowId);
    }

    // Clean up parent relation if this is a child
    const parentId = this.childParentRelations.get(windowId);
    if (parentId) {
      const siblings = this.parentChildRelations.get(parentId);
      if (siblings) {
        const index = siblings.indexOf(windowId);
        if (index > -1) {
          siblings.splice(index, 1);
        }
      }
      this.childParentRelations.delete(windowId);
    }

    // Clean up references
    this.windows.delete(windowId);
    this.windowConfigs.delete(windowId);

    this.emit('window-closed', { windowId, lifecycle });
  }

  private async handleDisplayRemoved(display: DisplayInfo): Promise<void> {
    this.logger.info(`Display removed: ${display.id}, relocating windows`);

    const affectedWindows = Array.from(this.windowConfigs.values())
      .filter(config => config.displayId === display.id);

    // Move windows to primary display
    const primaryDisplay = this.displayManager.getPrimaryDisplay();
    if (!primaryDisplay) {
      this.logger.error('No primary display available for window relocation');
      return;
    }

    for (const config of affectedWindows) {
      const window = this.windows.get(config.id);
      if (window) {
        try {
          // Calculate new position on primary display
          const newPosition = this.displayManager.calculateOptimalPosition(
            { type: 'automatic' },
            primaryDisplay,
            { width: config.bounds.width, height: config.bounds.height },
            this.getExistingWindowBounds()
          );

          window.setBounds({
            x: newPosition.x,
            y: newPosition.y,
            width: config.bounds.width,
            height: config.bounds.height
          });

          // Update config
          config.displayId = primaryDisplay.id;
          config.bounds.x = newPosition.x;
          config.bounds.y = newPosition.y;

          this.emit('window-relocated', {
            windowId: config.id,
            oldDisplayId: display.id,
            newDisplayId: primaryDisplay.id,
            newBounds: config.bounds
          });

        } catch (error) {
          this.logger.error(`Failed to relocate window ${config.id}:`, error);
        }
      }
    }
  }

  private async handleDisplayChanged(displays: DisplayInfo[], change: any): Promise<void> {
    // Handle display changes that might affect window positioning
    if (change.type === 'resized' || change.type === 'moved') {
      const affectedWindows = Array.from(this.windowConfigs.values())
        .filter(config => config.displayId === change.displayId);

      for (const config of affectedWindows) {
        const window = this.windows.get(config.id);
        const display = displays.find(d => d.id === config.displayId);
        
        if (window && display) {
          // Check if window is still within display bounds
          const windowBounds = window.getBounds();
          const displayBounds = display.bounds;
          
          if (windowBounds.x + windowBounds.width > displayBounds.x + displayBounds.width ||
              windowBounds.y + windowBounds.height > displayBounds.y + displayBounds.height) {
            
            // Reposition window within display
            const newPosition = this.displayManager.calculateOptimalPosition(
              { type: 'automatic' },
              display,
              { width: windowBounds.width, height: windowBounds.height }
            );

            window.setPosition(newPosition.x, newPosition.y);
            config.bounds.x = newPosition.x;
            config.bounds.y = newPosition.y;

            this.emit('window-repositioned', {
              windowId: config.id,
              displayId: display.id,
              newBounds: config.bounds
            });
          }
        }
      }
    }
  }

  private getExistingWindowBounds(): Array<{ bounds: { x: number; y: number; width: number; height: number } }> {
    return Array.from(this.windows.values()).map(window => ({
      bounds: window.getBounds()
    }));
  }

  public async closeWindow(windowId: string): Promise<boolean> {
    try {
      const window = this.windows.get(windowId);
      const config = this.windowConfigs.get(windowId);

      if (!window || !config) {
        this.logger.warn(`Window ${windowId} not found for closing`);
        return false;
      }

      this.logger.info(`Closing window: ${windowId}`);

      // Close the window
      if (!window.isDestroyed()) {
        window.close();
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to close window ${windowId}:`, error);
      return false;
    }
  }

  public async updateWindow(windowId: string, updates: Partial<WindowConfiguration>): Promise<boolean> {
    try {
      const window = this.windows.get(windowId);
      const config = this.windowConfigs.get(windowId);

      if (!window || !config) {
        this.logger.warn(`Window ${windowId} not found for update`);
        return false;
      }

      // Apply updates
      Object.assign(config, updates);

      // Apply bounds changes
      if (updates.bounds) {
        window.setBounds(updates.bounds);
      }

      // Apply other property changes
      if (updates.alwaysOnTop !== undefined) {
        window.setAlwaysOnTop(updates.alwaysOnTop);
      }

      if (updates.opacity !== undefined) {
        window.setOpacity(updates.opacity);
      }

      if (updates.title) {
        window.setTitle(updates.title);
      }

      this.emit('window-updated', { windowId, updates, config });
      return true;

    } catch (error) {
      this.logger.error(`Failed to update window ${windowId}:`, error);
      return false;
    }
  }

  public getWindowInfo(windowId: string): WindowConfiguration | null {
    return this.windowConfigs.get(windowId) || null;
  }

  public listActiveWindows(): ActiveWindow[] {
    const activeWindows: ActiveWindow[] = [];

    for (const [windowId, window] of this.windows) {
      const config = this.windowConfigs.get(windowId);
      if (config && !window.isDestroyed()) {
        const bounds = window.getBounds();
        activeWindows.push({
          windowId,
          displayId: config.displayId,
          processId: window.webContents.getProcessId(),
          isVisible: window.isVisible(),
          isFocused: window.isFocused(),
          bounds,
          lastActivity: Date.now()
        });
      }
    }

    return activeWindows;
  }

  public getWindow(windowId: string): BrowserWindow | null {
    return this.windows.get(windowId) || null;
  }

  public getWindowsByType(windowType: WindowType): Array<{ windowId: string; window: BrowserWindow; config: WindowConfiguration }> {
    const results: Array<{ windowId: string; window: BrowserWindow; config: WindowConfiguration }> = [];

    for (const [windowId, window] of this.windows) {
      const config = this.windowConfigs.get(windowId);
      if (config && config.windowType === windowType && !window.isDestroyed()) {
        results.push({ windowId, window, config });
      }
    }

    return results;
  }

  public getWindowsByDisplay(displayId: string): Array<{ windowId: string; window: BrowserWindow; config: WindowConfiguration }> {
    const results: Array<{ windowId: string; window: BrowserWindow; config: WindowConfiguration }> = [];

    for (const [windowId, window] of this.windows) {
      const config = this.windowConfigs.get(windowId);
      if (config && config.displayId === displayId && !window.isDestroyed()) {
        results.push({ windowId, window, config });
      }
    }

    return results;
  }

  public closeAllWindows(): Promise<void> {
    const promises = Array.from(this.windows.keys()).map(windowId => this.closeWindow(windowId));
    return Promise.all(promises).then(() => {});
  }

  public closeWindowsByType(windowType: WindowType): Promise<void> {
    const windowsToClose = this.getWindowsByType(windowType);
    const promises = windowsToClose.map(({ windowId }) => this.closeWindow(windowId));
    return Promise.all(promises).then(() => {});
  }

  public closeWindowsByDisplay(displayId: string): Promise<void> {
    const windowsToClose = this.getWindowsByDisplay(displayId);
    const promises = windowsToClose.map(({ windowId }) => this.closeWindow(windowId));
    return Promise.all(promises).then(() => {});
  }

  public dispose(): void {
    // Close all windows
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }

    // Clear maps
    this.windows.clear();
    this.windowConfigs.clear();
    this.parentChildRelations.clear();
    this.childParentRelations.clear();

    this.removeAllListeners();
    this.logger.info('WindowSpawner disposed');
  }
}