/**
 * Preload Script - Secure Bridge
 * Provides safe, controlled access to native APIs
 */

import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface
interface GhostHunterAPI {
  // Platform info
  platform: {
    os: string;
    version: string;
    architecture: string;
    isDark: () => Promise<boolean>;
  };
  
  // File operations
  file: {
    selectDirectory: (title?: string) => Promise<string | null>;
    selectFile: (options?: Record<string, unknown>) => Promise<string[] | null>;
    saveFile: (options?: Record<string, unknown>) => Promise<string | null>;
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, content: string) => Promise<void>;
    exists: (path: string) => Promise<boolean>;
  };
  
  // Audio/Video
  media: {
    getAudioDevices: () => Promise<MediaDeviceInfo[]>;
    getCameras: () => Promise<MediaDeviceInfo[]>;
    getMicrophones: () => Promise<MediaDeviceInfo[]>;
    requestCameraPermission: () => Promise<boolean>;
    requestMicrophonePermission: () => Promise<boolean>;
  };
  
  // Hardware
  hardware: {
    getSerialPorts: () => Promise<string[]>;
    checkBluetoothStatus: () => Promise<boolean>;
    getBluetoothDevices: () => Promise<Record<string, unknown>[]>;
  };
  
  // System
  system: {
    getInfo: () => Promise<Record<string, unknown>>;
    getNetworkInterfaces: () => Promise<Record<string, unknown>>;
    getDisplays: () => Promise<Record<string, unknown>>;
    showNotification: (options: Record<string, unknown>) => Promise<void>;
    showErrorDialog: (title: string, content: string) => Promise<void>;
    showMessageDialog: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
  };
  
  // Investigation
  investigation: {
    new: () => Promise<void>;
    open: () => Promise<void>;
    save: () => Promise<void>;
    saveAs: () => Promise<void>;
    export: (format: 'pdf' | 'csv' | 'json') => Promise<void>;
  };
  
  // Recording
  recording: {
    start: () => Promise<void>;
    stop: () => Promise<void>;
    pause: () => Promise<void>;
    resume: () => Promise<void>;
    markEvidence: () => Promise<void>;
    addNote: (note: string) => Promise<void>;
  };
  
  // Settings
  settings: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    getAll: () => Promise<Record<string, unknown>>;
  };
  
  // Events
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  off: (channel: string, callback: (...args: unknown[]) => void) => void;
  once: (channel: string, callback: (...args: unknown[]) => void) => void;
}

// Platform API
const platformAPI = {
  os: process.platform,
  version: process.versions.electron,
  architecture: process.arch,
  isDark: () => ipcRenderer.invoke('platform:isDark')
};

// File API
const fileAPI = {
  selectDirectory: (title?: string) => 
    ipcRenderer.invoke('file:selectDirectory', title),
  selectFile: (options?: Record<string, unknown>) => 
    ipcRenderer.invoke('file:selectFile', options),
  saveFile: (options?: Record<string, unknown>) => 
    ipcRenderer.invoke('file:saveFile', options),
  readFile: (path: string) => 
    ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => 
    ipcRenderer.invoke('file:write', path, content),
  exists: (path: string) => 
    ipcRenderer.invoke('file:exists', path)
};

// Media API
const mediaAPI = {
  getAudioDevices: () => 
    ipcRenderer.invoke('media:getAudioDevices'),
  getCameras: () => 
    ipcRenderer.invoke('media:getCameras'),
  getMicrophones: () => 
    ipcRenderer.invoke('media:getMicrophones'),
  requestCameraPermission: () => 
    ipcRenderer.invoke('media:requestCameraPermission'),
  requestMicrophonePermission: () => 
    ipcRenderer.invoke('media:requestMicrophonePermission')
};

// Hardware API
const hardwareAPI = {
  getSerialPorts: () => 
    ipcRenderer.invoke('hardware:getSerialPorts'),
  checkBluetoothStatus: () => 
    ipcRenderer.invoke('hardware:checkBluetoothStatus'),
  getBluetoothDevices: () => 
    ipcRenderer.invoke('hardware:getBluetoothDevices')
};

// System API
const systemAPI = {
  getInfo: () => 
    ipcRenderer.invoke('system:getInfo'),
  getNetworkInterfaces: () => 
    ipcRenderer.invoke('system:getNetworkInterfaces'),
  getDisplays: () => 
    ipcRenderer.invoke('system:getDisplays'),
  showNotification: (options: Record<string, unknown>) => 
    ipcRenderer.invoke('system:showNotification', options),
  showErrorDialog: (title: string, content: string) => 
    ipcRenderer.invoke('system:showErrorDialog', title, content),
  showMessageDialog: (options: Record<string, unknown>) => 
    ipcRenderer.invoke('system:showMessageDialog', options)
};

// Investigation API
const investigationAPI = {
  new: () => ipcRenderer.invoke('investigation:new'),
  open: () => ipcRenderer.invoke('investigation:open'),
  save: () => ipcRenderer.invoke('investigation:save'),
  saveAs: () => ipcRenderer.invoke('investigation:saveAs'),
  export: (format: 'pdf' | 'csv' | 'json') => 
    ipcRenderer.invoke('investigation:export', format)
};

// Recording API
const recordingAPI = {
  start: () => ipcRenderer.invoke('recording:start'),
  stop: () => ipcRenderer.invoke('recording:stop'),
  pause: () => ipcRenderer.invoke('recording:pause'),
  resume: () => ipcRenderer.invoke('recording:resume'),
  markEvidence: () => ipcRenderer.invoke('recording:markEvidence'),
  addNote: (note: string) => ipcRenderer.invoke('recording:addNote', note)
};

// Settings API
const settingsAPI = {
  get: (key: string) => ipcRenderer.invoke('settings:get', key),
  set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
  getAll: () => ipcRenderer.invoke('settings:getAll')
};

// Event handling with cleanup
const validChannels = [
  'start-investigation',
  'open-preferences',
  'new-investigation',
  'open-investigation',
  'save',
  'save-as',
  'export-pdf',
  'export-csv',
  'export-json',
  'start-recording',
  'stop-recording',
  'mark-evidence',
  'add-note',
  'analyze-evidence',
  'theme-changed',
  'update-available',
  'update-downloaded'
];

const eventAPI = {
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      const subscription = (_event: unknown, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
    }
  },
  
  off: (channel: string, callback: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, callback as (...args: unknown[]) => void);
    }
  },
  
  once: (channel: string, callback: (...args: unknown[]) => void) => {
    if (validChannels.includes(channel)) {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args));
    }
  }
};

// Expose the API to the renderer process
const ghostHunterAPI: GhostHunterAPI = {
  platform: platformAPI,
  file: fileAPI,
  media: mediaAPI,
  hardware: hardwareAPI,
  system: systemAPI,
  investigation: investigationAPI,
  recording: recordingAPI,
  settings: settingsAPI,
  on: eventAPI.on,
  off: eventAPI.off,
  once: eventAPI.once
};

contextBridge.exposeInMainWorld('ghostHunter', ghostHunterAPI);

// Type declarations for TypeScript
declare global {
  interface Window {
    ghostHunter: GhostHunterAPI;
  }
}

export type { GhostHunterAPI };