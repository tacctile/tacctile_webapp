// Core streaming services
export {
  default as StreamingCore,
  type StreamPlatform,
  type StreamSettings,
  type StreamHealth,
  type StreamStats
} from './StreamingCore';

export {
  default as ChatManager,
  type ChatMessage,
  type ChatUser,
  type PlatformConfig,
  type ChatStats
} from './ChatManager';

export {
  default as RTMPSplitter,
  type StreamOutput,
  type SplitterStats,
  type BandwidthOptimization
} from './RTMPSplitter';

export {
  default as ReplayBuffer,
  type ReplayClip,
  type BufferSettings,
  type AnomalyDetection,
  type HighlightMarker,
  type ReplayBufferStats
} from './ReplayBuffer';

// Streaming components
export { StreamingDashboard } from '../../components/streaming/StreamingDashboard';
export { 
  InvestigationOverlay,
  type OverlayElement,
  type TeamMember,
  type InvestigationData
} from '../../components/streaming/InvestigationOverlay';

// Streaming utilities and helpers
export class StreamingManager {
  private streamingCore: StreamingCore;
  private chatManager: ChatManager;
  private rtmpSplitter: RTMPSplitter;
  private replayBuffer: ReplayBuffer;

  constructor() {
    this.streamingCore = new StreamingCore();
    this.chatManager = new ChatManager();
    this.rtmpSplitter = new RTMPSplitter();
    this.replayBuffer = new ReplayBuffer();
    
    this.setupIntegrations();
  }

  private setupIntegrations(): void {
    // Connect chat manager to streaming events
    this.streamingCore.on('streamStarted', () => {
      this.chatManager.connectToPlatforms();
    });

    this.streamingCore.on('streamEnded', () => {
      this.chatManager.disconnectFromPlatforms();
    });

    // Connect RTMP splitter to streaming core
    this.streamingCore.on('streamStarted', ({ streamPath }) => {
      const inputUrl = `rtmp://localhost:1935${streamPath}`;
      this.rtmpSplitter.setInputUrl(inputUrl);
      this.rtmpSplitter.start().catch(console.error);
    });

    this.streamingCore.on('streamEnded', () => {
      this.rtmpSplitter.stop().catch(console.error);
    });

    // Connect replay buffer to anomaly detection
    this.chatManager.on('paranormalMention', ({ message, keywords }) => {
      this.replayBuffer.addHighlightMarker(
        `Paranormal mention in chat: ${keywords.join(', ')}`,
        'event',
        'medium'
      );
    });

    // Environmental data updates for replay buffer
    // This would be connected to actual sensor data
    setInterval(() => {
      this.replayBuffer.updateEnvironmentalData({
        emfReading: Math.random() * 10,
        temperature: 20 + (Math.random() - 0.5) * 4,
        audioLevel: Math.random() * 100,
        location: 'Investigation Site'
      });
    }, 1000);
  }

  public getStreamingCore(): StreamingCore {
    return this.streamingCore;
  }

  public getChatManager(): ChatManager {
    return this.chatManager;
  }

  public getRTMPSplitter(): RTMPSplitter {
    return this.rtmpSplitter;
  }

  public getReplayBuffer(): ReplayBuffer {
    return this.replayBuffer;
  }

  public async initialize(): Promise<void> {
    try {
      await this.streamingCore.startServer();
      console.log('Streaming system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize streaming system:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.replayBuffer.stopBuffer();
      await this.rtmpSplitter.stop();
      await this.chatManager.disconnectFromPlatforms();
      await this.streamingCore.stopServer();
      console.log('Streaming system shutdown successfully');
    } catch (error) {
      console.error('Failed to shutdown streaming system:', error);
      throw error;
    }
  }

  public exportAllConfigurations(): any {
    return {
      streamingCore: this.streamingCore.exportConfiguration(),
      rtmpSplitter: this.rtmpSplitter.exportConfiguration(),
      replayBuffer: this.replayBuffer.exportConfiguration(),
      timestamp: new Date().toISOString()
    };
  }

  public importAllConfigurations(config: any): void {
    if (config.streamingCore) {
      this.streamingCore.importConfiguration(config.streamingCore);
    }
    
    if (config.rtmpSplitter) {
      this.rtmpSplitter.importConfiguration(config.rtmpSplitter);
    }
    
    if (config.replayBuffer) {
      this.replayBuffer.importConfiguration(config.replayBuffer);
    }
  }
}

// Factory function for easy initialization
export function createStreamingManager(): StreamingManager {
  return new StreamingManager();
}

// Streaming presets for common use cases
export const StreamingPresets = {
  // High quality streaming for evidence collection
  evidenceRecording: {
    streamingCore: {
      outputResolution: '1920x1080',
      fps: 60,
      videoBitrate: 8000,
      audioBitrate: 192,
      videoEncoder: 'x264' as const,
      audioEncoder: 'aac' as const,
      keyframeInterval: 2,
      bufferSize: 16000,
      enableHardwareAcceleration: true
    },
    replayBuffer: {
      enabled: true,
      bufferDuration: 60,
      maxBufferSize: 1000,
      recordingFormat: 'mp4' as const,
      videoCodec: 'h264' as const,
      audioCodec: 'aac' as const,
      quality: 'high' as const,
      autoCleanup: false,
      maxClips: 200
    },
    anomalyDetection: {
      enabled: true,
      emfThreshold: 3.0,
      temperatureChange: 1.5,
      audioThreshold: 75.0,
      autoTriggerDelay: 10
    }
  },

  // Optimized for mobile streaming
  mobileStreaming: {
    streamingCore: {
      outputResolution: '1280x720',
      fps: 30,
      videoBitrate: 3000,
      audioBitrate: 128,
      videoEncoder: 'x264' as const,
      audioEncoder: 'aac' as const,
      keyframeInterval: 2,
      bufferSize: 6000,
      enableHardwareAcceleration: true
    },
    replayBuffer: {
      enabled: true,
      bufferDuration: 30,
      maxBufferSize: 500,
      recordingFormat: 'mp4' as const,
      videoCodec: 'h264' as const,
      audioCodec: 'aac' as const,
      quality: 'medium' as const,
      autoCleanup: true,
      maxClips: 50
    },
    anomalyDetection: {
      enabled: true,
      emfThreshold: 5.0,
      temperatureChange: 2.0,
      audioThreshold: 80.0,
      autoTriggerDelay: 5
    }
  },

  // Low bandwidth streaming
  lowBandwidth: {
    streamingCore: {
      outputResolution: '1280x720',
      fps: 24,
      videoBitrate: 1500,
      audioBitrate: 96,
      videoEncoder: 'x264' as const,
      audioEncoder: 'aac' as const,
      keyframeInterval: 3,
      bufferSize: 3000,
      enableHardwareAcceleration: true
    },
    replayBuffer: {
      enabled: true,
      bufferDuration: 20,
      maxBufferSize: 300,
      recordingFormat: 'mp4' as const,
      videoCodec: 'h264' as const,
      audioCodec: 'aac' as const,
      quality: 'low' as const,
      autoCleanup: true,
      maxClips: 25
    },
    anomalyDetection: {
      enabled: true,
      emfThreshold: 7.0,
      temperatureChange: 3.0,
      audioThreshold: 85.0,
      autoTriggerDelay: 3
    }
  }
};

// Utility functions
export const StreamingUtils = {
  // Calculate required bandwidth for streaming setup
  calculateBandwidth(settings: any): number {
    let totalBandwidth = 0;
    
    if (settings.streamingCore) {
      totalBandwidth += settings.streamingCore.videoBitrate + settings.streamingCore.audioBitrate;
    }
    
    // Add overhead for protocol and multiple streams
    return Math.ceil(totalBandwidth * 1.2); // 20% overhead
  },

  // Validate streaming configuration
  validateConfiguration(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.streamingCore) {
      errors.push('Streaming core configuration missing');
    } else {
      if (config.streamingCore.videoBitrate < 500) {
        errors.push('Video bitrate too low (minimum 500 kbps)');
      }
      if (config.streamingCore.videoBitrate > 50000) {
        errors.push('Video bitrate too high (maximum 50 Mbps)');
      }
      if (config.streamingCore.fps < 15 || config.streamingCore.fps > 60) {
        errors.push('FPS must be between 15 and 60');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  },

  // Generate streaming URLs for different platforms
  generatePlatformUrls(baseUrl: string): Record<string, string> {
    return {
      youtube: `${baseUrl}/youtube`,
      twitch: `${baseUrl}/twitch`,
      tiktok: `${baseUrl}/tiktok`,
      facebook: `${baseUrl}/facebook`,
      instagram: `${baseUrl}/instagram`,
      twitter: `${baseUrl}/twitter`
    };
  },

  // Format file sizes
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  },

  // Format duration
  formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }
};