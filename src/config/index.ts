// Centralized Configuration System for Professional Investigation Software
// Complete integration and initialization

export * from './types';
export { ConfigurationManager } from './ConfigurationManager';
export { ConfigurationValidator } from './ConfigurationValidator';
export { ConfigurationBackupManager, type BackupStrategy, type RestoreOptions } from './ConfigurationBackupManager';
export { PlatformAdapter } from './PlatformAdapter';
export { UserPreferenceManager, type PreferenceProfile, type PreferenceTemplate } from './UserPreferenceManager';
export { HardwareCalibrationManager, type CalibrationCertificate, type CalibrationSchedule } from './HardwareCalibrationManager';
export { WorkspaceLayoutManager, type LayoutTemplate, type LayoutSnapshot } from './WorkspaceLayoutManager';

import { ConfigurationManager } from './ConfigurationManager';
import { ConfigurationValidator } from './ConfigurationValidator';
import { ConfigurationBackupManager, BackupStrategy } from './ConfigurationBackupManager';
import { PlatformAdapter } from './PlatformAdapter';
import { UserPreferenceManager } from './UserPreferenceManager';
import { HardwareCalibrationManager } from './HardwareCalibrationManager';
import { WorkspaceLayoutManager } from './WorkspaceLayoutManager';
import {
  ConfigurationSchema,
  ConfigurationMetadata,
  ValidationResult,
  PlatformCapabilities
} from './types';

export interface ConfigSystemConfig {
  configDirectory?: string;
  backupDirectory?: string;
  certificatesDirectory?: string;
  layoutsDirectory?: string;
  enableBackups?: boolean;
  enableValidation?: boolean;
  enableCrossPlatform?: boolean;
  autoSave?: boolean;
  backupStrategy?: Partial<BackupStrategy>;
}

export interface ConfigSystemStats {
  configuration: {
    totalSettings: number;
    lastModified: string;
    version: string;
    validationErrors: number;
    validationWarnings: number;
  };
  backups: {
    totalBackups: number;
    totalSize: number;
    lastBackup: string;
    automaticBackups: number;
    manualBackups: number;
  };
  hardware: {
    totalSensors: number;
    calibratedSensors: number;
    expiredCalibrations: number;
    overdueCertifications: number;
  };
  workspace: {
    totalLayouts: number;
    activeLayout: string;
    totalSnapshots: number;
    layoutsWithIssues: number;
  };
  platform: {
    os: string;
    architecture: string;
    supportedFeatures: string[];
    compatibility: number; // percentage
  };
}

export class ConfigurationSystem {
  private static instance: ConfigurationSystem;
  
  public readonly configManager: ConfigurationManager;
  public readonly validator: ConfigurationValidator;
  public readonly backupManager: ConfigurationBackupManager;
  public readonly platformAdapter: PlatformAdapter;
  public readonly preferenceManager: UserPreferenceManager;
  public readonly hardwareManager: HardwareCalibrationManager;
  public readonly workspaceManager: WorkspaceLayoutManager;
  
  private isInitialized = false;
  private config: ConfigSystemConfig;

  private constructor(config: ConfigSystemConfig = {}) {
    this.config = config;
    
    // Initialize platform adapter first
    this.platformAdapter = new PlatformAdapter();
    
    // Initialize core configuration manager
    this.configManager = ConfigurationManager.getInstance();
    
    // Initialize validator
    this.validator = new ConfigurationValidator();
    
    // Initialize backup manager
    this.backupManager = new ConfigurationBackupManager(
      config.backupDirectory || './config-backups',
      this.getDefaultBackupStrategy()
    );
    
    // Initialize managers
    this.preferenceManager = new UserPreferenceManager(this.configManager);
    this.hardwareManager = new HardwareCalibrationManager(
      this.configManager, 
      config.certificatesDirectory
    );
    this.workspaceManager = new WorkspaceLayoutManager(
      this.configManager,
      config.layoutsDirectory
    );
    
    this.setupIntegrations();
  }

  public static getInstance(config?: ConfigSystemConfig): ConfigurationSystem {
    if (!ConfigurationSystem.instance) {
      ConfigurationSystem.instance = new ConfigurationSystem(config);
    }
    return ConfigurationSystem.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('Initializing Centralized Configuration System...');

      // Initialize in dependency order
      await this.platformAdapter.initialize();
      
      // Apply platform-specific configuration normalization
      const currentConfig = this.configManager.getConfiguration();
      const normalizedConfig = this.platformAdapter.normalizeConfigurationForPlatform(currentConfig);
      if (JSON.stringify(currentConfig) !== JSON.stringify(normalizedConfig)) {
        await this.configManager.setConfiguration(normalizedConfig);
      }

      await this.configManager.initialize();

      if (this.config.enableBackups !== false) {
        await this.backupManager.initialize();
      }

      await this.preferenceManager.initialize();
      await this.hardwareManager.initialize();
      await this.workspaceManager.initialize();

      // Set up event handling and cross-component communication
      this.setupEventHandlers();
      
      // Perform initial validation
      await this.performInitialValidation();
      
      // Create initial backup if enabled
      if (this.config.enableBackups !== false) {
        await this.createInitialBackup();
      }

      this.isInitialized = true;
      console.log('Centralized Configuration System initialized successfully');

    } catch (error) {
      console.error('Failed to initialize Centralized Configuration System:', error);
      throw error;
    }
  }

  // Configuration Management
  public async getConfiguration(): Promise<ConfigurationSchema> {
    return this.configManager.getConfiguration();
  }

  public async updateConfiguration(updates: Partial<ConfigurationSchema>): Promise<void> {
    // Validate updates
    if (this.config.enableValidation !== false) {
      const tempConfig = { ...await this.getConfiguration(), ...updates };
      const results = this.validator.validateConfiguration(tempConfig);
      const errors = results.filter(r => r.severity === 'error');
      if (errors.length > 0) {
        throw new Error(`Configuration validation failed: ${errors.map(e => e.message).join(', ')}`);
      }
    }

    await this.configManager.setConfiguration(updates);
  }

  public async resetConfiguration(section?: keyof ConfigurationSchema): Promise<void> {
    await this.configManager.reset(section);
  }

  // Validation
  public async validateConfiguration(): Promise<ValidationResult[]> {
    const config = await this.getConfiguration();
    return this.validator.validateConfiguration(config);
  }

  public async validatePath(path: string, value: any): Promise<ValidationResult[]> {
    const config = await this.getConfiguration();
    return this.validator.validatePath(config, path, value);
  }

  // Backup and Restore
  public async createBackup(name?: string): Promise<string> {
    const config = await this.getConfiguration();
    const metadata = this.configManager.getConnectionInfo ? 
      this.configManager.getConnectionInfo() as any : 
      { version: '1.0.0', modified: new Date().toISOString() };
    
    const backup = await this.backupManager.createBackup(config, metadata, {
      name,
      description: name ? `Manual backup: ${name}` : undefined
    });
    
    return backup.id;
  }

  public async restoreBackup(backupId: string, createPreBackup = true): Promise<void> {
    if (createPreBackup) {
      await this.createBackup('pre-restore-backup');
    }

    const { config } = await this.backupManager.restoreBackup(backupId);
    await this.configManager.setConfiguration(config);
  }

  public async listBackups() {
    return this.backupManager.listBackups();
  }

  // Platform Management
  public getPlatformCapabilities(): PlatformCapabilities {
    return this.platformAdapter.getCapabilities();
  }

  public async migrateFromPlatform(fromPlatform: string): Promise<void> {
    const currentConfig = await this.getConfiguration();
    const migratedConfig = await this.platformAdapter.migrateConfiguration(currentConfig, fromPlatform);
    await this.configManager.setConfiguration(migratedConfig);
  }

  // User Preferences
  public getUserPreferenceManager(): UserPreferenceManager {
    return this.preferenceManager;
  }

  public async setUserPreference(path: string, value: any): Promise<void> {
    const parts = path.split('.');
    const section = parts[0] as keyof ConfigurationSchema['userPreferences'];
    
    if (section === 'appearance') {
      await this.preferenceManager.setAppearanceSettings({ [parts[1]]: value });
    } else if (section === 'behavior') {
      await this.preferenceManager.setBehaviorSettings({ [parts[1]]: value });
    } else if (section === 'accessibility') {
      await this.preferenceManager.setAccessibilitySettings({ [parts[1]]: value });
    } else if (section === 'notifications') {
      await this.preferenceManager.setNotificationSettings({ [parts[1]]: value });
    } else if (section === 'language') {
      await this.preferenceManager.setLanguageSettings({ [parts[1]]: value });
    } else if (section === 'privacy') {
      await this.preferenceManager.setPrivacySettings({ [parts[1]]: value });
    }
  }

  // Hardware Calibration
  public getHardwareCalibrationManager(): HardwareCalibrationManager {
    return this.hardwareManager;
  }

  public async addSensorCalibration(sensorId: string, calibrationData: any): Promise<void> {
    await this.hardwareManager.addSensorCalibration(sensorId, calibrationData);
  }

  public async getOverdueCalibrations() {
    return this.hardwareManager.getOverdueCalibrations();
  }

  // Workspace Management
  public getWorkspaceLayoutManager(): WorkspaceLayoutManager {
    return this.workspaceManager;
  }

  public async setCurrentLayout(layoutId: string): Promise<void> {
    await this.workspaceManager.setCurrentLayout(layoutId);
  }

  public async createLayoutFromCurrent(name: string, description: string): Promise<string> {
    return this.workspaceManager.createLayout(name, description);
  }

  // System Statistics
  public async getSystemStats(): Promise<ConfigSystemStats> {
    const config = await this.getConfiguration();
    const validationResults = await this.validateConfiguration();
    const backupStats = await this.backupManager.getBackupStatistics();
    const platformCapabilities = this.platformAdapter.getCapabilities();

    const errors = validationResults.filter(r => r.severity === 'error').length;
    const warnings = validationResults.filter(r => r.severity === 'warning').length;

    const sensorCount = Object.keys(config.hardwareCalibrations.sensors).length;
    const calibratedSensors = Object.values(config.hardwareCalibrations.sensors)
      .filter(s => s.active && new Date(s.expiryDate) > new Date()).length;
    const expiredCalibrations = Object.values(config.hardwareCalibrations.sensors)
      .filter(s => s.active && new Date(s.expiryDate) <= new Date()).length;

    const layoutCount = Object.keys(config.workspaceLayouts.layouts).length;
    const snapshots = this.workspaceManager.getSnapshots();

    return {
      configuration: {
        totalSettings: this.countNestedProperties(config),
        lastModified: new Date().toISOString(), // Simplified
        version: '1.0.0', // Simplified
        validationErrors: errors,
        validationWarnings: warnings
      },
      backups: {
        totalBackups: backupStats.totalBackups,
        totalSize: backupStats.totalSize,
        lastBackup: backupStats.newestBackup.toISOString(),
        automaticBackups: backupStats.automaticBackups,
        manualBackups: backupStats.manualBackups
      },
      hardware: {
        totalSensors: sensorCount,
        calibratedSensors,
        expiredCalibrations,
        overdueCertifications: 0 // Simplified
      },
      workspace: {
        totalLayouts: layoutCount,
        activeLayout: config.workspaceLayouts.current,
        totalSnapshots: snapshots.length,
        layoutsWithIssues: 0 // Simplified
      },
      platform: {
        os: platformCapabilities.os,
        architecture: platformCapabilities.arch,
        supportedFeatures: platformCapabilities.features,
        compatibility: 100 // Simplified
      }
    };
  }

  // Import/Export
  public async exportConfiguration(options: {
    includeUserPreferences?: boolean;
    includeHardwareCalibrations?: boolean;
    includeWorkspaceLayouts?: boolean;
    includeBackups?: boolean;
    format?: 'json' | 'yaml';
  } = {}): Promise<string> {
    const config = await this.getConfiguration();
    const exportData: any = {
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedBy: 'ConfigurationSystem',
        version: '1.0.0',
        platform: this.platformAdapter.getCapabilities().os
      }
    };

    // Always include basic configuration
    exportData.configuration = config;

    if (options.includeUserPreferences !== false) {
      exportData.userPreferences = this.preferenceManager.exportPreferences(true);
    }

    if (options.includeHardwareCalibrations !== false) {
      exportData.hardwareCalibrations = this.hardwareManager.exportCalibrations();
    }

    if (options.includeWorkspaceLayouts !== false) {
      exportData.workspaceLayouts = {
        layouts: this.workspaceManager.listLayouts(),
        templates: this.workspaceManager.getTemplates(),
        snapshots: this.workspaceManager.getSnapshots()
      };
    }

    return this.configManager.exportConfiguration(options.format || 'json');
  }

  public async importConfiguration(data: string, options: {
    merge?: boolean;
    validateBefore?: boolean;
    createBackup?: boolean;
    format?: 'json' | 'yaml';
  } = {}): Promise<void> {
    if (options.createBackup !== false) {
      await this.createBackup('pre-import-backup');
    }

    await this.configManager.importConfiguration(data, options.format || 'json');
  }

  // Health Check
  public async performHealthCheck(): Promise<{
    overall: 'healthy' | 'warning' | 'error';
    details: Array<{
      component: string;
      status: 'healthy' | 'warning' | 'error';
      message: string;
      lastCheck: string;
    }>;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'warning' | 'error' = 'healthy';

    // Configuration validation check
    try {
      const validationResults = await this.validateConfiguration();
      const errors = validationResults.filter(r => r.severity === 'error');
      const warnings = validationResults.filter(r => r.severity === 'warning');

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = 'Configuration is valid';

      if (errors.length > 0) {
        status = 'error';
        message = `${errors.length} validation errors found`;
        overallStatus = 'error';
      } else if (warnings.length > 0) {
        status = 'warning';
        message = `${warnings.length} validation warnings found`;
        if (overallStatus === 'healthy') overallStatus = 'warning';
      }

      checks.push({
        component: 'Configuration',
        status,
        message,
        lastCheck: new Date().toISOString()
      });
    } catch (error) {
      checks.push({
        component: 'Configuration',
        status: 'error',
        message: `Validation failed: ${error.message}`,
        lastCheck: new Date().toISOString()
      });
      overallStatus = 'error';
    }

    // Platform compatibility check
    try {
      const capabilities = this.platformAdapter.getCapabilities();
      checks.push({
        component: 'Platform',
        status: 'healthy',
        message: `Running on ${capabilities.os} ${capabilities.arch}`,
        lastCheck: new Date().toISOString()
      });
    } catch (error) {
      checks.push({
        component: 'Platform',
        status: 'error',
        message: `Platform check failed: ${error.message}`,
        lastCheck: new Date().toISOString()
      });
      overallStatus = 'error';
    }

    // Hardware calibration check
    try {
      const overdue = await this.hardwareManager.getOverdueCalibrations();
      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = 'All calibrations current';

      if (overdue.length > 0) {
        status = overdue.some(o => o.daysOverdue > 30) ? 'error' : 'warning';
        message = `${overdue.length} calibrations overdue`;
        if (status === 'error') overallStatus = 'error';
        else if (overallStatus === 'healthy') overallStatus = 'warning';
      }

      checks.push({
        component: 'Hardware Calibrations',
        status,
        message,
        lastCheck: new Date().toISOString()
      });
    } catch (error) {
      checks.push({
        component: 'Hardware Calibrations',
        status: 'error',
        message: `Calibration check failed: ${error.message}`,
        lastCheck: new Date().toISOString()
      });
      overallStatus = 'error';
    }

    return { overall: overallStatus, details: checks };
  }

  // Private Methods
  private setupIntegrations(): void {
    // Set up cross-component communication
    this.configManager.on('config:changed', (path: string, oldValue: any, newValue: any) => {
      console.log(`Configuration changed: ${path}`);
      
      // Trigger relevant manager updates
      if (path.startsWith('userPreferences.')) {
        // User preference manager will handle this automatically
      } else if (path.startsWith('hardwareCalibrations.')) {
        // Hardware calibration manager will handle this automatically
      } else if (path.startsWith('workspaceLayouts.')) {
        // Workspace layout manager will handle this automatically
      }
    });
  }

  private setupEventHandlers(): void {
    // Configuration events
    this.configManager.on('config:loaded', (config) => {
      console.log('Configuration loaded');
    });

    this.configManager.on('config:saved', (config) => {
      console.log('Configuration saved');
    });

    this.configManager.on('config:error', (error, context) => {
      console.error(`Configuration error in ${context}:`, error);
    });

    // Backup events
    this.backupManager.on('backup-created', (backup) => {
      console.log(`Configuration backup created: ${backup.name}`);
    });

    this.backupManager.on('backup-restored', (info) => {
      console.log(`Configuration restored from backup`);
    });

    // Hardware calibration events
    this.hardwareManager.on('calibrations-overdue', (overdue) => {
      console.warn(`${overdue.length} calibrations are overdue`);
    });

    this.hardwareManager.on('calibrations-due-soon', (upcoming) => {
      console.info(`${upcoming.length} calibrations due soon`);
    });

    // Workspace events
    this.workspaceManager.on('current-layout-changed', (change) => {
      console.log(`Workspace layout changed from ${change.from} to ${change.to}`);
    });
  }

  private async performInitialValidation(): Promise<void> {
    try {
      const results = await this.validateConfiguration();
      const errors = results.filter(r => r.severity === 'error');
      const warnings = results.filter(r => r.severity === 'warning');

      if (errors.length > 0) {
        console.warn(`Configuration has ${errors.length} validation errors`);
      }

      if (warnings.length > 0) {
        console.info(`Configuration has ${warnings.length} validation warnings`);
      }
    } catch (error) {
      console.error('Initial configuration validation failed:', error);
    }
  }

  private async createInitialBackup(): Promise<void> {
    try {
      await this.createBackup('initial-startup-backup');
    } catch (error) {
      console.warn('Failed to create initial backup:', error);
    }
  }

  private getDefaultBackupStrategy(): BackupStrategy {
    return {
      automatic: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: {
        daily: 7,
        weekly: 4,
        monthly: 6,
        yearly: 2
      },
      compression: true,
      encryption: false,
      incremental: true,
      location: 'local',
      maxBackupSize: 100, // 100MB
      exclude: ['temp', 'cache'],
      include: ['config', 'preferences', 'calibrations', 'layouts']
    };
  }

  private countNestedProperties(obj: any): number {
    let count = 0;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        count++;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          count += this.countNestedProperties(obj[key]);
        }
      }
    }
    return count;
  }

  public async dispose(): Promise<void> {
    console.log('Shutting down Centralized Configuration System...');

    await this.workspaceManager.dispose();
    await this.hardwareManager.dispose();
    await this.preferenceManager.dispose();
    await this.backupManager.dispose();
    await this.platformAdapter.dispose();
    await this.configManager.dispose();

    console.log('Centralized Configuration System shut down complete');
  }
}

// Convenience function for quick setup
export async function initializeConfiguration(config?: ConfigSystemConfig): Promise<ConfigurationSystem> {
  const system = ConfigurationSystem.getInstance(config);
  await system.initialize();
  return system;
}