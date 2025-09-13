/**
 * Auto-backup functionality for Tacctile
 * Creates periodic backups of investigations and user data
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { autoSave, AppState } from './autoSave';

export interface BackupConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxBackups: number;
  backupPath?: string;
  includeEvidence: boolean;
}

class AutoBackupManager {
  private backupTimer?: NodeJS.Timeout;
  private config: BackupConfig = {
    enabled: true,
    intervalMinutes: 30, // Backup every 30 minutes
    maxBackups: 10, // Keep 10 most recent backups
    includeEvidence: false, // Don't backup large evidence files by default
  };

  constructor() {
    this.loadConfig();
  }

  /**
   * Start automatic backup process
   */
  public start(): void {
    if (!this.config.enabled) return;

    this.stop(); // Clear any existing timer
    
    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    this.backupTimer = setInterval(() => {
      this.performBackup().catch(error => {
        console.error('Auto-backup failed:', error);
      });
    }, intervalMs);

    console.log(`Auto-backup started: every ${this.config.intervalMinutes} minutes`);
  }

  /**
   * Stop automatic backup process
   */
  public stop(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = undefined;
    }
  }

  /**
   * Perform backup immediately
   */
  public async performBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = this.getBackupDirectory();
    const backupFile = path.join(backupDir, `tacctile-backup-${timestamp}.json`);

    try {
      // Ensure backup directory exists
      await fs.mkdir(backupDir, { recursive: true });

      // Get current app state
      const appState = autoSave.loadAll();
      
      // Create backup data
      const backupData = {
        timestamp: new Date().toISOString(),
        version: app.getVersion(),
        appState: this.config.includeEvidence ? appState : this.excludeEvidence(appState),
        config: this.config,
      };

      // Write backup file
      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');

      // Clean up old backups
      await this.cleanupOldBackups(backupDir);

      console.log(`Backup created: ${backupFile}`);
      return backupFile;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  /**
   * Restore from backup file
   */
  public async restoreFromBackup(backupFilePath: string): Promise<void> {
    try {
      const backupData = JSON.parse(await fs.readFile(backupFilePath, 'utf8'));
      
      if (!backupData.appState) {
        throw new Error('Invalid backup file format');
      }

      // Restore app state
      const appState = backupData.appState as AppState;
      for (const [key, value] of Object.entries(appState)) {
        if (value !== undefined) {
          autoSave.saveNow(key as keyof AppState, value);
        }
      }

      console.log(`Restored from backup: ${backupFilePath}`);
    } catch (error) {
      console.error('Backup restoration failed:', error);
      throw error;
    }
  }

  /**
   * List available backup files
   */
  public async listBackups(): Promise<string[]> {
    const backupDir = this.getBackupDirectory();
    
    try {
      const files = await fs.readdir(backupDir);
      return files
        .filter(file => file.startsWith('tacctile-backup-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first
    } catch {
      return [];
    }
  }

  /**
   * Update backup configuration
   */
  public updateConfig(config: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    
    if (this.config.enabled) {
      this.start(); // Restart with new config
    } else {
      this.stop();
    }
  }

  /**
   * Get current backup configuration
   */
  public getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * Get backup directory path
   */
  private getBackupDirectory(): string {
    return this.config.backupPath || 
           path.join(app.getPath('userData'), 'backups');
  }

  /**
   * Remove evidence cache from app state to reduce backup size
   */
  private excludeEvidence(appState: AppState): AppState {
    const { evidenceCache, ...stateWithoutEvidence } = appState;
    return stateWithoutEvidence;
  }

  /**
   * Clean up old backup files
   */
  private async cleanupOldBackups(backupDir: string): Promise<void> {
    try {
      const files = await fs.readdir(backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('tacctile-backup-') && file.endsWith('.json'))
        .sort();

      if (backupFiles.length > this.config.maxBackups) {
        const filesToDelete = backupFiles.slice(0, backupFiles.length - this.config.maxBackups);
        
        for (const file of filesToDelete) {
          await fs.unlink(path.join(backupDir, file));
          console.log(`Deleted old backup: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old backups:', error);
    }
  }

  /**
   * Load backup configuration from storage
   */
  private loadConfig(): void {
    try {
      const storedConfig = autoSave.load<BackupConfig>('backupConfig');
      if (storedConfig) {
        this.config = { ...this.config, ...storedConfig };
      }
    } catch (error) {
      console.error('Failed to load backup config:', error);
    }
  }

  /**
   * Save backup configuration to storage
   */
  private saveConfig(): void {
    try {
      autoSave.saveNow('backupConfig', this.config);
    } catch (error) {
      console.error('Failed to save backup config:', error);
    }
  }
}

// Export singleton instance
export const autoBackup = new AutoBackupManager();
export default autoBackup;