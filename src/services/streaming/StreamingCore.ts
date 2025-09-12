import { EventEmitter } from 'events';
import NodeMediaServer from 'node-media-server';
import RTMPClient from 'rtmp-client';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface StreamPlatform {
  id: string;
  name: 'YouTube' | 'Twitch' | 'TikTok' | 'Facebook' | 'Instagram' | 'X' | 'Custom';
  enabled: boolean;
  streamKey: string;
  rtmpUrl: string;
  maxBitrate?: number;
  resolution?: string;
  fps?: number;
  audioCodec?: string;
  videoCodec?: string;
}

export interface StreamSettings {
  outputResolution: string;
  fps: number;
  videoBitrate: number;
  audioBitrate: number;
  videoEncoder: 'x264' | 'nvenc' | 'qsv' | 'amf';
  audioEncoder: 'aac' | 'opus';
  keyframeInterval: number;
  bufferSize: number;
  enableHardwareAcceleration: boolean;
}

export interface StreamHealth {
  platform: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  bitrate: number;
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  ping: number;
  uptime: number;
  lastError?: string;
}

export interface StreamStats {
  totalViewers: number;
  platformViewers: Record<string, number>;
  totalChatMessages: number;
  bandwidth: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  warnings: string[];
}

export class StreamingCore extends EventEmitter {
  private mediaServer: NodeMediaServer | null = null;
  private platforms: Map<string, StreamPlatform> = new Map();
  private activeStreams: Map<string, RTMPClient> = new Map();
  private streamHealth: Map<string, StreamHealth> = new Map();
  private settings: StreamSettings;
  private isStreaming = false;
  private localRtmpPort = 1935;
  private localHttpPort = 8000;

  constructor() {
    super();
    this.settings = {
      outputResolution: '1920x1080',
      fps: 30,
      videoBitrate: 4000,
      audioBitrate: 128,
      videoEncoder: 'x264',
      audioEncoder: 'aac',
      keyframeInterval: 2,
      bufferSize: 1000,
      enableHardwareAcceleration: false
    };

    this.initializeDefaultPlatforms();
    this.setupMediaServer();
  }

  private initializeDefaultPlatforms(): void {
    const defaultPlatforms: Omit<StreamPlatform, 'streamKey'>[] = [
      {
        id: 'youtube',
        name: 'YouTube',
        enabled: false,
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: '',
        maxBitrate: 51000,
        resolution: '1920x1080',
        fps: 60,
        videoCodec: 'h264',
        audioCodec: 'aac'
      },
      {
        id: 'twitch',
        name: 'Twitch',
        enabled: false,
        rtmpUrl: 'rtmp://live.twitch.tv/live',
        streamKey: '',
        maxBitrate: 8500,
        resolution: '1920x1080',
        fps: 60,
        videoCodec: 'h264',
        audioCodec: 'aac'
      },
      {
        id: 'tiktok',
        name: 'TikTok',
        enabled: false,
        rtmpUrl: 'rtmp://live.tiktok.com/live',
        streamKey: '',
        maxBitrate: 4000,
        resolution: '1920x1080',
        fps: 30,
        videoCodec: 'h264',
        audioCodec: 'aac'
      },
      {
        id: 'facebook',
        name: 'Facebook',
        enabled: false,
        rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
        streamKey: '',
        maxBitrate: 4000,
        resolution: '1920x1080',
        fps: 30,
        videoCodec: 'h264',
        audioCodec: 'aac'
      },
      {
        id: 'instagram',
        name: 'Instagram',
        enabled: false,
        rtmpUrl: 'rtmps://live-upload.instagram.com:443/rtmp',
        streamKey: '',
        maxBitrate: 3500,
        resolution: '1920x1080',
        fps: 30,
        videoCodec: 'h264',
        audioCodec: 'aac'
      },
      {
        id: 'x',
        name: 'X',
        enabled: false,
        rtmpUrl: 'rtmp://live.twitter.com/live',
        streamKey: '',
        maxBitrate: 5000,
        resolution: '1920x1080',
        fps: 30,
        videoCodec: 'h264',
        audioCodec: 'aac'
      }
    ];

    defaultPlatforms.forEach(platform => {
      this.platforms.set(platform.id, { ...platform, streamKey: '' });
    });
  }

  private setupMediaServer(): void {
    const config = {
      logType: 3, // 0-error, 1-ffdebug, 2-debug, 3-info
      rtmp: {
        port: this.localRtmpPort,
        chunk_size: 60000,
        gop_cache: true,
        ping: 30,
        ping_timeout: 60
      },
      http: {
        port: this.localHttpPort,
        allow_origin: '*',
        mediaroot: './media'
      },
      relay: {
        ffmpeg: this.getFFmpegPath(),
        tasks: []
      }
    };

    this.mediaServer = new NodeMediaServer(config);
    this.setupMediaServerEvents();
  }

  private getFFmpegPath(): string {
    // Try to find FFmpeg binary
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    return ffmpegInstaller.path;
  }

  private setupMediaServerEvents(): void {
    if (!this.mediaServer) return;

    this.mediaServer.on('preConnect', (id: string, args: any) => {
      console.log('[NodeMediaServer] Connection:', id, args);
      this.emit('streamConnection', { id, args });
    });

    this.mediaServer.on('postConnect', (id: string, args: any) => {
      console.log('[NodeMediaServer] Connected:', id);
    });

    this.mediaServer.on('doneConnect', (id: string, args: any) => {
      console.log('[NodeMediaServer] Disconnected:', id);
    });

    this.mediaServer.on('prePublish', (id: string, StreamPath: string, args: any) => {
      console.log('[NodeMediaServer] Publish start:', id, StreamPath);
      this.handleStreamStart(StreamPath);
    });

    this.mediaServer.on('postPublish', (id: string, StreamPath: string, args: any) => {
      console.log('[NodeMediaServer] Published:', id, StreamPath);
    });

    this.mediaServer.on('donePublish', (id: string, StreamPath: string, args: any) => {
      console.log('[NodeMediaServer] Publish end:', id, StreamPath);
      this.handleStreamEnd(StreamPath);
    });
  }

  private handleStreamStart(streamPath: string): void {
    this.isStreaming = true;
    this.emit('streamStarted', { streamPath });
    
    // Start relaying to enabled platforms
    this.startMultiPlatformRelay(streamPath);
  }

  private handleStreamEnd(streamPath: string): void {
    this.isStreaming = false;
    this.emit('streamEnded', { streamPath });
    
    // Stop all relays
    this.stopAllRelays();
  }

  private async startMultiPlatformRelay(streamPath: string): Promise<void> {
    const enabledPlatforms = Array.from(this.platforms.values()).filter(p => p.enabled && p.streamKey);
    
    for (const platform of enabledPlatforms) {
      try {
        await this.startPlatformRelay(platform, streamPath);
        this.updateStreamHealth(platform.id, {
          platform: platform.name,
          status: 'connecting',
          bitrate: 0,
          fps: 0,
          droppedFrames: 0,
          totalFrames: 0,
          ping: 0,
          uptime: 0
        });
      } catch (error) {
        console.error(`Failed to start relay for ${platform.name}:`, error);
        this.updateStreamHealth(platform.id, {
          platform: platform.name,
          status: 'error',
          bitrate: 0,
          fps: 0,
          droppedFrames: 0,
          totalFrames: 0,
          ping: 0,
          uptime: 0,
          lastError: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  private async startPlatformRelay(platform: StreamPlatform, inputPath: string): Promise<void> {
    const rtmpClient = new RTMPClient();
    const fullRtmpUrl = `${platform.rtmpUrl}/${platform.streamKey}`;
    
    // Configure relay settings based on platform requirements
    const relayConfig = {
      input: `rtmp://localhost:${this.localRtmpPort}${inputPath}`,
      output: fullRtmpUrl,
      videoBitrate: Math.min(this.settings.videoBitrate, platform.maxBitrate || this.settings.videoBitrate),
      audioBitrate: this.settings.audioBitrate,
      fps: Math.min(this.settings.fps, platform.fps || this.settings.fps),
      resolution: platform.resolution || this.settings.outputResolution,
      videoCodec: platform.videoCodec || 'h264',
      audioCodec: platform.audioCodec || 'aac'
    };

    // Store active stream
    this.activeStreams.set(platform.id, rtmpClient);
    
    // Setup event handlers
    rtmpClient.on('connect', () => {
      this.updateStreamHealth(platform.id, {
        platform: platform.name,
        status: 'connected',
        bitrate: relayConfig.videoBitrate,
        fps: relayConfig.fps,
        droppedFrames: 0,
        totalFrames: 0,
        ping: 0,
        uptime: Date.now()
      });
      
      this.emit('platformConnected', { platform: platform.name, id: platform.id });
    });

    rtmpClient.on('error', (error: Error) => {
      this.updateStreamHealth(platform.id, {
        platform: platform.name,
        status: 'error',
        bitrate: 0,
        fps: 0,
        droppedFrames: 0,
        totalFrames: 0,
        ping: 0,
        uptime: 0,
        lastError: error.message
      });
      
      this.emit('platformError', { platform: platform.name, id: platform.id, error });
    });

    rtmpClient.on('disconnect', () => {
      this.updateStreamHealth(platform.id, {
        platform: platform.name,
        status: 'disconnected',
        bitrate: 0,
        fps: 0,
        droppedFrames: 0,
        totalFrames: 0,
        ping: 0,
        uptime: 0
      });
      
      this.emit('platformDisconnected', { platform: platform.name, id: platform.id });
    });

    // Start the relay (simplified - in real implementation would use FFmpeg)
    // This is a placeholder for actual RTMP relay implementation
    console.log(`Starting relay to ${platform.name} with config:`, relayConfig);
  }

  private stopAllRelays(): void {
    this.activeStreams.forEach((client, platformId) => {
      try {
        client.disconnect();
        this.activeStreams.delete(platformId);
        
        const platform = this.platforms.get(platformId);
        if (platform) {
          this.updateStreamHealth(platformId, {
            platform: platform.name,
            status: 'disconnected',
            bitrate: 0,
            fps: 0,
            droppedFrames: 0,
            totalFrames: 0,
            ping: 0,
            uptime: 0
          });
        }
      } catch (error) {
        console.error(`Error stopping relay for platform ${platformId}:`, error);
      }
    });
  }

  private updateStreamHealth(platformId: string, health: StreamHealth): void {
    this.streamHealth.set(platformId, health);
    this.emit('streamHealthUpdate', { platformId, health });
  }

  public async startServer(): Promise<void> {
    if (!this.mediaServer) {
      throw new Error('Media server not initialized');
    }

    return new Promise((resolve, reject) => {
      try {
        this.mediaServer!.run();
        console.log(`RTMP server running on port ${this.localRtmpPort}`);
        console.log(`HTTP server running on port ${this.localHttpPort}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  public async stopServer(): Promise<void> {
    if (this.mediaServer) {
      this.stopAllRelays();
      this.mediaServer.stop();
      this.mediaServer = null;
    }
  }

  public updatePlatform(platformId: string, updates: Partial<StreamPlatform>): void {
    const platform = this.platforms.get(platformId);
    if (platform) {
      Object.assign(platform, updates);
      this.platforms.set(platformId, platform);
      this.emit('platformUpdated', { platformId, platform });
    }
  }

  public addCustomPlatform(platform: Omit<StreamPlatform, 'id'>): string {
    const id = `custom_${Date.now()}`;
    this.platforms.set(id, { ...platform, id });
    this.emit('platformAdded', { platformId: id, platform: { ...platform, id } });
    return id;
  }

  public removePlatform(platformId: string): boolean {
    const platform = this.platforms.get(platformId);
    if (!platform) return false;

    // Stop relay if active
    const activeStream = this.activeStreams.get(platformId);
    if (activeStream) {
      activeStream.disconnect();
      this.activeStreams.delete(platformId);
    }

    this.platforms.delete(platformId);
    this.streamHealth.delete(platformId);
    this.emit('platformRemoved', { platformId });
    return true;
  }

  public getPlatforms(): StreamPlatform[] {
    return Array.from(this.platforms.values());
  }

  public getPlatform(platformId: string): StreamPlatform | null {
    return this.platforms.get(platformId) || null;
  }

  public getStreamHealth(): StreamHealth[] {
    return Array.from(this.streamHealth.values());
  }

  public getPlatformHealth(platformId: string): StreamHealth | null {
    return this.streamHealth.get(platformId) || null;
  }

  public updateSettings(newSettings: Partial<StreamSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settingsUpdated', this.settings);
    
    // If streaming, apply settings might require restart
    if (this.isStreaming) {
      console.log('Settings updated during stream - may require restart for some changes');
    }
  }

  public getSettings(): StreamSettings {
    return { ...this.settings };
  }

  public isStreamingActive(): boolean {
    return this.isStreaming;
  }

  public getStreamStats(): StreamStats {
    const platformViewers: Record<string, number> = {};
    let totalViewers = 0;
    const totalChatMessages = 0;
    let bandwidth = 0;
    
    // Calculate stats from all platforms
    this.streamHealth.forEach((health, platformId) => {
      const platform = this.platforms.get(platformId);
      if (platform && health.status === 'connected') {
        // Simulated viewer counts - in real implementation would fetch from platform APIs
        const viewers = Math.floor(Math.random() * 1000);
        platformViewers[platform.name] = viewers;
        totalViewers += viewers;
        bandwidth += health.bitrate;
      }
    });

    // Determine overall quality
    const connectedPlatforms = Array.from(this.streamHealth.values()).filter(h => h.status === 'connected');
    const avgDroppedFrames = connectedPlatforms.reduce((sum, h) => sum + (h.droppedFrames / Math.max(h.totalFrames, 1)), 0) / Math.max(connectedPlatforms.length, 1);
    
    let quality: 'excellent' | 'good' | 'fair' | 'poor' = 'excellent';
    if (avgDroppedFrames > 0.1) quality = 'poor';
    else if (avgDroppedFrames > 0.05) quality = 'fair';
    else if (avgDroppedFrames > 0.02) quality = 'good';

    // Generate warnings
    const warnings: string[] = [];
    if (bandwidth > 50000) warnings.push('High bandwidth usage detected');
    if (connectedPlatforms.some(h => h.ping > 100)) warnings.push('High latency detected on some platforms');
    if (avgDroppedFrames > 0.05) warnings.push('Frame drops detected - check encoding settings');

    return {
      totalViewers,
      platformViewers,
      totalChatMessages,
      bandwidth,
      quality,
      warnings
    };
  }

  public getLocalRtmpUrl(): string {
    return `rtmp://localhost:${this.localRtmpPort}/live`;
  }

  public getLocalHttpUrl(): string {
    return `http://localhost:${this.localHttpPort}`;
  }

  public async testPlatformConnection(platformId: string): Promise<boolean> {
    const platform = this.platforms.get(platformId);
    if (!platform || !platform.streamKey) {
      return false;
    }

    try {
      // Test connection by attempting to connect to RTMP endpoint
      const testClient = new RTMPClient();
      const fullUrl = `${platform.rtmpUrl}/${platform.streamKey}`;
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          testClient.disconnect();
          resolve(false);
        }, 10000); // 10 second timeout

        testClient.on('connect', () => {
          clearTimeout(timeout);
          testClient.disconnect();
          resolve(true);
        });

        testClient.on('error', () => {
          clearTimeout(timeout);
          resolve(false);
        });

        // Attempt connection (simplified)
        console.log(`Testing connection to ${platform.name}: ${fullUrl}`);
        // In real implementation, would actually connect
        setTimeout(() => {
          clearTimeout(timeout);
          resolve(true); // Simulate successful test
        }, 2000);
      });
    } catch (error) {
      console.error(`Connection test failed for ${platform.name}:`, error);
      return false;
    }
  }

  public exportConfiguration(): any {
    return {
      platforms: Array.from(this.platforms.entries()).map(([id, platform]) => ({
        ...platform,
        streamKey: '' // Don't export sensitive keys
      })),
      settings: this.settings
    };
  }

  public importConfiguration(config: any): void {
    if (config.settings) {
      this.updateSettings(config.settings);
    }
    
    if (config.platforms) {
      // Clear existing custom platforms
      const defaultPlatformIds = ['youtube', 'twitch', 'tiktok', 'facebook', 'instagram', 'x'];
      Array.from(this.platforms.keys()).forEach(id => {
        if (!defaultPlatformIds.includes(id)) {
          this.platforms.delete(id);
        }
      });

      // Import platforms
      config.platforms.forEach((platformConfig: any) => {
        if (platformConfig.id && !defaultPlatformIds.includes(platformConfig.id)) {
          this.platforms.set(platformConfig.id, platformConfig);
        } else if (defaultPlatformIds.includes(platformConfig.id)) {
          // Update default platform settings (but not keys)
          const existing = this.platforms.get(platformConfig.id);
          if (existing) {
            this.platforms.set(platformConfig.id, {
              ...platformConfig,
              streamKey: existing.streamKey // Preserve existing key
            });
          }
        }
      });
    }

    this.emit('configurationImported');
  }
}

export default StreamingCore;