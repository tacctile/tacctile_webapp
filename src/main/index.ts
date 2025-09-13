/**
 * Electron Main Process - Cross-Platform
 * Tacctile Desktop Application
 */

import { app, BrowserWindow, Menu, Tray, nativeImage, protocol, shell, dialog } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { Platform, Paths, Features, WindowState, Shortcuts } from '../utils/platform';
import { setupSocialHandlers } from './ipc/social-handlers';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Global references
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Development mode detection
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Create required directories
function ensureDirectories() {
  const dirs = [
    Paths.evidenceDir,
    Paths.configDir,
    Paths.pluginsDir,
    Paths.backupsDir,
    Paths.exportsDir
  ];

  dirs.forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });
}

// Create the main window
function createWindow() {
  console.log('🔧 Creating main window...');
  const MAIN_WINDOW_VITE_DEV_SERVER_URL = process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
  const MAIN_WINDOW_VITE_NAME = process.env.MAIN_WINDOW_VITE_NAME;

  console.log('🌐 Vite dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
  console.log('📦 Vite name:', MAIN_WINDOW_VITE_NAME);

  // Get window options based on platform
  const windowOptions = WindowState.getWindowOptions();
  const minimumSize = WindowState.getMinimumSize();
  const defaultBounds = WindowState.getDefaultBounds();

  console.log('⚙️ Window options:', windowOptions);
  console.log('📏 Default bounds:', defaultBounds);

  // Create the browser window with cross-platform options
  const preloadPath = join(__dirname, 'preload.js');
  console.log('📄 Preload script path:', preloadPath);
  console.log('📄 Preload exists:', existsSync(preloadPath));

  mainWindow = new BrowserWindow({
    ...windowOptions,
    ...defaultBounds,
    minWidth: minimumSize.width,
    minHeight: minimumSize.height,
    title: 'Tacctile',
    icon: getAppIcon(),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Temporarily disable for debugging
      webSecurity: !isDev
    }
  });

  console.log('✅ BrowserWindow created successfully');

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('🌐 Loading Vite dev server...');
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const htmlPath = join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log('📁 Loading HTML file:', htmlPath);
    mainWindow.loadFile(htmlPath);
  }

  // Open DevTools in development
  if (isDev) {
    console.log('🔧 Opening DevTools...');
    mainWindow.webContents.openDevTools();
  }

  // Window event handlers
  mainWindow.on('ready-to-show', () => {
    console.log('🎉 Window ready-to-show event fired!');
    console.log('📺 Calling window.show()...');
    mainWindow?.show();
    console.log('✅ Window show() called');
  });

  // Fallback: Force show window after timeout if ready-to-show doesn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('⚠️ Window not visible after 3 seconds, forcing show...');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Platform-specific window behavior
  if (Platform.isMac) {
    // macOS: Hide window on close instead of quit
    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  } else {
    // Windows/Linux: Minimize to tray on close
    mainWindow.on('close', (event) => {
      if (!isQuitting && tray) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && !url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL || '')) {
      event.preventDefault();
    }
  });
}

// Get app icon based on platform
function getAppIcon(): string | nativeImage | undefined {
  if (Platform.isWindows) {
    return join(__dirname, '../../assets/icon.ico');
  } else if (Platform.isMac) {
    return join(__dirname, '../../assets/icon.icns');
  } else {
    return join(__dirname, '../../assets/icon.png');
  }
}

// Create system tray
function createTray() {
  if (!Features.supportsSystemTray) return;

  const icon = nativeImage.createFromPath(
    join(__dirname, '../../assets/tray-icon.png')
  ).resize({ width: 16, height: 16 });

  tray = new Tray(icon);
  tray.setToolTip('Tacctile');

  // Tray context menu
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show();
      }
    },
    {
      label: 'Start Investigation',
      click: () => {
        mainWindow?.webContents.send('start-investigation');
      }
    },
    { type: 'separator' },
    {
      label: 'Preferences',
      accelerator: Shortcuts.preferences,
      click: () => {
        mainWindow?.webContents.send('open-preferences');
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: Shortcuts.quit,
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Click behavior
  tray.on('click', () => {
    if (Platform.isWindows) {
      mainWindow?.isVisible() ? mainWindow.hide() : mainWindow?.show();
    }
  });
}

// Create application menu
function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    // macOS Application menu
    ...(Platform.isMac ? [{
      label: app.getName(),
      submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        {
          label: 'Preferences',
          accelerator: 'Cmd+,',
          click: () => mainWindow?.webContents.send('open-preferences')
        },
        { type: 'separator' as const },
        { role: 'services' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Investigation',
          accelerator: Shortcuts.new,
          click: () => mainWindow?.webContents.send('new-investigation')
        },
        {
          label: 'Open Investigation',
          accelerator: Shortcuts.open,
          click: () => mainWindow?.webContents.send('open-investigation')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: Shortcuts.save,
          click: () => mainWindow?.webContents.send('save')
        },
        {
          label: 'Save As...',
          accelerator: Shortcuts.saveAs,
          click: () => mainWindow?.webContents.send('save-as')
        },
        { type: 'separator' },
        {
          label: 'Export',
          submenu: [
            {
              label: 'Export as PDF',
              click: () => mainWindow?.webContents.send('export-pdf')
            },
            {
              label: 'Export as CSV',
              click: () => mainWindow?.webContents.send('export-csv')
            },
            {
              label: 'Export as JSON',
              click: () => mainWindow?.webContents.send('export-json')
            }
          ]
        },
        { type: 'separator' },
        ...(Platform.isMac ? [] : [
          {
            label: 'Preferences',
            accelerator: Shortcuts.preferences,
            click: () => mainWindow?.webContents.send('open-preferences')
          },
          { type: 'separator' as const }
        ]),
        ...(Platform.isMac ? [] : [{ role: 'quit' as const }])
      ]
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(Platform.isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Investigation menu
    {
      label: 'Investigation',
      submenu: [
        {
          label: 'Start Recording',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.send('start-recording')
        },
        {
          label: 'Stop Recording',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.send('stop-recording')
        },
        { type: 'separator' },
        {
          label: 'Mark Evidence',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('mark-evidence')
        },
        {
          label: 'Add Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('add-note')
        },
        { type: 'separator' },
        {
          label: 'Analyze Evidence',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow?.webContents.send('analyze-evidence')
        }
      ]
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(Platform.isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [])
      ]
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/tacctile/tacctile_desktop/wiki');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/tacctile/tacctile_desktop/issues');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About Tacctile',
              message: 'Tacctile',
              detail: `Version: ${app.getVersion()}\nPlatform: ${Platform.displayName}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}`,
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  // Ensure directories exist
  ensureDirectories();

  // Setup IPC handlers
  setupSocialHandlers();

  // Create window and UI elements
  createWindow();
  createMenu();
  createTray();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (!Platform.isMac) {
    app.quit();
  }
});

// Before quit cleanup
app.on('before-quit', () => {
  isQuitting = true;
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle protocol for deep linking (tacctile://)
app.setAsDefaultProtocolClient('tacctile');

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    // Ignore certificate errors in development
    event.preventDefault();
    callback(true);
  } else {
    // Use default behavior in production
    callback(false);
  }
});

export default app;