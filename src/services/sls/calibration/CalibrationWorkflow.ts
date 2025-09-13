/**
 * Calibration Workflow
 * Guided calibration process for depth sensors
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import {
  CalibrationSession,
  CalibrationStep,
  CalibrationData,
  CameraIntrinsics,
  CameraExtrinsics,
  DistortionCoefficients,
  Vector3,
  DepthFrame,
  PointCloud
} from '../types';
import { logger } from '../../../utils/logger';

export interface CalibrationPattern {
  type: 'checkerboard' | 'circles' | 'aruco' | 'custom';
  size: { width: number; height: number };
  squareSize?: number; // mm
  markerSize?: number; // mm
}

export interface CalibrationOptions {
  pattern: CalibrationPattern;
  captureCount: number;
  autoCapture: boolean;
  captureDelay: number; // seconds
  validateCaptures: boolean;
  computeExtrinsics: boolean;
}

export class CalibrationWorkflow extends EventEmitter {
  private session: CalibrationSession | null = null;
  private capturedFrames: Map<string, DepthFrame[]> = new Map();
  private capturedPointClouds: Map<string, PointCloud[]> = new Map();
  private patternDetections: Map<string, Vector3[][]> = new Map();
  private options: CalibrationOptions;

  constructor(options?: Partial<CalibrationOptions>) {
    super();
    
    this.options = {
      pattern: {
        type: 'checkerboard',
        size: { width: 9, height: 6 },
        squareSize: 30 // 30mm squares
      },
      captureCount: 20,
      autoCapture: false,
      captureDelay: 2,
      validateCaptures: true,
      computeExtrinsics: true,
      ...options
    };
  }

  /**
   * Start calibration session
   */
  startCalibration(sensorId: string): CalibrationSession {
    if (this.session && this.session.status === 'in_progress') {
      throw new Error('Calibration already in progress');
    }

    const steps = this.generateCalibrationSteps();

    this.session = {
      id: `calib_${sensorId}_${Date.now()}`,
      sensorId,
      steps,
      startTime: new Date(),
      status: 'pending'
    };

    this.capturedFrames.set(this.session.id, []);
    this.capturedPointClouds.set(this.session.id, []);
    this.patternDetections.set(this.session.id, []);

    this.emit('calibration-started', this.session);
    logger.info(`Started calibration for sensor ${sensorId}`);

    return this.session;
  }

  /**
   * Generate calibration steps
   */
  private generateCalibrationSteps(): CalibrationStep[] {
    const steps: CalibrationStep[] = [];

    // Initial setup
    steps.push({
      name: 'Setup',
      description: `Place the ${this.options.pattern.type} pattern in view of the sensor`,
      type: 'wait',
      duration: 5000,
      completed: false
    });

    // Capture positions
    const positions = this.generateCapturePositions();
    for (let i = 0; i < this.options.captureCount; i++) {
      steps.push({
        name: `Capture ${i + 1}`,
        description: `Move pattern to position ${i + 1}/${this.options.captureCount}`,
        type: 'move',
        targetPosition: positions[i],
        completed: false
      });

      steps.push({
        name: `Frame ${i + 1}`,
        description: 'Capturing calibration frame',
        type: 'capture',
        duration: this.options.captureDelay * 1000,
        completed: false
      });
    }

    // Processing
    steps.push({
      name: 'Processing',
      description: 'Computing calibration parameters',
      type: 'wait',
      duration: 5000,
      completed: false
    });

    return steps;
  }

  /**
   * Generate capture positions for comprehensive calibration
   */
  private generateCapturePositions(): Vector3[] {
    const positions: Vector3[] = [];
    const gridSize = Math.ceil(Math.sqrt(this.options.captureCount));
    
    for (let i = 0; i < this.options.captureCount; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;
      
      // Create varied positions for robust calibration
      positions.push({
        x: (col - gridSize / 2) * 200, // mm
        y: (row - gridSize / 2) * 200,
        z: 500 + (i % 3) * 200 // Vary depth between 500-900mm
      });
    }

    // Add rotated positions for better coverage
    for (let i = 0; i < Math.min(5, positions.length); i++) {
      const angle = (i * 30) * Math.PI / 180; // 30-degree increments
      positions[i] = {
        x: positions[i].x * Math.cos(angle),
        y: positions[i].y,
        z: positions[i].z
      };
    }

    return positions;
  }

  /**
   * Process next step
   */
  async processNextStep(): Promise<void> {
    if (!this.session) return;

    const currentStep = this.session.steps.find(s => !s.completed);
    if (!currentStep) {
      await this.completeCalibration();
      return;
    }

    this.session.status = 'in_progress';
    this.emit('step-started', currentStep);

    switch (currentStep.type) {
      case 'wait':
        await this.processWaitStep(currentStep);
        break;
      case 'move':
        await this.processMoveStep(currentStep);
        break;
      case 'capture':
        await this.processCaptureStep(currentStep);
        break;
    }

    currentStep.completed = true;
    this.emit('step-completed', currentStep);

    // Auto-advance if enabled
    if (this.options.autoCapture) {
      setTimeout(() => this.processNextStep(), 500);
    }
  }

  /**
   * Process wait step
   */
  private async processWaitStep(step: CalibrationStep): Promise<void> {
    if (step.duration) {
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }
  }

  /**
   * Process move step
   */
  private async processMoveStep(step: CalibrationStep): Promise<void> {
    // Emit target position for UI guidance
    if (step.targetPosition) {
      this.emit('move-pattern', step.targetPosition);
    }

    // Wait for user to position pattern
    if (!this.options.autoCapture) {
      await new Promise<void>(resolve => {
        const handler = () => {
          this.off('pattern-positioned', handler);
          resolve();
        };
        this.on('pattern-positioned', handler);
      });
    } else {
      // Auto mode: wait for movement time
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /**
   * Process capture step
   */
  private async processCaptureStep(step: CalibrationStep): Promise<void> {
    if (!this.session) return;

    // Wait for capture delay
    if (step.duration) {
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }

    // Capture will be triggered by external call to captureFrame
    await new Promise<void>(resolve => {
      const handler = () => {
        this.off('frame-captured', handler);
        resolve();
      };
      this.on('frame-captured', handler);
    });
  }

  /**
   * Capture calibration frame
   */
  captureFrame(depthFrame: DepthFrame, pointCloud?: PointCloud): void {
    if (!this.session || this.session.status !== 'in_progress') return;

    const frames = this.capturedFrames.get(this.session.id);
    const clouds = this.capturedPointClouds.get(this.session.id);

    if (frames) {
      frames.push(depthFrame);
    }

    if (clouds && pointCloud) {
      clouds.push(pointCloud);
    }

    // Detect calibration pattern
    const patternPoints = this.detectPattern(depthFrame);
    if (patternPoints) {
      const detections = this.patternDetections.get(this.session.id);
      if (detections) {
        detections.push(patternPoints);
      }

      if (this.options.validateCaptures && !this.validateCapture(patternPoints)) {
        this.emit('capture-invalid', 'Pattern detection failed validation');
        return;
      }
    } else if (this.options.validateCaptures) {
      this.emit('capture-invalid', 'Pattern not detected');
      return;
    }

    this.emit('frame-captured', { frame: depthFrame, pattern: patternPoints });
    logger.info(`Captured calibration frame ${frames?.length}/${this.options.captureCount}`);
  }

  /**
   * Detect calibration pattern in depth frame
   */
  private detectPattern(frame: DepthFrame): Vector3[][] | null {
    // Pattern detection implementation would vary by pattern type
    // This is a simplified example for checkerboard detection

    const { width, height, depthData } = frame;
    const pattern = this.options.pattern;
    
    if (pattern.type !== 'checkerboard') {
      logger.warn(`Pattern type ${pattern.type} not yet implemented`);
      return null;
    }

    const corners: Vector3[][] = [];
    const patternWidth = pattern.size.width;
    const patternHeight = pattern.size.height;

    // Simplified corner detection
    // Real implementation would use computer vision algorithms
    for (let row = 0; row < patternHeight; row++) {
      const rowCorners: Vector3[] = [];
      for (let col = 0; col < patternWidth; col++) {
        // Calculate approximate position in image
        const x = (col + 1) * (width / (patternWidth + 1));
        const y = (row + 1) * (height / (patternHeight + 1));
        const idx = Math.floor(y) * width + Math.floor(x);
        const depth = depthData[idx];

        if (depth > 0) {
          rowCorners.push({
            x: x,
            y: y,
            z: depth
          });
        }
      }
      
      if (rowCorners.length === patternWidth) {
        corners.push(rowCorners);
      }
    }

    return corners.length === patternHeight ? corners : null;
  }

  /**
   * Validate captured pattern
   */
  private validateCapture(patternPoints: Vector3[][]): boolean {
    const pattern = this.options.pattern;
    
    // Check correct number of points
    if (patternPoints.length !== pattern.size.height) return false;
    if (patternPoints[0].length !== pattern.size.width) return false;

    // Check points are reasonably spaced
    const avgSpacing = this.calculateAverageSpacing(patternPoints);
    const expectedSpacing = pattern.squareSize || 30;
    const tolerance = expectedSpacing * 0.3; // 30% tolerance

    if (Math.abs(avgSpacing - expectedSpacing) > tolerance) {
      return false;
    }

    // Check planarity (points should be roughly coplanar)
    const planarity = this.calculatePlanarity(patternPoints);
    if (planarity > 10) { // 10mm tolerance
      return false;
    }

    return true;
  }

  /**
   * Calculate average spacing between pattern points
   */
  private calculateAverageSpacing(points: Vector3[][]): number {
    let totalSpacing = 0;
    let count = 0;

    for (let row = 0; row < points.length; row++) {
      for (let col = 0; col < points[row].length - 1; col++) {
        const p1 = points[row][col];
        const p2 = points[row][col + 1];
        const dist = Math.sqrt(
          Math.pow(p2.x - p1.x, 2) +
          Math.pow(p2.y - p1.y, 2) +
          Math.pow(p2.z - p1.z, 2)
        );
        totalSpacing += dist;
        count++;
      }
    }

    return count > 0 ? totalSpacing / count : 0;
  }

  /**
   * Calculate planarity of pattern points
   */
  private calculatePlanarity(points: Vector3[][]): number {
    // Flatten points
    const flatPoints: Vector3[] = [];
    for (const row of points) {
      flatPoints.push(...row);
    }

    // Fit plane using least squares
    const plane = this.fitPlane(flatPoints);
    
    // Calculate maximum distance from plane
    let maxDistance = 0;
    for (const point of flatPoints) {
      const distance = Math.abs(
        plane.normal.x * point.x +
        plane.normal.y * point.y +
        plane.normal.z * point.z +
        plane.distance
      );
      maxDistance = Math.max(maxDistance, distance);
    }

    return maxDistance;
  }

  /**
   * Fit plane to points using least squares
   */
  private fitPlane(points: Vector3[]): { normal: Vector3; distance: number } {
    // Calculate centroid
    const centroid = { x: 0, y: 0, z: 0 };
    for (const p of points) {
      centroid.x += p.x;
      centroid.y += p.y;
      centroid.z += p.z;
    }
    centroid.x /= points.length;
    centroid.y /= points.length;
    centroid.z /= points.length;

    // Calculate covariance matrix
    let xx = 0, xy = 0, xz = 0;
    let yy = 0, yz = 0, zz = 0;

    for (const p of points) {
      const dx = p.x - centroid.x;
      const dy = p.y - centroid.y;
      const dz = p.z - centroid.z;

      xx += dx * dx;
      xy += dx * dy;
      xz += dx * dz;
      yy += dy * dy;
      yz += dy * dz;
      zz += dz * dz;
    }

    // The normal is the eigenvector with smallest eigenvalue
    // Simplified: use cross product of two principal directions
    const v1 = { x: 1, y: xy / xx, z: xz / xx };
    const v2 = { x: xy / yy, y: 1, z: yz / yy };

    const normal = {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    };

    // Normalize
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
    normal.x /= length;
    normal.y /= length;
    normal.z /= length;

    // Calculate distance
    const distance = -(normal.x * centroid.x + normal.y * centroid.y + normal.z * centroid.z);

    return { normal, distance };
  }

  /**
   * Complete calibration
   */
  private async completeCalibration(): Promise<void> {
    if (!this.session) return;

    this.emit('calibration-processing');
    logger.info('Processing calibration data...');

    try {
      const calibrationData = await this.computeCalibration();
      
      this.session.endTime = new Date();
      this.session.status = 'completed';
      this.session.result = calibrationData;

      this.emit('calibration-completed', calibrationData);
      logger.info('Calibration completed successfully');
    } catch (error) {
      this.session.status = 'failed';
      this.session.error = error instanceof Error ? error.message : 'Calibration failed';
      
      this.emit('calibration-failed', error);
      logger.error('Calibration failed', error);
    }
  }

  /**
   * Compute calibration parameters
   */
  private async computeCalibration(): Promise<CalibrationData> {
    if (!this.session) throw new Error('No calibration session');

    const frames = this.capturedFrames.get(this.session.id);
    const detections = this.patternDetections.get(this.session.id);

    if (!frames || !detections || frames.length === 0) {
      throw new Error('No calibration frames captured');
    }

    // Compute intrinsics
    const intrinsics = this.computeIntrinsics(frames, detections);

    // Compute extrinsics if requested
    let extrinsics: CameraExtrinsics | undefined;
    if (this.options.computeExtrinsics) {
      extrinsics = this.computeExtrinsics(detections);
    }

    // Estimate distortion
    const distortion = this.computeDistortion(frames, detections);

    return {
      intrinsics,
      extrinsics,
      distortion,
      timestamp: new Date(),
      accuracy: this.estimateCalibrationAccuracy(detections)
    };
  }

  /**
   * Compute camera intrinsics
   */
  private computeIntrinsics(frames: DepthFrame[], detections: Vector3[][][]): CameraIntrinsics {
    // Simplified intrinsics calculation
    // Real implementation would use Zhang's method or similar

    const frame = frames[0];
    const width = frame.width;
    const height = frame.height;

    // Estimate focal length from FOV
    // Assuming ~60 degree horizontal FOV for Kinect
    const fovH = 60 * Math.PI / 180;
    const fx = width / (2 * Math.tan(fovH / 2));
    const fy = fx; // Assume square pixels

    // Principal point at image center
    const cx = width / 2;
    const cy = height / 2;

    return { fx, fy, cx, cy, width, height };
  }

  /**
   * Compute camera extrinsics
   */
  private computeExtrinsics(detections: Vector3[][][]): CameraExtrinsics {
    // Simplified extrinsics calculation
    // Real implementation would use PnP solver

    // Identity transformation as default
    const rotation = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];

    const translation = [0, 0, 0];

    return { rotation, translation };
  }

  /**
   * Compute distortion coefficients
   */
  private computeDistortion(frames: DepthFrame[], detections: Vector3[][][]): DistortionCoefficients {
    // Simplified distortion estimation
    // Real implementation would optimize reprojection error

    return {
      k1: 0.0,
      k2: 0.0,
      k3: 0.0,
      p1: 0.0,
      p2: 0.0
    };
  }

  /**
   * Estimate calibration accuracy
   */
  private estimateCalibrationAccuracy(detections: Vector3[][][]): number {
    if (detections.length === 0) return 0;

    // Calculate reprojection error as accuracy metric
    let totalError = 0;
    let pointCount = 0;

    for (const detection of detections) {
      for (const row of detection) {
        for (const point of row) {
          // Simplified: use depth variance as error metric
          totalError += Math.abs(point.z - 700); // Assume 700mm nominal distance
          pointCount++;
        }
      }
    }

    const avgError = pointCount > 0 ? totalError / pointCount : 0;
    
    // Convert to accuracy percentage (lower error = higher accuracy)
    const accuracy = Math.max(0, Math.min(1, 1 - (avgError / 100)));
    
    return accuracy;
  }

  /**
   * Load calibration from file
   */
  async loadCalibration(filePath: string): Promise<CalibrationData> {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  }

  /**
   * Save calibration to file
   */
  async saveCalibration(calibration: CalibrationData, filePath: string): Promise<void> {
    fs.writeFileSync(filePath, JSON.stringify(calibration, null, 2));
    logger.info(`Calibration saved to ${filePath}`);
  }

  /**
   * Cancel calibration
   */
  cancelCalibration(): void {
    if (this.session) {
      this.session.status = 'failed';
      this.session.error = 'Calibration cancelled by user';
      this.emit('calibration-cancelled', this.session);
      
      this.cleanup();
    }
  }

  /**
   * Cleanup
   */
  private cleanup(): void {
    if (this.session) {
      this.capturedFrames.delete(this.session.id);
      this.capturedPointClouds.delete(this.session.id);
      this.patternDetections.delete(this.session.id);
      this.session = null;
    }
  }

  /**
   * Get current session
   */
  getSession(): CalibrationSession | null {
    return this.session;
  }

  /**
   * Get progress
   */
  getProgress(): number {
    if (!this.session) return 0;
    
    const completed = this.session.steps.filter(s => s.completed).length;
    return completed / this.session.steps.length;
  }
}