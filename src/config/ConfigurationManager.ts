import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import {
  ConfigurationSchema,
  ConfigurationMetadata,
  ConfigurationValidation,
  ConfigurationBackup,
  ConfigurationMigration,
  ValidationResult,
  ConfigurationDiff,
  PlatformCapabilities,
  ConfigurationEvents
} from './types';

export class ConfigurationManager extends EventEmitter {
  private static instance: ConfigurationManager;
  private config: ConfigurationSchema;
  private metadata: ConfigurationMetadata;
  private platformCapabilities: PlatformCapabilities;
  private configPath: string;
  private backupPath: string;
  private isLoaded = false;
  private isWatching = false;
  private watchHandle?: any;
  private saveQueue: Promise<void> = Promise.resolve();
  private migrations: Map<string, ConfigurationMigration> = new Map();
  private validators: Map<string, (value: any, config: any) => boolean> = new Map();

  private constructor() {
    super();
    this.platformCapabilities = this.detectPlatformCapabilities();
    this.configPath = path.join(this.platformCapabilities.paths.config, 'tacctile-config.json');
    this.backupPath = path.join(this.platformCapabilities.paths.config, 'backups');
    this.config = this.getDefaultConfiguration();
    this.metadata = this.createMetadata();
    this.setupMigrations();
    this.setupValidators();
  }

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Configuration Manager...');
      
      await this.ensureDirectories();
      await this.loadConfiguration();
      await this.validateConfiguration();
      await this.startWatching();
      
      this.isLoaded = true;
      this.emit('config:loaded', this.config);
      console.log('Configuration Manager initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Configuration Manager:', error);
      this.emit('config:error', error, 'initialization');
      throw error;
    }
  }

  public async loadConfiguration(): Promise<ConfigurationSchema> {
    try {
      const exists = await this.fileExists(this.configPath);
      
      if (exists) {
        console.log(`Loading configuration from: ${this.configPath}`);
        const data = await fs.readFile(this.configPath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Check if migration is needed
        const currentVersion = parsed.metadata?.schemaVersion || '1.0.0';
        if (currentVersion !== this.getSchemaVersion()) {
          console.log(`Migrating configuration from ${currentVersion} to ${this.getSchemaVersion()}`);
          const migrated = await this.migrateConfiguration(parsed, currentVersion);
          this.config = migrated.config;
          this.metadata = migrated.metadata;
          await this.saveConfiguration();
        } else {
          this.config = parsed.config || this.getDefaultConfiguration();
          this.metadata = parsed.metadata || this.createMetadata();
        }
      } else {
        console.log('No existing configuration found, using defaults');
        this.config = this.getDefaultConfiguration();
        this.metadata = this.createMetadata();
        await this.saveConfiguration();
      }

      return this.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.emit('config:error', error, 'loading');
      
      // Fall back to defaults if loading fails
      this.config = this.getDefaultConfiguration();
      this.metadata = this.createMetadata();
      return this.config;
    }
  }

  public async saveConfiguration(): Promise<void> {
    // Queue saves to prevent concurrent writes
    this.saveQueue = this.saveQueue.then(async () => {
      try {
        this.metadata.modified = new Date().toISOString();
        this.metadata.checksum = this.calculateChecksum(this.config);
        
        const configData = {
          metadata: this.metadata,
          config: this.config
        };
        
        const data = JSON.stringify(configData, null, 2);
        
        // Write to temporary file first, then rename (atomic write)
        const tempPath = `${this.configPath}.tmp`;
        await fs.writeFile(tempPath, data, 'utf8');
        await fs.rename(tempPath, this.configPath);
        
        this.emit('config:saved', this.config);
        console.log('Configuration saved successfully');
        
      } catch (error) {
        console.error('Failed to save configuration:', error);
        this.emit('config:error', error, 'saving');
        throw error;
      }
    });
    
    return this.saveQueue;
  }

  public getConfiguration(): ConfigurationSchema {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone
  }

  public async setConfiguration(config: Partial<ConfigurationSchema>): Promise<void> {
    const oldConfig = this.getConfiguration();
    this.config = this.mergeConfiguration(this.config, config);
    
    const validationResults = await this.validateConfiguration();
    if (validationResults.some(r => r.severity === 'error')) {
      this.config = oldConfig; // Rollback
      throw new Error('Configuration validation failed');
    }
    
    const diff = this.calculateDiff(oldConfig, this.config);
    await this.saveConfiguration();
    
    // Emit change events for each modified path
    for (const change of diff.modified) {
      this.emit('config:changed', change.path, change.oldValue, change.newValue);
    }
    for (const addition of diff.added) {
      this.emit('config:changed', addition.path, undefined, addition.value);
    }
    for (const removal of diff.removed) {
      this.emit('config:changed', removal.path, removal.value, undefined);
    }
  }

  public get<T = any>(path: string, defaultValue?: T): T {
    return this.getNestedValue(this.config, path) ?? defaultValue;
  }

  public async set(path: string, value: any): Promise<void> {
    const oldValue = this.get(path);
    this.setNestedValue(this.config, path, value);
    
    const validationResults = await this.validateConfiguration();
    if (validationResults.some(r => r.severity === 'error')) {
      this.setNestedValue(this.config, path, oldValue); // Rollback
      throw new Error(`Configuration validation failed for path: ${path}`);
    }
    
    await this.saveConfiguration();
    this.emit('config:changed', path, oldValue, value);
  }

  public async reset(path?: string): Promise<void> {
    if (path) {
      const defaultConfig = this.getDefaultConfiguration();
      const defaultValue = this.getNestedValue(defaultConfig, path);
      await this.set(path, defaultValue);
    } else {
      this.config = this.getDefaultConfiguration();
      this.metadata = this.createMetadata();
      await this.saveConfiguration();
      this.emit('config:loaded', this.config);
    }
  }

  public async validateConfiguration(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    try {
      // Schema validation
      results.push(...this.validateSchema(this.config));
      
      // Custom validation rules
      results.push(...this.validateCustomRules(this.config));
      
      // Cross-reference validation
      results.push(...this.validateCrossReferences(this.config));
      
      // Platform compatibility validation
      results.push(...this.validatePlatformCompatibility(this.config));
      
      this.emit('config:validated', results);
      
    } catch (error) {
      results.push({
        path: '',
        message: `Validation error: ${error.message}`,
        severity: 'error',
        code: 'VALIDATION_FAILED'
      });
    }
    
    return results;
  }

  public async createBackup(name?: string): Promise<ConfigurationBackup> {
    const backupId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = name || `auto-backup-${timestamp}`;
    
    const backup: ConfigurationBackup = {
      id: backupId,
      name: backupName,
      description: `Configuration backup created on ${new Date().toLocaleString()}`,
      created: new Date().toISOString(),
      size: JSON.stringify(this.config).length,
      checksum: this.calculateChecksum(this.config),
      encrypted: false,
      compressed: false,
      automatic: !name,
      retained: false,
      configuration: JSON.parse(JSON.stringify(this.config)),
      metadata: JSON.parse(JSON.stringify(this.metadata))
    };
    
    const backupFile = path.join(this.backupPath, `${backupId}.json`);
    await fs.writeFile(backupFile, JSON.stringify(backup, null, 2), 'utf8');
    
    this.emit('config:backup-created', backup);
    console.log(`Configuration backup created: ${backupName}`);
    
    return backup;
  }

  public async restoreBackup(backupId: string): Promise<void> {
    const backupFile = path.join(this.backupPath, `${backupId}.json`);
    
    try {
      const data = await fs.readFile(backupFile, 'utf8');
      const backup: ConfigurationBackup = JSON.parse(data);
      
      // Verify backup integrity
      const checksum = this.calculateChecksum(backup.configuration);
      if (checksum !== backup.checksum) {
        throw new Error('Backup integrity check failed');
      }
      
      // Create current backup before restoring
      await this.createBackup('pre-restore-backup');
      
      // Restore configuration
      this.config = backup.configuration as ConfigurationSchema;
      this.metadata = backup.metadata;
      this.metadata.modified = new Date().toISOString();
      
      await this.saveConfiguration();
      this.emit('config:backup-restored', backup);
      console.log(`Configuration restored from backup: ${backup.name}`);
      
    } catch (error) {
      console.error('Failed to restore backup:', error);
      this.emit('config:error', error, 'backup-restore');
      throw error;
    }
  }

  public async listBackups(): Promise<ConfigurationBackup[]> {
    try {
      const files = await fs.readdir(this.backupPath);
      const backups: ConfigurationBackup[] = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.backupPath, file), 'utf8');
            const backup = JSON.parse(data);
            backups.push(backup);
          } catch (error) {
            console.warn(`Failed to read backup file ${file}:`, error);
          }
        }
      }
      
      return backups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  public async deleteBackup(backupId: string): Promise<void> {
    const backupFile = path.join(this.backupPath, `${backupId}.json`);
    try {
      await fs.unlink(backupFile);
      console.log(`Backup deleted: ${backupId}`);
    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw error;
    }
  }

  public async cleanupBackups(retentionDays = 30): Promise<number> {
    const backups = await this.listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let deletedCount = 0;
    
    for (const backup of backups) {
      const backupDate = new Date(backup.created);
      if (backupDate < cutoffDate && backup.automatic && !backup.retained) {
        try {
          await this.deleteBackup(backup.id);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete backup ${backup.id}:`, error);
        }
      }
    }
    
    return deletedCount;
  }

  public exportConfiguration(format: 'json' | 'yaml' | 'toml' = 'json'): string {
    switch (format) {
      case 'json':
        return JSON.stringify({
          metadata: this.metadata,
          config: this.config
        }, null, 2);
      case 'yaml':
        // Would use yaml library
        return '# YAML export not implemented';
      case 'toml':
        // Would use toml library
        return '# TOML export not implemented';
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  public async importConfiguration(data: string, format: 'json' | 'yaml' | 'toml' = 'json'): Promise<void> {
    let parsed: any;
    
    switch (format) {
      case 'json':
        parsed = JSON.parse(data);
        break;
      case 'yaml':
        // Would use yaml library
        throw new Error('YAML import not implemented');
      case 'toml':
        // Would use toml library
        throw new Error('TOML import not implemented');
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }
    
    if (parsed.config) {
      await this.setConfiguration(parsed.config);
    } else {
      throw new Error('Invalid configuration format');
    }
  }

  public getPlatformCapabilities(): PlatformCapabilities {
    return JSON.parse(JSON.stringify(this.platformCapabilities));
  }

  private detectPlatformCapabilities(): PlatformCapabilities {
    const platform = os.platform();
    const version = os.release();
    const arch = os.arch();
    
    const basePaths = {
      win32: {
        config: path.join(os.homedir(), 'AppData', 'Roaming', 'Tacctile'),
        data: path.join(os.homedir(), 'Documents', 'Tacctile'),
        temp: os.tmpdir(),
        cache: path.join(os.homedir(), 'AppData', 'Local', 'Tacctile', 'Cache'),
        logs: path.join(os.homedir(), 'AppData', 'Local', 'Tacctile', 'Logs')
      },
      darwin: {
        config: path.join(os.homedir(), 'Library', 'Preferences', 'Tacctile'),
        data: path.join(os.homedir(), 'Documents', 'Tacctile'),
        temp: os.tmpdir(),
        cache: path.join(os.homedir(), 'Library', 'Caches', 'Tacctile'),
        logs: path.join(os.homedir(), 'Library', 'Logs', 'Tacctile')
      },
      linux: {
        config: path.join(os.homedir(), '.config', 'tacctile'),
        data: path.join(os.homedir(), '.local', 'share', 'tacctile'),
        temp: os.tmpdir(),
        cache: path.join(os.homedir(), '.cache', 'tacctile'),
        logs: path.join(os.homedir(), '.local', 'share', 'tacctile', 'logs')
      }
    };
    
    return {
      os: platform,
      version,
      arch,
      features: this.detectFeatures(),
      permissions: this.detectPermissions(),
      paths: basePaths[platform as keyof typeof basePaths] || basePaths.linux,
      limits: {
        maxMemory: os.totalmem(),
        maxStorage: 1024 * 1024 * 1024 * 100, // 100GB default
        maxFiles: 100000
      }
    };
  }

  private detectFeatures(): string[] {
    const features: string[] = ['configuration', 'backup', 'validation'];
    
    // Add platform-specific features
    if (this.platformCapabilities?.os === 'win32') {
      features.push('windows-integration', 'registry');
    } else if (this.platformCapabilities?.os === 'darwin') {
      features.push('macos-integration', 'keychain');
    } else {
      features.push('linux-integration', 'keyring');
    }
    
    return features;
  }

  private detectPermissions(): string[] {
    const permissions: string[] = ['read', 'write'];
    
    try {
      // Test write permissions
      const testPath = path.join(this.platformCapabilities?.paths?.config || os.tmpdir(), 'test');
      fs.writeFile(testPath, 'test', 'utf8').then(() => {
        fs.unlink(testPath).catch(() => {});
        permissions.push('filesystem');
      }).catch(() => {});
    } catch (error) {
      // No filesystem access
    }
    
    return permissions;
  }

  private getDefaultConfiguration(): ConfigurationSchema {
    return {
      userPreferences: {
        appearance: {
          theme: 'auto',
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          uiScale: 1.0,
          colorScheme: 'default',
          animationsEnabled: true,
          compactMode: false,
          showTooltips: true,
          iconSet: 'default'
        },
        behavior: {
          autoSave: true,
          autoSaveInterval: 5,
          confirmOnExit: true,
          confirmOnDelete: true,
          doubleClickAction: 'open',
          defaultFileFormat: 'json',
          maxRecentFiles: 10,
          showWelcomeScreen: true,
          enableDragDrop: true,
          multiSelectMode: 'ctrl',
          scrollSensitivity: 1.0,
          zoomSensitivity: 1.0
        },
        accessibility: {
          highContrast: false,
          screenReaderSupport: false,
          keyboardNavigation: true,
          voiceCommands: false,
          gestureControls: false,
          textToSpeech: false,
          speechRate: 1.0,
          focusIndicator: 'default',
          reducedMotion: false,
          colorBlindnessType: 'none'
        },
        notifications: {
          enabled: true,
          sound: true,
          desktop: true,
          email: false,
          types: {
            errors: true,
            warnings: true,
            info: true,
            updates: true,
            investigations: true,
            evidence: true,
            calibrations: true,
            backups: true
          },
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00'
          },
          priority: 'important'
        },
        shortcuts: {},
        language: {
          locale: 'en-US',
          dateFormat: 'MM/dd/yyyy',
          timeFormat: '12h',
          numberFormat: 'US',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: 'USD',
          unitSystem: 'imperial'
        },
        privacy: {
          telemetryEnabled: true,
          crashReporting: true,
          usageAnalytics: true,
          errorReporting: true,
          anonymizeData: true,
          dataRetention: 365,
          shareImprovement: true,
          locationTracking: false
        }
      },
      hardwareCalibrations: {
        sensors: {},
        displays: {},
        input: {
          mouse: {
            sensitivity: 1.0,
            acceleration: false,
            dpi: 800,
            pollRate: 125,
            buttonMapping: {}
          },
          keyboard: {
            repeatDelay: 500,
            repeatRate: 30,
            layout: 'US',
            customMapping: {}
          },
          touchpad: {
            sensitivity: 1.0,
            tapToClick: true,
            twoFingerScroll: true,
            threeFingerGestures: true,
            palmRejection: true
          }
        },
        audio: {
          input: {},
          output: {}
        },
        network: {
          latency: {},
          bandwidth: {},
          servers: {}
        }
      },
      toolDefaults: {
        analysis: {
          algorithms: {},
          filters: {},
          processing: {
            batchSize: 100,
            maxConcurrent: 4,
            retryAttempts: 3,
            retryDelay: 1000,
            progressReporting: true,
            backgroundProcessing: true
          }
        },
        forensics: {
          hashAlgorithms: ['SHA-256', 'MD5'],
          verificationLevel: 'standard',
          chainOfCustody: {
            automaticLogging: true,
            requireSignatures: false,
            timestampServer: '',
            hashingFrequency: 'periodic'
          },
          acquisition: {
            compressionLevel: 6,
            errorHandling: 'strict',
            verifyAfterAcquisition: true,
            generateReport: true,
            preserveTimestamps: true
          },
          analysis: {
            deepScan: false,
            recoverDeleted: true,
            extractMetadata: true,
            generateThumbnails: true,
            indexFullText: false
          }
        },
        visualization: {
          charts: {},
          graphs: {
            layout: 'force',
            nodeSize: 10,
            edgeWidth: 2,
            clustering: true,
            labeling: 'hover',
            physics: true
          },
          maps: {
            provider: 'openstreetmap',
            style: 'default',
            clustering: true,
            heatmaps: false,
            layers: ['base'],
            controls: ['zoom', 'pan']
          }
        },
        reporting: {
          format: 'pdf',
          template: 'default',
          includeCharts: true,
          includeImages: true,
          includeRawData: false,
          includeMetadata: true,
          includeCertifications: true,
          watermark: '',
          encryption: false,
          digitalSignature: false,
          compression: 5,
          pageSize: 'A4',
          margins: { top: 20, right: 20, bottom: 20, left: 20 },
          fonts: {
            heading: 'Arial',
            body: 'Times New Roman',
            code: 'Courier New'
          },
          colors: {
            primary: '#0066cc',
            secondary: '#666666',
            accent: '#ff6600'
          }
        },
        export: {
          formats: {},
          naming: {
            pattern: '{name}_{timestamp}',
            includeTimestamp: true,
            includeVersion: false,
            sanitizeNames: true
          },
          metadata: {
            preserve: true,
            strip: [],
            add: {}
          },
          validation: {
            verify: true,
            checksum: 'SHA-256',
            signature: false
          }
        },
        import: {
          formats: {},
          processing: {
            batchSize: 50,
            concurrent: 2,
            timeout: 30000,
            retries: 3
          },
          validation: {
            structure: true,
            content: true,
            integrity: true,
            duplicates: 'skip'
          }
        }
      },
      workspaceLayouts: {
        current: 'default',
        layouts: {
          default: {
            id: 'default',
            name: 'Default Layout',
            description: 'Default workspace layout',
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            version: '1.0.0',
            author: 'system',
            tags: [],
            shared: false,
            readonly: false,
            windows: [],
            panels: [],
            toolbars: [],
            menus: [],
            shortcuts: {},
            theme: 'default',
            zoom: 1.0,
            viewport: { x: 0, y: 0, width: 1920, height: 1080 }
          }
        },
        recent: [],
        autosave: true,
        syncAcrossDevices: false
      },
      systemSettings: {
        performance: {
          maxMemoryUsage: 2048,
          maxCpuUsage: 80,
          maxDiskUsage: 10240,
          concurrentOperations: 4,
          cacheSize: 512,
          preloadData: true,
          backgroundProcessing: true,
          priorityMode: 'balanced',
          gpuAcceleration: true,
          multiThreading: true,
          vectorInstructions: true,
          memoryCompression: false
        },
        storage: {
          dataDirectory: path.join(this.platformCapabilities?.paths?.data || '', 'data'),
          tempDirectory: this.platformCapabilities?.paths?.temp || os.tmpdir(),
          cacheDirectory: this.platformCapabilities?.paths?.cache || '',
          logDirectory: this.platformCapabilities?.paths?.logs || '',
          backupDirectory: path.join(this.platformCapabilities?.paths?.data || '', 'backups'),
          maxCacheSize: 1024,
          maxTempSize: 2048,
          cleanupInterval: 24,
          compression: true,
          encryption: false,
          indexing: true,
          monitoring: true
        },
        backup: {
          enabled: true,
          automatic: true,
          schedule: '0 2 * * *', // Daily at 2 AM
          retention: {
            daily: 7,
            weekly: 4,
            monthly: 12,
            yearly: 5
          },
          location: 'local',
          encryption: false,
          compression: true,
          verification: true,
          incremental: true,
          exclude: ['temp', 'cache'],
          include: ['config', 'data'],
          maxBackupSize: 10240,
          notifications: true
        },
        updates: {
          channel: 'stable',
          automatic: false,
          checkInterval: 24,
          downloadInBackground: true,
          installOnRestart: false,
          backupBeforeUpdate: true,
          rollbackEnabled: true,
          notifications: true
        },
        logging: {
          level: 'info',
          categories: {
            general: { enabled: true, level: 'info' },
            error: { enabled: true, level: 'error' },
            debug: { enabled: false, level: 'debug' },
            performance: { enabled: true, level: 'info' }
          },
          maxFileSize: 10,
          maxFiles: 5,
          format: 'json',
          includeStackTrace: true,
          includeTimestamp: true,
          includeContext: true,
          compression: true,
          encryption: false
        },
        monitoring: {
          enabled: true,
          interval: 60,
          metrics: {
            performance: true,
            memory: true,
            disk: true,
            network: true,
            errors: true,
            users: false
          },
          alerts: {
            enabled: true,
            thresholds: {
              cpu: 90,
              memory: 85,
              disk: 95,
              errors: 10
            },
            notifications: ['desktop']
          },
          retention: 30,
          aggregation: 5
        }
      },
      securitySettings: {
        authentication: {
          method: 'password',
          passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: false,
            maxAge: 90,
            history: 5,
            lockoutAttempts: 5,
            lockoutDuration: 15
          },
          sessionTimeout: 30,
          rememberMe: true
        },
        authorization: {
          roleBasedAccess: true,
          permissions: {},
          defaultRole: 'user',
          guestAccess: false,
          adminOverride: true,
          auditPermissions: true
        },
        encryption: {
          dataAtRest: {
            enabled: false,
            algorithm: 'AES-256-GCM',
            keyRotation: 365,
            keyDerivation: 'PBKDF2'
          },
          dataInTransit: {
            enabled: true,
            tlsVersion: '1.3',
            cipherSuites: [],
            certificateValidation: true
          },
          database: {
            enabled: false,
            algorithm: 'AES-256-GCM',
            keyManagement: 'local'
          },
          backups: {
            enabled: false,
            algorithm: 'AES-256-GCM',
            keyStorage: 'local'
          }
        },
        audit: {
          enabled: true,
          categories: {
            authentication: true,
            authorization: true,
            dataAccess: true,
            configuration: true,
            system: true,
            errors: true
          },
          retention: 365,
          tamperProof: true,
          realTimeAlerts: false,
          exportFormat: 'json',
          digitallySigned: false
        },
        network: {
          firewall: {
            enabled: false,
            rules: {}
          },
          proxy: {
            enabled: false,
            server: '',
            port: 8080,
            authentication: false,
            whitelist: [],
            blacklist: []
          },
          vpn: {
            enabled: false,
            server: '',
            protocol: 'OpenVPN',
            authentication: 'certificate',
            encryption: 'AES-256'
          },
          intrusion: {
            detection: false,
            prevention: false,
            sensitivity: 'medium',
            alerts: false
          }
        }
      }
    };
  }

  private createMetadata(): ConfigurationMetadata {
    return {
      version: '1.0.0',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      author: 'system',
      description: 'Tacctile Professional Investigation Software Configuration',
      tags: ['default', 'system'],
      checksum: '',
      encrypted: false,
      compressed: false,
      size: 0,
      platform: this.platformCapabilities.os,
      appVersion: process.env.APP_VERSION || '1.0.0',
      schemaVersion: this.getSchemaVersion()
    };
  }

  private getSchemaVersion(): string {
    return '2.0.0'; // Current schema version
  }

  private calculateChecksum(data: any): string {
    const json = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  private async ensureDirectories(): Promise<void> {
    const directories = [
      path.dirname(this.configPath),
      this.backupPath
    ];
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`Failed to create directory ${dir}:`, error);
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
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

  private mergeConfiguration(target: any, source: any): any {
    const result = JSON.parse(JSON.stringify(target));
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.mergeConfiguration(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private calculateDiff(oldConfig: any, newConfig: any, basePath = ''): ConfigurationDiff {
    const diff: ConfigurationDiff = {
      added: [],
      modified: [],
      removed: []
    };

    // Check for added and modified
    for (const key in newConfig) {
      const path = basePath ? `${basePath}.${key}` : key;
      const oldValue = oldConfig?.[key];
      const newValue = newConfig[key];

      if (!(key in oldConfig)) {
        diff.added.push({ path, value: newValue });
      } else if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
        const nestedDiff = this.calculateDiff(oldValue, newValue, path);
        diff.added.push(...nestedDiff.added);
        diff.modified.push(...nestedDiff.modified);
        diff.removed.push(...nestedDiff.removed);
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        diff.modified.push({ path, oldValue, newValue });
      }
    }

    // Check for removed
    for (const key in oldConfig) {
      if (!(key in newConfig)) {
        const path = basePath ? `${basePath}.${key}` : key;
        diff.removed.push({ path, value: oldConfig[key] });
      }
    }

    return diff;
  }

  private validateSchema(config: any): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Basic type checking would go here
    // This is a simplified implementation
    
    return results;
  }

  private validateCustomRules(config: any): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Custom validation logic would go here
    
    return results;
  }

  private validateCrossReferences(config: any): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Cross-reference validation would go here
    
    return results;
  }

  private validatePlatformCompatibility(config: any): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    // Platform compatibility checks would go here
    
    return results;
  }

  private async startWatching(): Promise<void> {
    if (this.isWatching) return;
    
    try {
      // File system watching would go here
      this.isWatching = true;
    } catch (error) {
      console.warn('Failed to start configuration file watching:', error);
    }
  }

  private setupMigrations(): void {
    // Migration definitions would go here
  }

  private setupValidators(): void {
    // Custom validator setup would go here
  }

  private async migrateConfiguration(data: any, fromVersion: string): Promise<{ config: ConfigurationSchema; metadata: ConfigurationMetadata }> {
    // Migration logic would go here
    return {
      config: data.config || this.getDefaultConfiguration(),
      metadata: data.metadata || this.createMetadata()
    };
  }

  public async dispose(): Promise<void> {
    if (this.watchHandle) {
      // Close file watcher
      this.isWatching = false;
    }
    
    await this.saveQueue;
    this.removeAllListeners();
  }
}