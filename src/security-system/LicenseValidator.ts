import { app, net } from 'electron';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { NodeRSA } from 'node-rsa';
import {
  License,
  LicenseType,
  LicenseTier,
  LicenseStatus,
  LicenseLimitation,
} from './types';

export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  error?: string;
  warnings?: string[];
  remainingDays?: number;
  limitations?: LicenseLimitation[];
}

export interface LicenseServerConfig {
  baseUrl: string;
  publicKey: string;
  endpoints: {
    validate: string;
    activate: string;
    deactivate: string;
    heartbeat: string;
  };
  timeout: number;
  retryAttempts: number;
}

export class LicenseValidator extends EventEmitter {
  private licenses: Map<string, License> = new Map(); // userId -> License
  private licensesPath: string;
  private cacheExpiryTime = 24 * 60 * 60 * 1000; // 24 hours
  private lastOnlineValidation = new Date(0);
  private serverConfig: LicenseServerConfig;
  private validationTimer: NodeJS.Timeout | null = null;
  private rsaKey: NodeRSA | null = null;

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.licensesPath = path.join(userDataPath, 'licenses.encrypted');
    
    this.serverConfig = {
      baseUrl: process.env.LICENSE_SERVER_URL || 'https://licensing.tacctile.com',
      publicKey: '', // Will be loaded from config
      endpoints: {
        validate: '/api/v1/license/validate',
        activate: '/api/v1/license/activate',
        deactivate: '/api/v1/license/deactivate',
        heartbeat: '/api/v1/license/heartbeat'
      },
      timeout: 10000, // 10 seconds
      retryAttempts: 3
    };
  }

  public async initialize(): Promise<void> {
    try {
      await this.loadLicensePublicKey();
      await this.loadCachedLicenses();
      this.startPeriodicValidation();
      
      console.log('LicenseValidator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize LicenseValidator:', error);
      throw error;
    }
  }

  public async validateUserLicense(userId: string): Promise<boolean> {
    try {
      const result = await this.validateLicense(userId);
      return result.valid;
    } catch (error) {
      console.error('License validation error:', error);
      return false;
    }
  }

  public async validateLicense(userId: string): Promise<LicenseValidationResult> {
    try {
      // Check cached license first
      const cachedLicense = this.licenses.get(userId);
      
      if (cachedLicense) {
        // Validate cached license
        const cacheResult = this.validateCachedLicense(cachedLicense);
        
        // If cache is still valid and license is active, return it
        if (cacheResult.valid && this.isCacheValid(cachedLicense)) {
          return cacheResult;
        }
      }

      // Try online validation
      try {
        const onlineResult = await this.validateLicenseOnline(userId, cachedLicense);
        if (onlineResult.valid && onlineResult.license) {
          // Cache the validated license
          await this.cacheLicense(onlineResult.license);
          this.lastOnlineValidation = new Date();
        }
        return onlineResult;
      } catch (onlineError) {
        console.warn('Online license validation failed, falling back to cache:', onlineError);
        
        // Fall back to cached license if online fails
        if (cachedLicense) {
          const offlineResult = this.validateLicenseOffline(cachedLicense);
          offlineResult.warnings = offlineResult.warnings || [];
          offlineResult.warnings.push('Using offline license validation - online validation failed');
          return offlineResult;
        }
      }

      // No valid license found
      return {
        valid: false,
        error: 'No valid license found for user'
      };

    } catch (error) {
      console.error('License validation error:', error);
      return {
        valid: false,
        error: `License validation failed: ${error.message}`
      };
    }
  }

  public async activateLicense(licenseKey: string, userId: string): Promise<LicenseValidationResult> {
    try {
      console.log(`Activating license for user ${userId}`);
      
      // Validate license key format
      if (!this.isValidLicenseKeyFormat(licenseKey)) {
        return {
          valid: false,
          error: 'Invalid license key format'
        };
      }

      // Try online activation first
      try {
        const onlineResult = await this.activateLicenseOnline(licenseKey, userId);
        if (onlineResult.valid && onlineResult.license) {
          await this.cacheLicense(onlineResult.license);
          this.emit('license-activated', onlineResult.license);
        }
        return onlineResult;
      } catch (onlineError) {
        console.warn('Online license activation failed:', onlineError);
        
        // Try offline activation for trial or development licenses
        const offlineResult = await this.activateLicenseOffline(licenseKey, userId);
        if (offlineResult.valid && offlineResult.license) {
          await this.cacheLicense(offlineResult.license);
          offlineResult.warnings = offlineResult.warnings || [];
          offlineResult.warnings.push('License activated offline - online validation recommended');
        }
        return offlineResult;
      }

    } catch (error) {
      console.error('License activation error:', error);
      return {
        valid: false,
        error: `License activation failed: ${error.message}`
      };
    }
  }

  public async deactivateLicense(userId: string): Promise<boolean> {
    try {
      const license = this.licenses.get(userId);
      if (!license) {
        return false;
      }

      // Try online deactivation
      try {
        await this.deactivateLicenseOnline(license);
      } catch (onlineError) {
        console.warn('Online license deactivation failed:', onlineError);
      }

      // Remove from cache
      this.licenses.delete(userId);
      await this.saveLicenseCache();

      this.emit('license-deactivated', license);
      console.log(`License deactivated for user ${userId}`);
      
      return true;
    } catch (error) {
      console.error('License deactivation error:', error);
      return false;
    }
  }

  public async getLicense(userId: string): Promise<License | null> {
    return this.licenses.get(userId) || null;
  }

  public async checkFeatureAccess(userId: string, featureName: string): Promise<boolean> {
    try {
      const license = this.licenses.get(userId);
      if (!license || license.status !== 'active') {
        return false;
      }

      // Check if feature is included
      return license.features.includes(featureName) || license.features.includes('*');
    } catch (error) {
      console.error('Feature access check error:', error);
      return false;
    }
  }

  public async checkLicenseLimitation(userId: string, limitationType: string): Promise<{
    allowed: boolean;
    limit?: number;
    current?: number;
    remaining?: number;
  }> {
    try {
      const license = this.licenses.get(userId);
      if (!license || license.status !== 'active') {
        return { allowed: false };
      }

      const limitation = license.limitations.find(l => l.type === limitationType);
      if (!limitation) {
        return { allowed: true }; // No limitation for this type
      }

      const remaining = limitation.limit - limitation.current;
      return {
        allowed: remaining > 0,
        limit: limitation.limit,
        current: limitation.current,
        remaining
      };
    } catch (error) {
      console.error('License limitation check error:', error);
      return { allowed: false };
    }
  }

  public async incrementUsage(userId: string, limitationType: string, amount = 1): Promise<boolean> {
    try {
      const license = this.licenses.get(userId);
      if (!license) {
        return false;
      }

      const limitation = license.limitations.find(l => l.type === limitationType);
      if (limitation) {
        limitation.current += amount;
        await this.saveLicenseCache();
        
        // Emit warning if approaching limit
        const remaining = limitation.limit - limitation.current;
        const warningThreshold = Math.max(1, Math.floor(limitation.limit * 0.1)); // 10% warning
        
        if (remaining <= warningThreshold) {
          this.emit('license-limit-warning', {
            userId,
            limitationType,
            remaining,
            limit: limitation.limit
          });
        }
      }

      return true;
    } catch (error) {
      console.error('Usage increment error:', error);
      return false;
    }
  }

  public getLicenseInfo(userId: string): {
    hasLicense: boolean;
    isValid: boolean;
    type?: LicenseType;
    tier?: LicenseTier;
    status?: LicenseStatus;
    expiresAt?: Date;
    daysRemaining?: number;
    features?: string[];
    limitations?: LicenseLimitation[];
  } {
    const license = this.licenses.get(userId);
    
    if (!license) {
      return {
        hasLicense: false,
        isValid: false
      };
    }

    const now = new Date();
    const isValid = license.status === 'active' && 
                   (!license.expiresAt || license.expiresAt > now);
    
    let daysRemaining: number | undefined;
    if (license.expiresAt) {
      daysRemaining = Math.ceil((license.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      daysRemaining = Math.max(0, daysRemaining);
    }

    return {
      hasLicense: true,
      isValid,
      type: license.type,
      tier: license.tier,
      status: license.status,
      expiresAt: license.expiresAt,
      daysRemaining,
      features: license.features,
      limitations: license.limitations
    };
  }

  public async generateTrialLicense(userId: string, durationDays = 30): Promise<License | null> {
    try {
      const trialId = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + (durationDays * 24 * 60 * 60 * 1000));

      const trialLicense: License = {
        id: trialId,
        userId,
        licenseKey: `TRIAL-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
        type: 'trial',
        tier: 'professional',
        status: 'active',
        features: this.getTrialFeatures(),
        limitations: this.getTrialLimitations(),
        issuedAt: now,
        activatedAt: now,
        expiresAt,
        maxDevices: 1,
        currentDevices: 1,
        metadata: {
          trialDurationDays: durationDays,
          generatedOffline: true
        }
      };

      await this.cacheLicense(trialLicense);
      this.emit('trial-license-generated', trialLicense);
      
      console.log(`Trial license generated for user ${userId}: ${durationDays} days`);
      return trialLicense;
    } catch (error) {
      console.error('Trial license generation error:', error);
      return null;
    }
  }

  private validateCachedLicense(license: License): LicenseValidationResult {
    const now = new Date();
    const warnings: string[] = [];

    // Check license status
    if (license.status !== 'active') {
      return {
        valid: false,
        license,
        error: `License status is ${license.status}`
      };
    }

    // Check expiration
    if (license.expiresAt && now > license.expiresAt) {
      return {
        valid: false,
        license,
        error: 'License has expired'
      };
    }

    // Check if expiring soon
    if (license.expiresAt) {
      const daysRemaining = Math.ceil((license.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      if (daysRemaining <= 7) {
        warnings.push(`License expires in ${daysRemaining} days`);
      }
    }

    // Check device limits
    if (license.currentDevices >= license.maxDevices) {
      warnings.push('Device limit reached');
    }

    return {
      valid: true,
      license,
      warnings,
      remainingDays: license.expiresAt ? 
        Math.ceil((license.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : undefined,
      limitations: license.limitations
    };
  }

  private validateLicenseOffline(license: License): LicenseValidationResult {
    const result = this.validateCachedLicense(license);
    
    // Add offline-specific warnings
    if (result.valid) {
      result.warnings = result.warnings || [];
      result.warnings.push('Offline validation - features may be limited');
      
      // Check if offline grace period is exceeded
      const offlineGracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
      const timeSinceLastOnline = Date.now() - this.lastOnlineValidation.getTime();
      
      if (timeSinceLastOnline > offlineGracePeriod) {
        result.warnings.push('Extended offline period - online validation required soon');
      }
    }

    return result;
  }

  private async validateLicenseOnline(userId: string, cachedLicense?: License): Promise<LicenseValidationResult> {
    const validateUrl = new URL(this.serverConfig.endpoints.validate, this.serverConfig.baseUrl);
    
    const requestData = {
      userId,
      licenseKey: cachedLicense?.licenseKey,
      deviceId: await this.getDeviceId(),
      appVersion: app.getVersion(),
      platform: process.platform
    };

    const response = await this.makeHttpRequest('POST', validateUrl.toString(), requestData);
    
    if (response.valid && response.license) {
      const license = this.parseLicenseResponse(response.license);
      return {
        valid: true,
        license,
        remainingDays: license.expiresAt ? 
          Math.ceil((license.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : undefined,
        limitations: license.limitations
      };
    }

    return {
      valid: false,
      error: response.error || 'License validation failed'
    };
  }

  private async activateLicenseOnline(licenseKey: string, userId: string): Promise<LicenseValidationResult> {
    const activateUrl = new URL(this.serverConfig.endpoints.activate, this.serverConfig.baseUrl);
    
    const requestData = {
      licenseKey,
      userId,
      deviceId: await this.getDeviceId(),
      deviceInfo: await this.getDeviceInfo(),
      appVersion: app.getVersion(),
      platform: process.platform
    };

    const response = await this.makeHttpRequest('POST', activateUrl.toString(), requestData);
    
    if (response.success && response.license) {
      const license = this.parseLicenseResponse(response.license);
      return {
        valid: true,
        license,
        remainingDays: license.expiresAt ? 
          Math.ceil((license.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : undefined
      };
    }

    return {
      valid: false,
      error: response.error || 'License activation failed'
    };
  }

  private async activateLicenseOffline(licenseKey: string, userId: string): Promise<LicenseValidationResult> {
    // Only allow trial and development licenses for offline activation
    if (!licenseKey.startsWith('TRIAL-') && !licenseKey.startsWith('DEV-')) {
      return {
        valid: false,
        error: 'Only trial and development licenses can be activated offline'
      };
    }

    if (licenseKey.startsWith('TRIAL-')) {
      const trialLicense = await this.generateTrialLicense(userId, 30);
      if (trialLicense) {
        return {
          valid: true,
          license: trialLicense,
          warnings: ['Trial license activated offline'],
          remainingDays: 30
        };
      }
    }

    return {
      valid: false,
      error: 'Offline license activation failed'
    };
  }

  private async deactivateLicenseOnline(license: License): Promise<void> {
    const deactivateUrl = new URL(this.serverConfig.endpoints.deactivate, this.serverConfig.baseUrl);
    
    const requestData = {
      licenseKey: license.licenseKey,
      userId: license.userId,
      deviceId: await this.getDeviceId()
    };

    await this.makeHttpRequest('POST', deactivateUrl.toString(), requestData);
  }

  private async makeHttpRequest(method: string, url: string, data?: Record<string, unknown>): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method,
        url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `Ghost Hunter Toolbox/${app.getVersion()}`,
          'X-Client-Version': app.getVersion(),
          'X-Client-Platform': process.platform
        }
      });

      let responseData = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });

        response.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(parsedData.error || `HTTP ${response.statusCode}`));
            }
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      if (data) {
        request.write(JSON.stringify(data));
      }

      request.end();

      // Set timeout
      setTimeout(() => {
        request.abort();
        reject(new Error('Request timeout'));
      }, this.serverConfig.timeout);
    });
  }

  private parseLicenseResponse(licenseData: Record<string, unknown>): License {
    return {
      id: licenseData.id,
      userId: licenseData.userId,
      licenseKey: licenseData.licenseKey,
      type: licenseData.type,
      tier: licenseData.tier,
      status: licenseData.status,
      features: licenseData.features || [],
      limitations: licenseData.limitations || [],
      issuedAt: new Date(licenseData.issuedAt),
      activatedAt: licenseData.activatedAt ? new Date(licenseData.activatedAt) : null,
      expiresAt: licenseData.expiresAt ? new Date(licenseData.expiresAt) : null,
      maxDevices: licenseData.maxDevices || 1,
      currentDevices: licenseData.currentDevices || 0,
      organizationId: licenseData.organizationId,
      metadata: licenseData.metadata || {}
    };
  }

  private isValidLicenseKeyFormat(licenseKey: string): boolean {
    // Expected formats:
    // TRIAL-XXXXXXXX
    // DEV-XXXXXXXX  
    // XXXX-XXXX-XXXX-XXXX (standard)
    const formats = [
      /^TRIAL-[A-F0-9]{16}$/,
      /^DEV-[A-F0-9]{16}$/,
      /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/
    ];

    return formats.some(format => format.test(licenseKey.toUpperCase()));
  }

  private isCacheValid(license: License): boolean {
    // Cache is considered valid if it's less than cacheExpiryTime old
    const cacheAge = Date.now() - (license.metadata?.lastValidated || 0);
    return cacheAge < this.cacheExpiryTime;
  }

  private async cacheLicense(license: License): Promise<void> {
    // Add cache metadata
    license.metadata = license.metadata || {};
    license.metadata.lastValidated = Date.now();
    license.metadata.cacheVersion = '1.0';

    this.licenses.set(license.userId, license);
    await this.saveLicenseCache();
  }

  private async loadCachedLicenses(): Promise<void> {
    try {
      await fs.access(this.licensesPath);
      const encryptedData = await fs.readFile(this.licensesPath, 'utf8');
      // For now, assume data is JSON encoded (would be encrypted in production)
      const licensesData = JSON.parse(encryptedData);
      
      for (const licenseData of licensesData) {
        const license = this.parseLicenseResponse(licenseData);
        this.licenses.set(license.userId, license);
      }

      console.log(`Loaded ${this.licenses.size} cached licenses`);
    } catch (error) {
      console.log('No cached licenses found, starting fresh');
    }
  }

  private async saveLicenseCache(): Promise<void> {
    try {
      const licensesData = Array.from(this.licenses.values());
      // For now, save as JSON (would be encrypted in production)
      await fs.writeFile(this.licensesPath, JSON.stringify(licensesData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save license cache:', error);
    }
  }

  private async loadLicensePublicKey(): Promise<void> {
    try {
      const keyPath = path.join(__dirname, '../../assets/keys/license-public.pem');
      const publicKeyData = await fs.readFile(keyPath, 'utf8');
      this.serverConfig.publicKey = publicKeyData;
      this.rsaKey = new NodeRSA(publicKeyData);
    } catch (error) {
      console.warn('License public key not found, generating placeholder');
      // Generate placeholder key for development
      this.rsaKey = new NodeRSA({ b: 2048 });
      this.serverConfig.publicKey = this.rsaKey.exportKey('public');
    }
  }

  private async getDeviceId(): Promise<string> {
    const machineInfo = [
      os.platform(),
      os.arch(),
      os.hostname(),
      os.cpus()[0]?.model || 'unknown'
    ].join('|');
    
    return crypto.createHash('sha256').update(machineInfo).digest('hex');
  }

  private async getDeviceInfo(): Promise<Record<string, unknown>> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) // GB
    };
  }

  private getTrialFeatures(): string[] {
    return [
      'evidence_upload',
      'basic_analysis',
      'report_generation',
      'case_management',
      'audio_analysis',
      'image_processing'
    ];
  }

  private getTrialLimitations(): LicenseLimitation[] {
    return [
      { type: 'cases', limit: 5, current: 0 },
      { type: 'evidence', limit: 50, current: 0 },
      { type: 'storage', limit: 1024 * 1024 * 1024, current: 0 }, // 1GB
      { type: 'exports', limit: 10, current: 0 }
    ];
  }

  private startPeriodicValidation(): void {
    // Validate licenses every 6 hours
    this.validationTimer = setInterval(async () => {
      try {
        for (const [userId] of this.licenses) {
          await this.validateLicense(userId);
        }
      } catch (error) {
        console.error('Periodic license validation error:', error);
      }
    }, 6 * 60 * 60 * 1000);
  }

  public destroy(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }

    this.removeAllListeners();
    console.log('LicenseValidator destroyed');
  }
}