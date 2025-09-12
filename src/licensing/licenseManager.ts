/**
 * License Manager for Ghost Hunter Toolbox
 * Handles startup license checking and enforcement
 */

import { app, BrowserWindow, dialog } from 'electron';
import { licenseStore, LicenseStatus } from './licenseStore';
import { LicenseValidator, LicenseFeatures } from './licenseValidator';

export interface LicenseCheckResult {
  canProceed: boolean;
  status: LicenseStatus;
  message?: string;
}

export class LicenseManager {
  private validator: LicenseValidator;
  private currentLicenseStatus: LicenseStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.validator = new LicenseValidator();
  }

  /**
   * Perform initial license check on app startup
   */
  public async performStartupCheck(): Promise<LicenseCheckResult> {
    console.log('🔐 Performing license check...');
    
    try {
      const status = await licenseStore.getLicenseStatus();
      this.currentLicenseStatus = status;

      if (status.isValid) {
        console.log('✅ Valid license found');
        this.startPeriodicCheck();
        return {
          canProceed: true,
          status,
        };
      } else {
        console.log('❌ No valid license found:', status.error);
        return {
          canProceed: false,
          status,
          message: this.getErrorMessage(status),
        };
      }
    } catch (error) {
      console.error('💥 License check failed:', error);
      return {
        canProceed: false,
        status: {
          isValid: false,
          isOfflineMode: false,
          error: 'License system error',
        },
        message: 'Unable to verify license. Please contact support.',
      };
    }
  }

  /**
   * Show license activation dialog
   */
  public async showLicenseDialog(parentWindow?: BrowserWindow): Promise<boolean> {
    const result = await dialog.showMessageBox(parentWindow || null, {
      type: 'warning',
      title: 'License Required - Ghost Hunter Toolbox',
      message: 'This application requires a valid license to continue.',
      detail: 'Please enter your license information to activate Ghost Hunter Toolbox.',
      buttons: ['Enter License', 'Start Trial', 'Quit'],
      defaultId: 0,
      cancelId: 2,
    });

    switch (result.response) {
      case 0: // Enter License
        return await this.showLicenseEntryDialog(parentWindow);
      case 1: // Start Trial
        return await this.startTrial();
      case 2: // Quit
      default:
        app.quit();
        return false;
    }
  }

  /**
   * Show license entry dialog
   */
  private async showLicenseEntryDialog(parentWindow?: BrowserWindow): Promise<boolean> {
    // This would typically open a proper license entry window
    // For now, we'll show a simple input dialog
    const result = await dialog.showMessageBox(parentWindow || null, {
      type: 'info',
      title: 'Enter License Key',
      message: 'Please enter your license key and email address:',
      detail: 'You can find your license key in your purchase confirmation email.',
      buttons: ['OK'],
    });

    // In a real implementation, this would open a proper form
    // For demo purposes, we'll create a trial license
    return await this.startTrial();
  }

  /**
   * Start trial license
   */
  private async startTrial(): Promise<boolean> {
    try {
      // Generate a trial license (this would normally come from your server)
      const trialLicenseKey = this.generateTrialLicense();
      const email = 'trial@ghosthunter.local';
      
      const status = await licenseStore.storeLicense(trialLicenseKey, email);
      
      if (status.isValid) {
        this.currentLicenseStatus = status;
        this.startPeriodicCheck();
        
        await dialog.showMessageBox(null, {
          type: 'info',
          title: 'Trial Started',
          message: 'Ghost Hunter Toolbox trial activated!',
          detail: `Your 14-day trial has started. You can create up to 3 investigations with basic features.`,
        });
        
        return true;
      } else {
        throw new Error(status.error || 'Failed to start trial');
      }
    } catch (error) {
      await dialog.showMessageBox(null, {
        type: 'error',
        title: 'Trial Activation Failed',
        message: 'Unable to start trial',
        detail: error.message,
      });
      return false;
    }
  }

  /**
   * Get current license status
   */
  public getCurrentLicenseStatus(): LicenseStatus | null {
    return this.currentLicenseStatus;
  }

  /**
   * Check if a feature is available
   */
  public hasFeature(feature: keyof LicenseFeatures): boolean {
    if (!this.currentLicenseStatus?.isValid || !this.currentLicenseStatus.license) {
      return false;
    }

    return this.validator.hasFeature(this.currentLicenseStatus.license, feature);
  }

  /**
   * Get usage limits for current license
   */
  public getUsageLimits(): Partial<LicenseFeatures> {
    if (!this.currentLicenseStatus?.isValid || !this.currentLicenseStatus.license) {
      return this.validator.getLicenseFeatures('trial');
    }

    return this.validator.getUsageLimits(this.currentLicenseStatus.license);
  }

  /**
   * Check if usage limit is exceeded
   */
  public isUsageLimitExceeded(
    feature: keyof LicenseFeatures,
    currentUsage: number
  ): boolean {
    const limits = this.getUsageLimits();
    const limit = limits[feature] as number;
    
    if (limit === -1) return false; // Unlimited
    return currentUsage >= limit;
  }

  /**
   * Show feature restriction message
   */
  public async showFeatureRestrictionDialog(
    feature: string,
    parentWindow?: BrowserWindow
  ): Promise<void> {
    const licenseType = this.currentLicenseStatus?.license?.type || 'trial';
    
    await dialog.showMessageBox(parentWindow || null, {
      type: 'info',
      title: 'Feature Not Available',
      message: `This feature requires a higher license tier.`,
      detail: `Your ${licenseType} license doesn't include "${feature}". Please upgrade to access this functionality.`,
      buttons: ['OK', 'View Upgrade Options'],
    });
  }

  /**
   * Start periodic license checking
   */
  private startPeriodicCheck(): void {
    // Check license every hour
    this.checkInterval = setInterval(async () => {
      try {
        const status = await licenseStore.getLicenseStatus();
        this.currentLicenseStatus = status;
        
        if (!status.isValid) {
          console.warn('⚠️ License became invalid during runtime');
          this.handleLicenseInvalid();
        } else if (status.gracePeriodRemaining && status.gracePeriodRemaining <= 2) {
          console.warn('⚠️ License grace period expiring soon');
          this.showGracePeriodWarning();
        }
      } catch (error) {
        console.error('Failed periodic license check:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  /**
   * Handle license becoming invalid
   */
  private handleLicenseInvalid(): void {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0];
    
    dialog.showMessageBox(mainWindow || null, {
      type: 'error',
      title: 'License Invalid',
      message: 'Your license is no longer valid.',
      detail: 'The application will close. Please contact support or renew your license.',
      buttons: ['OK'],
    }).then(() => {
      app.quit();
    });
  }

  /**
   * Show grace period warning
   */
  private showGracePeriodWarning(): void {
    const windows = BrowserWindow.getAllWindows();
    const mainWindow = windows[0];
    
    if (this.currentLicenseStatus?.gracePeriodRemaining) {
      dialog.showMessageBox(mainWindow || null, {
        type: 'warning',
        title: 'License Grace Period Expiring',
        message: `Your offline grace period expires in ${this.currentLicenseStatus.gracePeriodRemaining} day(s).`,
        detail: 'Please connect to the internet to validate your license.',
        buttons: ['OK'],
      });
    }
  }

  /**
   * Generate trial license (for demo - in production this comes from your server)
   */
  private generateTrialLicense(): string {
    // This is a simplified trial license for demo purposes
    // In production, this would be generated by your license server
    const trialData = {
      email: 'trial@ghosthunter.local',
      type: 'trial',
      expirationDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      features: ['pluginSupport'],
      deviceId: this.validator.getDeviceId(),
      issuedAt: new Date().toISOString(),
      signature: 'trial-signature', // In production, this would be a real signature
    };

    return Buffer.from(JSON.stringify(trialData)).toString('base64');
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(status: LicenseStatus): string {
    if (status.error?.includes('No license found')) {
      return 'No license found. Please activate your license to continue.';
    } else if (status.error?.includes('expired')) {
      return 'Your license has expired. Please renew to continue using Ghost Hunter Toolbox.';
    } else if (status.error?.includes('Grace period expired')) {
      return 'Your offline grace period has expired. Please connect to the internet to validate your license.';
    } else if (status.error?.includes('different device')) {
      return 'This license is registered to a different device. Please contact support for device transfer.';
    } else {
      return status.error || 'License validation failed. Please contact support.';
    }
  }

  /**
   * Cleanup on app exit
   */
  public cleanup(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

// Export singleton instance
export const licenseManager = new LicenseManager();
export default licenseManager;