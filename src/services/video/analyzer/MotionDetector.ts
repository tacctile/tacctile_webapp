/**
 * Motion Detector
 * Advanced motion detection algorithms for video analysis
 */

import { MotionRegion, MotionDetectionConfig } from '../types';
import { logger } from '../../../utils/logger';

export class MotionDetector {
  private width: number = 0;
  private height: number = 0;
  private previousFrame: Uint8ClampedArray | null = null;
  private backgroundModel: Float32Array | null = null;
  private motionHistory: Float32Array | null = null;
  private config: MotionDetectionConfig = {
    sensitivity: 0.7,
    threshold: 30,
    minArea: 100,
    maxArea: 100000,
    history: 10,
    algorithm: 'frame_diff',
    ignoreRegions: []
  };

  /**
   * Initialize motion detector
   */
  initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.previousFrame = null;
    this.backgroundModel = new Float32Array(width * height);
    this.motionHistory = new Float32Array(width * height);
    
    logger.info('Motion detector initialized', { width, height });
  }

  /**
   * Configure motion detection
   */
  configure(config: Partial<MotionDetectionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Detect motion between frames
   */
  async detectMotion(
    frame1: ImageData,
    frame2: ImageData
  ): Promise<{
    intensity: number;
    regions: MotionRegion[];
    mask: Uint8ClampedArray;
  }> {
    switch (this.config.algorithm) {
      case 'optical_flow':
        return this.opticalFlowDetection(frame1, frame2);
      case 'background_subtraction':
        return this.backgroundSubtractionDetection(frame2);
      case 'frame_diff':
      default:
        return this.frameDifferenceDetection(frame1, frame2);
    }
  }

  /**
   * Frame difference motion detection
   */
  private frameDifferenceDetection(
    frame1: ImageData,
    frame2: ImageData
  ): {
    intensity: number;
    regions: MotionRegion[];
    mask: Uint8ClampedArray;
  } {
    const { width, height } = frame1;
    const mask = new Uint8ClampedArray(width * height);
    
    // Convert to grayscale
    const gray1 = this.toGrayscale(frame1);
    const gray2 = this.toGrayscale(frame2);
    
    // Calculate difference
    let motionPixels = 0;
    for (let i = 0; i < gray1.length; i++) {
      const diff = Math.abs(gray1[i] - gray2[i]);
      
      if (diff > this.config.threshold) {
        mask[i] = 255;
        motionPixels++;
      }
    }
    
    // Apply morphological operations to clean up noise
    this.morphologicalClose(mask, width, height);
    
    // Apply ignore regions
    this.applyIgnoreRegions(mask, width, height);
    
    // Find motion regions
    const regions = this.findMotionRegions(mask, width, height);
    
    // Calculate motion intensity
    const intensity = motionPixels / (width * height);
    
    // Update motion history
    this.updateMotionHistory(mask);
    
    return { intensity, regions, mask };
  }

  /**
   * Optical flow motion detection
   */
  private opticalFlowDetection(
    frame1: ImageData,
    frame2: ImageData
  ): {
    intensity: number;
    regions: MotionRegion[];
    mask: Uint8ClampedArray;
  } {
    const { width, height } = frame1;
    const mask = new Uint8ClampedArray(width * height);
    
    // Convert to grayscale
    const gray1 = this.toGrayscale(frame1);
    const gray2 = this.toGrayscale(frame2);
    
    // Calculate optical flow using Lucas-Kanade method
    const flow = this.lucasKanadeOpticalFlow(gray1, gray2, width, height);
    
    // Convert flow to motion mask
    let motionPixels = 0;
    for (let i = 0; i < flow.length; i += 2) {
      const magnitude = Math.sqrt(flow[i] * flow[i] + flow[i + 1] * flow[i + 1]);
      
      if (magnitude > this.config.threshold / 10) {
        mask[i / 2] = Math.min(255, magnitude * 10);
        motionPixels++;
      }
    }
    
    // Apply morphological operations
    this.morphologicalClose(mask, width, height);
    
    // Apply ignore regions
    this.applyIgnoreRegions(mask, width, height);
    
    // Find motion regions with flow information
    const regions = this.findMotionRegionsWithFlow(mask, flow, width, height);
    
    // Calculate motion intensity
    const intensity = motionPixels / (width * height);
    
    return { intensity, regions, mask };
  }

  /**
   * Background subtraction motion detection
   */
  private backgroundSubtractionDetection(
    frame: ImageData
  ): {
    intensity: number;
    regions: MotionRegion[];
    mask: Uint8ClampedArray;
  } {
    const { width, height } = frame;
    const mask = new Uint8ClampedArray(width * height);
    
    // Convert to grayscale
    const gray = this.toGrayscale(frame);
    
    // Initialize or update background model
    if (!this.backgroundModel) {
      this.backgroundModel = new Float32Array(gray);
      return { intensity: 0, regions: [], mask };
    }
    
    // Update background model (running average)
    const alpha = 0.05; // Learning rate
    let motionPixels = 0;
    
    for (let i = 0; i < gray.length; i++) {
      // Update background
      this.backgroundModel[i] = alpha * gray[i] + (1 - alpha) * this.backgroundModel[i];
      
      // Detect foreground
      const diff = Math.abs(gray[i] - this.backgroundModel[i]);
      
      if (diff > this.config.threshold) {
        mask[i] = 255;
        motionPixels++;
      }
    }
    
    // Apply morphological operations
    this.morphologicalClose(mask, width, height);
    
    // Apply ignore regions
    this.applyIgnoreRegions(mask, width, height);
    
    // Find motion regions
    const regions = this.findMotionRegions(mask, width, height);
    
    // Calculate motion intensity
    const intensity = motionPixels / (width * height);
    
    return { intensity, regions, mask };
  }

  /**
   * Lucas-Kanade optical flow
   */
  private lucasKanadeOpticalFlow(
    gray1: Uint8ClampedArray,
    gray2: Uint8ClampedArray,
    width: number,
    height: number
  ): Float32Array {
    const flow = new Float32Array(width * height * 2);
    const windowSize = 5;
    const halfWindow = Math.floor(windowSize / 2);
    
    // Calculate gradients
    const Ix = this.calculateGradientX(gray1, width, height);
    const Iy = this.calculateGradientY(gray1, width, height);
    const It = new Float32Array(width * height);
    
    for (let i = 0; i < gray1.length; i++) {
      It[i] = gray2[i] - gray1[i];
    }
    
    // For each pixel, solve optical flow equation
    for (let y = halfWindow; y < height - halfWindow; y++) {
      for (let x = halfWindow; x < width - halfWindow; x++) {
        let sumIx2 = 0, sumIy2 = 0, sumIxIy = 0;
        let sumIxIt = 0, sumIyIt = 0;
        
        // Window around pixel
        for (let wy = -halfWindow; wy <= halfWindow; wy++) {
          for (let wx = -halfWindow; wx <= halfWindow; wx++) {
            const idx = (y + wy) * width + (x + wx);
            
            sumIx2 += Ix[idx] * Ix[idx];
            sumIy2 += Iy[idx] * Iy[idx];
            sumIxIy += Ix[idx] * Iy[idx];
            sumIxIt += Ix[idx] * It[idx];
            sumIyIt += Iy[idx] * It[idx];
          }
        }
        
        // Solve 2x2 system
        const det = sumIx2 * sumIy2 - sumIxIy * sumIxIy;
        
        if (Math.abs(det) > 0.001) {
          const flowIdx = (y * width + x) * 2;
          flow[flowIdx] = (sumIy2 * (-sumIxIt) - sumIxIy * (-sumIyIt)) / det;
          flow[flowIdx + 1] = (sumIx2 * (-sumIyIt) - sumIxIy * (-sumIxIt)) / det;
        }
      }
    }
    
    return flow;
  }

  /**
   * Calculate X gradient
   */
  private calculateGradientX(gray: Uint8ClampedArray, width: number, height: number): Float32Array {
    const gradient = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        gradient[idx] = (gray[idx + 1] - gray[idx - 1]) / 2;
      }
    }
    
    return gradient;
  }

  /**
   * Calculate Y gradient
   */
  private calculateGradientY(gray: Uint8ClampedArray, width: number, height: number): Float32Array {
    const gradient = new Float32Array(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        gradient[idx] = (gray[idx + width] - gray[idx - width]) / 2;
      }
    }
    
    return gradient;
  }

  /**
   * Convert to grayscale
   */
  private toGrayscale(imageData: ImageData): Uint8ClampedArray {
    const { data, width, height } = imageData;
    const gray = new Uint8ClampedArray(width * height);
    
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
    
    return gray;
  }

  /**
   * Morphological close operation
   */
  private morphologicalClose(mask: Uint8ClampedArray, width: number, height: number): void {
    // Dilation followed by erosion
    this.dilate(mask, width, height);
    this.erode(mask, width, height);
  }

  /**
   * Dilation operation
   */
  private dilate(mask: Uint8ClampedArray, width: number, height: number): void {
    const temp = new Uint8ClampedArray(mask);
    const radius = 2;
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let maxVal = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = (y + dy) * width + (x + dx);
            maxVal = Math.max(maxVal, temp[idx]);
          }
        }
        
        mask[y * width + x] = maxVal;
      }
    }
  }

  /**
   * Erosion operation
   */
  private erode(mask: Uint8ClampedArray, width: number, height: number): void {
    const temp = new Uint8ClampedArray(mask);
    const radius = 2;
    
    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        let minVal = 255;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const idx = (y + dy) * width + (x + dx);
            minVal = Math.min(minVal, temp[idx]);
          }
        }
        
        mask[y * width + x] = minVal;
      }
    }
  }

  /**
   * Apply ignore regions to mask
   */
  private applyIgnoreRegions(mask: Uint8ClampedArray, width: number, height: number): void {
    if (!this.config.ignoreRegions) return;
    
    for (const region of this.config.ignoreRegions) {
      for (let y = region.y; y < region.y + region.height && y < height; y++) {
        for (let x = region.x; x < region.x + region.width && x < width; x++) {
          mask[y * width + x] = 0;
        }
      }
    }
  }

  /**
   * Find motion regions in mask
   */
  private findMotionRegions(
    mask: Uint8ClampedArray,
    width: number,
    height: number
  ): MotionRegion[] {
    const regions: MotionRegion[] = [];
    const visited = new Uint8Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (mask[idx] > 0 && !visited[idx]) {
          const region = this.floodFill(mask, visited, x, y, width, height);
          
          if (region.area >= this.config.minArea && region.area <= this.config.maxArea) {
            regions.push({
              x: region.minX,
              y: region.minY,
              width: region.maxX - region.minX + 1,
              height: region.maxY - region.minY + 1,
              intensity: region.intensity,
              direction: 0,
              speed: 0,
              frames: []
            });
          }
        }
      }
    }
    
    return regions;
  }

  /**
   * Find motion regions with flow information
   */
  private findMotionRegionsWithFlow(
    mask: Uint8ClampedArray,
    flow: Float32Array,
    width: number,
    height: number
  ): MotionRegion[] {
    const regions = this.findMotionRegions(mask, width, height);
    
    // Calculate flow statistics for each region
    for (const region of regions) {
      let sumVx = 0, sumVy = 0;
      let count = 0;
      
      for (let y = region.y; y < region.y + region.height; y++) {
        for (let x = region.x; x < region.x + region.width; x++) {
          const maskIdx = y * width + x;
          
          if (mask[maskIdx] > 0) {
            const flowIdx = maskIdx * 2;
            sumVx += flow[flowIdx];
            sumVy += flow[flowIdx + 1];
            count++;
          }
        }
      }
      
      if (count > 0) {
        const avgVx = sumVx / count;
        const avgVy = sumVy / count;
        
        region.direction = Math.atan2(avgVy, avgVx) * 180 / Math.PI;
        region.speed = Math.sqrt(avgVx * avgVx + avgVy * avgVy);
      }
    }
    
    return regions;
  }

  /**
   * Flood fill algorithm
   */
  private floodFill(
    mask: Uint8ClampedArray,
    visited: Uint8Array,
    startX: number,
    startY: number,
    width: number,
    height: number
  ): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    area: number;
    intensity: number;
  } {
    const stack: Array<[number, number]> = [[startX, startY]];
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    let area = 0;
    let intensitySum = 0;
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = y * width + x;
      
      if (visited[idx] || mask[idx] === 0) continue;
      
      visited[idx] = 1;
      area++;
      intensitySum += mask[idx];
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Add neighbors
      if (x > 0) stack.push([x - 1, y]);
      if (x < width - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < height - 1) stack.push([x, y + 1]);
    }
    
    return {
      minX, minY, maxX, maxY, area,
      intensity: area > 0 ? intensitySum / (area * 255) : 0
    };
  }

  /**
   * Update motion history
   */
  private updateMotionHistory(mask: Uint8ClampedArray): void {
    if (!this.motionHistory) return;
    
    const decay = 0.9;
    
    for (let i = 0; i < mask.length; i++) {
      this.motionHistory[i] = this.motionHistory[i] * decay + mask[i] / 255 * (1 - decay);
    }
  }

  /**
   * Get motion heatmap
   */
  getMotionHeatmap(): ImageData | null {
    if (!this.motionHistory || !this.width || !this.height) return null;
    
    const imageData = new ImageData(this.width, this.height);
    const { data } = imageData;
    
    for (let i = 0; i < this.motionHistory.length; i++) {
      const intensity = this.motionHistory[i];
      const idx = i * 4;
      
      // Color mapping (blue -> green -> yellow -> red)
      if (intensity < 0.25) {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = intensity * 4 * 255;
      } else if (intensity < 0.5) {
        const t = (intensity - 0.25) * 4;
        data[idx] = 0;
        data[idx + 1] = t * 255;
        data[idx + 2] = (1 - t) * 255;
      } else if (intensity < 0.75) {
        const t = (intensity - 0.5) * 4;
        data[idx] = t * 255;
        data[idx + 1] = 255;
        data[idx + 2] = 0;
      } else {
        const t = (intensity - 0.75) * 4;
        data[idx] = 255;
        data[idx + 1] = (1 - t) * 255;
        data[idx + 2] = 0;
      }
      
      data[idx + 3] = intensity * 255;
    }
    
    return imageData;
  }

  /**
   * Detect specific motion patterns
   */
  detectMotionPattern(
    regions: MotionRegion[],
    pattern: 'linear' | 'circular' | 'erratic' | 'stationary'
  ): MotionRegion[] {
    return regions.filter(region => {
      switch (pattern) {
        case 'linear':
          // Consistent direction
          return region.speed > 5 && Math.abs(region.direction) < 180;
          
        case 'circular':
          // Rotating motion
          return region.speed > 3 && this.isCircularMotion(region);
          
        case 'erratic':
          // Random motion
          return region.speed > 10 && this.isErraticMotion(region);
          
        case 'stationary':
          // Minimal motion
          return region.speed < 2;
          
        default:
          return false;
      }
    });
  }

  /**
   * Check if motion is circular
   */
  private isCircularMotion(region: MotionRegion): boolean {
    // Would need motion history to properly detect
    // For now, use simple heuristic
    return region.width / region.height > 0.8 && region.width / region.height < 1.2;
  }

  /**
   * Check if motion is erratic
   */
  private isErraticMotion(region: MotionRegion): boolean {
    // High speed with variable direction indicates erratic motion
    return region.speed > 10 && region.intensity > 0.5;
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.previousFrame = null;
    if (this.backgroundModel) {
      this.backgroundModel.fill(0);
    }
    if (this.motionHistory) {
      this.motionHistory.fill(0);
    }
  }
}