/**
 * Sensitivity Controller
 * Advanced sensitivity and threshold controls for laser grid detection
 */

import { EventEmitter } from 'events';
import {
  DetectionSettings,
  GridDisturbance,
  ProcessedFrame,
  DisturbanceType,
  SystemStatus,
  PerformanceMetrics
} from '../types';
import { logger } from '../../../utils/logger';

export interface SensitivityProfile {
  id: string;
  name: string;
  description: string;
  settings: DetectionSettings;
  category: 'paranormal' | 'standard' | 'high_precision' | 'custom';
  recommended: boolean;
}

export interface AdaptiveSettings {
  enabled: boolean;
  adaptationRate: number;        // 0-1, how quickly settings adapt
  environmentalFactors: {
    lightLevel: boolean;         // Adapt based on ambient light
    noiseLevel: boolean;         // Adapt based on detected noise
    activityLevel: boolean;      // Adapt based on disturbance frequency
  };
  performanceTargets: {
    targetFrameRate: number;     // Desired FPS
    maxLatency: number;          // Maximum processing delay (ms)
    minAccuracy: number;         // Minimum detection accuracy
  };
}

export interface CalibrationData {
  baselineNoise: number;
  ambientLight: number;
  cameraGain: number;
  laserIntensity: number;
  gridAlignment: number;
  timestamp: Date;
}

export class SensitivityController extends EventEmitter {
  private settings: DetectionSettings;
  private profiles: Map<string, SensitivityProfile> = new Map();
  private adaptiveSettings: AdaptiveSettings;
  private calibrationData: CalibrationData | null = null;
  
  private performanceHistory: PerformanceMetrics[] = [];
  private detectionHistory: GridDisturbance[] = [];
  private frameHistory: ProcessedFrame[] = [];
  
  private adaptationTimer: NodeJS.Timeout | null = null;
  private isCalibrating: boolean = false;
  private currentProfile: string | null = null;

  constructor(initialSettings?: Partial<DetectionSettings>) {
    super();
    
    this.settings = {
      sensitivity: 0.5,
      minimumDisturbanceSize: 10,
      minimumDuration: 100,
      occlusionThreshold: 0.7,
      motionThreshold: 5,
      noiseReduction: 0.3,
      temporalFiltering: true,
      spatialFiltering: true,
      autoCalibration: true,
      ...initialSettings
    };

    this.adaptiveSettings = {
      enabled: false,
      adaptationRate: 0.1,
      environmentalFactors: {
        lightLevel: true,
        noiseLevel: true,
        activityLevel: true
      },
      performanceTargets: {
        targetFrameRate: 30,
        maxLatency: 50,
        minAccuracy: 0.8
      }
    };

    this.initializeProfiles();
  }

  /**
   * Initialize predefined sensitivity profiles
   */
  private initializeProfiles(): void {
    const profiles: SensitivityProfile[] = [
      {
        id: 'paranormal_low',
        name: 'Paranormal - Low Sensitivity',
        description: 'Detects only strong, clear paranormal activity. Reduces false positives.',
        category: 'paranormal',
        recommended: false,
        settings: {
          sensitivity: 0.3,
          minimumDisturbanceSize: 20,
          minimumDuration: 300,
          occlusionThreshold: 0.8,
          motionThreshold: 10,
          noiseReduction: 0.5,
          temporalFiltering: true,
          spatialFiltering: true,
          autoCalibration: true
        }
      },
      {
        id: 'paranormal_medium',
        name: 'Paranormal - Medium Sensitivity',
        description: 'Balanced detection for most paranormal investigations. Recommended starting point.',
        category: 'paranormal',
        recommended: true,
        settings: {
          sensitivity: 0.5,
          minimumDisturbanceSize: 10,
          minimumDuration: 150,
          occlusionThreshold: 0.7,
          motionThreshold: 5,
          noiseReduction: 0.3,
          temporalFiltering: true,
          spatialFiltering: true,
          autoCalibration: true
        }
      },
      {
        id: 'paranormal_high',
        name: 'Paranormal - High Sensitivity',
        description: 'Detects subtle paranormal activity. May produce more false positives.',
        category: 'paranormal',
        recommended: false,
        settings: {
          sensitivity: 0.8,
          minimumDisturbanceSize: 5,
          minimumDuration: 50,
          occlusionThreshold: 0.5,
          motionThreshold: 2,
          noiseReduction: 0.1,
          temporalFiltering: true,
          spatialFiltering: false,
          autoCalibration: true
        }
      },
      {
        id: 'standard_general',
        name: 'Standard - General Purpose',
        description: 'General-purpose motion detection for security or monitoring.',
        category: 'standard',
        recommended: false,
        settings: {
          sensitivity: 0.4,
          minimumDisturbanceSize: 15,
          minimumDuration: 200,
          occlusionThreshold: 0.6,
          motionThreshold: 8,
          noiseReduction: 0.4,
          temporalFiltering: true,
          spatialFiltering: true,
          autoCalibration: false
        }
      },
      {
        id: 'precision_lab',
        name: 'High Precision - Laboratory',
        description: 'Maximum precision for controlled laboratory environments.',
        category: 'high_precision',
        recommended: false,
        settings: {
          sensitivity: 0.9,
          minimumDisturbanceSize: 2,
          minimumDuration: 25,
          occlusionThreshold: 0.3,
          motionThreshold: 1,
          noiseReduction: 0.05,
          temporalFiltering: false,
          spatialFiltering: false,
          autoCalibration: false
        }
      }
    ];

    for (const profile of profiles) {
      this.profiles.set(profile.id, profile);
    }
  }

  /**
   * Apply sensitivity profile
   */
  applyProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      logger.error(`Sensitivity profile not found: ${profileId}`);
      return false;
    }

    const oldSettings = { ...this.settings };
    this.settings = { ...profile.settings };
    this.currentProfile = profileId;

    this.emit('profile-applied', {
      profileId,
      profile,
      oldSettings,
      newSettings: this.settings
    });

    logger.info(`Applied sensitivity profile: ${profile.name}`);
    return true;
  }

  /**
   * Update individual setting
   */
  updateSetting<K extends keyof DetectionSettings>(
    setting: K, 
    value: DetectionSettings[K]
  ): void {
    const oldValue = this.settings[setting];
    this.settings[setting] = value;
    
    // Clear current profile if custom changes are made
    if (this.currentProfile) {
      this.currentProfile = null;
    }

    this.emit('setting-changed', {
      setting,
      oldValue,
      newValue: value,
      allSettings: this.settings
    });

    logger.info(`Updated setting ${setting}: ${oldValue} -> ${value}`);
  }

  /**
   * Update multiple settings
   */
  updateSettings(newSettings: Partial<DetectionSettings>): void {
    const oldSettings = { ...this.settings };
    this.settings = { ...this.settings, ...newSettings };
    
    // Clear current profile
    this.currentProfile = null;

    this.emit('settings-changed', {
      oldSettings,
      newSettings: this.settings,
      changes: newSettings
    });

    logger.info('Updated multiple settings', newSettings);
  }

  /**
   * Start adaptive mode
   */
  startAdaptiveMode(): void {
    if (this.adaptiveSettings.enabled) {
      logger.warn('Adaptive mode already enabled');
      return;
    }

    this.adaptiveSettings.enabled = true;
    
    // Start adaptation timer
    this.adaptationTimer = setInterval(() => {
      this.performAdaptation();
    }, 5000); // Adapt every 5 seconds

    this.emit('adaptive-mode-started');
    logger.info('Started adaptive sensitivity mode');
  }

  /**
   * Stop adaptive mode
   */
  stopAdaptiveMode(): void {
    if (!this.adaptiveSettings.enabled) return;

    this.adaptiveSettings.enabled = false;
    
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }

    this.emit('adaptive-mode-stopped');
    logger.info('Stopped adaptive sensitivity mode');
  }

  /**
   * Perform adaptation based on current conditions
   */
  private performAdaptation(): void {
    if (!this.adaptiveSettings.enabled) return;

    const recentFrames = this.frameHistory.slice(-30); // Last 30 frames
    const recentDisturbances = this.detectionHistory.slice(-50); // Last 50 disturbances
    const recentPerformance = this.performanceHistory.slice(-10); // Last 10 performance samples

    if (recentFrames.length < 10) return; // Need enough data

    const adaptations: Partial<DetectionSettings> = {};
    const adaptationRate = this.adaptiveSettings.adaptationRate;

    // Adapt based on detection frequency
    if (this.adaptiveSettings.environmentalFactors.activityLevel) {
      const avgDisturbancesPerFrame = recentDisturbances.length / recentFrames.length;
      
      if (avgDisturbancesPerFrame > 0.5) {
        // Too many detections - reduce sensitivity
        adaptations.sensitivity = Math.max(0.1, this.settings.sensitivity - adaptationRate * 0.1);
        adaptations.minimumDisturbanceSize = Math.min(50, this.settings.minimumDisturbanceSize + 2);
      } else if (avgDisturbancesPerFrame < 0.1) {
        // Too few detections - increase sensitivity
        adaptations.sensitivity = Math.min(0.9, this.settings.sensitivity + adaptationRate * 0.1);
        adaptations.minimumDisturbanceSize = Math.max(2, this.settings.minimumDisturbanceSize - 1);
      }
    }

    // Adapt based on performance
    if (recentPerformance.length > 0) {
      const avgFrameRate = recentPerformance.reduce((sum, p) => sum + p.frameRate, 0) / recentPerformance.length;
      const avgLatency = recentPerformance.reduce((sum, p) => sum + p.processingLatency, 0) / recentPerformance.length;

      if (avgFrameRate < this.adaptiveSettings.performanceTargets.targetFrameRate * 0.8) {
        // Performance issues - reduce quality for speed
        adaptations.spatialFiltering = false;
        adaptations.noiseReduction = Math.max(0, this.settings.noiseReduction - 0.1);
      }

      if (avgLatency > this.adaptiveSettings.performanceTargets.maxLatency) {
        // High latency - simplify processing
        adaptations.temporalFiltering = false;
        adaptations.minimumDisturbanceSize = Math.min(20, this.settings.minimumDisturbanceSize + 3);
      }
    }

    // Adapt based on noise level
    if (this.adaptiveSettings.environmentalFactors.noiseLevel && this.calibrationData) {
      const currentNoise = this.estimateCurrentNoise(recentFrames);
      const baselineNoise = this.calibrationData.baselineNoise;
      
      if (currentNoise > baselineNoise * 1.5) {
        // High noise environment
        adaptations.noiseReduction = Math.min(0.8, this.settings.noiseReduction + 0.1);
        adaptations.minimumDisturbanceSize = Math.min(30, this.settings.minimumDisturbanceSize + 2);
      }
    }

    // Apply adaptations
    if (Object.keys(adaptations).length > 0) {
      this.updateSettings(adaptations);
      
      this.emit('adaptation-performed', {
        adaptations,
        reason: 'environmental_conditions',
        timestamp: Date.now()
      });

      logger.info('Performed adaptive sensitivity adjustment', adaptations);
    }
  }

  /**
   * Estimate current noise level
   */
  private estimateCurrentNoise(frames: ProcessedFrame[]): number {
    if (frames.length === 0) return 0;

    // Calculate average number of detected dots that aren't matched
    let totalUnmatchedDots = 0;
    let frameCount = 0;

    for (const frame of frames) {
      const unmatchedDots = frame.detectedDots.filter(dot => !dot.matched).length;
      totalUnmatchedDots += unmatchedDots;
      frameCount++;
    }

    return frameCount > 0 ? totalUnmatchedDots / frameCount : 0;
  }

  /**
   * Start calibration process
   */
  async startCalibration(): Promise<void> {
    if (this.isCalibrating) {
      throw new Error('Calibration already in progress');
    }

    this.isCalibrating = true;
    this.emit('calibration-started');
    logger.info('Starting sensitivity calibration');

    try {
      // Collect baseline measurements
      await this.collectBaseline();
      
      // Test different sensitivity levels
      await this.testSensitivityLevels();
      
      // Calculate optimal settings
      const optimalSettings = this.calculateOptimalSettings();
      
      // Apply optimal settings
      this.updateSettings(optimalSettings);
      
      this.calibrationData = {
        baselineNoise: this.estimateCurrentNoise(this.frameHistory.slice(-10)),
        ambientLight: 0, // Would be measured from camera
        cameraGain: 1.0, // Would be read from camera settings
        laserIntensity: 1.0, // Would be read from projector
        gridAlignment: 0.8, // Would be calculated from grid alignment
        timestamp: new Date()
      };

      this.emit('calibration-completed', {
        calibrationData: this.calibrationData,
        optimalSettings
      });

      logger.info('Calibration completed successfully');

    } catch (error) {
      this.emit('calibration-failed', error);
      logger.error('Calibration failed', error);
      throw error;
    } finally {
      this.isCalibrating = false;
    }
  }

  /**
   * Collect baseline measurements
   */
  private async collectBaseline(): Promise<void> {
    // This would collect baseline measurements from the system
    // For now, we'll simulate with a delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.emit('calibration-progress', {
      step: 'baseline',
      progress: 0.2,
      message: 'Collecting baseline measurements'
    });
  }

  /**
   * Test different sensitivity levels
   */
  private async testSensitivityLevels(): Promise<void> {
    const testLevels = [0.1, 0.3, 0.5, 0.7, 0.9];
    
    for (let i = 0; i < testLevels.length; i++) {
      const level = testLevels[i];
      
      // Temporarily apply test settings
      const testSettings: Partial<DetectionSettings> = {
        sensitivity: level,
        minimumDisturbanceSize: Math.round(20 - level * 15),
        motionThreshold: Math.round(10 - level * 8)
      };
      
      this.updateSettings(testSettings);
      
      // Simulate testing period
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.emit('calibration-progress', {
        step: 'testing',
        progress: 0.2 + (i + 1) / testLevels.length * 0.6,
        message: `Testing sensitivity level ${level}`
      });
    }
  }

  /**
   * Calculate optimal settings
   */
  private calculateOptimalSettings(): Partial<DetectionSettings> {
    // This would analyze the test results and calculate optimal settings
    // For now, return medium sensitivity settings
    
    this.emit('calibration-progress', {
      step: 'optimization',
      progress: 0.9,
      message: 'Calculating optimal settings'
    });

    return {
      sensitivity: 0.5,
      minimumDisturbanceSize: 10,
      minimumDuration: 150,
      occlusionThreshold: 0.7,
      motionThreshold: 5,
      noiseReduction: 0.3
    };
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceHistory.push({
      ...metrics,
      // Add timestamp if not present
      ...(metrics as any).timestamp ? {} : { timestamp: Date.now() }
    });

    // Limit history size
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    // Check if adaptive adjustment is needed
    if (this.adaptiveSettings.enabled) {
      this.checkPerformanceThresholds(metrics);
    }
  }

  /**
   * Check performance thresholds
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const targets = this.adaptiveSettings.performanceTargets;
    
    if (metrics.frameRate < targets.targetFrameRate * 0.7) {
      this.emit('performance-warning', {
        type: 'low_framerate',
        current: metrics.frameRate,
        target: targets.targetFrameRate,
        suggestion: 'Consider reducing detection quality or sensitivity'
      });
    }

    if (metrics.processingLatency > targets.maxLatency * 1.5) {
      this.emit('performance-warning', {
        type: 'high_latency',
        current: metrics.processingLatency,
        target: targets.maxLatency,
        suggestion: 'Consider disabling advanced filters or reducing sensitivity'
      });
    }

    if (metrics.detectionAccuracy < targets.minAccuracy) {
      this.emit('performance-warning', {
        type: 'low_accuracy',
        current: metrics.detectionAccuracy,
        target: targets.minAccuracy,
        suggestion: 'Consider recalibrating or adjusting thresholds'
      });
    }
  }

  /**
   * Update frame history for analysis
   */
  updateFrameHistory(frame: ProcessedFrame): void {
    this.frameHistory.push(frame);
    
    // Limit history size
    if (this.frameHistory.length > 100) {
      this.frameHistory.shift();
    }

    // Update detection history
    for (const disturbance of frame.disturbances) {
      this.detectionHistory.push(disturbance);
    }

    // Limit detection history
    if (this.detectionHistory.length > 200) {
      this.detectionHistory.splice(0, this.detectionHistory.length - 200);
    }
  }

  /**
   * Create custom profile from current settings
   */
  createCustomProfile(name: string, description: string): SensitivityProfile {
    const profile: SensitivityProfile = {
      id: `custom_${Date.now()}`,
      name,
      description,
      category: 'custom',
      recommended: false,
      settings: { ...this.settings }
    };

    this.profiles.set(profile.id, profile);
    
    this.emit('profile-created', profile);
    logger.info(`Created custom profile: ${name}`);

    return profile;
  }

  /**
   * Delete custom profile
   */
  deleteProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    
    if (!profile) return false;
    if (profile.category !== 'custom') {
      throw new Error('Cannot delete built-in profile');
    }

    this.profiles.delete(profileId);
    
    if (this.currentProfile === profileId) {
      this.currentProfile = null;
    }

    this.emit('profile-deleted', profileId);
    logger.info(`Deleted custom profile: ${profile.name}`);

    return true;
  }

  /**
   * Get all available profiles
   */
  getProfiles(): SensitivityProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profile by ID
   */
  getProfile(profileId: string): SensitivityProfile | undefined {
    return this.profiles.get(profileId);
  }

  /**
   * Get current settings
   */
  getSettings(): DetectionSettings {
    return { ...this.settings };
  }

  /**
   * Get current profile ID
   */
  getCurrentProfileId(): string | null {
    return this.currentProfile;
  }

  /**
   * Get adaptive settings
   */
  getAdaptiveSettings(): AdaptiveSettings {
    return { ...this.adaptiveSettings };
  }

  /**
   * Update adaptive settings
   */
  updateAdaptiveSettings(newSettings: Partial<AdaptiveSettings>): void {
    this.adaptiveSettings = { ...this.adaptiveSettings, ...newSettings };
    
    this.emit('adaptive-settings-changed', this.adaptiveSettings);
    logger.info('Updated adaptive settings', newSettings);
  }

  /**
   * Get calibration data
   */
  getCalibrationData(): CalibrationData | null {
    return this.calibrationData;
  }

  /**
   * Export settings to JSON
   */
  exportSettings(): string {
    return JSON.stringify({
      settings: this.settings,
      currentProfile: this.currentProfile,
      adaptiveSettings: this.adaptiveSettings,
      calibrationData: this.calibrationData,
      customProfiles: Array.from(this.profiles.entries())
        .filter(([_, profile]) => profile.category === 'custom')
        .map(([id, profile]) => ({ id, profile }))
    }, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(json: string): void {
    try {
      const data = JSON.parse(json);
      
      if (data.settings) {
        this.updateSettings(data.settings);
      }

      if (data.adaptiveSettings) {
        this.updateAdaptiveSettings(data.adaptiveSettings);
      }

      if (data.calibrationData) {
        this.calibrationData = {
          ...data.calibrationData,
          timestamp: new Date(data.calibrationData.timestamp)
        };
      }

      if (data.customProfiles) {
        for (const { id, profile } of data.customProfiles) {
          this.profiles.set(id, profile);
        }
      }

      if (data.currentProfile && this.profiles.has(data.currentProfile)) {
        this.applyProfile(data.currentProfile);
      }

      this.emit('settings-imported', data);
      logger.info('Settings imported successfully');

    } catch (error) {
      logger.error('Failed to import settings', error);
      throw new Error(`Failed to import settings: ${error}`);
    }
  }

  /**
   * Reset to default settings
   */
  resetToDefaults(): void {
    const defaultProfile = this.profiles.get('paranormal_medium');
    
    if (defaultProfile) {
      this.applyProfile('paranormal_medium');
    } else {
      // Fallback to hardcoded defaults
      this.updateSettings({
        sensitivity: 0.5,
        minimumDisturbanceSize: 10,
        minimumDuration: 150,
        occlusionThreshold: 0.7,
        motionThreshold: 5,
        noiseReduction: 0.3,
        temporalFiltering: true,
        spatialFiltering: true,
        autoCalibration: true
      });
    }

    this.stopAdaptiveMode();
    this.calibrationData = null;
    
    this.emit('settings-reset');
    logger.info('Settings reset to defaults');
  }

  /**
   * Get system status
   */
  getSystemStatus(): SystemStatus {
    const recentPerformance = this.performanceHistory.slice(-5);
    const avgPerformance: PerformanceMetrics = recentPerformance.length > 0 ? {
      frameRate: recentPerformance.reduce((sum, p) => sum + p.frameRate, 0) / recentPerformance.length,
      processingLatency: recentPerformance.reduce((sum, p) => sum + p.processingLatency, 0) / recentPerformance.length,
      cpuUsage: recentPerformance.reduce((sum, p) => sum + p.cpuUsage, 0) / recentPerformance.length,
      memoryUsage: recentPerformance.reduce((sum, p) => sum + p.memoryUsage, 0) / recentPerformance.length,
      detectionAccuracy: recentPerformance.reduce((sum, p) => sum + p.detectionAccuracy, 0) / recentPerformance.length
    } : {
      frameRate: 0,
      processingLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      detectionAccuracy: 0
    };

    return {
      projector: 'connected' as any, // Would be determined by actual projector status
      camera: 'connected',
      detection: this.isCalibrating ? 'paused' : 'active',
      recording: 'stopped',
      lastUpdate: new Date(),
      performance: avgPerformance
    };
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopAdaptiveMode();
    
    if (this.adaptationTimer) {
      clearInterval(this.adaptationTimer);
      this.adaptationTimer = null;
    }

    this.performanceHistory = [];
    this.detectionHistory = [];
    this.frameHistory = [];
    
    this.removeAllListeners();
  }
}