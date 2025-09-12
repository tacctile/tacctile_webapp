/**
 * License Protection Manager
 * Main orchestrator for all license protection, anti-piracy, and subscription features
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as path from 'path';
import * as crypto from 'crypto';
import { HardwareFingerprintManager } from './HardwareFingerprintManager';
import { EncryptedLicenseManager } from './EncryptedLicenseManager';
import { AntiTamperingManager } from './AntiTamperingManager';
import { OnlineValidationManager } from './OnlineValidationManager';
import { SubscriptionManager } from './SubscriptionManager';
import {
  ILicenseProtectionManager,
  LicenseProtectionConfig,
  ValidationRequest,
  ValidationResponse,
  HardwareFingerprint,
  ProtectionStatus,
  ProtectionLevel,
  TamperDetection,
  TamperResponseAction,
  LicenseInfo,
  Subscription,
  ProtectionEventType,
  EventSeverity,
  LicenseProtectionEvent,
  OfflineConfiguration,
  GracePeriodInfo
} from './types';

export class LicenseProtectionManager extends EventEmitter implements ILicenseProtectionManager {
  private config: LicenseProtectionConfig;
  private hardwareManager: HardwareFingerprintManager;
  private licenseManager: EncryptedLicenseManager;
  private tamperingManager: AntiTamperingManager;
  private validationManager: OnlineValidationManager;
  private subscriptionManager: SubscriptionManager;
  
  private initialized = false;
  private protectionActive = false;
  private offlineMode = false;
  private gracePeriodInfo: GracePeriodInfo | null = null;
  private lastValidation: Date | null = null;
  private nextValidation: Date | null = null;
  private currentLicense: LicenseInfo | null = null;
  private currentSubscription: Subscription | null = null;
  private events: LicenseProtectionEvent[] = [];
  private maxEvents = 1000;

  constructor(config: LicenseProtectionConfig) {
    super();
    
    this.config = config;
    
    // Initialize component managers
    this.hardwareManager = new HardwareFingerprintManager();
    this.licenseManager = new EncryptedLicenseManager();
    this.tamperingManager = new AntiTamperingManager(config.protection);
    this.validationManager = new OnlineValidationManager(
      config.serverConfig,
      config.validation,
      config.offline
    );
    this.subscriptionManager = new SubscriptionManager({
      serverConfig: config.serverConfig,
      autoRenewEnabled: true,
      renewalNoticeDays: 7,
      paymentRetryDays: 3,
      gracePeriodDays: 7,
      seatManagementEnabled: true,
      usageTrackingEnabled: true,
      tierEnforcementStrict: true
    });

    this.setupEventHandlers();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('LicenseProtectionManager already initialized');
      return;
    }

    try {
      console.log('Initializing License Protection System...');
      
      await this.logEvent({
        type: ProtectionEventType.LICENSE_VALIDATED,
        severity: EventSeverity.INFO,
        source: 'LicenseProtectionManager',
        message: 'License protection system starting up',
        details: {
          version: app.getVersion(),
          platform: process.platform,
          productId: this.config.productId
        }
      });

      // Initialize all components
      await Promise.all([
        this.hardwareManager.initialize(),
        this.licenseManager.initialize(),
        this.tamperingManager.initialize(),
        this.validationManager.initialize(),
        this.subscriptionManager.initialize()
      ]);

      this.initialized = true;
      console.log('License Protection System initialized successfully');
      this.emit('initialized');

      await this.logEvent({
        type: ProtectionEventType.LICENSE_VALIDATED,
        severity: EventSeverity.INFO,
        source: 'LicenseProtectionManager',
        message: 'License protection system initialized',
        details: { timestamp: new Date().toISOString() }
      });

    } catch (error) {
      console.error('Failed to initialize License Protection System:', error);
      
      await this.logEvent({
        type: ProtectionEventType.PROTECTION_BYPASSED,
        severity: EventSeverity.CRITICAL,
        source: 'LicenseProtectionManager',
        message: `Initialization failed: ${error.message}`,
        details: { error: error.stack }
      });
      
      throw error;
    }
  }

  /**
   * Validate license with comprehensive checks
   */
  public async validateLicense(request?: Partial<ValidationRequest>): Promise<ValidationResponse> {
    this.ensureInitialized();

    try {
      // Generate hardware fingerprint
      const fingerprint = await this.hardwareManager.generateFingerprint();
      
      // Create validation request
      const validationRequest: ValidationRequest = {
        licenseKey: request?.licenseKey || this.getCurrentLicenseKey(),
        hardwareFingerprint: fingerprint.fingerprint,
        productId: this.config.productId,
        version: this.config.version,
        checkFeatures: request?.checkFeatures || this.config.features.map(f => f.name),
        timestamp: new Date(),
        ...request
      };

      // Perform online validation
      let response: ValidationResponse;
      try {
        response = await this.validationManager.validateLicense(validationRequest);
        this.offlineMode = false;
      } catch (error) {
        console.warn('Online validation failed, attempting offline validation:', error);
        
        // Try offline validation
        const offlineResult = await this.licenseManager.validateOfflineLicense(validationRequest.licenseKey);
        
        if (offlineResult.valid && offlineResult.license) {
          response = {
            valid: true,
            license: offlineResult.license,
            warnings: [
              ...(offlineResult.warnings || []),
              {
                code: 'OFFLINE_MODE',
                message: 'Operating in offline mode'
              }
            ],
            errors: [],
            serverTime: new Date(),
            signature: '',
            nextValidation: offlineResult.nextCheck
          };
          this.offlineMode = true;
        } else {
          response = {
            valid: false,
            errors: [
              {
                code: 'VALIDATION_FAILED',
                message: 'Both online and offline validation failed',
                details: { onlineError: error.message, offlineErrors: offlineResult.errors },
                recoverable: true
              }
            ],
            serverTime: new Date(),
            signature: '',
            nextValidation: new Date(Date.now() + 60 * 60 * 1000) // Try again in 1 hour
          };
        }
      }

      // Update internal state
      this.lastValidation = new Date();
      this.nextValidation = response.nextValidation || new Date(Date.now() + 24 * 60 * 60 * 1000);
      this.gracePeriodInfo = response.gracePeriod || null;
      
      if (response.license) {
        this.currentLicense = response.license;
      }

      // Log validation result
      await this.logEvent({
        type: response.valid ? ProtectionEventType.LICENSE_VALIDATED : ProtectionEventType.LICENSE_EXPIRED,
        severity: response.valid ? EventSeverity.INFO : EventSeverity.ERROR,
        source: 'LicenseProtectionManager',
        message: `License validation ${response.valid ? 'successful' : 'failed'}`,
        licenseId: response.license?.id,
        details: {
          valid: response.valid,
          offlineMode: this.offlineMode,
          errors: response.errors?.length || 0,
          warnings: response.warnings?.length || 0
        }
      });

      this.emit('license-validated', response);
      return response;

    } catch (error) {
      console.error('License validation error:', error);
      
      await this.logEvent({
        type: ProtectionEventType.LICENSE_EXPIRED,
        severity: EventSeverity.ERROR,
        source: 'LicenseProtectionManager',
        message: `License validation error: ${error.message}`,
        details: { error: error.stack }
      });

      const errorResponse: ValidationResponse = {
        valid: false,
        errors: [
          {
            code: 'VALIDATION_ERROR',
            message: `License validation failed: ${error.message}`,
            recoverable: true
          }
        ],
        serverTime: new Date(),
        signature: '',
        nextValidation: new Date(Date.now() + 5 * 60 * 1000) // Retry in 5 minutes
      };

      this.emit('license-validation-error', errorResponse);
      return errorResponse;
    }
  }

  /**
   * Check feature access with tier enforcement
   */
  public async checkFeatureAccess(featureName: string, userId?: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      // Check if license allows this feature
      if (!this.currentLicense) {
        await this.logEvent({
          type: ProtectionEventType.FEATURE_BLOCKED,
          severity: EventSeverity.WARNING,
          source: 'LicenseProtectionManager',
          message: `Feature access denied: No valid license`,
          userId,
          details: { feature: featureName }
        });
        return false;
      }

      const licenseFeature = this.currentLicense.features.find(f => f.name === featureName);
      if (!licenseFeature || !licenseFeature.enabled) {
        await this.logEvent({
          type: ProtectionEventType.FEATURE_BLOCKED,
          severity: EventSeverity.WARNING,
          source: 'LicenseProtectionManager',
          message: `Feature access denied: Feature not licensed`,
          userId,
          details: { feature: featureName, licenseFeatures: this.currentLicense.features.map(f => f.name) }
        });
        return false;
      }

      // Check usage limits if applicable
      if (licenseFeature.maxUsage && licenseFeature.currentUsage && 
          licenseFeature.currentUsage >= licenseFeature.maxUsage) {
        await this.logEvent({
          type: ProtectionEventType.FEATURE_BLOCKED,
          severity: EventSeverity.WARNING,
          source: 'LicenseProtectionManager',
          message: `Feature access denied: Usage limit exceeded`,
          userId,
          details: { 
            feature: featureName, 
            usage: licenseFeature.currentUsage,
            limit: licenseFeature.maxUsage
          }
        });
        return false;
      }

      // Check subscription if available
      if (this.currentSubscription) {
        const hasSubscriptionAccess = this.subscriptionManager.checkFeatureAccess(
          this.currentSubscription.id, 
          featureName
        );
        
        if (!hasSubscriptionAccess) {
          await this.logEvent({
            type: ProtectionEventType.FEATURE_BLOCKED,
            severity: EventSeverity.WARNING,
            source: 'LicenseProtectionManager',
            message: `Feature access denied: Subscription tier restriction`,
            userId,
            details: { 
              feature: featureName, 
              tier: this.currentSubscription.tier,
              subscriptionId: this.currentSubscription.id
            }
          });
          return false;
        }
      }

      // Check feature configuration
      const featureConfig = this.config.features.find(f => f.name === featureName);
      if (featureConfig) {
        // Check if offline available when in offline mode
        if (this.offlineMode && !featureConfig.offlineAvailable) {
          await this.logEvent({
            type: ProtectionEventType.FEATURE_BLOCKED,
            severity: EventSeverity.WARNING,
            source: 'LicenseProtectionManager',
            message: `Feature access denied: Not available in offline mode`,
            userId,
            details: { feature: featureName }
          });
          return false;
        }

        // Check subscription tier requirements
        if (featureConfig.requiresSubscription && this.currentSubscription) {
          const tierOrder = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE', 'ULTIMATE'];
          const requiredTierIndex = tierOrder.indexOf(featureConfig.minTier);
          const currentTierIndex = tierOrder.indexOf(this.currentSubscription.tier);
          
          if (currentTierIndex < requiredTierIndex) {
            await this.logEvent({
              type: ProtectionEventType.FEATURE_BLOCKED,
              severity: EventSeverity.WARNING,
              source: 'LicenseProtectionManager',
              message: `Feature access denied: Requires ${featureConfig.minTier} tier`,
              userId,
              details: { 
                feature: featureName, 
                requiredTier: featureConfig.minTier,
                currentTier: this.currentSubscription.tier
              }
            });
            return false;
          }
        }
      }

      // Track usage if enabled
      if (this.currentSubscription) {
        await this.subscriptionManager.trackFeatureUsage(this.currentSubscription.id, featureName);
      }

      return true;

    } catch (error) {
      console.error('Feature access check error:', error);
      
      await this.logEvent({
        type: ProtectionEventType.FEATURE_BLOCKED,
        severity: EventSeverity.ERROR,
        source: 'LicenseProtectionManager',
        message: `Feature access check failed: ${error.message}`,
        userId,
        details: { feature: featureName, error: error.stack }
      });
      
      return false;
    }
  }

  /**
   * Get current hardware fingerprint
   */
  public async getHardwareFingerprint(): Promise<HardwareFingerprint> {
    this.ensureInitialized();
    return await this.hardwareManager.generateFingerprint();
  }

  /**
   * Start all protection measures
   */
  public async startProtection(): Promise<void> {
    this.ensureInitialized();

    if (this.protectionActive) {
      console.warn('Protection already active');
      return;
    }

    try {
      console.log('Starting license protection measures...');
      
      // Start anti-tampering protection
      await this.tamperingManager.startProtection();
      
      // Perform initial license validation
      await this.validateLicense();
      
      this.protectionActive = true;
      
      await this.logEvent({
        type: ProtectionEventType.LICENSE_VALIDATED,
        severity: EventSeverity.INFO,
        source: 'LicenseProtectionManager',
        message: 'License protection started',
        details: { timestamp: new Date().toISOString() }
      });

      console.log('License protection started successfully');
      this.emit('protection-started');

    } catch (error) {
      console.error('Failed to start protection:', error);
      
      await this.logEvent({
        type: ProtectionEventType.PROTECTION_BYPASSED,
        severity: EventSeverity.CRITICAL,
        source: 'LicenseProtectionManager',
        message: `Failed to start protection: ${error.message}`,
        details: { error: error.stack }
      });
      
      throw error;
    }
  }

  /**
   * Stop all protection measures
   */
  public async stopProtection(): Promise<void> {
    if (!this.protectionActive) {
      console.warn('Protection not active');
      return;
    }

    try {
      console.log('Stopping license protection measures...');
      
      await this.tamperingManager.stopProtection();
      
      this.protectionActive = false;
      
      await this.logEvent({
        type: ProtectionEventType.LICENSE_VALIDATED,
        severity: EventSeverity.INFO,
        source: 'LicenseProtectionManager',
        message: 'License protection stopped',
        details: { timestamp: new Date().toISOString() }
      });

      console.log('License protection stopped');
      this.emit('protection-stopped');

    } catch (error) {
      console.error('Failed to stop protection:', error);
    }
  }

  /**
   * Enable offline mode
   */
  public async enableOfflineMode(): Promise<void> {
    this.ensureInitialized();
    
    if (this.offlineMode) {
      console.warn('Already in offline mode');
      return;
    }

    console.log('Enabling offline mode...');
    
    // Create offline license if we have a valid online license
    if (this.currentLicense) {
      try {
        await this.licenseManager.createOfflineLicense(this.currentLicense, this.config.offline.maxOfflineDays);
      } catch (error) {
        console.warn('Failed to create offline license:', error);
      }
    }

    this.offlineMode = true;
    
    await this.logEvent({
      type: ProtectionEventType.OFFLINE_MODE_STARTED,
      severity: EventSeverity.INFO,
      source: 'LicenseProtectionManager',
      message: 'Offline mode enabled',
      details: { maxDays: this.config.offline.maxOfflineDays }
    });

    this.emit('offline-mode-enabled');
  }

  /**
   * Disable offline mode
   */
  public async disableOfflineMode(): Promise<void> {
    if (!this.offlineMode) {
      console.warn('Not in offline mode');
      return;
    }

    console.log('Disabling offline mode...');
    
    this.offlineMode = false;
    
    // Perform fresh online validation
    try {
      await this.validateLicense();
    } catch (error) {
      console.warn('Online validation failed after disabling offline mode:', error);
    }

    await this.logEvent({
      type: ProtectionEventType.OFFLINE_MODE_ENDED,
      severity: EventSeverity.INFO,
      source: 'LicenseProtectionManager',
      message: 'Offline mode disabled',
      details: { timestamp: new Date().toISOString() }
    });

    this.emit('offline-mode-disabled');
  }

  /**
   * Get comprehensive protection status
   */
  public async getProtectionStatus(): Promise<ProtectionStatus> {
    const tamperStatus = this.tamperingManager.getProtectionStatus();
    const validationStatus = this.validationManager.getValidationStatus();
    
    const offlineDaysRemaining = this.gracePeriodInfo ? 
      this.gracePeriodInfo.remainingDays : 
      this.config.offline.maxOfflineDays;

    return {
      isActive: this.protectionActive,
      isOnline: validationStatus.isOnline,
      lastValidation: this.lastValidation || new Date(),
      nextValidation: this.nextValidation || new Date(),
      offlineDaysRemaining,
      gracePeriodActive: validationStatus.gracePeriodActive,
      tamperDetections: [], // Would include recent detections
      protectionLevel: tamperStatus.protectionLevel
    };
  }

  /**
   * Set up event handlers for all components
   */
  private setupEventHandlers(): void {
    // Hardware fingerprint events
    this.hardwareManager.on('fingerprint-generated', (fingerprint) => {
      this.emit('hardware-fingerprint-generated', fingerprint);
    });

    // License manager events
    this.licenseManager.on('license-validated', (license) => {
      this.currentLicense = license;
      this.emit('license-updated', license);
    });

    this.licenseManager.on('offline-license-created', (offlineLicense) => {
      this.emit('offline-license-created', offlineLicense);
    });

    // Anti-tampering events
    this.tamperingManager.on('tamper-detected', async (detection: TamperDetection) => {
      await this.handleTamperDetection(detection);
    });

    this.tamperingManager.on('disable-features', (detection) => {
      this.emit('features-disabled', detection);
    });

    this.tamperingManager.on('exit-required', (detection) => {
      this.emit('exit-required', detection);
    });

    this.tamperingManager.on('revoke-license', async (detection) => {
      await this.logEvent({
        type: ProtectionEventType.LICENSE_REVOKED,
        severity: EventSeverity.CRITICAL,
        source: 'AntiTamperingManager',
        message: 'License revoked due to tampering',
        details: detection
      });
      this.emit('license-revoked', detection);
    });

    // Validation manager events
    this.validationManager.on('validation-success', (data) => {
      this.emit('validation-success', data);
    });

    this.validationManager.on('validation-failed', (data) => {
      this.emit('validation-failed', data);
    });

    this.validationManager.on('grace-period-started', (data) => {
      this.gracePeriodInfo = data as any;
      this.emit('grace-period-started', data);
    });

    this.validationManager.on('grace-period-ended', () => {
      this.gracePeriodInfo = null;
      this.emit('grace-period-ended');
    });

    // Subscription manager events
    this.subscriptionManager.on('subscription-validated', (data) => {
      if (data.response.subscription) {
        this.currentSubscription = data.response.subscription;
      }
      this.emit('subscription-validated', data);
    });

    this.subscriptionManager.on('seat-assigned', (data) => {
      this.emit('seat-assigned', data);
    });

    this.subscriptionManager.on('seat-removed', (data) => {
      this.emit('seat-removed', data);
    });

    this.subscriptionManager.on('subscription-renewed', (subscription) => {
      this.currentSubscription = subscription;
      this.emit('subscription-renewed', subscription);
    });
  }

  /**
   * Handle tamper detection events
   */
  private async handleTamperDetection(detection: TamperDetection): Promise<void> {
    await this.logEvent({
      type: ProtectionEventType.TAMPER_DETECTED,
      severity: EventSeverity.CRITICAL,
      source: 'AntiTamperingManager',
      message: `Tamper detection: ${detection.type}`,
      details: detection
    });

    this.emit('tamper-detected', detection);

    // Take action based on severity and configuration
    switch (detection.responseAction) {
      case TamperResponseAction.DISABLE_FEATURES:
        this.emit('disable-features', detection);
        break;
      
      case TamperResponseAction.EXIT_APPLICATION:
        this.emit('exit-application', detection);
        break;
      
      case TamperResponseAction.REVOKE_LICENSE:
        if (this.currentLicense) {
          this.currentLicense.status = 'revoked' as any;
          this.emit('license-revoked', detection);
        }
        break;
    }
  }

  /**
   * Log protection events
   */
  private async logEvent(event: Omit<LicenseProtectionEvent, 'id' | 'timestamp' | 'handled'>): Promise<void> {
    const fullEvent: LicenseProtectionEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      handled: false,
      ...event
    };

    this.events.push(fullEvent);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Log to console based on severity
    const message = `[${event.severity.toUpperCase()}] ${event.message}`;
    switch (event.severity) {
      case EventSeverity.CRITICAL:
      case EventSeverity.ERROR:
        console.error(message, event.details);
        break;
      case EventSeverity.WARNING:
        console.warn(message, event.details);
        break;
      default:
        if (this.config.logging.level === 'debug' || this.config.logging.level === 'info') {
          console.log(message, event.details);
        }
        break;
    }

    this.emit('event-logged', fullEvent);
    fullEvent.handled = true;
  }

  // Helper methods
  private getCurrentLicenseKey(): string {
    return this.currentLicense?.key || 'no-license-key';
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LicenseProtectionManager not initialized. Call initialize() first.');
    }
  }

  // Public getters
  public getCurrentLicense(): LicenseInfo | null {
    return this.currentLicense;
  }

  public getCurrentSubscription(): Subscription | null {
    return this.currentSubscription;
  }

  public getRecentEvents(count: number = 100): LicenseProtectionEvent[] {
    return this.events.slice(-count);
  }

  public isOfflineMode(): boolean {
    return this.offlineMode;
  }

  public getGracePeriodInfo(): GracePeriodInfo | null {
    return this.gracePeriodInfo;
  }

  public getConfiguration(): LicenseProtectionConfig {
    return { ...this.config };
  }

  public updateConfiguration(updates: Partial<LicenseProtectionConfig>): void {
    this.config = { ...this.config, ...updates };
    this.emit('configuration-updated', this.config);
  }

  /**
   * Destroy and clean up all resources
   */
  public async destroy(): Promise<void> {
    console.log('Destroying License Protection Manager...');
    
    await this.stopProtection();
    
    await Promise.all([
      this.hardwareManager.destroy(),
      this.licenseManager.destroy(),
      this.tamperingManager.destroy(),
      this.validationManager.destroy(),
      this.subscriptionManager.destroy()
    ]);

    this.removeAllListeners();
    this.initialized = false;
    
    console.log('License Protection Manager destroyed');
  }
}