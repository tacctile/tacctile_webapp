/**
 * SLS Anomaly Detector
 * Detects paranormal anomalies in depth sensor data
 */

import { EventEmitter } from 'events';
import {
  SLSDetection,
  DetectionType,
  DepthAnomaly,
  DepthFrame,
  PointCloud,
  Skeleton,
  Vector3,
  BoundingBox3D,
  DetectionThresholds,
  NoiseProfile
} from '../types';
import { logger } from '../../../utils/logger';

export interface AnomalyPattern {
  type: 'void' | 'mass' | 'distortion' | 'shadow' | 'manifestation';
  signature: number[];
  confidence: number;
  description: string;
}

export interface DetectionResult {
  detections: SLSDetection[];
  confidence: number;
  frameNumber: number;
  timestamp: number;
}

export class SLSAnomalyDetector extends EventEmitter {
  private thresholds: DetectionThresholds;
  private frameHistory: DepthFrame[] = [];
  private backgroundModel: DepthFrame | null = null;
  private detectionHistory: SLSDetection[] = [];
  private noiseProfile: NoiseProfile | null = null;
  private historySize: number = 30;
  private frameCount: number = 0;

  constructor(thresholds?: Partial<DetectionThresholds>) {
    super();

    this.thresholds = {
      minDepthChange: 50,      // 50mm minimum change
      minVolumeSize: 0.001,     // 0.001 cubic meters
      motionThreshold: 0.5,     // 0.5 meters/second
      skeletonConfidence: 0.6,  // 60% confidence
      anomalyIntensity: 0.3,    // 30% intensity threshold
      noiseReduction: 0.5,      // 50% noise reduction
      ...thresholds
    };
  }

  /**
   * Process depth frame for anomalies
   */
  async processFrame(
    frame: DepthFrame,
    pointCloud?: PointCloud,
    skeletons?: Skeleton[]
  ): Promise<DetectionResult> {
    this.frameCount++;

    // Update background model
    if (!this.backgroundModel) {
      this.backgroundModel = this.cloneDepthFrame(frame);
      this.estimateNoiseProfile(frame);
    } else {
      this.updateBackgroundModel(frame);
    }

    // Add to history
    this.frameHistory.push(frame);
    if (this.frameHistory.length > this.historySize) {
      this.frameHistory.shift();
    }

    const detections: SLSDetection[] = [];

    // Detect depth anomalies
    const depthAnomalies = this.detectDepthAnomalies(frame);
    detections.push(...depthAnomalies);

    // Detect volumetric anomalies in point cloud
    if (pointCloud) {
      const volumetricAnomalies = this.detectVolumetricAnomalies(pointCloud);
      detections.push(...volumetricAnomalies);
    }

    // Detect skeletal anomalies
    if (skeletons && skeletons.length > 0) {
      const skeletalAnomalies = this.detectSkeletalAnomalies(skeletons);
      detections.push(...skeletalAnomalies);
    }

    // Detect temporal anomalies
    if (this.frameHistory.length >= 3) {
      const temporalAnomalies = this.detectTemporalAnomalies();
      detections.push(...temporalAnomalies);
    }

    // Detect shadow figures
    const shadowFigures = this.detectShadowFigures(frame);
    detections.push(...shadowFigures);

    // Filter and merge detections
    const filteredDetections = this.filterDetections(detections);
    const mergedDetections = this.mergeNearbyDetections(filteredDetections);

    // Update history
    this.detectionHistory.push(...mergedDetections);
    if (this.detectionHistory.length > 100) {
      this.detectionHistory.splice(0, this.detectionHistory.length - 100);
    }

    // Calculate overall confidence
    const confidence = this.calculateConfidence(mergedDetections);

    // Emit significant detections
    for (const detection of mergedDetections) {
      if (detection.confidence > this.thresholds.anomalyIntensity) {
        this.emit('anomaly-detected', detection);
      }
    }

    return {
      detections: mergedDetections,
      confidence,
      frameNumber: this.frameCount,
      timestamp: Date.now()
    };
  }

  /**
   * Detect depth anomalies
   */
  private detectDepthAnomalies(frame: DepthFrame): SLSDetection[] {
    if (!this.backgroundModel) return [];

    const detections: SLSDetection[] = [];
    const { width, height, depthData } = frame;
    const bgData = this.backgroundModel.depthData;

    // Divide frame into regions
    const regionSize = 32; // 32x32 pixel regions
    const regionsX = Math.ceil(width / regionSize);
    const regionsY = Math.ceil(height / regionSize);

    for (let ry = 0; ry < regionsY; ry++) {
      for (let rx = 0; rx < regionsX; rx++) {
        const anomaly = this.analyzeRegion(
          frame,
          this.backgroundModel,
          rx * regionSize,
          ry * regionSize,
          regionSize,
          regionSize
        );

        if (anomaly) {
          detections.push(anomaly);
        }
      }
    }

    return detections;
  }

  /**
   * Analyze region for anomalies
   */
  private analyzeRegion(
    frame: DepthFrame,
    background: DepthFrame,
    x: number,
    y: number,
    width: number,
    height: number
  ): SLSDetection | null {
    const frameData = frame.depthData;
    const bgData = background.depthData;
    const imageWidth = frame.width;

    let depthSum = 0;
    let depthDiffSum = 0;
    let validPixels = 0;
    let minDepth = Infinity;
    let maxDepth = -Infinity;

    for (let dy = 0; dy < height && y + dy < frame.height; dy++) {
      for (let dx = 0; dx < width && x + dx < frame.width; dx++) {
        const idx = (y + dy) * imageWidth + (x + dx);
        const depth = frameData[idx];
        const bgDepth = bgData[idx];

        if (depth > 0 && bgDepth > 0) {
          const diff = Math.abs(depth - bgDepth);
          
          if (diff > this.thresholds.minDepthChange) {
            depthSum += depth;
            depthDiffSum += diff;
            validPixels++;
            minDepth = Math.min(minDepth, depth);
            maxDepth = Math.max(maxDepth, depth);
          }
        }
      }
    }

    if (validPixels < 10) return null; // Too few valid pixels

    const avgDepth = depthSum / validPixels;
    const avgDiff = depthDiffSum / validPixels;
    const depthRange = maxDepth - minDepth;

    // Determine anomaly type
    let anomalyType: 'void' | 'mass' | 'distortion' | 'unknown' = 'unknown';
    
    if (avgDiff > 200 && depthRange > 100) {
      anomalyType = 'distortion';
    } else if (avgDepth < bgData[Math.floor(y + height/2) * imageWidth + Math.floor(x + width/2)] - 100) {
      anomalyType = 'mass'; // Object closer than background
    } else if (avgDepth > bgData[Math.floor(y + height/2) * imageWidth + Math.floor(x + width/2)] + 100) {
      anomalyType = 'void'; // Hole in space
    }

    const confidence = Math.min(1, avgDiff / 500); // Normalize to 0-1

    if (confidence < this.thresholds.anomalyIntensity) return null;

    // Convert to 3D position
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const position = this.convertTo3D(centerX, centerY, avgDepth, frame.width, frame.height);

    const detection: SLSDetection = {
      id: `anomaly_${Date.now()}_${Math.random()}`,
      type: DetectionType.ANOMALY,
      anomaly: {
        type: anomalyType,
        region: {
          min: { x: position.x - width/2, y: position.y - height/2, z: minDepth },
          max: { x: position.x + width/2, y: position.y + height/2, z: maxDepth },
          center: position,
          size: { x: width, y: height, z: depthRange }
        },
        depthDeviation: avgDiff,
        volumetric: depthRange > 50,
        intensity: confidence
      },
      confidence,
      timestamp: Date.now(),
      frameNumber: this.frameCount,
      position,
      size: { x: width, y: height, z: depthRange },
      description: `${anomalyType} anomaly detected with ${Math.round(confidence * 100)}% confidence`
    };

    return detection;
  }

  /**
   * Detect volumetric anomalies in point cloud
   */
  private detectVolumetricAnomalies(pointCloud: PointCloud): SLSDetection[] {
    const detections: SLSDetection[] = [];
    const points = pointCloud.points;
    const numPoints = points.length / 3;

    // Cluster points to find volumetric masses
    const clusters = this.clusterPoints(points);

    for (const cluster of clusters) {
      const volume = this.calculateVolume(cluster);
      
      if (volume < this.thresholds.minVolumeSize) continue;

      const center = this.calculateCenter(cluster);
      const bounds = this.calculateBounds(cluster);
      const density = cluster.length / volume;

      // Check for anomalous density patterns
      const isAnomaly = this.isAnomalousDensity(density, volume);
      
      if (isAnomaly) {
        const detection: SLSDetection = {
          id: `volumetric_${Date.now()}_${Math.random()}`,
          type: DetectionType.MANIFESTATION,
          confidence: Math.min(1, density / 1000), // Normalize density
          timestamp: Date.now(),
          frameNumber: this.frameCount,
          position: center,
          size: {
            x: bounds.max.x - bounds.min.x,
            y: bounds.max.y - bounds.min.y,
            z: bounds.max.z - bounds.min.z
          },
          description: `Volumetric manifestation detected: ${volume.toFixed(3)} m³`
        };

        detections.push(detection);
      }
    }

    return detections;
  }

  /**
   * Cluster points using DBSCAN-like algorithm
   */
  private clusterPoints(points: Float32Array): Vector3[][] {
    const clusters: Vector3[][] = [];
    const numPoints = points.length / 3;
    const visited = new Set<number>();
    const eps = 100; // 100mm distance threshold

    for (let i = 0; i < numPoints; i++) {
      if (visited.has(i)) continue;

      const cluster: Vector3[] = [];
      const queue = [i];
      
      while (queue.length > 0) {
        const idx = queue.shift()!;
        if (visited.has(idx)) continue;
        
        visited.add(idx);
        
        const p1 = {
          x: points[idx * 3],
          y: points[idx * 3 + 1],
          z: points[idx * 3 + 2]
        };
        
        cluster.push(p1);

        // Find neighbors
        for (let j = 0; j < numPoints; j++) {
          if (visited.has(j)) continue;
          
          const p2 = {
            x: points[j * 3],
            y: points[j * 3 + 1],
            z: points[j * 3 + 2]
          };

          const dist = this.distance3D(p1, p2);
          if (dist < eps) {
            queue.push(j);
          }
        }
      }

      if (cluster.length > 50) { // Minimum cluster size
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Detect skeletal anomalies
   */
  private detectSkeletalAnomalies(skeletons: Skeleton[]): SLSDetection[] {
    const detections: SLSDetection[] = [];

    for (const skeleton of skeletons) {
      // Check for incomplete skeletons (possible partial manifestations)
      const trackedJoints = skeleton.joints.filter(j => j.tracked).length;
      const totalJoints = skeleton.joints.length;
      const completeness = trackedJoints / totalJoints;

      if (completeness < 0.7 && completeness > 0.3) {
        // Partial figure detected
        const detection: SLSDetection = {
          id: `skeletal_${skeleton.id}_${Date.now()}`,
          type: DetectionType.FIGURE,
          skeleton,
          confidence: skeleton.confidence,
          timestamp: Date.now(),
          frameNumber: this.frameCount,
          position: skeleton.centerOfMass || skeleton.joints[0].position,
          description: `Partial figure detected: ${Math.round(completeness * 100)}% complete`
        };

        detections.push(detection);
      }

      // Check for anomalous joint configurations
      const anomalousJoints = this.detectAnomalousJoints(skeleton);
      if (anomalousJoints.length > 0) {
        const detection: SLSDetection = {
          id: `skeletal_anomaly_${skeleton.id}_${Date.now()}`,
          type: DetectionType.SKELETAL,
          skeleton,
          confidence: 0.8,
          timestamp: Date.now(),
          frameNumber: this.frameCount,
          position: skeleton.centerOfMass || skeleton.joints[0].position,
          description: `Anomalous skeletal configuration: ${anomalousJoints.join(', ')}`
        };

        detections.push(detection);
      }
    }

    return detections;
  }

  /**
   * Detect anomalous joint configurations
   */
  private detectAnomalousJoints(skeleton: Skeleton): string[] {
    const anomalies: string[] = [];

    // Check for impossible joint angles
    for (let i = 0; i < skeleton.joints.length - 1; i++) {
      const j1 = skeleton.joints[i];
      const j2 = skeleton.joints[i + 1];

      if (!j1.tracked || !j2.tracked) continue;

      const distance = this.distance3D(j1.position, j2.position);

      // Check for stretched limbs
      if (distance > 1000) { // More than 1 meter between adjacent joints
        anomalies.push(`Stretched limb: ${j1.type} to ${j2.type}`);
      }

      // Check for compressed limbs
      if (distance < 50) { // Less than 5cm between joints
        anomalies.push(`Compressed limb: ${j1.type} to ${j2.type}`);
      }
    }

    return anomalies;
  }

  /**
   * Detect temporal anomalies
   */
  private detectTemporalAnomalies(): SLSDetection[] {
    const detections: SLSDetection[] = [];
    
    if (this.frameHistory.length < 3) return detections;

    const currentFrame = this.frameHistory[this.frameHistory.length - 1];
    const prevFrame = this.frameHistory[this.frameHistory.length - 2];
    const prevPrevFrame = this.frameHistory[this.frameHistory.length - 3];

    // Detect rapid depth changes (teleportation-like effects)
    const rapidChanges = this.detectRapidDepthChanges(
      prevPrevFrame,
      prevFrame,
      currentFrame
    );

    for (const change of rapidChanges) {
      const detection: SLSDetection = {
        id: `temporal_${Date.now()}_${Math.random()}`,
        type: DetectionType.DISTORTION,
        confidence: change.confidence,
        timestamp: Date.now(),
        frameNumber: this.frameCount,
        position: change.position,
        description: `Temporal distortion: rapid depth change of ${change.magnitude}mm`
      };

      detections.push(detection);
    }

    return detections;
  }

  /**
   * Detect rapid depth changes
   */
  private detectRapidDepthChanges(
    frame1: DepthFrame,
    frame2: DepthFrame,
    frame3: DepthFrame
  ): Array<{ position: Vector3; magnitude: number; confidence: number }> {
    const changes: Array<{ position: Vector3; magnitude: number; confidence: number }> = [];
    const { width, height } = frame1;

    for (let y = 0; y < height; y += 16) {
      for (let x = 0; x < width; x += 16) {
        const idx = y * width + x;
        
        const d1 = frame1.depthData[idx];
        const d2 = frame2.depthData[idx];
        const d3 = frame3.depthData[idx];

        if (d1 === 0 || d2 === 0 || d3 === 0) continue;

        const change12 = Math.abs(d2 - d1);
        const change23 = Math.abs(d3 - d2);

        // Look for sudden changes followed by stability or reversal
        if (change12 > 200 && change23 < 50) {
          const position = this.convertTo3D(x, y, d2, width, height);
          changes.push({
            position,
            magnitude: change12,
            confidence: Math.min(1, change12 / 500)
          });
        }
      }
    }

    return changes;
  }

  /**
   * Detect shadow figures
   */
  private detectShadowFigures(frame: DepthFrame): SLSDetection[] {
    const detections: SLSDetection[] = [];
    const { width, height, depthData } = frame;

    // Look for human-like silhouettes in depth data
    const silhouettes = this.detectSilhouettes(frame);

    for (const silhouette of silhouettes) {
      if (this.isHumanoidShape(silhouette)) {
        const center = this.calculateSilhouetteCenter(silhouette);
        const avgDepth = this.calculateAverageDepth(silhouette, depthData, width);

        const detection: SLSDetection = {
          id: `shadow_${Date.now()}_${Math.random()}`,
          type: DetectionType.SHADOW,
          confidence: silhouette.confidence,
          timestamp: Date.now(),
          frameNumber: this.frameCount,
          position: this.convertTo3D(center.x, center.y, avgDepth, width, height),
          description: `Shadow figure detected: ${silhouette.width}x${silhouette.height} pixels`
        };

        detections.push(detection);
      }
    }

    return detections;
  }

  /**
   * Detect silhouettes in depth frame
   */
  private detectSilhouettes(frame: DepthFrame): Array<{
    points: Array<{ x: number; y: number }>;
    width: number;
    height: number;
    confidence: number;
  }> {
    // Simplified silhouette detection
    // Real implementation would use edge detection and contour finding
    
    const silhouettes: Array<{
      points: Array<{ x: number; y: number }>;
      width: number;
      height: number;
      confidence: number;
    }> = [];

    // Placeholder for actual implementation
    return silhouettes;
  }

  /**
   * Check if silhouette is humanoid
   */
  private isHumanoidShape(silhouette: {
    points: Array<{ x: number; y: number }>;
    width: number;
    height: number;
  }): boolean {
    // Check aspect ratio (humans are typically 1:6 to 1:8)
    const aspectRatio = silhouette.height / silhouette.width;
    return aspectRatio >= 3 && aspectRatio <= 8;
  }

  /**
   * Calculate silhouette center
   */
  private calculateSilhouetteCenter(silhouette: {
    points: Array<{ x: number; y: number }>;
  }): { x: number; y: number } {
    let sumX = 0, sumY = 0;
    for (const point of silhouette.points) {
      sumX += point.x;
      sumY += point.y;
    }
    return {
      x: sumX / silhouette.points.length,
      y: sumY / silhouette.points.length
    };
  }

  /**
   * Calculate average depth for silhouette
   */
  private calculateAverageDepth(
    silhouette: { points: Array<{ x: number; y: number }> },
    depthData: Uint16Array,
    width: number
  ): number {
    let sum = 0;
    let count = 0;

    for (const point of silhouette.points) {
      const idx = point.y * width + point.x;
      const depth = depthData[idx];
      if (depth > 0) {
        sum += depth;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Filter detections based on thresholds
   */
  private filterDetections(detections: SLSDetection[]): SLSDetection[] {
    return detections.filter(d => {
      // Filter by confidence
      if (d.confidence < this.thresholds.anomalyIntensity) return false;

      // Filter by size (if available)
      if (d.size) {
        const volume = (d.size.x * d.size.y * d.size.z) / 1000000; // Convert to m³
        if (volume < this.thresholds.minVolumeSize) return false;
      }

      return true;
    });
  }

  /**
   * Merge nearby detections
   */
  private mergeNearbyDetections(detections: SLSDetection[]): SLSDetection[] {
    const merged: SLSDetection[] = [];
    const used = new Set<number>();

    for (let i = 0; i < detections.length; i++) {
      if (used.has(i)) continue;

      const group = [detections[i]];
      used.add(i);

      for (let j = i + 1; j < detections.length; j++) {
        if (used.has(j)) continue;

        const dist = this.distance3D(
          detections[i].position,
          detections[j].position
        );

        if (dist < 200) { // Within 200mm
          group.push(detections[j]);
          used.add(j);
        }
      }

      // Merge group into single detection
      if (group.length === 1) {
        merged.push(group[0]);
      } else {
        merged.push(this.mergeDetectionGroup(group));
      }
    }

    return merged;
  }

  /**
   * Merge detection group
   */
  private mergeDetectionGroup(group: SLSDetection[]): SLSDetection {
    // Calculate average position
    const avgPosition = { x: 0, y: 0, z: 0 };
    let totalConfidence = 0;

    for (const detection of group) {
      avgPosition.x += detection.position.x;
      avgPosition.y += detection.position.y;
      avgPosition.z += detection.position.z;
      totalConfidence += detection.confidence;
    }

    avgPosition.x /= group.length;
    avgPosition.y /= group.length;
    avgPosition.z /= group.length;

    return {
      id: `merged_${Date.now()}_${Math.random()}`,
      type: group[0].type,
      confidence: totalConfidence / group.length,
      timestamp: Date.now(),
      frameNumber: this.frameCount,
      position: avgPosition,
      description: `Merged detection from ${group.length} sources`
    };
  }

  /**
   * Calculate overall confidence
   */
  private calculateConfidence(detections: SLSDetection[]): number {
    if (detections.length === 0) return 0;

    let totalConfidence = 0;
    for (const detection of detections) {
      totalConfidence += detection.confidence;
    }

    return Math.min(1, totalConfidence / detections.length);
  }

  /**
   * Update background model
   */
  private updateBackgroundModel(frame: DepthFrame): void {
    if (!this.backgroundModel) return;

    const alpha = 0.01; // Learning rate
    const { depthData } = frame;
    const bgData = this.backgroundModel.depthData;

    for (let i = 0; i < depthData.length; i++) {
      if (depthData[i] > 0) {
        bgData[i] = Math.round(bgData[i] * (1 - alpha) + depthData[i] * alpha);
      }
    }
  }

  /**
   * Estimate noise profile
   */
  private estimateNoiseProfile(frame: DepthFrame): void {
    const { depthData } = frame;
    let variance = 0;
    let count = 0;

    for (let i = 1; i < depthData.length - 1; i++) {
      if (depthData[i] > 0 && depthData[i - 1] > 0 && depthData[i + 1] > 0) {
        const diff = Math.abs(depthData[i] - (depthData[i - 1] + depthData[i + 1]) / 2);
        variance += diff * diff;
        count++;
      }
    }

    const spatialNoise = Math.sqrt(variance / count);
    
    this.noiseProfile = {
      spatial: spatialNoise,
      temporal: 0, // Will be calculated over time
      pattern: 'gaussian'
    };
  }

  /**
   * Clone depth frame
   */
  private cloneDepthFrame(frame: DepthFrame): DepthFrame {
    return {
      depthData: new Uint16Array(frame.depthData),
      width: frame.width,
      height: frame.height,
      timestamp: frame.timestamp,
      frameNumber: frame.frameNumber,
      minDepth: frame.minDepth,
      maxDepth: frame.maxDepth
    };
  }

  /**
   * Convert 2D pixel to 3D position
   */
  private convertTo3D(x: number, y: number, depth: number, width: number, height: number): Vector3 {
    // Simplified conversion using typical Kinect FOV
    const fovH = 60 * Math.PI / 180;
    const fovV = 45 * Math.PI / 180;

    const nx = (x - width / 2) / (width / 2);
    const ny = (y - height / 2) / (height / 2);

    return {
      x: nx * depth * Math.tan(fovH / 2),
      y: ny * depth * Math.tan(fovV / 2),
      z: depth
    };
  }

  /**
   * Calculate distance between 3D points
   */
  private distance3D(p1: Vector3, p2: Vector3): number {
    return Math.sqrt(
      Math.pow(p2.x - p1.x, 2) +
      Math.pow(p2.y - p1.y, 2) +
      Math.pow(p2.z - p1.z, 2)
    );
  }

  /**
   * Calculate volume of point cluster
   */
  private calculateVolume(cluster: Vector3[]): number {
    const bounds = this.calculateBounds(cluster);
    return (
      (bounds.max.x - bounds.min.x) *
      (bounds.max.y - bounds.min.y) *
      (bounds.max.z - bounds.min.z)
    ) / 1000000000; // Convert mm³ to m³
  }

  /**
   * Calculate center of points
   */
  private calculateCenter(points: Vector3[]): Vector3 {
    const sum = { x: 0, y: 0, z: 0 };
    for (const point of points) {
      sum.x += point.x;
      sum.y += point.y;
      sum.z += point.z;
    }
    return {
      x: sum.x / points.length,
      y: sum.y / points.length,
      z: sum.z / points.length
    };
  }

  /**
   * Calculate bounding box
   */
  private calculateBounds(points: Vector3[]): BoundingBox3D {
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };

    for (const point of points) {
      min.x = Math.min(min.x, point.x);
      min.y = Math.min(min.y, point.y);
      min.z = Math.min(min.z, point.z);
      max.x = Math.max(max.x, point.x);
      max.y = Math.max(max.y, point.y);
      max.z = Math.max(max.z, point.z);
    }

    const center = {
      x: (min.x + max.x) / 2,
      y: (min.y + max.y) / 2,
      z: (min.z + max.z) / 2
    };

    const size = {
      x: max.x - min.x,
      y: max.y - min.y,
      z: max.z - min.z
    };

    return { min, max, center, size };
  }

  /**
   * Check if density is anomalous
   */
  private isAnomalousDensity(density: number, volume: number): boolean {
    // Normal air density is very low, human density is around 1000 points/m³
    // Anomalous densities fall outside normal ranges
    
    if (volume < 0.01) { // Small volume
      return density > 5000 || density < 100;
    } else if (volume < 0.1) { // Medium volume
      return density > 2000 || density < 50;
    } else { // Large volume
      return density > 1000 || density < 10;
    }
  }

  /**
   * Get detection history
   */
  getDetectionHistory(): SLSDetection[] {
    return [...this.detectionHistory];
  }

  /**
   * Get thresholds
   */
  getThresholds(): DetectionThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds
   */
  updateThresholds(thresholds: Partial<DetectionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
    logger.info('Detection thresholds updated', this.thresholds);
  }

  /**
   * Reset detector
   */
  reset(): void {
    this.backgroundModel = null;
    this.frameHistory = [];
    this.detectionHistory = [];
    this.noiseProfile = null;
    this.frameCount = 0;
    logger.info('Anomaly detector reset');
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.reset();
    this.removeAllListeners();
  }
}