import { EventEmitter } from 'events';
import {
  MotionDetectionAlgorithm,
  MotionDetectionSettings,
  MotionRegion,
  MotionVector,
  MotionEvent,
  MotionAnalysisResult,
  ObjectTracker,
  MotionTrackingState,
  TrackingHistory,
  MotionPrediction
} from '../types';
import { Logger } from '../../../utils/logger';

const logger = new Logger('AdvancedMotionDetector');

export class AdvancedMotionDetector extends EventEmitter {
  private settings: MotionDetectionSettings;
  private backgroundModel: Float32Array | null = null;
  private previousFrames: ImageData[] = [];
  private opticalFlowData: MotionVector[][] = [];
  private trackingState: MotionTrackingState;
  private frameCount = 0;
  private isActive = false;
  private processingTime = 0;

  constructor(settings: MotionDetectionSettings) {
    super();
    this.settings = { ...settings };
    this.trackingState = {
      activeTrackers: new Map(),
      trackingHistory: [],
      predictions: [],
      lostTracks: [],
      trackingQuality: 0
    };
    
    this.initializeAlgorithm();
  }

  private initializeAlgorithm(): void {
    logger.info(`Initializing motion detection with algorithm: ${this.settings.algorithm}`);
    
    // Initialize algorithm-specific parameters
    switch (this.settings.algorithm) {
      case MotionDetectionAlgorithm.BACKGROUND_SUBTRACTION:
        this.initializeBackgroundSubtraction();
        break;
      case MotionDetectionAlgorithm.OPTICAL_FLOW:
        this.initializeOpticalFlow();
        break;
      case MotionDetectionAlgorithm.GAUSSIAN_MIXTURE:
        this.initializeGaussianMixture();
        break;
      case MotionDetectionAlgorithm.HYBRID:
        this.initializeHybridApproach();
        break;
    }
  }

  private initializeBackgroundSubtraction(): void {
    // Background subtraction parameters
    logger.debug('Initializing background subtraction model');
  }

  private initializeOpticalFlow(): void {
    // Optical flow parameters (Lucas-Kanade, Horn-Schunck, etc.)
    logger.debug('Initializing optical flow computation');
  }

  private initializeGaussianMixture(): void {
    // Gaussian Mixture Model parameters
    logger.debug('Initializing Gaussian Mixture Model');
  }

  private initializeHybridApproach(): void {
    // Combination of multiple algorithms
    logger.debug('Initializing hybrid motion detection approach');
    this.initializeBackgroundSubtraction();
    this.initializeOpticalFlow();
  }

  async processFrame(frame: ImageData, timestamp: number): Promise<MotionEvent | null> {
    if (!this.isActive) return null;

    const startTime = performance.now();
    
    try {
      // Update frame history
      this.updateFrameHistory(frame);
      this.frameCount++;

      // Detect motion based on selected algorithm
      const motionRegions = await this.detectMotion(frame, timestamp);
      
      if (motionRegions.length === 0) {
        this.processingTime = performance.now() - startTime;
        return null;
      }

      // Update object tracking
      await this.updateTracking(motionRegions, timestamp);

      // Analyze motion patterns
      const analysis = await this.analyzeMotionPatterns(motionRegions);

      // Create motion event
      const motionEvent: MotionEvent = {
        id: `motion_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp,
        duration: 0, // Will be updated by continuous tracking
        motionRegions,
        emfReadings: [],      // Will be populated by EMF detector
        audioReadings: [],    // Will be populated by audio analyzer
        environmentalReadings: [], // Will be populated by environmental sensors
        algorithm: this.settings.algorithm,
        confidence: this.calculateOverallConfidence(motionRegions),
        correlations: []      // Will be populated by correlation analyzer
      };

      this.processingTime = performance.now() - startTime;
      this.emit('motion-detected', { event: motionEvent });
      
      return motionEvent;
    } catch (error) {
      logger.error('Error processing frame:', error);
      this.emit('error', { error, context: 'frame processing' });
      return null;
    }
  }

  private updateFrameHistory(frame: ImageData): void {
    // Add current frame to history
    this.previousFrames.push(frame);
    
    // Maintain frame history size based on algorithm needs
    const maxHistory = this.getMaxFrameHistory();
    if (this.previousFrames.length > maxHistory) {
      this.previousFrames.shift();
    }
  }

  private getMaxFrameHistory(): number {
    switch (this.settings.algorithm) {
      case MotionDetectionAlgorithm.OPTICAL_FLOW:
        return 2; // Need current and previous frame
      case MotionDetectionAlgorithm.TEMPORAL_DIFFERENCE:
        return 3; // Need three consecutive frames
      case MotionDetectionAlgorithm.BACKGROUND_SUBTRACTION:
        return 1; // Only need current frame
      case MotionDetectionAlgorithm.HYBRID:
        return 5; // Need more frames for multiple algorithms
      default:
        return 2;
    }
  }

  private async detectMotion(frame: ImageData, timestamp: number): Promise<MotionRegion[]> {
    switch (this.settings.algorithm) {
      case MotionDetectionAlgorithm.BACKGROUND_SUBTRACTION:
        return await this.backgroundSubtractionDetection(frame);
      case MotionDetectionAlgorithm.OPTICAL_FLOW:
        return await this.opticalFlowDetection(frame);
      case MotionDetectionAlgorithm.FRAME_DIFFERENCE:
        return await this.frameDifferenceDetection(frame);
      case MotionDetectionAlgorithm.GAUSSIAN_MIXTURE:
        return await this.gaussianMixtureDetection(frame);
      case MotionDetectionAlgorithm.TEMPORAL_DIFFERENCE:
        return await this.temporalDifferenceDetection(frame);
      case MotionDetectionAlgorithm.EDGE_BASED:
        return await this.edgeBasedDetection(frame);
      case MotionDetectionAlgorithm.AI_ENHANCED:
        return await this.aiEnhancedDetection(frame);
      case MotionDetectionAlgorithm.HYBRID:
        return await this.hybridDetection(frame);
      default:
        return await this.frameDifferenceDetection(frame);
    }
  }

  private async backgroundSubtractionDetection(frame: ImageData): Promise<MotionRegion[]> {
    const width = frame.width;
    const height = frame.height;
    
    // Convert frame to grayscale
    const grayFrame = this.convertToGrayscale(frame);
    
    // Initialize or update background model
    if (!this.backgroundModel) {
      this.backgroundModel = new Float32Array(grayFrame);
      return [];
    }

    // Update background model with learning rate
    const learningRate = this.settings.backgroundLearningRate;
    for (let i = 0; i < grayFrame.length; i++) {
      this.backgroundModel[i] = (1 - learningRate) * this.backgroundModel[i] + learningRate * grayFrame[i];
    }

    // Create difference image
    const diffImage = new Uint8Array(width * height);
    for (let i = 0; i < grayFrame.length; i++) {
      const diff = Math.abs(grayFrame[i] - this.backgroundModel[i]);
      diffImage[i] = diff > this.settings.threshold ? 255 : 0;
    }

    // Apply morphological operations if enabled
    let processedImage = diffImage;
    if (this.settings.morphologicalOps) {
      processedImage = this.applyMorphologicalOperations(diffImage, width, height);
    }

    // Find connected components (motion regions)
    const motionRegions = this.findConnectedComponents(processedImage, width, height);
    
    // Filter by size and apply additional criteria
    return this.filterMotionRegions(motionRegions);
  }

  private async opticalFlowDetection(frame: ImageData): Promise<MotionRegion[]> {
    if (this.previousFrames.length < 1) {
      return [];
    }

    const currentGray = this.convertToGrayscale(frame);
    const previousGray = this.convertToGrayscale(this.previousFrames[this.previousFrames.length - 1]);
    
    // Calculate optical flow using Lucas-Kanade method
    const flowField = this.calculateOpticalFlow(previousGray, currentGray, frame.width, frame.height);
    
    // Store flow data for analysis
    this.opticalFlowData.push(flowField);
    if (this.opticalFlowData.length > 10) {
      this.opticalFlowData.shift();
    }

    // Detect motion regions based on flow magnitude
    const motionRegions = this.extractMotionFromFlow(flowField, frame.width, frame.height);
    
    return this.filterMotionRegions(motionRegions);
  }

  private async frameDifferenceDetection(frame: ImageData): Promise<MotionRegion[]> {
    if (this.previousFrames.length < 1) {
      return [];
    }

    const currentGray = this.convertToGrayscale(frame);
    const previousGray = this.convertToGrayscale(this.previousFrames[this.previousFrames.length - 1]);
    
    const width = frame.width;
    const height = frame.height;
    
    // Calculate frame difference
    const diffImage = new Uint8Array(width * height);
    for (let i = 0; i < currentGray.length; i++) {
      const diff = Math.abs(currentGray[i] - previousGray[i]);
      diffImage[i] = diff > this.settings.threshold ? 255 : 0;
    }

    // Apply noise reduction if enabled
    let processedImage = diffImage;
    if (this.settings.noiseReduction) {
      processedImage = this.applyGaussianBlur(diffImage, width, height, 1.5);
    }

    const motionRegions = this.findConnectedComponents(processedImage, width, height);
    return this.filterMotionRegions(motionRegions);
  }

  private async gaussianMixtureDetection(frame: ImageData): Promise<MotionRegion[]> {
    // Simplified Gaussian Mixture Model implementation
    // In a real implementation, this would use a more sophisticated GMM
    
    const grayFrame = this.convertToGrayscale(frame);
    const width = frame.width;
    const height = frame.height;

    // Initialize GMM if not exists
    if (!this.backgroundModel) {
      this.backgroundModel = new Float32Array(grayFrame.length * 3); // Mean, variance, weight for each pixel
      for (let i = 0; i < grayFrame.length; i++) {
        this.backgroundModel[i * 3] = grayFrame[i];     // Mean
        this.backgroundModel[i * 3 + 1] = 100;          // Variance
        this.backgroundModel[i * 3 + 2] = 1.0;          // Weight
      }
      return [];
    }

    // Update GMM and detect foreground
    const foregroundMask = new Uint8Array(width * height);
    const learningRate = this.settings.backgroundLearningRate;

    for (let i = 0; i < grayFrame.length; i++) {
      const pixelValue = grayFrame[i];
      const mean = this.backgroundModel[i * 3];
      const variance = this.backgroundModel[i * 3 + 1];
      
      // Calculate Mahalanobis distance
      const distance = Math.abs(pixelValue - mean) / Math.sqrt(variance);
      
      if (distance > 2.5) { // 2.5 standard deviations
        foregroundMask[i] = 255;
      } else {
        foregroundMask[i] = 0;
        // Update background model
        this.backgroundModel[i * 3] = (1 - learningRate) * mean + learningRate * pixelValue;
        this.backgroundModel[i * 3 + 1] = Math.max(10, (1 - learningRate) * variance + learningRate * Math.pow(pixelValue - mean, 2));
      }
    }

    const motionRegions = this.findConnectedComponents(foregroundMask, width, height);
    return this.filterMotionRegions(motionRegions);
  }

  private async temporalDifferenceDetection(frame: ImageData): Promise<MotionRegion[]> {
    if (this.previousFrames.length < 2) {
      return [];
    }

    const current = this.convertToGrayscale(frame);
    const prev1 = this.convertToGrayscale(this.previousFrames[this.previousFrames.length - 1]);
    const prev2 = this.convertToGrayscale(this.previousFrames[this.previousFrames.length - 2]);
    
    const width = frame.width;
    const height = frame.height;
    
    // Calculate two consecutive frame differences
    const diff1 = new Float32Array(current.length);
    const diff2 = new Float32Array(current.length);
    
    for (let i = 0; i < current.length; i++) {
      diff1[i] = Math.abs(current[i] - prev1[i]);
      diff2[i] = Math.abs(prev1[i] - prev2[i]);
    }
    
    // Combine differences using AND operation
    const motionMask = new Uint8Array(width * height);
    for (let i = 0; i < current.length; i++) {
      motionMask[i] = (diff1[i] > this.settings.threshold && diff2[i] > this.settings.threshold) ? 255 : 0;
    }

    const motionRegions = this.findConnectedComponents(motionMask, width, height);
    return this.filterMotionRegions(motionRegions);
  }

  private async edgeBasedDetection(frame: ImageData): Promise<MotionRegion[]> {
    if (this.previousFrames.length < 1) {
      return [];
    }

    // Extract edges from current and previous frames
    const currentEdges = this.extractEdges(frame);
    const previousEdges = this.extractEdges(this.previousFrames[this.previousFrames.length - 1]);
    
    const width = frame.width;
    const height = frame.height;
    
    // Calculate edge difference
    const edgeDiff = new Uint8Array(width * height);
    for (let i = 0; i < currentEdges.length; i++) {
      const diff = Math.abs(currentEdges[i] - previousEdges[i]);
      edgeDiff[i] = diff > this.settings.threshold ? 255 : 0;
    }

    const motionRegions = this.findConnectedComponents(edgeDiff, width, height);
    return this.filterMotionRegions(motionRegions);
  }

  private async aiEnhancedDetection(frame: ImageData): Promise<MotionRegion[]> {
    // AI-enhanced detection would integrate with ML models
    // For now, use a combination of traditional methods with intelligent filtering
    
    // Start with optical flow
    const opticalFlowRegions = await this.opticalFlowDetection(frame);
    
    // Combine with background subtraction
    const backgroundSubRegions = await this.backgroundSubtractionDetection(frame);
    
    // Merge and filter regions using AI-like heuristics
    const combinedRegions = this.mergeMotionRegions([...opticalFlowRegions, ...backgroundSubRegions]);
    
    // Apply intelligent filtering based on motion patterns
    return this.applyIntelligentFiltering(combinedRegions, frame);
  }

  private async hybridDetection(frame: ImageData): Promise<MotionRegion[]> {
    // Combine multiple detection methods
    const results: MotionRegion[] = [];
    
    // Run parallel detection algorithms
    const [
      backgroundSub,
      opticalFlow,
      frameDiff
    ] = await Promise.all([
      this.backgroundSubtractionDetection(frame),
      this.opticalFlowDetection(frame),
      this.frameDifferenceDetection(frame)
    ]);

    // Merge results with weighted voting
    const allRegions = [...backgroundSub, ...opticalFlow, ...frameDiff];
    const mergedRegions = this.mergeMotionRegions(allRegions);
    
    // Apply consensus filtering
    return this.applyConsensusFiltering(mergedRegions);
  }

  private convertToGrayscale(frame: ImageData): Float32Array {
    const grayData = new Float32Array(frame.width * frame.height);
    const data = frame.data;
    
    for (let i = 0; i < grayData.length; i++) {
      const pixelIndex = i * 4;
      // Use luminance formula: 0.299*R + 0.587*G + 0.114*B
      grayData[i] = 0.299 * data[pixelIndex] + 0.587 * data[pixelIndex + 1] + 0.114 * data[pixelIndex + 2];
    }
    
    return grayData;
  }

  private calculateOpticalFlow(prev: Float32Array, curr: Float32Array, width: number, height: number): MotionVector[][] {
    const flowField: MotionVector[][] = [];
    const blockSize = 16; // Block size for flow calculation
    
    for (let y = 0; y < height - blockSize; y += blockSize) {
      const row: MotionVector[] = [];
      for (let x = 0; x < width - blockSize; x += blockSize) {
        const flow = this.calculateBlockFlow(prev, curr, x, y, blockSize, width, height);
        row.push(flow);
      }
      flowField.push(row);
    }
    
    return flowField;
  }

  private calculateBlockFlow(prev: Float32Array, curr: Float32Array, x: number, y: number, 
                           blockSize: number, width: number, height: number): MotionVector {
    let bestMatchX = 0;
    let bestMatchY = 0;
    let minError = Infinity;
    
    const searchRange = 16; // Search range for matching
    
    // Search for best matching block
    for (let dy = -searchRange; dy <= searchRange; dy += 2) {
      for (let dx = -searchRange; dx <= searchRange; dx += 2) {
        const newX = x + dx;
        const newY = y + dy;
        
        if (newX >= 0 && newY >= 0 && newX + blockSize < width && newY + blockSize < height) {
          const error = this.calculateBlockError(prev, curr, x, y, newX, newY, blockSize, width);
          if (error < minError) {
            minError = error;
            bestMatchX = dx;
            bestMatchY = dy;
          }
        }
      }
    }
    
    const magnitude = Math.sqrt(bestMatchX * bestMatchX + bestMatchY * bestMatchY);
    const angle = Math.atan2(bestMatchY, bestMatchX);
    const confidence = 1.0 - (minError / (blockSize * blockSize * 255));
    
    return {
      x: bestMatchX,
      y: bestMatchY,
      magnitude,
      angle,
      confidence: Math.max(0, confidence)
    };
  }

  private calculateBlockError(prev: Float32Array, curr: Float32Array, 
                            x1: number, y1: number, x2: number, y2: number,
                            blockSize: number, width: number): number {
    let totalError = 0;
    
    for (let dy = 0; dy < blockSize; dy++) {
      for (let dx = 0; dx < blockSize; dx++) {
        const idx1 = (y1 + dy) * width + (x1 + dx);
        const idx2 = (y2 + dy) * width + (x2 + dx);
        totalError += Math.abs(prev[idx1] - curr[idx2]);
      }
    }
    
    return totalError;
  }

  private extractMotionFromFlow(flowField: MotionVector[][], width: number, height: number): MotionRegion[] {
    const motionRegions: MotionRegion[] = [];
    const blockSize = 16;
    const motionThreshold = 2.0; // Minimum magnitude for motion
    
    for (let y = 0; y < flowField.length; y++) {
      for (let x = 0; x < flowField[y].length; x++) {
        const flow = flowField[y][x];
        
        if (flow.magnitude > motionThreshold && flow.confidence > 0.3) {
          const region: MotionRegion = {
            id: `flow_${x}_${y}_${Date.now()}`,
            boundingBox: {
              x: x * blockSize,
              y: y * blockSize,
              width: blockSize,
              height: blockSize
            },
            center: {
              x: x * blockSize + blockSize / 2,
              y: y * blockSize + blockSize / 2
            },
            area: blockSize * blockSize,
            velocity: flow,
            timestamp: Date.now(),
            confidence: flow.confidence
          };
          
          motionRegions.push(region);
        }
      }
    }
    
    return motionRegions;
  }

  private findConnectedComponents(binaryImage: Uint8Array, width: number, height: number): MotionRegion[] {
    const labeled = new Int32Array(width * height);
    const regions: MotionRegion[] = [];
    let labelCounter = 1;
    
    // Two-pass connected component labeling
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        
        if (binaryImage[idx] === 255 && labeled[idx] === 0) {
          const component = this.floodFill(binaryImage, labeled, x, y, width, height, labelCounter);
          
          if (component.pixels.length >= this.settings.minimumObjectSize &&
              component.pixels.length <= this.settings.maximumObjectSize) {
            
            const region = this.createMotionRegion(component, labelCounter);
            regions.push(region);
          }
          
          labelCounter++;
        }
      }
    }
    
    return regions;
  }

  private floodFill(binaryImage: Uint8Array, labeled: Int32Array, startX: number, startY: number,
                   width: number, height: number, label: number): ConnectedComponent {
    const stack: { x: number; y: number }[] = [{ x: startX, y: startY }];
    const pixels: { x: number; y: number }[] = [];
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const idx = y * width + x;
      
      if (x < 0 || x >= width || y < 0 || y >= height ||
          binaryImage[idx] !== 255 || labeled[idx] !== 0) {
        continue;
      }
      
      labeled[idx] = label;
      pixels.push({ x, y });
      
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      
      // Add 8-connected neighbors
      stack.push(
        { x: x - 1, y: y - 1 }, { x: x, y: y - 1 }, { x: x + 1, y: y - 1 },
        { x: x - 1, y: y }, { x: x + 1, y: y },
        { x: x - 1, y: y + 1 }, { x: x, y: y + 1 }, { x: x + 1, y: y + 1 }
      );
    }
    
    return {
      pixels,
      boundingBox: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
  }

  private createMotionRegion(component: ConnectedComponent, id: number): MotionRegion {
    const bbox = component.boundingBox;
    
    return {
      id: `region_${id}`,
      boundingBox: bbox,
      center: {
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2
      },
      area: component.pixels.length,
      velocity: { x: 0, y: 0, magnitude: 0, angle: 0, confidence: 0.8 }, // Will be calculated later
      timestamp: Date.now(),
      confidence: 0.8 // Base confidence, will be refined
    };
  }

  private filterMotionRegions(regions: MotionRegion[]): MotionRegion[] {
    return regions.filter(region => {
      // Size filtering
      if (region.area < this.settings.minimumObjectSize || 
          region.area > this.settings.maximumObjectSize) {
        return false;
      }
      
      // Aspect ratio filtering (avoid very thin/wide objects that might be noise)
      const aspectRatio = region.boundingBox.width / region.boundingBox.height;
      if (aspectRatio > 10 || aspectRatio < 0.1) {
        return false;
      }
      
      // Confidence filtering
      if (region.confidence < 0.3) {
        return false;
      }
      
      return true;
    });
  }

  private mergeMotionRegions(regions: MotionRegion[]): MotionRegion[] {
    if (regions.length <= 1) return regions;
    
    const merged: MotionRegion[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < regions.length; i++) {
      if (used.has(i)) continue;
      
      const region = regions[i];
      const overlapping: MotionRegion[] = [region];
      used.add(i);
      
      // Find overlapping regions
      for (let j = i + 1; j < regions.length; j++) {
        if (used.has(j)) continue;
        
        if (this.regionsOverlap(region, regions[j])) {
          overlapping.push(regions[j]);
          used.add(j);
        }
      }
      
      // Merge overlapping regions
      const mergedRegion = this.mergeOverlappingRegions(overlapping);
      merged.push(mergedRegion);
    }
    
    return merged;
  }

  private regionsOverlap(region1: MotionRegion, region2: MotionRegion): boolean {
    const bbox1 = region1.boundingBox;
    const bbox2 = region2.boundingBox;
    
    return !(bbox1.x + bbox1.width < bbox2.x ||
             bbox2.x + bbox2.width < bbox1.x ||
             bbox1.y + bbox1.height < bbox2.y ||
             bbox2.y + bbox2.height < bbox1.y);
  }

  private mergeOverlappingRegions(regions: MotionRegion[]): MotionRegion {
    if (regions.length === 1) return regions[0];
    
    // Calculate merged bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let totalArea = 0;
    let weightedVelocityX = 0;
    let weightedVelocityY = 0;
    let totalConfidence = 0;
    
    for (const region of regions) {
      const bbox = region.boundingBox;
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
      totalArea += region.area;
      
      weightedVelocityX += region.velocity.x * region.area;
      weightedVelocityY += region.velocity.y * region.area;
      totalConfidence += region.confidence;
    }
    
    const avgVelocityX = weightedVelocityX / totalArea;
    const avgVelocityY = weightedVelocityY / totalArea;
    const magnitude = Math.sqrt(avgVelocityX * avgVelocityX + avgVelocityY * avgVelocityY);
    const angle = Math.atan2(avgVelocityY, avgVelocityX);
    
    return {
      id: `merged_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      },
      center: {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
      },
      area: totalArea,
      velocity: {
        x: avgVelocityX,
        y: avgVelocityY,
        magnitude,
        angle,
        confidence: totalConfidence / regions.length
      },
      timestamp: Math.max(...regions.map(r => r.timestamp)),
      confidence: totalConfidence / regions.length
    };
  }

  private applyMorphologicalOperations(image: Uint8Array, width: number, height: number): Uint8Array {
    // Apply erosion followed by dilation (opening) to remove noise
    const eroded = this.erode(image, width, height, 3);
    const dilated = this.dilate(eroded, width, height, 3);
    return dilated;
  }

  private erode(image: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
    const result = new Uint8Array(width * height);
    const radius = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 255;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              minVal = Math.min(minVal, image[ny * width + nx]);
            }
          }
        }
        
        result[y * width + x] = minVal;
      }
    }
    
    return result;
  }

  private dilate(image: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array {
    const result = new Uint8Array(width * height);
    const radius = Math.floor(kernelSize / 2);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              maxVal = Math.max(maxVal, image[ny * width + nx]);
            }
          }
        }
        
        result[y * width + x] = maxVal;
      }
    }
    
    return result;
  }

  private applyGaussianBlur(image: Uint8Array, width: number, height: number, sigma: number): Uint8Array {
    // Simplified Gaussian blur implementation
    const result = new Uint8Array(width * height);
    const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
    const radius = Math.floor(kernelSize / 2);
    const kernel = this.generateGaussianKernel(kernelSize, sigma);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const weight = kernel[(ky + radius) * kernelSize + (kx + radius)];
              sum += image[ny * width + nx] * weight;
              weightSum += weight;
            }
          }
        }
        
        result[y * width + x] = Math.round(sum / weightSum);
      }
    }
    
    return result;
  }

  private generateGaussianKernel(size: number, sigma: number): Float32Array {
    const kernel = new Float32Array(size * size);
    const center = Math.floor(size / 2);
    let sum = 0;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;
        const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
        kernel[y * size + x] = value;
        sum += value;
      }
    }
    
    // Normalize
    for (let i = 0; i < kernel.length; i++) {
      kernel[i] /= sum;
    }
    
    return kernel;
  }

  private extractEdges(frame: ImageData): Uint8Array {
    const gray = this.convertToGrayscale(frame);
    return this.sobelEdgeDetection(gray, frame.width, frame.height);
  }

  private sobelEdgeDetection(gray: Float32Array, width: number, height: number): Uint8Array {
    const edges = new Uint8Array(width * height);
    
    // Sobel kernels
    const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const kernelIdx = (ky + 1) * 3 + (kx + 1);
            
            gx += gray[idx] * sobelX[kernelIdx];
            gy += gray[idx] * sobelY[kernelIdx];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = Math.min(255, magnitude);
      }
    }
    
    return edges;
  }

  private applyIntelligentFiltering(regions: MotionRegion[], frame: ImageData): MotionRegion[] {
    // Apply AI-like heuristics for filtering false positives
    return regions.filter(region => {
      // Motion consistency check
      if (region.velocity.magnitude < 1.0) {
        return false;
      }
      
      // Shape analysis (avoid very irregular shapes)
      const compactness = this.calculateCompactness(region);
      if (compactness < 0.2) {
        return false;
      }
      
      // Temporal consistency (if we have tracking history)
      const temporalConsistency = this.checkTemporalConsistency(region);
      if (temporalConsistency < 0.5) {
        return false;
      }
      
      return true;
    });
  }

  private calculateCompactness(region: MotionRegion): number {
    // Compactness = 4π * Area / Perimeter²
    // For simplicity, approximate using bounding box
    const bbox = region.boundingBox;
    const perimeter = 2 * (bbox.width + bbox.height);
    return (4 * Math.PI * region.area) / (perimeter * perimeter);
  }

  private checkTemporalConsistency(region: MotionRegion): number {
    // Check if similar motion was detected in previous frames
    // This is a simplified implementation
    return 0.8; // Return high consistency for now
  }

  private applyConsensusFiltering(regions: MotionRegion[]): MotionRegion[] {
    // Filter regions based on consensus from multiple algorithms
    return regions.filter(region => region.confidence > 0.4);
  }

  private async updateTracking(regions: MotionRegion[], timestamp: number): Promise<void> {
    // Update object tracking using the detected motion regions
    const activeTrackers = Array.from(this.trackingState.activeTrackers.values());
    
    // Match regions to existing trackers
    const matches = this.matchRegionsToTrackers(regions, activeTrackers);
    
    // Update matched trackers
    for (const match of matches) {
      await this.updateTracker(match.tracker, match.region, timestamp);
    }
    
    // Create new trackers for unmatched regions
    const unmatchedRegions = regions.filter(region => 
      !matches.some(match => match.region.id === region.id)
    );
    
    for (const region of unmatchedRegions) {
      this.createNewTracker(region, timestamp);
    }
    
    // Remove lost trackers
    this.removeLostTrackers(timestamp);
    
    // Update tracking quality
    this.updateTrackingQuality();
    
    this.emit('tracking-update', { state: this.trackingState });
  }

  private matchRegionsToTrackers(regions: MotionRegion[], trackers: ObjectTracker[]): 
    { region: MotionRegion; tracker: ObjectTracker }[] {
    const matches: { region: MotionRegion; tracker: ObjectTracker }[] = [];
    const usedRegions = new Set<string>();
    const usedTrackers = new Set<string>();
    
    // Simple nearest neighbor matching
    for (const tracker of trackers) {
      let bestMatch: MotionRegion | null = null;
      let bestDistance = Infinity;
      
      for (const region of regions) {
        if (usedRegions.has(region.id)) continue;
        
        const distance = this.calculateDistance(tracker.position, region.center);
        const maxDistance = Math.max(50, tracker.velocity.magnitude * 2); // Adaptive threshold
        
        if (distance < maxDistance && distance < bestDistance) {
          bestDistance = distance;
          bestMatch = region;
        }
      }
      
      if (bestMatch) {
        matches.push({ region: bestMatch, tracker });
        usedRegions.add(bestMatch.id);
        usedTrackers.add(tracker.id);
      }
    }
    
    return matches;
  }

  private calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    return Math.sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);
  }

  private async updateTracker(tracker: ObjectTracker, region: MotionRegion, timestamp: number): Promise<void> {
    // Update tracker position and velocity
    const dt = (timestamp - tracker.lastSeen) / 1000; // seconds
    
    if (dt > 0) {
      // Calculate velocity
      const dx = region.center.x - tracker.position.x;
      const dy = region.center.y - tracker.position.y;
      
      tracker.velocity = {
        x: dx / dt,
        y: dy / dt,
        magnitude: Math.sqrt(dx * dx + dy * dy) / dt,
        angle: Math.atan2(dy, dx),
        confidence: region.confidence
      };
      
      // Calculate acceleration
      tracker.acceleration = {
        x: (tracker.velocity.x - (tracker.acceleration?.x || 0)) / dt,
        y: (tracker.velocity.y - (tracker.acceleration?.y || 0)) / dt
      };
    }
    
    tracker.position = { ...region.center };
    tracker.boundingBox = { ...region.boundingBox };
    tracker.confidence = region.confidence;
    tracker.lastSeen = timestamp;
    tracker.age++;
    
    // Update tracking history
    this.updateTrackingHistory(tracker, timestamp);
    
    // Generate predictions
    this.generateMotionPredictions(tracker);
  }

  private createNewTracker(region: MotionRegion, timestamp: number): void {
    const tracker: ObjectTracker = {
      id: `tracker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      position: { ...region.center },
      velocity: region.velocity,
      acceleration: { x: 0, y: 0 },
      boundingBox: { ...region.boundingBox },
      confidence: region.confidence,
      age: 1,
      lastSeen: timestamp,
      predictedPath: []
    };
    
    this.trackingState.activeTrackers.set(tracker.id, tracker);
    
    // Initialize tracking history
    this.trackingState.trackingHistory.push({
      trackerId: tracker.id,
      positions: [{ x: region.center.x, y: region.center.y, timestamp }],
      velocities: [region.velocity],
      events: ['created']
    });
  }

  private removeLostTrackers(currentTimestamp: number): void {
    const maxAge = 5000; // 5 seconds
    const trackersToRemove: string[] = [];
    
    for (const [id, tracker] of this.trackingState.activeTrackers) {
      if (currentTimestamp - tracker.lastSeen > maxAge) {
        trackersToRemove.push(id);
        this.trackingState.lostTracks.push(id);
      }
    }
    
    for (const id of trackersToRemove) {
      this.trackingState.activeTrackers.delete(id);
    }
    
    // Limit lost tracks history
    if (this.trackingState.lostTracks.length > 100) {
      this.trackingState.lostTracks.splice(0, 50);
    }
  }

  private updateTrackingHistory(tracker: ObjectTracker, timestamp: number): void {
    const history = this.trackingState.trackingHistory.find(h => h.trackerId === tracker.id);
    if (history) {
      history.positions.push({ x: tracker.position.x, y: tracker.position.y, timestamp });
      history.velocities.push(tracker.velocity);
      
      // Limit history size
      if (history.positions.length > 100) {
        history.positions.splice(0, 50);
        history.velocities.splice(0, 50);
      }
    }
  }

  private generateMotionPredictions(tracker: ObjectTracker): void {
    // Simple linear prediction
    const timeHorizons = [0.5, 1.0, 2.0]; // seconds
    
    for (const horizon of timeHorizons) {
      const predictedX = tracker.position.x + tracker.velocity.x * horizon;
      const predictedY = tracker.position.y + tracker.velocity.y * horizon;
      
      const prediction: MotionPrediction = {
        trackerId: tracker.id,
        predictedPosition: { x: predictedX, y: predictedY },
        confidence: Math.max(0.1, tracker.confidence - horizon * 0.2),
        timeHorizon: horizon
      };
      
      // Update or add prediction
      const existingIndex = this.trackingState.predictions.findIndex(
        p => p.trackerId === tracker.id && p.timeHorizon === horizon
      );
      
      if (existingIndex >= 0) {
        this.trackingState.predictions[existingIndex] = prediction;
      } else {
        this.trackingState.predictions.push(prediction);
      }
    }
  }

  private updateTrackingQuality(): void {
    const activeCount = this.trackingState.activeTrackers.size;
    const averageConfidence = activeCount > 0 ? 
      Array.from(this.trackingState.activeTrackers.values())
           .reduce((sum, tracker) => sum + tracker.confidence, 0) / activeCount : 0;
    
    this.trackingState.trackingQuality = averageConfidence;
  }

  private async analyzeMotionPatterns(regions: MotionRegion[]): Promise<MotionAnalysisResult> {
    // Analyze motion patterns in the detected regions
    const totalMotion = regions.reduce((sum, region) => sum + region.velocity.magnitude, 0);
    
    const motionCenters = regions.map(region => ({
      x: region.center.x,
      y: region.center.y,
      intensity: region.velocity.magnitude
    }));
    
    // Calculate dominant direction
    let sumX = 0, sumY = 0;
    for (const region of regions) {
      sumX += Math.cos(region.velocity.angle) * region.velocity.magnitude;
      sumY += Math.sin(region.velocity.angle) * region.velocity.magnitude;
    }
    const dominantDirection = Math.atan2(sumY, sumX) * 180 / Math.PI;
    
    // Velocity statistics
    const velocities = regions.map(r => r.velocity.magnitude);
    const averageVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const maxVelocity = Math.max(...velocities);
    
    return {
      timestamp: Date.now(),
      totalMotion,
      motionCenters,
      dominantDirection,
      velocity: {
        average: averageVelocity,
        maximum: maxVelocity,
        distribution: this.calculateVelocityDistribution(velocities)
      },
      patterns: {
        oscillatory: this.detectOscillatoryPattern(regions),
        directional: this.detectDirectionalPattern(regions),
        random: this.detectRandomPattern(regions),
        periodic: this.detectPeriodicPattern(regions)
      },
      anomalies: {
        sudden: this.detectSuddenMotion(regions),
        unusual: this.detectUnusualMotion(regions)
      }
    };
  }

  private calculateVelocityDistribution(velocities: number[]): number[] {
    // Create velocity histogram
    const bins = 10;
    const maxVel = Math.max(...velocities);
    const binSize = maxVel / bins;
    const distribution = new Array(bins).fill(0);
    
    for (const vel of velocities) {
      const binIndex = Math.min(bins - 1, Math.floor(vel / binSize));
      distribution[binIndex]++;
    }
    
    return distribution;
  }

  private detectOscillatoryPattern(regions: MotionRegion[]): boolean {
    // Simplified oscillatory pattern detection
    // Would need temporal analysis for proper implementation
    return false;
  }

  private detectDirectionalPattern(regions: MotionRegion[]): boolean {
    // Check if most motion is in similar direction
    if (regions.length < 2) return false;
    
    const angles = regions.map(r => r.velocity.angle);
    const avgAngle = angles.reduce((sum, a) => sum + a, 0) / angles.length;
    
    let consistent = 0;
    for (const angle of angles) {
      if (Math.abs(angle - avgAngle) < Math.PI / 4) { // Within 45 degrees
        consistent++;
      }
    }
    
    return consistent / regions.length > 0.7;
  }

  private detectRandomPattern(regions: MotionRegion[]): boolean {
    // Check for random motion (opposite of directional)
    return !this.detectDirectionalPattern(regions) && regions.length > 3;
  }

  private detectPeriodicPattern(regions: MotionRegion[]): { detected: boolean; period?: number; confidence?: number } {
    // Simplified periodic pattern detection
    // Would need temporal FFT analysis for proper implementation
    return { detected: false };
  }

  private detectSuddenMotion(regions: MotionRegion[]): boolean {
    // Check for sudden appearance of high-velocity motion
    const highVelocityCount = regions.filter(r => r.velocity.magnitude > 20).length;
    return highVelocityCount > 0 && this.frameCount < 10; // Sudden motion in early frames
  }

  private detectUnusualMotion(regions: MotionRegion[]): boolean {
    // Check for motion patterns that deviate from baseline
    // This would compare against established baseline patterns
    return regions.some(r => r.velocity.magnitude > 50); // Very high velocity
  }

  private calculateOverallConfidence(regions: MotionRegion[]): number {
    if (regions.length === 0) return 0;
    
    const averageConfidence = regions.reduce((sum, region) => sum + region.confidence, 0) / regions.length;
    
    // Adjust confidence based on consistency
    let consistencyBonus = 0;
    if (regions.length > 1) {
      const velocityVariation = this.calculateVelocityVariation(regions);
      consistencyBonus = Math.max(0, 1 - velocityVariation) * 0.2;
    }
    
    return Math.min(1.0, averageConfidence + consistencyBonus);
  }

  private calculateVelocityVariation(regions: MotionRegion[]): number {
    const velocities = regions.map(r => r.velocity.magnitude);
    const mean = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
    return Math.sqrt(variance) / mean; // Coefficient of variation
  }

  updateSettings(newSettings: Partial<MotionDetectionSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    // Reinitialize if algorithm changed
    if (newSettings.algorithm && newSettings.algorithm !== this.settings.algorithm) {
      this.initializeAlgorithm();
    }
    
    this.emit('settings-updated', this.settings);
  }

  start(): void {
    this.isActive = true;
    this.frameCount = 0;
    this.emit('detection-started');
    logger.info('Motion detection started');
  }

  stop(): void {
    this.isActive = false;
    this.emit('detection-stopped');
    logger.info('Motion detection stopped');
  }

  reset(): void {
    this.backgroundModel = null;
    this.previousFrames = [];
    this.opticalFlowData = [];
    this.trackingState = {
      activeTrackers: new Map(),
      trackingHistory: [],
      predictions: [],
      lostTracks: [],
      trackingQuality: 0
    };
    this.frameCount = 0;
    this.emit('detection-reset');
    logger.info('Motion detection reset');
  }

  getSettings(): MotionDetectionSettings {
    return { ...this.settings };
  }

  getTrackingState(): MotionTrackingState {
    return {
      activeTrackers: new Map(this.trackingState.activeTrackers),
      trackingHistory: [...this.trackingState.trackingHistory],
      predictions: [...this.trackingState.predictions],
      lostTracks: [...this.trackingState.lostTracks],
      trackingQuality: this.trackingState.trackingQuality
    };
  }

  getProcessingTime(): number {
    return this.processingTime;
  }

  isRunning(): boolean {
    return this.isActive;
  }

  destroy(): void {
    this.stop();
    this.reset();
    this.removeAllListeners();
  }
}

interface ConnectedComponent {
  pixels: { x: number; y: number }[];
  boundingBox: { x: number; y: number; width: number; height: number };
}