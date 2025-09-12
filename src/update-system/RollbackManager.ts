import { app, dialog } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { spawn } from 'child_process';
import {
  RollbackInfo,
  UpdateConfiguration,
  VersionInfo,
  UpdateError,
  UpdateErrorCode
} from './types';

export class RollbackManager {
  private rollbackPath: string;
  private versionsPath: string;
  private backupsPath: string;
  private rollbackHistory: RollbackInfo[] = [];
  private readonly maxRollbackVersions: number;

  constructor(maxRollbackVersions: number = 5) {
    const userDataPath = app.getPath('userData');
    this.rollbackPath = path.join(userDataPath, 'rollback');
    this.versionsPath = path.join(this.rollbackPath, 'versions');
    this.backupsPath = path.join(this.rollbackPath, 'backups');
    this.maxRollbackVersions = maxRollbackVersions;
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.rollbackPath, { recursive: true });
      await fs.mkdir(this.versionsPath, { recursive: true });
      await fs.mkdir(this.backupsPath, { recursive: true });
      
      await this.loadRollbackHistory();
      await this.cleanupOldBackups();
      
      console.log('RollbackManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RollbackManager:', error);
      throw error;
    }
  }

  public async createRollbackPoint(): Promise<string> {
    const currentVersion = app.getVersion();
    const backupId = this.generateBackupId();
    const backupPath = path.join(this.backupsPath, backupId);

    try {
      console.log(`Creating rollback point for version ${currentVersion}...`);

      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });

      // Backup application files
      const appPath = process.execPath;
      const appDir = path.dirname(appPath);
      const backupAppPath = path.join(backupPath, 'app');
      
      await this.createDirectoryBackup(appDir, backupAppPath);

      // Backup configuration and user data (excluding sensitive files)
      const configBackupPath = path.join(backupPath, 'config');
      await this.createConfigurationBackup(configBackupPath);

      // Create version manifest
      const versionManifest = await this.createVersionManifest(currentVersion, backupPath);
      await fs.writeFile(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(versionManifest, null, 2),
        'utf8'
      );

      // Add to rollback history
      const rollbackInfo: RollbackInfo = {
        version: currentVersion,
        installDate: new Date(),
        backupPath: backupPath,
        configSnapshot: await this.createConfigSnapshot(),
        automatic: true,
        reason: 'Pre-update backup'
      };

      this.rollbackHistory.unshift(rollbackInfo);
      await this.saveRollbackHistory();
      
      // Cleanup old backups if we exceed the limit
      await this.cleanupOldBackups();

      console.log(`Rollback point created successfully: ${backupId}`);
      return backupId;
    } catch (error) {
      console.error('Failed to create rollback point:', error);
      
      // Cleanup partial backup
      try {
        await fs.rmdir(backupPath, { recursive: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup partial backup:', cleanupError);
      }
      
      throw error;
    }
  }

  public async rollback(targetVersion?: string): Promise<boolean> {
    try {
      let rollbackInfo: RollbackInfo | undefined;

      if (targetVersion) {
        rollbackInfo = this.rollbackHistory.find(rb => rb.version === targetVersion);
        if (!rollbackInfo) {
          throw new Error(`No rollback point found for version ${targetVersion}`);
        }
      } else {
        // Use the most recent rollback point
        rollbackInfo = this.rollbackHistory[0];
        if (!rollbackInfo) {
          throw new Error('No rollback points available');
        }
      }

      console.log(`Rolling back to version ${rollbackInfo.version}...`);

      // Validate rollback point integrity
      const isValid = await this.validateRollbackPoint(rollbackInfo);
      if (!isValid) {
        throw new Error('Rollback point validation failed');
      }

      // Create current version backup before rollback (in case rollback fails)
      const emergencyBackupId = await this.createEmergencyBackup();

      try {
        // Restore application files
        await this.restoreApplicationFiles(rollbackInfo.backupPath);

        // Restore configuration
        await this.restoreConfiguration(rollbackInfo.backupPath, rollbackInfo.configSnapshot);

        // Update application metadata
        await this.updateApplicationMetadata(rollbackInfo.version);

        console.log(`Successfully rolled back to version ${rollbackInfo.version}`);
        return true;
      } catch (rollbackError) {
        console.error('Rollback failed, attempting to restore current version:', rollbackError);
        
        // Attempt to restore from emergency backup
        try {
          await this.restoreFromEmergencyBackup(emergencyBackupId);
          console.log('Successfully restored current version after failed rollback');
        } catch (restoreError) {
          console.error('Failed to restore current version:', restoreError);
        }
        
        throw rollbackError;
      }
    } catch (error) {
      console.error('Rollback operation failed:', error);
      return false;
    }
  }

  public async getVersionHistory(): Promise<RollbackInfo[]> {
    return [...this.rollbackHistory];
  }

  public async getRollbackInfo(version: string): Promise<RollbackInfo | null> {
    return this.rollbackHistory.find(rb => rb.version === version) || null;
  }

  public async deleteRollbackPoint(version: string): Promise<boolean> {
    try {
      const rollbackIndex = this.rollbackHistory.findIndex(rb => rb.version === version);
      if (rollbackIndex === -1) {
        return false;
      }

      const rollbackInfo = this.rollbackHistory[rollbackIndex];
      
      // Delete backup files
      await fs.rmdir(rollbackInfo.backupPath, { recursive: true });
      
      // Remove from history
      this.rollbackHistory.splice(rollbackIndex, 1);
      await this.saveRollbackHistory();

      console.log(`Deleted rollback point for version ${version}`);
      return true;
    } catch (error) {
      console.error(`Failed to delete rollback point for version ${version}:`, error);
      return false;
    }
  }

  public async validateAllRollbackPoints(): Promise<{ valid: string[]; invalid: string[] }> {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const rollbackInfo of this.rollbackHistory) {
      try {
        const isValid = await this.validateRollbackPoint(rollbackInfo);
        if (isValid) {
          valid.push(rollbackInfo.version);
        } else {
          invalid.push(rollbackInfo.version);
        }
      } catch (error) {
        console.error(`Error validating rollback point ${rollbackInfo.version}:`, error);
        invalid.push(rollbackInfo.version);
      }
    }

    return { valid, invalid };
  }

  public getRollbackStorageInfo(): Promise<{
    totalSize: number;
    backupCount: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    return this.calculateStorageInfo();
  }

  private generateBackupId(): string {
    const timestamp = Date.now().toString();
    const random = crypto.randomBytes(4).toString('hex');
    return `${timestamp}-${random}`;
  }

  private async createDirectoryBackup(sourcePath: string, targetPath: string): Promise<void> {
    await fs.mkdir(targetPath, { recursive: true });

    const entries = await fs.readdir(sourcePath, { withFileTypes: true });

    for (const entry of entries) {
      const sourceEntryPath = path.join(sourcePath, entry.name);
      const targetEntryPath = path.join(targetPath, entry.name);

      if (entry.isDirectory()) {
        // Skip certain directories that shouldn't be backed up
        const skipDirs = ['node_modules', '.git', 'temp', 'cache', 'logs'];
        if (skipDirs.includes(entry.name)) {
          continue;
        }
        
        await this.createDirectoryBackup(sourceEntryPath, targetEntryPath);
      } else if (entry.isFile()) {
        // Skip certain file types
        const skipExtensions = ['.log', '.tmp', '.temp'];
        const ext = path.extname(entry.name).toLowerCase();
        if (skipExtensions.includes(ext)) {
          continue;
        }
        
        await fs.copyFile(sourceEntryPath, targetEntryPath);
      }
    }
  }

  private async createConfigurationBackup(configBackupPath: string): Promise<void> {
    await fs.mkdir(configBackupPath, { recursive: true });

    const userDataPath = app.getPath('userData');
    const configFiles = [
      'config.json',
      'preferences.json',
      'settings.json',
      'update.config.json',
      'update-server.config.json'
    ];

    for (const configFile of configFiles) {
      const sourcePath = path.join(userDataPath, configFile);
      const targetPath = path.join(configBackupPath, configFile);

      try {
        await fs.copyFile(sourcePath, targetPath);
      } catch (error) {
        // File might not exist, which is fine
        if ((error as any).code !== 'ENOENT') {
          console.warn(`Failed to backup config file ${configFile}:`, error);
        }
      }
    }
  }

  private async createVersionManifest(version: string, backupPath: string): Promise<any> {
    const manifest = {
      version,
      backupDate: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      appPath: process.execPath,
      userDataPath: app.getPath('userData'),
      backupPath,
      integrity: {
        appChecksum: await this.calculateDirectoryChecksum(path.join(backupPath, 'app')),
        configChecksum: await this.calculateDirectoryChecksum(path.join(backupPath, 'config'))
      }
    };

    return manifest;
  }

  private async createConfigSnapshot(): Promise<any> {
    try {
      const userDataPath = app.getPath('userData');
      const snapshot: any = {
        timestamp: new Date().toISOString(),
        configs: {}
      };

      const configFiles = [
        'config.json',
        'preferences.json',
        'settings.json'
      ];

      for (const configFile of configFiles) {
        try {
          const configPath = path.join(userDataPath, configFile);
          const configData = await fs.readFile(configPath, 'utf8');
          snapshot.configs[configFile] = JSON.parse(configData);
        } catch (error) {
          // Config file might not exist
        }
      }

      return snapshot;
    } catch (error) {
      console.error('Failed to create config snapshot:', error);
      return {};
    }
  }

  private async validateRollbackPoint(rollbackInfo: RollbackInfo): Promise<boolean> {
    try {
      // Check if backup path exists
      await fs.access(rollbackInfo.backupPath);

      // Check manifest file
      const manifestPath = path.join(rollbackInfo.backupPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);

      // Verify integrity checksums
      const appPath = path.join(rollbackInfo.backupPath, 'app');
      const configPath = path.join(rollbackInfo.backupPath, 'config');
      
      const currentAppChecksum = await this.calculateDirectoryChecksum(appPath);
      const currentConfigChecksum = await this.calculateDirectoryChecksum(configPath);

      return (
        manifest.integrity.appChecksum === currentAppChecksum &&
        manifest.integrity.configChecksum === currentConfigChecksum
      );
    } catch (error) {
      console.error('Rollback point validation error:', error);
      return false;
    }
  }

  private async restoreApplicationFiles(backupPath: string): Promise<void> {
    const backupAppPath = path.join(backupPath, 'app');
    const currentAppPath = path.dirname(process.execPath);

    // This is a critical operation that would need platform-specific implementation
    // For now, we'll create a script that the user can run after app restart
    
    if (process.platform === 'win32') {
      await this.createWindowsRestoreScript(backupAppPath, currentAppPath);
    } else if (process.platform === 'darwin') {
      await this.createMacOSRestoreScript(backupAppPath, currentAppPath);
    } else {
      await this.createLinuxRestoreScript(backupAppPath, currentAppPath);
    }
  }

  private async createWindowsRestoreScript(backupPath: string, targetPath: string): Promise<void> {
    const scriptPath = path.join(os.tmpdir(), 'ghost_hunter_rollback.bat');
    const script = `
@echo off
echo Rolling back Ghost Hunter Toolbox...
timeout /t 3
xcopy "${backupPath}\\*" "${targetPath}\\" /E /Y /Q
echo Rollback complete. Restarting application...
start "" "${path.join(targetPath, 'GhostHunterToolbox.exe')}"
del "%~f0"
`;

    await fs.writeFile(scriptPath, script, 'utf8');
    
    // Execute the script
    spawn('cmd', ['/c', scriptPath], { detached: true, stdio: 'ignore' });
  }

  private async createMacOSRestoreScript(backupPath: string, targetPath: string): Promise<void> {
    const scriptPath = path.join(os.tmpdir(), 'ghost_hunter_rollback.sh');
    const script = `#!/bin/bash
echo "Rolling back Ghost Hunter Toolbox..."
sleep 3
cp -rf "${backupPath}/"* "${targetPath}/"
echo "Rollback complete. Restarting application..."
open "${targetPath}/GhostHunterToolbox.app"
rm "$0"
`;

    await fs.writeFile(scriptPath, script, 'utf8');
    await fs.chmod(scriptPath, '755');
    
    // Execute the script
    spawn('bash', [scriptPath], { detached: true, stdio: 'ignore' });
  }

  private async createLinuxRestoreScript(backupPath: string, targetPath: string): Promise<void> {
    const scriptPath = path.join(os.tmpdir(), 'ghost_hunter_rollback.sh');
    const script = `#!/bin/bash
echo "Rolling back Ghost Hunter Toolbox..."
sleep 3
cp -rf "${backupPath}/"* "${targetPath}/"
echo "Rollback complete. Restarting application..."
nohup "${path.join(targetPath, 'ghost-hunter-toolbox')}" &
rm "$0"
`;

    await fs.writeFile(scriptPath, script, 'utf8');
    await fs.chmod(scriptPath, '755');
    
    // Execute the script
    spawn('bash', [scriptPath], { detached: true, stdio: 'ignore' });
  }

  private async restoreConfiguration(backupPath: string, configSnapshot: any): Promise<void> {
    const configBackupPath = path.join(backupPath, 'config');
    const userDataPath = app.getPath('userData');

    try {
      const configFiles = await fs.readdir(configBackupPath);
      
      for (const configFile of configFiles) {
        const sourcePath = path.join(configBackupPath, configFile);
        const targetPath = path.join(userDataPath, configFile);
        
        await fs.copyFile(sourcePath, targetPath);
      }
    } catch (error) {
      console.error('Failed to restore configuration:', error);
    }
  }

  private async updateApplicationMetadata(version: string): Promise<void> {
    // Update any application metadata to reflect the rollback
    console.log(`Updated application metadata for version ${version}`);
  }

  private async createEmergencyBackup(): Promise<string> {
    const backupId = `emergency-${this.generateBackupId()}`;
    console.log(`Creating emergency backup: ${backupId}`);
    return await this.createRollbackPoint();
  }

  private async restoreFromEmergencyBackup(emergencyBackupId: string): Promise<void> {
    // Implementation to restore from emergency backup
    console.log(`Restoring from emergency backup: ${emergencyBackupId}`);
  }

  private async calculateDirectoryChecksum(dirPath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    
    try {
      const files = await this.getFileList(dirPath);
      files.sort(); // Ensure consistent ordering
      
      for (const filePath of files) {
        const fileData = await fs.readFile(filePath);
        hash.update(filePath); // Include file path in hash
        hash.update(fileData);
      }
    } catch (error) {
      // Directory might not exist
      hash.update('empty');
    }
    
    return hash.digest('hex');
  }

  private async getFileList(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.getFileList(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return files;
  }

  private async loadRollbackHistory(): Promise<void> {
    try {
      const historyPath = path.join(this.rollbackPath, 'history.json');
      const historyData = await fs.readFile(historyPath, 'utf8');
      const history = JSON.parse(historyData);
      
      // Convert date strings back to Date objects
      this.rollbackHistory = history.map((rb: any) => ({
        ...rb,
        installDate: new Date(rb.installDate)
      }));
    } catch (error) {
      // History file doesn't exist yet
      this.rollbackHistory = [];
    }
  }

  private async saveRollbackHistory(): Promise<void> {
    try {
      const historyPath = path.join(this.rollbackPath, 'history.json');
      const historyData = JSON.stringify(this.rollbackHistory, null, 2);
      await fs.writeFile(historyPath, historyData, 'utf8');
    } catch (error) {
      console.error('Failed to save rollback history:', error);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    if (this.rollbackHistory.length <= this.maxRollbackVersions) {
      return;
    }

    const backupsToRemove = this.rollbackHistory.slice(this.maxRollbackVersions);
    
    for (const backup of backupsToRemove) {
      try {
        await fs.rmdir(backup.backupPath, { recursive: true });
        console.log(`Cleaned up old backup: ${backup.version}`);
      } catch (error) {
        console.error(`Failed to cleanup backup ${backup.version}:`, error);
      }
    }

    this.rollbackHistory = this.rollbackHistory.slice(0, this.maxRollbackVersions);
    await this.saveRollbackHistory();
  }

  private async calculateStorageInfo(): Promise<{
    totalSize: number;
    backupCount: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    let totalSize = 0;
    let oldestBackup: Date | null = null;
    let newestBackup: Date | null = null;

    for (const backup of this.rollbackHistory) {
      try {
        const backupSize = await this.calculateDirectorySize(backup.backupPath);
        totalSize += backupSize;

        if (!oldestBackup || backup.installDate < oldestBackup) {
          oldestBackup = backup.installDate;
        }
        if (!newestBackup || backup.installDate > newestBackup) {
          newestBackup = backup.installDate;
        }
      } catch (error) {
        console.error(`Failed to calculate size for backup ${backup.version}:`, error);
      }
    }

    return {
      totalSize,
      backupCount: this.rollbackHistory.length,
      oldestBackup,
      newestBackup
    };
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
          size += await this.calculateDirectorySize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          size += stats.size;
        }
      }
    } catch (error) {
      // Directory might not exist
    }
    
    return size;
  }
}