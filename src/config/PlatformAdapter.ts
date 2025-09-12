import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';
import {
  ConfigurationSchema,
  PlatformCapabilities,
  ConfigurationMetadata
} from './types';

export interface PlatformPaths {
  config: string;
  data: string;
  cache: string;
  temp: string;
  logs: string;
  backups: string;
  plugins: string;
  themes: string;
  templates: string;
  exports: string;
}

export interface PlatformFeatures {
  fileSystemWatcher: boolean;
  nativeDialogs: boolean;
  systemTray: boolean;
  notifications: boolean;
  autoStart: boolean;
  fileAssociations: boolean;
  contextMenus: boolean;
  powerManagement: boolean;
  networkStatus: boolean;
  hardware: {
    sensors: boolean;
    displays: boolean;
    audio: boolean;
    input: boolean;
  };
  security: {
    keychain: boolean;
    encryption: boolean;
    certificates: boolean;
    biometrics: boolean;
  };
}

export interface PlatformLimitations {
  maxMemory: number;
  maxFileSize: number;
  maxFilePath: number;
  maxOpenFiles: number;
  maxConcurrentOperations: number;
  supportedFileFormats: string[];
  supportedEncodings: string[];
}

export interface PlatformSettings {
  pathSeparator: string;
  lineEnding: string;
  caseSensitive: boolean;
  executableExtension: string;
  preferredShell: string;
  environmentVariables: Record<string, string>;
  defaultPermissions: {
    files: number;
    directories: number;
  };
}

export interface PlatformMigration {
  fromPlatform: string;
  toPlatform: string;
  migrate: (config: ConfigurationSchema) => ConfigurationSchema;
  validateMigration: (config: ConfigurationSchema) => boolean;
  rollback?: (config: ConfigurationSchema) => ConfigurationSchema;
}

export class PlatformAdapter extends EventEmitter {
  private platform: NodeJS.Platform;
  private architecture: string;
  private osVersion: string;
  private capabilities: PlatformCapabilities;
  private paths: PlatformPaths;
  private features: PlatformFeatures;
  private limitations: PlatformLimitations;
  private settings: PlatformSettings;
  private migrations: Map<string, PlatformMigration> = new Map();

  constructor() {
    super();
    this.platform = os.platform();
    this.architecture = os.arch();
    this.osVersion = os.release();
    
    this.capabilities = this.detectCapabilities();
    this.paths = this.setupPlatformPaths();
    this.features = this.detectFeatures();
    this.limitations = this.detectLimitations();
    this.settings = this.getPlatformSettings();
    
    this.setupMigrations();
  }

  public async initialize(): Promise<void> {
    try {
      console.log(`Initializing Platform Adapter for ${this.platform} ${this.architecture}`);
      
      await this.ensurePlatformDirectories();
      await this.setupPlatformFeatures();
      await this.validatePlatformSupport();
      
      this.emit('platform-initialized', {
        platform: this.platform,
        architecture: this.architecture,
        version: this.osVersion,
        capabilities: this.capabilities
      });
      
      console.log('Platform Adapter initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Platform Adapter:', error);
      this.emit('platform-error', error);
      throw error;
    }
  }

  public getCapabilities(): PlatformCapabilities {
    return { ...this.capabilities };
  }

  public getPaths(): PlatformPaths {
    return { ...this.paths };
  }

  public getFeatures(): PlatformFeatures {
    return JSON.parse(JSON.stringify(this.features));
  }

  public getLimitations(): PlatformLimitations {
    return { ...this.limitations };
  }

  public getSettings(): PlatformSettings {
    return { ...this.settings };
  }

  public isFeatureSupported(feature: string): boolean {
    return this.getNestedValue(this.features, feature) === true;
  }

  public normalizeConfigurationForPlatform(config: ConfigurationSchema): ConfigurationSchema {
    const normalizedConfig = JSON.parse(JSON.stringify(config)); // Deep clone
    
    try {
      // Normalize file paths
      normalizedConfig.systemSettings.storage = this.normalizeStoragePaths(
        normalizedConfig.systemSettings.storage
      );
      
      // Adjust performance settings based on platform limitations
      normalizedConfig.systemSettings.performance = this.adjustPerformanceSettings(
        normalizedConfig.systemSettings.performance
      );
      
      // Platform-specific feature adjustments
      normalizedConfig.userPreferences = this.adjustUserPreferences(
        normalizedConfig.userPreferences
      );
      
      // Hardware calibration adjustments
      normalizedConfig.hardwareCalibrations = this.adjustHardwareCalibrations(
        normalizedConfig.hardwareCalibrations
      );
      
      // Security settings platform adjustments
      normalizedConfig.securitySettings = this.adjustSecuritySettings(
        normalizedConfig.securitySettings
      );
      
      this.emit('configuration-normalized', { platform: this.platform, config: normalizedConfig });
      
    } catch (error) {
      console.error('Failed to normalize configuration:', error);
      throw error;
    }
    
    return normalizedConfig;
  }

  public async migrateConfiguration(
    config: ConfigurationSchema,
    fromPlatform: string
  ): Promise<ConfigurationSchema> {
    const migrationKey = `${fromPlatform}-${this.platform}`;
    const migration = this.migrations.get(migrationKey);
    
    if (!migration) {
      console.warn(`No migration available from ${fromPlatform} to ${this.platform}`);
      return this.normalizeConfigurationForPlatform(config);
    }
    
    try {
      console.log(`Migrating configuration from ${fromPlatform} to ${this.platform}`);
      
      const migratedConfig = migration.migrate(config);
      
      if (!migration.validateMigration(migratedConfig)) {
        throw new Error('Configuration migration validation failed');
      }
      
      const normalizedConfig = this.normalizeConfigurationForPlatform(migratedConfig);
      
      this.emit('configuration-migrated', {
        from: fromPlatform,
        to: this.platform,
        config: normalizedConfig
      });
      
      return normalizedConfig;
      
    } catch (error) {
      console.error('Configuration migration failed:', error);
      throw error;
    }
  }

  public resolveConfigPath(relativePath: string): string {
    return path.resolve(this.paths.config, relativePath);
  }

  public resolveDataPath(relativePath: string): string {
    return path.resolve(this.paths.data, relativePath);
  }

  public resolveCachePath(relativePath: string): string {
    return path.resolve(this.paths.cache, relativePath);
  }

  public resolveTempPath(relativePath: string): string {
    return path.resolve(this.paths.temp, relativePath);
  }

  public normalizeFilePath(filePath: string): string {
    if (this.platform === 'win32') {
      // Windows path normalization
      return path.normalize(filePath).replace(/\//g, '\\');
    } else {
      // Unix-like path normalization
      return path.normalize(filePath).replace(/\\/g, '/');
    }
  }

  public isValidFilename(filename: string): boolean {
    if (this.platform === 'win32') {
      // Windows filename restrictions
      const invalidChars = /[<>:"|?*]/;
      const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
      return !invalidChars.test(filename) && 
             !reservedNames.test(filename) && 
             filename.length <= 255 &&
             !filename.endsWith('.');
    } else {
      // Unix-like filename restrictions
      return !filename.includes('\0') && 
             !filename.includes('/') && 
             filename.length <= 255 &&
             filename !== '.' && 
             filename !== '..';
    }
  }

  public getMaxPathLength(): number {
    switch (this.platform) {
      case 'win32': return 260; // MAX_PATH
      case 'darwin': return 1024;
      case 'linux': return 4096;
      default: return 255;
    }
  }

  private detectCapabilities(): PlatformCapabilities {
    const homedir = os.homedir();
    const tmpdir = os.tmpdir();
    
    return {
      os: this.platform,
      version: this.osVersion,
      arch: this.architecture,
      features: this.detectAvailableFeatures(),
      permissions: this.detectPermissions(),
      paths: this.setupBasePaths(),
      limits: {
        maxMemory: os.totalmem(),
        maxStorage: this.detectMaxStorage(),
        maxFiles: this.detectMaxFiles()
      }
    };
  }

  private setupPlatformPaths(): PlatformPaths {
    const basePaths = this.capabilities.paths;
    
    return {
      config: basePaths.config,
      data: basePaths.data,
      cache: basePaths.cache,
      temp: basePaths.temp,
      logs: basePaths.logs,
      backups: path.join(basePaths.data, 'backups'),
      plugins: path.join(basePaths.data, 'plugins'),
      themes: path.join(basePaths.data, 'themes'),
      templates: path.join(basePaths.data, 'templates'),
      exports: path.join(basePaths.data, 'exports')
    };
  }

  private detectFeatures(): PlatformFeatures {
    return {
      fileSystemWatcher: true, // Available on all platforms
      nativeDialogs: this.platform !== 'linux', // Limited on Linux
      systemTray: true,
      notifications: true,
      autoStart: this.platform === 'win32' || this.platform === 'darwin',
      fileAssociations: this.platform === 'win32' || this.platform === 'darwin',
      contextMenus: this.platform === 'win32',
      powerManagement: this.platform !== 'linux',
      networkStatus: true,
      hardware: {
        sensors: this.platform === 'win32' || this.platform === 'darwin',
        displays: true,
        audio: true,
        input: true
      },
      security: {
        keychain: this.platform === 'darwin',
        encryption: true,
        certificates: this.platform === 'win32' || this.platform === 'darwin',
        biometrics: this.platform === 'darwin'
      }
    };
  }

  private detectLimitations(): PlatformLimitations {
    const baseFormats = ['.json', '.xml', '.csv', '.txt', '.pdf', '.png', '.jpg', '.jpeg'];
    
    return {
      maxMemory: Math.floor(os.totalmem() * 0.8), // 80% of total memory
      maxFileSize: this.platform === 'win32' ? 4 * 1024 * 1024 * 1024 : Number.MAX_SAFE_INTEGER, // 4GB on Windows
      maxFilePath: this.getMaxPathLength(),
      maxOpenFiles: this.platform === 'win32' ? 2048 : 65536,
      maxConcurrentOperations: os.cpus().length * 2,
      supportedFileFormats: this.platform === 'win32' ? 
        [...baseFormats, '.exe', '.msi', '.reg'] :
        [...baseFormats, '.app', '.dmg', '.deb', '.rpm'],
      supportedEncodings: ['utf8', 'ascii', 'latin1', 'base64', 'hex']
    };
  }

  private getPlatformSettings(): PlatformSettings {
    return {
      pathSeparator: path.sep,
      lineEnding: this.platform === 'win32' ? '\r\n' : '\n',
      caseSensitive: this.platform !== 'win32' && this.platform !== 'darwin',
      executableExtension: this.platform === 'win32' ? '.exe' : '',
      preferredShell: this.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
      environmentVariables: this.getImportantEnvVars(),
      defaultPermissions: {
        files: this.platform === 'win32' ? 0o666 : 0o644,
        directories: this.platform === 'win32' ? 0o777 : 0o755
      }
    };
  }

  private setupBasePaths(): PlatformCapabilities['paths'] {
    const homedir = os.homedir();
    const tmpdir = os.tmpdir();
    
    switch (this.platform) {
      case 'win32':
        return {
          config: path.join(homedir, 'AppData', 'Roaming', 'Tacctile'),
          data: path.join(homedir, 'Documents', 'Tacctile'),
          temp: tmpdir,
          cache: path.join(homedir, 'AppData', 'Local', 'Tacctile', 'Cache'),
          logs: path.join(homedir, 'AppData', 'Local', 'Tacctile', 'Logs')
        };
      
      case 'darwin':
        return {
          config: path.join(homedir, 'Library', 'Preferences', 'Tacctile'),
          data: path.join(homedir, 'Documents', 'Tacctile'),
          temp: tmpdir,
          cache: path.join(homedir, 'Library', 'Caches', 'Tacctile'),
          logs: path.join(homedir, 'Library', 'Logs', 'Tacctile')
        };
      
      default: // Linux and others
        return {
          config: path.join(homedir, '.config', 'tacctile'),
          data: path.join(homedir, '.local', 'share', 'tacctile'),
          temp: tmpdir,
          cache: path.join(homedir, '.cache', 'tacctile'),
          logs: path.join(homedir, '.local', 'share', 'tacctile', 'logs')
        };
    }
  }

  private detectAvailableFeatures(): string[] {
    const features = ['configuration', 'backup', 'validation', 'migration'];
    
    if (this.platform === 'win32') {
      features.push('windows-integration', 'registry', 'wmi', 'powershell');
    } else if (this.platform === 'darwin') {
      features.push('macos-integration', 'keychain', 'applescript', 'cocoa');
    } else {
      features.push('linux-integration', 'dbus', 'systemd', 'x11');
    }
    
    return features;
  }

  private detectPermissions(): string[] {
    const permissions = ['read', 'write'];
    
    try {
      // Test filesystem permissions
      const testDir = path.join(this.setupBasePaths().temp, 'tacctile-test');
      fs.mkdir(testDir, { recursive: true }).then(() => {
        permissions.push('filesystem');
        fs.rmdir(testDir).catch(() => {});
      }).catch(() => {});
    } catch (error) {
      console.warn('Could not test filesystem permissions:', error);
    }
    
    return permissions;
  }

  private detectMaxStorage(): number {
    // This is a simplified implementation
    // Real implementation would check available disk space
    return 1024 * 1024 * 1024 * 100; // 100GB default
  }

  private detectMaxFiles(): number {
    // Platform-specific file limits
    switch (this.platform) {
      case 'win32': return 16384; // NTFS default
      case 'darwin': return 256000; // HFS+/APFS
      case 'linux': return 65536; // ext4 default
      default: return 10000;
    }
  }

  private getImportantEnvVars(): Record<string, string> {
    const important = ['PATH', 'HOME', 'USER', 'TEMP', 'TMP'];
    const envVars: Record<string, string> = {};
    
    for (const varName of important) {
      const value = process.env[varName];
      if (value) {
        envVars[varName] = value;
      }
    }
    
    // Platform-specific environment variables
    if (this.platform === 'win32') {
      ['USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMFILES'].forEach(varName => {
        const value = process.env[varName];
        if (value) envVars[varName] = value;
      });
    }
    
    return envVars;
  }

  private normalizeStoragePaths(storage: any): any {
    const normalized = { ...storage };
    
    // Convert paths to platform-specific format
    const pathFields = ['dataDirectory', 'tempDirectory', 'cacheDirectory', 'logDirectory', 'backupDirectory'];
    
    for (const field of pathFields) {
      if (normalized[field]) {
        normalized[field] = this.normalizeFilePath(normalized[field]);
      }
    }
    
    return normalized;
  }

  private adjustPerformanceSettings(performance: any): any {
    const adjusted = { ...performance };
    
    // Adjust based on platform limitations
    adjusted.maxMemoryUsage = Math.min(
      adjusted.maxMemoryUsage,
      Math.floor(this.limitations.maxMemory / 1024 / 1024) // Convert to MB
    );
    
    adjusted.concurrentOperations = Math.min(
      adjusted.concurrentOperations,
      this.limitations.maxConcurrentOperations
    );
    
    // Platform-specific adjustments
    if (this.platform === 'win32') {
      // Windows-specific performance tweaks
      adjusted.memoryCompression = false; // Not available on older Windows
    } else if (this.platform === 'darwin') {
      // macOS-specific performance tweaks
      adjusted.gpuAcceleration = true; // Generally available
    } else {
      // Linux-specific performance tweaks
      adjusted.gpuAcceleration = false; // Less reliable
    }
    
    return adjusted;
  }

  private adjustUserPreferences(preferences: any): any {
    const adjusted = JSON.parse(JSON.stringify(preferences));
    
    // Adjust theme based on platform capabilities
    if (!this.features.nativeDialogs && adjusted.appearance.theme === 'auto') {
      adjusted.appearance.theme = 'light'; // Fallback for limited platforms
    }
    
    // Adjust shortcuts based on platform conventions
    if (this.platform === 'darwin') {
      // macOS uses Cmd instead of Ctrl
      this.adjustShortcutsForMac(adjusted.shortcuts);
    }
    
    // Adjust accessibility features based on platform support
    if (!this.features.security.biometrics) {
      adjusted.accessibility.voiceCommands = false;
    }
    
    return adjusted;
  }

  private adjustHardwareCalibrations(calibrations: any): any {
    const adjusted = JSON.parse(JSON.stringify(calibrations));
    
    // Remove unsupported hardware categories
    if (!this.features.hardware.sensors) {
      adjusted.sensors = {};
    }
    
    if (!this.features.hardware.audio) {
      adjusted.audio = { input: {}, output: {} };
    }
    
    return adjusted;
  }

  private adjustSecuritySettings(security: any): any {
    const adjusted = JSON.parse(JSON.stringify(security));
    
    // Adjust encryption based on platform capabilities
    if (!this.features.security.encryption) {
      adjusted.encryption.dataAtRest.enabled = false;
      adjusted.encryption.backups.enabled = false;
    }
    
    // Adjust authentication methods
    if (!this.features.security.biometrics) {
      if (adjusted.authentication.method === 'biometric') {
        adjusted.authentication.method = 'password';
      }
    }
    
    if (!this.features.security.keychain) {
      adjusted.encryption.dataAtRest.keyManagement = 'local';
    }
    
    return adjusted;
  }

  private adjustShortcutsForMac(shortcuts: any): void {
    // Convert Ctrl+X shortcuts to Cmd+X on macOS
    for (const shortcut in shortcuts) {
      const keys = shortcuts[shortcut].keys;
      if (Array.isArray(keys)) {
        for (let i = 0; i < keys.length; i++) {
          keys[i] = keys[i].replace(/ctrl\+/gi, 'cmd+');
        }
      }
    }
  }

  private setupMigrations(): void {
    // Windows to macOS migration
    this.migrations.set('win32-darwin', {
      fromPlatform: 'win32',
      toPlatform: 'darwin',
      migrate: (config) => {
        const migrated = JSON.parse(JSON.stringify(config));
        
        // Convert Windows paths to macOS paths
        this.convertPathsInConfig(migrated, 'win32', 'darwin');
        
        // Adjust shortcuts
        this.adjustShortcutsForMac(migrated.userPreferences.shortcuts);
        
        return migrated;
      },
      validateMigration: (config) => {
        // Basic validation
        return config && typeof config === 'object';
      }
    });

    // macOS to Windows migration
    this.migrations.set('darwin-win32', {
      fromPlatform: 'darwin',
      toPlatform: 'win32',
      migrate: (config) => {
        const migrated = JSON.parse(JSON.stringify(config));
        
        // Convert macOS paths to Windows paths
        this.convertPathsInConfig(migrated, 'darwin', 'win32');
        
        // Adjust shortcuts back to Ctrl
        this.adjustShortcutsForWindows(migrated.userPreferences.shortcuts);
        
        return migrated;
      },
      validateMigration: (config) => {
        return config && typeof config === 'object';
      }
    });

    // Linux migrations would be added similarly
  }

  private convertPathsInConfig(config: any, fromPlatform: string, toPlatform: string): void {
    // This is a simplified path conversion
    // Real implementation would be more sophisticated
    const pathFields = [
      'systemSettings.storage.dataDirectory',
      'systemSettings.storage.tempDirectory',
      'systemSettings.storage.cacheDirectory',
      'systemSettings.storage.logDirectory',
      'systemSettings.storage.backupDirectory'
    ];
    
    for (const fieldPath of pathFields) {
      const value = this.getNestedValue(config, fieldPath);
      if (value && typeof value === 'string') {
        const converted = this.convertPath(value, fromPlatform, toPlatform);
        this.setNestedValue(config, fieldPath, converted);
      }
    }
  }

  private convertPath(originalPath: string, fromPlatform: string, toPlatform: string): string {
    // Simplified path conversion logic
    if (fromPlatform === 'win32' && toPlatform === 'darwin') {
      return originalPath.replace(/\\/g, '/').replace(/^C:/, '');
    } else if (fromPlatform === 'darwin' && toPlatform === 'win32') {
      return 'C:' + originalPath.replace(/\//g, '\\');
    }
    return originalPath;
  }

  private adjustShortcutsForWindows(shortcuts: any): void {
    for (const shortcut in shortcuts) {
      const keys = shortcuts[shortcut].keys;
      if (Array.isArray(keys)) {
        for (let i = 0; i < keys.length; i++) {
          keys[i] = keys[i].replace(/cmd\+/gi, 'ctrl+');
        }
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  private async ensurePlatformDirectories(): Promise<void> {
    const directories = Object.values(this.paths);
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  private async setupPlatformFeatures(): Promise<void> {
    // Platform-specific feature setup would go here
    console.log(`Setting up features for ${this.platform}`);
  }

  private async validatePlatformSupport(): Promise<void> {
    // Validate that the current platform is supported
    const supportedPlatforms = ['win32', 'darwin', 'linux'];
    
    if (!supportedPlatforms.includes(this.platform)) {
      console.warn(`Platform ${this.platform} is not officially supported`);
    }
    
    // Validate minimum requirements
    const totalMemory = os.totalmem();
    const minMemory = 512 * 1024 * 1024; // 512MB
    
    if (totalMemory < minMemory) {
      throw new Error(`Insufficient memory: ${Math.round(totalMemory / 1024 / 1024)}MB available, ${Math.round(minMemory / 1024 / 1024)}MB required`);
    }
  }

  public async dispose(): Promise<void> {
    this.removeAllListeners();
  }
}