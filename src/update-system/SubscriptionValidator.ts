import { app, net } from 'electron';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SubscriptionInfo,
  SubscriptionTier,
  SubscriptionStatus,
  UpdateError,
  UpdateErrorCode
} from './types';
import { UpdateServerConfigManager } from './UpdateServerConfig';

export class SubscriptionValidator {
  private serverConfig: UpdateServerConfigManager;
  private cachedSubscription: SubscriptionInfo | null = null;
  private cacheExpiry: Date | null = null;
  private readonly cacheDuration = 15 * 60 * 1000; // 15 minutes
  private readonly subscriptionPath: string;
  private readonly licenseKeyPath: string;

  constructor(serverConfig: UpdateServerConfigManager) {
    this.serverConfig = serverConfig;
    this.subscriptionPath = path.join(app.getPath('userData'), 'subscription.json');
    this.licenseKeyPath = path.join(app.getPath('userData'), 'license.key');
  }

  public async initialize(): Promise<void> {
    try {
      await this.loadCachedSubscription();
      await this.loadLicenseKey();
    } catch (error) {
      console.warn('Failed to initialize subscription validator:', error);
    }
  }

  public async validate(): Promise<boolean> {
    try {
      const subscription = await this.getCurrentSubscription();
      return subscription !== null && subscription.status === 'active' && subscription.expiresAt > new Date();
    } catch (error) {
      console.error('Subscription validation failed:', error);
      return false;
    }
  }

  public async getCurrentSubscription(): Promise<SubscriptionInfo | null> {
    // Return cached subscription if valid
    if (this.cachedSubscription && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cachedSubscription;
    }

    try {
      // Try to validate with server
      const serverSubscription = await this.validateWithServer();
      if (serverSubscription) {
        this.cachedSubscription = serverSubscription;
        this.cacheExpiry = new Date(Date.now() + this.cacheDuration);
        await this.saveCachedSubscription();
        return serverSubscription;
      }

      // Fall back to offline validation
      const offlineSubscription = await this.validateOffline();
      if (offlineSubscription) {
        return offlineSubscription;
      }

      return null;
    } catch (error) {
      console.error('Failed to get current subscription:', error);
      
      // Try offline validation as last resort
      try {
        return await this.validateOffline();
      } catch (offlineError) {
        console.error('Offline validation also failed:', offlineError);
        return null;
      }
    }
  }

  public async hasAccessToTier(requiredTier: SubscriptionTier): Promise<boolean> {
    const subscription = await this.getCurrentSubscription();
    if (!subscription || subscription.status !== 'active') {
      return false;
    }

    const tierHierarchy: Record<SubscriptionTier, number> = {
      'basic': 1,
      'professional': 2,
      'enterprise': 3,
      'developer': 4
    };

    const userTierLevel = tierHierarchy[subscription.tier] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier] || 999;

    return userTierLevel >= requiredTierLevel;
  }

  public async hasFeatureAccess(featureName: string): Promise<boolean> {
    const subscription = await this.getCurrentSubscription();
    if (!subscription || subscription.status !== 'active') {
      return false;
    }

    return subscription.features.includes(featureName) || subscription.features.includes('*');
  }

  public async setLicenseKey(licenseKey: string): Promise<boolean> {
    try {
      // Validate license key format
      if (!this.isValidLicenseKeyFormat(licenseKey)) {
        throw new Error('Invalid license key format');
      }

      // Validate license key with server
      const subscription = await this.validateLicenseKey(licenseKey);
      if (!subscription) {
        throw new Error('License key validation failed');
      }

      // Save license key and subscription info
      await fs.writeFile(this.licenseKeyPath, licenseKey, 'utf8');
      this.cachedSubscription = subscription;
      this.cacheExpiry = new Date(Date.now() + this.cacheDuration);
      await this.saveCachedSubscription();

      return true;
    } catch (error) {
      console.error('Failed to set license key:', error);
      return false;
    }
  }

  public async removeLicenseKey(): Promise<void> {
    try {
      await fs.unlink(this.licenseKeyPath);
      await fs.unlink(this.subscriptionPath);
      this.cachedSubscription = null;
      this.cacheExpiry = null;
    } catch (error) {
      console.warn('Failed to remove license key files:', error);
    }
  }

  public getSubscriptionFeatures(tier: SubscriptionTier): string[] {
    const featureMap: Record<SubscriptionTier, string[]> = {
      'basic': [
        'basic_analysis',
        'audio_processing',
        'image_analysis',
        'basic_reports'
      ],
      'professional': [
        'basic_analysis',
        'audio_processing',
        'image_analysis',
        'basic_reports',
        'advanced_analysis',
        'batch_processing',
        'custom_reports',
        'cloud_sync',
        'priority_support'
      ],
      'enterprise': [
        'basic_analysis',
        'audio_processing',
        'image_analysis',
        'basic_reports',
        'advanced_analysis',
        'batch_processing',
        'custom_reports',
        'cloud_sync',
        'priority_support',
        'team_collaboration',
        'advanced_security',
        'api_access',
        'custom_integrations'
      ],
      'developer': [
        '*' // Access to all features including development tools
      ]
    };

    return featureMap[tier] || [];
  }

  private async validateWithServer(): Promise<SubscriptionInfo | null> {
    const licenseKey = await this.loadLicenseKey();
    if (!licenseKey) {
      return null;
    }

    try {
      const validationUrl = this.serverConfig.getSubscriptionValidationUrl();
      const headers = this.serverConfig.createRequestHeaders();
      
      const requestBody = {
        licenseKey,
        appVersion: app.getVersion(),
        platform: process.platform,
        machineId: await this.getMachineId()
      };

      const request = net.request({
        method: 'POST',
        url: validationUrl,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });

      return new Promise((resolve, reject) => {
        let responseData = '';

        request.on('response', (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Server returned status ${response.statusCode}`));
            return;
          }

          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            try {
              const data = JSON.parse(responseData);
              if (data.valid && data.subscription) {
                const subscription = this.parseSubscriptionData(data.subscription);
                resolve(subscription);
              } else {
                resolve(null);
              }
            } catch (error) {
              reject(error);
            }
          });
        });

        request.on('error', (error) => {
          reject(error);
        });

        request.write(JSON.stringify(requestBody));
        request.end();
      });
    } catch (error) {
      console.error('Server validation failed:', error);
      return null;
    }
  }

  private async validateOffline(): Promise<SubscriptionInfo | null> {
    try {
      const cachedSubscription = await this.loadCachedSubscription();
      if (!cachedSubscription) {
        return null;
      }

      // Verify subscription signature offline
      const isSignatureValid = await this.verifySubscriptionSignature(cachedSubscription);
      if (!isSignatureValid) {
        console.error('Offline subscription signature verification failed');
        return null;
      }

      // Check if subscription is not expired (allow some grace period for offline use)
      const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
      const expiryWithGrace = new Date(cachedSubscription.expiresAt.getTime() + gracePeriod);
      
      if (new Date() > expiryWithGrace) {
        console.error('Cached subscription has expired');
        return null;
      }

      return cachedSubscription;
    } catch (error) {
      console.error('Offline validation failed:', error);
      return null;
    }
  }

  private async validateLicenseKey(licenseKey: string): Promise<SubscriptionInfo | null> {
    try {
      const validationUrl = this.serverConfig.getSubscriptionValidationUrl();
      const headers = this.serverConfig.createRequestHeaders();
      
      const requestBody = {
        licenseKey,
        action: 'activate',
        appVersion: app.getVersion(),
        platform: process.platform,
        machineId: await this.getMachineId()
      };

      const request = net.request({
        method: 'POST',
        url: validationUrl,
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        }
      });

      return new Promise((resolve, reject) => {
        let responseData = '';

        request.on('response', (response) => {
          response.on('data', (chunk) => {
            responseData += chunk.toString();
          });

          response.on('end', () => {
            try {
              const data = JSON.parse(responseData);
              
              if (response.statusCode === 200 && data.valid && data.subscription) {
                const subscription = this.parseSubscriptionData(data.subscription);
                resolve(subscription);
              } else {
                resolve(null);
              }
            } catch (error) {
              reject(error);
            }
          });
        });

        request.on('error', (error) => {
          reject(error);
        });

        request.write(JSON.stringify(requestBody));
        request.end();
      });
    } catch (error) {
      console.error('License key validation failed:', error);
      return null;
    }
  }

  private parseSubscriptionData(data: any): SubscriptionInfo {
    return {
      userId: data.userId || '',
      email: data.email || '',
      tier: data.tier || 'basic',
      status: data.status || 'active',
      expiresAt: new Date(data.expiresAt || Date.now() + 365 * 24 * 60 * 60 * 1000),
      features: data.features || this.getSubscriptionFeatures(data.tier || 'basic'),
      signature: data.signature || ''
    };
  }

  private async verifySubscriptionSignature(subscription: SubscriptionInfo): Promise<boolean> {
    try {
      if (!subscription.signature) {
        return false;
      }

      const publicKey = await this.serverConfig.getPublicKey();
      const signatureData = {
        userId: subscription.userId,
        email: subscription.email,
        tier: subscription.tier,
        status: subscription.status,
        expiresAt: subscription.expiresAt.toISOString(),
        features: subscription.features
      };

      const dataString = JSON.stringify(signatureData, Object.keys(signatureData).sort());
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(dataString, 'utf8');
      
      return verify.verify(publicKey, subscription.signature, 'base64');
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  private async loadCachedSubscription(): Promise<SubscriptionInfo | null> {
    try {
      const data = await fs.readFile(this.subscriptionPath, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Convert expiresAt back to Date object
      if (parsedData.expiresAt) {
        parsedData.expiresAt = new Date(parsedData.expiresAt);
      }
      
      return parsedData as SubscriptionInfo;
    } catch (error) {
      return null;
    }
  }

  private async saveCachedSubscription(): Promise<void> {
    if (!this.cachedSubscription) {
      return;
    }

    try {
      const data = JSON.stringify(this.cachedSubscription, null, 2);
      await fs.writeFile(this.subscriptionPath, data, 'utf8');
    } catch (error) {
      console.error('Failed to save cached subscription:', error);
    }
  }

  private async loadLicenseKey(): Promise<string | null> {
    try {
      const licenseKey = await fs.readFile(this.licenseKeyPath, 'utf8');
      return licenseKey.trim();
    } catch (error) {
      return null;
    }
  }

  private isValidLicenseKeyFormat(licenseKey: string): boolean {
    // Expected format: XXXX-XXXX-XXXX-XXXX (16 alphanumeric characters with dashes)
    const licenseKeyRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return licenseKeyRegex.test(licenseKey.toUpperCase());
  }

  private async getMachineId(): Promise<string> {
    try {
      // Create a machine ID based on system characteristics
      const os = require('os');
      const machineInfo = [
        os.platform(),
        os.arch(),
        os.hostname(),
        // Don't include MAC addresses for privacy
      ].join('|');
      
      return crypto.createHash('sha256').update(machineInfo).digest('hex').substring(0, 16);
    } catch (error) {
      console.error('Failed to generate machine ID:', error);
      return 'unknown-machine';
    }
  }

  public async generateTrialLicense(): Promise<string | null> {
    try {
      // Generate a trial license for evaluation purposes
      const trialSubscription: SubscriptionInfo = {
        userId: 'trial-user',
        email: 'trial@example.com',
        tier: 'professional',
        status: 'active',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        features: this.getSubscriptionFeatures('professional'),
        signature: 'trial-signature'
      };

      this.cachedSubscription = trialSubscription;
      this.cacheExpiry = new Date(Date.now() + this.cacheDuration);
      await this.saveCachedSubscription();

      // Generate a trial license key
      const trialKey = 'TRIAL-' + crypto.randomBytes(6).toString('hex').toUpperCase();
      await fs.writeFile(this.licenseKeyPath, trialKey, 'utf8');

      return trialKey;
    } catch (error) {
      console.error('Failed to generate trial license:', error);
      return null;
    }
  }

  public async getSubscriptionStatus(): Promise<{
    hasLicense: boolean;
    isValid: boolean;
    tier: SubscriptionTier | null;
    expiresAt: Date | null;
    daysRemaining: number | null;
    isTrial: boolean;
  }> {
    const subscription = await this.getCurrentSubscription();
    const licenseKey = await this.loadLicenseKey();
    
    if (!subscription || !licenseKey) {
      return {
        hasLicense: false,
        isValid: false,
        tier: null,
        expiresAt: null,
        daysRemaining: null,
        isTrial: false
      };
    }

    const now = new Date();
    const daysRemaining = Math.ceil((subscription.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const isTrial = licenseKey.startsWith('TRIAL-');

    return {
      hasLicense: true,
      isValid: subscription.status === 'active' && subscription.expiresAt > now,
      tier: subscription.tier,
      expiresAt: subscription.expiresAt,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      isTrial
    };
  }
}