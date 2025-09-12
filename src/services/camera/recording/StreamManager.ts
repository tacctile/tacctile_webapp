/**
 * Stream Manager
 * Manages multiple camera streams
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { 
  CameraDevice,
  CameraType,
  StreamConfig,
  StreamStatistics
} from '../types';
import { logger } from '../../../utils/logger';

interface ActiveStream {
  camera: CameraDevice;
  config: StreamConfig;
  process?: ChildProcess;
  stream?: MediaStream;
  statistics: StreamStatistics;
  buffer: Buffer[];
  paused: boolean;
}

export class StreamManager extends EventEmitter {
  private streams: Map<string, ActiveStream> = new Map();
  private ffmpegPath: string = 'ffmpeg';
  private maxBufferSize: number = 10 * 1024 * 1024; // 10MB

  /**
   * Start stream from camera
   */
  async startStream(camera: CameraDevice, config: StreamConfig): Promise<void> {
    if (this.streams.has(camera.id)) {
      throw new Error(`Stream already active for camera ${camera.id}`);
    }

    const activeStream: ActiveStream = {
      camera,
      config,
      statistics: this.createInitialStatistics(camera.id),
      buffer: [],
      paused: false
    };

    this.streams.set(camera.id, activeStream);

    try {
      switch (camera.type) {
        case CameraType.USB:
          await this.startUSBStream(activeStream);
          break;
        case CameraType.IP_RTSP:
        case CameraType.IP_ONVIF:
          await this.startRTSPStream(activeStream);
          break;
        case CameraType.WIFI:
          await this.startHTTPStream(activeStream);
          break;
        case CameraType.MOBILE:
          await this.startMobileStream(activeStream);
          break;
        default:
          throw new Error(`Unsupported camera type: ${camera.type}`);
      }

      this.emit('stream-started', { cameraId: camera.id, config });
      logger.info(`Stream started for camera ${camera.id}`);

    } catch (error) {
      this.streams.delete(camera.id);
      throw error;
    }
  }

  /**
   * Start USB camera stream
   */
  private async startUSBStream(activeStream: ActiveStream): Promise<void> {
    const { camera, config } = activeStream;

    try {
      // Get media stream from browser API
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: camera.connection.devicePath },
          width: config.resolution.width,
          height: config.resolution.height,
          frameRate: config.frameRate
        },
        audio: config.enableAudio
      });

      activeStream.stream = stream;

      // Create MediaRecorder for capturing
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: config.bitrate || 2500000
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !activeStream.paused) {
          this.handleStreamData(camera.id, event.data);
        }
      };

      mediaRecorder.onerror = (error) => {
        this.handleStreamError(camera.id, error);
      };

      // Start recording in chunks
      mediaRecorder.start(1000); // 1 second chunks

      // Store recorder reference
      (activeStream as any).mediaRecorder = mediaRecorder;

    } catch (error) {
      throw new Error(`Failed to start USB stream: ${error}`);
    }
  }

  /**
   * Start RTSP stream
   */
  private async startRTSPStream(activeStream: ActiveStream): Promise<void> {
    const { camera, config } = activeStream;
    const rtspUrl = camera.connection.rtspUrl!;

    // Build FFmpeg command
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-c:v', 'copy',
      '-c:a', config.enableAudio ? 'copy' : 'none',
      '-f', 'mpegts',
      '-'
    ];

    // Add resolution scaling if needed
    if (config.resolution) {
      args.splice(4, 0, '-vf', `scale=${config.resolution.width}:${config.resolution.height}`);
    }

    // Spawn FFmpeg process
    const ffmpeg = spawn(this.ffmpegPath, args);
    activeStream.process = ffmpeg;

    ffmpeg.stdout.on('data', (chunk) => {
      if (!activeStream.paused) {
        this.handleStreamData(camera.id, chunk);
      }
    });

    ffmpeg.stderr.on('data', (data) => {
      // Parse FFmpeg output for statistics
      this.parseFFmpegOutput(camera.id, data.toString());
    });

    ffmpeg.on('error', (error) => {
      this.handleStreamError(camera.id, error);
    });

    ffmpeg.on('exit', (code) => {
      if (code !== 0) {
        this.handleStreamError(camera.id, new Error(`FFmpeg exited with code ${code}`));
      }
    });
  }

  /**
   * Start HTTP stream (MJPEG)
   */
  private async startHTTPStream(activeStream: ActiveStream): Promise<void> {
    const { camera } = activeStream;
    const streamUrl = camera.connection.rtspUrl!; // HTTP URL

    // For MJPEG streams, we'll use a different approach
    // This would need actual HTTP streaming implementation
    logger.warn('HTTP streaming not fully implemented');
  }

  /**
   * Start mobile stream
   */
  private async startMobileStream(activeStream: ActiveStream): Promise<void> {
    // Mobile streams come through WebSocket
    // The MobileConnector handles the actual streaming
    logger.info(`Mobile stream setup for ${activeStream.camera.id}`);
  }

  /**
   * Stop stream
   */
  async stopStream(cameraId: string): Promise<void> {
    const activeStream = this.streams.get(cameraId);
    if (!activeStream) return;

    // Stop based on type
    if (activeStream.stream) {
      // Stop MediaStream
      activeStream.stream.getTracks().forEach(track => track.stop());
      
      const mediaRecorder = (activeStream as any).mediaRecorder as MediaRecorder;
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }

    if (activeStream.process) {
      // Kill FFmpeg process
      activeStream.process.kill('SIGTERM');
    }

    this.streams.delete(cameraId);
    
    this.emit('stream-stopped', { cameraId });
    logger.info(`Stream stopped for camera ${cameraId}`);
  }

  /**
   * Pause stream
   */
  pauseStream(cameraId: string): void {
    const activeStream = this.streams.get(cameraId);
    if (!activeStream) return;

    activeStream.paused = true;

    const mediaRecorder = (activeStream as any).mediaRecorder as MediaRecorder;
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.pause();
    }

    this.emit('stream-paused', { cameraId });
  }

  /**
   * Resume stream
   */
  resumeStream(cameraId: string): void {
    const activeStream = this.streams.get(cameraId);
    if (!activeStream) return;

    activeStream.paused = false;

    const mediaRecorder = (activeStream as any).mediaRecorder as MediaRecorder;
    if (mediaRecorder && mediaRecorder.state === 'paused') {
      mediaRecorder.resume();
    }

    this.emit('stream-resumed', { cameraId });
  }

  /**
   * Restart stream
   */
  async restartStream(camera: CameraDevice): Promise<void> {
    const activeStream = this.streams.get(camera.id);
    if (!activeStream) return;

    const config = activeStream.config;
    
    await this.stopStream(camera.id);
    await this.startStream(camera, config);
  }

  /**
   * Handle stream data
   */
  private async handleStreamData(cameraId: string, data: Blob | Buffer): Promise<void> {
    const activeStream = this.streams.get(cameraId);
    if (!activeStream) return;

    let buffer: Buffer;
    
    if (data instanceof Blob) {
      // Convert Blob to Buffer
      const arrayBuffer = await data.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      buffer = data;
    }

    // Update statistics
    activeStream.statistics.packetsReceived++;
    activeStream.statistics.bitrate = this.calculateBitrate(activeStream, buffer.length);

    // Buffer management
    activeStream.buffer.push(buffer);
    const totalSize = activeStream.buffer.reduce((sum, b) => sum + b.length, 0);
    
    if (totalSize > this.maxBufferSize) {
      // Remove oldest chunks
      while (activeStream.buffer.length > 0 && totalSize > this.maxBufferSize / 2) {
        activeStream.buffer.shift();
      }
    }

    // Emit data event
    this.emit('stream-data', {
      cameraId,
      chunk: buffer,
      timestamp: Date.now()
    });
  }

  /**
   * Handle stream error
   */
  private handleStreamError(cameraId: string, error: any): void {
    logger.error(`Stream error for camera ${cameraId}`, error);
    
    this.emit('stream-error', {
      cameraId,
      error
    });
  }

  /**
   * Parse FFmpeg output for statistics
   */
  private parseFFmpegOutput(cameraId: string, output: string): void {
    const activeStream = this.streams.get(cameraId);
    if (!activeStream) return;

    // Parse frame rate
    const fpsMatch = output.match(/fps=\s*(\d+)/);
    if (fpsMatch) {
      activeStream.statistics.fps = parseInt(fpsMatch[1]);
    }

    // Parse bitrate
    const bitrateMatch = output.match(/bitrate=\s*([\d.]+)kbits\/s/);
    if (bitrateMatch) {
      activeStream.statistics.bitrate = parseFloat(bitrateMatch[1]) * 1000;
    }
  }

  /**
   * Calculate bitrate
   */
  private calculateBitrate(activeStream: ActiveStream, bytes: number): number {
    const now = Date.now();
    const stats = activeStream.statistics;
    
    if (!stats.timestamp) {
      stats.timestamp = new Date(now);
      return 0;
    }

    const timeDiff = (now - stats.timestamp.getTime()) / 1000;
    if (timeDiff > 0) {
      return (bytes * 8) / timeDiff;
    }

    return stats.bitrate;
  }

  /**
   * Create initial statistics
   */
  private createInitialStatistics(cameraId: string): StreamStatistics {
    return {
      cameraId,
      timestamp: new Date(),
      fps: 0,
      bitrate: 0,
      resolution: { width: 0, height: 0, label: '' },
      packetsReceived: 0,
      packetsLost: 0,
      latency: 0,
      jitter: 0,
      bufferLevel: 0
    };
  }

  /**
   * Get stream statistics
   */
  getStreamStatistics(cameraId: string): StreamStatistics | null {
    const activeStream = this.streams.get(cameraId);
    return activeStream ? activeStream.statistics : null;
  }

  /**
   * Get all stream statistics
   */
  getAllStreamStatistics(): StreamStatistics[] {
    return Array.from(this.streams.values()).map(s => s.statistics);
  }

  /**
   * Get stream buffer
   */
  getStreamBuffer(cameraId: string): Buffer[] | null {
    const activeStream = this.streams.get(cameraId);
    return activeStream ? activeStream.buffer : null;
  }

  /**
   * Get active streams
   */
  getActiveStreams(): string[] {
    return Array.from(this.streams.keys());
  }

  /**
   * Check if stream is active
   */
  isStreamActive(cameraId: string): boolean {
    return this.streams.has(cameraId);
  }

  /**
   * Update stream config
   */
  async updateStreamConfig(cameraId: string, config: Partial<StreamConfig>): Promise<void> {
    const activeStream = this.streams.get(cameraId);
    if (!activeStream) return;

    // Merge config
    Object.assign(activeStream.config, config);

    // Restart stream with new config
    await this.restartStream(activeStream.camera);
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    // Stop all streams
    const promises = Array.from(this.streams.keys()).map(cameraId => 
      this.stopStream(cameraId)
    );

    await Promise.allSettled(promises);
    
    this.streams.clear();
    this.removeAllListeners();
  }
}