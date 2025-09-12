import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface StreamOutput {
  id: string;
  name: string;
  rtmpUrl: string;
  streamKey: string;
  enabled: boolean;
  priority: number; // 1-5, higher = more important
  settings: {
    videoBitrate: number;
    audioBitrate: number;
    resolution: string;
    fps: number;
    videoCodec: 'h264' | 'h265';
    audioCodec: 'aac' | 'mp3';
    preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow' | 'slower' | 'veryslow';
    profile: 'baseline' | 'main' | 'high';
    keyframeInterval: number;
    bufferSize?: number;
  };
  adaptive: {
    enabled: boolean;
    minBitrate: number;
    maxBitrate: number;
    adaptationSpeed: number; // Seconds to adapt
  };
}

export interface SplitterStats {
  inputStats: {
    fps: number;
    bitrate: number;
    resolution: string;
    duration: number;
    frameDrops: number;
  };
  outputStats: Record<string, {
    fps: number;
    bitrate: number;
    quality: number; // 0-100
    latency: number;
    errors: number;
    status: 'connected' | 'connecting' | 'disconnected' | 'error';
  }>;
  systemStats: {
    cpuUsage: number;
    memoryUsage: number;
    networkUpload: number;
    encoding: {
      h264Sessions: number;
      h265Sessions: number;
      hardwareAccelerated: boolean;
    };
  };
}

export interface BandwidthOptimization {
  enabled: boolean;
  totalBandwidthLimit: number; // Mbps
  priorityBasedAllocation: boolean;
  adaptiveQuality: boolean;
  emergencyDropouts: string[]; // Output IDs to drop if bandwidth insufficient
}

export class RTMPSplitter extends EventEmitter {
  private ffmpegPath: string;
  private inputUrl = '';
  private outputs: Map<string, StreamOutput> = new Map();
  private ffmpegProcess: ChildProcess | null = null;
  private isRunning = false;
  private stats: SplitterStats;
  private bandwidthOptimization: BandwidthOptimization;
  private adaptiveQualityEnabled = true;
  private statsInterval: NodeJS.Timeout | null = null;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;

  constructor() {
    super();
    
    this.ffmpegPath = this.getFFmpegPath();
    this.bandwidthOptimization = {
      enabled: true,
      totalBandwidthLimit: 50, // 50 Mbps default
      priorityBasedAllocation: true,
      adaptiveQuality: true,
      emergencyDropouts: []
    };

    this.stats = {
      inputStats: {
        fps: 0,
        bitrate: 0,
        resolution: '1920x1080',
        duration: 0,
        frameDrops: 0
      },
      outputStats: {},
      systemStats: {
        cpuUsage: 0,
        memoryUsage: 0,
        networkUpload: 0,
        encoding: {
          h264Sessions: 0,
          h265Sessions: 0,
          hardwareAccelerated: false
        }
      }
    };

    this.initializeDefaultOutputs();
  }

  private getFFmpegPath(): string {
    try {
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      return ffmpegInstaller.path;
    } catch (error) {
      // Fallback to system FFmpeg
      return 'ffmpeg';
    }
  }

  private initializeDefaultOutputs(): void {
    const defaultOutputs: Omit<StreamOutput, 'id'>[] = [
      {
        name: 'YouTube',
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKey: '',
        enabled: false,
        priority: 5,
        settings: {
          videoBitrate: 6000,
          audioBitrate: 128,
          resolution: '1920x1080',
          fps: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          preset: 'fast',
          profile: 'high',
          keyframeInterval: 2,
          bufferSize: 12000
        },
        adaptive: {
          enabled: true,
          minBitrate: 2000,
          maxBitrate: 8000,
          adaptationSpeed: 5
        }
      },
      {
        name: 'Twitch',
        rtmpUrl: 'rtmp://live.twitch.tv/live',
        streamKey: '',
        enabled: false,
        priority: 5,
        settings: {
          videoBitrate: 6000,
          audioBitrate: 160,
          resolution: '1920x1080',
          fps: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          preset: 'fast',
          profile: 'main',
          keyframeInterval: 2,
          bufferSize: 12000
        },
        adaptive: {
          enabled: true,
          minBitrate: 1500,
          maxBitrate: 8500,
          adaptationSpeed: 3
        }
      },
      {
        name: 'TikTok',
        rtmpUrl: 'rtmp://live.tiktok.com/live',
        streamKey: '',
        enabled: false,
        priority: 3,
        settings: {
          videoBitrate: 4000,
          audioBitrate: 128,
          resolution: '1920x1080',
          fps: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          preset: 'fast',
          profile: 'main',
          keyframeInterval: 2,
          bufferSize: 8000
        },
        adaptive: {
          enabled: true,
          minBitrate: 1500,
          maxBitrate: 4000,
          adaptationSpeed: 4
        }
      },
      {
        name: 'Facebook',
        rtmpUrl: 'rtmps://live-api-s.facebook.com:443/rtmp',
        streamKey: '',
        enabled: false,
        priority: 4,
        settings: {
          videoBitrate: 4000,
          audioBitrate: 128,
          resolution: '1920x1080',
          fps: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          preset: 'fast',
          profile: 'main',
          keyframeInterval: 2,
          bufferSize: 8000
        },
        adaptive: {
          enabled: true,
          minBitrate: 1000,
          maxBitrate: 4000,
          adaptationSpeed: 5
        }
      },
      {
        name: 'Instagram',
        rtmpUrl: 'rtmps://live-upload.instagram.com:443/rtmp',
        streamKey: '',
        enabled: false,
        priority: 3,
        settings: {
          videoBitrate: 3500,
          audioBitrate: 128,
          resolution: '1920x1080',
          fps: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          preset: 'fast',
          profile: 'main',
          keyframeInterval: 2,
          bufferSize: 7000
        },
        adaptive: {
          enabled: true,
          minBitrate: 1000,
          maxBitrate: 3500,
          adaptationSpeed: 4
        }
      },
      {
        name: 'X (Twitter)',
        rtmpUrl: 'rtmp://live.twitter.com/live',
        streamKey: '',
        enabled: false,
        priority: 2,
        settings: {
          videoBitrate: 5000,
          audioBitrate: 128,
          resolution: '1920x1080',
          fps: 30,
          videoCodec: 'h264',
          audioCodec: 'aac',
          preset: 'fast',
          profile: 'main',
          keyframeInterval: 2,
          bufferSize: 10000
        },
        adaptive: {
          enabled: true,
          minBitrate: 1500,
          maxBitrate: 5000,
          adaptationSpeed: 5
        }
      }
    ];

    defaultOutputs.forEach((output, index) => {
      const id = output.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      this.outputs.set(id, { ...output, id });
      this.stats.outputStats[id] = {
        fps: 0,
        bitrate: 0,
        quality: 0,
        latency: 0,
        errors: 0,
        status: 'disconnected'
      };
    });
  }

  public setInputUrl(url: string): void {
    this.inputUrl = url;
    this.emit('inputUrlChanged', url);
  }

  public addOutput(output: Omit<StreamOutput, 'id'>): string {
    const id = `custom_${Date.now()}`;
    const newOutput: StreamOutput = { ...output, id };
    
    this.outputs.set(id, newOutput);
    this.stats.outputStats[id] = {
      fps: 0,
      bitrate: 0,
      quality: 0,
      latency: 0,
      errors: 0,
      status: 'disconnected'
    };
    
    this.emit('outputAdded', newOutput);
    
    // Restart if currently running
    if (this.isRunning) {
      this.restart();
    }
    
    return id;
  }

  public removeOutput(outputId: string): boolean {
    if (!this.outputs.has(outputId)) return false;
    
    this.outputs.delete(outputId);
    delete this.stats.outputStats[outputId];
    
    this.emit('outputRemoved', outputId);
    
    // Restart if currently running
    if (this.isRunning) {
      this.restart();
    }
    
    return true;
  }

  public updateOutput(outputId: string, updates: Partial<StreamOutput>): boolean {
    const output = this.outputs.get(outputId);
    if (!output) return false;
    
    const updatedOutput = { ...output, ...updates };
    this.outputs.set(outputId, updatedOutput);
    
    this.emit('outputUpdated', updatedOutput);
    
    // Restart if currently running and significant changes made
    if (this.isRunning && this.isSignificantChange(updates)) {
      this.restart();
    }
    
    return true;
  }

  private isSignificantChange(updates: Partial<StreamOutput>): boolean {
    return !!(updates.settings || updates.rtmpUrl || updates.streamKey || updates.enabled !== undefined);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Splitter is already running');
    }

    if (!this.inputUrl) {
      throw new Error('Input URL not set');
    }

    const enabledOutputs = Array.from(this.outputs.values()).filter(o => o.enabled && o.streamKey);
    if (enabledOutputs.length === 0) {
      throw new Error('No enabled outputs with stream keys');
    }

    try {
      await this.startFFmpegProcess();
      this.isRunning = true;
      this.restartAttempts = 0;
      this.startStatsCollection();
      this.emit('started');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      
      // Give it 5 seconds to terminate gracefully, then force kill
      setTimeout(() => {
        if (this.ffmpegProcess && !this.ffmpegProcess.killed) {
          this.ffmpegProcess.kill('SIGKILL');
        }
      }, 5000);
      
      this.ffmpegProcess = null;
    }

    // Reset all output statuses
    Object.keys(this.stats.outputStats).forEach(id => {
      this.stats.outputStats[id].status = 'disconnected';
    });

    this.emit('stopped');
  }

  private async restart(): Promise<void> {
    if (!this.isRunning) return;
    
    await this.stop();
    
    setTimeout(() => {
      if (this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts++;
        this.start().catch(error => {
          console.error(`Restart attempt ${this.restartAttempts} failed:`, error);
          if (this.restartAttempts >= this.maxRestartAttempts) {
            this.emit('restartFailed', error);
          }
        });
      } else {
        this.emit('maxRestartsReached');
      }
    }, 2000);
  }

  private async startFFmpegProcess(): Promise<void> {
    const enabledOutputs = Array.from(this.outputs.values())
      .filter(o => o.enabled && o.streamKey)
      .sort((a, b) => b.priority - a.priority); // Sort by priority descending

    if (this.bandwidthOptimization.enabled) {
      this.optimizeBandwidth(enabledOutputs);
    }

    const args = this.buildFFmpegArgs(enabledOutputs);
    
    return new Promise((resolve, reject) => {
      this.ffmpegProcess = spawn(this.ffmpegPath, args);
      
      let hasStarted = false;
      let errorOutput = '';

      this.ffmpegProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('FFmpeg stdout:', output);
        this.parseFFmpegOutput(output);
      });

      this.ffmpegProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        errorOutput += output;
        console.log('FFmpeg stderr:', output);
        
        if (!hasStarted) {
          // Look for successful stream start indicators
          if (output.includes('Press [q] to stop') || output.includes('Stream mapping:')) {
            hasStarted = true;
            resolve();
          }
        }
        
        this.parseFFmpegOutput(output);
      });

      this.ffmpegProcess.on('error', (error) => {
        console.error('FFmpeg process error:', error);
        if (!hasStarted) {
          reject(error);
        } else {
          this.emit('processError', error);
          this.restart();
        }
      });

      this.ffmpegProcess.on('exit', (code, signal) => {
        console.log(`FFmpeg process exited with code ${code}, signal ${signal}`);
        this.ffmpegProcess = null;
        
        if (this.isRunning) {
          // Unexpected exit, try to restart
          this.emit('unexpectedExit', { code, signal, errorOutput });
          this.restart();
        }
      });

      // Timeout if FFmpeg doesn't start within 30 seconds
      setTimeout(() => {
        if (!hasStarted) {
          const error = new Error(`FFmpeg failed to start within 30 seconds. Error output: ${errorOutput}`);
          reject(error);
        }
      }, 30000);
    });
  }

  private optimizeBandwidth(outputs: StreamOutput[]): void {
    const totalBandwidth = this.bandwidthOptimization.totalBandwidthLimit * 1000; // Convert to kbps
    let requiredBandwidth = 0;
    
    // Calculate total required bandwidth
    outputs.forEach(output => {
      requiredBandwidth += output.settings.videoBitrate + output.settings.audioBitrate;
    });
    
    if (requiredBandwidth > totalBandwidth) {
      console.log(`Bandwidth optimization required: ${requiredBandwidth}kbps > ${totalBandwidth}kbps`);
      
      if (this.bandwidthOptimization.priorityBasedAllocation) {
        this.allocateBandwidthByPriority(outputs, totalBandwidth);
      } else {
        this.allocateBandwidthProportionally(outputs, totalBandwidth);
      }
    }
  }

  private allocateBandwidthByPriority(outputs: StreamOutput[], totalBandwidth: number): void {
    let remainingBandwidth = totalBandwidth;
    
    // Allocate minimum bandwidth first
    outputs.forEach(output => {
      const minBandwidth = output.adaptive.minBitrate + output.settings.audioBitrate;
      remainingBandwidth -= minBandwidth;
      output.settings.videoBitrate = output.adaptive.minBitrate;
    });
    
    // Distribute remaining bandwidth by priority
    outputs.forEach(output => {
      if (remainingBandwidth > 0) {
        const additionalBandwidth = Math.min(
          remainingBandwidth * (output.priority / 15), // Normalize priority
          output.adaptive.maxBitrate - output.settings.videoBitrate
        );
        output.settings.videoBitrate += additionalBandwidth;
        remainingBandwidth -= additionalBandwidth;
      }
    });
  }

  private allocateBandwidthProportionally(outputs: StreamOutput[], totalBandwidth: number): void {
    const totalOriginalBandwidth = outputs.reduce((sum, o) => 
      sum + o.settings.videoBitrate + o.settings.audioBitrate, 0
    );
    
    const scaleFactor = totalBandwidth / totalOriginalBandwidth;
    
    outputs.forEach(output => {
      const originalTotal = output.settings.videoBitrate + output.settings.audioBitrate;
      const newTotal = originalTotal * scaleFactor;
      output.settings.videoBitrate = Math.max(
        output.adaptive.minBitrate,
        newTotal - output.settings.audioBitrate
      );
    });
  }

  private buildFFmpegArgs(outputs: StreamOutput[]): string[] {
    const args: string[] = [
      '-i', this.inputUrl,
      '-c:v', 'libx264',
      '-c:a', 'aac',
      '-preset', 'fast',
      '-tune', 'zerolatency',
      '-maxrate', '10000k',
      '-bufsize', '20000k',
      '-pix_fmt', 'yuv420p',
      '-g', '60', // GOP size
      '-keyint_min', '60',
      '-sc_threshold', '0',
      '-f', 'flv'
    ];

    // Add hardware acceleration if available
    if (this.detectHardwareAcceleration()) {
      args.unshift('-hwaccel', 'auto');
      this.stats.systemStats.encoding.hardwareAccelerated = true;
    }

    // Add outputs
    outputs.forEach((output, index) => {
      // Video encoding settings
      args.push(
        '-map', '0:v',
        '-map', '0:a',
        '-c:v:' + index, `lib${output.settings.videoCodec}`,
        '-c:a:' + index, output.settings.audioCodec,
        '-b:v:' + index, `${output.settings.videoBitrate}k`,
        '-b:a:' + index, `${output.settings.audioBitrate}k`,
        '-preset:' + index, output.settings.preset,
        '-profile:v:' + index, output.settings.profile,
        '-r:' + index, output.settings.fps.toString(),
        '-s:' + index, output.settings.resolution,
        '-g:' + index, (output.settings.keyframeInterval * output.settings.fps).toString()
      );

      if (output.settings.bufferSize) {
        args.push('-bufsize:' + index, `${output.settings.bufferSize}k`);
      }

      // Output URL
      const outputUrl = `${output.rtmpUrl}/${output.streamKey}`;
      args.push('-f', 'flv', outputUrl);
    });

    // Global options
    args.push(
      '-report',
      '-loglevel', 'info',
      '-stats',
      '-stats_period', '5'
    );

    console.log('FFmpeg command:', this.ffmpegPath, args.join(' '));
    return args;
  }

  private detectHardwareAcceleration(): boolean {
    // This is a simplified detection - in practice you'd check for specific hardware
    return process.platform === 'win32' || process.platform === 'darwin';
  }

  private parseFFmpegOutput(output: string): void {
    // Parse various FFmpeg statistics and errors
    
    // Extract FPS
    const fpsMatch = output.match(/fps=\s*(\d+\.?\d*)/);
    if (fpsMatch) {
      this.stats.inputStats.fps = parseFloat(fpsMatch[1]);
    }

    // Extract bitrate
    const bitrateMatch = output.match(/bitrate=\s*(\d+\.?\d*)\s*kbits\/s/);
    if (bitrateMatch) {
      this.stats.inputStats.bitrate = parseFloat(bitrateMatch[1]);
    }

    // Extract frame drops
    const dropMatch = output.match(/drop=\s*(\d+)/);
    if (dropMatch) {
      this.stats.inputStats.frameDrops = parseInt(dropMatch[1]);
    }

    // Extract duration
    const durationMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
    if (durationMatch) {
      const hours = parseInt(durationMatch[1]);
      const minutes = parseInt(durationMatch[2]);
      const seconds = parseInt(durationMatch[3]);
      this.stats.inputStats.duration = hours * 3600 + minutes * 60 + seconds;
    }

    // Detect stream connection issues
    if (output.includes('Connection refused') || output.includes('Connection timed out')) {
      this.handleConnectionError(output);
    }

    // Detect successful connections
    if (output.includes('Stream mapping:') || output.includes('Output #')) {
      this.handleStreamConnect(output);
    }

    this.emit('statsUpdate', this.stats);
  }

  private handleConnectionError(output: string): void {
    // Try to identify which output failed
    Object.keys(this.stats.outputStats).forEach(id => {
      const output_obj = this.outputs.get(id);
      if (output_obj && output.includes(output_obj.rtmpUrl)) {
        this.stats.outputStats[id].status = 'error';
        this.stats.outputStats[id].errors++;
        this.emit('outputError', { outputId: id, error: output });
      }
    });
  }

  private handleStreamConnect(output: string): void {
    // Mark outputs as connected
    Object.keys(this.stats.outputStats).forEach(id => {
      this.stats.outputStats[id].status = 'connected';
    });
  }

  private startStatsCollection(): void {
    this.statsInterval = setInterval(() => {
      this.updateSystemStats();
      this.emit('statsUpdate', this.stats);
    }, 5000);
  }

  private updateSystemStats(): void {
    // Update system statistics (simplified)
    this.stats.systemStats.cpuUsage = Math.random() * 100; // Placeholder
    this.stats.systemStats.memoryUsage = Math.random() * 8192; // MB
    this.stats.systemStats.networkUpload = this.calculateNetworkUpload();
    
    // Count encoding sessions
    const enabledOutputs = Array.from(this.outputs.values()).filter(o => o.enabled);
    this.stats.systemStats.encoding.h264Sessions = enabledOutputs.filter(o => o.settings.videoCodec === 'h264').length;
    this.stats.systemStats.encoding.h265Sessions = enabledOutputs.filter(o => o.settings.videoCodec === 'h265').length;
  }

  private calculateNetworkUpload(): number {
    return Object.values(this.stats.outputStats)
      .filter(stat => stat.status === 'connected')
      .reduce((sum, stat) => sum + stat.bitrate, 0);
  }

  public getStats(): SplitterStats {
    return { ...this.stats };
  }

  public getOutputs(): StreamOutput[] {
    return Array.from(this.outputs.values());
  }

  public getOutput(id: string): StreamOutput | null {
    return this.outputs.get(id) || null;
  }

  public setBandwidthOptimization(config: Partial<BandwidthOptimization>): void {
    this.bandwidthOptimization = { ...this.bandwidthOptimization, ...config };
    this.emit('bandwidthOptimizationUpdated', this.bandwidthOptimization);
  }

  public getBandwidthOptimization(): BandwidthOptimization {
    return { ...this.bandwidthOptimization };
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public getInputUrl(): string {
    return this.inputUrl;
  }

  public async testOutput(outputId: string): Promise<boolean> {
    const output = this.outputs.get(outputId);
    if (!output || !output.streamKey) {
      return false;
    }

    // Simple connection test using a minimal FFmpeg command
    return new Promise((resolve) => {
      const testArgs = [
        '-f', 'lavfi',
        '-i', 'testsrc2=duration=1:size=320x240:rate=1',
        '-f', 'flv',
        '-t', '1',
        `${output.rtmpUrl}/${output.streamKey}`
      ];

      const testProcess = spawn(this.ffmpegPath, testArgs);
      
      let success = false;
      
      testProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Stream mapping:') && !success) {
          success = true;
          testProcess.kill('SIGTERM');
          resolve(true);
        }
      });

      testProcess.on('exit', () => {
        if (!success) resolve(false);
      });

      testProcess.on('error', () => {
        resolve(false);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!success) {
          testProcess.kill('SIGKILL');
          resolve(false);
        }
      }, 10000);
    });
  }

  public exportConfiguration(): any {
    return {
      inputUrl: this.inputUrl,
      outputs: Array.from(this.outputs.values()).map(output => ({
        ...output,
        streamKey: '' // Don't export sensitive keys
      })),
      bandwidthOptimization: this.bandwidthOptimization
    };
  }

  public importConfiguration(config: any): void {
    if (config.inputUrl) {
      this.setInputUrl(config.inputUrl);
    }

    if (config.outputs) {
      // Clear existing custom outputs
      const defaultIds = ['youtube', 'twitch', 'tiktok', 'facebook', 'instagram', 'x'];
      Array.from(this.outputs.keys()).forEach(id => {
        if (!defaultIds.includes(id)) {
          this.removeOutput(id);
        }
      });

      // Import outputs
      config.outputs.forEach((outputConfig: any) => {
        if (outputConfig.id && !defaultIds.includes(outputConfig.id)) {
          this.outputs.set(outputConfig.id, outputConfig);
        } else if (defaultIds.includes(outputConfig.id)) {
          const existing = this.outputs.get(outputConfig.id);
          if (existing) {
            this.updateOutput(outputConfig.id, {
              ...outputConfig,
              streamKey: existing.streamKey // Preserve existing key
            });
          }
        }
      });
    }

    if (config.bandwidthOptimization) {
      this.setBandwidthOptimization(config.bandwidthOptimization);
    }

    this.emit('configurationImported');
  }
}

export default RTMPSplitter;