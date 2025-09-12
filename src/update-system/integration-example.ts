/**
 * Integration Example for Ghost Hunter Toolbox Auto-Update System
 * 
 * This file demonstrates how to integrate the comprehensive auto-update system
 * into your Electron application with security, rollback capabilities, and
 * professional licensing validation.
 */

import { app, BrowserWindow } from 'electron';
import { initializeUpdateSystem, getUpdateSystem, UpdateSystem } from './index';
import { UpdatePolicy } from './types';

class GhostHunterUpdateIntegration {
  private updateSystem: UpdateSystem | null = null;
  private mainWindow: BrowserWindow | null = null;

  public async initialize(mainWindow: BrowserWindow): Promise<void> {
    this.mainWindow = mainWindow;

    try {
      console.log('Initializing Ghost Hunter Toolbox Update System...');
      
      // Initialize the complete update system
      this.updateSystem = await initializeUpdateSystem(mainWindow);

      // Configure professional software update policy
      await this.configureUpdatePolicy();

      // Set up event listeners for professional requirements
      this.setupProfessionalEventHandlers();

      // Configure security-focused settings
      await this.configureSecuritySettings();

      console.log('Update system initialized successfully for professional software');
      
      // Start the professional update workflow
      await this.startProfessionalUpdateWorkflow();

    } catch (error) {
      console.error('Failed to initialize update system:', error);
      // In professional software, ensure graceful fallback
      this.handleInitializationFailure(error);
    }
  }

  private async configureUpdatePolicy(): Promise<void> {
    if (!this.updateSystem) return;

    const professionalPolicy: Partial<UpdatePolicy> = {
      automaticUpdates: true,
      criticalUpdatesOnly: false, // Allow all updates for feature improvements
      updateWindow: {
        startHour: 2,  // 2 AM - 6 AM maintenance window
        endHour: 6,
        timezone: 'local'
      },
      deferralLimit: 24, // Max 24 hours deferral for critical updates
      forceUpdateThreshold: 3, // Force after 3 critical updates
      bandwidthLimit: 0, // No limit for professional software
      wifiOnlyDownloads: false // Allow updates on any connection
    };

    await this.updateSystem.setUpdatePolicy(professionalPolicy);
    console.log('Professional update policy configured');
  }

  private setupProfessionalEventHandlers(): void {
    if (!this.updateSystem) return;

    // Handle update availability for professional users
    this.updateSystem.on('update-available', (updateInfo) => {
      console.log(`Professional update available: ${updateInfo.version}`);
      
      // For professional software, check if this update is required
      if (updateInfo.criticalUpdate) {
        this.handleCriticalUpdate(updateInfo);
      } else {
        this.handleRegularUpdate(updateInfo);
      }
    });

    // Handle download progress for professional feedback
    this.updateSystem.on('download-progress', (progress) => {
      this.notifyProfessionalUser('download-progress', {
        percent: Math.round(progress.percent),
        speed: this.formatSpeed(progress.bytesPerSecond),
        eta: progress.estimatedTimeRemaining ? 
             this.formatTime(progress.estimatedTimeRemaining) : null
      });
    });

    // Handle successful updates
    this.updateSystem.on('update-downloaded', (updateInfo) => {
      console.log(`Update ${updateInfo.version} downloaded successfully`);
      this.scheduleInstallationForProfessionalUse(updateInfo);
    });

    // Handle update errors with professional recovery
    this.updateSystem.on('update-error', (error) => {
      console.error('Professional update system error:', error);
      this.handleProfessionalUpdateError(error);
    });

    // Handle rollback completion
    this.updateSystem.on('rollback-complete', (version) => {
      console.log(`Professional rollback to ${version} completed`);
      this.notifyProfessionalUser('rollback-complete', { version });
    });

    // Handle subscription status changes
    this.updateSystem.on('subscription-status', (subscription) => {
      console.log('Subscription status updated:', subscription);
      this.handleSubscriptionStatusChange(subscription);
    });
  }

  private async configureSecuritySettings(): Promise<void> {
    if (!this.updateSystem) return;

    try {
      // For professional software, ensure maximum security
      const securityValidator = this.updateSystem['securityValidator'];
      if (securityValidator) {
        securityValidator.setSecurityPolicy({
          requireSignatureValidation: true,
          requireChecksumValidation: true,
          requireCertificateValidation: true,
          allowedSignatureAlgorithms: ['RSA-SHA256', 'RSA-SHA512'],
          minimumKeySize: 2048,
          allowSelfSignedCertificates: false, // Professional software requires trusted certs
          timestampValidation: true,
          codeSigningValidation: true
        });

        console.log('Professional security settings configured');
      }
    } catch (error) {
      console.error('Failed to configure security settings:', error);
    }
  }

  private async startProfessionalUpdateWorkflow(): Promise<void> {
    if (!this.updateSystem) return;

    // Initial health check
    const health = await this.updateSystem.getSystemHealth();
    console.log('Update system health check:', health);

    if (!health.subscriptionValid) {
      this.handleInvalidSubscription();
      return;
    }

    // Check for updates immediately on startup (professional requirement)
    setTimeout(async () => {
      try {
        const updateInfo = await this.updateSystem!.checkForUpdates();
        if (updateInfo) {
          console.log(`Startup update check found: ${updateInfo.version}`);
        } else {
          console.log('No updates available at startup');
        }
      } catch (error) {
        console.error('Startup update check failed:', error);
      }
    }, 3000); // 3 second delay after app startup
  }

  private handleCriticalUpdate(updateInfo: any): void {
    // Critical updates require immediate user attention
    this.notifyProfessionalUser('critical-update-available', {
      version: updateInfo.version,
      releaseNotes: updateInfo.releaseNotes,
      size: updateInfo.size,
      securityUpdate: true
    });

    // Auto-download critical updates
    if (this.updateSystem) {
      this.updateSystem.downloadUpdate()
        .then(success => {
          if (success) {
            console.log('Critical update download started');
          }
        })
        .catch(error => {
          console.error('Failed to download critical update:', error);
        });
    }
  }

  private handleRegularUpdate(updateInfo: any): void {
    // Regular updates can be deferred by professional users
    this.notifyProfessionalUser('update-available', {
      version: updateInfo.version,
      releaseNotes: updateInfo.releaseNotes,
      size: updateInfo.size,
      canDefer: true
    });
  }

  private scheduleInstallationForProfessionalUse(updateInfo: any): void {
    // Professional software should install updates during maintenance windows
    const now = new Date();
    const currentHour = now.getHours();
    
    // Check if we're in the maintenance window (2 AM - 6 AM)
    if (currentHour >= 2 && currentHour < 6) {
      this.promptProfessionalInstallation(updateInfo, true);
    } else {
      this.scheduleProfessionalInstallation(updateInfo);
    }
  }

  private promptProfessionalInstallation(updateInfo: any, inMaintenanceWindow: boolean): void {
    const message = inMaintenanceWindow 
      ? 'Update ready to install during maintenance window'
      : 'Update ready to install - requires application restart';

    this.notifyProfessionalUser('update-ready-install', {
      version: updateInfo.version,
      message,
      inMaintenanceWindow,
      canDefer: !updateInfo.criticalUpdate
    });
  }

  private scheduleProfessionalInstallation(updateInfo: any): void {
    // Schedule installation for next maintenance window
    const now = new Date();
    const nextMaintenanceWindow = new Date(now);
    
    // Set to next 2 AM
    nextMaintenanceWindow.setHours(2, 0, 0, 0);
    if (nextMaintenanceWindow <= now) {
      nextMaintenanceWindow.setDate(nextMaintenanceWindow.getDate() + 1);
    }

    const msUntilMaintenance = nextMaintenanceWindow.getTime() - now.getTime();

    this.notifyProfessionalUser('update-scheduled', {
      version: updateInfo.version,
      scheduledTime: nextMaintenanceWindow.toLocaleString(),
      hoursUntil: Math.round(msUntilMaintenance / (1000 * 60 * 60))
    });

    // Set timer for automatic installation
    setTimeout(() => {
      if (this.updateSystem) {
        this.updateSystem.installUpdate()
          .then(success => {
            console.log(`Scheduled installation ${success ? 'succeeded' : 'failed'}`);
          });
      }
    }, msUntilMaintenance);
  }

  private handleProfessionalUpdateError(error: any): void {
    console.error('Professional update error:', error);

    // Determine if this is a recoverable error
    if (error.recoverable) {
      // Attempt recovery for professional software
      this.attemptProfessionalRecovery(error);
    } else {
      // Non-recoverable error - notify professional user
      this.notifyProfessionalUser('update-error', {
        code: error.code,
        message: error.message,
        recoverable: false,
        supportContact: 'support@tacctile.com'
      });
    }
  }

  private async attemptProfessionalRecovery(error: any): Promise<void> {
    console.log('Attempting professional recovery from update error...');

    try {
      // Wait before retry
      await this.delay(5000);

      // Check system health
      if (this.updateSystem) {
        const health = await this.updateSystem.getSystemHealth();
        
        if (health.rollbackAvailable && error.code === 'SIGNATURE_VERIFICATION_FAILED') {
          // Security error - offer rollback
          this.notifyProfessionalUser('security-error-rollback-available', {
            error: error.message,
            rollbackVersions: health.rollbackAvailable
          });
        } else {
          // Try update check again
          await this.updateSystem.checkForUpdates();
        }
      }
    } catch (recoveryError) {
      console.error('Professional recovery failed:', recoveryError);
      this.notifyProfessionalUser('recovery-failed', {
        originalError: error.message,
        recoveryError: recoveryError.message
      });
    }
  }

  private handleInvalidSubscription(): void {
    this.notifyProfessionalUser('subscription-invalid', {
      message: 'Professional license required for updates',
      action: 'contact-support',
      supportUrl: 'https://tacctile.com/support'
    });
  }

  private handleSubscriptionStatusChange(subscription: any): void {
    if (subscription.status !== 'active') {
      this.notifyProfessionalUser('subscription-expired', {
        tier: subscription.tier,
        expiredDate: subscription.expiresAt,
        renewalUrl: 'https://tacctile.com/renew'
      });
    }
  }

  private handleInitializationFailure(error: any): void {
    console.error('Update system initialization failed - entering fallback mode');
    
    // In professional software, provide clear error reporting
    this.notifyProfessionalUser('update-system-disabled', {
      reason: error.message,
      impact: 'Automatic updates disabled - manual updates required',
      supportContact: 'support@tacctile.com'
    });
  }

  private notifyProfessionalUser(eventType: string, data: any): void {
    // Send notification to renderer process for professional UI
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('professional-update-event', {
        type: eventType,
        data,
        timestamp: new Date().toISOString(),
        priority: this.getEventPriority(eventType)
      });
    }
  }

  private getEventPriority(eventType: string): 'low' | 'normal' | 'high' | 'critical' {
    const highPriority = [
      'critical-update-available',
      'security-error-rollback-available',
      'subscription-invalid'
    ];
    
    const criticalPriority = [
      'update-system-disabled',
      'recovery-failed'
    ];

    if (criticalPriority.includes(eventType)) return 'critical';
    if (highPriority.includes(eventType)) return 'high';
    return 'normal';
  }

  private formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for manual control by professional users
  public async manualUpdateCheck(): Promise<void> {
    if (this.updateSystem) {
      try {
        const updateInfo = await this.updateSystem.checkForUpdates();
        this.notifyProfessionalUser('manual-update-check-result', {
          updateAvailable: !!updateInfo,
          version: updateInfo?.version,
          lastCheck: new Date().toISOString()
        });
      } catch (error) {
        this.notifyProfessionalUser('manual-update-check-failed', {
          error: error.message
        });
      }
    }
  }

  public async performEmergencyRollback(): Promise<void> {
    if (this.updateSystem) {
      try {
        const success = await this.updateSystem.rollback();
        this.notifyProfessionalUser('emergency-rollback-result', {
          success,
          message: success ? 'Emergency rollback completed' : 'Emergency rollback failed'
        });
      } catch (error) {
        this.notifyProfessionalUser('emergency-rollback-failed', {
          error: error.message
        });
      }
    }
  }

  public async getSystemStatus(): Promise<any> {
    if (!this.updateSystem) return null;

    const [health, statistics, state] = await Promise.all([
      this.updateSystem.getSystemHealth(),
      this.updateSystem.getSystemStatistics(),
      Promise.resolve(this.updateSystem.getSystemState())
    ]);

    return {
      health,
      statistics,
      state,
      professional: {
        licenseValid: health.subscriptionValid,
        securityLevel: 'professional',
        rollbackCapable: health.rollbackAvailable,
        lastUpdateCheck: state.lastCheck?.toISOString()
      }
    };
  }
}

// Export for integration into main application
export { GhostHunterUpdateIntegration };

// Example usage in main Electron process
export const setupProfessionalUpdates = async (mainWindow: BrowserWindow): Promise<GhostHunterUpdateIntegration> => {
  const updateIntegration = new GhostHunterUpdateIntegration();
  await updateIntegration.initialize(mainWindow);
  return updateIntegration;
};

// Integration with application lifecycle
app.on('ready', async () => {
  // ... your existing app initialization code ...
  
  // Initialize professional update system after main window is created
  if (process.env.NODE_ENV === 'production') {
    try {
      const mainWindow = new BrowserWindow(/* your window options */);
      const updateIntegration = await setupProfessionalUpdates(mainWindow);
      
      // Store reference for later use
      (global as any).professionalUpdates = updateIntegration;
      
      console.log('Professional update system ready');
    } catch (error) {
      console.error('Failed to setup professional updates:', error);
    }
  }
});

app.on('before-quit', () => {
  // Cleanup update system before app quits
  const updateSystem = getUpdateSystem();
  if (updateSystem) {
    updateSystem.destroy();
  }
});