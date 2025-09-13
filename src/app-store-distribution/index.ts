/**
 * App Store & Distribution System
 * 
 * A comprehensive system for managing app store distribution across Mac App Store 
 * and Microsoft Store platforms, including code signing, metadata management, 
 * automated release pipelines, and CI/CD integration.
 * 
 * Features:
 * - Code signing certificate management for Mac and Windows
 * - Distribution pipeline automation with multi-stage builds
 * - App store metadata and asset management
 * - Distribution profile templates and validation
 * - CI/CD workflow generation for GitHub Actions
 * - Screenshot and marketing asset optimization
 * - Release management and phased rollouts
 * 
 * Usage:
 * ```typescript
 * import { AppStoreDistributionSystem } from './app-store-distribution';
 * 
 * const distributionSystem = new AppStoreDistributionSystem();
 * await distributionSystem.initialize();
 * 
 * // Create a Mac App Store configuration
 * const config = await distributionSystem.createConfiguration({
 *   name: 'Ghost Hunter Toolbox',
 *   platform: Platform.MAC_APP_STORE,
 *   enabled: true,
 *   credentials: macCredentials,
 *   buildConfig: buildConfiguration,
 *   distributionProfile: profile,
 *   metadata: appMetadata,
 *   assets: appAssets,
 *   releaseConfig: releaseConfiguration
 * });
 * 
 * // Start a build
 * const buildResult = await distributionSystem.startBuild(config.id, releaseConfig);
 * ```
 */

import { EventEmitter } from 'events';
import { app } from 'electron';

// Import all managers
import { CodeSigningManager } from './CodeSigningManager';
import { DistributionPipelineManager } from './DistributionPipelineManager';
import { AppStoreMetadataManager } from './AppStoreMetadataManager';
import { DistributionProfileManager } from './DistributionProfileManager';

// Import types
import {
  AppStoreConfiguration,
  Platform,
  ReleaseConfiguration,
  BuildResult,
  AppStoreMetadata,
  DistributionProfile,
  CertificateInfo,
  CertificateType,
  ValidationResult,
  MarketingAsset,
  MarketingAssetType,
  Screenshot,
  BuildStatus
} from './types';

// Export types for external usage
export * from './types';
export { CodeSigningManager } from './CodeSigningManager';
export { DistributionPipelineManager } from './DistributionPipelineManager';
export { AppStoreMetadataManager } from './AppStoreMetadataManager';
export { DistributionProfileManager } from './DistributionProfileManager';

/**
 * Main App Store Distribution System
 * Coordinates all distribution-related operations
 */
export class AppStoreDistributionSystem extends EventEmitter {
  private codeSigningManager: CodeSigningManager;
  private pipelineManager: DistributionPipelineManager;
  private metadataManager: AppStoreMetadataManager;
  private profileManager: DistributionProfileManager;
  private initialized = false;

  constructor() {
    super();
    
    this.codeSigningManager = new CodeSigningManager();
    this.pipelineManager = new DistributionPipelineManager();
    this.metadataManager = new AppStoreMetadataManager();
    this.profileManager = new DistributionProfileManager();

    this.setupEventForwarding();
  }

  /**
   * Initialize all distribution managers
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('AppStoreDistributionSystem already initialized');
      return;
    }

    try {
      console.log('Initializing App Store Distribution System...');
      
      // Initialize all managers in parallel
      await Promise.all([
        this.codeSigningManager.initialize(),
        this.pipelineManager.initialize(),
        this.metadataManager.initialize(),
        this.profileManager.initialize()
      ]);

      this.initialized = true;
      console.log('App Store Distribution System initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize App Store Distribution System:', error);
      throw new Error(`Distribution system initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if the system is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  // Configuration Management
  /**
   * Create a new app store configuration
   */
  public async createConfiguration(
    config: Omit<AppStoreConfiguration, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AppStoreConfiguration> {
    this.ensureInitialized();
    return await this.pipelineManager.createConfiguration(config);
  }

  /**
   * Update an existing configuration
   */
  public async updateConfiguration(
    configId: string,
    updates: Partial<AppStoreConfiguration>
  ): Promise<boolean> {
    this.ensureInitialized();
    return await this.pipelineManager.updateConfiguration(configId, updates);
  }

  /**
   * Get a configuration by ID
   */
  public getConfiguration(configId: string): AppStoreConfiguration | null {
    this.ensureInitialized();
    return this.pipelineManager.getConfiguration(configId);
  }

  /**
   * Get all configurations for a platform
   */
  public getConfigurationsByPlatform(platform: Platform): AppStoreConfiguration[] {
    this.ensureInitialized();
    return this.pipelineManager.getConfigurationsByPlatform(platform);
  }

  /**
   * Get all configurations
   */
  public getAllConfigurations(): AppStoreConfiguration[] {
    this.ensureInitialized();
    return this.pipelineManager.getAllConfigurations();
  }

  /**
   * Remove a configuration
   */
  public async removeConfiguration(configId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.pipelineManager.removeConfiguration(configId);
  }

  // Build Management
  /**
   * Start a new build
   */
  public async startBuild(
    configurationId: string,
    releaseConfig: ReleaseConfiguration
  ): Promise<BuildResult> {
    this.ensureInitialized();
    return await this.pipelineManager.startBuild(configurationId, releaseConfig);
  }

  /**
   * Get build result by ID
   */
  public getBuildResult(buildId: string): BuildResult | null {
    this.ensureInitialized();
    return this.pipelineManager.getBuildResult(buildId);
  }

  /**
   * Get all active builds
   */
  public getAllBuilds(): BuildResult[] {
    this.ensureInitialized();
    return this.pipelineManager.getAllBuilds();
  }

  /**
   * Cancel a build
   */
  public async cancelBuild(buildId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.pipelineManager.cancelBuild(buildId);
  }

  // Code Signing
  /**
   * Import a code signing certificate
   */
  public async importCertificate(
    certificateData: Buffer | string,
    password: string,
    type: CertificateType,
    platform: Platform
  ): Promise<CertificateInfo> {
    this.ensureInitialized();
    return await this.codeSigningManager.importCertificate(certificateData, password, type, platform);
  }

  /**
   * Get all certificates for a platform
   */
  public getCertificatesByPlatform(platform: Platform): CertificateInfo[] {
    this.ensureInitialized();
    return this.codeSigningManager.getCertificatesByPlatform(platform);
  }

  /**
   * Remove a certificate
   */
  public async removeCertificate(certificateId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.codeSigningManager.removeCertificate(certificateId);
  }

  // Metadata Management
  /**
   * Create app store metadata
   */
  public async createMetadata(
    platform: Platform,
    metadata: Omit<AppStoreMetadata, 'id' | 'platform' | 'createdAt' | 'updatedAt'>
  ): Promise<AppStoreMetadata> {
    this.ensureInitialized();
    return await this.metadataManager.createMetadata(platform, metadata);
  }

  /**
   * Update metadata
   */
  public async updateMetadata(
    metadataId: string,
    updates: Partial<AppStoreMetadata>
  ): Promise<AppStoreMetadata | null> {
    this.ensureInitialized();
    return await this.metadataManager.updateMetadata(metadataId, updates);
  }

  /**
   * Get metadata by ID
   */
  public async getMetadata(metadataId: string): Promise<AppStoreMetadata | null> {
    this.ensureInitialized();
    return await this.metadataManager.getMetadata(metadataId);
  }

  /**
   * Validate metadata
   */
  public async validateMetadata(metadata: AppStoreMetadata): Promise<ValidationResult[]> {
    this.ensureInitialized();
    return await this.metadataManager.validateMetadata(metadata);
  }

  /**
   * Upload an asset (screenshot or marketing asset)
   */
  public async uploadAsset(
    metadataId: string,
    assetType: MarketingAssetType,
    filePath: string,
    options?: Record<string, unknown>
  ): Promise<MarketingAsset | Screenshot> {
    this.ensureInitialized();
    return await this.metadataManager.uploadAsset(metadataId, assetType, filePath, options);
  }

  /**
   * Remove an asset
   */
  public async removeAsset(metadataId: string, assetId: string): Promise<boolean> {
    this.ensureInitialized();
    return await this.metadataManager.removeAsset(metadataId, assetId);
  }

  // Profile Management
  /**
   * Create a distribution profile
   */
  public async createProfile(
    profile: Omit<DistributionProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DistributionProfile> {
    this.ensureInitialized();
    return await this.profileManager.createProfile(profile);
  }

  /**
   * Update a profile
   */
  public async updateProfile(
    profileId: string,
    updates: Partial<DistributionProfile>
  ): Promise<DistributionProfile | null> {
    this.ensureInitialized();
    return await this.profileManager.updateProfile(profileId, updates);
  }

  /**
   * Get profile by ID
   */
  public getProfile(profileId: string): DistributionProfile | null {
    this.ensureInitialized();
    return this.profileManager.getProfile(profileId);
  }

  /**
   * Get profiles by platform
   */
  public getProfilesByPlatform(platform: Platform): DistributionProfile[] {
    this.ensureInitialized();
    return this.profileManager.getProfilesByPlatform(platform);
  }

  /**
   * Get all profiles
   */
  public getAllProfiles(): DistributionProfile[] {
    this.ensureInitialized();
    return this.profileManager.getAllProfiles();
  }

  /**
   * Validate a profile
   */
  public async validateProfile(profile: DistributionProfile): Promise<ValidationResult[]> {
    this.ensureInitialized();
    return await this.profileManager.validateProfile(profile);
  }

  // CI/CD Integration
  /**
   * Generate GitHub Actions workflow for a configuration
   */
  public async generateGitHubWorkflow(configurationId: string): Promise<string> {
    this.ensureInitialized();
    return await this.pipelineManager.generateGitHubWorkflow(configurationId);
  }

  // Release Management
  /**
   * Create a release
   */
  public async createRelease(
    profileId: string,
    releaseConfig: ReleaseConfiguration
  ): Promise<string> {
    this.ensureInitialized();
    return await this.profileManager.createRelease(profileId, releaseConfig);
  }

  // Utility Methods
  /**
   * Get system health status
   */
  public getHealthStatus(): {
    initialized: boolean;
    managers: {
      codeSigningManager: boolean;
      pipelineManager: boolean;
      metadataManager: boolean;
      profileManager: boolean;
    };
    statistics: {
      totalConfigurations: number;
      activeBuilds: number;
      totalProfiles: number;
      totalCertificates: number;
    };
  } {
    const statistics = {
      totalConfigurations: this.initialized ? this.pipelineManager.getAllConfigurations().length : 0,
      activeBuilds: this.initialized ? this.pipelineManager.getAllBuilds().filter(b => b.status === BuildStatus.IN_PROGRESS).length : 0,
      totalProfiles: this.initialized ? this.profileManager.getAllProfiles().length : 0,
      totalCertificates: this.initialized ? 
        Object.values(Platform).reduce((total, platform) => 
          total + this.codeSigningManager.getCertificatesByPlatform(platform).length, 0
        ) : 0
    };

    return {
      initialized: this.initialized,
      managers: {
        codeSigningManager: true, // These don't have health checks, assuming they work if initialized
        pipelineManager: true,
        metadataManager: true,
        profileManager: true
      },
      statistics
    };
  }

  /**
   * Export system configuration
   */
  public async exportConfiguration(): Promise<Record<string, unknown>> {
    this.ensureInitialized();
    
    return {
      configurations: this.pipelineManager.getAllConfigurations(),
      profiles: this.profileManager.getAllProfiles(),
      certificates: Object.values(Platform).reduce((acc, platform) => {
        acc[platform] = this.codeSigningManager.getCertificatesByPlatform(platform);
        return acc;
      }, {} as Record<string, CertificateInfo[]>),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  // Event Management
  private setupEventForwarding(): void {
    // Forward events from all managers
    this.codeSigningManager.on('certificate-imported', (cert) => this.emit('certificate-imported', cert));
    this.codeSigningManager.on('certificate-removed', (id) => this.emit('certificate-removed', id));
    
    this.pipelineManager.on('configuration-created', (config) => this.emit('configuration-created', config));
    this.pipelineManager.on('configuration-updated', (config) => this.emit('configuration-updated', config));
    this.pipelineManager.on('build-completed', (build) => this.emit('build-completed', build));
    this.pipelineManager.on('build-cancelled', (build) => this.emit('build-cancelled', build));
    this.pipelineManager.on('distribution-event', (event) => this.emit('distribution-event', event));
    
    this.metadataManager.on('metadata-created', (metadata) => this.emit('metadata-created', metadata));
    this.metadataManager.on('metadata-updated', (metadata) => this.emit('metadata-updated', metadata));
    this.metadataManager.on('asset-uploaded', (data) => this.emit('asset-uploaded', data));
    this.metadataManager.on('asset-removed', (data) => this.emit('asset-removed', data));
    
    this.profileManager.on('profile-created', (profile) => this.emit('profile-created', profile));
    this.profileManager.on('profile-updated', (profile) => this.emit('profile-updated', profile));
    this.profileManager.on('distribution-event', (event) => this.emit('distribution-event', event));
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('AppStoreDistributionSystem must be initialized before use. Call initialize() first.');
    }
  }

  /**
   * Destroy the system and clean up resources
   */
  public destroy(): void {
    if (this.initialized) {
      this.codeSigningManager.destroy();
      this.pipelineManager.destroy();
      this.metadataManager.destroy();
      this.profileManager.destroy();
    }

    this.removeAllListeners();
    this.initialized = false;
    
    console.log('AppStoreDistributionSystem destroyed');
  }
}

// Create and export default instance
export const appStoreDistribution = new AppStoreDistributionSystem();

// Auto-initialize if running in Electron main process
if (app && app.whenReady) {
  app.whenReady().then(() => {
    appStoreDistribution.initialize().catch(error => {
      console.error('Failed to auto-initialize App Store Distribution System:', error);
    });
  });
}