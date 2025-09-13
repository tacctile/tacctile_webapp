/**
 * Secure License Storage for Tacctile
 * Uses electron-store with encryption for secure license storage
 */

import Store from 'electron-store';
import crypto from 'crypto';
import { LicenseData, LicenseValidator } from './licenseValidator';

export interface StoredLicenseData {
  encryptedLicense: string;
  lastValidation: string;
  offlineGracePeriodStart?: string;
  validationAttempts: number;
  deviceFingerprint: string;
}

export interface LicenseStatus {
  isValid: boolean;
  license?: LicenseData;
  remainingDays?: number;
  isOfflineMode: boolean;
  gracePeriodRemaining?: number;
  error?: string;
}

export class LicenseStore {
  private store: Store<{ license?: StoredLicenseData }>;
  private validator: LicenseValidator;
  private encryptionKey: string;
  
  // Grace period configuration
  private readonly OFFLINE_GRACE_PERIOD_DAYS = 7;
  private readonly MAX_VALIDATION_ATTEMPTS = 3;
  private readonly VALIDATION_INTERVAL_HOURS = 24;

  constructor() {
    this.validator = new LicenseValidator();
    this.encryptionKey = this.deriveEncryptionKey();
    
    // Initialize secure store with encryption
    this.store = new Store<{ license?: StoredLicenseData }>({
      name: 'tacctile-license',
      encryptionKey: this.encryptionKey,
      schema: {
        license: {
          type: 'object',
          properties: {
            encryptedLicense: { type: 'string' },
            lastValidation: { type: 'string' },
            offlineGracePeriodStart: { type: 'string' },
            validationAttempts: { type: 'number', minimum: 0 },
            deviceFingerprint: { type: 'string' },
          },
          required: ['encryptedLicense', 'lastValidation', 'validationAttempts', 'deviceFingerprint'],
        },
      },
      defaults: {},
    });
  }

  /**
   * Store a validated license securely
   */
  public async storeLicense(licenseKey: string, email: string): Promise<LicenseStatus> {
    try {
      // Validate the license first
      const validationResult = this.validator.validateLicense(licenseKey, email);
      
      if (!validationResult.isValid) {
        return {
          isValid: false,
          isOfflineMode: false,
          error: validationResult.error,
        };
      }

      // Encrypt and store the license
      const encryptedLicense = this.encryptData(JSON.stringify(validationResult.license));
      const deviceFingerprint = this.validator.getDeviceId();
      
      const storedData: StoredLicenseData = {
        encryptedLicense,
        lastValidation: new Date().toISOString(),
        validationAttempts: 0,
        deviceFingerprint,
      };

      this.store.set('license', storedData);

      return {
        isValid: true,
        license: validationResult.license,
        remainingDays: validationResult.remainingDays,
        isOfflineMode: false,
      };
    } catch (error) {
      return {
        isValid: false,
        isOfflineMode: false,
        error: `Failed to store license: ${error.message}`,
      };
    }
  }

  /**
   * Retrieve and validate stored license
   */
  public async getLicenseStatus(forceOnlineValidation = false): Promise<LicenseStatus> {
    try {
      const storedData = this.store.get('license');
      
      if (!storedData) {
        return {
          isValid: false,
          isOfflineMode: false,
          error: 'No license found',
        };
      }

      // Verify device fingerprint
      const currentDeviceFingerprint = this.validator.getDeviceId();
      if (storedData.deviceFingerprint !== currentDeviceFingerprint) {
        this.store.delete('license');
        return {
          isValid: false,
          isOfflineMode: false,
          error: 'License bound to different device',
        };
      }

      // Decrypt license
      const licenseData = JSON.parse(this.decryptData(storedData.encryptedLicense)) as LicenseData;

      // Check if we need to revalidate
      const lastValidation = new Date(storedData.lastValidation);
      const now = new Date();
      const hoursSinceValidation = (now.getTime() - lastValidation.getTime()) / (1000 * 60 * 60);
      
      const needsValidation = forceOnlineValidation || 
                             hoursSinceValidation >= this.VALIDATION_INTERVAL_HOURS ||
                             storedData.validationAttempts >= this.MAX_VALIDATION_ATTEMPTS;

      if (needsValidation && await this.isOnline()) {
        // Attempt online validation
        return await this.performOnlineValidation(licenseData, storedData);
      }

      // Offline validation
      return this.performOfflineValidation(licenseData, storedData);
    } catch (error) {
      return {
        isValid: false,
        isOfflineMode: false,
        error: `License validation failed: ${error.message}`,
      };
    }
  }

  /**
   * Remove stored license
   */
  public removeLicense(): void {
    this.store.delete('license');
  }

  /**
   * Check if license exists
   */
  public hasLicense(): boolean {
    return this.store.has('license');
  }

  /**
   * Get license information without validation
   */
  public getLicenseInfo(): LicenseData | null {
    try {
      const storedData = this.store.get('license');
      if (!storedData) return null;

      return JSON.parse(this.decryptData(storedData.encryptedLicense)) as LicenseData;
    } catch {
      return null;
    }
  }

  /**
   * Perform online license validation
   */
  private async performOnlineValidation(
    licenseData: LicenseData,
    storedData: StoredLicenseData
  ): Promise<LicenseStatus> {
    try {
      // Validate against current data
      const validationResult = this.validator.validateLicense(licenseData.licenseKey, licenseData.email);
      
      if (validationResult.isValid) {
        // Update last validation time and reset attempts
        const updatedData: StoredLicenseData = {
          ...storedData,
          lastValidation: new Date().toISOString(),
          validationAttempts: 0,
          offlineGracePeriodStart: undefined, // Reset grace period
        };
        this.store.set('license', updatedData);

        return {
          isValid: true,
          license: validationResult.license,
          remainingDays: validationResult.remainingDays,
          isOfflineMode: false,
        };
      } else {
        // Online validation failed - increment attempts
        const updatedData: StoredLicenseData = {
          ...storedData,
          validationAttempts: storedData.validationAttempts + 1,
        };
        this.store.set('license', updatedData);

        // Start grace period if not already started
        if (!storedData.offlineGracePeriodStart) {
          updatedData.offlineGracePeriodStart = new Date().toISOString();
          this.store.set('license', updatedData);
        }

        // Check grace period
        return this.checkGracePeriod(licenseData, updatedData);
      }
    } catch (error) {
      // Network/validation error - treat as offline
      return this.performOfflineValidation(licenseData, storedData);
    }
  }

  /**
   * Perform offline license validation with grace period
   */
  private performOfflineValidation(
    licenseData: LicenseData,
    storedData: StoredLicenseData
  ): Promise<LicenseStatus> {
    // Check basic license validity
    const expirationDate = new Date(licenseData.expirationDate);
    const now = new Date();
    
    if (expirationDate < now) {
      return Promise.resolve({
        isValid: false,
        isOfflineMode: true,
        error: 'License has expired',
      });
    }

    // If we have too many failed validation attempts, start grace period
    if (storedData.validationAttempts >= this.MAX_VALIDATION_ATTEMPTS) {
      if (!storedData.offlineGracePeriodStart) {
        const updatedData: StoredLicenseData = {
          ...storedData,
          offlineGracePeriodStart: new Date().toISOString(),
        };
        this.store.set('license', updatedData);
        return this.checkGracePeriod(licenseData, updatedData);
      } else {
        return this.checkGracePeriod(licenseData, storedData);
      }
    }

    // License is valid for offline use
    const remainingMs = expirationDate.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    return Promise.resolve({
      isValid: true,
      license: licenseData,
      remainingDays,
      isOfflineMode: true,
    });
  }

  /**
   * Check grace period status
   */
  private checkGracePeriod(
    licenseData: LicenseData,
    storedData: StoredLicenseData
  ): Promise<LicenseStatus> {
    if (!storedData.offlineGracePeriodStart) {
      return Promise.resolve({
        isValid: false,
        isOfflineMode: true,
        error: 'License validation required',
      });
    }

    const gracePeriodStart = new Date(storedData.offlineGracePeriodStart);
    const now = new Date();
    const gracePeriodMs = this.OFFLINE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const gracePeriodEnd = new Date(gracePeriodStart.getTime() + gracePeriodMs);

    if (now > gracePeriodEnd) {
      return Promise.resolve({
        isValid: false,
        isOfflineMode: true,
        error: 'Grace period expired. Please connect to internet to validate license.',
      });
    }

    const gracePeriodRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return Promise.resolve({
      isValid: true,
      license: licenseData,
      isOfflineMode: true,
      gracePeriodRemaining,
    });
  }

  /**
   * Check if online (simplified - in production use proper connectivity check)
   */
  private async isOnline(): Promise<boolean> {
    try {
      // Simple connectivity check
      const dns = await import('dns');
      return new Promise((resolve) => {
        dns.lookup('google.com', (err) => {
          resolve(!err);
        });
      });
    } catch {
      return false;
    }
  }

  /**
   * Derive encryption key from device-specific data
   */
  private deriveEncryptionKey(): string {
    const deviceId = this.validator.getDeviceId();
    const appName = 'tacctile-toolbox';
    
    // Create deterministic but device-specific encryption key
    return crypto.pbkdf2Sync(deviceId, appName, 10000, 32, 'sha256').toString('hex');
  }

  /**
   * Encrypt sensitive data
   */
  private encryptData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decryptData(encryptedData: string): string {
    const [ivHex, encrypted] = encryptedData.split(':');
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Export singleton instance
export const licenseStore = new LicenseStore();
export default licenseStore;