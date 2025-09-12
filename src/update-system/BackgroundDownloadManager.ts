import { app, net, powerMonitor } from 'electron';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  UpdateInfo,
  UpdateProgress,
  UpdateStage,
  UpdateError,
  UpdateErrorCode,
  UpdatePolicy
} from './types';
import { UpdateServerConfigManager } from './UpdateServerConfig';

export interface DownloadOptions {
  priority: 'low' | 'normal' | 'high';
  resumable: boolean;
  maxRetries: number;
  retryDelay: number;
  bandwidthLimit?: number; // bytes per second, 0 = unlimited
  wifiOnly?: boolean;
  pauseOnBattery?: boolean;
  pauseOnMeteredConnection?: boolean;
}

export interface DownloadSession {
  id: string;
  updateInfo: UpdateInfo;
  options: DownloadOptions;
  startTime: Date;
  endTime?: Date;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: UpdateProgress;
  error?: UpdateError;
  retryCount: number;
  resumeData?: ArrayBuffer;
}

export class BackgroundDownloadManager extends EventEmitter {
  private serverConfig: UpdateServerConfigManager;
  private downloadQueue: DownloadSession[] = [];
  private activeDownloads = new Map<string, DownloadSession>();
  private downloadPath: string;
  private maxConcurrentDownloads = 2;
  private bandwidthMonitor: BandwidthMonitor;
  private networkMonitor: NetworkMonitor;
  private powerMonitor: PowerMonitor;

  constructor(serverConfig: UpdateServerConfigManager) {
    super();
    
    this.serverConfig = serverConfig;
    this.downloadPath = path.join(app.getPath('userData'), 'downloads');
    this.bandwidthMonitor = new BandwidthMonitor();
    this.networkMonitor = new NetworkMonitor();
    this.powerMonitor = new PowerMonitor();
    
    this.setupEventListeners();
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.downloadPath, { recursive: true });
      
      await this.bandwidthMonitor.initialize();
      await this.networkMonitor.initialize();
      this.powerMonitor.initialize();
      
      // Resume any interrupted downloads
      await this.resumeInterruptedDownloads();
      
      console.log('BackgroundDownloadManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BackgroundDownloadManager:', error);
      throw error;
    }
  }

  public async queueDownload(
    updateInfo: UpdateInfo,
    options: Partial<DownloadOptions> = {}
  ): Promise<string> {
    const defaultOptions: DownloadOptions = {
      priority: 'normal',
      resumable: true,
      maxRetries: 3,
      retryDelay: 5000,
      bandwidthLimit: 0, // Unlimited by default
      wifiOnly: false,
      pauseOnBattery: false,
      pauseOnMeteredConnection: true
    };

    const downloadOptions = { ...defaultOptions, ...options };
    const sessionId = this.generateSessionId();

    const session: DownloadSession = {
      id: sessionId,
      updateInfo,
      options: downloadOptions,
      startTime: new Date(),
      status: 'pending',
      progress: {
        bytesPerSecond: 0,
        percent: 0,
        total: updateInfo.size,
        transferred: 0,
        stage: 'checking-for-update'
      },
      retryCount: 0
    };

    // Add to queue based on priority
    if (downloadOptions.priority === 'high') {
      this.downloadQueue.unshift(session);
    } else {
      this.downloadQueue.push(session);
    }

    this.emit('download-queued', session);
    
    // Try to start download immediately if capacity allows
    this.processDownloadQueue();

    return sessionId;
  }

  public pauseDownload(sessionId: string): boolean {
    const session = this.activeDownloads.get(sessionId) || 
                   this.downloadQueue.find(s => s.id === sessionId);

    if (!session) {
      return false;
    }

    if (session.status === 'downloading') {
      session.status = 'paused';
      this.emit('download-paused', session);
      return true;
    }

    return false;
  }

  public resumeDownload(sessionId: string): boolean {
    const session = this.activeDownloads.get(sessionId) || 
                   this.downloadQueue.find(s => s.id === sessionId);

    if (!session) {
      return false;
    }

    if (session.status === 'paused') {
      session.status = 'pending';
      this.processDownloadQueue();
      return true;
    }

    return false;
  }

  public cancelDownload(sessionId: string): boolean {
    const session = this.activeDownloads.get(sessionId) || 
                   this.downloadQueue.find(s => s.id === sessionId);

    if (!session) {
      return false;
    }

    session.status = 'cancelled';
    
    // Remove from active downloads
    this.activeDownloads.delete(sessionId);
    
    // Remove from queue
    const queueIndex = this.downloadQueue.findIndex(s => s.id === sessionId);
    if (queueIndex !== -1) {
      this.downloadQueue.splice(queueIndex, 1);
    }

    this.emit('download-cancelled', session);
    this.processDownloadQueue();

    return true;
  }

  public getDownloadStatus(sessionId: string): DownloadSession | null {
    return this.activeDownloads.get(sessionId) || 
           this.downloadQueue.find(s => s.id === sessionId) || 
           null;
  }

  public getAllDownloads(): DownloadSession[] {
    const all = [...this.downloadQueue];
    this.activeDownloads.forEach(session => {
      if (!all.find(s => s.id === session.id)) {
        all.push(session);
      }
    });
    return all;
  }

  public setMaxConcurrentDownloads(max: number): void {
    this.maxConcurrentDownloads = Math.max(1, Math.min(max, 5));
    this.processDownloadQueue();
  }

  public setBandwidthLimit(limitBytesPerSecond: number): void {
    this.bandwidthMonitor.setLimit(limitBytesPerSecond);
  }

  public pauseAllDownloads(): void {
    this.activeDownloads.forEach(session => {
      if (session.status === 'downloading') {
        session.status = 'paused';
      }
    });
    this.emit('all-downloads-paused');
  }

  public resumeAllDownloads(): void {
    this.activeDownloads.forEach(session => {
      if (session.status === 'paused') {
        session.status = 'pending';
      }
    });
    this.processDownloadQueue();
    this.emit('all-downloads-resumed');
  }

  private async processDownloadQueue(): Promise<void> {
    // Check if we can start more downloads
    const activeCount = Array.from(this.activeDownloads.values())
      .filter(session => session.status === 'downloading').length;

    if (activeCount >= this.maxConcurrentDownloads) {
      return;
    }

    // Find next pending download
    const nextSession = this.downloadQueue.find(session => 
      session.status === 'pending' && this.canStartDownload(session)
    );

    if (!nextSession) {
      return;
    }

    // Start the download
    try {
      await this.startDownload(nextSession);
    } catch (error) {
      this.handleDownloadError(nextSession, error);
    }

    // Process more downloads if capacity allows
    setImmediate(() => this.processDownloadQueue());
  }

  private canStartDownload(session: DownloadSession): boolean {
    const { options } = session;

    // Check WiFi only requirement
    if (options.wifiOnly && !this.networkMonitor.isWiFi()) {
      return false;
    }

    // Check metered connection requirement
    if (options.pauseOnMeteredConnection && this.networkMonitor.isMetered()) {
      return false;
    }

    // Check battery requirement
    if (options.pauseOnBattery && this.powerMonitor.isOnBattery()) {
      return false;
    }

    // Check network connectivity
    if (!this.networkMonitor.isOnline()) {
      return false;
    }

    return true;
  }

  private async startDownload(session: DownloadSession): Promise<void> {
    console.log(`Starting download for update ${session.updateInfo.version}`);
    
    session.status = 'downloading';
    session.progress.stage = 'download-progress';
    this.activeDownloads.set(session.id, session);

    this.emit('download-started', session);

    try {
      // Get download URL
      const downloadUrl = this.getDownloadUrl(session.updateInfo);
      
      // Start the actual download
      await this.performDownload(session, downloadUrl);
      
    } catch (error) {
      this.handleDownloadError(session, error);
    }
  }

  private async performDownload(session: DownloadSession, downloadUrl: string): Promise<void> {
    const headers = this.serverConfig.createRequestHeaders();
    
    // Add range header for resume support
    if (session.resumeData && session.options.resumable) {
      const resumePosition = session.progress.transferred;
      headers['Range'] = `bytes=${resumePosition}-`;
    }

    const request = net.request({
      method: 'GET',
      url: downloadUrl,
      headers
    });

    const downloadFilePath = path.join(this.downloadPath, `${session.id}.update`);
    let writeStream: fs.FileHandle | null = null;

    try {
      // Open file for writing (append if resuming)
      const flags = session.resumeData ? 'a' : 'w';
      writeStream = await fs.open(downloadFilePath, flags);

      request.on('response', (response) => {
        if (response.statusCode !== 200 && response.statusCode !== 206) {
          throw new Error(`Server returned status ${response.statusCode}`);
        }

        const contentLength = parseInt(response.headers['content-length'] as string || '0');
        if (contentLength > 0 && !session.resumeData) {
          session.progress.total = contentLength;
          session.updateInfo.size = contentLength;
        }

        const startTime = Date.now();
        let lastUpdateTime = startTime;
        let bytesInWindow = 0;

        response.on('data', async (chunk: Buffer) => {
          try {
            // Apply bandwidth limiting
            if (session.options.bandwidthLimit) {
              await this.bandwidthMonitor.enforceLimit(chunk.length, session.options.bandwidthLimit);
            }

            // Write chunk to file
            if (writeStream) {
              await writeStream.write(chunk);
            }

            // Update progress
            session.progress.transferred += chunk.length;
            session.progress.percent = (session.progress.transferred / session.progress.total) * 100;
            
            bytesInWindow += chunk.length;
            const currentTime = Date.now();
            
            // Update speed calculation every 500ms
            if (currentTime - lastUpdateTime >= 500) {
              const timeWindow = (currentTime - lastUpdateTime) / 1000;
              session.progress.bytesPerSecond = Math.round(bytesInWindow / timeWindow);
              session.progress.estimatedTimeRemaining = 
                (session.progress.total - session.progress.transferred) / session.progress.bytesPerSecond;
              
              bytesInWindow = 0;
              lastUpdateTime = currentTime;

              // Emit progress update
              this.emit('download-progress', session);
            }

            // Check if download should be paused
            if (session.status === 'paused') {
              request.abort();
              return;
            }

          } catch (error) {
            console.error('Error writing download data:', error);
            request.abort();
          }
        });

        response.on('end', async () => {
          try {
            if (writeStream) {
              await writeStream.close();
              writeStream = null;
            }

            // Verify download completion
            if (session.progress.transferred >= session.progress.total) {
              await this.completeDownload(session, downloadFilePath);
            } else {
              throw new Error('Download incomplete: size mismatch');
            }

          } catch (error) {
            this.handleDownloadError(session, error);
          }
        });

        response.on('error', (error) => {
          this.handleDownloadError(session, error);
        });
      });

      request.on('error', (error) => {
        this.handleDownloadError(session, error);
      });

      request.end();

    } catch (error) {
      if (writeStream) {
        await writeStream.close();
      }
      throw error;
    }
  }

  private async completeDownload(session: DownloadSession, downloadFilePath: string): Promise<void> {
    try {
      console.log(`Completing download for update ${session.updateInfo.version}`);

      // Verify file integrity
      const isValid = await this.verifyDownloadIntegrity(downloadFilePath, session.updateInfo);
      if (!isValid) {
        throw new Error('Download integrity verification failed');
      }

      // Move file to final location
      const finalPath = path.join(this.downloadPath, `${session.updateInfo.version}.update`);
      await fs.rename(downloadFilePath, finalPath);

      // Update session
      session.status = 'completed';
      session.endTime = new Date();
      session.progress.stage = 'update-downloaded';
      session.progress.percent = 100;

      // Remove from active downloads
      this.activeDownloads.delete(session.id);

      this.emit('download-completed', session);
      console.log(`Download completed successfully: ${session.updateInfo.version}`);

      // Process next download in queue
      this.processDownloadQueue();

    } catch (error) {
      this.handleDownloadError(session, error);
    }
  }

  private handleDownloadError(session: DownloadSession, error: any): void {
    console.error(`Download error for ${session.updateInfo.version}:`, error);

    session.retryCount++;
    
    if (session.retryCount <= session.options.maxRetries) {
      // Schedule retry
      console.log(`Retrying download (${session.retryCount}/${session.options.maxRetries})`);
      
      setTimeout(() => {
        if (session.status !== 'cancelled') {
          session.status = 'pending';
          this.processDownloadQueue();
        }
      }, session.options.retryDelay);
      
    } else {
      // Max retries exceeded
      session.status = 'failed';
      session.error = {
        code: 'NETWORK_ERROR',
        message: error.message || 'Download failed',
        details: error,
        recoverable: true,
        timestamp: new Date()
      };

      this.activeDownloads.delete(session.id);
      this.emit('download-failed', session);
    }
  }

  private getDownloadUrl(updateInfo: UpdateInfo): string {
    // Use the first file URL, or construct from server config
    if (updateInfo.files && updateInfo.files.length > 0) {
      return updateInfo.files[0].url;
    }

    const platform = process.platform;
    const fileName = `${updateInfo.version}-${platform}.zip`;
    return this.serverConfig.getDownloadUrl(updateInfo.version, platform, fileName);
  }

  private async verifyDownloadIntegrity(filePath: string, updateInfo: UpdateInfo): Promise<boolean> {
    try {
      if (!updateInfo.checksum && updateInfo.files.length === 0) {
        console.warn('No checksum available for integrity verification');
        return true; // Skip verification if no checksum available
      }

      const fileData = await fs.readFile(filePath);
      const actualChecksum = crypto.createHash('sha512').update(fileData).digest('hex');
      
      const expectedChecksum = updateInfo.checksum || 
        (updateInfo.files.length > 0 ? updateInfo.files[0].sha512 : '');
      
      return actualChecksum === expectedChecksum;
    } catch (error) {
      console.error('Integrity verification error:', error);
      return false;
    }
  }

  private async resumeInterruptedDownloads(): Promise<void> {
    try {
      // Look for partial download files
      const files = await fs.readdir(this.downloadPath);
      const partialFiles = files.filter(file => file.endsWith('.update.partial'));

      // For now, clean up partial files
      // In a full implementation, we'd try to resume them
      for (const file of partialFiles) {
        await fs.unlink(path.join(this.downloadPath, file));
      }

    } catch (error) {
      console.error('Failed to resume interrupted downloads:', error);
    }
  }

  private setupEventListeners(): void {
    // Listen for network changes
    this.networkMonitor.on('network-changed', (isOnline: boolean) => {
      if (isOnline) {
        this.resumeAllDownloads();
      } else {
        this.pauseAllDownloads();
      }
    });

    // Listen for power changes
    this.powerMonitor.on('power-changed', (isOnBattery: boolean) => {
      this.activeDownloads.forEach(session => {
        if (session.options.pauseOnBattery && isOnBattery) {
          this.pauseDownload(session.id);
        } else if (!isOnBattery && session.status === 'paused') {
          this.resumeDownload(session.id);
        }
      });
    });
  }

  private generateSessionId(): string {
    return `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public destroy(): void {
    this.removeAllListeners();
    this.bandwidthMonitor.destroy();
    this.networkMonitor.destroy();
    this.powerMonitor.destroy();
  }
}

// Helper classes
class BandwidthMonitor {
  private limit: number = 0; // 0 = unlimited
  private lastEnforcement: number = 0;

  async initialize(): Promise<void> {
    // Initialize bandwidth monitoring
  }

  setLimit(bytesPerSecond: number): void {
    this.limit = bytesPerSecond;
  }

  async enforceLimit(bytesTransferred: number, limit: number): Promise<void> {
    if (limit <= 0) return;

    const now = Date.now();
    const timeSinceLastEnforcement = now - this.lastEnforcement;
    const expectedTime = (bytesTransferred / limit) * 1000;

    if (timeSinceLastEnforcement < expectedTime) {
      const delayTime = expectedTime - timeSinceLastEnforcement;
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }

    this.lastEnforcement = Date.now();
  }

  destroy(): void {
    // Cleanup
  }
}

class NetworkMonitor extends EventEmitter {
  private online: boolean = true;
  private wifi: boolean = false;
  private metered: boolean = false;

  async initialize(): Promise<void> {
    // Initialize network monitoring
    this.online = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.online = true;
      this.emit('network-changed', true);
    });

    window.addEventListener('offline', () => {
      this.online = false;
      this.emit('network-changed', false);
    });
  }

  isOnline(): boolean {
    return this.online;
  }

  isWiFi(): boolean {
    // This would require platform-specific implementation
    return true; // Assume WiFi for now
  }

  isMetered(): boolean {
    // This would require platform-specific implementation
    return false; // Assume not metered for now
  }

  destroy(): void {
    this.removeAllListeners();
  }
}

class PowerMonitor extends EventEmitter {
  private onBattery: boolean = false;

  initialize(): void {
    if (powerMonitor) {
      this.onBattery = powerMonitor.isOnBatteryPower();
      
      powerMonitor.on('on-battery', () => {
        this.onBattery = true;
        this.emit('power-changed', true);
      });

      powerMonitor.on('on-ac', () => {
        this.onBattery = false;
        this.emit('power-changed', false);
      });
    }
  }

  isOnBattery(): boolean {
    return this.onBattery;
  }

  destroy(): void {
    this.removeAllListeners();
  }
}