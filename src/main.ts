import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import installExtension, { REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS } from 'electron-devtools-installer';
import * as Sentry from '@sentry/electron';
import unhandled from 'electron-unhandled';
import { autoBackup } from './utils/autoBackup';
import { windowManager } from './utils/windowManager';
import { DEFAULT_CSP } from './security/csp';
import { licenseManager } from './licensing/licenseManager';

// Initialize error handling and crash recovery
unhandled({
  logger: (error) => {
    console.error('Unhandled error:', error);
    Sentry.captureException(error);
  },
  showDialog: !app.isPackaged, // Show error dialogs in development only
});

// Initialize Sentry for error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN || '', // Add your Sentry DSN here
  environment: process.env.NODE_ENV || 'development',
  debug: !app.isPackaged,
  enabled: app.isPackaged, // Only enable in production builds
});

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window with secure configuration.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Security: Disable Node integration in renderer
      nodeIntegration: false,
      // Security: Enable context isolation
      contextIsolation: true,
      // Security: Disable web security in development only
      webSecurity: app.isPackaged,
      // Security: Disable remote module
      enableRemoteModule: false,
      // Security: Use preload script for secure IPC
      preload: path.join(__dirname, 'preload.js'),
      // Security: Disable experimental features
      experimentalFeatures: false,
      // Security: Allow running insecure content in dev only
      allowRunningInsecureContent: !app.isPackaged,
    },
    // Security: Don't show until ready to prevent flickering
    show: false,
  });

  // Security: Set up Content Security Policy
  mainWindow.webContents.on('did-finish-load', () => {
    // Inject CSP meta tag
    mainWindow.webContents.executeJavaScript(`
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = '${DEFAULT_CSP}';
      document.head.appendChild(meta);
    `);
  });

  // Security: Prevent new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Security: Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = [
      MAIN_WINDOW_VITE_DEV_SERVER_URL,
      'file://',
    ];
    
    if (!allowedOrigins.some(origin => url.startsWith(origin))) {
      event.preventDefault();
      console.warn('Blocked navigation to:', url);
    }
  });

  // Load the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Focus window
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  });

  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // Security: Set up session security
  const ses = session.defaultSession;
  
  // Security: Set secure headers
  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [DEFAULT_CSP],
        'X-Frame-Options': ['DENY'],
        'X-Content-Type-Options': ['nosniff'],
        'X-XSS-Protection': ['1; mode=block'],
        'Referrer-Policy': ['strict-origin-when-cross-origin'],
      },
    });
  });
  
  // Security: Remove unsafe headers
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    delete details.requestHeaders['Origin'];
    delete details.requestHeaders['Referer'];
    callback({ requestHeaders: details.requestHeaders });
  });
  
  // Install React Developer Tools and Redux DevTools in development
  if (!app.isPackaged) {
    try {
      await installExtension([REACT_DEVELOPER_TOOLS, REDUX_DEVTOOLS]);
      console.log('DevTools Extensions installed successfully');
    } catch (error) {
      console.error('Failed to install DevTools Extensions:', error);
    }
  }
  
  // Perform license check before creating window
  const licenseCheck = await licenseManager.performStartupCheck();
  
  if (!licenseCheck.canProceed) {
    console.log('❌ License check failed:', licenseCheck.message);
    
    // Show license dialog and wait for user action
    const licenseActivated = await licenseManager.showLicenseDialog();
    
    if (!licenseActivated) {
      console.log('🚪 User chose to quit - exiting application');
      app.quit();
      return;
    }
  }
  
  console.log('✅ License validated - proceeding with application startup');
  
  // Initialize auto-backup
  autoBackup.start();
  
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // Clean up auto-backup and window states
  autoBackup.stop();
  windowManager.cleanup();
  licenseManager.cleanup();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
