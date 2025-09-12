/**
 * Encrypted License Manager
 * Handles encrypted license file generation, validation, and secure storage
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import * as NodeRSA from 'node-rsa';
import * as forge from 'node-forge';
import * as argon2 from 'argon2';
import {
  LicenseInfo,
  ValidationRequest,
  ValidationResponse,
  ValidationError,
  ValidationWarning,
  EncryptedOfflineLicense,
  LicenseStatus,
  EncryptionConfiguration,
  GracePeriodInfo,
  GracePeriodReason
} from './types';

export interface EncryptedLicenseData {
  signature: string;
  payload: string;
  timestamp: number;
  version: string;
  algorithm: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  license?: LicenseInfo;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  gracePeriod?: GracePeriodInfo;
  nextCheck?: Date;
}

export class EncryptedLicenseManager extends EventEmitter {
  private licenseCache: Map<string, LicenseInfo> = new Map();
  private validationCache: Map<string, ValidationResponse> = new Map();
  private offlineLicenseData: EncryptedOfflineLicense | null = null;
  private privateKey: NodeRSA | null = null;
  private publicKey: NodeRSA | null = null;
  private encryptionConfig: EncryptionConfiguration;
  private licensePath: string;
  private keyPath: string;
  private initialized = false;

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.licensePath = path.join(userDataPath, 'licenses');
    this.keyPath = path.join(userDataPath, 'keys');
    
    this.encryptionConfig = {
      algorithm: 'AES-256-GCM',
      keyDerivation: 'Argon2id',
      keyIterations: 100000,
      saltSize: 32,
      ivSize: 16,
      tagSize: 16,
      compressionEnabled: true
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('EncryptedLicenseManager already initialized');
      return;
    }

    try {
      console.log('Initializing EncryptedLicenseManager...');
      
      await fs.mkdir(this.licensePath, { recursive: true });
      await fs.mkdir(this.keyPath, { recursive: true });
      
      await this.initializeKeys();
      await this.loadLicenses();
      await this.loadOfflineLicense();
      
      this.initialized = true;
      console.log('EncryptedLicenseManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize EncryptedLicenseManager:', error);
      throw error;
    }
  }

  /**
   * Generate encrypted license file from license data
   */
  public async generateLicenseFile(
    license: LicenseInfo,
    outputPath: string,
    serverPrivateKey?: string
  ): Promise<EncryptedLicenseData> {
    this.ensureInitialized();

    try {
      // Create license payload
      const payload = {
        license,
        generatedAt: new Date().toISOString(),
        issuer: 'Ghost Hunter Toolbox License Server',
        version: '1.0.0'
      };

      // Serialize and compress payload if enabled
      let serializedPayload = JSON.stringify(payload);
      if (this.encryptionConfig.compressionEnabled) {
        serializedPayload = await this.compressData(serializedPayload);
      }

      // Encrypt the payload
      const encryptedPayload = await this.encryptData(serializedPayload, license.key);

      // Create signature using private key
      const signatureKey = serverPrivateKey ? 
        new NodeRSA(serverPrivateKey, 'private') : 
        this.privateKey!;
      
      const signature = signatureKey.sign(serializedPayload, 'hex');

      const encryptedLicense: EncryptedLicenseData = {
        signature,
        payload: encryptedPayload,
        timestamp: Date.now(),
        version: '1.0.0',
        algorithm: this.encryptionConfig.algorithm
      };

      // Save to file
      await fs.writeFile(outputPath, JSON.stringify(encryptedLicense, null, 2), 'utf8');
      
      console.log(`Encrypted license generated: ${outputPath}`);
      this.emit('license-generated', { licenseId: license.id, path: outputPath });
      
      return encryptedLicense;
    } catch (error) {
      console.error('Failed to generate license file:', error);
      throw new Error(`License generation failed: ${error.message}`);
    }
  }

  /**
   * Load and validate encrypted license file
   */
  public async loadLicenseFile(
    filePath: string,
    licenseKey?: string,
    serverPublicKey?: string
  ): Promise<LicenseValidationResult> {
    this.ensureInitialized();

    try {
      // Read encrypted license file
      const fileContent = await fs.readFile(filePath, 'utf8');
      const encryptedLicense: EncryptedLicenseData = JSON.parse(fileContent);

      return await this.validateEncryptedLicense(encryptedLicense, licenseKey, serverPublicKey);
    } catch (error) {
      console.error('Failed to load license file:', error);
      return {
        valid: false,
        errors: [{
          code: 'LOAD_ERROR',
          message: `Failed to load license file: ${error.message}`,
          recoverable: false
        }],
        warnings: []
      };
    }
  }

  /**
   * Validate encrypted license data
   */
  public async validateEncryptedLicense(
    encryptedLicense: EncryptedLicenseData,
    licenseKey?: string,
    serverPublicKey?: string
  ): Promise<LicenseValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Validate license structure
      if (!encryptedLicense.signature || !encryptedLicense.payload) {
        errors.push({
          code: 'INVALID_FORMAT',
          message: 'License file format is invalid',
          recoverable: false
        });
        return { valid: false, errors, warnings };
      }

      // Check algorithm support
      if (encryptedLicense.algorithm !== this.encryptionConfig.algorithm) {
        warnings.push({
          code: 'ALGORITHM_MISMATCH',
          message: `License uses ${encryptedLicense.algorithm}, expected ${this.encryptionConfig.algorithm}`,
        });
      }

      // Decrypt payload
      let decryptedPayload: string;
      try {
        decryptedPayload = await this.decryptData(encryptedLicense.payload, licenseKey);
      } catch (error) {
        errors.push({
          code: 'DECRYPTION_FAILED',
          message: 'Failed to decrypt license payload',
          details: error.message,
          recoverable: licenseKey ? false : true
        });
        return { valid: false, errors, warnings };
      }

      // Decompress if needed
      if (this.encryptionConfig.compressionEnabled) {
        try {
          decryptedPayload = await this.decompressData(decryptedPayload);
        } catch (error) {
          warnings.push({
            code: 'DECOMPRESSION_FAILED',
            message: 'Failed to decompress payload, proceeding without decompression'
          });
        }
      }

      // Verify signature
      const verificationKey = serverPublicKey ? 
        new NodeRSA(serverPublicKey, 'public') : 
        this.publicKey!;

      const signatureValid = verificationKey.verify(decryptedPayload, encryptedLicense.signature, 'utf8', 'hex');
      if (!signatureValid) {
        errors.push({
          code: 'INVALID_SIGNATURE',
          message: 'License signature verification failed',
          recoverable: false
        });
        return { valid: false, errors, warnings };
      }

      // Parse license data
      const licenseData = JSON.parse(decryptedPayload);
      const license: LicenseInfo = licenseData.license;

      // Validate license content
      const contentValidation = await this.validateLicenseContent(license);
      errors.push(...contentValidation.errors);
      warnings.push(...contentValidation.warnings);

      if (errors.length > 0) {
        return { valid: false, errors, warnings, license };
      }

      // Cache valid license
      this.licenseCache.set(license.key, license);
      this.emit('license-validated', license);

      return {
        valid: true,
        license,
        errors,
        warnings,
        gracePeriod: contentValidation.gracePeriod,
        nextCheck: this.calculateNextCheck(license)
      };

    } catch (error) {
      console.error('License validation error:', error);
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `License validation failed: ${error.message}`,
        recoverable: false
      });
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Validate license content and business rules
   */
  private async validateLicenseContent(license: LicenseInfo): Promise<{
    errors: ValidationError[];
    warnings: ValidationWarning[];
    gracePeriod?: GracePeriodInfo;
  }> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let gracePeriod: GracePeriodInfo | undefined;

    // Check required fields
    if (!license.id || !license.key || !license.type) {
      errors.push({
        code: 'MISSING_FIELDS',
        message: 'License missing required fields',
        recoverable: false
      });
    }

    // Check expiration
    const now = new Date();
    if (license.expiresAt && new Date(license.expiresAt) < now) {
      const daysExpired = Math.floor((now.getTime() - new Date(license.expiresAt).getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysExpired <= license.gracePeriodDays) {
        // Still in grace period
        gracePeriod = {
          active: true,
          remainingDays: license.gracePeriodDays - daysExpired,
          reason: GracePeriodReason.LICENSE_RENEWAL,
          startedAt: new Date(license.expiresAt),
          endsAt: new Date(new Date(license.expiresAt).getTime() + (license.gracePeriodDays * 24 * 60 * 60 * 1000))
        };
        
        warnings.push({
          code: 'GRACE_PERIOD',
          message: `License expired but in grace period (${gracePeriod.remainingDays} days remaining)`,
          details: gracePeriod
        });
      } else {
        errors.push({
          code: 'LICENSE_EXPIRED',
          message: `License expired ${daysExpired} days ago`,
          details: { expiredDate: license.expiresAt, daysExpired },
          recoverable: true
        });
      }
    }

    // Check activation
    if (!license.activatedAt) {
      errors.push({
        code: 'NOT_ACTIVATED',
        message: 'License not activated',
        recoverable: true
      });
    }

    // Check status
    if (license.status === LicenseStatus.REVOKED) {
      errors.push({
        code: 'LICENSE_REVOKED',
        message: 'License has been revoked',
        recoverable: false
      });
    } else if (license.status === LicenseStatus.SUSPENDED) {
      errors.push({
        code: 'LICENSE_SUSPENDED',
        message: 'License is suspended',
        recoverable: true
      });
    }

    // Check seat limits
    if (license.currentSeats > license.maxSeats) {
      errors.push({
        code: 'SEAT_LIMIT_EXCEEDED',
        message: `Seat limit exceeded (${license.currentSeats}/${license.maxSeats})`,
        recoverable: true
      });
    }

    // Check offline validation period
    if (license.lastOnlineValidation) {
      const daysSinceValidation = Math.floor((now.getTime() - new Date(license.lastOnlineValidation).getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceValidation > license.allowOfflineDays) {
        errors.push({
          code: 'OFFLINE_PERIOD_EXCEEDED',
          message: `Offline validation period exceeded (${daysSinceValidation} days)`,
          details: { lastValidation: license.lastOnlineValidation, allowedDays: license.allowOfflineDays },
          recoverable: true
        });
      } else if (daysSinceValidation > license.allowOfflineDays * 0.8) {
        warnings.push({
          code: 'OFFLINE_PERIOD_WARNING',
          message: `Approaching offline validation limit (${daysSinceValidation}/${license.allowOfflineDays} days)`
        });
      }
    }

    return { errors, warnings, gracePeriod };
  }

  /**
   * Create offline license for extended offline usage
   */
  public async createOfflineLicense(
    license: LicenseInfo,
    validityDays: number = 7
  ): Promise<EncryptedOfflineLicense> {
    this.ensureInitialized();

    try {
      const expiresAt = new Date(Date.now() + (validityDays * 24 * 60 * 60 * 1000));
      
      const offlineData = {
        license,
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        validityDays,
        issuer: 'Ghost Hunter Toolbox Offline License',
        machineBinding: true
      };

      const serializedData = JSON.stringify(offlineData);
      const encryptedData = await this.encryptData(serializedData, license.key);
      const signature = this.privateKey!.sign(serializedData, 'hex');

      const offlineLicense: EncryptedOfflineLicense = {
        data: encryptedData,
        signature,
        expiresAt,
        issuer: 'Ghost Hunter Toolbox',
        algorithm: this.encryptionConfig.algorithm
      };

      // Save offline license
      this.offlineLicenseData = offlineLicense;
      await this.saveOfflineLicense();

      console.log(`Offline license created, valid until: ${expiresAt.toISOString()}`);
      this.emit('offline-license-created', offlineLicense);

      return offlineLicense;
    } catch (error) {
      console.error('Failed to create offline license:', error);
      throw new Error(`Offline license creation failed: ${error.message}`);
    }
  }

  /**
   * Validate offline license
   */
  public async validateOfflineLicense(licenseKey?: string): Promise<LicenseValidationResult> {
    if (!this.offlineLicenseData) {
      return {
        valid: false,
        errors: [{
          code: 'NO_OFFLINE_LICENSE',
          message: 'No offline license available',
          recoverable: true
        }],
        warnings: []
      };
    }

    try {
      // Check expiration
      if (new Date() > this.offlineLicenseData.expiresAt) {
        return {
          valid: false,
          errors: [{
            code: 'OFFLINE_LICENSE_EXPIRED',
            message: 'Offline license has expired',
            recoverable: true
          }],
          warnings: []
        };
      }

      // Decrypt and validate
      const decryptedData = await this.decryptData(this.offlineLicenseData.data, licenseKey);
      const signatureValid = this.publicKey!.verify(decryptedData, this.offlineLicenseData.signature, 'utf8', 'hex');

      if (!signatureValid) {
        return {
          valid: false,
          errors: [{
            code: 'INVALID_OFFLINE_SIGNATURE',
            message: 'Offline license signature invalid',
            recoverable: false
          }],
          warnings: []
        };
      }

      const offlineData = JSON.parse(decryptedData);
      const license: LicenseInfo = offlineData.license;

      return {
        valid: true,
        license,
        errors: [],
        warnings: [{
          code: 'OFFLINE_MODE',
          message: 'Running in offline mode'
        }],
        nextCheck: this.offlineLicenseData.expiresAt
      };

    } catch (error) {
      console.error('Offline license validation failed:', error);
      return {
        valid: false,
        errors: [{
          code: 'OFFLINE_VALIDATION_ERROR',
          message: `Offline validation failed: ${error.message}`,
          recoverable: false
        }],
        warnings: []
      };
    }
  }

  // Private helper methods
  private async initializeKeys(): Promise<void> {
    const privateKeyPath = path.join(this.keyPath, 'private.pem');
    const publicKeyPath = path.join(this.keyPath, 'public.pem');

    try {
      // Try to load existing keys
      const [privateKeyData, publicKeyData] = await Promise.all([
        fs.readFile(privateKeyPath, 'utf8').catch(() => null),
        fs.readFile(publicKeyPath, 'utf8').catch(() => null)
      ]);

      if (privateKeyData && publicKeyData) {
        this.privateKey = new NodeRSA(privateKeyData, 'private');
        this.publicKey = new NodeRSA(publicKeyData, 'public');
        console.log('Existing RSA keys loaded');
      } else {
        // Generate new keys
        const key = new NodeRSA({ b: 2048 });
        this.privateKey = key;
        this.publicKey = new NodeRSA(key.exportKey('public'), 'public');

        // Save keys
        await Promise.all([
          fs.writeFile(privateKeyPath, this.privateKey.exportKey('private'), 'utf8'),
          fs.writeFile(publicKeyPath, this.publicKey.exportKey('public'), 'utf8')
        ]);

        console.log('New RSA keys generated and saved');
      }
    } catch (error) {
      console.error('Failed to initialize keys:', error);
      throw error;
    }
  }

  private async loadLicenses(): Promise<void> {
    try {
      const licensesFile = path.join(this.licensePath, 'licenses.json');
      const data = await fs.readFile(licensesFile, 'utf8');
      const licenses: LicenseInfo[] = JSON.parse(data);

      for (const license of licenses) {
        this.licenseCache.set(license.key, license);
      }

      console.log(`Loaded ${licenses.length} cached licenses`);
    } catch (error) {
      // No existing licenses file
      console.log('No existing licenses cache found');
    }
  }

  private async saveLicenses(): Promise<void> {
    try {
      const licensesFile = path.join(this.licensePath, 'licenses.json');
      const licenses = Array.from(this.licenseCache.values());
      await fs.writeFile(licensesFile, JSON.stringify(licenses, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save licenses cache:', error);
    }
  }

  private async loadOfflineLicense(): Promise<void> {
    try {
      const offlineFile = path.join(this.licensePath, 'offline.json');
      const data = await fs.readFile(offlineFile, 'utf8');
      this.offlineLicenseData = JSON.parse(data);
      
      // Convert date strings back to Date objects
      if (this.offlineLicenseData) {
        this.offlineLicenseData.expiresAt = new Date(this.offlineLicenseData.expiresAt);
      }

      console.log('Offline license loaded');
    } catch (error) {
      // No offline license
      console.log('No offline license found');
    }
  }

  private async saveOfflineLicense(): Promise<void> {
    if (!this.offlineLicenseData) return;

    try {
      const offlineFile = path.join(this.licensePath, 'offline.json');
      await fs.writeFile(offlineFile, JSON.stringify(this.offlineLicenseData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save offline license:', error);
    }
  }

  private async encryptData(data: string, password?: string): Promise<string> {
    const key = password ? 
      await this.deriveKeyFromPassword(password) : 
      crypto.randomBytes(32);

    const iv = crypto.randomBytes(this.encryptionConfig.ivSize);
    const cipher = crypto.createCipherGCM('aes-256-gcm');
    cipher.setIVNoLength(iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    const result = {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      salt: password ? (await this.getPasswordSalt(password)).toString('hex') : null
    };

    return Buffer.from(JSON.stringify(result)).toString('base64');
  }

  private async decryptData(encryptedData: string, password?: string): Promise<string> {
    const data = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
    
    const key = password && data.salt ? 
      await this.deriveKeyFromPassword(password, Buffer.from(data.salt, 'hex')) :
      crypto.randomBytes(32);

    const decipher = crypto.createDecipherGCM('aes-256-gcm');
    decipher.setIVNoLength(Buffer.from(data.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(data.tag, 'hex'));

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  private async deriveKeyFromPassword(password: string, salt?: Buffer): Promise<Buffer> {
    const actualSalt = salt || await this.getPasswordSalt(password);
    
    if (this.encryptionConfig.keyDerivation === 'Argon2id') {
      const hash = await argon2.hash(password, {
        salt: actualSalt,
        hashLength: 32,
        timeCost: 3,
        memoryCost: 65536, // 64 MB
        parallelism: 4,
        type: argon2.argon2id,
        raw: true
      });
      return Buffer.from(hash);
    } else {
      return crypto.pbkdf2Sync(password, actualSalt, this.encryptionConfig.keyIterations, 32, 'sha256');
    }
  }

  private async getPasswordSalt(password: string): Promise<Buffer> {
    // Generate deterministic salt from password for consistency
    return crypto.createHash('sha256').update(password + 'ghost-hunter-salt').digest();
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression using zlib would be implemented here
    // For now, return as-is
    return data;
  }

  private async decompressData(data: string): Promise<string> {
    // Simple decompression using zlib would be implemented here
    // For now, return as-is
    return data;
  }

  private calculateNextCheck(license: LicenseInfo): Date {
    const baseInterval = 24 * 60 * 60 * 1000; // 24 hours
    let interval = baseInterval;

    // Adjust interval based on license type and status
    switch (license.type) {
      case 'trial':
        interval = 4 * 60 * 60 * 1000; // 4 hours for trial
        break;
      case 'personal':
        interval = 24 * 60 * 60 * 1000; // 24 hours
        break;
      case 'professional':
        interval = 48 * 60 * 60 * 1000; // 48 hours
        break;
      case 'enterprise':
        interval = 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case 'lifetime':
        interval = 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
    }

    return new Date(Date.now() + interval);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('EncryptedLicenseManager not initialized. Call initialize() first.');
    }
  }

  // Public getters
  public getCachedLicense(licenseKey: string): LicenseInfo | null {
    return this.licenseCache.get(licenseKey) || null;
  }

  public getAllCachedLicenses(): LicenseInfo[] {
    return Array.from(this.licenseCache.values());
  }

  public hasOfflineLicense(): boolean {
    return this.offlineLicenseData !== null && new Date() < this.offlineLicenseData.expiresAt;
  }

  public getPublicKey(): string | null {
    return this.publicKey ? this.publicKey.exportKey('public') : null;
  }

  public clearCache(): void {
    this.licenseCache.clear();
    this.validationCache.clear();
    this.emit('cache-cleared');
  }

  public async destroy(): Promise<void> {
    await this.saveLicenses();
    await this.saveOfflineLicense();
    this.clearCache();
    this.removeAllListeners();
    this.initialized = false;
    console.log('EncryptedLicenseManager destroyed');
  }
}