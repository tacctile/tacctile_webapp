/**
 * Distribution Profile Manager
 * Manages app store distribution profiles and publishing configurations
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  DistributionProfile,
  Platform,
  AppStoreConfiguration,
  ReleaseConfiguration,
  ReleaseType,
  ValidationResult,
  ValidationStatus,
  ValidationType,
  DistributionEvent,
  EventType,
  EventStatus,
  ProfileConfiguration
} from './types';

export interface ProfileTemplate {
  platform: Platform;
  name: string;
  description: string;
  configuration: Partial<ProfileConfiguration>;
}

export class DistributionProfileManager extends EventEmitter {
  private profiles: Map<string, DistributionProfile> = new Map();
  private profilesPath: string;
  private templatesPath: string;

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.profilesPath = path.join(userDataPath, 'distribution-profiles');
    this.templatesPath = path.join(userDataPath, 'profile-templates');
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.profilesPath, { recursive: true });
      await fs.mkdir(this.templatesPath, { recursive: true });
      
      await this.loadProfiles();
      await this.createDefaultProfiles();
      
      console.log('DistributionProfileManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize DistributionProfileManager:', error);
      throw error;
    }
  }

  // Profile Management
  public async createProfile(
    profile: Omit<DistributionProfile, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DistributionProfile> {
    const fullProfile: DistributionProfile = {
      ...profile,
      id: crypto.randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.profiles.set(fullProfile.id, fullProfile);
    await this.saveProfiles();

    this.emit('profile-created', fullProfile);
    return fullProfile;
  }

  public async updateProfile(
    profileId: string,
    updates: Partial<DistributionProfile>
  ): Promise<DistributionProfile | null> {
    const profile = this.profiles.get(profileId);
    if (!profile) return null;

    const updated = {
      ...profile,
      ...updates,
      updatedAt: new Date()
    };

    this.profiles.set(profileId, updated);
    await this.saveProfiles();

    this.emit('profile-updated', updated);
    return updated;
  }

  public getProfile(profileId: string): DistributionProfile | null {
    return this.profiles.get(profileId) || null;
  }

  public getProfilesByPlatform(platform: Platform): DistributionProfile[] {
    return Array.from(this.profiles.values()).filter(profile => profile.platform === platform);
  }

  public getAllProfiles(): DistributionProfile[] {
    return Array.from(this.profiles.values());
  }

  public async deleteProfile(profileId: string): Promise<boolean> {
    const success = this.profiles.delete(profileId);
    if (success) {
      await this.saveProfiles();
      this.emit('profile-deleted', profileId);
    }
    return success;
  }

  // Profile Validation
  public async validateProfile(profile: DistributionProfile): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate basic information
    if (!profile.name.trim()) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Profile name is required'
      });
    }

    if (!profile.bundleId.trim()) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Bundle ID is required'
      });
    }

    // Validate bundle ID format
    const bundleIdRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+$/;
    if (profile.bundleId && !bundleIdRegex.test(profile.bundleId)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Bundle ID format is invalid (should be like com.company.app)'
      });
    }

    // Platform-specific validations
    switch (profile.platform) {
      case Platform.MAC_APP_STORE:
        results.push(...this.validateMacAppStoreProfile(profile));
        break;
      case Platform.MICROSOFT_STORE:
        results.push(...this.validateMicrosoftStoreProfile(profile));
        break;
    }

    // Validate configuration
    results.push(...this.validateProfileConfiguration(profile.configuration));

    // Add success result if no failures
    if (results.every(r => r.status !== ValidationStatus.FAILED)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.PASSED,
        message: 'Profile validation passed'
      });
    }

    return results;
  }

  private validateMacAppStoreProfile(profile: DistributionProfile): ValidationResult[] {
    const results: ValidationResult[] = [];

    if (!profile.teamId) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Team ID is required for Mac App Store'
      });
    }

    // Validate Team ID format (10 characters, alphanumeric)
    if (profile.teamId && !/^[A-Z0-9]{10}$/.test(profile.teamId)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Team ID should be 10 alphanumeric characters'
      });
    }

    // Validate category
    const validCategories = [
      'Business', 'Developer Tools', 'Education', 'Entertainment',
      'Finance', 'Games', 'Graphics & Design', 'Health & Fitness',
      'Lifestyle', 'Medical', 'Music', 'News', 'Photography',
      'Productivity', 'Reference', 'Social Networking', 'Sports',
      'Travel', 'Utilities', 'Video', 'Weather'
    ];

    if (profile.category && !validCategories.includes(profile.category)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.WARNING,
        message: `Category "${profile.category}" may not be valid for Mac App Store`
      });
    }

    return results;
  }

  private validateMicrosoftStoreProfile(profile: DistributionProfile): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate package family name format
    if (profile.packageFamilyName && !/^[a-zA-Z0-9.-]+_[a-zA-Z0-9]+$/.test(profile.packageFamilyName)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Package Family Name format is invalid'
      });
    }

    // Validate category
    const validCategories = [
      'Business', 'Developer tools', 'Education', 'Entertainment',
      'Food & dining', 'Government & politics', 'Health & fitness',
      'Kids & family', 'Lifestyle', 'Medical', 'Multimedia design',
      'Music', 'Navigation & maps', 'News & weather', 'Personal finance',
      'Personalization', 'Photo & video', 'Productivity', 'Security',
      'Shopping', 'Social', 'Sports', 'Travel', 'Utilities & tools'
    ];

    if (profile.category && !validCategories.includes(profile.category)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.WARNING,
        message: `Category "${profile.category}" may not be valid for Microsoft Store`
      });
    }

    return results;
  }

  private validateProfileConfiguration(config: ProfileConfiguration): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Validate version format (semantic versioning)
    if (config.version && !/^\d+\.\d+\.\d+$/.test(config.version)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Version should follow semantic versioning (e.g., 1.0.0)'
      });
    }

    // Validate build number
    if (config.buildNumber !== undefined && (!Number.isInteger(config.buildNumber) || config.buildNumber < 1)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Build number should be a positive integer'
      });
    }

    // Validate release channels
    const validChannels = ['production', 'beta', 'alpha', 'internal'];
    if (config.releaseChannel && !validChannels.includes(config.releaseChannel)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: `Release channel "${config.releaseChannel}" is not valid`
      });
    }

    return results;
  }

  // Release Management
  public async createRelease(
    profileId: string,
    releaseConfig: ReleaseConfiguration
  ): Promise<string> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Validate the release configuration
    const validationResults = await this.validateReleaseConfiguration(releaseConfig, profile);
    const hasErrors = validationResults.some(r => r.status === ValidationStatus.FAILED);
    
    if (hasErrors) {
      const errorMessages = validationResults
        .filter(r => r.status === ValidationStatus.FAILED)
        .map(r => r.message)
        .join(', ');
      throw new Error(`Release validation failed: ${errorMessages}`);
    }

    const releaseId = crypto.randomUUID();

    // Emit release event
    this.emitEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: EventType.RELEASE_PREPARED,
      platform: profile.platform,
      source: 'DistributionProfileManager',
      target: releaseId,
      status: EventStatus.SUCCESS,
      message: `Release prepared: ${releaseConfig.version} (${releaseConfig.buildNumber})`,
      metadata: {
        profile_id: profileId,
        release_id: releaseId,
        version: releaseConfig.version,
        build_number: releaseConfig.buildNumber,
        release_type: releaseConfig.releaseType
      }
    });

    return releaseId;
  }

  private async validateReleaseConfiguration(
    releaseConfig: ReleaseConfiguration,
    profile: DistributionProfile
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate version
    if (!releaseConfig.version || !releaseConfig.version.trim()) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Release version is required'
      });
    }

    // Validate build number
    if (releaseConfig.buildNumber === undefined || releaseConfig.buildNumber < 1) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Build number must be a positive integer'
      });
    }

    // Validate release notes
    if (releaseConfig.releaseNotes && releaseConfig.releaseNotes.length > 4000) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Release notes exceed maximum length of 4000 characters'
      });
    }

    // Platform-specific validations
    if (profile.platform === Platform.MAC_APP_STORE) {
      // Mac App Store specific validation
      if (releaseConfig.releaseType === ReleaseType.HOTFIX && !releaseConfig.expeditedReview) {
        results.push({
          type: ValidationType.METADATA,
          status: ValidationStatus.WARNING,
          message: 'Consider requesting expedited review for hotfix releases'
        });
      }
    }

    return results;
  }

  // Template Management
  public async createTemplate(template: ProfileTemplate): Promise<string> {
    const templateId = crypto.randomUUID();
    const templateFile = path.join(this.templatesPath, `${templateId}.json`);
    
    const templateData = {
      id: templateId,
      ...template,
      createdAt: new Date()
    };

    await fs.writeFile(templateFile, JSON.stringify(templateData, null, 2));
    this.emit('template-created', templateData);
    return templateId;
  }

  public async getTemplate(templateId: string): Promise<ProfileTemplate | null> {
    try {
      const templateFile = path.join(this.templatesPath, `${templateId}.json`);
      const data = await fs.readFile(templateFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  public async listTemplates(): Promise<ProfileTemplate[]> {
    try {
      const files = await fs.readdir(this.templatesPath);
      const templates: ProfileTemplate[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const templateId = path.basename(file, '.json');
          const template = await this.getTemplate(templateId);
          if (template) {
            templates.push(template);
          }
        }
      }

      return templates;
    } catch (error) {
      return [];
    }
  }

  public async applyTemplate(templateId: string, profileId: string): Promise<boolean> {
    const template = await this.getTemplate(templateId);
    const profile = this.profiles.get(profileId);

    if (!template || !profile) return false;

    const updated = {
      ...profile,
      configuration: {
        ...profile.configuration,
        ...template.configuration
      },
      updatedAt: new Date()
    };

    this.profiles.set(profileId, updated);
    await this.saveProfiles();

    this.emit('template-applied', { templateId, profileId });
    return true;
  }

  // Default Profiles
  private async createDefaultProfiles(): Promise<void> {
    const defaultProfiles: Omit<DistributionProfile, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Mac App Store Production',
        platform: Platform.MAC_APP_STORE,
        bundleId: 'com.tacctile.ghosthunter',
        teamId: '',
        category: 'Utilities',
        configuration: {
          version: '1.0.0',
          buildNumber: 1,
          releaseChannel: 'production',
          autoPublish: false,
          phasedRelease: true,
          betaReview: false,
          expeditedReview: false
        }
      },
      {
        name: 'Microsoft Store Production',
        platform: Platform.MICROSOFT_STORE,
        bundleId: 'com.tacctile.ghosthunter',
        packageFamilyName: '',
        category: 'Utilities & tools',
        configuration: {
          version: '1.0.0',
          buildNumber: 1,
          releaseChannel: 'production',
          autoPublish: false,
          phasedRelease: false,
          betaReview: false,
          expeditedReview: false
        }
      }
    ];

    for (const profileData of defaultProfiles) {
      // Check if profile already exists
      const existing = Array.from(this.profiles.values()).find(p => 
        p.name === profileData.name && p.platform === profileData.platform
      );

      if (!existing) {
        await this.createProfile(profileData);
      }
    }
  }

  // Persistence
  private async loadProfiles(): Promise<void> {
    try {
      const profilesFile = path.join(this.profilesPath, 'profiles.json');
      const data = await fs.readFile(profilesFile, 'utf8');
      const profiles = JSON.parse(data);

      for (const profile of profiles) {
        this.profiles.set(profile.id, {
          ...profile,
          createdAt: new Date(profile.createdAt),
          updatedAt: new Date(profile.updatedAt)
        });
      }
    } catch (error) {
      // No profiles file exists yet
    }
  }

  private async saveProfiles(): Promise<void> {
    try {
      const profilesFile = path.join(this.profilesPath, 'profiles.json');
      const profiles = Array.from(this.profiles.values());
      await fs.writeFile(profilesFile, JSON.stringify(profiles, null, 2));
    } catch (error) {
      console.error('Failed to save profiles:', error);
    }
  }

  // Event Handling
  private emitEvent(event: DistributionEvent): void {
    this.emit('distribution-event', event);
  }

  public destroy(): void {
    this.removeAllListeners();
    console.log('DistributionProfileManager destroyed');
  }
}