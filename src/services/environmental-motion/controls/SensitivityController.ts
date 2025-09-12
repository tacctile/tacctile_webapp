import { EventEmitter } from 'events';
import {
  SensitivitySettings,
  MotionDetectionSettings,
  EMFVisualizationSettings,
  AudioVisualizationSettings,
  EMFFrequencyBand,
  AudioFrequencyBand,
  EnvironmentalSensor,
  DETECTION_PRESETS
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('SensitivityController');

export class SensitivityController extends EventEmitter {
  private settings: SensitivitySettings;
  private presets: Map<string, SensitivityPreset>;
  private adaptiveMode: boolean = false;
  private adaptiveHistory: AdaptiveData[] = [];
  private calibrationData: CalibrationData | null = null;
  private environmentalFactors: EnvironmentalFactors;

  constructor(initialSettings?: Partial<SensitivitySettings>) {
    super();
    
    this.settings = this.initializeDefaultSettings(initialSettings);
    this.presets = new Map();
    this.environmentalFactors = {
      temperature: 20,
      humidity: 50,
      pressure: 1013,
      lightLevel: 500,
      noiseLevel: 35,
      vibrationLevel: 0.1
    };
    
    this.loadDefaultPresets();
  }

  private initializeDefaultSettings(initial?: Partial<SensitivitySettings>): SensitivitySettings {
    const defaultSettings: SensitivitySettings = {
      motion: {
        general: 50,
        spatial: 60,
        temporal: 55,
        objectSize: {
          minimum: 25,
          maximum: 5000
        }
      },
      emf: {
        [EMFFrequencyBand.ELF]: { threshold: 0.1, sensitivity: 70 },
        [EMFFrequencyBand.SLF]: { threshold: 0.2, sensitivity: 65 },
        [EMFFrequencyBand.ULF]: { threshold: 0.3, sensitivity: 60 },
        [EMFFrequencyBand.VLF]: { threshold: 0.5, sensitivity: 55 },
        [EMFFrequencyBand.LF]: { threshold: 1.0, sensitivity: 50 },
        [EMFFrequencyBand.MF]: { threshold: 2.0, sensitivity: 45 },
        [EMFFrequencyBand.HF]: { threshold: 5.0, sensitivity: 40 },
        [EMFFrequencyBand.VHF]: { threshold: 10.0, sensitivity: 35 },
        [EMFFrequencyBand.UHF]: { threshold: 20.0, sensitivity: 30 },
        [EMFFrequencyBand.MICROWAVE]: { threshold: 50.0, sensitivity: 25 }
      },
      audio: {
        [AudioFrequencyBand.INFRASONIC]: { threshold: -40, sensitivity: 80 },
        [AudioFrequencyBand.LOW_BASS]: { threshold: -35, sensitivity: 60 },
        [AudioFrequencyBand.BASS]: { threshold: -30, sensitivity: 50 },
        [AudioFrequencyBand.LOW_MIDRANGE]: { threshold: -25, sensitivity: 45 },
        [AudioFrequencyBand.MIDRANGE]: { threshold: -20, sensitivity: 40 },
        [AudioFrequencyBand.HIGH_MIDRANGE]: { threshold: -25, sensitivity: 45 },
        [AudioFrequencyBand.PRESENCE]: { threshold: -30, sensitivity: 50 },
        [AudioFrequencyBand.BRILLIANCE]: { threshold: -35, sensitivity: 60 },
        [AudioFrequencyBand.ULTRASONIC]: { threshold: -45, sensitivity: 85 }
      },
      environmental: {
        [EnvironmentalSensor.TEMPERATURE]: { threshold: 0.5, sensitivity: 70 },
        [EnvironmentalSensor.HUMIDITY]: { threshold: 2.0, sensitivity: 60 },
        [EnvironmentalSensor.PRESSURE]: { threshold: 5.0, sensitivity: 55 },
        [EnvironmentalSensor.VIBRATION]: { threshold: 0.01, sensitivity: 75 },
        [EnvironmentalSensor.SEISMIC]: { threshold: 0.005, sensitivity: 80 },
        [EnvironmentalSensor.MAGNETIC]: { threshold: 0.1, sensitivity: 65 },
        [EnvironmentalSensor.ELECTRIC_FIELD]: { threshold: 10.0, sensitivity: 70 },
        [EnvironmentalSensor.GRAVITY]: { threshold: 0.001, sensitivity: 90 },
        [EnvironmentalSensor.RADIATION]: { threshold: 0.1, sensitivity: 85 },
        [EnvironmentalSensor.AIR_QUALITY]: { threshold: 10.0, sensitivity: 50 }
      }
    };

    return this.mergeSettings(defaultSettings, initial || {});
  }

  private mergeSettings(defaults: SensitivitySettings, overrides: Partial<SensitivitySettings>): SensitivitySettings {
    return {
      motion: { ...defaults.motion, ...overrides.motion },
      emf: { ...defaults.emf, ...overrides.emf },
      audio: { ...defaults.audio, ...overrides.audio },
      environmental: { ...defaults.environmental, ...overrides.environmental }
    };
  }

  private loadDefaultPresets(): void {
    // High Sensitivity Preset (Paranormal Investigation)
    this.presets.set('paranormal', {
      name: 'Paranormal Investigation',
      description: 'Maximum sensitivity for detecting subtle anomalies',
      settings: {
        motion: {
          general: 85,
          spatial: 90,
          temporal: 80,
          objectSize: { minimum: 5, maximum: 10000 }
        },
        emf: Object.fromEntries(
          Object.values(EMFFrequencyBand).map(band => [
            band, { threshold: 0.05, sensitivity: 90 }
          ])
        ) as any,
        audio: Object.fromEntries(
          Object.values(AudioFrequencyBand).map(band => [
            band, { threshold: -50, sensitivity: 95 }
          ])
        ) as any,
        environmental: Object.fromEntries(
          Object.values(EnvironmentalSensor).map(sensor => [
            sensor, { threshold: 0.1, sensitivity: 90 }
          ])
        ) as any
      }
    });

    // Medium Sensitivity Preset (Security)
    this.presets.set('security', {
      name: 'Security Monitoring',
      description: 'Balanced sensitivity for security applications',
      settings: {
        motion: {
          general: 60,
          spatial: 65,
          temporal: 55,
          objectSize: { minimum: 50, maximum: 5000 }
        },
        emf: Object.fromEntries(
          Object.values(EMFFrequencyBand).map(band => [
            band, { threshold: 1.0, sensitivity: 50 }
          ])
        ) as any,
        audio: Object.fromEntries(
          Object.values(AudioFrequencyBand).map(band => [
            band, { threshold: -30, sensitivity: 60 }
          ])
        ) as any,
        environmental: Object.fromEntries(
          Object.values(EnvironmentalSensor).map(sensor => [
            sensor, { threshold: 1.0, sensitivity: 55 }
          ])
        ) as any
      }
    });

    // Low Sensitivity Preset (Scientific)
    this.presets.set('scientific', {
      name: 'Scientific Research',
      description: 'Precise, low noise detection for scientific applications',
      settings: {
        motion: {
          general: 40,
          spatial: 45,
          temporal: 35,
          objectSize: { minimum: 100, maximum: 2000 }
        },
        emf: Object.fromEntries(
          Object.values(EMFFrequencyBand).map(band => [
            band, { threshold: 5.0, sensitivity: 30 }
          ])
        ) as any,
        audio: Object.fromEntries(
          Object.values(AudioFrequencyBand).map(band => [
            band, { threshold: -15, sensitivity: 35 }
          ])
        ) as any,
        environmental: Object.fromEntries(
          Object.values(EnvironmentalSensor).map(sensor => [
            sensor, { threshold: 5.0, sensitivity: 35 }
          ])
        ) as any
      }
    });
  }

  applyPreset(presetName: string): boolean {
    const preset = this.presets.get(presetName);
    if (!preset) {
      logger.warn(`Preset not found: ${presetName}`);
      return false;
    }

    this.settings = { ...preset.settings };
    this.emit('preset-applied', { name: presetName, preset });
    this.emit('settings-changed', this.settings);
    
    logger.info(`Applied sensitivity preset: ${preset.name}`);
    return true;
  }

  updateMotionSensitivity(updates: Partial<SensitivitySettings['motion']>): void {
    this.settings.motion = { ...this.settings.motion, ...updates };
    
    this.validateMotionSettings();
    this.emit('motion-sensitivity-changed', this.settings.motion);
    this.emit('settings-changed', this.settings);
    
    logger.debug('Motion sensitivity updated:', updates);
  }

  updateEMFSensitivity(band: EMFFrequencyBand, threshold?: number, sensitivity?: number): void {
    if (!this.settings.emf[band]) {
      this.settings.emf[band] = { threshold: 1.0, sensitivity: 50 };
    }

    if (threshold !== undefined) {
      this.settings.emf[band]!.threshold = Math.max(0, threshold);
    }
    
    if (sensitivity !== undefined) {
      this.settings.emf[band]!.sensitivity = Math.max(0, Math.min(100, sensitivity));
    }

    this.emit('emf-sensitivity-changed', { band, settings: this.settings.emf[band] });
    this.emit('settings-changed', this.settings);
    
    logger.debug(`EMF sensitivity updated for ${band}:`, this.settings.emf[band]);
  }

  updateAudioSensitivity(band: AudioFrequencyBand, threshold?: number, sensitivity?: number): void {
    if (!this.settings.audio[band]) {
      this.settings.audio[band] = { threshold: -30, sensitivity: 50 };
    }

    if (threshold !== undefined) {
      this.settings.audio[band]!.threshold = Math.max(-100, Math.min(0, threshold));
    }
    
    if (sensitivity !== undefined) {
      this.settings.audio[band]!.sensitivity = Math.max(0, Math.min(100, sensitivity));
    }

    this.emit('audio-sensitivity-changed', { band, settings: this.settings.audio[band] });
    this.emit('settings-changed', this.settings);
    
    logger.debug(`Audio sensitivity updated for ${band}:`, this.settings.audio[band]);
  }

  updateEnvironmentalSensitivity(sensor: EnvironmentalSensor, threshold?: number, sensitivity?: number): void {
    if (!this.settings.environmental[sensor]) {
      this.settings.environmental[sensor] = { threshold: 1.0, sensitivity: 50 };
    }

    if (threshold !== undefined) {
      this.settings.environmental[sensor]!.threshold = Math.max(0, threshold);
    }
    
    if (sensitivity !== undefined) {
      this.settings.environmental[sensor]!.sensitivity = Math.max(0, Math.min(100, sensitivity));
    }

    this.emit('environmental-sensitivity-changed', { sensor, settings: this.settings.environmental[sensor] });
    this.emit('settings-changed', this.settings);
    
    logger.debug(`Environmental sensitivity updated for ${sensor}:`, this.settings.environmental[sensor]);
  }

  private validateMotionSettings(): void {
    const motion = this.settings.motion;
    
    // Ensure valid ranges
    motion.general = Math.max(0, Math.min(100, motion.general));
    motion.spatial = Math.max(0, Math.min(100, motion.spatial));
    motion.temporal = Math.max(0, Math.min(100, motion.temporal));
    
    // Ensure minimum < maximum for object size
    if (motion.objectSize.minimum >= motion.objectSize.maximum) {
      motion.objectSize.maximum = motion.objectSize.minimum + 1;
    }
  }

  enableAdaptiveMode(enabled: boolean): void {
    this.adaptiveMode = enabled;
    
    if (enabled) {
      this.startAdaptiveAdjustment();
    } else {
      this.stopAdaptiveAdjustment();
    }
    
    this.emit('adaptive-mode-changed', enabled);
    logger.info(`Adaptive sensitivity mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  private startAdaptiveAdjustment(): void {
    // Begin monitoring for adaptive adjustments
    setInterval(() => {
      if (this.adaptiveMode) {
        this.performAdaptiveAdjustment();
      }
    }, 30000); // Check every 30 seconds
  }

  private stopAdaptiveAdjustment(): void {
    // Stop adaptive adjustments
    this.adaptiveHistory = [];
  }

  private performAdaptiveAdjustment(): void {
    if (this.adaptiveHistory.length < 10) return; // Need enough data

    const recentData = this.adaptiveHistory.slice(-10);
    const analysis = this.analyzeAdaptiveData(recentData);
    
    // Adjust motion sensitivity based on false positive rate
    if (analysis.motionFalsePositiveRate > 0.3) {
      // Too many false positives, reduce sensitivity
      this.settings.motion.general = Math.max(10, this.settings.motion.general - 5);
      logger.debug('Adaptive: Reduced motion sensitivity due to false positives');
    } else if (analysis.motionFalsePositiveRate < 0.1 && analysis.missedDetectionRate > 0.2) {
      // Too many missed detections, increase sensitivity
      this.settings.motion.general = Math.min(90, this.settings.motion.general + 3);
      logger.debug('Adaptive: Increased motion sensitivity due to missed detections');
    }

    // Adjust EMF sensitivity based on environmental noise
    this.adaptEMFSensitivity(analysis);
    
    // Adjust audio sensitivity based on ambient noise
    this.adaptAudioSensitivity(analysis);
    
    this.emit('adaptive-adjustment', analysis);
    this.emit('settings-changed', this.settings);
  }

  private analyzeAdaptiveData(data: AdaptiveData[]): AdaptiveAnalysis {
    const totalDetections = data.reduce((sum, d) => sum + d.detectionCount, 0);
    const falsePositives = data.reduce((sum, d) => sum + d.falsePositiveCount, 0);
    const missedDetections = data.reduce((sum, d) => sum + d.missedDetectionCount, 0);
    const avgNoiseLevel = data.reduce((sum, d) => sum + d.noiseLevel, 0) / data.length;
    const avgEMFNoise = data.reduce((sum, d) => sum + d.emfNoiseLevel, 0) / data.length;

    return {
      motionFalsePositiveRate: totalDetections > 0 ? falsePositives / totalDetections : 0,
      missedDetectionRate: totalDetections > 0 ? missedDetections / (totalDetections + missedDetections) : 0,
      averageNoiseLevel: avgNoiseLevel,
      averageEMFNoise: avgEMFNoise,
      recommendation: this.generateRecommendation(totalDetections, falsePositives, missedDetections)
    };
  }

  private adaptEMFSensitivity(analysis: AdaptiveAnalysis): void {
    // Adapt EMF sensitivity based on environmental noise
    const noiseAdjustment = Math.min(20, analysis.averageEMFNoise * 10);
    
    for (const band of Object.values(EMFFrequencyBand)) {
      if (this.settings.emf[band]) {
        // Increase threshold in noisy environments
        const currentThreshold = this.settings.emf[band]!.threshold;
        const newThreshold = currentThreshold * (1 + noiseAdjustment / 100);
        this.settings.emf[band]!.threshold = Math.min(100, newThreshold);
      }
    }
  }

  private adaptAudioSensitivity(analysis: AdaptiveAnalysis): void {
    // Adapt audio sensitivity based on ambient noise
    const noiseAdjustment = Math.min(10, (analysis.averageNoiseLevel - 30) / 2); // Adjust for noise above 30dB
    
    for (const band of Object.values(AudioFrequencyBand)) {
      if (this.settings.audio[band]) {
        // Increase threshold in noisy environments
        const currentThreshold = this.settings.audio[band]!.threshold;
        const newThreshold = currentThreshold - noiseAdjustment; // Lower threshold = higher required signal
        this.settings.audio[band]!.threshold = Math.max(-80, newThreshold);
      }
    }
  }

  private generateRecommendation(total: number, falsePos: number, missed: number): string {
    if (falsePos > total * 0.3) {
      return 'Consider reducing sensitivity to minimize false positives';
    } else if (missed > total * 0.2) {
      return 'Consider increasing sensitivity to catch more events';
    } else {
      return 'Current sensitivity levels are well-balanced';
    }
  }

  recordAdaptiveData(data: Partial<AdaptiveData>): void {
    const completeData: AdaptiveData = {
      timestamp: Date.now(),
      detectionCount: data.detectionCount || 0,
      falsePositiveCount: data.falsePositiveCount || 0,
      missedDetectionCount: data.missedDetectionCount || 0,
      noiseLevel: data.noiseLevel || this.environmentalFactors.noiseLevel,
      emfNoiseLevel: data.emfNoiseLevel || 0.1,
      environmentalFactors: { ...this.environmentalFactors }
    };

    this.adaptiveHistory.push(completeData);
    
    // Keep only recent history
    if (this.adaptiveHistory.length > 100) {
      this.adaptiveHistory.splice(0, 50);
    }
  }

  calibrateSensors(calibrationData: CalibrationData): void {
    this.calibrationData = { ...calibrationData };
    
    // Apply calibration offsets
    this.applyCalibrationOffsets();
    
    this.emit('sensors-calibrated', calibrationData);
    logger.info('Sensor calibration data applied');
  }

  private applyCalibrationOffsets(): void {
    if (!this.calibrationData) return;

    // Apply motion calibration
    if (this.calibrationData.motionOffset) {
      // Adjust motion thresholds based on calibration
      const offset = this.calibrationData.motionOffset;
      this.settings.motion.general = Math.max(0, Math.min(100, this.settings.motion.general + offset));
    }

    // Apply EMF calibration
    if (this.calibrationData.emfOffsets) {
      for (const [band, offset] of Object.entries(this.calibrationData.emfOffsets)) {
        const emfBand = band as EMFFrequencyBand;
        if (this.settings.emf[emfBand]) {
          this.settings.emf[emfBand]!.threshold *= (1 + offset);
        }
      }
    }

    // Apply audio calibration
    if (this.calibrationData.audioOffsets) {
      for (const [band, offset] of Object.entries(this.calibrationData.audioOffsets)) {
        const audioBand = band as AudioFrequencyBand;
        if (this.settings.audio[audioBand]) {
          this.settings.audio[audioBand]!.threshold += offset;
        }
      }
    }
  }

  updateEnvironmentalFactors(factors: Partial<EnvironmentalFactors>): void {
    this.environmentalFactors = { ...this.environmentalFactors, ...factors };
    
    // Automatically adjust settings based on environmental conditions
    this.adjustForEnvironmentalConditions();
    
    this.emit('environmental-factors-updated', this.environmentalFactors);
  }

  private adjustForEnvironmentalConditions(): void {
    const factors = this.environmentalFactors;
    
    // Temperature compensation
    if (factors.temperature < 10 || factors.temperature > 35) {
      // Extreme temperatures can affect sensor performance
      const tempAdjustment = Math.abs(factors.temperature - 22.5) / 12.5 * 10; // Up to 10% adjustment
      
      // Reduce sensitivity in extreme temperatures
      for (const sensor of Object.values(EnvironmentalSensor)) {
        if (this.settings.environmental[sensor]) {
          this.settings.environmental[sensor]!.sensitivity *= (1 - tempAdjustment / 100);
        }
      }
    }

    // Humidity compensation
    if (factors.humidity > 80) {
      // High humidity can affect EMF and audio sensors
      for (const band of Object.values(EMFFrequencyBand)) {
        if (this.settings.emf[band]) {
          this.settings.emf[band]!.threshold *= 1.2; // Increase threshold by 20%
        }
      }
    }

    // Pressure compensation
    const pressureDelta = Math.abs(factors.pressure - 1013) / 50; // Normalize pressure variation
    if (pressureDelta > 0.1) {
      // Adjust seismic and vibration sensitivity
      if (this.settings.environmental[EnvironmentalSensor.SEISMIC]) {
        this.settings.environmental[EnvironmentalSensor.SEISMIC]!.sensitivity *= (1 - pressureDelta);
      }
      if (this.settings.environmental[EnvironmentalSensor.VIBRATION]) {
        this.settings.environmental[EnvironmentalSensor.VIBRATION]!.sensitivity *= (1 - pressureDelta);
      }
    }
  }

  createCustomPreset(name: string, description: string): string {
    const presetId = `custom_${Date.now()}`;
    
    const preset: SensitivityPreset = {
      name,
      description,
      settings: { ...this.settings }
    };

    this.presets.set(presetId, preset);
    this.emit('preset-created', { id: presetId, preset });
    
    logger.info(`Created custom preset: ${name}`);
    return presetId;
  }

  deletePreset(presetId: string): boolean {
    if (presetId.startsWith('custom_') && this.presets.has(presetId)) {
      const preset = this.presets.get(presetId)!;
      this.presets.delete(presetId);
      this.emit('preset-deleted', { id: presetId, name: preset.name });
      logger.info(`Deleted custom preset: ${preset.name}`);
      return true;
    }
    return false;
  }

  exportSettings(): string {
    const exportData = {
      settings: this.settings,
      environmentalFactors: this.environmentalFactors,
      calibrationData: this.calibrationData,
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  importSettings(settingsJson: string): boolean {
    try {
      const importData = JSON.parse(settingsJson);
      
      if (importData.settings) {
        this.settings = this.mergeSettings(this.settings, importData.settings);
      }
      
      if (importData.environmentalFactors) {
        this.environmentalFactors = { ...this.environmentalFactors, ...importData.environmentalFactors };
      }
      
      if (importData.calibrationData) {
        this.calibrationData = importData.calibrationData;
      }

      this.emit('settings-imported', importData);
      this.emit('settings-changed', this.settings);
      
      logger.info('Sensitivity settings imported successfully');
      return true;
    } catch (error) {
      logger.error('Failed to import settings:', error);
      this.emit('import-error', error);
      return false;
    }
  }

  resetToDefaults(): void {
    this.settings = this.initializeDefaultSettings();
    this.environmentalFactors = {
      temperature: 20,
      humidity: 50,
      pressure: 1013,
      lightLevel: 500,
      noiseLevel: 35,
      vibrationLevel: 0.1
    };
    this.calibrationData = null;
    this.adaptiveHistory = [];

    this.emit('settings-reset');
    this.emit('settings-changed', this.settings);
    
    logger.info('Sensitivity settings reset to defaults');
  }

  // Conversion methods for other components
  getMotionDetectionSettings(): MotionDetectionSettings {
    const motion = this.settings.motion;
    
    return {
      algorithm: 'hybrid' as any,
      sensitivity: motion.general,
      minimumObjectSize: motion.objectSize.minimum,
      maximumObjectSize: motion.objectSize.maximum,
      threshold: this.sensitivityToThreshold(motion.general),
      backgroundLearningRate: 0.01 + (motion.temporal / 1000),
      noiseReduction: motion.spatial > 50,
      morphologicalOps: motion.spatial > 60,
      contourFiltering: motion.general > 40,
      temporalFiltering: {
        enabled: motion.temporal > 30,
        frameHistory: Math.max(3, Math.floor(motion.temporal / 10)),
        consistencyThreshold: motion.temporal / 100
      }
    };
  }

  getEMFVisualizationSettings(): Partial<EMFVisualizationSettings> {
    const avgSensitivity = this.getAverageEMFSensitivity();
    
    return {
      threshold: this.getAverageEMFThreshold(),
      updateRate: Math.max(10, Math.floor(avgSensitivity / 2)),
      averaging: {
        enabled: avgSensitivity < 70,
        windowSize: avgSensitivity < 50 ? 10 : 5
      }
    };
  }

  getAudioVisualizationSettings(): Partial<AudioVisualizationSettings> {
    const avgSensitivity = this.getAverageAudioSensitivity();
    
    return {
      spectrogram: {
        enabled: true,
        windowSize: avgSensitivity > 70 ? 2048 : 1024,
        overlap: avgSensitivity > 80 ? 0.75 : 0.5,
        colormap: 'jet'
      },
      waveform: {
        enabled: avgSensitivity > 60,
        timeWindow: avgSensitivity > 80 ? 5 : 2,
        amplitude: avgSensitivity / 100
      }
    };
  }

  private sensitivityToThreshold(sensitivity: number): number {
    // Convert sensitivity (0-100) to detection threshold (0-255)
    return Math.floor((100 - sensitivity) * 2.55);
  }

  private getAverageEMFSensitivity(): number {
    const values = Object.values(this.settings.emf).filter(v => v !== undefined);
    return values.length > 0 ? values.reduce((sum, v) => sum + v!.sensitivity, 0) / values.length : 50;
  }

  private getAverageEMFThreshold(): number {
    const values = Object.values(this.settings.emf).filter(v => v !== undefined);
    return values.length > 0 ? values.reduce((sum, v) => sum + v!.threshold, 0) / values.length : 1.0;
  }

  private getAverageAudioSensitivity(): number {
    const values = Object.values(this.settings.audio).filter(v => v !== undefined);
    return values.length > 0 ? values.reduce((sum, v) => sum + v!.sensitivity, 0) / values.length : 50;
  }

  getSettings(): SensitivitySettings {
    return { ...this.settings };
  }

  getPresets(): { id: string; preset: SensitivityPreset }[] {
    return Array.from(this.presets.entries()).map(([id, preset]) => ({ id, preset }));
  }

  getEnvironmentalFactors(): EnvironmentalFactors {
    return { ...this.environmentalFactors };
  }

  isAdaptiveModeEnabled(): boolean {
    return this.adaptiveMode;
  }

  getAdaptiveHistory(): AdaptiveData[] {
    return [...this.adaptiveHistory];
  }

  destroy(): void {
    this.stopAdaptiveAdjustment();
    this.removeAllListeners();
  }
}

interface SensitivityPreset {
  name: string;
  description: string;
  settings: SensitivitySettings;
}

interface AdaptiveData {
  timestamp: number;
  detectionCount: number;
  falsePositiveCount: number;
  missedDetectionCount: number;
  noiseLevel: number;
  emfNoiseLevel: number;
  environmentalFactors: EnvironmentalFactors;
}

interface AdaptiveAnalysis {
  motionFalsePositiveRate: number;
  missedDetectionRate: number;
  averageNoiseLevel: number;
  averageEMFNoise: number;
  recommendation: string;
}

interface CalibrationData {
  timestamp: Date;
  motionOffset?: number;
  emfOffsets?: { [band: string]: number };
  audioOffsets?: { [band: string]: number };
  environmentalOffsets?: { [sensor: string]: number };
}

interface EnvironmentalFactors {
  temperature: number;    // Celsius
  humidity: number;       // %
  pressure: number;       // hPa
  lightLevel: number;     // lux
  noiseLevel: number;     // dB
  vibrationLevel: number; // m/s²
}