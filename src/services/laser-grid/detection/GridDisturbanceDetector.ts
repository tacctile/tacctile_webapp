/**
 * Grid Disturbance Detector
 * Detects disturbances in laser grid patterns using computer vision
 */

import { EventEmitter } from 'events';
import {
  GridPattern,
  GridDisturbance,
  DisturbanceType,
  CameraFrame,
  ProcessedFrame,
  DetectedDot,
  DetectionSettings,
  GridAlignment,
  Vector2,
  BoundingBox2D,
  ProcessingPipeline,
  DetectionAlgorithm
} from '../types';
import { logger } from '../../../utils/logger';

export interface DetectionContext {
  baselineFrames: CameraFrame[];
  currentPattern: GridPattern;
  previousDetections: GridDisturbance[];
  frameHistory: ProcessedFrame[];
}

export class GridDisturbanceDetector extends EventEmitter {
  private settings: DetectionSettings;
  private context: DetectionContext;
  private pipeline: ProcessingPipeline;
  private backgroundModel: ImageData | null = null;
  private frameCount = 0;
  private isCalibrated = false;
  private gridAlignment: GridAlignment | null = null;

  constructor(settings: DetectionSettings) {
    super();
    
    this.settings = settings;
    this.context = {
      baselineFrames: [],
      currentPattern: null as any,
      previousDetections: [],
      frameHistory: []
    };

    this.pipeline = this.initializePipeline();
  }

  /**
   * Initialize processing pipeline
   */
  private initializePipeline(): ProcessingPipeline {
    return {
      preprocessing: [
        {
          type: 'gaussian_blur',
          parameters: { kernelSize: 3, sigma: 1.0 },
          enabled: true
        },
        {
          type: 'background_subtraction',
          parameters: { learningRate: 0.01, threshold: 30 },
          enabled: true
        }
      ],
      detection: [
        {
          name: 'Blob Detection',
          type: 'blob_detection',
          parameters: {
            minThreshold: 50,
            maxThreshold: 200,
            minArea: 10,
            maxArea: 1000,
            minCircularity: 0.1
          },
          enabled: true,
          weight: 0.6
        },
        {
          name: 'Template Matching',
          type: 'template_matching',
          parameters: {
            method: 'TM_CCOEFF_NORMED',
            threshold: 0.7
          },
          enabled: true,
          weight: 0.4
        }
      ],
      postprocessing: [
        {
          type: 'cluster_analysis',
          parameters: { maxDistance: 20, minClusterSize: 2 },
          enabled: true
        },
        {
          type: 'temporal_coherence',
          parameters: { maxFrameGap: 3, minDuration: 100 },
          enabled: true
        }
      ],
      validation: [
        {
          type: 'size_filter',
          parameters: { minSize: 2, maxSize: 50 },
          enabled: true
        },
        {
          type: 'geometry_check',
          parameters: { maxAspectRatio: 3.0, minRoundness: 0.2 },
          enabled: true
        }
      ]
    };
  }

  /**
   * Process camera frame for disturbances
   */
  async processFrame(frame: CameraFrame, pattern: GridPattern): Promise<ProcessedFrame> {
    this.frameCount++;
    this.context.currentPattern = pattern;

    // Update background model
    if (!this.backgroundModel) {
      this.initializeBackgroundModel(frame);
    } else {
      this.updateBackgroundModel(frame);
    }

    // Preprocess frame
    const preprocessedFrame = await this.preprocessFrame(frame);

    // Detect dots
    const detectedDots = await this.detectDots(preprocessedFrame, pattern);

    // Align grid
    if (!this.isCalibrated || this.frameCount % 30 === 0) {
      this.gridAlignment = this.calculateGridAlignment(detectedDots, pattern);
      if (this.gridAlignment && this.gridAlignment.confidence > 0.8) {
        this.isCalibrated = true;
      }
    }

    // Match detected dots to expected positions
    const matchedDots = this.matchDotsToGrid(detectedDots, pattern, this.gridAlignment);

    // Detect disturbances
    const disturbances = await this.detectDisturbances(matchedDots, pattern);

    // Post-process disturbances
    const filteredDisturbances = this.postProcessDisturbances(disturbances);

    const processedFrame: ProcessedFrame = {
      originalFrame: frame,
      detectedDots: matchedDots,
      disturbances: filteredDisturbances,
      gridAlignment: this.gridAlignment || {
        rotation: 0,
        scale: { x: 1, y: 1 },
        translation: { x: 0, y: 0 },
        confidence: 0,
        calibrationMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1]
      },
      timestamp: Date.now()
    };

    // Update context
    this.updateContext(processedFrame);

    // Emit significant disturbances
    for (const disturbance of filteredDisturbances) {
      if (disturbance.intensity > this.settings.minimumDisturbanceSize / 100) {
        this.emit('disturbance-detected', disturbance);
      }
    }

    return processedFrame;
  }

  /**
   * Initialize background model
   */
  private initializeBackgroundModel(frame: CameraFrame): void {
    const canvas = this.createCanvasFromFrame(frame);
    const ctx = canvas.getContext('2d')!;
    this.backgroundModel = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    logger.info('Background model initialized');
  }

  /**
   * Update background model
   */
  private updateBackgroundModel(frame: CameraFrame): void {
    if (!this.backgroundModel) return;

    const learningRate = 0.01;
    const canvas = this.createCanvasFromFrame(frame);
    const ctx = canvas.getContext('2d')!;
    const currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.backgroundModel.data.length; i += 4) {
      // Update RGB channels (skip alpha)
      for (let c = 0; c < 3; c++) {
        this.backgroundModel.data[i + c] = 
          this.backgroundModel.data[i + c] * (1 - learningRate) + 
          currentImage.data[i + c] * learningRate;
      }
    }
  }

  /**
   * Preprocess frame
   */
  private async preprocessFrame(frame: CameraFrame): Promise<ImageData> {
    let canvas = this.createCanvasFromFrame(frame);
    let ctx = canvas.getContext('2d')!;

    for (const step of this.pipeline.preprocessing) {
      if (!step.enabled) continue;

      switch (step.type) {
        case 'gaussian_blur':
          canvas = this.applyGaussianBlur(canvas, step.parameters);
          break;
        case 'median_filter':
          canvas = this.applyMedianFilter(canvas, step.parameters);
          break;
        case 'background_subtraction':
          canvas = this.applyBackgroundSubtraction(canvas, step.parameters);
          break;
        case 'histogram_equalization':
          canvas = this.applyHistogramEqualization(canvas);
          break;
      }
      ctx = canvas.getContext('2d')!;
    }

    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * Detect dots in preprocessed frame
   */
  private async detectDots(imageData: ImageData, pattern: GridPattern): Promise<DetectedDot[]> {
    const detectedDots: DetectedDot[] = [];

    for (const algorithm of this.pipeline.detection) {
      if (!algorithm.enabled) continue;

      let algorithmDots: DetectedDot[] = [];

      switch (algorithm.type) {
        case 'blob_detection':
          algorithmDots = this.detectDotsWithBlobDetection(imageData, algorithm.parameters);
          break;
        case 'template_matching':
          algorithmDots = this.detectDotsWithTemplateMatching(imageData, algorithm.parameters);
          break;
        case 'optical_flow':
          algorithmDots = this.detectDotsWithOpticalFlow(imageData, algorithm.parameters);
          break;
      }

      // Weight algorithm results
      for (const dot of algorithmDots) {
        dot.confidence *= algorithm.weight;
      }

      detectedDots.push(...algorithmDots);
    }

    // Merge overlapping detections
    return this.mergeOverlappingDots(detectedDots);
  }

  /**
   * Detect dots using blob detection
   */
  private detectDotsWithBlobDetection(imageData: ImageData, params: any): DetectedDot[] {
    const dots: DetectedDot[] = [];
    const { width, height, data } = imageData;
    const visited = new Set<number>();

    const minThreshold = params.minThreshold || 100;
    const minArea = params.minArea || 10;
    const maxArea = params.maxArea || 1000;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const intensity = data[idx]; // Red channel for laser detection

        if (intensity > minThreshold && !visited.has(idx)) {
          const blob = this.floodFillBlob(imageData, x, y, minThreshold, visited);
          
          if (blob.area >= minArea && blob.area <= maxArea) {
            const confidence = Math.min(1, (blob.avgIntensity - minThreshold) / (255 - minThreshold));
            
            dots.push({
              position: { x: blob.centerX, y: blob.centerY },
              intensity: blob.avgIntensity / 255,
              size: Math.sqrt(blob.area / Math.PI) * 2,
              confidence,
              matched: false
            });
          }
        }
      }
    }

    return dots;
  }

  /**
   * Flood fill to find blob
   */
  private floodFillBlob(
    imageData: ImageData, 
    startX: number, 
    startY: number, 
    threshold: number, 
    visited: Set<number>
  ): { centerX: number; centerY: number; area: number; avgIntensity: number } {
    const { width, height, data } = imageData;
    const stack = [{ x: startX, y: startY }];
    let totalX = 0, totalY = 0, totalIntensity = 0, area = 0;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = (y * width + x) * 4;
      if (visited.has(idx)) continue;
      if (data[idx] < threshold) continue;

      visited.add(idx);
      totalX += x;
      totalY += y;
      totalIntensity += data[idx];
      area++;

      // Add neighbors
      stack.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
    }

    return {
      centerX: area > 0 ? totalX / area : startX,
      centerY: area > 0 ? totalY / area : startY,
      area,
      avgIntensity: area > 0 ? totalIntensity / area : 0
    };
  }

  /**
   * Detect dots using template matching
   */
  private detectDotsWithTemplateMatching(imageData: ImageData, params: any): DetectedDot[] {
    // Template matching implementation would use normalized cross-correlation
    // This is a simplified version
    return [];
  }

  /**
   * Detect dots using optical flow
   */
  private detectDotsWithOpticalFlow(imageData: ImageData, params: any): DetectedDot[] {
    // Optical flow would track dots between frames
    // This is a placeholder for Lucas-Kanade or similar algorithm
    return [];
  }

  /**
   * Merge overlapping dot detections
   */
  private mergeOverlappingDots(dots: DetectedDot[]): DetectedDot[] {
    const merged: DetectedDot[] = [];
    const used = new Set<number>();
    const mergeThreshold = 20; // pixels

    for (let i = 0; i < dots.length; i++) {
      if (used.has(i)) continue;

      const group = [dots[i]];
      used.add(i);

      for (let j = i + 1; j < dots.length; j++) {
        if (used.has(j)) continue;

        const distance = Math.sqrt(
          Math.pow(dots[i].position.x - dots[j].position.x, 2) +
          Math.pow(dots[i].position.y - dots[j].position.y, 2)
        );

        if (distance < mergeThreshold) {
          group.push(dots[j]);
          used.add(j);
        }
      }

      // Merge group
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        const avgX = group.reduce((sum, dot) => sum + dot.position.x, 0) / group.length;
        const avgY = group.reduce((sum, dot) => sum + dot.position.y, 0) / group.length;
        const avgIntensity = group.reduce((sum, dot) => sum + dot.intensity, 0) / group.length;
        const avgSize = group.reduce((sum, dot) => sum + dot.size, 0) / group.length;
        const maxConfidence = Math.max(...group.map(dot => dot.confidence));

        merged.push({
          position: { x: avgX, y: avgY },
          intensity: avgIntensity,
          size: avgSize,
          confidence: maxConfidence,
          matched: false
        });
      }
    }

    return merged;
  }

  /**
   * Match detected dots to expected grid positions
   */
  private matchDotsToGrid(
    detectedDots: DetectedDot[], 
    pattern: GridPattern, 
    alignment: GridAlignment | null
  ): DetectedDot[] {
    if (!alignment) return detectedDots;

    const matchThreshold = 30; // pixels

    for (const detectedDot of detectedDots) {
      let bestMatch: { dot: any; distance: number } | null = null;

      for (const expectedDot of pattern.dots) {
        if (!expectedDot.enabled) continue;

        // Transform expected position using alignment
        const transformedPos = this.transformPoint(expectedDot.position, alignment);
        
        const distance = Math.sqrt(
          Math.pow(detectedDot.position.x - transformedPos.x, 2) +
          Math.pow(detectedDot.position.y - transformedPos.y, 2)
        );

        if (distance < matchThreshold && (!bestMatch || distance < bestMatch.distance)) {
          bestMatch = { dot: expectedDot, distance };
        }
      }

      if (bestMatch) {
        detectedDot.matched = true;
        detectedDot.id = bestMatch.dot.id;
        detectedDot.expectedPosition = this.transformPoint(bestMatch.dot.position, alignment);
        detectedDot.displacement = {
          x: detectedDot.position.x - detectedDot.expectedPosition.x,
          y: detectedDot.position.y - detectedDot.expectedPosition.y
        };
      }
    }

    return detectedDots;
  }

  /**
   * Calculate grid alignment from detected dots
   */
  private calculateGridAlignment(detectedDots: DetectedDot[], pattern: GridPattern): GridAlignment | null {
    const minMatchCount = Math.min(10, pattern.dots.length * 0.3);
    
    if (detectedDots.length < minMatchCount) {
      return null;
    }

    // Use RANSAC to find best transformation
    let bestAlignment: GridAlignment | null = null;
    let bestScore = 0;
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      // Sample 3 random detected dots
      const sample = this.sampleRandom(detectedDots, 3);
      
      // Find corresponding expected dots
      const correspondence = this.findBestCorrespondence(sample, pattern.dots);
      
      if (correspondence.length < 3) continue;

      // Calculate transformation
      const alignment = this.calculateTransformation(correspondence);
      
      if (!alignment) continue;

      // Score alignment
      const score = this.scoreAlignment(detectedDots, pattern.dots, alignment);
      
      if (score > bestScore) {
        bestScore = score;
        bestAlignment = alignment;
      }
    }

    if (bestAlignment && bestScore > minMatchCount * 0.7) {
      bestAlignment.confidence = Math.min(1, bestScore / pattern.dots.length);
      return bestAlignment;
    }

    return null;
  }

  /**
   * Sample random elements from array
   */
  private sampleRandom<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * Find best correspondence between detected and expected dots
   */
  private findBestCorrespondence(
    detectedDots: DetectedDot[], 
    expectedDots: any[]
  ): Array<{ detected: DetectedDot; expected: any }> {
    const correspondence: Array<{ detected: DetectedDot; expected: any }> = [];
    const maxDistance = 100; // pixels

    for (const detected of detectedDots) {
      let bestMatch: { expected: any; distance: number } | null = null;

      for (const expected of expectedDots) {
        if (!expected.enabled) continue;

        const distance = Math.sqrt(
          Math.pow(detected.position.x - expected.position.x, 2) +
          Math.pow(detected.position.y - expected.position.y, 2)
        );

        if (distance < maxDistance && (!bestMatch || distance < bestMatch.distance)) {
          bestMatch = { expected, distance };
        }
      }

      if (bestMatch) {
        correspondence.push({ detected, expected: bestMatch.expected });
      }
    }

    return correspondence;
  }

  /**
   * Calculate transformation from correspondence
   */
  private calculateTransformation(
    correspondence: Array<{ detected: DetectedDot; expected: any }>
  ): GridAlignment | null {
    if (correspondence.length < 3) return null;

    // Use least squares to find affine transformation
    // This is a simplified version - real implementation would use SVD
    
    let sumX = 0, sumY = 0, sumExpX = 0, sumExpY = 0;
    
    for (const pair of correspondence) {
      sumX += pair.detected.position.x;
      sumY += pair.detected.position.y;
      sumExpX += pair.expected.position.x;
      sumExpY += pair.expected.position.y;
    }

    const count = correspondence.length;
    const translation = {
      x: sumX / count - sumExpX / count,
      y: sumY / count - sumExpY / count
    };

    // Simplified scale and rotation calculation
    const scale = { x: 1, y: 1 };
    const rotation = 0;

    return {
      rotation,
      scale,
      translation,
      confidence: 0.8,
      calibrationMatrix: [scale.x, 0, translation.x, 0, scale.y, translation.y, 0, 0, 1]
    };
  }

  /**
   * Score alignment quality
   */
  private scoreAlignment(
    detectedDots: DetectedDot[], 
    expectedDots: any[], 
    alignment: GridAlignment
  ): number {
    let score = 0;
    const threshold = 20; // pixels

    for (const expectedDot of expectedDots) {
      if (!expectedDot.enabled) continue;

      const transformedPos = this.transformPoint(expectedDot.position, alignment);
      
      const closestDetected = detectedDots.reduce((closest, dot) => {
        const distance = Math.sqrt(
          Math.pow(dot.position.x - transformedPos.x, 2) +
          Math.pow(dot.position.y - transformedPos.y, 2)
        );

        return !closest || distance < closest.distance 
          ? { dot, distance } 
          : closest;
      }, null as { dot: DetectedDot; distance: number } | null);

      if (closestDetected && closestDetected.distance < threshold) {
        score += 1 - (closestDetected.distance / threshold);
      }
    }

    return score;
  }

  /**
   * Transform point using grid alignment
   */
  private transformPoint(point: Vector2, alignment: GridAlignment): Vector2 {
    const cos = Math.cos(alignment.rotation);
    const sin = Math.sin(alignment.rotation);

    return {
      x: point.x * alignment.scale.x * cos - point.y * alignment.scale.y * sin + alignment.translation.x,
      y: point.x * alignment.scale.x * sin + point.y * alignment.scale.y * cos + alignment.translation.y
    };
  }

  /**
   * Detect disturbances from matched dots
   */
  private async detectDisturbances(
    detectedDots: DetectedDot[], 
    pattern: GridPattern
  ): Promise<GridDisturbance[]> {
    const disturbances: GridDisturbance[] = [];

    // Find missing dots (occlusion)
    const missingDots = this.findMissingDots(detectedDots, pattern);
    for (const missing of missingDots) {
      disturbances.push({
        id: `occlusion_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        frameNumber: this.frameCount,
        affectedDots: [missing.id],
        disturbanceType: DisturbanceType.DOT_OCCLUSION,
        intensity: 0.8,
        position: missing.position,
        size: { x: missing.size, y: missing.size },
        duration: 0,
        confidence: 0.7,
        metadata: {
          originalPositions: [missing.position],
          currentPositions: [],
          originalIntensities: [missing.intensity],
          currentIntensities: [],
          boundingBox: {
            x: missing.position.x - missing.size / 2,
            y: missing.position.y - missing.size / 2,
            width: missing.size,
            height: missing.size
          },
          classification: 'occlusion'
        }
      });
    }

    // Find displaced dots
    const displacedDots = detectedDots.filter(dot => 
      dot.matched && dot.displacement && 
      Math.sqrt(dot.displacement.x ** 2 + dot.displacement.y ** 2) > this.settings.motionThreshold
    );

    for (const dot of displacedDots) {
      if (!dot.displacement || !dot.expectedPosition) continue;

      const displacement = Math.sqrt(dot.displacement.x ** 2 + dot.displacement.y ** 2);
      
      disturbances.push({
        id: `displacement_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        frameNumber: this.frameCount,
        affectedDots: [dot.id || 'unknown'],
        disturbanceType: DisturbanceType.DOT_DISPLACEMENT,
        intensity: Math.min(1, displacement / 50),
        position: dot.position,
        size: { x: dot.size, y: dot.size },
        duration: 0,
        confidence: dot.confidence,
        metadata: {
          originalPositions: [dot.expectedPosition],
          currentPositions: [dot.position],
          originalIntensities: [1.0],
          currentIntensities: [dot.intensity],
          velocityVector: dot.displacement,
          boundingBox: {
            x: Math.min(dot.position.x, dot.expectedPosition.x) - dot.size / 2,
            y: Math.min(dot.position.y, dot.expectedPosition.y) - dot.size / 2,
            width: Math.abs(dot.position.x - dot.expectedPosition.x) + dot.size,
            height: Math.abs(dot.position.y - dot.expectedPosition.y) + dot.size
          },
          classification: 'displacement'
        }
      });
    }

    // Find intensity changes
    const intensityChanges = detectedDots.filter(dot => {
      if (!dot.matched) return false;
      
      const expectedDot = pattern.dots.find(pd => pd.id === dot.id);
      if (!expectedDot) return false;

      const intensityDiff = Math.abs(dot.intensity - expectedDot.intensity);
      return intensityDiff > 0.2;
    });

    for (const dot of intensityChanges) {
      const expectedDot = pattern.dots.find(pd => pd.id === dot.id);
      if (!expectedDot) continue;

      const intensityDiff = dot.intensity - expectedDot.intensity;
      const disturbanceType = intensityDiff > 0 
        ? DisturbanceType.DOT_BRIGHTENING 
        : DisturbanceType.DOT_DIMMING;

      disturbances.push({
        id: `intensity_${Date.now()}_${Math.random()}`,
        timestamp: Date.now(),
        frameNumber: this.frameCount,
        affectedDots: [dot.id || 'unknown'],
        disturbanceType,
        intensity: Math.abs(intensityDiff),
        position: dot.position,
        size: { x: dot.size, y: dot.size },
        duration: 0,
        confidence: dot.confidence,
        metadata: {
          originalPositions: [dot.position],
          currentPositions: [dot.position],
          originalIntensities: [expectedDot.intensity],
          currentIntensities: [dot.intensity],
          boundingBox: {
            x: dot.position.x - dot.size / 2,
            y: dot.position.y - dot.size / 2,
            width: dot.size,
            height: dot.size
          },
          classification: intensityDiff > 0 ? 'brightening' : 'dimming'
        }
      });
    }

    return disturbances;
  }

  /**
   * Find missing dots (dots that should be visible but aren't detected)
   */
  private findMissingDots(detectedDots: DetectedDot[], pattern: GridPattern): any[] {
    const missing: any[] = [];
    const detectedIds = new Set(detectedDots.map(dot => dot.id).filter(Boolean));

    for (const expectedDot of pattern.dots) {
      if (expectedDot.enabled && !detectedIds.has(expectedDot.id)) {
        missing.push(expectedDot);
      }
    }

    return missing;
  }

  /**
   * Post-process disturbances
   */
  private postProcessDisturbances(disturbances: GridDisturbance[]): GridDisturbance[] {
    let processed = [...disturbances];

    // Apply validation steps
    for (const step of this.pipeline.validation) {
      if (!step.enabled) continue;

      switch (step.type) {
        case 'size_filter':
          processed = this.applySizeFilter(processed, step.parameters);
          break;
        case 'intensity_filter':
          processed = this.applyIntensityFilter(processed, step.parameters);
          break;
        case 'geometry_check':
          processed = this.applyGeometryCheck(processed, step.parameters);
          break;
        case 'temporal_consistency':
          processed = this.applyTemporalConsistency(processed, step.parameters);
          break;
      }
    }

    return processed;
  }

  /**
   * Apply size filter
   */
  private applySizeFilter(disturbances: GridDisturbance[], params: any): GridDisturbance[] {
    const minSize = params.minSize || 2;
    const maxSize = params.maxSize || 100;

    return disturbances.filter(d => {
      const size = Math.max(d.size.x, d.size.y);
      return size >= minSize && size <= maxSize;
    });
  }

  /**
   * Apply intensity filter
   */
  private applyIntensityFilter(disturbances: GridDisturbance[], params: any): GridDisturbance[] {
    const minIntensity = params.minIntensity || 0.1;
    return disturbances.filter(d => d.intensity >= minIntensity);
  }

  /**
   * Apply geometry check
   */
  private applyGeometryCheck(disturbances: GridDisturbance[], params: any): GridDisturbance[] {
    const maxAspectRatio = params.maxAspectRatio || 3.0;

    return disturbances.filter(d => {
      const aspectRatio = Math.max(d.size.x, d.size.y) / Math.min(d.size.x, d.size.y);
      return aspectRatio <= maxAspectRatio;
    });
  }

  /**
   * Apply temporal consistency
   */
  private applyTemporalConsistency(disturbances: GridDisturbance[], params: any): GridDisturbance[] {
    // Check against previous detections for consistency
    const minDuration = params.minDuration || 100;
    
    return disturbances.filter(disturbance => {
      // For new implementation, accept all
      // In real scenario, would check against disturbance history
      return true;
    });
  }

  /**
   * Update detection context
   */
  private updateContext(processedFrame: ProcessedFrame): void {
    // Add to frame history
    this.context.frameHistory.push(processedFrame);
    if (this.context.frameHistory.length > 10) {
      this.context.frameHistory.shift();
    }

    // Update previous detections
    this.context.previousDetections.push(...processedFrame.disturbances);
    if (this.context.previousDetections.length > 100) {
      this.context.previousDetections.splice(0, this.context.previousDetections.length - 100);
    }
  }

  /**
   * Create canvas from camera frame
   */
  private createCanvasFromFrame(frame: CameraFrame): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(frame.width, frame.height);
    
    // Convert frame data to RGBA
    for (let i = 0; i < frame.imageData.length; i++) {
      const pixelIndex = i * 4;
      const grayValue = frame.imageData[i];
      
      imageData.data[pixelIndex] = grayValue;     // R
      imageData.data[pixelIndex + 1] = grayValue; // G
      imageData.data[pixelIndex + 2] = grayValue; // B
      imageData.data[pixelIndex + 3] = 255;       // A
    }
    
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Apply Gaussian blur
   */
  private applyGaussianBlur(canvas: HTMLCanvasElement, params: any): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const kernelSize = params.kernelSize || 3;
    const sigma = params.sigma || 1.0;
    
    // Simple blur implementation
    ctx.filter = `blur(${sigma}px)`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = 'none';
    
    return canvas;
  }

  /**
   * Apply median filter
   */
  private applyMedianFilter(canvas: HTMLCanvasElement, params: any): HTMLCanvasElement {
    // Median filter implementation would go here
    return canvas;
  }

  /**
   * Apply background subtraction
   */
  private applyBackgroundSubtraction(canvas: HTMLCanvasElement, params: any): HTMLCanvasElement {
    if (!this.backgroundModel) return canvas;

    const ctx = canvas.getContext('2d')!;
    const currentImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const threshold = params.threshold || 30;

    for (let i = 0; i < currentImage.data.length; i += 4) {
      const diff = Math.abs(currentImage.data[i] - this.backgroundModel.data[i]);
      
      if (diff > threshold) {
        // Keep pixel (foreground)
        currentImage.data[i + 3] = 255;
      } else {
        // Remove pixel (background)
        currentImage.data[i] = 0;
        currentImage.data[i + 1] = 0;
        currentImage.data[i + 2] = 0;
        currentImage.data[i + 3] = 0;
      }
    }

    ctx.putImageData(currentImage, 0, 0);
    return canvas;
  }

  /**
   * Apply histogram equalization
   */
  private applyHistogramEqualization(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Calculate histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < imageData.data.length; i += 4) {
      histogram[imageData.data[i]]++;
    }

    // Calculate cumulative distribution
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    // Normalize
    const pixelCount = imageData.width * imageData.height;
    const lookupTable = cdf.map(value => Math.round((value * 255) / pixelCount));

    // Apply equalization
    for (let i = 0; i < imageData.data.length; i += 4) {
      const equalizedValue = lookupTable[imageData.data[i]];
      imageData.data[i] = equalizedValue;
      imageData.data[i + 1] = equalizedValue;
      imageData.data[i + 2] = equalizedValue;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /**
   * Update detection settings
   */
  updateSettings(newSettings: Partial<DetectionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    logger.info('Detection settings updated', this.settings);
  }

  /**
   * Get detection settings
   */
  getSettings(): DetectionSettings {
    return { ...this.settings };
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.backgroundModel = null;
    this.frameCount = 0;
    this.isCalibrated = false;
    this.gridAlignment = null;
    this.context = {
      baselineFrames: [],
      currentPattern: null as any,
      previousDetections: [],
      frameHistory: []
    };
    
    logger.info('Grid disturbance detector reset');
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.reset();
    this.removeAllListeners();
  }
}