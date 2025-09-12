/**
 * Video Anomaly Detector
 * Detect paranormal anomalies in video frames
 */

import { 
  VideoFrame, 
  FrameAnomaly, 
  VideoAnomalyType,
  VideoMetadata,
  MotionRegion
} from '../types';
import { logger } from '../../../utils/logger';

export class AnomalyDetector {
  private metadata: VideoMetadata | null = null;
  private frameHistory: VideoFrame[] = [];
  private maxHistory = 30;
  private anomalyThreshold = 0.6;
  private temporalBuffer: Map<string, FrameAnomaly[]> = new Map();

  /**
   * Initialize anomaly detector
   */
  initialize(metadata: VideoMetadata): void {
    this.metadata = metadata;
    this.frameHistory = [];
    this.temporalBuffer.clear();
    logger.info('Anomaly detector initialized');
  }

  /**
   * Detect anomalies in video frame
   */
  async detectAnomalies(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    
    // Update frame history
    this.updateFrameHistory(frame);
    
    // Run detection algorithms
    const detections = await Promise.all([
      this.detectOrbs(frame),
      this.detectApparitions(frame),
      this.detectShadowFigures(frame),
      this.detectLightAnomalies(frame),
      this.detectDistortions(frame),
      this.detectEnergyPatterns(frame),
      this.detectPortalActivity(frame)
    ]);
    
    // Flatten and filter results
    for (const detection of detections.flat()) {
      if (detection.confidence >= this.anomalyThreshold) {
        anomalies.push(detection);
      }
    }
    
    // Temporal analysis
    if (this.frameHistory.length >= 5) {
      const temporalAnomalies = await this.detectTemporalAnomalies();
      anomalies.push(...temporalAnomalies);
    }
    
    // Update temporal buffer
    this.updateTemporalBuffer(frame.index, anomalies);
    
    // Correlate with motion if available
    if (frame.motion && frame.motion > 0.1) {
      this.correlateWithMotion(anomalies, frame.motion);
    }
    
    return anomalies;
  }

  /**
   * Detect orb movements
   */
  private async detectOrbs(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    const { data, index, timestamp } = frame;
    const { width, height } = data;
    
    // Convert to grayscale for analysis
    const gray = this.toGrayscale(data);
    
    // Find bright circular regions
    const circles = this.detectCircles(gray, width, height);
    
    for (const circle of circles) {
      // Check for orb characteristics
      if (this.isOrbLike(data, circle)) {
        // Track orb movement if history available
        const movement = this.trackOrbMovement(circle, index);
        
        anomalies.push({
          type: VideoAnomalyType.ORB_MOVEMENT,
          x: circle.x - circle.radius,
          y: circle.y - circle.radius,
          width: circle.radius * 2,
          height: circle.radius * 2,
          confidence: circle.confidence * 0.8,
          motion: movement?.speed || 0,
          description: `Orb detected, ${movement ? 'moving' : 'stationary'}`,
          startFrame: movement?.startFrame || index,
          endFrame: index
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect apparitions
   */
  private async detectApparitions(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    
    if (this.frameHistory.length < 3) return anomalies;
    
    const { data, index } = frame;
    const { width, height } = data;
    
    // Compare with previous frames
    const prevFrame = this.frameHistory[this.frameHistory.length - 2];
    const diff = this.calculateFrameDifference(data, prevFrame.data);
    
    // Look for semi-transparent figures
    const regions = this.findTransparentRegions(diff, width, height);
    
    for (const region of regions) {
      if (this.isFigureLike(region, data)) {
        anomalies.push({
          type: VideoAnomalyType.APPARITION,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          confidence: region.confidence,
          motion: region.motion || 0,
          description: 'Apparition or manifestation detected',
          startFrame: index - 2,
          endFrame: index
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect shadow figures
   */
  private async detectShadowFigures(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    const { data, index } = frame;
    const { width, height } = data;
    
    // Find dark regions with humanoid shape
    const darkRegions = this.findDarkRegions(data, width, height);
    
    for (const region of darkRegions) {
      if (this.isHumanoidShape(region)) {
        // Check for movement
        const movement = this.trackRegionMovement(region, index);
        
        anomalies.push({
          type: VideoAnomalyType.SHADOW_FIGURE,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          confidence: region.confidence * 0.7,
          motion: movement?.speed || 0,
          description: 'Shadow figure detected',
          startFrame: movement?.startFrame || index,
          endFrame: index
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect light anomalies
   */
  private async detectLightAnomalies(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    const { data, index } = frame;
    const { width, height } = data;
    
    // Analyze light patterns
    const lightPatterns = this.analyzeLightPatterns(data, width, height);
    
    for (const pattern of lightPatterns) {
      if (pattern.isAnomolous) {
        anomalies.push({
          type: VideoAnomalyType.LIGHT_ANOMALY,
          x: pattern.x,
          y: pattern.y,
          width: pattern.width,
          height: pattern.height,
          confidence: pattern.confidence,
          motion: pattern.flickerRate || 0,
          description: `${pattern.type} light anomaly`,
          startFrame: index,
          endFrame: index
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect spatial distortions
   */
  private async detectDistortions(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    
    if (this.frameHistory.length < 2) return anomalies;
    
    const { data, index } = frame;
    const { width, height } = data;
    const prevFrame = this.frameHistory[this.frameHistory.length - 2];
    
    // Calculate optical flow
    const flow = this.calculateOpticalFlow(prevFrame.data, data);
    
    // Find areas with unusual flow patterns
    const distortions = this.findFlowDistortions(flow, width, height);
    
    for (const distortion of distortions) {
      anomalies.push({
        type: VideoAnomalyType.DISTORTION,
        x: distortion.x,
        y: distortion.y,
        width: distortion.width,
        height: distortion.height,
        confidence: distortion.confidence,
        motion: distortion.magnitude,
        description: 'Spatial distortion detected',
        startFrame: index - 1,
        endFrame: index
      });
    }
    
    return anomalies;
  }

  /**
   * Detect energy patterns
   */
  private async detectEnergyPatterns(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    const { data, index } = frame;
    const { width, height } = data;
    
    // Analyze electromagnetic-like patterns
    const patterns = this.analyzeEnergyPatterns(data, width, height);
    
    for (const pattern of patterns) {
      if (pattern.intensity > 0.5) {
        anomalies.push({
          type: VideoAnomalyType.ENERGY_SURGE,
          x: pattern.x,
          y: pattern.y,
          width: pattern.width,
          height: pattern.height,
          confidence: pattern.confidence,
          motion: pattern.pulsation || 0,
          description: 'Energy field or surge detected',
          startFrame: index,
          endFrame: index
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect portal activity
   */
  private async detectPortalActivity(frame: VideoFrame): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    
    if (this.frameHistory.length < 5) return anomalies;
    
    const { data, index } = frame;
    const { width, height } = data;
    
    // Look for swirling or vortex patterns
    const vortexRegions = this.detectVortexPatterns(data, width, height);
    
    for (const vortex of vortexRegions) {
      // Check temporal consistency
      if (this.isTemporallyConsistent(vortex, index, 3)) {
        anomalies.push({
          type: VideoAnomalyType.PORTAL,
          x: vortex.x,
          y: vortex.y,
          width: vortex.width,
          height: vortex.height,
          confidence: vortex.confidence * 0.9,
          motion: vortex.rotation || 0,
          description: 'Portal or vortex activity detected',
          startFrame: index - 3,
          endFrame: index
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect temporal anomalies across frames
   */
  private async detectTemporalAnomalies(): Promise<FrameAnomaly[]> {
    const anomalies: FrameAnomaly[] = [];
    const recentFrames = this.frameHistory.slice(-10);
    
    // Check for manifestations (objects appearing/disappearing)
    const manifestations = this.detectManifestations(recentFrames);
    anomalies.push(...manifestations);
    
    // Check for repetitive patterns
    const patterns = this.detectRepetitivePatterns(recentFrames);
    anomalies.push(...patterns);
    
    return anomalies;
  }

  /**
   * Detect manifestations
   */
  private detectManifestations(frames: VideoFrame[]): FrameAnomaly[] {
    const anomalies: FrameAnomaly[] = [];
    
    for (let i = 1; i < frames.length - 1; i++) {
      const prev = frames[i - 1].data;
      const curr = frames[i].data;
      const next = frames[i + 1].data;
      
      // Find objects that appear and disappear
      const appearing = this.findAppearingObjects(prev, curr, next);
      
      for (const obj of appearing) {
        anomalies.push({
          type: VideoAnomalyType.MANIFESTATION,
          x: obj.x,
          y: obj.y,
          width: obj.width,
          height: obj.height,
          confidence: obj.confidence,
          motion: 0,
          description: 'Object manifestation detected',
          startFrame: frames[i - 1].index,
          endFrame: frames[i + 1].index
        });
      }
    }
    
    return anomalies;
  }

  /**
   * Detect repetitive patterns
   */
  private detectRepetitivePatterns(frames: VideoFrame[]): FrameAnomaly[] {
    // Simplified - would need more sophisticated pattern matching
    return [];
  }

  /**
   * Helper methods
   */

  private toGrayscale(imageData: ImageData): Uint8ClampedArray {
    const { data, width, height } = imageData;
    const gray = new Uint8ClampedArray(width * height);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    return gray;
  }

  private detectCircles(gray: Uint8ClampedArray, width: number, height: number): any[] {
    const circles: any[] = [];
    const threshold = 200; // Bright threshold
    
    // Simplified circle detection
    for (let y = 10; y < height - 10; y += 5) {
      for (let x = 10; x < width - 10; x += 5) {
        const idx = y * width + x;
        
        if (gray[idx] > threshold) {
          // Check if circular region
          const radius = this.estimateRadius(gray, x, y, width, height);
          
          if (radius > 3 && radius < 50) {
            circles.push({
              x, y, radius,
              confidence: Math.min(gray[idx] / 255, 1)
            });
          }
        }
      }
    }
    
    return circles;
  }

  private estimateRadius(
    gray: Uint8ClampedArray,
    cx: number,
    cy: number,
    width: number,
    height: number
  ): number {
    const centerBrightness = gray[cy * width + cx];
    const threshold = centerBrightness * 0.7;
    let radius = 0;
    
    // Scan outward until brightness drops
    for (let r = 1; r < 50; r++) {
      const samples = 8;
      let brightCount = 0;
      
      for (let i = 0; i < samples; i++) {
        const angle = (i / samples) * 2 * Math.PI;
        const x = Math.round(cx + r * Math.cos(angle));
        const y = Math.round(cy + r * Math.sin(angle));
        
        if (x >= 0 && x < width && y >= 0 && y < height) {
          if (gray[y * width + x] > threshold) {
            brightCount++;
          }
        }
      }
      
      if (brightCount < samples / 2) {
        radius = r;
        break;
      }
    }
    
    return radius;
  }

  private isOrbLike(imageData: ImageData, circle: any): boolean {
    // Check for orb characteristics
    const { data, width } = imageData;
    const { x, y, radius } = circle;
    
    // Sample center and edge colors
    const centerIdx = (y * width + x) * 4;
    const centerBrightness = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
    
    // Orbs are typically bright and semi-transparent
    return centerBrightness > 150 && radius > 5 && radius < 30;
  }

  private calculateFrameDifference(frame1: ImageData, frame2: ImageData): ImageData {
    const { width, height } = frame1;
    const diff = new ImageData(width, height);
    
    for (let i = 0; i < frame1.data.length; i += 4) {
      diff.data[i] = Math.abs(frame1.data[i] - frame2.data[i]);
      diff.data[i + 1] = Math.abs(frame1.data[i + 1] - frame2.data[i + 1]);
      diff.data[i + 2] = Math.abs(frame1.data[i + 2] - frame2.data[i + 2]);
      diff.data[i + 3] = 255;
    }
    
    return diff;
  }

  private findTransparentRegions(diff: ImageData, width: number, height: number): any[] {
    // Simplified transparent region detection
    return [];
  }

  private findDarkRegions(data: ImageData, width: number, height: number): any[] {
    const regions: any[] = [];
    const threshold = 50;
    
    // Grid-based dark region detection
    const gridSize = 20;
    
    for (let gy = 0; gy < height - gridSize; gy += gridSize) {
      for (let gx = 0; gx < width - gridSize; gx += gridSize) {
        let darkPixels = 0;
        
        for (let y = gy; y < gy + gridSize; y++) {
          for (let x = gx; x < gx + gridSize; x++) {
            const idx = (y * width + x) * 4;
            const brightness = (data.data[idx] + data.data[idx + 1] + data.data[idx + 2]) / 3;
            
            if (brightness < threshold) {
              darkPixels++;
            }
          }
        }
        
        const darkness = darkPixels / (gridSize * gridSize);
        if (darkness > 0.7) {
          regions.push({
            x: gx,
            y: gy,
            width: gridSize,
            height: gridSize,
            confidence: darkness
          });
        }
      }
    }
    
    return regions;
  }

  private isFigureLike(region: any, data: ImageData): boolean {
    // Check aspect ratio and size
    const aspectRatio = region.height / region.width;
    return aspectRatio > 1.5 && aspectRatio < 3 && region.width > 20;
  }

  private isHumanoidShape(region: any): boolean {
    // Check for humanoid proportions
    const aspectRatio = region.height / region.width;
    return aspectRatio > 1.8 && aspectRatio < 2.5;
  }

  private analyzeLightPatterns(data: ImageData, width: number, height: number): any[] {
    const patterns: any[] = [];
    
    // Detect bright spots
    for (let y = 0; y < height - 10; y += 10) {
      for (let x = 0; x < width - 10; x += 10) {
        const idx = (y * width + x) * 4;
        const brightness = (data.data[idx] + data.data[idx + 1] + data.data[idx + 2]) / 3;
        
        if (brightness > 200) {
          patterns.push({
            x, y, width: 10, height: 10,
            confidence: brightness / 255,
            isAnomolous: true,
            type: 'bright'
          });
        }
      }
    }
    
    return patterns;
  }

  private calculateOpticalFlow(prev: ImageData, curr: ImageData): Float32Array {
    // Simplified optical flow
    const { width, height } = prev;
    return new Float32Array(width * height * 2);
  }

  private findFlowDistortions(flow: Float32Array, width: number, height: number): any[] {
    // Simplified distortion detection
    return [];
  }

  private analyzeEnergyPatterns(data: ImageData, width: number, height: number): any[] {
    // Simplified energy pattern detection
    return [];
  }

  private detectVortexPatterns(data: ImageData, width: number, height: number): any[] {
    // Simplified vortex detection
    return [];
  }

  private findAppearingObjects(prev: ImageData, curr: ImageData, next: ImageData): any[] {
    // Simplified object appearance detection
    return [];
  }

  private trackOrbMovement(circle: any, frameIndex: number): any {
    // Simplified orb tracking
    return null;
  }

  private trackRegionMovement(region: any, frameIndex: number): any {
    // Simplified region tracking
    return null;
  }

  private isTemporallyConsistent(region: any, frameIndex: number, frames: number): boolean {
    // Check if anomaly persists across frames
    return true; // Simplified
  }

  private updateFrameHistory(frame: VideoFrame): void {
    this.frameHistory.push(frame);
    
    if (this.frameHistory.length > this.maxHistory) {
      this.frameHistory.shift();
    }
  }

  private updateTemporalBuffer(frameIndex: number, anomalies: FrameAnomaly[]): void {
    const key = `frame_${frameIndex}`;
    this.temporalBuffer.set(key, anomalies);
    
    // Clean old entries
    if (this.temporalBuffer.size > 100) {
      const firstKey = this.temporalBuffer.keys().next().value;
      this.temporalBuffer.delete(firstKey);
    }
  }

  private correlateWithMotion(anomalies: FrameAnomaly[], motionIntensity: number): void {
    // Adjust confidence based on motion correlation
    for (const anomaly of anomalies) {
      if (anomaly.motion > 0) {
        anomaly.confidence *= (1 + motionIntensity * 0.2);
        anomaly.confidence = Math.min(1, anomaly.confidence);
      }
    }
  }

  /**
   * Set detection threshold
   */
  setThreshold(threshold: number): void {
    this.anomalyThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.frameHistory = [];
    this.temporalBuffer.clear();
  }
}