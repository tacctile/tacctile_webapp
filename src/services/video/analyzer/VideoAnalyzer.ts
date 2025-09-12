/**
 * Video Analyzer
 * Core video analysis system with frame-by-frame navigation
 */

import { EventEmitter } from 'events';
import { 
  VideoMetadata, 
  VideoFrame, 
  PlaybackState, 
  VideoEnhancements,
  FrameExtractionOptions,
  VideoAnalysisResult,
  TimelineMarker,
  VideoCache
} from '../types';
import { FFmpegProcessor } from './FFmpegProcessor';
import { FrameExtractor } from './FrameExtractor';
import { MotionDetector } from './MotionDetector';
import { VideoEnhancer } from './VideoEnhancer';
import { AnomalyDetector } from './AnomalyDetector';
import { logger } from '../../../utils/logger';

export class VideoAnalyzer extends EventEmitter {
  private videoPath: string | null = null;
  private metadata: VideoMetadata | null = null;
  private ffmpeg: FFmpegProcessor;
  private frameExtractor: FrameExtractor;
  private motionDetector: MotionDetector;
  private enhancer: VideoEnhancer;
  private anomalyDetector: AnomalyDetector;
  
  private playbackState: PlaybackState = {
    playing: false,
    currentTime: 0,
    playbackRate: 1,
    loop: false,
    volume: 1,
    muted: false
  };
  
  private cache: VideoCache = {
    frames: new Map(),
    thumbnails: new Map(),
    maxSize: 100,
    strategy: 'lru'
  };
  
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement;
  private animationFrame: number | null = null;
  private markers: TimelineMarker[] = [];
  private enhancements: VideoEnhancements = {
    brightness: 0,
    contrast: 0,
    saturation: 100,
    gamma: 1,
    exposure: 0,
    highlights: 0,
    shadows: 0,
    temperature: 0,
    tint: 0,
    sharpness: 0,
    denoise: 0,
    stabilization: false
  };

  constructor() {
    super();
    this.ffmpeg = new FFmpegProcessor();
    this.frameExtractor = new FrameExtractor(this.ffmpeg);
    this.motionDetector = new MotionDetector();
    this.enhancer = new VideoEnhancer();
    this.anomalyDetector = new AnomalyDetector();
    
    // Create canvas for frame rendering
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false 
    })!;
    
    // Create video element for playback
    this.video = document.createElement('video');
    this.setupVideoElement();
  }

  /**
   * Load video file for analysis
   */
  async loadVideo(path: string): Promise<void> {
    try {
      this.videoPath = path;
      
      // Get video metadata
      this.metadata = await this.ffmpeg.getMetadata(path);
      
      // Set canvas dimensions
      this.canvas.width = this.metadata.width;
      this.canvas.height = this.metadata.height;
      
      // Load video in HTML element
      this.video.src = `file://${path}`;
      await this.waitForVideoLoad();
      
      // Extract key frames for timeline
      await this.extractKeyFrames();
      
      // Initialize detectors
      this.motionDetector.initialize(this.metadata.width, this.metadata.height);
      this.anomalyDetector.initialize(this.metadata);
      
      this.emit('videoLoaded', this.metadata);
      logger.info('Video loaded', { path, metadata: this.metadata });
    } catch (error) {
      logger.error('Failed to load video', error);
      throw error;
    }
  }

  /**
   * Setup video element
   */
  private setupVideoElement(): void {
    this.video.muted = true;
    this.video.loop = false;
    this.video.preload = 'auto';
    
    this.video.addEventListener('timeupdate', () => {
      this.playbackState.currentTime = this.video.currentTime;
      this.emit('timeUpdate', this.video.currentTime);
    });
    
    this.video.addEventListener('ended', () => {
      if (this.playbackState.loop) {
        if (this.playbackState.loopStart !== undefined) {
          this.video.currentTime = this.playbackState.loopStart;
        } else {
          this.video.currentTime = 0;
        }
        this.video.play();
      } else {
        this.playbackState.playing = false;
        this.emit('playbackEnded');
      }
    });
    
    this.video.addEventListener('seeked', () => {
      this.renderCurrentFrame();
    });
  }

  /**
   * Wait for video to load
   */
  private waitForVideoLoad(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.video.readyState >= 3) {
        resolve();
        return;
      }
      
      const handleLoad = () => {
        this.video.removeEventListener('loadeddata', handleLoad);
        this.video.removeEventListener('error', handleError);
        resolve();
      };
      
      const handleError = () => {
        this.video.removeEventListener('loadeddata', handleLoad);
        this.video.removeEventListener('error', handleError);
        reject(new Error('Failed to load video'));
      };
      
      this.video.addEventListener('loadeddata', handleLoad);
      this.video.addEventListener('error', handleError);
    });
  }

  /**
   * Extract key frames for timeline
   */
  private async extractKeyFrames(): Promise<void> {
    if (!this.metadata) return;
    
    const options: FrameExtractionOptions = {
      interval: Math.max(1, this.metadata.duration / 100), // 100 thumbnails
      keyFramesOnly: true,
      quality: 0.5
    };
    
    const frames = await this.frameExtractor.extractFrames(this.videoPath!, options);
    
    // Cache thumbnails
    for (const frame of frames) {
      const thumbnail = this.createThumbnail(frame.data, 160, 90);
      this.cache.thumbnails.set(frame.index, thumbnail);
    }
  }

  /**
   * Create thumbnail from frame
   */
  private createThumbnail(frameData: ImageData, width: number, height: number): ImageData {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;
    
    // Draw scaled frame
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = frameData.width;
    sourceCanvas.height = frameData.height;
    const sourceCtx = sourceCanvas.getContext('2d')!;
    sourceCtx.putImageData(frameData, 0, 0);
    
    tempCtx.drawImage(sourceCanvas, 0, 0, width, height);
    return tempCtx.getImageData(0, 0, width, height);
  }

  /**
   * Play video
   */
  play(): void {
    if (!this.video.src) return;
    
    this.playbackState.playing = true;
    this.video.playbackRate = this.playbackState.playbackRate;
    this.video.play();
    this.startRenderLoop();
    this.emit('play');
  }

  /**
   * Pause video
   */
  pause(): void {
    this.playbackState.playing = false;
    this.video.pause();
    this.stopRenderLoop();
    this.emit('pause');
  }

  /**
   * Seek to time
   */
  seek(time: number): void {
    if (!this.metadata) return;
    
    time = Math.max(0, Math.min(time, this.metadata.duration));
    this.video.currentTime = time;
    this.playbackState.currentTime = time;
    this.emit('seek', time);
  }

  /**
   * Seek to frame
   */
  seekToFrame(frameIndex: number): void {
    if (!this.metadata) return;
    
    const time = frameIndex / this.metadata.frameRate;
    this.seek(time);
  }

  /**
   * Get current frame
   */
  getCurrentFrame(): VideoFrame {
    const frameIndex = Math.floor(this.playbackState.currentTime * this.metadata!.frameRate);
    
    // Check cache
    if (this.cache.frames.has(frameIndex)) {
      return this.cache.frames.get(frameIndex)!;
    }
    
    // Capture current frame
    this.ctx.drawImage(this.video, 0, 0);
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply enhancements
    const enhanced = this.enhancer.enhanceFrame(imageData, this.enhancements);
    
    const frame: VideoFrame = {
      index: frameIndex,
      timestamp: this.playbackState.currentTime,
      data: enhanced,
      keyFrame: false
    };
    
    // Cache frame
    this.cacheFrame(frame);
    
    return frame;
  }

  /**
   * Step forward one frame
   */
  stepForward(): void {
    if (!this.metadata) return;
    
    const frameTime = 1 / this.metadata.frameRate;
    this.seek(this.playbackState.currentTime + frameTime);
  }

  /**
   * Step backward one frame
   */
  stepBackward(): void {
    if (!this.metadata) return;
    
    const frameTime = 1 / this.metadata.frameRate;
    this.seek(this.playbackState.currentTime - frameTime);
  }

  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void {
    rate = Math.max(0.25, Math.min(4, rate));
    this.playbackState.playbackRate = rate;
    this.video.playbackRate = rate;
    this.emit('playbackRateChanged', rate);
  }

  /**
   * Set loop
   */
  setLoop(enabled: boolean, start?: number, end?: number): void {
    this.playbackState.loop = enabled;
    this.playbackState.loopStart = start;
    this.playbackState.loopEnd = end;
    
    if (enabled && end !== undefined) {
      // Set up loop end check
      this.video.addEventListener('timeupdate', this.checkLoopEnd);
    } else {
      this.video.removeEventListener('timeupdate', this.checkLoopEnd);
    }
  }

  /**
   * Check loop end
   */
  private checkLoopEnd = (): void => {
    if (this.playbackState.loopEnd && 
        this.video.currentTime >= this.playbackState.loopEnd) {
      this.video.currentTime = this.playbackState.loopStart || 0;
    }
  };

  /**
   * Set video enhancements
   */
  setEnhancements(enhancements: Partial<VideoEnhancements>): void {
    this.enhancements = { ...this.enhancements, ...enhancements };
    this.renderCurrentFrame();
    this.emit('enhancementsChanged', this.enhancements);
  }

  /**
   * Add timeline marker
   */
  addMarker(marker: TimelineMarker): void {
    this.markers.push(marker);
    this.markers.sort((a, b) => a.timestamp - b.timestamp);
    this.emit('markerAdded', marker);
  }

  /**
   * Remove timeline marker
   */
  removeMarker(markerId: string): void {
    const index = this.markers.findIndex(m => m.id === markerId);
    if (index !== -1) {
      const marker = this.markers.splice(index, 1)[0];
      this.emit('markerRemoved', marker);
    }
  }

  /**
   * Get timeline markers
   */
  getMarkers(): TimelineMarker[] {
    return [...this.markers];
  }

  /**
   * Analyze entire video
   */
  async analyzeVideo(
    onProgress?: (progress: number) => void
  ): Promise<VideoAnalysisResult> {
    if (!this.videoPath || !this.metadata) {
      throw new Error('No video loaded');
    }
    
    const result: VideoAnalysisResult = {
      anomalies: [],
      motionRegions: [],
      timeline: [],
      statistics: {
        totalFrames: Math.floor(this.metadata.duration * this.metadata.frameRate),
        analyzedFrames: 0,
        anomalyFrames: 0,
        motionFrames: 0,
        averageMotion: 0,
        peakMotion: 0,
        anomalyTypes: new Map()
      }
    };
    
    // Extract frames for analysis
    const options: FrameExtractionOptions = {
      interval: 1 / this.metadata.frameRate, // Every frame
      maxFrames: 1000 // Limit for performance
    };
    
    const frames = await this.frameExtractor.extractFrames(this.videoPath, options);
    let previousFrame: VideoFrame | null = null;
    let totalMotion = 0;
    
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      
      // Detect motion
      if (previousFrame) {
        const motion = await this.motionDetector.detectMotion(previousFrame.data, frame.data);
        frame.motion = motion.intensity;
        totalMotion += motion.intensity;
        
        if (motion.intensity > 0.1) {
          result.motionFrames++;
          result.peakMotion = Math.max(result.peakMotion, motion.intensity);
          
          // Add motion regions
          for (const region of motion.regions) {
            const existing = result.motionRegions.find(r => 
              Math.abs(r.x - region.x) < 50 && 
              Math.abs(r.y - region.y) < 50
            );
            
            if (existing) {
              existing.frames.push(frame.index);
              existing.intensity = Math.max(existing.intensity, region.intensity);
            } else {
              result.motionRegions.push({
                ...region,
                frames: [frame.index]
              });
            }
          }
        }
      }
      
      // Detect anomalies
      const anomalies = await this.anomalyDetector.detectAnomalies(frame);
      if (anomalies.length > 0) {
        result.anomalyFrames++;
        frame.anomalies = anomalies;
        result.anomalies.push(...anomalies);
        
        // Count anomaly types
        for (const anomaly of anomalies) {
          const count = result.statistics.anomalyTypes.get(anomaly.type) || 0;
          result.statistics.anomalyTypes.set(anomaly.type, count + 1);
        }
        
        // Add timeline marker
        result.timeline.push({
          id: `anomaly-${frame.index}`,
          timestamp: frame.timestamp,
          type: 'anomaly',
          label: `Anomaly detected`,
          description: anomalies.map(a => a.description).join(', '),
          confidence: Math.max(...anomalies.map(a => a.confidence))
        });
      }
      
      result.statistics.analyzedFrames++;
      previousFrame = frame;
      
      // Report progress
      if (onProgress) {
        onProgress((i + 1) / frames.length);
      }
    }
    
    // Calculate statistics
    result.statistics.averageMotion = totalMotion / Math.max(1, frames.length - 1);
    
    // Add significant motion markers
    for (const region of result.motionRegions) {
      if (region.frames.length > 5) {
        const startTime = region.frames[0] / this.metadata.frameRate;
        result.timeline.push({
          id: `motion-${region.frames[0]}`,
          timestamp: startTime,
          type: 'motion',
          label: 'Significant motion',
          description: `Motion detected in ${region.frames.length} frames`,
          confidence: region.intensity
        });
      }
    }
    
    // Sort timeline
    result.timeline.sort((a, b) => a.timestamp - b.timestamp);
    
    this.emit('analysisComplete', result);
    logger.info('Video analysis complete', { 
      path: this.videoPath, 
      anomalies: result.anomalies.length,
      motionRegions: result.motionRegions.length 
    });
    
    return result;
  }

  /**
   * Export enhanced video
   */
  async exportVideo(
    outputPath: string,
    options?: {
      startTime?: number;
      endTime?: number;
      includeMarkers?: boolean;
    }
  ): Promise<void> {
    if (!this.videoPath) {
      throw new Error('No video loaded');
    }
    
    await this.ffmpeg.exportEnhancedVideo(
      this.videoPath,
      outputPath,
      this.enhancements,
      options
    );
    
    this.emit('exportComplete', outputPath);
  }

  /**
   * Start render loop
   */
  private startRenderLoop(): void {
    if (this.animationFrame) return;
    
    const render = () => {
      if (this.playbackState.playing) {
        this.renderCurrentFrame();
        this.animationFrame = requestAnimationFrame(render);
      }
    };
    
    this.animationFrame = requestAnimationFrame(render);
  }

  /**
   * Stop render loop
   */
  private stopRenderLoop(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * Render current frame
   */
  private renderCurrentFrame(): void {
    if (!this.video.src) return;
    
    // Draw video frame to canvas
    this.ctx.drawImage(this.video, 0, 0);
    
    // Get image data
    let imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    
    // Apply enhancements
    imageData = this.enhancer.enhanceFrame(imageData, this.enhancements);
    
    // Put enhanced frame back
    this.ctx.putImageData(imageData, 0, 0);
    
    this.emit('frameRendered', this.getCurrentFrame());
  }

  /**
   * Cache frame
   */
  private cacheFrame(frame: VideoFrame): void {
    // Implement LRU cache
    if (this.cache.frames.size >= this.cache.maxSize) {
      const firstKey = this.cache.frames.keys().next().value;
      this.cache.frames.delete(firstKey);
    }
    
    this.cache.frames.set(frame.index, frame);
  }

  /**
   * Get video metadata
   */
  getMetadata(): VideoMetadata | null {
    return this.metadata;
  }

  /**
   * Get playback state
   */
  getPlaybackState(): PlaybackState {
    return { ...this.playbackState };
  }

  /**
   * Get canvas for rendering
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopRenderLoop();
    this.video.pause();
    this.video.src = '';
    this.cache.frames.clear();
    this.cache.thumbnails.clear();
    this.markers = [];
    this.removeAllListeners();
  }
}