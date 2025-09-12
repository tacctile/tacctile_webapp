/**
 * Skeletal Tracking System
 * Advanced skeleton tracking with smoothing and prediction
 */

import { EventEmitter } from 'events';
import {
  Skeleton,
  Joint,
  JointType,
  Vector3,
  Quaternion,
  TrackingConfig,
  GestureEvent,
  BoundingBox3D
} from '../types';
import { logger } from '../../../utils/logger';

interface TrackedSkeleton {
  current: Skeleton;
  history: Skeleton[];
  velocity: Map<JointType, Vector3>;
  gestureState: Map<string, any>;
  lastUpdate: number;
  missedFrames: number;
}

export class SkeletalTracker extends EventEmitter {
  private config: TrackingConfig;
  private trackedSkeletons: Map<number, TrackedSkeleton> = new Map();
  private frameCount = 0;
  private gestureDetectors: Map<string, GestureDetector> = new Map();

  constructor(config?: Partial<TrackingConfig>) {
    super();
    
    this.config = {
      sensitivity: 0.7,
      minConfidence: 0.5,
      maxTrackingDistance: 4.5,
      smoothing: 0.5,
      predictionFrames: 2,
      skeletonTracking: true,
      gestureRecognition: true,
      faceTracking: false,
      ...config
    };

    this.initializeGestureDetectors();
  }

  /**
   * Initialize gesture detectors
   */
  private initializeGestureDetectors(): void {
    this.gestureDetectors.set('wave', new WaveGestureDetector());
    this.gestureDetectors.set('swipe', new SwipeGestureDetector());
    this.gestureDetectors.set('push', new PushGestureDetector());
    this.gestureDetectors.set('circle', new CircleGestureDetector());
  }

  /**
   * Process new skeleton frame
   */
  processSkeleton(skeleton: Skeleton): void {
    if (!this.config.skeletonTracking) return;

    // Check confidence threshold
    if (skeleton.confidence < this.config.minConfidence) {
      return;
    }

    // Get or create tracked skeleton
    let tracked = this.trackedSkeletons.get(skeleton.id);
    
    if (!tracked) {
      tracked = this.createTrackedSkeleton(skeleton);
      this.trackedSkeletons.set(skeleton.id, tracked);
      this.emit('skeleton-detected', skeleton);
    } else {
      // Update existing skeleton
      this.updateTrackedSkeleton(tracked, skeleton);
    }

    // Apply smoothing
    if (this.config.smoothing > 0) {
      this.applySmoothingFilter(tracked);
    }

    // Calculate velocities
    this.calculateVelocities(tracked);

    // Predict future positions if configured
    if (this.config.predictionFrames > 0) {
      this.predictFuturePositions(tracked);
    }

    // Detect gestures
    if (this.config.gestureRecognition) {
      this.detectGestures(tracked);
    }

    // Update skeleton data
    tracked.lastUpdate = Date.now();
    tracked.missedFrames = 0;

    // Emit updated skeleton
    this.emit('skeleton-updated', tracked.current);
    
    this.frameCount++;
  }

  /**
   * Create new tracked skeleton
   */
  private createTrackedSkeleton(skeleton: Skeleton): TrackedSkeleton {
    const velocity = new Map<JointType, Vector3>();
    
    // Initialize velocities
    for (const joint of skeleton.joints) {
      velocity.set(joint.type, { x: 0, y: 0, z: 0 });
    }

    return {
      current: skeleton,
      history: [skeleton],
      velocity,
      gestureState: new Map(),
      lastUpdate: Date.now(),
      missedFrames: 0
    };
  }

  /**
   * Update tracked skeleton
   */
  private updateTrackedSkeleton(tracked: TrackedSkeleton, newSkeleton: Skeleton): void {
    // Add to history
    tracked.history.push(newSkeleton);
    
    // Limit history size
    if (tracked.history.length > 30) {
      tracked.history.shift();
    }

    // Check for tracking jumps
    if (this.detectTrackingJump(tracked.current, newSkeleton)) {
      logger.warn(`Tracking jump detected for skeleton ${newSkeleton.id}`);
      // Reset history if jump is too large
      if (this.isTrackingJumpTooLarge(tracked.current, newSkeleton)) {
        tracked.history = [newSkeleton];
      }
    }

    tracked.current = newSkeleton;
  }

  /**
   * Apply smoothing filter
   */
  private applySmoothingFilter(tracked: TrackedSkeleton): void {
    const alpha = this.config.smoothing;
    const current = tracked.current;
    const previous = tracked.history[tracked.history.length - 2];

    if (!previous) return;

    // Smooth each joint position
    for (let i = 0; i < current.joints.length; i++) {
      const currJoint = current.joints[i];
      const prevJoint = previous.joints.find(j => j.type === currJoint.type);

      if (prevJoint && currJoint.tracked && prevJoint.tracked) {
        // Exponential moving average
        currJoint.position.x = alpha * prevJoint.position.x + (1 - alpha) * currJoint.position.x;
        currJoint.position.y = alpha * prevJoint.position.y + (1 - alpha) * currJoint.position.y;
        currJoint.position.z = alpha * prevJoint.position.z + (1 - alpha) * currJoint.position.z;

        // Smooth orientation if available
        if (currJoint.orientation && prevJoint.orientation) {
          currJoint.orientation = this.slerpQuaternion(
            prevJoint.orientation,
            currJoint.orientation,
            1 - alpha
          );
        }
      }
    }
  }

  /**
   * Calculate joint velocities
   */
  private calculateVelocities(tracked: TrackedSkeleton): void {
    if (tracked.history.length < 2) return;

    const current = tracked.current;
    const previous = tracked.history[tracked.history.length - 2];
    const deltaTime = (current.timestamp - previous.timestamp) / 1000; // Convert to seconds

    if (deltaTime <= 0) return;

    for (const currJoint of current.joints) {
      const prevJoint = previous.joints.find(j => j.type === currJoint.type);
      
      if (prevJoint && currJoint.tracked && prevJoint.tracked) {
        const velocity: Vector3 = {
          x: (currJoint.position.x - prevJoint.position.x) / deltaTime,
          y: (currJoint.position.y - prevJoint.position.y) / deltaTime,
          z: (currJoint.position.z - prevJoint.position.z) / deltaTime
        };

        // Apply low-pass filter to velocity
        const prevVelocity = tracked.velocity.get(currJoint.type);
        if (prevVelocity) {
          const smoothing = 0.3;
          velocity.x = smoothing * prevVelocity.x + (1 - smoothing) * velocity.x;
          velocity.y = smoothing * prevVelocity.y + (1 - smoothing) * velocity.y;
          velocity.z = smoothing * prevVelocity.z + (1 - smoothing) * velocity.z;
        }

        tracked.velocity.set(currJoint.type, velocity);
      }
    }
  }

  /**
   * Predict future positions
   */
  private predictFuturePositions(tracked: TrackedSkeleton): void {
    const frameTime = 1 / 30; // Assume 30 FPS
    const predictionTime = frameTime * this.config.predictionFrames;

    for (const joint of tracked.current.joints) {
      const velocity = tracked.velocity.get(joint.type);
      
      if (velocity && joint.tracked) {
        // Simple linear prediction
        const predictedPosition: Vector3 = {
          x: joint.position.x + velocity.x * predictionTime,
          y: joint.position.y + velocity.y * predictionTime,
          z: joint.position.z + velocity.z * predictionTime
        };

        // Store prediction (could be used for visualization)
        (joint as any).predictedPosition = predictedPosition;
      }
    }
  }

  /**
   * Detect gestures
   */
  private detectGestures(tracked: TrackedSkeleton): void {
    for (const [name, detector] of this.gestureDetectors) {
      const gesture = detector.detect(tracked);
      
      if (gesture) {
        this.emit('gesture', gesture);
        logger.info(`Gesture detected: ${gesture.type} (${gesture.hand})`);
      }
    }
  }

  /**
   * Detect tracking jump
   */
  private detectTrackingJump(prev: Skeleton, curr: Skeleton): boolean {
    // Check if skeleton moved too fast (potential tracking error)
    const maxSpeed = 2000; // mm per frame at 30fps
    
    for (const currJoint of curr.joints) {
      const prevJoint = prev.joints.find(j => j.type === currJoint.type);
      
      if (prevJoint && currJoint.tracked && prevJoint.tracked) {
        const distance = this.calculateDistance(prevJoint.position, currJoint.position);
        
        if (distance > maxSpeed) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Check if tracking jump is too large
   */
  private isTrackingJumpTooLarge(prev: Skeleton, curr: Skeleton): boolean {
    if (!prev.centerOfMass || !curr.centerOfMass) return false;
    
    const distance = this.calculateDistance(prev.centerOfMass, curr.centerOfMass);
    return distance > this.config.maxTrackingDistance * 1000; // Convert to mm
  }

  /**
   * Calculate distance between points
   */
  private calculateDistance(p1: Vector3, p2: Vector3): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Spherical linear interpolation for quaternions
   */
  private slerpQuaternion(q1: Quaternion, q2: Quaternion, t: number): Quaternion {
    let dot = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;
    
    // Ensure shortest path
    if (dot < 0) {
      q2 = { x: -q2.x, y: -q2.y, z: -q2.z, w: -q2.w };
      dot = -dot;
    }
    
    // Clamp dot product
    dot = Math.min(Math.max(dot, -1), 1);
    
    const theta = Math.acos(dot);
    const sinTheta = Math.sin(theta);
    
    if (sinTheta < 0.001) {
      // Linear interpolation for small angles
      return {
        x: q1.x * (1 - t) + q2.x * t,
        y: q1.y * (1 - t) + q2.y * t,
        z: q1.z * (1 - t) + q2.z * t,
        w: q1.w * (1 - t) + q2.w * t
      };
    }
    
    const a = Math.sin((1 - t) * theta) / sinTheta;
    const b = Math.sin(t * theta) / sinTheta;
    
    return {
      x: q1.x * a + q2.x * b,
      y: q1.y * a + q2.y * b,
      z: q1.z * a + q2.z * b,
      w: q1.w * a + q2.w * b
    };
  }

  /**
   * Update tracking configuration
   */
  updateConfig(config: Partial<TrackingConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Tracking config updated', this.config);
  }

  /**
   * Get tracked skeletons
   */
  getTrackedSkeletons(): Skeleton[] {
    const skeletons: Skeleton[] = [];
    
    for (const tracked of this.trackedSkeletons.values()) {
      if (Date.now() - tracked.lastUpdate < 1000) {
        skeletons.push(tracked.current);
      }
    }
    
    return skeletons;
  }

  /**
   * Clean up lost skeletons
   */
  cleanupLostSkeletons(): void {
    const now = Date.now();
    const timeout = 2000; // 2 seconds
    
    for (const [id, tracked] of this.trackedSkeletons.entries()) {
      if (now - tracked.lastUpdate > timeout) {
        this.trackedSkeletons.delete(id);
        this.emit('skeleton-lost', id);
        logger.info(`Lost skeleton ${id}`);
      }
    }
  }

  /**
   * Reset tracker
   */
  reset(): void {
    this.trackedSkeletons.clear();
    this.frameCount = 0;
    logger.info('Skeletal tracker reset');
  }

  /**
   * Get statistics
   */
  getStatistics(): any {
    return {
      trackedSkeletons: this.trackedSkeletons.size,
      frameCount: this.frameCount,
      config: this.config
    };
  }
}

/**
 * Base gesture detector
 */
abstract class GestureDetector {
  abstract detect(tracked: TrackedSkeleton): GestureEvent | null;
  
  protected getJointVelocityMagnitude(tracked: TrackedSkeleton, jointType: JointType): number {
    const velocity = tracked.velocity.get(jointType);
    if (!velocity) return 0;
    
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y + velocity.z * velocity.z);
  }
}

/**
 * Wave gesture detector
 */
class WaveGestureDetector extends GestureDetector {
  detect(tracked: TrackedSkeleton): GestureEvent | null {
    const skeleton = tracked.current;
    
    // Check right hand wave
    const rightHand = skeleton.joints.find(j => j.type === JointType.HAND_RIGHT);
    const rightElbow = skeleton.joints.find(j => j.type === JointType.ELBOW_RIGHT);
    const rightShoulder = skeleton.joints.find(j => j.type === JointType.SHOULDER_RIGHT);
    
    if (rightHand?.tracked && rightElbow?.tracked && rightShoulder?.tracked) {
      // Hand above elbow
      if (rightHand.position.y > rightElbow.position.y + 100) {
        // Check for horizontal movement
        const velocity = tracked.velocity.get(JointType.HAND_RIGHT);
        if (velocity && Math.abs(velocity.x) > 200) {
          return {
            type: 'wave',
            hand: 'right',
            direction: { x: velocity.x > 0 ? 1 : -1, y: 0, z: 0 },
            confidence: 0.8,
            timestamp: Date.now(),
            skeletonId: skeleton.id
          };
        }
      }
    }
    
    // Check left hand wave (similar logic)
    const leftHand = skeleton.joints.find(j => j.type === JointType.HAND_LEFT);
    const leftElbow = skeleton.joints.find(j => j.type === JointType.ELBOW_LEFT);
    
    if (leftHand?.tracked && leftElbow?.tracked) {
      if (leftHand.position.y > leftElbow.position.y + 100) {
        const velocity = tracked.velocity.get(JointType.HAND_LEFT);
        if (velocity && Math.abs(velocity.x) > 200) {
          return {
            type: 'wave',
            hand: 'left',
            direction: { x: velocity.x > 0 ? 1 : -1, y: 0, z: 0 },
            confidence: 0.8,
            timestamp: Date.now(),
            skeletonId: skeleton.id
          };
        }
      }
    }
    
    return null;
  }
}

/**
 * Swipe gesture detector
 */
class SwipeGestureDetector extends GestureDetector {
  detect(tracked: TrackedSkeleton): GestureEvent | null {
    const skeleton = tracked.current;
    
    // Check for horizontal swipe
    for (const hand of ['right', 'left'] as const) {
      const handType = hand === 'right' ? JointType.HAND_RIGHT : JointType.HAND_LEFT;
      const handJoint = skeleton.joints.find(j => j.type === handType);
      
      if (handJoint?.tracked) {
        const velocity = tracked.velocity.get(handType);
        
        if (velocity) {
          const speed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
          
          if (speed > 500) { // Fast horizontal movement
            return {
              type: 'swipe',
              hand,
              direction: {
                x: velocity.x / speed,
                y: 0,
                z: velocity.z / speed
              },
              confidence: Math.min(speed / 1000, 1),
              timestamp: Date.now(),
              skeletonId: skeleton.id
            };
          }
        }
      }
    }
    
    return null;
  }
}

/**
 * Push gesture detector
 */
class PushGestureDetector extends GestureDetector {
  detect(tracked: TrackedSkeleton): GestureEvent | null {
    const skeleton = tracked.current;
    
    for (const hand of ['right', 'left'] as const) {
      const handType = hand === 'right' ? JointType.HAND_RIGHT : JointType.HAND_LEFT;
      const handJoint = skeleton.joints.find(j => j.type === handType);
      
      if (handJoint?.tracked) {
        const velocity = tracked.velocity.get(handType);
        
        if (velocity && velocity.z < -300) { // Moving away from sensor
          return {
            type: 'push',
            hand,
            direction: { x: 0, y: 0, z: -1 },
            confidence: Math.min(Math.abs(velocity.z) / 500, 1),
            timestamp: Date.now(),
            skeletonId: skeleton.id
          };
        } else if (velocity && velocity.z > 300) { // Pull gesture
          return {
            type: 'pull',
            hand,
            direction: { x: 0, y: 0, z: 1 },
            confidence: Math.min(velocity.z / 500, 1),
            timestamp: Date.now(),
            skeletonId: skeleton.id
          };
        }
      }
    }
    
    return null;
  }
}

/**
 * Circle gesture detector
 */
class CircleGestureDetector extends GestureDetector {
  private handHistory: Map<JointType, Vector3[]> = new Map();
  
  detect(tracked: TrackedSkeleton): GestureEvent | null {
    const skeleton = tracked.current;
    
    for (const hand of ['right', 'left'] as const) {
      const handType = hand === 'right' ? JointType.HAND_RIGHT : JointType.HAND_LEFT;
      const handJoint = skeleton.joints.find(j => j.type === handType);
      
      if (handJoint?.tracked) {
        // Update history
        let history = this.handHistory.get(handType);
        if (!history) {
          history = [];
          this.handHistory.set(handType, history);
        }
        
        history.push({ ...handJoint.position });
        
        // Keep last 30 frames (1 second at 30fps)
        if (history.length > 30) {
          history.shift();
        }
        
        // Check for circular motion
        if (history.length >= 20) {
          if (this.isCircularMotion(history)) {
            // Clear history after detection
            this.handHistory.set(handType, []);
            
            return {
              type: 'circle',
              hand,
              confidence: 0.7,
              timestamp: Date.now(),
              skeletonId: skeleton.id
            };
          }
        }
      }
    }
    
    return null;
  }
  
  private isCircularMotion(points: Vector3[]): boolean {
    if (points.length < 20) return false;
    
    // Calculate center point
    let centerX = 0, centerY = 0;
    for (const point of points) {
      centerX += point.x;
      centerY += point.y;
    }
    centerX /= points.length;
    centerY /= points.length;
    
    // Calculate average radius
    let avgRadius = 0;
    for (const point of points) {
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      avgRadius += Math.sqrt(dx * dx + dy * dy);
    }
    avgRadius /= points.length;
    
    // Check if points form a circle
    let variance = 0;
    for (const point of points) {
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const radius = Math.sqrt(dx * dx + dy * dy);
      variance += Math.pow(radius - avgRadius, 2);
    }
    variance /= points.length;
    
    // Low variance indicates circular motion
    return variance < (avgRadius * 0.3) ** 2 && avgRadius > 50;
  }
}