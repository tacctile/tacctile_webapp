import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export interface ReplayClip {
  id: string;
  timestamp: Date;
  duration: number; // seconds
  filePath: string;
  fileSize: number; // bytes
  resolution: string;
  fps: number;
  bitrate: number;
  triggers: string[]; // What triggered the clip creation
  metadata: {
    investigation?: {
      location: string;
      timestamp: string;
      anomalyType?: string;
      emfReading?: number;
      temperature?: number;
    };
    tags: string[];
    description?: string;
    evidence?: boolean;
  };
  thumbnailPath?: string;
  processed: boolean;
}

export interface BufferSettings {
  enabled: boolean;
  bufferDuration: number; // seconds to keep in buffer
  maxBufferSize: number; // MB
  recordingFormat: 'mp4' | 'mkv' | 'mov';
  videoCodec: 'h264' | 'h265';
  audioCodec: 'aac' | 'mp3';
  quality: 'low' | 'medium' | 'high' | 'lossless';
  storageLocation: string;
  autoCleanup: boolean;
  maxClips: number;
}

export interface AnomalyDetection {
  enabled: boolean;
  emfThreshold: number; // mG
  temperatureChange: number; // degrees
  audioThreshold: number; // dB
  motionThreshold: number; // 0-100
  manualTriggerKey: string;
  autoTriggerDelay: number; // seconds before/after anomaly
  triggerTypes: {
    emfSpike: boolean;
    temperatureDrop: boolean;
    audioAnomaly: boolean;
    motionDetection: boolean;
    manualTrigger: boolean;
    chatKeywords: boolean;
  };
}

export interface HighlightMarker {
  id: string;
  timestamp: Date;
  description: string;
  type: 'evidence' | 'anomaly' | 'event' | 'note';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: {
    emfReading?: number;
    temperature?: number;
    audioLevel?: number;
    location?: string;
    investigator?: string;
  };
  clipId?: string; // Associated clip if one was created
}

export interface ReplayBufferStats {
  bufferStatus: {
    isRecording: boolean;
    currentBufferSize: number; // MB
    bufferDuration: number; // seconds
    bufferHealth: 'good' | 'warning' | 'critical';
  };
  storage: {
    totalClips: number;
    totalSize: number; // MB
    availableSpace: number; // MB
    oldestClip: Date | null;
    newestClip: Date | null;
  };
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    diskWriteSpeed: number; // MB/s
    frameDrops: number;
    errors: number;
  };
  triggers: {
    totalTriggers: number;
    triggersByType: Record<string, number>;
    lastTrigger: Date | null;
    automaticClips: number;
    manualClips: number;
  };
}

export class ReplayBuffer extends EventEmitter {
  private settings: BufferSettings;
  private anomalyDetection: AnomalyDetection;
  private clips: Map<string, ReplayClip> = new Map();
  private highlights: Map<string, HighlightMarker> = new Map();
  private ffmpegProcess: ChildProcess | null = null;
  private isRecording = false;
  private currentBuffer: Buffer[] = [];
  private bufferStartTime: Date | null = null;
  private stats: ReplayBufferStats;
  private environmentalData: {
    emfReading: number;
    temperature: number;
    audioLevel: number;
    location: string;
  };

  constructor() {
    super();

    this.settings = {
      enabled: true,
      bufferDuration: 30, // 30 seconds
      maxBufferSize: 500, // 500 MB
      recordingFormat: 'mp4',
      videoCodec: 'h264',
      audioCodec: 'aac',
      quality: 'high',
      storageLocation: path.join(os.homedir(), 'ParanormalClips'),
      autoCleanup: true,
      maxClips: 100
    };

    this.anomalyDetection = {
      enabled: true,
      emfThreshold: 5.0,
      temperatureChange: 2.0,
      audioThreshold: 80.0,
      motionThreshold: 70,
      manualTriggerKey: 'F9',
      autoTriggerDelay: 5,
      triggerTypes: {
        emfSpike: true,
        temperatureDrop: true,
        audioAnomaly: true,
        motionDetection: false,
        manualTrigger: true,
        chatKeywords: true
      }
    };

    this.environmentalData = {
      emfReading: 0,
      temperature: 20,
      audioLevel: 0,
      location: 'Unknown'
    };

    this.stats = {
      bufferStatus: {
        isRecording: false,
        currentBufferSize: 0,
        bufferDuration: 0,
        bufferHealth: 'good'
      },
      storage: {
        totalClips: 0,
        totalSize: 0,
        availableSpace: 0,
        oldestClip: null,
        newestClip: null
      },
      performance: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskWriteSpeed: 0,
        frameDrops: 0,
        errors: 0
      },
      triggers: {
        totalTriggers: 0,
        triggersByType: {},
        lastTrigger: null,
        automaticClips: 0,
        manualClips: 0
      }
    };

    this.ensureStorageDirectory();
    this.loadExistingClips();
    this.setupKeyboardListener();
    this.startStatsCollection();
  }

  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.settings.storageLocation)) {
      fs.mkdirSync(this.settings.storageLocation, { recursive: true });
    }
  }

  private loadExistingClips(): void {
    try {
      const metadataPath = path.join(this.settings.storageLocation, 'clips.json');
      if (fs.existsSync(metadataPath)) {
        const data = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        if (data.clips) {
          data.clips.forEach((clipData: any) => {
            this.clips.set(clipData.id, {
              ...clipData,
              timestamp: new Date(clipData.timestamp)
            });
          });
        }
        if (data.highlights) {
          data.highlights.forEach((highlightData: any) => {
            this.highlights.set(highlightData.id, {
              ...highlightData,
              timestamp: new Date(highlightData.timestamp)
            });
          });
        }
      }
      this.updateStorageStats();
    } catch (error) {
      console.error('Failed to load existing clips:', error);
    }
  }

  private saveClipsMetadata(): void {
    try {
      const metadataPath = path.join(this.settings.storageLocation, 'clips.json');
      const data = {
        clips: Array.from(this.clips.values()),
        highlights: Array.from(this.highlights.values()),
        lastUpdated: new Date().toISOString()
      };
      fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save clips metadata:', error);
    }
  }

  private setupKeyboardListener(): void {
    // This is a simplified implementation
    // In a real application, you'd use a proper global hotkey library
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      const key = data.toString();
      if (key === '\u001b') { // ESC key as example trigger
        this.triggerManualClip('Manual hotkey trigger');
      }
    });
  }

  public async startBuffer(inputUrl: string): Promise<void> {
    if (this.isRecording) {
      throw new Error('Replay buffer is already running');
    }

    if (!this.settings.enabled) {
      throw new Error('Replay buffer is disabled');
    }

    try {
      await this.startBufferProcess(inputUrl);
      this.isRecording = true;
      this.bufferStartTime = new Date();
      this.stats.bufferStatus.isRecording = true;
      this.emit('bufferStarted');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async stopBuffer(): Promise<void> {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.stats.bufferStatus.isRecording = false;
    this.bufferStartTime = null;

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
    }

    this.currentBuffer = [];
    this.emit('bufferStopped');
  }

  private async startBufferProcess(inputUrl: string): Promise<void> {
    const bufferPath = path.join(this.settings.storageLocation, 'temp_buffer.ts');
    
    // Create circular buffer using FFmpeg segment muxer
    const args = [
      '-i', inputUrl,
      '-c', 'copy',
      '-f', 'segment',
      '-segment_time', '1', // 1 second segments
      '-segment_list_size', this.settings.bufferDuration.toString(),
      '-segment_list_type', 'flat',
      '-segment_list_entry_prefix', path.join(this.settings.storageLocation, 'buffer_'),
      '-segment_wrap', this.settings.bufferDuration.toString(),
      '-reset_timestamps', '1',
      '-y',
      bufferPath
    ];

    return new Promise((resolve, reject) => {
      this.ffmpegProcess = spawn('ffmpeg', args);

      this.ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        this.parseBufferOutput(output);
      });

      this.ffmpegProcess.on('error', (error) => {
        reject(error);
      });

      this.ffmpegProcess.on('spawn', () => {
        resolve();
      });

      this.ffmpegProcess.on('exit', (code) => {
        if (this.isRecording) {
          console.log(`Buffer process exited unexpectedly with code ${code}`);
          this.emit('bufferError', new Error(`Buffer process exited with code ${code}`));
        }
      });
    });
  }

  private parseBufferOutput(output: string): void {
    // Parse FFmpeg output for buffer health monitoring
    if (output.includes('frame=')) {
      // Update buffer stats from FFmpeg output
      const frameMatch = output.match(/frame=\s*(\d+)/);
      const sizeMatch = output.match(/size=\s*(\d+)kB/);
      const fpsMatch = output.match(/fps=\s*(\d+\.?\d*)/);

      if (sizeMatch) {
        this.stats.bufferStatus.currentBufferSize = parseInt(sizeMatch[1]) / 1024; // Convert to MB
      }
    }

    if (output.includes('drop')) {
      this.stats.performance.frameDrops++;
    }
  }

  public async createClip(
    duration: number = this.settings.bufferDuration,
    description = 'Instant replay clip',
    triggers: string[] = ['manual'],
    isEvidence = false
  ): Promise<string> {
    if (!this.isRecording) {
      throw new Error('Replay buffer is not running');
    }

    const clipId = `clip_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const timestamp = new Date();
    const fileName = `${clipId}.${this.settings.recordingFormat}`;
    const filePath = path.join(this.settings.storageLocation, fileName);

    try {
      // Create clip from buffer segments
      await this.renderClipFromBuffer(filePath, duration);
      
      // Get file stats
      const fileStats = fs.statSync(filePath);
      
      // Create thumbnail
      const thumbnailPath = await this.generateThumbnail(filePath, clipId);

      const clip: ReplayClip = {
        id: clipId,
        timestamp,
        duration,
        filePath,
        fileSize: fileStats.size,
        resolution: '1920x1080', // Default, could be detected
        fps: 30, // Default, could be detected
        bitrate: 0, // Could be calculated
        triggers,
        metadata: {
          investigation: {
            location: this.environmentalData.location,
            timestamp: timestamp.toISOString(),
            emfReading: this.environmentalData.emfReading,
            temperature: this.environmentalData.temperature
          },
          tags: [],
          description,
          evidence: isEvidence
        },
        thumbnailPath,
        processed: true
      };

      this.clips.set(clipId, clip);
      this.updateStats();
      this.saveClipsMetadata();

      // Perform cleanup if needed
      if (this.settings.autoCleanup) {
        await this.performCleanup();
      }

      this.emit('clipCreated', clip);
      return clipId;
    } catch (error) {
      console.error('Failed to create clip:', error);
      throw error;
    }
  }

  private async renderClipFromBuffer(outputPath: string, duration: number): Promise<void> {
    const bufferDir = path.dirname(outputPath);
    const segmentPattern = path.join(bufferDir, 'buffer_*.ts');
    const concatListPath = path.join(bufferDir, 'concat_list.txt');

    // Create concat list for recent segments
    const segmentFiles = fs.readdirSync(bufferDir)
      .filter(file => file.startsWith('buffer_') && file.endsWith('.ts'))
      .sort()
      .slice(-Math.ceil(duration)); // Take last N segments

    const concatList = segmentFiles.map(file => `file '${path.join(bufferDir, file)}'`).join('\n');
    fs.writeFileSync(concatListPath, concatList);

    const quality = this.getQualitySettings();
    const args = [
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:v', `lib${this.settings.videoCodec}`,
      '-c:a', this.settings.audioCodec,
      ...quality,
      '-t', duration.toString(),
      '-y',
      outputPath
    ];

    return new Promise((resolve, reject) => {
      const renderProcess = spawn('ffmpeg', args);

      renderProcess.on('exit', (code) => {
        fs.unlinkSync(concatListPath); // Cleanup
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Clip rendering failed with code ${code}`));
        }
      });

      renderProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private getQualitySettings(): string[] {
    switch (this.settings.quality) {
      case 'low':
        return ['-crf', '28', '-preset', 'ultrafast'];
      case 'medium':
        return ['-crf', '23', '-preset', 'fast'];
      case 'high':
        return ['-crf', '18', '-preset', 'medium'];
      case 'lossless':
        return ['-crf', '0', '-preset', 'slow'];
      default:
        return ['-crf', '23', '-preset', 'fast'];
    }
  }

  private async generateThumbnail(videoPath: string, clipId: string): Promise<string> {
    const thumbnailPath = path.join(this.settings.storageLocation, `${clipId}_thumb.jpg`);
    
    const args = [
      '-i', videoPath,
      '-ss', '00:00:01', // 1 second into video
      '-vframes', '1',
      '-vf', 'scale=320:180',
      '-y',
      thumbnailPath
    ];

    return new Promise((resolve, reject) => {
      const thumbProcess = spawn('ffmpeg', args);

      thumbProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(thumbnailPath);
        } else {
          resolve(''); // Thumbnail generation failed, but don't fail the whole operation
        }
      });

      thumbProcess.on('error', () => {
        resolve(''); // Thumbnail generation failed, but don't fail the whole operation
      });
    });
  }

  public updateEnvironmentalData(data: Partial<typeof this.environmentalData>): void {
    const previousData = { ...this.environmentalData };
    Object.assign(this.environmentalData, data);

    if (this.anomalyDetection.enabled) {
      this.checkForAnomalies(previousData, this.environmentalData);
    }
  }

  private checkForAnomalies(previous: typeof this.environmentalData, current: typeof this.environmentalData): void {
    const triggers: string[] = [];

    // EMF spike detection
    if (this.anomalyDetection.triggerTypes.emfSpike && 
        current.emfReading > this.anomalyDetection.emfThreshold) {
      triggers.push(`EMF spike: ${current.emfReading.toFixed(1)} mG`);
    }

    // Temperature drop detection
    if (this.anomalyDetection.triggerTypes.temperatureDrop &&
        (previous.temperature - current.temperature) >= this.anomalyDetection.temperatureChange) {
      triggers.push(`Temperature drop: ${(previous.temperature - current.temperature).toFixed(1)}°`);
    }

    // Audio anomaly detection
    if (this.anomalyDetection.triggerTypes.audioAnomaly &&
        current.audioLevel > this.anomalyDetection.audioThreshold) {
      triggers.push(`Audio anomaly: ${current.audioLevel.toFixed(1)} dB`);
    }

    if (triggers.length > 0) {
      this.triggerAutomaticClip(triggers);
    }
  }

  public triggerManualClip(description: string): Promise<string> {
    if (!this.isRecording) {
      throw new Error('Replay buffer is not running');
    }

    this.stats.triggers.manualClips++;
    this.stats.triggers.totalTriggers++;
    this.stats.triggers.lastTrigger = new Date();

    return this.createClip(
      this.settings.bufferDuration,
      description,
      ['manual'],
      false
    );
  }

  private async triggerAutomaticClip(triggers: string[]): Promise<void> {
    if (!this.isRecording) return;

    this.stats.triggers.automaticClips++;
    this.stats.triggers.totalTriggers++;
    this.stats.triggers.lastTrigger = new Date();

    triggers.forEach(trigger => {
      const type = trigger.split(':')[0];
      this.stats.triggers.triggersByType[type] = (this.stats.triggers.triggersByType[type] || 0) + 1;
    });

    try {
      const clipId = await this.createClip(
        this.settings.bufferDuration + (this.anomalyDetection.autoTriggerDelay * 2),
        `Automatic clip: ${triggers.join(', ')}`,
        triggers,
        true
      );

      // Create highlight marker
      const highlightId = `highlight_${Date.now()}`;
      const highlight: HighlightMarker = {
        id: highlightId,
        timestamp: new Date(),
        description: triggers.join(', '),
        type: 'anomaly',
        severity: triggers.length > 1 ? 'high' : 'medium',
        metadata: {
          emfReading: this.environmentalData.emfReading,
          temperature: this.environmentalData.temperature,
          audioLevel: this.environmentalData.audioLevel,
          location: this.environmentalData.location
        },
        clipId
      };

      this.highlights.set(highlightId, highlight);
      this.emit('anomalyDetected', { triggers, clipId, highlight });
    } catch (error) {
      console.error('Failed to create automatic clip:', error);
    }
  }

  public addHighlightMarker(
    description: string,
    type: HighlightMarker['type'] = 'note',
    severity: HighlightMarker['severity'] = 'medium'
  ): string {
    const highlightId = `highlight_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const highlight: HighlightMarker = {
      id: highlightId,
      timestamp: new Date(),
      description,
      type,
      severity,
      metadata: {
        emfReading: this.environmentalData.emfReading,
        temperature: this.environmentalData.temperature,
        audioLevel: this.environmentalData.audioLevel,
        location: this.environmentalData.location
      }
    };

    this.highlights.set(highlightId, highlight);
    this.saveClipsMetadata();
    this.emit('highlightAdded', highlight);

    return highlightId;
  }

  public getClips(): ReplayClip[] {
    return Array.from(this.clips.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getClip(clipId: string): ReplayClip | null {
    return this.clips.get(clipId) || null;
  }

  public getHighlights(): HighlightMarker[] {
    return Array.from(this.highlights.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public async deleteClip(clipId: string): Promise<boolean> {
    const clip = this.clips.get(clipId);
    if (!clip) return false;

    try {
      // Delete video file
      if (fs.existsSync(clip.filePath)) {
        fs.unlinkSync(clip.filePath);
      }

      // Delete thumbnail
      if (clip.thumbnailPath && fs.existsSync(clip.thumbnailPath)) {
        fs.unlinkSync(clip.thumbnailPath);
      }

      this.clips.delete(clipId);
      this.saveClipsMetadata();
      this.updateStats();
      this.emit('clipDeleted', clipId);

      return true;
    } catch (error) {
      console.error('Failed to delete clip:', error);
      return false;
    }
  }

  public updateSettings(newSettings: Partial<BufferSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);

    // Ensure new storage directory exists
    if (newSettings.storageLocation) {
      this.ensureStorageDirectory();
    }
  }

  public updateAnomalyDetection(newSettings: Partial<AnomalyDetection>): void {
    this.anomalyDetection = { ...this.anomalyDetection, ...newSettings };
    this.emit('anomalyDetectionUpdated', this.anomalyDetection);
  }

  private async performCleanup(): Promise<void> {
    const clips = this.getClips();
    
    if (clips.length <= this.settings.maxClips) return;

    const clipsToDelete = clips.slice(this.settings.maxClips);
    
    for (const clip of clipsToDelete) {
      await this.deleteClip(clip.id);
    }

    this.emit('cleanupCompleted', { deletedClips: clipsToDelete.length });
  }

  private updateStats(): void {
    this.updateStorageStats();
    this.updatePerformanceStats();
  }

  private updateStorageStats(): void {
    const clips = Array.from(this.clips.values());
    
    this.stats.storage.totalClips = clips.length;
    this.stats.storage.totalSize = clips.reduce((sum, clip) => sum + (clip.fileSize / (1024 * 1024)), 0);
    
    if (clips.length > 0) {
      this.stats.storage.oldestClip = clips.reduce((oldest, clip) => 
        oldest.timestamp < clip.timestamp ? oldest : clip
      ).timestamp;
      this.stats.storage.newestClip = clips.reduce((newest, clip) => 
        newest.timestamp > clip.timestamp ? newest : clip
      ).timestamp;
    } else {
      this.stats.storage.oldestClip = null;
      this.stats.storage.newestClip = null;
    }

    // Calculate available space
    try {
      const stats = fs.statSync(this.settings.storageLocation);
      this.stats.storage.availableSpace = 1000; // Placeholder - would need actual disk space calculation
    } catch (error) {
      this.stats.storage.availableSpace = 0;
    }
  }

  private updatePerformanceStats(): void {
    // These would be actual system metrics in a real implementation
    this.stats.performance.cpuUsage = Math.random() * 100;
    this.stats.performance.memoryUsage = Math.random() * 2048;
    this.stats.performance.diskWriteSpeed = Math.random() * 100;
  }

  private startStatsCollection(): void {
    setInterval(() => {
      this.updateStats();
      this.emit('statsUpdated', this.stats);
    }, 5000);
  }

  public getStats(): ReplayBufferStats {
    return { ...this.stats };
  }

  public getSettings(): BufferSettings {
    return { ...this.settings };
  }

  public getAnomalyDetection(): AnomalyDetection {
    return { ...this.anomalyDetection };
  }

  public isBufferRunning(): boolean {
    return this.isRecording;
  }

  public exportConfiguration(): any {
    return {
      settings: this.settings,
      anomalyDetection: this.anomalyDetection
    };
  }

  public importConfiguration(config: any): void {
    if (config.settings) {
      this.updateSettings(config.settings);
    }
    
    if (config.anomalyDetection) {
      this.updateAnomalyDetection(config.anomalyDetection);
    }

    this.emit('configurationImported');
  }
}

export default ReplayBuffer;