/**
 * Cross-Platform Utilities
 * Provides OS detection and platform-specific helpers
 */

import { release, arch, homedir, tmpdir } from 'os';
import { join, normalize, resolve, sep } from 'path';
import { app, shell, clipboard } from 'electron';

// Platform detection
export const Platform = {
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux',
  
  // Detailed platform info
  get os(): 'windows' | 'mac' | 'linux' {
    if (this.isWindows) return 'windows';
    if (this.isMac) return 'mac';
    return 'linux';
  },
  
  get version(): string {
    return release();
  },
  
  get architecture(): string {
    return arch();
  },
  
  get is64Bit(): boolean {
    return arch() === 'x64' || arch() === 'arm64';
  },
  
  get isARM(): boolean {
    return arch().startsWith('arm');
  },
  
  // Platform-specific names
  get name(): string {
    if (this.isWindows) return 'Windows';
    if (this.isMac) return 'macOS';
    return 'Linux';
  },
  
  get displayName(): string {
    return `${this.name} ${this.version} (${this.architecture})`;
  }
};

// Cross-platform paths
export const Paths = {
  // User directories
  get home(): string {
    return homedir();
  },
  
  get temp(): string {
    return tmpdir();
  },
  
  get desktop(): string {
    return app.getPath('desktop');
  },
  
  get documents(): string {
    return app.getPath('documents');
  },
  
  get downloads(): string {
    return app.getPath('downloads');
  },
  
  get pictures(): string {
    return app.getPath('pictures');
  },
  
  get videos(): string {
    return app.getPath('videos');
  },
  
  get music(): string {
    return app.getPath('music');
  },
  
  // App-specific directories
  get userData(): string {
    return app.getPath('userData');
  },
  
  get appData(): string {
    return app.getPath('appData');
  },
  
  get logs(): string {
    return app.getPath('logs');
  },
  
  get cache(): string {
    return app.getPath('cache');
  },
  
  get crashDumps(): string {
    return app.getPath('crashDumps');
  },
  
  // Custom app directories
  get evidenceDir(): string {
    return join(this.userData, 'evidence');
  },
  
  get configDir(): string {
    return join(this.userData, 'config');
  },
  
  get pluginsDir(): string {
    return join(this.userData, 'plugins');
  },
  
  get backupsDir(): string {
    return join(this.userData, 'backups');
  },
  
  get exportsDir(): string {
    return join(this.documents, 'GhostHunterExports');
  },
  
  // Path utilities
  normalize(path: string): string {
    return normalize(path);
  },
  
  resolve(...paths: string[]): string {
    return resolve(...paths);
  },
  
  join(...paths: string[]): string {
    return join(...paths);
  },
  
  get separator(): string {
    return sep;
  }
};

// Platform-specific features
export const Features = {
  // Window features
  get supportsTransparency(): boolean {
    return Platform.isMac || (Platform.isWindows && Platform.is64Bit);
  },
  
  get supportsVibrancy(): boolean {
    return Platform.isMac;
  },
  
  get supportsTitleBarStyle(): boolean {
    return Platform.isMac;
  },
  
  get supportsTrafficLights(): boolean {
    return Platform.isMac;
  },
  
  get supportsWindowShadow(): boolean {
    return Platform.isMac || Platform.isWindows;
  },
  
  // System features
  get supportsTouchBar(): boolean {
    return Platform.isMac;
  },
  
  get supportsNotificationCenter(): boolean {
    return Platform.isMac || (Platform.isWindows && parseInt(release().split('.')[0]) >= 10);
  },
  
  get supportsDarkMode(): boolean {
    if (Platform.isMac) return true;
    if (Platform.isWindows) {
      const version = parseInt(release().split('.')[0]);
      return version >= 10;
    }
    return false;
  },
  
  get supportsSystemTray(): boolean {
    return true; // All platforms support system tray
  },
  
  get supportsGlobalShortcuts(): boolean {
    return true; // All platforms support global shortcuts
  },
  
  // Hardware features
  get supportsWebBluetooth(): boolean {
    return Platform.isWindows || Platform.isMac;
  },
  
  get supportsWebUSB(): boolean {
    return Platform.isWindows || Platform.isMac;
  },
  
  get supportsSerialPort(): boolean {
    return true; // All platforms with proper drivers
  },
  
  // Media features
  get supportsMediaKeys(): boolean {
    return Platform.isMac || Platform.isWindows;
  },
  
  get supportsScreenRecording(): boolean {
    if (Platform.isMac) return true;
    if (Platform.isWindows) {
      const version = parseInt(release().split('.')[0]);
      return version >= 10;
    }
    return false;
  }
};

// Platform-specific keyboard shortcuts
export const Shortcuts = {
  // Modifier keys
  get cmdOrCtrl(): string {
    return Platform.isMac ? 'Cmd' : 'Ctrl';
  },
  
  get cmdOrCtrlKey(): string {
    return Platform.isMac ? '⌘' : 'Ctrl';
  },
  
  get altOrOption(): string {
    return Platform.isMac ? 'Option' : 'Alt';
  },
  
  get altOrOptionKey(): string {
    return Platform.isMac ? '⌥' : 'Alt';
  },
  
  // Common shortcuts
  get quit(): string {
    return Platform.isMac ? 'Cmd+Q' : 'Ctrl+Q';
  },
  
  get preferences(): string {
    return Platform.isMac ? 'Cmd+,' : 'Ctrl+,';
  },
  
  get hideWindow(): string {
    return Platform.isMac ? 'Cmd+H' : 'Ctrl+H';
  },
  
  get minimize(): string {
    return Platform.isMac ? 'Cmd+M' : 'Ctrl+M';
  },
  
  get closeWindow(): string {
    return Platform.isMac ? 'Cmd+W' : 'Ctrl+W';
  },
  
  get fullscreen(): string {
    return Platform.isMac ? 'Ctrl+Cmd+F' : 'F11';
  },
  
  get devTools(): string {
    return Platform.isMac ? 'Cmd+Option+I' : 'Ctrl+Shift+I';
  },
  
  get reload(): string {
    return Platform.isMac ? 'Cmd+R' : 'Ctrl+R';
  },
  
  get forceReload(): string {
    return Platform.isMac ? 'Cmd+Shift+R' : 'Ctrl+Shift+R';
  },
  
  get zoomIn(): string {
    return Platform.isMac ? 'Cmd+Plus' : 'Ctrl+Plus';
  },
  
  get zoomOut(): string {
    return Platform.isMac ? 'Cmd+-' : 'Ctrl+-';
  },
  
  get zoomReset(): string {
    return Platform.isMac ? 'Cmd+0' : 'Ctrl+0';
  },
  
  // File operations
  get new(): string {
    return Platform.isMac ? 'Cmd+N' : 'Ctrl+N';
  },
  
  get open(): string {
    return Platform.isMac ? 'Cmd+O' : 'Ctrl+O';
  },
  
  get save(): string {
    return Platform.isMac ? 'Cmd+S' : 'Ctrl+S';
  },
  
  get saveAs(): string {
    return Platform.isMac ? 'Cmd+Shift+S' : 'Ctrl+Shift+S';
  },
  
  // Edit operations
  get undo(): string {
    return Platform.isMac ? 'Cmd+Z' : 'Ctrl+Z';
  },
  
  get redo(): string {
    return Platform.isMac ? 'Cmd+Shift+Z' : 'Ctrl+Y';
  },
  
  get cut(): string {
    return Platform.isMac ? 'Cmd+X' : 'Ctrl+X';
  },
  
  get copy(): string {
    return Platform.isMac ? 'Cmd+C' : 'Ctrl+C';
  },
  
  get paste(): string {
    return Platform.isMac ? 'Cmd+V' : 'Ctrl+V';
  },
  
  get selectAll(): string {
    return Platform.isMac ? 'Cmd+A' : 'Ctrl+A';
  },
  
  get find(): string {
    return Platform.isMac ? 'Cmd+F' : 'Ctrl+F';
  },
  
  get findReplace(): string {
    return Platform.isMac ? 'Cmd+Option+F' : 'Ctrl+H';
  }
};

// File system helpers
export const FileSystem = {
  // Path separators
  get separator(): string {
    return Platform.isWindows ? '\\' : '/';
  },
  
  // File extensions
  get executableExt(): string {
    if (Platform.isWindows) return '.exe';
    if (Platform.isMac) return '.app';
    return '';
  },
  
  // Hidden files
  isHidden(filename: string): boolean {
    if (Platform.isWindows) {
      // Windows hidden files logic would go here
      return false;
    }
    // Unix-like systems
    return filename.startsWith('.');
  },
  
  // Path normalization
  normalizePath(path: string): string {
    // Convert Windows backslashes to forward slashes
    if (Platform.isWindows) {
      return path.replace(/\\/g, '/');
    }
    return path;
  },
  
  // Case sensitivity
  get isCaseSensitive(): boolean {
    return !Platform.isWindows && !Platform.isMac;
  }
};

// System integration
export const System = {
  // Open external links
  async openExternal(url: string): Promise<void> {
    await shell.openExternal(url);
  },
  
  // Open file/folder in system file manager
  showItemInFolder(path: string): void {
    shell.showItemInFolder(path);
  },
  
  // Open file with default application
  async openPath(path: string): Promise<string> {
    return await shell.openPath(path);
  },
  
  // Move to trash
  async moveToTrash(path: string): Promise<void> {
    await shell.trashItem(path);
  },
  
  // System sounds
  beep(): void {
    shell.beep();
  },
  
  // Clipboard operations
  clipboard: {
    writeText(text: string): void {
      clipboard.writeText(text);
    },
    
    readText(): string {
      return clipboard.readText();
    },
    
    clear(): void {
      clipboard.clear();
    }
  }
};

// Window state helpers
export const WindowState = {
  // Window bounds with platform defaults
  getDefaultBounds(): Electron.Rectangle {
    return {
      x: undefined,
      y: undefined,
      width: Platform.isMac ? 1200 : 1280,
      height: Platform.isMac ? 800 : 720
    };
  },
  
  // Minimum window size
  getMinimumSize(): { width: number; height: number } {
    return {
      width: Platform.isMac ? 800 : 900,
      height: Platform.isMac ? 600 : 650
    };
  },
  
  // Window chrome options
  getWindowOptions(): Electron.BrowserWindowConstructorOptions {
    const baseOptions: Electron.BrowserWindowConstructorOptions = {
      show: true, // Force show window immediately
      frame: true,
      transparent: false,
      hasShadow: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    };
    
    if (Platform.isMac) {
      return {
        ...baseOptions,
        titleBarStyle: 'hiddenInset',
        vibrancy: 'sidebar',
        backgroundColor: '#00000000'
      };
    }
    
    if (Platform.isWindows) {
      return {
        ...baseOptions,
        backgroundColor: '#0a0a0a',
        autoHideMenuBar: true
      };
    }
    
    return baseOptions;
  }
};

// Export all utilities
export default {
  Platform,
  Paths,
  Features,
  Shortcuts,
  FileSystem,
  System,
  WindowState
};