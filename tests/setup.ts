/**
 * Test setup configuration for Tacctile
 * Sets up mocks and test environment for Jest tests
 */

// Mock Electron APIs for testing
const mockElectron = {
  app: {
    getPath: jest.fn(() => '/mock/path'),
    getVersion: jest.fn(() => '1.0.0'),
    getName: jest.fn(() => 'Tacctile'),
    isPackaged: false,
  },
  ipcRenderer: {
    invoke: jest.fn(),
    send: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      on: jest.fn(),
      executeJavaScript: jest.fn(),
      setWindowOpenHandler: jest.fn(),
    },
    show: jest.fn(),
    hide: jest.fn(),
    close: jest.fn(),
    focus: jest.fn(),
    getBounds: jest.fn(() => ({ x: 0, y: 0, width: 800, height: 600 })),
    setBounds: jest.fn(),
    isMaximized: jest.fn(() => false),
    isFullScreen: jest.fn(() => false),
    maximize: jest.fn(),
    isDestroyed: jest.fn(() => false),
    on: jest.fn(),
    once: jest.fn(),
  })),
  session: {
    defaultSession: {
      webRequest: {
        onHeadersReceived: jest.fn(),
        onBeforeSendHeaders: jest.fn(),
      },
    },
  },
  screen: {
    getAllDisplays: jest.fn(() => [
      {
        workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      },
    ]),
  },
};

// Mock electron module
jest.mock('electron', () => mockElectron);

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    store: {},
    path: '/mock/store/path',
  }));
});

// Mock electron-unhandled
jest.mock('electron-unhandled', () => jest.fn());

// Mock file system operations
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(() => []),
  unlink: jest.fn(),
}));

// Mock path module for cross-platform compatibility
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? `.${parts.pop()}` : '';
  }),
}));

// Setup global test utilities
global.mockElectron = mockElectron;

// Suppress console warnings in tests unless explicitly testing them
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

// Global test timeout
jest.setTimeout(10000);

export {};