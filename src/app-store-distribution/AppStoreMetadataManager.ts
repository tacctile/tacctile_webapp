/**
 * App Store Metadata Manager
 * Manages app store listings, descriptions, screenshots, and marketing assets
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp';
import {
  AppStoreMetadata,
  AppStoreAssets,
  Platform,
  Screenshot,
  ScreenshotType,
  MarketingAsset,
  AssetType,
  ValidationResult,
  ValidationStatus,
  ValidationType
} from './types';

export interface MetadataTemplate {
  platform: Platform;
  name: string;
  description: string;
  metadata: Partial<AppStoreMetadata>;
  assets: Partial<AppStoreAssets>;
}

export interface AssetRequirements {
  platform: Platform;
  type: AssetType | ScreenshotType;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  aspectRatio?: number;
  format: string[];
  maxSize: number; // in bytes
  required: boolean;
}

export class AppStoreMetadataManager extends EventEmitter {
  private metadataPath: string;
  private assetsPath: string;
  private templatesPath: string;
  private requirements: Map<string, AssetRequirements[]> = new Map();

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.metadataPath = path.join(userDataPath, 'metadata');
    this.assetsPath = path.join(userDataPath, 'assets');
    this.templatesPath = path.join(userDataPath, 'templates');
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.metadataPath, { recursive: true });
      await fs.mkdir(this.assetsPath, { recursive: true });
      await fs.mkdir(this.templatesPath, { recursive: true });
      
      this.initializeAssetRequirements();
      await this.loadDefaultTemplates();
      
      console.log('AppStoreMetadataManager initialized successfully');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize AppStoreMetadataManager:', error);
      throw error;
    }
  }

  private initializeAssetRequirements(): void {
    // Mac App Store requirements
    this.requirements.set('MAC_APP_STORE', [
      {
        platform: Platform.MAC_APP_STORE,
        type: AssetType.APP_ICON,
        minWidth: 1024,
        maxWidth: 1024,
        minHeight: 1024,
        maxHeight: 1024,
        aspectRatio: 1,
        format: ['png'],
        maxSize: 1024 * 1024, // 1MB
        required: true
      },
      {
        platform: Platform.MAC_APP_STORE,
        type: ScreenshotType.DESKTOP,
        minWidth: 1280,
        maxWidth: 2880,
        minHeight: 800,
        maxHeight: 1800,
        format: ['png', 'jpg'],
        maxSize: 5 * 1024 * 1024, // 5MB
        required: true
      },
      {
        platform: Platform.MAC_APP_STORE,
        type: AssetType.PREVIEW_VIDEO,
        minWidth: 1920,
        maxWidth: 1920,
        minHeight: 1080,
        maxHeight: 1080,
        format: ['mp4', 'mov'],
        maxSize: 500 * 1024 * 1024, // 500MB
        required: false
      }
    ]);

    // Microsoft Store requirements
    this.requirements.set('MICROSOFT_STORE', [
      {
        platform: Platform.MICROSOFT_STORE,
        type: AssetType.APP_ICON,
        minWidth: 150,
        maxWidth: 300,
        minHeight: 150,
        maxHeight: 300,
        aspectRatio: 1,
        format: ['png'],
        maxSize: 512 * 1024, // 512KB
        required: true
      },
      {
        platform: Platform.MICROSOFT_STORE,
        type: ScreenshotType.DESKTOP,
        minWidth: 1366,
        maxWidth: 3840,
        minHeight: 768,
        maxHeight: 2160,
        format: ['png', 'jpg'],
        maxSize: 2 * 1024 * 1024, // 2MB
        required: true
      },
      {
        platform: Platform.MICROSOFT_STORE,
        type: AssetType.STORE_LOGO,
        minWidth: 300,
        maxWidth: 300,
        minHeight: 300,
        maxHeight: 300,
        aspectRatio: 1,
        format: ['png'],
        maxSize: 256 * 1024, // 256KB
        required: true
      }
    ]);
  }

  // Metadata Management
  public async createMetadata(
    platform: Platform,
    metadata: Omit<AppStoreMetadata, 'id' | 'platform' | 'createdAt' | 'updatedAt'>
  ): Promise<AppStoreMetadata> {
    const fullMetadata: AppStoreMetadata = {
      ...metadata,
      id: crypto.randomUUID(),
      platform,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.saveMetadata(fullMetadata);
    this.emit('metadata-created', fullMetadata);
    return fullMetadata;
  }

  public async updateMetadata(
    metadataId: string,
    updates: Partial<AppStoreMetadata>
  ): Promise<AppStoreMetadata | null> {
    const metadata = await this.loadMetadata(metadataId);
    if (!metadata) return null;

    const updated = {
      ...metadata,
      ...updates,
      updatedAt: new Date()
    };

    await this.saveMetadata(updated);
    this.emit('metadata-updated', updated);
    return updated;
  }

  public async getMetadata(metadataId: string): Promise<AppStoreMetadata | null> {
    return await this.loadMetadata(metadataId);
  }

  public async deleteMetadata(metadataId: string): Promise<boolean> {
    try {
      const metadataFile = path.join(this.metadataPath, `${metadataId}.json`);
      await fs.unlink(metadataFile);
      
      // Also delete associated assets
      const assetsDir = path.join(this.assetsPath, metadataId);
      await fs.rmdir(assetsDir, { recursive: true }).catch(() => {
        // Ignore errors when removing assets directory
      });
      
      this.emit('metadata-deleted', metadataId);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Asset Management
  public async uploadAsset(
    metadataId: string,
    assetType: AssetType | ScreenshotType,
    filePath: string,
    options?: {
      deviceType?: string;
      locale?: string;
      description?: string;
    }
  ): Promise<MarketingAsset | Screenshot> {
    const metadata = await this.loadMetadata(metadataId);
    if (!metadata) {
      throw new Error(`Metadata not found: ${metadataId}`);
    }

    // Validate asset requirements
    const requirements = this.getAssetRequirements(metadata.platform, assetType);
    if (requirements) {
      const validationResult = await this.validateAsset(filePath, requirements);
      if (validationResult.status === ValidationStatus.FAILED) {
        throw new Error(`Asset validation failed: ${validationResult.message}`);
      }
    }

    const assetId = crypto.randomUUID();
    const assetDir = path.join(this.assetsPath, metadataId);
    await fs.mkdir(assetDir, { recursive: true });

    // Process and optimize the asset
    const processedAsset = await this.processAsset(filePath, assetDir, assetId, assetType);

    let asset: MarketingAsset | Screenshot;

    if (this.isScreenshotType(assetType)) {
      asset = {
        id: assetId,
        type: assetType as ScreenshotType,
        filePath: processedAsset.path,
        filename: processedAsset.filename,
        size: processedAsset.size,
        dimensions: processedAsset.dimensions,
        deviceType: options?.deviceType || 'desktop',
        locale: options?.locale || 'en-US',
        displayOrder: 0,
        caption: options?.description || ''
      };
    } else {
      asset = {
        id: assetId,
        type: assetType as AssetType,
        filePath: processedAsset.path,
        filename: processedAsset.filename,
        size: processedAsset.size,
        dimensions: processedAsset.dimensions,
        locale: options?.locale || 'en-US'
      };
    }

    // Update metadata with the new asset
    const updatedAssets = { ...metadata.assets };
    if (this.isScreenshotType(assetType)) {
      updatedAssets.screenshots = updatedAssets.screenshots || [];
      updatedAssets.screenshots.push(asset as Screenshot);
    } else {
      updatedAssets.marketingAssets = updatedAssets.marketingAssets || [];
      updatedAssets.marketingAssets.push(asset as MarketingAsset);
    }

    await this.updateMetadata(metadataId, { assets: updatedAssets });
    this.emit('asset-uploaded', { metadataId, asset });
    
    return asset;
  }

  private async processAsset(
    sourcePath: string,
    targetDir: string,
    assetId: string,
    assetType: AssetType | ScreenshotType
  ): Promise<{
    path: string;
    filename: string;
    size: number;
    dimensions: { width: number; height: number };
  }> {
    const ext = path.extname(sourcePath);
    const filename = `${assetId}${ext}`;
    const targetPath = path.join(targetDir, filename);

    // Copy the file first
    await fs.copyFile(sourcePath, targetPath);

    // Get image metadata using sharp
    let dimensions = { width: 0, height: 0 };
    let size = 0;

    try {
      if (['.png', '.jpg', '.jpeg'].includes(ext.toLowerCase())) {
        const image = sharp(targetPath);
        const metadata = await image.metadata();
        dimensions = {
          width: metadata.width || 0,
          height: metadata.height || 0
        };

        // Optimize image if it's too large
        if (assetType === AssetType.APP_ICON) {
          await image
            .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ compressionLevel: 9 })
            .toFile(targetPath.replace(ext, '.png'));
        }
      }

      const stats = await fs.stat(targetPath);
      size = stats.size;
    } catch (error) {
      console.warn('Failed to process asset metadata:', error);
    }

    return {
      path: targetPath,
      filename,
      size,
      dimensions
    };
  }

  public async removeAsset(
    metadataId: string,
    assetId: string
  ): Promise<boolean> {
    try {
      const metadata = await this.loadMetadata(metadataId);
      if (!metadata) return false;

      // Remove from screenshots
      const updatedScreenshots = metadata.assets.screenshots?.filter(s => s.id !== assetId) || [];
      
      // Remove from marketing assets
      const updatedMarketingAssets = metadata.assets.marketingAssets?.filter(a => a.id !== assetId) || [];

      // Find the asset to get its file path
      const allAssets = [
        ...(metadata.assets.screenshots || []),
        ...(metadata.assets.marketingAssets || [])
      ];
      const asset = allAssets.find(a => a.id === assetId);

      if (asset) {
        // Delete the physical file
        await fs.unlink(asset.filePath).catch(() => {
          // Ignore errors when removing asset file
        });

        // Update metadata
        const updatedAssets = {
          ...metadata.assets,
          screenshots: updatedScreenshots,
          marketingAssets: updatedMarketingAssets
        };

        await this.updateMetadata(metadataId, { assets: updatedAssets });
        this.emit('asset-removed', { metadataId, assetId });
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  // Validation
  public async validateAsset(
    filePath: string,
    requirements: AssetRequirements
  ): Promise<ValidationResult> {
    try {
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // Check file size
      if (fileSize > requirements.maxSize) {
        return {
          type: ValidationType.ASSETS,
          status: ValidationStatus.FAILED,
          message: `File size ${fileSize} exceeds maximum ${requirements.maxSize} bytes`
        };
      }

      // Check file format
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      if (!requirements.format.includes(ext)) {
        return {
          type: ValidationType.ASSETS,
          status: ValidationStatus.FAILED,
          message: `File format ${ext} not supported. Supported formats: ${requirements.format.join(', ')}`
        };
      }

      // Check image dimensions if it's an image
      if (['png', 'jpg', 'jpeg'].includes(ext)) {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        const width = metadata.width || 0;
        const height = metadata.height || 0;

        if (width < requirements.minWidth || width > requirements.maxWidth) {
          return {
            type: ValidationType.ASSETS,
            status: ValidationStatus.FAILED,
            message: `Image width ${width} outside allowed range ${requirements.minWidth}-${requirements.maxWidth}`
          };
        }

        if (height < requirements.minHeight || height > requirements.maxHeight) {
          return {
            type: ValidationType.ASSETS,
            status: ValidationStatus.FAILED,
            message: `Image height ${height} outside allowed range ${requirements.minHeight}-${requirements.maxHeight}`
          };
        }

        // Check aspect ratio if specified
        if (requirements.aspectRatio) {
          const actualRatio = width / height;
          const expectedRatio = requirements.aspectRatio;
          const tolerance = 0.1;

          if (Math.abs(actualRatio - expectedRatio) > tolerance) {
            return {
              type: ValidationType.ASSETS,
              status: ValidationStatus.FAILED,
              message: `Image aspect ratio ${actualRatio.toFixed(2)} doesn't match required ${expectedRatio}`
            };
          }
        }
      }

      return {
        type: ValidationType.ASSETS,
        status: ValidationStatus.PASSED,
        message: 'Asset validation passed'
      };
    } catch (error) {
      return {
        type: ValidationType.ASSETS,
        status: ValidationStatus.FAILED,
        message: `Validation error: ${error.message}`
      };
    }
  }

  public async validateMetadata(metadata: AppStoreMetadata): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Validate required fields
    if (!metadata.name.trim()) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'App name is required'
      });
    }

    if (!metadata.shortDescription.trim()) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Short description is required'
      });
    }

    if (!metadata.fullDescription.trim()) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: 'Full description is required'
      });
    }

    // Validate description length limits
    const platformLimits = this.getDescriptionLimits(metadata.platform);
    if (metadata.shortDescription.length > platformLimits.shortDescription) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: `Short description exceeds ${platformLimits.shortDescription} characters`
      });
    }

    if (metadata.fullDescription.length > platformLimits.fullDescription) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.FAILED,
        message: `Full description exceeds ${platformLimits.fullDescription} characters`
      });
    }

    // Validate required assets
    const requiredAssets = this.getRequiredAssets(metadata.platform);
    for (const requirement of requiredAssets) {
      if (requirement.required) {
        const hasAsset = this.hasRequiredAsset(metadata.assets, requirement.type);
        if (!hasAsset) {
          results.push({
            type: ValidationType.ASSETS,
            status: ValidationStatus.FAILED,
            message: `Required asset missing: ${requirement.type}`
          });
        }
      }
    }

    // If no failures, add success result
    if (results.length === 0 || results.every(r => r.status !== ValidationStatus.FAILED)) {
      results.push({
        type: ValidationType.METADATA,
        status: ValidationStatus.PASSED,
        message: 'Metadata validation passed'
      });
    }

    return results;
  }

  // Templates
  public async createTemplate(template: MetadataTemplate): Promise<string> {
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

  public async getTemplate(templateId: string): Promise<MetadataTemplate | null> {
    try {
      const templateFile = path.join(this.templatesPath, `${templateId}.json`);
      const data = await fs.readFile(templateFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  public async listTemplates(): Promise<MetadataTemplate[]> {
    try {
      const files = await fs.readdir(this.templatesPath);
      const templates: MetadataTemplate[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const templateData = await this.getTemplate(path.basename(file, '.json'));
          if (templateData) {
            templates.push(templateData);
          }
        }
      }

      return templates;
    } catch (error) {
      return [];
    }
  }

  public async applyTemplate(templateId: string, metadataId: string): Promise<boolean> {
    const template = await this.getTemplate(templateId);
    const metadata = await this.loadMetadata(metadataId);

    if (!template || !metadata) return false;

    const updated = {
      ...metadata,
      ...template.metadata,
      assets: {
        ...metadata.assets,
        ...template.assets
      },
      updatedAt: new Date()
    };

    await this.saveMetadata(updated);
    this.emit('template-applied', { templateId, metadataId });
    return true;
  }

  // Helper methods
  private async loadDefaultTemplates(): Promise<void> {
    // Create default templates for common app categories
    const defaultTemplates: Omit<MetadataTemplate, 'id'>[] = [
      {
        platform: Platform.MAC_APP_STORE,
        name: 'Utility App Template',
        description: 'Template for utility applications',
        metadata: {
          category: 'Utilities',
          keywords: ['utility', 'productivity', 'tool'],
          minimumAge: '4+',
          supportURL: 'https://example.com/support',
          privacyURL: 'https://example.com/privacy'
        },
        assets: {}
      },
      {
        platform: Platform.MICROSOFT_STORE,
        name: 'Business App Template',
        description: 'Template for business applications',
        metadata: {
          category: 'Business',
          keywords: ['business', 'productivity', 'professional'],
          minimumAge: '4+',
          supportURL: 'https://example.com/support',
          privacyURL: 'https://example.com/privacy'
        },
        assets: {}
      }
    ];

    for (const template of defaultTemplates) {
      const templateFile = path.join(this.templatesPath, `${template.name.toLowerCase().replace(/\s+/g, '_')}.json`);
      
      // Only create if it doesn't exist
      try {
        await fs.access(templateFile);
      } catch (error) {
        await fs.writeFile(templateFile, JSON.stringify(template, null, 2));
      }
    }
  }

  private getAssetRequirements(platform: Platform, assetType: AssetType | ScreenshotType): AssetRequirements | null {
    const requirements = this.requirements.get(platform.toString());
    return requirements?.find(req => req.type === assetType) || null;
  }

  private getRequiredAssets(platform: Platform): AssetRequirements[] {
    const requirements = this.requirements.get(platform.toString());
    return requirements?.filter(req => req.required) || [];
  }

  private getDescriptionLimits(platform: Platform): { shortDescription: number; fullDescription: number } {
    switch (platform) {
      case Platform.MAC_APP_STORE:
        return { shortDescription: 170, fullDescription: 4000 };
      case Platform.MICROSOFT_STORE:
        return { shortDescription: 200, fullDescription: 10000 };
      default:
        return { shortDescription: 150, fullDescription: 4000 };
    }
  }

  private hasRequiredAsset(assets: AppStoreAssets, assetType: AssetType | ScreenshotType): boolean {
    if (this.isScreenshotType(assetType)) {
      return assets.screenshots?.some(s => s.type === assetType) || false;
    } else {
      return assets.marketingAssets?.some(a => a.type === assetType) || false;
    }
  }

  private isScreenshotType(type: AssetType | ScreenshotType): type is ScreenshotType {
    return Object.values(ScreenshotType).includes(type as ScreenshotType);
  }

  private async saveMetadata(metadata: AppStoreMetadata): Promise<void> {
    const metadataFile = path.join(this.metadataPath, `${metadata.id}.json`);
    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
  }

  private async loadMetadata(metadataId: string): Promise<AppStoreMetadata | null> {
    try {
      const metadataFile = path.join(this.metadataPath, `${metadataId}.json`);
      const data = await fs.readFile(metadataFile, 'utf8');
      const metadata = JSON.parse(data);
      
      return {
        ...metadata,
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(metadata.updatedAt)
      };
    } catch (error) {
      return null;
    }
  }

  public destroy(): void {
    this.removeAllListeners();
    console.log('AppStoreMetadataManager destroyed');
  }
}