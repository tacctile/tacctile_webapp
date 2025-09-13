/**
 * Secure preload script using contextBridge
 * This script runs in a privileged context and exposes safe APIs to the renderer
 */

import { contextBridge, ipcRenderer } from 'electron';
import { autoSave } from './utils/autoSave';
import { autoBackup } from './utils/autoBackup';
import { windowManager } from './utils/windowManager';

// Security: Validate all IPC channels to prevent injection attacks
const ALLOWED_CHANNELS = {
  // Window management
  'window:minimize': true,
  'window:maximize': true,
  'window:close': true,
  'window:create': true,
  'window:focus': true,
  
  // File operations
  'file:open': true,
  'file:save': true,
  'file:export': true,
  
  // Investigation management
  'investigation:create': true,
  'investigation:load': true,
  'investigation:save': true,
  'investigation:delete': true,
  
  // Evidence management
  'evidence:add': true,
  'evidence:update': true,
  'evidence:delete': true,
  'evidence:analyze': true,
  
  // Settings
  'settings:get': true,
  'settings:set': true,
  'settings:reset': true,
  
  // Updates
  'app:check-updates': true,
  'app:install-update': true,
  
  // Notifications
  'notification:show': true,
  
  // Hardware access
  'hardware:camera:start': true,
  'hardware:camera:stop': true,
  'hardware:microphone:start': true,
  'hardware:microphone:stop': true,
};

/**
 * Validate IPC channel to prevent malicious calls
 */
function isValidChannel(channel: string): boolean {
  return ALLOWED_CHANNELS[channel] === true;
}

/**
 * Safe IPC invoke wrapper with validation
 */
async function safeInvoke(channel: string, ...args: unknown[]): Promise<unknown> {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  return await ipcRenderer.invoke(channel, ...args);
}

/**
 * Safe IPC send wrapper with validation
 */
function safeSend(channel: string, ...args: unknown[]): void {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  ipcRenderer.send(channel, ...args);
}

/**
 * Safe event listener wrapper
 */
function safeOn(channel: string, listener: (...args: unknown[]) => void): void {
  if (!isValidChannel(channel)) {
    throw new Error(`Invalid IPC channel: ${channel}`);
  }
  ipcRenderer.on(channel, (_event, ...args) => listener(...args));
}

/**
 * Remove event listener safely
 */
function safeOff(channel: string, listener: (...args: unknown[]) => void): void {
  if (!isValidChannel(channel)) {
    return;
  }
  ipcRenderer.removeListener(channel, listener);
}

// Expose secure APIs to renderer process
contextBridge.exposeInMainWorld('ghostHunterAPI', {
  // IPC Communication
  invoke: safeInvoke,
  send: safeSend,
  on: safeOn,
  off: safeOff,
  
  // Window Management
  window: {
    minimize: () => safeSend('window:minimize'),
    maximize: () => safeSend('window:maximize'),
    close: () => safeSend('window:close'),
    create: (config: Record<string, unknown>) => safeInvoke('window:create', config),
    focus: (windowName: string) => safeSend('window:focus', windowName),
  },
  
  // File Operations
  file: {
    open: (filters?: Record<string, unknown>) => safeInvoke('file:open', filters),
    save: (data: unknown, path?: string) => safeInvoke('file:save', data, path),
    export: (data: unknown, format: string) => safeInvoke('file:export', data, format),
  },
  
  // Investigation Management
  investigation: {
    create: (data: Record<string, unknown>) => safeInvoke('investigation:create', data),
    load: (id: string) => safeInvoke('investigation:load', id),
    save: (data: Record<string, unknown>) => safeInvoke('investigation:save', data),
    delete: (id: string) => safeInvoke('investigation:delete', id),
  },
  
  // Evidence Management
  evidence: {
    add: (data: Record<string, unknown>) => safeInvoke('evidence:add', data),
    update: (id: string, data: Record<string, unknown>) => safeInvoke('evidence:update', id, data),
    delete: (id: string) => safeInvoke('evidence:delete', id),
    analyze: (id: string, options?: Record<string, unknown>) => safeInvoke('evidence:analyze', id, options),
  },
  
  // Settings
  settings: {
    get: (key?: string) => safeInvoke('settings:get', key),
    set: (key: string, value: unknown) => safeInvoke('settings:set', key, value),
    reset: () => safeInvoke('settings:reset'),
  },
  
  // Auto-save functionality (direct access for performance)
  autoSave: {
    save: (key: string, data: unknown) => autoSave.save(key as string, data),
    saveNow: (key: string, data: unknown) => autoSave.saveNow(key as string, data),
    load: (key: string) => autoSave.load(key as string),
    loadAll: () => autoSave.loadAll(),
    clear: (key: string) => autoSave.clear(key as string),
    clearAll: () => autoSave.clearAll(),
    isHealthy: () => autoSave.isHealthy(),
    getStorePath: () => autoSave.getStorePath(),
  },
  
  // Auto-backup functionality
  autoBackup: {
    start: () => autoBackup.start(),
    stop: () => autoBackup.stop(),
    performBackup: () => autoBackup.performBackup(),
    restoreFromBackup: (path: string) => autoBackup.restoreFromBackup(path),
    listBackups: () => autoBackup.listBackups(),
    updateConfig: (config: Record<string, unknown>) => autoBackup.updateConfig(config),
    getConfig: () => autoBackup.getConfig(),
  },
  
  // Window state management
  windowManager: {
    createWindow: (config: Record<string, unknown>) => windowManager.createWindow(config),
    getWindow: (name: string) => windowManager.getWindow(name),
    closeWindow: (name: string) => windowManager.closeWindow(name),
    showWindow: (name: string) => windowManager.showWindow(name),
    hideWindow: (name: string) => windowManager.hideWindow(name),
    isWindowVisible: (name: string) => windowManager.isWindowVisible(name),
    getAllWindowNames: () => windowManager.getAllWindowNames(),
  },
  
  // Hardware Access
  hardware: {
    camera: {
      start: (options?: Record<string, unknown>) => safeInvoke('hardware:camera:start', options),
      stop: () => safeInvoke('hardware:camera:stop'),
    },
    microphone: {
      start: (options?: Record<string, unknown>) => safeInvoke('hardware:microphone:start', options),
      stop: () => safeInvoke('hardware:microphone:stop'),
    },
  },
  
  // App Information
  app: {
    getVersion: () => safeInvoke('app:get-version'),
    getName: () => safeInvoke('app:get-name'),
    checkUpdates: () => safeInvoke('app:check-updates'),
    installUpdate: () => safeInvoke('app:install-update'),
  },
  
  // Notifications
  notifications: {
    show: (options: Record<string, unknown>) => safeSend('notification:show', options),
  },
  
  // Plugin API
  plugins: {
    list: () => safeInvoke('plugins:list'),
    load: (name: string) => safeInvoke('plugins:load', name),
    unload: (name: string) => safeInvoke('plugins:unload', name),
    getInfo: (name: string) => safeInvoke('plugins:get-info', name),
  },
  
  // Security utilities
  security: {
    sanitizeHtml: (html: string) => {
      // Basic HTML sanitization - in production use a proper library like DOMPurify
      return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    },
    validateFileType: (fileName: string, allowedTypes: string[]) => {
      const extension = fileName.split('.').pop()?.toLowerCase();
      return extension ? allowedTypes.includes(extension) : false;
    },
  },
});

// Log successful preload initialization
console.log('🔒 Secure preload script initialized with contextBridge');
