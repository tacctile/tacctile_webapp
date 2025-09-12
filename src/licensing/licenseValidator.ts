/**
 * License Key Validation System for Ghost Hunter Toolbox
 * Uses cryptographic signatures to validate license keys
 */

import crypto from 'crypto';
import { machineIdSync } from 'node-machine-id';

export interface LicenseData {
  email: string;
  licenseKey: string;
  type: 'trial' | 'basic' | 'professional' | 'enterprise';
  expirationDate: string;
  features: string[];
  deviceId: string;
  issuedAt: string;
  signature: string;
}

export interface LicenseValidationResult {
  isValid: boolean;
  license?: LicenseData;
  error?: string;
  remainingDays?: number;
}

export interface LicenseFeatures {
  maxInvestigations: number;
  maxEvidenceFiles: number;
  maxTeamMembers: number;
  cloudSync: boolean;
  advancedAnalytics: boolean;
  customReports: boolean;
  pluginSupport: boolean;
  prioritySupport: boolean;
  whiteLabel: boolean;
}

export class LicenseValidator {
  private readonly publicKey: string;
  private readonly privateKey?: string; // Only available for license generation
  
  // License feature configurations
  private readonly FEATURE_SETS: Record<string, LicenseFeatures> = {
    trial: {
      maxInvestigations: 3,
      maxEvidenceFiles: 50,
      maxTeamMembers: 1,
      cloudSync: false,
      advancedAnalytics: false,
      customReports: false,
      pluginSupport: false,
      prioritySupport: false,
      whiteLabel: false,
    },
    basic: {
      maxInvestigations: 25,
      maxEvidenceFiles: 500,
      maxTeamMembers: 3,
      cloudSync: true,
      advancedAnalytics: false,
      customReports: false,
      pluginSupport: true,
      prioritySupport: false,
      whiteLabel: false,
    },
    professional: {
      maxInvestigations: 100,
      maxEvidenceFiles: 2000,
      maxTeamMembers: 10,
      cloudSync: true,
      advancedAnalytics: true,
      customReports: true,
      pluginSupport: true,
      prioritySupport: true,
      whiteLabel: false,
    },
    enterprise: {
      maxInvestigations: -1, // Unlimited
      maxEvidenceFiles: -1, // Unlimited
      maxTeamMembers: -1, // Unlimited
      cloudSync: true,
      advancedAnalytics: true,
      customReports: true,
      pluginSupport: true,
      prioritySupport: true,
      whiteLabel: true,
    },
  };

  constructor(publicKey?: string, privateKey?: string) {
    // In production, embed the public key in the application
    this.publicKey = publicKey || this.getEmbeddedPublicKey();
    this.privateKey = privateKey; // Only for license server
  }

  /**
   * Validate a license key
   */
  public validateLicense(licenseKey: string, email: string): LicenseValidationResult {
    try {
      const license = this.parseLicenseKey(licenseKey);
      
      // Verify email matches
      if (license.email !== email) {
        return {
          isValid: false,
          error: 'License email does not match provided email',
        };
      }

      // Verify device binding
      const currentDeviceId = this.getDeviceId();
      if (license.deviceId !== currentDeviceId) {
        return {
          isValid: false,
          error: 'License is bound to a different device',
        };
      }

      // Verify signature
      if (!this.verifySignature(license)) {
        return {
          isValid: false,
          error: 'Invalid license signature',
        };
      }

      // Check expiration
      const expirationDate = new Date(license.expirationDate);
      const now = new Date();
      
      if (expirationDate < now) {
        return {
          isValid: false,
          error: 'License has expired',
        };
      }

      // Calculate remaining days
      const remainingMs = expirationDate.getTime() - now.getTime();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      return {
        isValid: true,
        license,
        remainingDays,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `License validation failed: ${error.message}`,
      };
    }
  }

  /**
   * Generate a license key (server-side only)
   */
  public generateLicense(
    email: string,
    type: string,
    durationDays: number,
    features?: string[]
  ): string {
    if (!this.privateKey) {
      throw new Error('Private key required for license generation');
    }

    const deviceId = this.getDeviceId();
    const issuedAt = new Date().toISOString();
    const expirationDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const licenseData: Omit<LicenseData, 'signature'> = {
      email,
      licenseKey: '', // Will be set after generation
      type: type as any,
      expirationDate,
      features: features || this.getDefaultFeatures(type),
      deviceId,
      issuedAt,
    };

    const signature = this.signLicense(licenseData);
    const fullLicense: LicenseData = {
      ...licenseData,
      signature,
    };

    return this.encodeLicense(fullLicense);
  }

  /**
   * Get device-specific identifier
   */
  public getDeviceId(): string {
    try {
      return machineIdSync();
    } catch (error) {
      // Fallback to a deterministic identifier if machine-id fails
      const fallbackData = [
        process.platform,
        process.arch,
        require('os').hostname(),
      ].join('-');
      
      return crypto.createHash('sha256').update(fallbackData).digest('hex').substring(0, 32);
    }
  }

  /**
   * Get license features for a given type
   */
  public getLicenseFeatures(type: string): LicenseFeatures {
    return this.FEATURE_SETS[type] || this.FEATURE_SETS.trial;
  }

  /**
   * Check if a feature is enabled for the current license
   */
  public hasFeature(license: LicenseData, feature: keyof LicenseFeatures): boolean {
    const features = this.getLicenseFeatures(license.type);
    return features[feature] as boolean;
  }

  /**
   * Get usage limits for the current license
   */
  public getUsageLimits(license: LicenseData): Partial<LicenseFeatures> {
    return this.getLicenseFeatures(license.type);
  }

  /**
   * Parse license key string into LicenseData object
   */
  private parseLicenseKey(licenseKey: string): LicenseData {
    try {
      // License key format: base64(JSON)
      const decoded = Buffer.from(licenseKey, 'base64').toString('utf-8');
      const license = JSON.parse(decoded) as LicenseData;
      license.licenseKey = licenseKey;
      return license;
    } catch (error) {
      throw new Error('Invalid license key format');
    }
  }

  /**
   * Encode license data into a license key string
   */
  private encodeLicense(license: LicenseData): string {
    const licenseString = JSON.stringify(license);
    return Buffer.from(licenseString).toString('base64');
  }

  /**
   * Verify license signature
   */
  private verifySignature(license: LicenseData): boolean {
    try {
      const dataToVerify = this.createSignatureData(license);
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(dataToVerify);
      return verifier.verify(this.publicKey, license.signature, 'base64');
    } catch (error) {
      return false;
    }
  }

  /**
   * Sign license data (server-side only)
   */
  private signLicense(license: Omit<LicenseData, 'signature'>): string {
    if (!this.privateKey) {
      throw new Error('Private key required for signing');
    }

    const dataToSign = this.createSignatureData(license);
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(dataToSign);
    return signer.sign(this.privateKey, 'base64');
  }

  /**
   * Create data string for signature verification
   */
  private createSignatureData(license: Omit<LicenseData, 'signature' | 'licenseKey'>): string {
    return [
      license.email,
      license.type,
      license.expirationDate,
      license.features.join(','),
      license.deviceId,
      license.issuedAt,
    ].join('|');
  }

  /**
   * Get default features for license type
   */
  private getDefaultFeatures(type: string): string[] {
    const features = this.getLicenseFeatures(type);
    return Object.entries(features)
      .filter(([key, value]) => value === true)
      .map(([key]) => key);
  }

  /**
   * Get embedded public key (production)
   */
  private getEmbeddedPublicKey(): string {
    // In production, this would be your actual RSA public key
    // For security, consider compiling this with bytenode
    return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2Z8QX8LkWJhvZO5GkG4r
xD9yK9JX5+9XH5p5rXqF2lF5r5qX2q9r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2q
X5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX
5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5
r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r
5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5r2qX5r5
wIDAQAB
-----END PUBLIC KEY-----`;
  }
}