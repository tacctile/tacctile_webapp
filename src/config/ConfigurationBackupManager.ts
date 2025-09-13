import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import {
  ConfigurationSchema,
  ConfigurationMetadata,
  ConfigurationBackup,
  ValidationResult
} from './types';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface BackupStrategy {
  automatic: boolean;
  schedule: string; // Cron expression
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  compression: boolean;
  encryption: boolean;
  incremental: boolean;
  location: 'local' | 'cloud' | 'both';
  maxBackupSize: number; // MB
  exclude: string[];
  include: string[];
}

export interface BackupStatistics {
  totalBackups: number;
  totalSize: number; // bytes
  compressionRatio: number; // percentage saved
  oldestBackup: Date;
  newestBackup: Date;
  automaticBackups: number;
  manualBackups: number;
  corruptedBackups: number;
  storageUsage: {
    local: number;
    cloud?: number;
  };
}

export interface RestoreOptions {
  validateIntegrity: boolean;
  createPreRestoreBackup: boolean;
  selectiveRestore: boolean;
  sections?: string[]; // Configuration sections to restore
  dryRun: boolean;
  overwriteExisting: boolean;
  preserveUserSettings: boolean;
}

export interface BackupJob {
  id: string;
  type: 'automatic' | 'manual' | 'scheduled';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  error?: string;
  backup?: ConfigurationBackup;
  estimatedTimeRemaining?: number; // seconds
}

export class ConfigurationBackupManager extends EventEmitter {
  private backupDirectory: string;
  private cloudBackupDirectory?: string;
  private strategy: BackupStrategy;
  private activeJobs: Map<string, BackupJob> = new Map();
  private encryptionKey?: Buffer;
  private scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    backupDirectory: string,
    strategy: BackupStrategy,
    cloudBackupDirectory?: string
  ) {
    super();
    this.backupDirectory = backupDirectory;
    this.cloudBackupDirectory = cloudBackupDirectory;
    this.strategy = strategy;
    this.setupScheduledBackups();
  }

  public async initialize(): Promise<void> {
    try {
      await this.ensureDirectories();
      await this.validateBackupIntegrity();
      await this.cleanupOldBackups();
      
      console.log('Configuration Backup Manager initialized');
      this.emit('initialized');
    } catch (error) {
      console.error('Failed to initialize backup manager:', error);
      this.emit('error', error);
      throw error;
    }
  }

  public async createBackup(
    config: ConfigurationSchema,
    metadata: ConfigurationMetadata,
    options: {
      name?: string;
      description?: string;
      automatic?: boolean;
      tags?: string[];
    } = {}
  ): Promise<ConfigurationBackup> {
    const jobId = crypto.randomUUID();
    const job: BackupJob = {
      id: jobId,
      type: options.automatic ? 'automatic' : 'manual',
      status: 'pending',
      progress: 0,
      startTime: new Date()
    };

    this.activeJobs.set(jobId, job);
    this.emit('backup-job-started', job);

    try {
      job.status = 'running';
      job.progress = 10;
      this.emit('backup-job-progress', job);

      // Create backup object
      const backup = await this.prepareBackup(config, metadata, options);
      job.progress = 30;
      this.emit('backup-job-progress', job);

      // Apply filters if specified
      const filteredConfig = this.applyBackupFilters(config);
      job.progress = 40;
      this.emit('backup-job-progress', job);

      // Compress if enabled
      let backupData = JSON.stringify({
        backup,
        config: filteredConfig
      }, null, 2);

      if (this.strategy.compression) {
        const compressed = await gzip(Buffer.from(backupData, 'utf8'));
        backupData = compressed.toString('base64');
        backup.compressed = true;
        backup.size = compressed.length;
      } else {
        backup.size = Buffer.byteLength(backupData, 'utf8');
      }

      job.progress = 60;
      this.emit('backup-job-progress', job);

      // Encrypt if enabled
      if (this.strategy.encryption && this.encryptionKey) {
        backupData = this.encryptData(backupData);
        backup.encrypted = true;
      }

      job.progress = 70;
      this.emit('backup-job-progress', job);

      // Calculate checksum
      backup.checksum = this.calculateChecksum(backupData);

      // Save to local storage
      await this.saveBackupLocally(backup, backupData);
      job.progress = 85;
      this.emit('backup-job-progress', job);

      // Save to cloud if configured
      if ((this.strategy.location === 'cloud' || this.strategy.location === 'both') && 
          this.cloudBackupDirectory) {
        await this.saveBackupToCloud(backup, backupData);
      }

      job.progress = 100;
      job.status = 'completed';
      job.endTime = new Date();
      job.backup = backup;

      this.emit('backup-job-completed', job);
      this.emit('backup-created', backup);
      
      console.log(`Configuration backup created: ${backup.name} (${this.formatBytes(backup.size)})`);
      
      return backup;

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.endTime = new Date();

      this.emit('backup-job-failed', job);
      console.error('Failed to create backup:', error);
      throw error;

    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  public async restoreBackup(
    backupId: string,
    options: RestoreOptions = {
      validateIntegrity: true,
      createPreRestoreBackup: true,
      selectiveRestore: false,
      dryRun: false,
      overwriteExisting: true,
      preserveUserSettings: false
    }
  ): Promise<{ config: ConfigurationSchema; metadata: ConfigurationMetadata }> {
    try {
      console.log(`Starting restore from backup: ${backupId}`);
      
      // Load backup
      const { backup, data } = await this.loadBackup(backupId);
      
      // Validate integrity if requested
      if (options.validateIntegrity) {
        await this.validateBackupIntegrity(backup, data);
      }
      
      // Decrypt if needed
      let backupData = data;
      if (backup.encrypted && this.encryptionKey) {
        backupData = this.decryptData(backupData);
      }
      
      // Decompress if needed
      if (backup.compressed) {
        const decompressed = await gunzip(Buffer.from(backupData, 'base64'));
        backupData = decompressed.toString('utf8');
      }
      
      // Parse backup data
      const parsed = JSON.parse(backupData);
      let restoredConfig = parsed.config as ConfigurationSchema;
      const restoredMetadata = parsed.backup.metadata as ConfigurationMetadata;
      
      // Apply selective restore if specified
      if (options.selectiveRestore && options.sections) {
        restoredConfig = this.applySelectiveRestore(restoredConfig, options.sections);
      }
      
      // Preserve user settings if requested
      if (options.preserveUserSettings) {
        // This would merge current user preferences with restored config
        // Implementation depends on current config access
      }
      
      if (options.dryRun) {
        console.log('Dry run completed successfully - no changes made');
        return { config: restoredConfig, metadata: restoredMetadata };
      }
      
      this.emit('backup-restored', { backup, config: restoredConfig });
      console.log(`Configuration restored from backup: ${backup.name}`);
      
      return { config: restoredConfig, metadata: restoredMetadata };
      
    } catch (error) {
      console.error('Failed to restore backup:', error);
      this.emit('restore-failed', { backupId, error: error.message });
      throw error;
    }
  }

  public async listBackups(filters?: {
    automatic?: boolean;
    dateRange?: { start: Date; end: Date };
    tags?: string[];
    minSize?: number;
    maxSize?: number;
  }): Promise<ConfigurationBackup[]> {
    try {
      const backups: ConfigurationBackup[] = [];
      
      // Load local backups
      const localBackups = await this.loadLocalBackups();
      backups.push(...localBackups);
      
      // Load cloud backups if available
      if (this.cloudBackupDirectory) {
        const cloudBackups = await this.loadCloudBackups();
        backups.push(...cloudBackups);
      }
      
      // Remove duplicates (same ID from different locations)
      const uniqueBackups = new Map();
      for (const backup of backups) {
        if (!uniqueBackups.has(backup.id) || 
            new Date(backup.created) > new Date(uniqueBackups.get(backup.id).created)) {
          uniqueBackups.set(backup.id, backup);
        }
      }
      
      let filteredBackups = Array.from(uniqueBackups.values());
      
      // Apply filters
      if (filters) {
        if (filters.automatic !== undefined) {
          filteredBackups = filteredBackups.filter(b => b.automatic === filters.automatic);
        }
        
        if (filters.dateRange) {
          filteredBackups = filteredBackups.filter(b => {
            const date = new Date(b.created);
            return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
          });
        }
        
        if (filters.tags && filters.tags.length > 0) {
          filteredBackups = filteredBackups.filter(b =>
            filters.tags!.some(tag => b.metadata.tags.includes(tag))
          );
        }
        
        if (filters.minSize !== undefined) {
          filteredBackups = filteredBackups.filter(b => b.size >= filters.minSize!);
        }
        
        if (filters.maxSize !== undefined) {
          filteredBackups = filteredBackups.filter(b => b.size <= filters.maxSize!);
        }
      }
      
      // Sort by creation date (newest first)
      filteredBackups.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      
      return filteredBackups;
      
    } catch (error) {
      console.error('Failed to list backups:', error);
      return [];
    }
  }

  public async deleteBackup(backupId: string): Promise<void> {
    try {
      // Delete from local storage
      const localPath = path.join(this.backupDirectory, `${backupId}.backup`);
      try {
        await fs.unlink(localPath);
      } catch (error) {
        console.warn(`Local backup file not found: ${localPath}`);
      }
      
      // Delete from cloud storage
      if (this.cloudBackupDirectory) {
        await this.deleteCloudBackup(backupId);
      }
      
      this.emit('backup-deleted', backupId);
      console.log(`Backup deleted: ${backupId}`);
      
    } catch (error) {
      console.error('Failed to delete backup:', error);
      throw error;
    }
  }

  public async getBackupStatistics(): Promise<BackupStatistics> {
    const backups = await this.listBackups();
    
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    const originalSize = backups.reduce((sum, backup) => {
      // Estimate original size if compressed
      return sum + (backup.compressed ? backup.size * 3 : backup.size); // Assume 3:1 compression
    }, 0);
    
    const compressionRatio = originalSize > 0 ? 
      ((originalSize - totalSize) / originalSize) * 100 : 0;
    
    const dates = backups.map(b => new Date(b.created)).sort((a, b) => a.getTime() - b.getTime());
    
    return {
      totalBackups: backups.length,
      totalSize,
      compressionRatio,
      oldestBackup: dates[0] || new Date(),
      newestBackup: dates[dates.length - 1] || new Date(),
      automaticBackups: backups.filter(b => b.automatic).length,
      manualBackups: backups.filter(b => !b.automatic).length,
      corruptedBackups: 0, // Would be determined by integrity checks
      storageUsage: {
        local: totalSize, // Simplified
        cloud: this.cloudBackupDirectory ? totalSize : undefined
      }
    };
  }

  public async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await this.listBackups();
      const now = new Date();
      let deletedCount = 0;
      
      // Group backups by type
      const categorizedBackups = {
        daily: [] as ConfigurationBackup[],
        weekly: [] as ConfigurationBackup[],
        monthly: [] as ConfigurationBackup[],
        yearly: [] as ConfigurationBackup[]
      };
      
      // Categorize backups by age
      for (const backup of backups) {
        const age = now.getTime() - new Date(backup.created).getTime();
        const ageInDays = age / (1000 * 60 * 60 * 24);
        
        if (ageInDays <= 7) {
          categorizedBackups.daily.push(backup);
        } else if (ageInDays <= 30) {
          categorizedBackups.weekly.push(backup);
        } else if (ageInDays <= 365) {
          categorizedBackups.monthly.push(backup);
        } else {
          categorizedBackups.yearly.push(backup);
        }
      }
      
      // Apply retention policy
      const toDelete: ConfigurationBackup[] = [];
      
      if (categorizedBackups.daily.length > this.strategy.retention.daily) {
        const excess = categorizedBackups.daily.slice(this.strategy.retention.daily);
        toDelete.push(...excess.filter(b => !b.retained));
      }
      
      if (categorizedBackups.weekly.length > this.strategy.retention.weekly) {
        const excess = categorizedBackups.weekly.slice(this.strategy.retention.weekly);
        toDelete.push(...excess.filter(b => !b.retained));
      }
      
      if (categorizedBackups.monthly.length > this.strategy.retention.monthly) {
        const excess = categorizedBackups.monthly.slice(this.strategy.retention.monthly);
        toDelete.push(...excess.filter(b => !b.retained));
      }
      
      if (categorizedBackups.yearly.length > this.strategy.retention.yearly) {
        const excess = categorizedBackups.yearly.slice(this.strategy.retention.yearly);
        toDelete.push(...excess.filter(b => !b.retained));
      }
      
      // Delete excess backups
      for (const backup of toDelete) {
        try {
          await this.deleteBackup(backup.id);
          deletedCount++;
        } catch (error) {
          console.warn(`Failed to delete backup ${backup.id}:`, error);
        }
      }
      
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old backups`);
        this.emit('cleanup-completed', { deletedCount });
      }
      
      return deletedCount;
      
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
      return 0;
    }
  }

  public async validateBackupIntegrity(
    backup?: ConfigurationBackup,
    data?: string
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    if (backup && data) {
      // Validate single backup
      const calculatedChecksum = this.calculateChecksum(data);
      if (calculatedChecksum !== backup.checksum) {
        results.push({
          path: backup.id,
          message: 'Backup checksum validation failed - data may be corrupted',
          severity: 'error',
          code: 'CHECKSUM_MISMATCH'
        });
      }
    } else {
      // Validate all backups
      const backups = await this.listBackups();
      
      for (const backup of backups) {
        try {
          const { data: backupData } = await this.loadBackup(backup.id);
          const calculatedChecksum = this.calculateChecksum(backupData);
          
          if (calculatedChecksum !== backup.checksum) {
            results.push({
              path: backup.id,
              message: `Backup '${backup.name}' checksum validation failed`,
              severity: 'error',
              code: 'CHECKSUM_MISMATCH'
            });
          }
        } catch (error) {
          results.push({
            path: backup.id,
            message: `Failed to validate backup '${backup.name}': ${error.message}`,
            severity: 'error',
            code: 'VALIDATION_ERROR'
          });
        }
      }
    }
    
    return results;
  }

  public updateStrategy(newStrategy: Partial<BackupStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
    this.setupScheduledBackups(); // Restart scheduled jobs with new settings
    this.emit('strategy-updated', this.strategy);
  }

  public getActiveJobs(): BackupJob[] {
    return Array.from(this.activeJobs.values());
  }

  public cancelJob(jobId: string): boolean {
    const job = this.activeJobs.get(jobId);
    if (job && (job.status === 'pending' || job.status === 'running')) {
      job.status = 'cancelled';
      job.endTime = new Date();
      this.activeJobs.delete(jobId);
      this.emit('backup-job-cancelled', job);
      return true;
    }
    return false;
  }

  private async prepareBackup(
    config: ConfigurationSchema,
    metadata: ConfigurationMetadata,
    options: { name?: string; description?: string }
  ): Promise<ConfigurationBackup> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = options.name || `auto-backup-${timestamp}`;
    
    return {
      id: crypto.randomUUID(),
      name: backupName,
      description: options.description || 
        `Configuration backup created on ${new Date().toLocaleString()}`,
      created: new Date().toISOString(),
      size: 0, // Will be set later
      checksum: '', // Will be set later
      encrypted: false, // Will be set based on encryption
      compressed: false, // Will be set based on compression
      automatic: options.automatic || false,
      retained: false,
      configuration: config,
      metadata: {
        ...metadata,
        tags: [...(metadata.tags || []), ...(options.tags || [])]
      }
    };
  }

  private applyBackupFilters(config: ConfigurationSchema): ConfigurationSchema {
    const filteredConfig = JSON.parse(JSON.stringify(config)); // Deep clone
    
    // Apply include/exclude filters
    for (const excludePath of this.strategy.exclude) {
      this.deleteNestedPath(filteredConfig, excludePath);
    }
    
    return filteredConfig;
  }

  private applySelectiveRestore(
    config: ConfigurationSchema,
    sections: string[]
  ): ConfigurationSchema {
    const result = {} as ConfigurationSchema;
    
    for (const section of sections) {
      if (section in config) {
        (result as Record<string, unknown>)[section] = (config as Record<string, unknown>)[section];
      }
    }
    
    return result;
  }

  private async saveBackupLocally(backup: ConfigurationBackup, data: string): Promise<string> {
    const filePath = path.join(this.backupDirectory, `${backup.id}.backup`);
    
    const backupFile = {
      backup,
      data
    };
    
    await fs.writeFile(filePath, JSON.stringify(backupFile, null, 2), 'utf8');
    return filePath;
  }

  private async saveBackupToCloud(backup: ConfigurationBackup, _data: string): Promise<void> {
    // Cloud backup implementation would go here
    // This is a placeholder for cloud storage integration
    console.log(`Cloud backup would be saved: ${backup.id}`);
  }

  private async loadBackup(backupId: string): Promise<{ backup: ConfigurationBackup; data: string }> {
    // Try local first
    const localPath = path.join(this.backupDirectory, `${backupId}.backup`);
    
    try {
      const content = await fs.readFile(localPath, 'utf8');
      const parsed = JSON.parse(content);
      return { backup: parsed.backup, data: parsed.data };
    } catch (localError) {
      // Try cloud if available
      if (this.cloudBackupDirectory) {
        return await this.loadCloudBackup(backupId);
      }
      throw new Error(`Backup not found: ${backupId}`);
    }
  }

  private async loadLocalBackups(): Promise<ConfigurationBackup[]> {
    const backups: ConfigurationBackup[] = [];
    
    try {
      const files = await fs.readdir(this.backupDirectory);
      
      for (const file of files) {
        if (file.endsWith('.backup')) {
          try {
            const content = await fs.readFile(path.join(this.backupDirectory, file), 'utf8');
            const parsed = JSON.parse(content);
            backups.push(parsed.backup);
          } catch (error) {
            console.warn(`Failed to read backup file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to read backup directory:', error);
    }
    
    return backups;
  }

  private async loadCloudBackups(): Promise<ConfigurationBackup[]> {
    // Cloud backup loading implementation would go here
    return [];
  }

  private async loadCloudBackup(backupId: string): Promise<{ backup: ConfigurationBackup; data: string }> {
    // Cloud backup loading implementation would go here
    throw new Error('Cloud backup not implemented');
  }

  private async deleteCloudBackup(backupId: string): Promise<void> {
    // Cloud backup deletion implementation would go here
    console.log(`Cloud backup deletion would happen: ${backupId}`);
  }

  private encryptData(data: string): string {
    if (!this.encryptionKey) throw new Error('Encryption key not set');
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptData(encryptedData: string): string {
    if (!this.encryptionKey) throw new Error('Encryption key not set');
    
    const [ivHex, encrypted] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private calculateChecksum(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  private deleteNestedPath(obj: any, path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => current?.[key], obj);
    if (target && lastKey in target) {
      delete target[lastKey];
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.backupDirectory, { recursive: true });
    if (this.cloudBackupDirectory) {
      await fs.mkdir(this.cloudBackupDirectory, { recursive: true });
    }
  }

  private setupScheduledBackups(): void {
    // Clear existing scheduled jobs
    for (const [id, timeout] of this.scheduledJobs) {
      clearTimeout(timeout);
    }
    this.scheduledJobs.clear();
    
    if (!this.strategy.automatic || !this.strategy.schedule) {
      return;
    }
    
    // Parse cron schedule and set up timer
    // This is a simplified implementation - would use a proper cron parser
    console.log(`Scheduled backup configured: ${this.strategy.schedule}`);
  }

  public setEncryptionKey(key: string): void {
    this.encryptionKey = crypto.scryptSync(key, 'salt', 32);
  }

  public async dispose(): Promise<void> {
    // Cancel all active jobs
    for (const [jobId] of this.activeJobs) {
      this.cancelJob(jobId);
    }
    
    // Clear scheduled jobs
    for (const [id, timeout] of this.scheduledJobs) {
      clearTimeout(timeout);
    }
    this.scheduledJobs.clear();
    
    this.removeAllListeners();
  }
}