/**
 * License Protection & Anti-Piracy System
 * 
 * A comprehensive software protection system that includes:
 * - Hardware fingerprinting for device binding
 * - Encrypted license file generation and validation
 * - Anti-tampering and code obfuscation measures
 * - Periodic online validation with offline grace periods (up to 7 days)
 * - Subscription management with tier enforcement
 * - Enterprise multi-seat licensing with primary account management
 * - Automatic license renewal and API integration
 * - Graceful degradation for offline periods
 * 
 * Usage:
 * ```typescript
 * import { createLicenseProtectionSystem } from './license-protection';
 * 
 * const protectionSystem = await createLicenseProtectionSystem({
 *   productId: 'ghost-hunter-toolbox',
 *   productName: 'Ghost Hunter Toolbox',
 *   version: '1.0.0',
 *   serverConfig: {
 *     baseUrl: 'https://api.ghosthunter.com',
 *     apiKey: 'your-api-key',
 *     timeout: 30000,
 *     retryAttempts: 3,
 *     enableSSL: true
 *   }
 * });
 * 
 * // Start protection
 * await protectionSystem.startProtection();
 * 
 * // Check feature access
 * const canUseAdvanced = await protectionSystem.checkFeatureAccess('advanced_analysis');
 * 
 * // Validate license
 * const validation = await protectionSystem.validateLicense();
 * ```
 */

import { app } from 'electron';
import { LicenseProtectionManager } from './LicenseProtectionManager';
import {
  LicenseProtectionConfig,
  LicenseServerConfig,
  ProtectionConfiguration,
  ValidationConfiguration,
  OfflineConfiguration,
  FeatureConfiguration,
  EncryptionConfiguration,
  LoggingConfiguration,
  TamperResponseAction,
  SubscriptionTier,
  Platform
} from './types';

// Export all types
export * from './types';

// Export all managers
export { LicenseProtectionManager } from './LicenseProtectionManager';
export { HardwareFingerprintManager } from './HardwareFingerprintManager';
export { EncryptedLicenseManager } from './EncryptedLicenseManager';
export { AntiTamperingManager } from './AntiTamperingManager';
export { OnlineValidationManager } from './OnlineValidationManager';
export { SubscriptionManager } from './SubscriptionManager';

// Export new enterprise managers
export { EnterpriseAccountManager } from './EnterpriseAccountManager';
export { AbuseDetectionManager } from './AbuseDetectionManager';
export { DeviceManagementManager } from './DeviceManagementManager';

/**
 * Create a default configuration for the license protection system
 */
export function createDefaultConfig(
  productId: string,
  serverConfig: LicenseServerConfig,
  overrides?: Partial<LicenseProtectionConfig>
): LicenseProtectionConfig {
  
  const defaultServerConfig: LicenseServerConfig = {
    baseUrl: 'https://api.example.com',
    apiKey: '',
    timeout: 30000,
    retryAttempts: 3,
    enableSSL: true,
    ...serverConfig
  };

  const defaultProtectionConfig: ProtectionConfiguration = {
    enableCodeObfuscation: true,
    enableAntiDebug: true,
    enableIntegrityCheck: true,
    enableRuntimeProtection: true,
    enableVMDetection: true,
    enableProcessHollowing: true,
    enableAPIHooking: true,
    maxDebuggerDetections: 3,
    tamperResponseAction: TamperResponseAction.DISABLE_FEATURES,
    criticalFunctions: [
      'validateLicense',
      'checkFeatureAccess',
      'encryptData',
      'decryptData',
      'generateFingerprint'
    ],
    protectedModules: [
      'license-protection',
      'security-system',
      'encryption'
    ]
  };

  const defaultValidationConfig: ValidationConfiguration = {
    checkInterval: 24 * 60 * 60 * 1000, // 24 hours
    retryInterval: 5 * 60 * 1000, // 5 minutes
    maxRetries: 3,
    timeoutMs: 30000, // 30 seconds
    cacheValidation: true,
    cacheDurationMs: 60 * 60 * 1000, // 1 hour
    requireOnlineValidation: true,
    allowCachedValidation: true
  };

  const defaultOfflineConfig: OfflineConfiguration = {
    maxOfflineDays: 7,
    gracePeriodDays: 3,
    requiredFeatures: ['core', 'basic_analysis'],
    degradedFeatures: ['premium_analysis', 'advanced_reporting'],
    emergencyMode: false,
    lastOnlineCheck: new Date(),
    nextRequiredCheck: new Date(Date.now() + 24 * 60 * 60 * 1000),
    offlineLicenseData: {
      data: '',
      signature: '',
      expiresAt: new Date(),
      issuer: 'Ghost Hunter Toolbox',
      algorithm: 'AES-256-GCM'
    }
  };

  const defaultFeatures: FeatureConfiguration[] = [
    {
      name: 'core',
      requiresLicense: true,
      requiresSubscription: false,
      minTier: SubscriptionTier.FREE,
      gracefulDegradation: false,
      offlineAvailable: true
    },
    {
      name: 'basic_analysis',
      requiresLicense: true,
      requiresSubscription: false,
      minTier: SubscriptionTier.BASIC,
      gracefulDegradation: true,
      offlineAvailable: true
    },
    {
      name: 'advanced_analysis',
      requiresLicense: true,
      requiresSubscription: true,
      minTier: SubscriptionTier.PRO,
      gracefulDegradation: true,
      offlineAvailable: false
    },
    {
      name: 'premium_analysis',
      requiresLicense: true,
      requiresSubscription: true,
      minTier: SubscriptionTier.PRO,
      gracefulDegradation: false,
      offlineAvailable: false,
      maxUsage: 1000,
      resetInterval: 'monthly'
    },
    {
      name: 'enterprise_features',
      requiresLicense: true,
      requiresSubscription: true,
      minTier: SubscriptionTier.ENTERPRISE,
      gracefulDegradation: false,
      offlineAvailable: false
    },
    {
      name: 'api_access',
      requiresLicense: true,
      requiresSubscription: true,
      minTier: SubscriptionTier.PRO,
      gracefulDegradation: false,
      offlineAvailable: false,
      maxUsage: 10000,
      resetInterval: 'monthly'
    },
    {
      name: 'multi_user',
      requiresLicense: true,
      requiresSubscription: true,
      minTier: SubscriptionTier.ENTERPRISE,
      gracefulDegradation: false,
      offlineAvailable: true
    }
  ];

  const defaultEncryptionConfig: EncryptionConfiguration = {
    algorithm: 'AES-256-GCM',
    keyDerivation: 'Argon2id',
    keyIterations: 100000,
    saltSize: 32,
    ivSize: 16,
    tagSize: 16,
    compressionEnabled: true
  };

  const defaultLoggingConfig: LoggingConfiguration = {
    enabled: true,
    level: 'info',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    anonymize: true,
    excludeEvents: [],
    remoteLogging: false
  };

  const config: LicenseProtectionConfig = {
    productId,
    productName: 'Ghost Hunter Toolbox',
    version: app.getVersion() || '1.0.0',
    serverConfig: defaultServerConfig,
    protection: defaultProtectionConfig,
    offline: defaultOfflineConfig,
    validation: defaultValidationConfig,
    features: defaultFeatures,
    encryption: defaultEncryptionConfig,
    logging: defaultLoggingConfig,
    ...overrides
  };

  return config;
}

/**
 * Create and initialize a license protection system
 */
export async function createLicenseProtectionSystem(
  config: Partial<LicenseProtectionConfig> & {
    productId: string;
    serverConfig: LicenseServerConfig;
  }
): Promise<LicenseProtectionManager> {
  
  const fullConfig = createDefaultConfig(config.productId, config.serverConfig, config);
  const protectionManager = new LicenseProtectionManager(fullConfig);
  
  await protectionManager.initialize();
  
  return protectionManager;
}

/**
 * Create and initialize an enterprise license protection system with all features
 */
export async function createEnterpriseLicenseProtectionSystem(
  config: Partial<LicenseProtectionConfig> & {
    productId: string;
    serverConfig: LicenseServerConfig;
    accountId: string;
    enterpriseConfig?: {
      enableAbuseDetection?: boolean;
      enableDeviceManagement?: boolean;
      enableEnterpriseAccounts?: boolean;
    };
  }
): Promise<{
  protectionManager: LicenseProtectionManager;
  enterpriseAccountManager?: EnterpriseAccountManager;
  abuseDetectionManager?: AbuseDetectionManager;
  deviceManagementManager?: DeviceManagementManager;
}> {
  
  const fullConfig = createDefaultConfig(config.productId, config.serverConfig, config);
  const protectionManager = new LicenseProtectionManager(fullConfig);
  
  await protectionManager.initialize();

  const enterpriseConfig = config.enterpriseConfig || {
    enableAbuseDetection: true,
    enableDeviceManagement: true,
    enableEnterpriseAccounts: true
  };

  const result: any = { protectionManager };

  // Initialize Enterprise Account Manager
  if (enterpriseConfig.enableEnterpriseAccounts) {
    const enterpriseAccountManager = new EnterpriseAccountManager();
    await enterpriseAccountManager.initialize();
    result.enterpriseAccountManager = enterpriseAccountManager;
  }

  // Initialize Abuse Detection Manager
  if (enterpriseConfig.enableAbuseDetection) {
    const abuseDetectionManager = new AbuseDetectionManager();
    await abuseDetectionManager.initialize();
    result.abuseDetectionManager = abuseDetectionManager;
  }

  // Initialize Device Management Manager
  if (enterpriseConfig.enableDeviceManagement) {
    const deviceManagementManager = new DeviceManagementManager(config.accountId);
    await deviceManagementManager.initialize();
    result.deviceManagementManager = deviceManagementManager;
  }

  return result;
}

/**
 * Global instance for the application
 */
let globalProtectionSystem: LicenseProtectionManager | null = null;

/**
 * Initialize the global license protection system
 */
export async function initializeLicenseProtection(
  config: Partial<LicenseProtectionConfig> & {
    productId: string;
    serverConfig: LicenseServerConfig;
  }
): Promise<LicenseProtectionManager> {
  
  if (globalProtectionSystem) {
    console.warn('License protection system already initialized');
    return globalProtectionSystem;
  }

  console.log('Initializing global license protection system...');
  globalProtectionSystem = await createLicenseProtectionSystem(config);
  
  // Auto-start protection
  await globalProtectionSystem.startProtection();
  
  console.log('Global license protection system initialized and started');
  return globalProtectionSystem;
}

/**
 * Get the global license protection system
 */
export function getLicenseProtectionSystem(): LicenseProtectionManager {
  if (!globalProtectionSystem) {
    throw new Error('License protection system not initialized. Call initializeLicenseProtection() first.');
  }
  return globalProtectionSystem;
}

/**
 * Destroy the global license protection system
 */
export async function destroyLicenseProtection(): Promise<void> {
  if (globalProtectionSystem) {
    console.log('Destroying global license protection system...');
    await globalProtectionSystem.destroy();
    globalProtectionSystem = null;
    console.log('Global license protection system destroyed');
  }
}

/**
 * Utility functions for common protection tasks
 */
export class LicenseProtectionUtils {
  
  /**
   * Validate a license key format
   */
  static validateLicenseKeyFormat(licenseKey: string): boolean {
    // Basic format validation (customize as needed)
    const licenseKeyRegex = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    return licenseKeyRegex.test(licenseKey);
  }

  /**
   * Generate a hardware ID for testing
   */
  static async generateTestHardwareId(): Promise<string> {
    const os = await import('os');
    const crypto = await import('crypto');
    
    const data = `${os.platform()}-${os.arch()}-${os.hostname()}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Create a test license for development
   */
  static createTestLicense(overrides?: any): any {
    return {
      id: 'test-license-' + Date.now(),
      key: 'TEST-DEMO-LITE-0001',
      type: 'trial',
      tier: SubscriptionTier.PRO,
      userId: 'test-user',
      hardwareId: 'test-hardware',
      issuedAt: new Date(),
      activatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      status: 'valid',
      features: [
        { name: 'core', enabled: true },
        { name: 'basic_analysis', enabled: true },
        { name: 'advanced_analysis', enabled: true }
      ],
      maxSeats: 1,
      currentSeats: 1,
      gracePeriodDays: 3,
      allowOfflineDays: 7,
      lastOnlineValidation: new Date(),
      metadata: {
        customerName: 'Test User',
        customerEmail: 'test@example.com',
        purchaseDate: new Date(),
        customFields: {}
      },
      ...overrides
    };
  }

  /**
   * Create a test subscription for development
   */
  static createTestSubscription(overrides?: any): any {
    return {
      id: 'test-subscription-' + Date.now(),
      customerId: 'test-customer',
      planId: 'pro-monthly',
      status: 'active',
      tier: SubscriptionTier.PRO,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      renewalDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000), // 3 days before end
      paymentMethod: {
        type: 'card',
        last4: '4242',
        brand: 'visa',
        expiryMonth: 12,
        expiryYear: 2025
      },
      pricing: {
        currency: 'USD',
        amount: 2999, // $29.99
        total: 2999
      },
      features: [
        { name: 'core', enabled: true, limit: undefined },
        { name: 'basic_analysis', enabled: true, limit: undefined },
        { name: 'advanced_analysis', enabled: true, limit: 1000, used: 0 },
        { name: 'api_access', enabled: true, limit: 5000, used: 0 }
      ],
      seats: {
        totalSeats: 5,
        usedSeats: 1,
        availableSeats: 4,
        seats: [],
        primaryAccountId: 'test-user',
        allowSelfService: true,
        maxSeats: 10
      },
      billingCycle: 'monthly',
      autoRenewal: true,
      metadata: {
        source: 'website',
        customFields: {}
      },
      ...overrides
    };
  }

  /**
   * Create a test enterprise account for development
   */
  static createTestEnterpriseAccount(overrides?: any): any {
    return {
      id: 'test-enterprise-' + Date.now(),
      organizationId: 'test-org',
      name: 'Test Enterprise Organization',
      domain: 'test-enterprise.com',
      primaryAdminId: 'test-admin-' + Date.now(),
      admins: [],
      settings: {
        seatAllocation: {
          autoAssignment: false,
          allowSelfProvisioning: true,
          requireApproval: false,
          maxSeatsPerUser: 3,
          seatRetentionDays: 30,
          transferCooldownHours: 24,
          preventAbuseEnabled: true,
          maxTransfersPerMonth: 5
        },
        userManagement: {
          singleSignOn: { enabled: false },
          directoryIntegration: { enabled: false },
          userProvisioning: { autoProvisioning: true },
          sessionManagement: { maxSessions: 5, sessionTimeout: 28800000 }
        }
      },
      billing: {
        accountId: 'test-billing-account',
        billingContact: {
          name: 'Test Billing Contact',
          email: 'billing@test-enterprise.com',
          address: {
            street: '123 Test St',
            city: 'Test City',
            postalCode: '12345',
            country: 'US'
          },
          purchaseOrderRequired: false
        }
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides
    };
  }

  /**
   * Create a test abuse detection rule for development
   */
  static createTestAbuseRule(overrides?: any): any {
    return {
      id: 'test-rule-' + Date.now(),
      name: 'Test License Sharing Rule',
      description: 'Detects potential license sharing based on concurrent sessions',
      type: 'license_sharing',
      conditions: [
        {
          field: 'concurrent_sessions',
          operator: 'greater_than',
          value: 3,
          weight: 1.0
        }
      ],
      actions: [
        {
          type: 'send_alert',
          parameters: { severity: 'medium' },
          condition: 'confidence >= 0.7'
        }
      ],
      severity: 'medium',
      confidence: 'medium',
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
      ...overrides
    };
  }

  /**
   * Create a test device registration for development
   */
  static createTestDevice(overrides?: any): any {
    return {
      id: 'test-device-' + Date.now(),
      userId: 'test-user',
      deviceId: 'test-device-id',
      hardwareFingerprint: {
        id: 'test-fingerprint-' + Date.now(),
        machineId: 'test-machine-id',
        fingerprint: 'test-fingerprint-hash',
        confidence: 0.9,
        generatedAt: new Date(),
        lastSeen: new Date()
      },
      deviceInfo: {
        name: 'Test Device',
        type: 'desktop',
        os: {
          platform: 'windows',
          name: 'Windows 11',
          version: '22H2',
          architecture: 'x64'
        },
        hardware: {
          isVirtual: false
        },
        network: {
          ipAddress: '192.168.1.100',
          connectionType: 'ethernet',
          isVPN: false,
          isProxy: false
        },
        location: {
          country: 'US',
          region: 'CA',
          city: 'San Francisco',
          lastUpdated: new Date()
        }
      },
      registrationInfo: {
        method: 'automatic',
        registeredBy: 'test-user',
        registeredAt: new Date()
      },
      status: 'active',
      trustScore: 75,
      riskScore: 25,
      usage: {
        totalSessions: 10,
        totalHours: 50,
        features: [],
        patterns: []
      },
      compliance: {
        status: 'compliant',
        checks: [],
        violations: [],
        lastEvaluation: new Date(),
        nextEvaluation: new Date(Date.now() + 24 * 60 * 60 * 1000)
      },
      security: {
        isJailbroken: false,
        isRooted: false,
        hasDebugger: false,
        hasEmulator: false,
        hasVirtualMachine: false,
        hasKeylogger: false,
        hasRemoteAccess: false,
        securitySoftware: [],
        threats: [],
        lastSecurityScan: new Date()
      },
      lastSeen: new Date(),
      createdAt: new Date(),
      ...overrides
    };
  }

  /**
   * Generate enterprise demo data for testing
   */
  static generateEnterpriseDemoData(): {
    account: any;
    devices: any[];
    abuseRules: any[];
    subscription: any;
  } {
    const account = this.createTestEnterpriseAccount({
      name: 'Acme Corporation Demo',
      domain: 'acme-demo.com'
    });

    const devices = [
      this.createTestDevice({ 
        deviceInfo: { name: 'CEO Laptop', type: 'laptop' },
        trustScore: 95 
      }),
      this.createTestDevice({ 
        deviceInfo: { name: 'Engineering Workstation', type: 'desktop' },
        trustScore: 85 
      }),
      this.createTestDevice({ 
        deviceInfo: { name: 'Mobile Device', type: 'mobile' },
        trustScore: 70 
      })
    ];

    const abuseRules = [
      this.createTestAbuseRule({ name: 'Concurrent Session Limit' }),
      this.createTestAbuseRule({ 
        name: 'Geographic Anomaly',
        type: 'usage_anomaly',
        conditions: [{ 
          field: 'location_variance', 
          operator: 'greater_than', 
          value: 500 
        }]
      }),
      this.createTestAbuseRule({ 
        name: 'Device Trust Score',
        type: 'device_fraud',
        conditions: [{ 
          field: 'trust_score', 
          operator: 'less_than', 
          value: 40 
        }]
      })
    ];

    const subscription = this.createTestSubscription({
      tier: 'enterprise',
      seats: {
        totalSeats: 50,
        usedSeats: 3,
        availableSeats: 47
      }
    });

    return { account, devices, abuseRules, subscription };
  }
}

// Auto-initialize if running in main process and config is available
if (app && app.whenReady && process.env.NODE_ENV !== 'test') {
  app.whenReady().then(() => {
    // Auto-initialization would require configuration
    // This is just a placeholder for production implementation
    console.log('License Protection System available for initialization');
  });
}

// Graceful shutdown handling
if (app) {
  app.on('before-quit', async () => {
    await destroyLicenseProtection();
  });
}

export default {
  createLicenseProtectionSystem,
  createEnterpriseLicenseProtectionSystem,
  initializeLicenseProtection,
  getLicenseProtectionSystem,
  destroyLicenseProtection,
  createDefaultConfig,
  LicenseProtectionUtils,
  EnterpriseAccountManager,
  AbuseDetectionManager,
  DeviceManagementManager
};