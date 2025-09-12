import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { EventEmitter } from 'events';
import { UpdateManager } from './UpdateManager';
import { UpdateServerConfigManager, UpdateConfigurationManager } from './UpdateServerConfig';
import { SubscriptionValidator } from './SubscriptionValidator';
import { RollbackManager } from './RollbackManager';
import { BackgroundDownloadManager } from './BackgroundDownloadManager';
import { SecurityValidator } from './SecurityValidator';
import {
  UpdateSystemState,
  UpdateInfo,
  UpdateProgress,
  UpdateError,
  UpdatePolicy,
  VersionHistory,
  SubscriptionInfo,
  SecurityValidation
} from './types';

export class UpdateSystem extends EventEmitter {
  private updateManager: UpdateManager;
  private serverConfig: UpdateServerConfigManager;
  private updateConfig: UpdateConfigurationManager;
  private subscriptionValidator: SubscriptionValidator;
  private rollbackManager: RollbackManager;
  private downloadManager: BackgroundDownloadManager;
  private securityValidator: SecurityValidator;
  private mainWindow: BrowserWindow | null = null;
  private initialized = false;

  constructor() {
    super();
    
    this.serverConfig = new UpdateServerConfigManager();
    this.updateConfig = new UpdateConfigurationManager();
    this.subscriptionValidator = new SubscriptionValidator(this.serverConfig);
    this.rollbackManager = new RollbackManager();
    this.downloadManager = new BackgroundDownloadManager(this.serverConfig);
    this.securityValidator = new SecurityValidator(this.serverConfig);
    this.updateManager = new UpdateManager();

    this.setupEventForwarding();
  }

  public async initialize(mainWindow: BrowserWindow): Promise<void> {
    if (this.initialized) {
      console.warn('UpdateSystem already initialized');
      return;
    }

    this.mainWindow = mainWindow;

    try {
      console.log('Initializing UpdateSystem...');

      // Initialize all components in the correct order
      await this.serverConfig.initialize();
      await this.updateConfig.initialize();
      await this.subscriptionValidator.initialize();
      await this.rollbackManager.initialize();
      await this.downloadManager.initialize();
      await this.securityValidator.initialize();
      
      // Initialize the main update manager last
      await this.updateManager.initialize(mainWindow);

      this.initialized = true;
      this.setupMenuIntegration();
      
      console.log('UpdateSystem initialized successfully');
      this.emit('initialized');

      // Start initial update check after a delay
      setTimeout(() => {
        this.checkForUpdates();
      }, 5000); // 5 seconds after startup

    } catch (error) {
      console.error('Failed to initialize UpdateSystem:', error);
      this.emit('initialization-error', error);
      throw error;
    }
  }

  public async checkForUpdates(): Promise<UpdateInfo | null> {
    this.ensureInitialized();
    return await this.updateManager.checkForUpdates();
  }

  public async downloadUpdate(): Promise<boolean> {
    this.ensureInitialized();
    return await this.updateManager.downloadUpdate();
  }

  public async installUpdate(): Promise<boolean> {
    this.ensureInitialized();
    return await this.updateManager.installUpdate();
  }

  public async rollback(targetVersion?: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.updateManager.rollback(targetVersion);
  }

  public getSystemState(): UpdateSystemState {
    this.ensureInitialized();
    return this.updateManager.getState();
  }

  public async getVersionHistory(): Promise<VersionHistory> {
    this.ensureInitialized();
    return await this.updateManager.getVersionHistory();
  }

  public async setUpdatePolicy(policy: Partial<UpdatePolicy>): Promise<void> {
    this.ensureInitialized();
    await this.updateManager.setUpdatePolicy(policy);
  }

  public async getSubscriptionStatus(): Promise<SubscriptionInfo | null> {
    this.ensureInitialized();
    return await this.subscriptionValidator.getCurrentSubscription();
  }

  public async setLicenseKey(licenseKey: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.subscriptionValidator.setLicenseKey(licenseKey);
  }

  public async validateUpdateSecurity(updateInfo: UpdateInfo, filePath: string): Promise<SecurityValidation> {
    this.ensureInitialized();
    return await this.securityValidator.validateUpdate(updateInfo, filePath);
  }

  public async getSystemHealth(): Promise<{
    updateSystemHealthy: boolean;
    subscriptionValid: boolean;
    rollbackAvailable: boolean;
    lastUpdateCheck: Date | null;
    issues: string[];
  }> {
    this.ensureInitialized();

    const issues: string[] = [];
    const state = this.getSystemState();
    
    // Check update system health
    const updateSystemHealthy = state.initialized && !state.error;
    if (!updateSystemHealthy && state.error) {
      issues.push(`Update system error: ${state.error.message}`);
    }

    // Check subscription validity
    const subscription = await this.getSubscriptionStatus();
    const subscriptionValid = subscription?.status === 'active' && subscription.expiresAt > new Date();
    if (!subscriptionValid) {
      issues.push('Invalid or expired subscription');
    }

    // Check rollback availability
    const rollbackAvailable = state.rollbackVersions.length > 0;
    if (!rollbackAvailable) {
      issues.push('No rollback versions available');
    }

    return {
      updateSystemHealthy,
      subscriptionValid,
      rollbackAvailable,
      lastUpdateCheck: state.lastCheck,
      issues
    };
  }

  public async getSystemStatistics(): Promise<{
    totalUpdatesProcessed: number;
    averageDownloadSpeed: number;
    rollbacksPerformed: number;
    securityValidationsPassed: number;
    lastUpdateSize: number;
    cacheSize: number;
  }> {
    // This would be implemented with persistent storage of metrics
    return {
      totalUpdatesProcessed: 0,
      averageDownloadSpeed: 0,
      rollbacksPerformed: 0,
      securityValidationsPassed: 0,
      lastUpdateSize: 0,
      cacheSize: 0
    };
  }

  public destroy(): void {
    if (!this.initialized) {
      return;
    }

    console.log('Destroying UpdateSystem...');

    this.updateManager?.destroy();
    this.downloadManager?.destroy();

    this.removeAllListeners();
    this.initialized = false;

    console.log('UpdateSystem destroyed');
  }

  private setupEventForwarding(): void {
    // Forward events from UpdateManager to the main UpdateSystem
    this.updateManager.on('checking-for-update', () => {
      this.emit('checking-for-update');
    });

    this.updateManager.on('update-available', (info: UpdateInfo) => {
      this.emit('update-available', info);
    });

    this.updateManager.on('update-not-available', (info: UpdateInfo) => {
      this.emit('update-not-available', info);
    });

    this.updateManager.on('download-progress', (progress: UpdateProgress) => {
      this.emit('download-progress', progress);
    });

    this.updateManager.on('update-downloaded', (info: UpdateInfo) => {
      this.emit('update-downloaded', info);
    });

    this.updateManager.on('before-quit-for-update', () => {
      this.emit('before-quit-for-update');
    });

    this.updateManager.on('update-error', (error: UpdateError) => {
      this.emit('update-error', error);
    });

    this.updateManager.on('rollback-complete', (version: string) => {
      this.emit('rollback-complete', version);
    });

    this.updateManager.on('subscription-status', (info: SubscriptionInfo) => {
      this.emit('subscription-status', info);
    });
  }

  private setupMenuIntegration(): void {
    // Add update-related menu items to the application menu
    if (process.platform === 'darwin') {
      this.setupMacOSMenu();
    } else {
      this.setupWindowsLinuxMenu();
    }
  }

  private setupMacOSMenu(): void {
    const template = Menu.getApplicationMenu()?.items || [];
    
    // Add update menu items to the application menu
    const appMenu = template.find(item => item.role === 'appMenu');
    if (appMenu && appMenu.submenu) {
      appMenu.submenu.insert(1, {
        type: 'separator'
      });
      appMenu.submenu.insert(2, {
        label: 'Check for Updates...',
        click: () => this.checkForUpdates()
      });
    }
  }

  private setupWindowsLinuxMenu(): void {
    const template = Menu.getApplicationMenu()?.items || [];
    
    // Add Help menu with update options
    const helpMenu = template.find(item => item.label === 'Help');
    if (helpMenu && helpMenu.submenu) {
      helpMenu.submenu.insert(0, {
        label: 'Check for Updates...',
        click: () => this.checkForUpdates()
      });
      helpMenu.submenu.insert(1, {
        type: 'separator'
      });
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('UpdateSystem not initialized. Call initialize() first.');
    }
  }
}

// Global instance for the application
let updateSystem: UpdateSystem | null = null;

export const initializeUpdateSystem = async (mainWindow: BrowserWindow): Promise<UpdateSystem> => {
  if (updateSystem) {
    console.warn('UpdateSystem already exists');
    return updateSystem;
  }

  updateSystem = new UpdateSystem();
  await updateSystem.initialize(mainWindow);
  return updateSystem;
};

export const getUpdateSystem = (): UpdateSystem => {
  if (!updateSystem) {
    throw new Error('UpdateSystem not initialized. Call initializeUpdateSystem() first.');
  }
  return updateSystem;
};

export const destroyUpdateSystem = (): void => {
  if (updateSystem) {
    updateSystem.destroy();
    updateSystem = null;
  }
};

// Export all types and classes for external use
export * from './types';
export { UpdateManager } from './UpdateManager';
export { UpdateServerConfigManager, UpdateConfigurationManager } from './UpdateServerConfig';
export { SubscriptionValidator } from './SubscriptionValidator';
export { RollbackManager } from './RollbackManager';
export { BackgroundDownloadManager } from './BackgroundDownloadManager';
export { SecurityValidator } from './SecurityValidator';
export { UpdateUIManager } from './UpdateUIManager';

// IPC handlers for renderer process communication
export const setupUpdateIPC = (): void => {
  ipcMain.handle('update-system:get-state', () => {
    return updateSystem?.getSystemState() || null;
  });

  ipcMain.handle('update-system:check-for-updates', async () => {
    return updateSystem ? await updateSystem.checkForUpdates() : null;
  });

  ipcMain.handle('update-system:download-update', async () => {
    return updateSystem ? await updateSystem.downloadUpdate() : false;
  });

  ipcMain.handle('update-system:install-update', async () => {
    return updateSystem ? await updateSystem.installUpdate() : false;
  });

  ipcMain.handle('update-system:rollback', async (_, targetVersion?: string) => {
    return updateSystem ? await updateSystem.rollback(targetVersion) : false;
  });

  ipcMain.handle('update-system:get-version-history', async () => {
    return updateSystem ? await updateSystem.getVersionHistory() : null;
  });

  ipcMain.handle('update-system:set-update-policy', async (_, policy: Partial<UpdatePolicy>) => {
    if (updateSystem) {
      await updateSystem.setUpdatePolicy(policy);
    }
  });

  ipcMain.handle('update-system:get-subscription-status', async () => {
    return updateSystem ? await updateSystem.getSubscriptionStatus() : null;
  });

  ipcMain.handle('update-system:set-license-key', async (_, licenseKey: string) => {
    return updateSystem ? await updateSystem.setLicenseKey(licenseKey) : false;
  });

  ipcMain.handle('update-system:get-system-health', async () => {
    return updateSystem ? await updateSystem.getSystemHealth() : null;
  });

  ipcMain.handle('update-system:get-system-statistics', async () => {
    return updateSystem ? await updateSystem.getSystemStatistics() : null;
  });
};

// Auto-setup IPC when module is imported
if (typeof ipcMain !== 'undefined') {
  setupUpdateIPC();
}