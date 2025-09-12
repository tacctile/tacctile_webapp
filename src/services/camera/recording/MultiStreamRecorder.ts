/**
 * Multi-Stream Recorder
 * Records multiple camera streams simultaneously
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { 
  CameraDevice,
  RecordingConfig,
  RecordingSession,
  RecordingFile,
  RecordingStats,
  StorageConfig,
  StreamConfig
} from '../types';
import { StreamManager } from './StreamManager';
import { logger } from '../../../utils/logger';

export class MultiStreamRecorder extends EventEmitter {
  private recordings: Map<string, RecordingSession> = new Map();
  private streamManager: StreamManager;
  private storageConfig: StorageConfig;
  private recordingDir: string;
  private maxConcurrentRecordings = 10;

  constructor(storageConfig: StorageConfig) {
    super();
    this.storageConfig = storageConfig;
    this.recordingDir = storageConfig.primaryPath;
    this.streamManager = new StreamManager();
    
    this.ensureRecordingDirectory();
    this.setupStreamEvents();
  }

  /**
   * Setup stream manager events
   */
  private setupStreamEvents(): void {
    this.streamManager.on('stream-data', (data) => {
      this.handleStreamData(data);
    });

    this.streamManager.on('stream-error', (error) => {
      this.handleStreamError(error);
    });
  }

  /**
   * Ensure recording directory exists
   */
  private ensureRecordingDirectory(): void {
    if (!fs.existsSync(this.recordingDir)) {
      fs.mkdirSync(this.recordingDir, { recursive: true });
    }
  }

  /**
   * Start recording from camera
   */
  async startRecording(
    camera: CameraDevice,
    config: RecordingConfig
  ): Promise<RecordingSession> {
    if (this.recordings.size >= this.maxConcurrentRecordings) {
      throw new Error('Maximum concurrent recordings reached');
    }

    if (this.recordings.has(camera.id)) {
      throw new Error(`Already recording from camera ${camera.id}`);
    }

    // Check storage space
    await this.checkStorageSpace();

    // Create recording session
    const session: RecordingSession = {
      id: `rec_${camera.id}_${Date.now()}`,
      cameraId: camera.id,
      startTime: new Date(),
      status: 'recording',
      config,
      files: [],
      statistics: {
        totalFrames: 0,
        droppedFrames: 0,
        totalBytes: 0,
        averageFps: 0,
        averageBitrate: 0
      }
    };

    this.recordings.set(camera.id, session);

    try {
      // Start stream
      const streamConfig: StreamConfig = {
        cameraId: camera.id,
        quality: config.quality,
        resolution: this.getResolutionForQuality(camera, config.quality),
        frameRate: 30,
        enableAudio: config.enableTimestamp || false
      };

      await this.streamManager.startStream(camera, streamConfig);
      
      // Start recording process
      this.startRecordingProcess(session);

      this.emit('recording-started', session);
      logger.info(`Recording started for camera ${camera.id}`);

      return session;

    } catch (error) {
      this.recordings.delete(camera.id);
      throw error;
    }
  }

  /**
   * Stop recording
   */
  async stopRecording(cameraId: string): Promise<void> {
    const session = this.recordings.get(cameraId);
    if (!session) {
      throw new Error(`No recording found for camera ${cameraId}`);
    }

    session.status = 'stopped';
    session.endTime = new Date();

    // Stop stream
    await this.streamManager.stopStream(cameraId);

    // Finalize recording
    await this.finalizeRecording(session);

    this.recordings.delete(cameraId);
    
    this.emit('recording-stopped', session);
    logger.info(`Recording stopped for camera ${cameraId}`);
  }

  /**
   * Stop all recordings
   */
  async stopAllRecordings(): Promise<void> {
    const promises = Array.from(this.recordings.keys()).map(cameraId => 
      this.stopRecording(cameraId)
    );

    await Promise.allSettled(promises);
  }

  /**
   * Pause recording
   */
  pauseRecording(cameraId: string): void {
    const session = this.recordings.get(cameraId);
    if (!session) {
      throw new Error(`No recording found for camera ${cameraId}`);
    }

    session.status = 'paused';
    this.streamManager.pauseStream(cameraId);
    
    this.emit('recording-paused', session);
  }

  /**
   * Resume recording
   */
  resumeRecording(cameraId: string): void {
    const session = this.recordings.get(cameraId);
    if (!session) {
      throw new Error(`No recording found for camera ${cameraId}`);
    }

    session.status = 'recording';
    this.streamManager.resumeStream(cameraId);
    
    this.emit('recording-resumed', session);
  }

  /**
   * Start recording process
   */
  private startRecordingProcess(session: RecordingSession): void {
    const writer = this.createFileWriter(session);
    
    // Store writer reference
    (session as any).writer = writer;

    // Start segment timer if configured
    if (session.config.segmentDuration) {
      this.startSegmentTimer(session);
    }

    // Start statistics timer
    this.startStatisticsTimer(session);
  }

  /**
   * Create file writer
   */
  private createFileWriter(session: RecordingSession): fs.WriteStream {
    const filename = this.generateFilename(session);
    const filepath = path.join(this.recordingDir, filename);

    const writer = fs.createWriteStream(filepath);

    const file: RecordingFile = {
      path: filepath,
      size: 0,
      duration: 0,
      startTime: new Date(),
      endTime: new Date(),
      hasAudio: session.config.enableTimestamp || false
    };

    session.files.push(file);

    writer.on('error', (error) => {
      logger.error(`Write error for ${session.cameraId}`, error);
      session.status = 'error';
      this.emit('recording-error', { session, error });
    });

    return writer;
  }

  /**
   * Generate filename
   */
  private generateFilename(session: RecordingSession): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const segment = session.files.length > 0 ? `_${session.files.length}` : '';
    return `${session.cameraId}_${timestamp}${segment}.${session.config.format}`;
  }

  /**
   * Handle stream data
   */
  private handleStreamData(data: {
    cameraId: string;
    chunk: Buffer;
    timestamp: number;
  }): void {
    const session = this.recordings.get(data.cameraId);
    if (!session || session.status !== 'recording') return;

    const writer = (session as any).writer as fs.WriteStream;
    if (!writer) return;

    // Apply timestamp watermark if enabled
    let processedChunk = data.chunk;
    if (session.config.enableTimestamp) {
      processedChunk = this.addTimestamp(data.chunk, new Date());
    }

    // Write to file
    writer.write(processedChunk);

    // Update statistics
    session.statistics.totalFrames++;
    session.statistics.totalBytes += processedChunk.length;

    const currentFile = session.files[session.files.length - 1];
    currentFile.size += processedChunk.length;
    currentFile.endTime = new Date();
    currentFile.duration = (currentFile.endTime.getTime() - currentFile.startTime.getTime()) / 1000;

    // Check file size limit
    if (session.config.maxFileSize && currentFile.size >= session.config.maxFileSize * 1024 * 1024) {
      this.rotateFile(session);
    }
  }

  /**
   * Handle stream error
   */
  private handleStreamError(error: {
    cameraId: string;
    error: Error;
  }): void {
    const session = this.recordings.get(error.cameraId);
    if (!session) return;

    logger.error(`Stream error for ${error.cameraId}`, error.error);
    
    session.status = 'error';
    this.emit('recording-error', { session, error: error.error });

    // Try to recover
    this.attemptRecovery(session);
  }

  /**
   * Rotate recording file
   */
  private rotateFile(session: RecordingSession): void {
    const oldWriter = (session as any).writer as fs.WriteStream;
    
    // Close current file
    oldWriter.end();

    // Create new file
    const newWriter = this.createFileWriter(session);
    (session as any).writer = newWriter;

    logger.info(`Rotated recording file for ${session.cameraId}`);
  }

  /**
   * Start segment timer
   */
  private startSegmentTimer(session: RecordingSession): void {
    const interval = session.config.segmentDuration! * 1000;
    
    const timer = setInterval(() => {
      if (session.status === 'recording') {
        this.rotateFile(session);
      } else if (session.status === 'stopped') {
        clearInterval(timer);
      }
    }, interval);

    (session as any).segmentTimer = timer;
  }

  /**
   * Start statistics timer
   */
  private startStatisticsTimer(session: RecordingSession): void {
    let lastFrameCount = 0;
    let lastByteCount = 0;
    let lastTime = Date.now();

    const timer = setInterval(() => {
      if (session.status === 'stopped') {
        clearInterval(timer);
        return;
      }

      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      
      const deltaFrames = session.statistics.totalFrames - lastFrameCount;
      const deltaBytes = session.statistics.totalBytes - lastByteCount;

      if (deltaTime > 0) {
        session.statistics.averageFps = deltaFrames / deltaTime;
        session.statistics.averageBitrate = (deltaBytes * 8) / deltaTime;
      }

      lastFrameCount = session.statistics.totalFrames;
      lastByteCount = session.statistics.totalBytes;
      lastTime = now;

      this.emit('recording-stats', {
        cameraId: session.cameraId,
        stats: session.statistics
      });
    }, 1000);

    (session as any).statsTimer = timer;
  }

  /**
   * Finalize recording
   */
  private async finalizeRecording(session: RecordingSession): Promise<void> {
    // Close file writer
    const writer = (session as any).writer as fs.WriteStream;
    if (writer) {
      await new Promise((resolve) => {
        writer.end(resolve);
      });
    }

    // Clear timers
    if ((session as any).segmentTimer) {
      clearInterval((session as any).segmentTimer);
    }
    if ((session as any).statsTimer) {
      clearInterval((session as any).statsTimer);
    }

    // Process files (e.g., convert format if needed)
    for (const file of session.files) {
      await this.processRecordingFile(file, session.config);
    }
  }

  /**
   * Process recording file
   */
  private async processRecordingFile(
    file: RecordingFile,
    config: RecordingConfig
  ): Promise<void> {
    // Add any post-processing here (format conversion, compression, etc.)
    logger.info(`Processed recording file: ${file.path}`);
  }

  /**
   * Add timestamp to frame
   */
  private addTimestamp(chunk: Buffer, timestamp: Date): Buffer {
    // This would need actual video processing to overlay timestamp
    // For now, return original chunk
    return chunk;
  }

  /**
   * Attempt recovery from error
   */
  private async attemptRecovery(session: RecordingSession): Promise<void> {
    logger.info(`Attempting recovery for ${session.cameraId}`);

    try {
      // Close current writer
      const writer = (session as any).writer as fs.WriteStream;
      if (writer) {
        writer.end();
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to restart stream
      const camera = await this.getCameraById(session.cameraId);
      if (camera) {
        await this.streamManager.restartStream(camera);
        
        // Create new file
        const newWriter = this.createFileWriter(session);
        (session as any).writer = newWriter;
        
        session.status = 'recording';
        logger.info(`Recovery successful for ${session.cameraId}`);
      }
    } catch (error) {
      logger.error(`Recovery failed for ${session.cameraId}`, error);
    }
  }

  /**
   * Check storage space
   */
  private async checkStorageSpace(): Promise<void> {
    const stats = fs.statfsSync(this.recordingDir);
    const freeSpaceGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);

    if (freeSpaceGB < this.storageConfig.minFreeSpaceGB) {
      if (this.storageConfig.recycleOldest) {
        await this.deleteOldestRecordings();
      } else {
        throw new Error(`Insufficient storage space: ${freeSpaceGB.toFixed(2)}GB available`);
      }
    }
  }

  /**
   * Delete oldest recordings
   */
  private async deleteOldestRecordings(): Promise<void> {
    const files = fs.readdirSync(this.recordingDir);
    const fileStats = files.map(file => {
      const filepath = path.join(this.recordingDir, file);
      const stat = fs.statSync(filepath);
      return { filepath, mtime: stat.mtime };
    });

    // Sort by modification time (oldest first)
    fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

    // Delete oldest files until we have enough space
    for (const file of fileStats) {
      fs.unlinkSync(file.filepath);
      logger.info(`Deleted old recording: ${file.filepath}`);

      const stats = fs.statfsSync(this.recordingDir);
      const freeSpaceGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
      
      if (freeSpaceGB >= this.storageConfig.minFreeSpaceGB) {
        break;
      }
    }
  }

  /**
   * Get camera by ID (placeholder)
   */
  private async getCameraById(cameraId: string): Promise<CameraDevice | null> {
    // This would be implemented to get camera from discovery service
    return null;
  }

  /**
   * Get resolution for quality
   */
  private getResolutionForQuality(camera: CameraDevice, quality: string): any {
    const resolutions = camera.capabilities.resolutions;
    
    switch (quality) {
      case 'low':
        return resolutions.find(r => r.label === '480p') || resolutions[resolutions.length - 1];
      case 'medium':
        return resolutions.find(r => r.label === '720p') || resolutions[Math.floor(resolutions.length / 2)];
      case 'high':
        return resolutions.find(r => r.label === '1080p') || resolutions[1];
      case 'ultra':
        return resolutions.find(r => r.label === '4K') || resolutions[0];
      default:
        return resolutions[0];
    }
  }

  /**
   * Get active recordings
   */
  getActiveRecordings(): RecordingSession[] {
    return Array.from(this.recordings.values());
  }

  /**
   * Get recording by camera ID
   */
  getRecording(cameraId: string): RecordingSession | undefined {
    return this.recordings.get(cameraId);
  }

  /**
   * Get recording statistics
   */
  getRecordingStats(cameraId: string): RecordingStats | null {
    const session = this.recordings.get(cameraId);
    return session ? session.statistics : null;
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    await this.stopAllRecordings();
    this.streamManager.dispose();
    this.removeAllListeners();
  }
}