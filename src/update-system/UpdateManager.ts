import { app, autoUpdater, ipcMain, dialog, BrowserWindow } from 'electron';
import { EventEmitter } from 'events';
import { autoUpdater as electronUpdater } from 'electron-updater';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  UpdateConfiguration,
  UpdateInfo,
  UpdateProgress,
  UpdateError,
  UpdateEvent,
  UpdateEventType,
  UpdateStage,
  UpdateErrorCode,
  UpdateSystemState,
  UpdateManagerEvents,
  SubscriptionInfo,
  RollbackInfo,
  UpdateNotification,
  VersionHistory,
  UpdatePolicy
} from './types';
import { UpdateServerConfigManager, UpdateConfigurationManager } from './UpdateServerConfig';

export class UpdateManager extends EventEmitter {
  private serverConfig: UpdateServerConfigManager;
  private updateConfig: UpdateConfigurationManager;
  private state: UpdateSystemState;
  private checkTimer: NodeJS.Timeout | null = null;
  private rollbackManager: RollbackManager;
  private subscriptionValidator: SubscriptionValidator;
  private securityValidator: SecurityValidator;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    super();
    
    this.serverConfig = new UpdateServerConfigManager();
    this.updateConfig = new UpdateConfigurationManager();
    this.rollbackManager = new RollbackManager();
    this.subscriptionValidator = new SubscriptionValidator();
    this.securityValidator = new SecurityValidator();
    
    this.state = {
      initialized: false,
      checking: false,
      downloading: false,
      installing: false,
      rollingBack: false,
      lastCheck: null,
      currentProgress: null,
      availableUpdate: null,
      pendingUpdate: null,
      error: null,
      subscription: null,
      rollbackVersions: [],
      notifications: []
    };

    this.setupElectronUpdater();
    this.setupIpcHandlers();
  }

  public async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;
    
    try {
      await this.serverConfig.initialize();
      await this.updateConfig.initialize();
      await this.rollbackManager.initialize();
      
      this.configureElectronUpdater();
      await this.loadRollbackVersions();
      await this.validateSubscription();
      
      this.state.initialized = true;
      this.startPeriodicChecks();
      
      this.emit('initialized');
      console.log('UpdateManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize UpdateManager:', error);
      this.handleError('UNKNOWN_ERROR', `Initialization failed: ${error}`, error);
      throw error;
    }
  }

  public async checkForUpdates(): Promise<UpdateInfo | null> {
    if (this.state.checking) {
      return null;
    }

    this.state.checking = true;
    this.state.error = null;
    this.emit('checking-for-update');
    this.notifyRenderer('checking-for-updates', {});

    try {
      console.log('Checking for updates...');
      const result = await electronUpdater.checkForUpdates();
      
      this.state.lastCheck = new Date();
      
      if (result?.updateInfo) {
        const updateInfo = await this.processUpdateInfo(result.updateInfo);
        
        if (updateInfo) {
          this.state.availableUpdate = updateInfo;
          this.emit('update-available', updateInfo);
          this.notifyRenderer('update-available', updateInfo);
          
          // Auto-download if configured
          if (this.updateConfig.getConfiguration().autoDownload) {
            await this.downloadUpdate();
          }
          
          return updateInfo;
        }
      } else {
        this.emit('update-not-available', { version: app.getVersion() } as UpdateInfo);
        this.notifyRenderer('update-not-available', { version: app.getVersion() });
      }
      
      return null;
    } catch (error) {
      this.handleError('NETWORK_ERROR', 'Failed to check for updates', error);
      return null;
    } finally {
      this.state.checking = false;
    }
  }

  public async downloadUpdate(): Promise<boolean> {
    if (!this.state.availableUpdate || this.state.downloading) {
      return false;
    }

    this.state.downloading = true;
    this.state.error = null;

    try {
      console.log('Starting update download...');
      
      // Validate subscription before downloading
      const subscriptionValid = await this.subscriptionValidator.validate();
      if (!subscriptionValid) {
        throw new Error('Invalid subscription for update access');
      }

      await electronUpdater.downloadUpdate();
      return true;
    } catch (error) {
      this.handleError('NETWORK_ERROR', 'Failed to download update', error);
      return false;
    } finally {
      this.state.downloading = false;
    }
  }

  public async installUpdate(): Promise<boolean> {
    if (!this.state.pendingUpdate || this.state.installing) {
      return false;
    }

    this.state.installing = true;
    
    try {
      console.log('Installing update...');
      
      // Create rollback point before installation
      await this.rollbackManager.createRollbackPoint();
      
      // Perform security validation
      const securityValid = await this.securityValidator.validateUpdate(this.state.pendingUpdate);
      if (!securityValid.signatureValid || !securityValid.checksumValid) {
        throw new Error('Security validation failed');
      }

      this.notifyRenderer('installing', { version: this.state.pendingUpdate.version });
      
      // Install the update (this will restart the app)
      electronUpdater.quitAndInstall(false, true);
      
      return true;
    } catch (error) {
      this.handleError('UNKNOWN_ERROR', 'Failed to install update', error);
      return false;
    } finally {
      this.state.installing = false;
    }
  }

  public async rollback(targetVersion?: string): Promise<boolean> {
    if (this.state.rollingBack) {
      return false;
    }

    this.state.rollingBack = true;
    
    try {
      console.log('Initiating rollback...');
      const success = await this.rollbackManager.rollback(targetVersion);
      
      if (success) {
        this.emit('rollback-complete', targetVersion || 'previous');
        this.notifyRenderer('rollback-complete', { version: targetVersion });
      }
      
      return success;
    } catch (error) {
      this.handleError('ROLLBACK_FAILED', 'Failed to rollback update', error);
      return false;
    } finally {
      this.state.rollingBack = false;
    }
  }

  public getState(): UpdateSystemState {
    return { ...this.state };
  }

  public async getVersionHistory(): Promise<VersionHistory> {
    const rollbackVersions = await this.rollbackManager.getVersionHistory();
    
    return {
      versions: rollbackVersions.map(rb => ({
        version: rb.version,
        installDate: rb.installDate,
        channel: 'stable', // Could be enhanced to track channel per version
        size: 0, // Could be enhanced to track size
        canRollback: true,
        backupExists: Boolean(rb.backupPath)
      })),
      currentVersion: app.getVersion(),
      rollbackAvailable: rollbackVersions.length > 0,
      lastUpdateCheck: this.state.lastCheck || new Date(0)
    };
  }

  public async setUpdatePolicy(policy: Partial<UpdatePolicy>): Promise<void> {
    // Update configuration based on policy
    const currentConfig = this.updateConfig.getConfiguration();
    const updatedConfig = {
      ...currentConfig,
      autoDownload: policy.automaticUpdates ?? currentConfig.autoDownload,
      autoInstall: policy.automaticUpdates ?? currentConfig.autoInstall
    };
    
    await this.updateConfig.updateConfiguration(updatedConfig);
    
    // Restart periodic checks if interval changed
    this.startPeriodicChecks();
  }

  private setupElectronUpdater(): void {
    // Configure electron-updater events
    electronUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
    });

    electronUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
    });

    electronUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
    });

    electronUpdater.on('error', (error) => {
      console.error('Auto-updater error:', error);
      this.handleError('UNKNOWN_ERROR', 'Auto-updater error', error);
    });

    electronUpdater.on('download-progress', (progress) => {
      const updateProgress: UpdateProgress = {
        bytesPerSecond: progress.bytesPerSecond,
        percent: progress.percent,
        total: progress.total,
        transferred: progress.transferred,
        stage: 'download-progress',
        estimatedTimeRemaining: (progress.total - progress.transferred) / progress.bytesPerSecond
      };
      
      this.state.currentProgress = updateProgress;
      this.emit('download-progress', updateProgress);
      this.notifyRenderer('download-progress', updateProgress);
    });

    electronUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      this.state.pendingUpdate = this.state.availableUpdate;
      this.state.availableUpdate = null;
      this.state.downloading = false;
      
      this.emit('update-downloaded', info);
      this.notifyRenderer('update-downloaded', info);
      
      // Auto-install if configured and not critical system
      const config = this.updateConfig.getConfiguration();
      if (config.autoInstall) {
        // For professional software, always prompt user
        this.promptForInstallation();
      } else {
        this.notifyUpdateReadyForInstallation();
      }
    });

    electronUpdater.on('before-quit-for-update', () => {
      console.log('App will quit for update...');
      this.emit('before-quit-for-update');
    });
  }

  private configureElectronUpdater(): void {
    const config = this.updateConfig.getConfiguration();
    const serverConfig = this.serverConfig.getConfig();
    
    electronUpdater.setFeedURL({
      provider: 'generic',
      url: config.updateServerUrl,
      channel: config.channel
    });

    electronUpdater.autoDownload = false; // We handle downloads manually
    electronUpdater.autoInstallOnAppQuit = false; // We handle installation manually
    electronUpdater.allowDowngrade = false;
    electronUpdater.allowPrerelease = config.allowPrerelease;
  }

  private setupIpcHandlers(): void {
    ipcMain.handle('update:check', async () => {
      return await this.checkForUpdates();
    });

    ipcMain.handle('update:download', async () => {
      return await this.downloadUpdate();
    });

    ipcMain.handle('update:install', async () => {
      return await this.installUpdate();
    });

    ipcMain.handle('update:rollback', async (_, targetVersion?: string) => {
      return await this.rollback(targetVersion);
    });

    ipcMain.handle('update:getState', () => {
      return this.getState();
    });

    ipcMain.handle('update:getVersionHistory', async () => {
      return await this.getVersionHistory();
    });

    ipcMain.handle('update:setPolicy', async (_, policy: Partial<UpdatePolicy>) => {
      return await this.setUpdatePolicy(policy);
    });
  }

  private async processUpdateInfo(info: any): Promise<UpdateInfo | null> {
    try {
      const updateInfo: UpdateInfo = {
        version: info.version,
        releaseDate: info.releaseDate || new Date().toISOString(),
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes,
        files: info.files || [],
        signature: info.signature || '',
        checksum: info.sha512 || info.checksum || '',
        minimumSystemVersion: info.minimumSystemVersion,
        requiredSubscriptionTier: info.requiredSubscriptionTier || 'basic',
        rollbackSupported: true,
        criticalUpdate: info.criticalUpdate || false,
        size: info.files?.reduce((total: number, file: any) => total + (file.size || 0), 0) || 0,
        channel: this.updateConfig.getConfiguration().channel
      };

      // Validate subscription requirements
      if (updateInfo.requiredSubscriptionTier) {
        const hasAccess = await this.subscriptionValidator.hasAccessToTier(updateInfo.requiredSubscriptionTier);
        if (!hasAccess) {
          this.handleError('SUBSCRIPTION_INVALID', 'Insufficient subscription level for this update');
          return null;
        }
      }

      return updateInfo;
    } catch (error) {
      console.error('Failed to process update info:', error);
      return null;
    }
  }

  private startPeriodicChecks(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    const config = this.updateConfig.getConfiguration();
    this.checkTimer = setInterval(() => {
      this.checkForUpdates();
    }, config.checkInterval);

    console.log(`Started periodic update checks every ${config.checkInterval / 1000} seconds`);
  }

  private async loadRollbackVersions(): Promise<void> {
    try {
      this.state.rollbackVersions = await this.rollbackManager.getVersionHistory();
    } catch (error) {
      console.error('Failed to load rollback versions:', error);
      this.state.rollbackVersions = [];
    }
  }

  private async validateSubscription(): Promise<void> {
    try {
      const subscription = await this.subscriptionValidator.getCurrentSubscription();
      this.state.subscription = subscription;
      this.emit('subscription-status', subscription);
    } catch (error) {
      console.error('Failed to validate subscription:', error);
      this.state.subscription = null;
    }
  }

  private handleError(code: UpdateErrorCode, message: string, details?: any): void {
    const error: UpdateError = {
      code,
      message,
      details,
      recoverable: this.isRecoverableError(code),
      timestamp: new Date()
    };

    this.state.error = error;
    this.emit('update-error', error);
    this.notifyRenderer('update-error', error);
    
    console.error(`Update error [${code}]:`, message, details);
  }

  private isRecoverableError(code: UpdateErrorCode): boolean {
    const recoverableErrors: UpdateErrorCode[] = [
      'NETWORK_ERROR',
      'SERVER_ERROR',
      'INSUFFICIENT_DISK_SPACE'
    ];
    
    return recoverableErrors.includes(code);
  }

  private notifyRenderer(eventType: UpdateEventType, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('update-event', {
        type: eventType,
        data,
        timestamp: new Date()
      } as UpdateEvent);
    }
  }

  private promptForInstallation(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    const options = {
      type: 'info' as const,
      title: 'Update Downloaded',
      message: 'A new version has been downloaded. Would you like to install it now?',
      detail: 'The application will restart to complete the installation.',
      buttons: ['Install Now', 'Install Later'],
      defaultId: 0,
      cancelId: 1
    };

    dialog.showMessageBox(this.mainWindow, options).then(result => {
      if (result.response === 0) {
        this.installUpdate();
      }
    });
  }

  private notifyUpdateReadyForInstallation(): void {
    const notification: UpdateNotification = {
      id: `update-ready-${Date.now()}`,
      type: 'info',
      title: 'Update Ready',
      message: 'A new version is ready to install',
      actions: [
        {
          id: 'install',
          label: 'Install Now',
          style: 'primary',
          callback: () => this.installUpdate()
        },
        {
          id: 'later',
          label: 'Later',
          style: 'secondary',
          callback: () => console.log('Update deferred')
        }
      ],
      persistent: true,
      timestamp: new Date()
    };

    this.state.notifications.push(notification);
    this.notifyRenderer('update-notification', notification);
  }

  public destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    
    this.removeAllListeners();
    console.log('UpdateManager destroyed');
  }
}

// Helper classes for modular functionality
class RollbackManager {
  private rollbackPath: string;

  constructor() {
    this.rollbackPath = path.join(app.getPath('userData'), 'rollback');
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.rollbackPath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize rollback manager:', error);
    }
  }

  public async createRollbackPoint(): Promise<void> {
    // Implementation for creating rollback points
    console.log('Creating rollback point...');
  }

  public async rollback(targetVersion?: string): Promise<boolean> {
    // Implementation for rollback functionality
    console.log('Performing rollback to version:', targetVersion || 'previous');
    return true;
  }

  public async getVersionHistory(): Promise<RollbackInfo[]> {
    // Implementation to get rollback version history
    return [];
  }
}

class SubscriptionValidator {
  public async validate(): Promise<boolean> {
    // Implementation for subscription validation
    return true;
  }

  public async getCurrentSubscription(): Promise<SubscriptionInfo | null> {
    // Implementation to get current subscription info
    return null;
  }

  public async hasAccessToTier(tier: string): Promise<boolean> {
    // Implementation to check subscription tier access
    return true;
  }
}

class SecurityValidator {
  public async validateUpdate(updateInfo: UpdateInfo): Promise<{ signatureValid: boolean; checksumValid: boolean }> {
    // Implementation for security validation
    return { signatureValid: true, checksumValid: true };
  }
}