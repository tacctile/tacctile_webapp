/**
 * Temperature Range Controller
 * Advanced temperature range and threshold controls for thermal detection
 */

import { EventEmitter } from 'events';
import {
  TemperatureRange,
  DetectionSettings,
  ThermalFrame,
  TemperatureAnomaly,
  AnomalyType,
  EnvironmentalContext,
  ThermalAlert,
  AlertType,
  AlertPriority
} from '../types';
import { logger } from '../../../utils/logger';

export interface TemperatureProfile {
  id: string;
  name: string;
  description: string;
  temperatureRange: TemperatureRange;
  detectionSettings: DetectionSettings;
  alertThresholds: AlertThreshold[];
  category: 'paranormal' | 'industrial' | 'medical' | 'environmental' | 'custom';
  recommended: boolean;
}

export interface AlertThreshold {
  name: string;
  temperature: number;
  condition: 'above' | 'below' | 'range';
  hysteresis: number; // °C
  priority: AlertPriority;
  enabled: boolean;
  color: string;
}

export interface AutoRangeSettings {
  enabled: boolean;
  adaptationRate: number; // 0-1
  percentile: number; // 1-99
  margin: number; // °C
  updateInterval: number; // seconds
  minRange: number; // °C
  maxRange: number; // °C
}

export interface IsothermSettings {
  enabled: boolean;
  isotherms: IsothermConfig[];
  autoGenerate: boolean;
  spacing: number; // °C
  showLabels: boolean;
}

export interface IsothermConfig {
  id: string;
  temperature: number;
  color: string;
  thickness: number;
  style: 'solid' | 'dashed' | 'dotted';
  visible: boolean;
  label?: string;
}

export class TemperatureRangeController extends EventEmitter {
  private currentRange: TemperatureRange;
  private detectionSettings: DetectionSettings;
  private profiles: Map<string, TemperatureProfile> = new Map();
  private alertThresholds: AlertThreshold[] = [];
  private autoRangeSettings: AutoRangeSettings;
  private isothermSettings: IsothermSettings;
  
  private frameHistory: ThermalFrame[] = [];
  private temperatureHistory: number[] = [];
  private environmentalContext: EnvironmentalContext | null = null;
  
  private autoRangeTimer: NodeJS.Timeout | null = null;
  private currentProfile: string | null = null;
  private backgroundTemperature = 20; // Room temperature baseline

  constructor() {
    super();
    
    this.currentRange = {
      min: -10,
      max: 50,
      accuracy: 0.1
    };

    this.detectionSettings = {
      sensitivity: 0.5,
      minAnomalySize: 10,
      maxAnomalySize: 1000,
      temperatureThreshold: 2.0,
      gradientThreshold: 0.5,
      temporalWindow: 10,
      backgroundUpdateRate: 0.01,
      noiseReduction: 0.3
    };

    this.autoRangeSettings = {
      enabled: false,
      adaptationRate: 0.1,
      percentile: 5,
      margin: 5,
      updateInterval: 5,
      minRange: 10,
      maxRange: 200
    };

    this.isothermSettings = {
      enabled: false,
      isotherms: [],
      autoGenerate: true,
      spacing: 5,
      showLabels: true
    };

    this.initializeProfiles();
    this.initializeDefaultAlerts();
  }

  /**
   * Initialize temperature profiles
   */
  private initializeProfiles(): void {
    const profiles: TemperatureProfile[] = [
      {
        id: 'paranormal_standard',
        name: 'Paranormal - Standard',
        description: 'Standard temperature range for paranormal investigations',
        category: 'paranormal',
        recommended: true,
        temperatureRange: { min: 10, max: 40, accuracy: 0.1 },
        detectionSettings: {
          sensitivity: 0.6,
          minAnomalySize: 5,
          maxAnomalySize: 500,
          temperatureThreshold: 2.0,
          gradientThreshold: 0.3,
          temporalWindow: 15,
          backgroundUpdateRate: 0.01,
          noiseReduction: 0.2
        },
        alertThresholds: [
          { name: 'Cold Spot', temperature: 18, condition: 'below', hysteresis: 1, priority: AlertPriority.MEDIUM, enabled: true, color: '#0080ff' },
          { name: 'Hot Spot', temperature: 28, condition: 'above', hysteresis: 1, priority: AlertPriority.MEDIUM, enabled: true, color: '#ff4000' }
        ]
      },
      {
        id: 'paranormal_sensitive',
        name: 'Paranormal - High Sensitivity',
        description: 'High sensitivity for detecting subtle temperature changes',
        category: 'paranormal',
        recommended: false,
        temperatureRange: { min: 15, max: 30, accuracy: 0.05 },
        detectionSettings: {
          sensitivity: 0.9,
          minAnomalySize: 2,
          maxAnomalySize: 200,
          temperatureThreshold: 0.5,
          gradientThreshold: 0.1,
          temporalWindow: 20,
          backgroundUpdateRate: 0.005,
          noiseReduction: 0.1
        },
        alertThresholds: [
          { name: 'Minor Cold', temperature: 21, condition: 'below', hysteresis: 0.5, priority: AlertPriority.LOW, enabled: true, color: '#4080ff' },
          { name: 'Minor Hot', temperature: 24, condition: 'above', hysteresis: 0.5, priority: AlertPriority.LOW, enabled: true, color: '#ff8040' }
        ]
      },
      {
        id: 'paranormal_extreme',
        name: 'Paranormal - Extreme Events',
        description: 'Detection of extreme temperature anomalies only',
        category: 'paranormal',
        recommended: false,
        temperatureRange: { min: -20, max: 80, accuracy: 0.5 },
        detectionSettings: {
          sensitivity: 0.3,
          minAnomalySize: 20,
          maxAnomalySize: 2000,
          temperatureThreshold: 10.0,
          gradientThreshold: 2.0,
          temporalWindow: 5,
          backgroundUpdateRate: 0.02,
          noiseReduction: 0.5
        },
        alertThresholds: [
          { name: 'Extreme Cold', temperature: 5, condition: 'below', hysteresis: 2, priority: AlertPriority.HIGH, enabled: true, color: '#0040ff' },
          { name: 'Extreme Hot', temperature: 50, condition: 'above', hysteresis: 2, priority: AlertPriority.HIGH, enabled: true, color: '#ff0040' }
        ]
      },
      {
        id: 'environmental_monitoring',
        name: 'Environmental Monitoring',
        description: 'General environmental temperature monitoring',
        category: 'environmental',
        recommended: false,
        temperatureRange: { min: -10, max: 60, accuracy: 0.2 },
        detectionSettings: {
          sensitivity: 0.4,
          minAnomalySize: 50,
          maxAnomalySize: 5000,
          temperatureThreshold: 5.0,
          gradientThreshold: 1.0,
          temporalWindow: 30,
          backgroundUpdateRate: 0.05,
          noiseReduction: 0.4
        },
        alertThresholds: [
          { name: 'Freeze Warning', temperature: 0, condition: 'below', hysteresis: 1, priority: AlertPriority.MEDIUM, enabled: true, color: '#0080ff' },
          { name: 'Heat Warning', temperature: 35, condition: 'above', hysteresis: 2, priority: AlertPriority.MEDIUM, enabled: true, color: '#ff8000' }
        ]
      },
      {
        id: 'industrial_safety',
        name: 'Industrial Safety',
        description: 'Industrial equipment monitoring and safety',
        category: 'industrial',
        recommended: false,
        temperatureRange: { min: -40, max: 150, accuracy: 1.0 },
        detectionSettings: {
          sensitivity: 0.2,
          minAnomalySize: 100,
          maxAnomalySize: 10000,
          temperatureThreshold: 15.0,
          gradientThreshold: 5.0,
          temporalWindow: 60,
          backgroundUpdateRate: 0.1,
          noiseReduction: 0.6
        },
        alertThresholds: [
          { name: 'Equipment Cold', temperature: -20, condition: 'below', hysteresis: 5, priority: AlertPriority.LOW, enabled: true, color: '#4040ff' },
          { name: 'Overheating', temperature: 80, condition: 'above', hysteresis: 5, priority: AlertPriority.CRITICAL, enabled: true, color: '#ff0000' }
        ]
      }
    ];

    for (const profile of profiles) {
      this.profiles.set(profile.id, profile);
    }
  }

  /**
   * Initialize default alert thresholds
   */
  private initializeDefaultAlerts(): void {
    this.alertThresholds = [
      { 
        name: 'Room Temperature Baseline', 
        temperature: 22, 
        condition: 'range', 
        hysteresis: 3, 
        priority: AlertPriority.LOW, 
        enabled: false, 
        color: '#808080' 
      },
      { 
        name: 'Cold Anomaly', 
        temperature: 18, 
        condition: 'below', 
        hysteresis: 1, 
        priority: AlertPriority.MEDIUM, 
        enabled: true, 
        color: '#0080ff' 
      },
      { 
        name: 'Hot Anomaly', 
        temperature: 28, 
        condition: 'above', 
        hysteresis: 1, 
        priority: AlertPriority.MEDIUM, 
        enabled: true, 
        color: '#ff4000' 
      }
    ];
  }

  /**
   * Apply temperature profile
   */
  applyProfile(profileId: string): boolean {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      logger.error(`Temperature profile not found: ${profileId}`);
      return false;
    }

    const oldRange = { ...this.currentRange };
    const oldSettings = { ...this.detectionSettings };

    this.currentRange = { ...profile.temperatureRange };
    this.detectionSettings = { ...profile.detectionSettings };
    this.alertThresholds = profile.alertThresholds.map(t => ({ ...t }));
    this.currentProfile = profileId;

    // Update isotherms if auto-generation is enabled
    if (this.isothermSettings.autoGenerate) {
      this.generateIsotherms();
    }

    this.emit('profile-applied', {
      profileId,
      profile,
      oldRange,
      newRange: this.currentRange,
      oldSettings,
      newSettings: this.detectionSettings
    });

    logger.info(`Applied temperature profile: ${profile.name}`);
    return true;
  }

  /**
   * Set temperature range manually
   */
  setTemperatureRange(range: TemperatureRange): void {
    const oldRange = { ...this.currentRange };
    this.currentRange = { ...range };
    this.currentProfile = null; // Clear profile when manually setting

    // Validate range
    if (this.currentRange.min >= this.currentRange.max) {
      logger.warn('Invalid temperature range: min >= max');
      this.currentRange = oldRange;
      return;
    }

    // Update isotherms
    if (this.isothermSettings.autoGenerate) {
      this.generateIsotherms();
    }

    this.emit('range-changed', {
      oldRange,
      newRange: this.currentRange
    });

    logger.info(`Temperature range set: ${range.min}°C to ${range.max}°C`);
  }

  /**
   * Enable auto-ranging
   */
  enableAutoRange(settings?: Partial<AutoRangeSettings>): void {
    if (settings) {
      this.autoRangeSettings = { ...this.autoRangeSettings, ...settings };
    }

    this.autoRangeSettings.enabled = true;

    // Start auto-range timer
    if (this.autoRangeTimer) {
      clearInterval(this.autoRangeTimer);
    }

    this.autoRangeTimer = setInterval(() => {
      this.performAutoRanging();
    }, this.autoRangeSettings.updateInterval * 1000);

    this.emit('auto-range-enabled', this.autoRangeSettings);
    logger.info('Auto-ranging enabled');
  }

  /**
   * Disable auto-ranging
   */
  disableAutoRange(): void {
    this.autoRangeSettings.enabled = false;

    if (this.autoRangeTimer) {
      clearInterval(this.autoRangeTimer);
      this.autoRangeTimer = null;
    }

    this.emit('auto-range-disabled');
    logger.info('Auto-ranging disabled');
  }

  /**
   * Perform automatic range adjustment
   */
  private performAutoRanging(): void {
    if (this.temperatureHistory.length < 10) return; // Need enough data

    const recentTemps = this.temperatureHistory.slice(-100); // Last 100 measurements
    const sortedTemps = recentTemps.sort((a, b) => a - b);

    const percentile = this.autoRangeSettings.percentile / 100;
    const lowIndex = Math.floor(sortedTemps.length * percentile);
    const highIndex = Math.floor(sortedTemps.length * (1 - percentile));

    const autoMin = sortedTemps[lowIndex] - this.autoRangeSettings.margin;
    const autoMax = sortedTemps[highIndex] + this.autoRangeSettings.margin;

    // Apply adaptation rate for smooth transitions
    const rate = this.autoRangeSettings.adaptationRate;
    const newMin = this.currentRange.min * (1 - rate) + autoMin * rate;
    const newMax = this.currentRange.max * (1 - rate) + autoMax * rate;

    // Enforce limits
    const finalMin = Math.max(newMin, this.currentRange.min - this.autoRangeSettings.maxRange);
    const finalMax = Math.min(newMax, this.currentRange.max + this.autoRangeSettings.maxRange);

    // Ensure minimum range
    const range = finalMax - finalMin;
    if (range < this.autoRangeSettings.minRange) {
      const center = (finalMin + finalMax) / 2;
      const halfMin = this.autoRangeSettings.minRange / 2;
      this.setTemperatureRange({
        min: center - halfMin,
        max: center + halfMin,
        accuracy: this.currentRange.accuracy
      });
    } else {
      this.setTemperatureRange({
        min: finalMin,
        max: finalMax,
        accuracy: this.currentRange.accuracy
      });
    }

    this.emit('auto-range-updated', {
      min: finalMin,
      max: finalMax,
      source: 'auto-range'
    });
  }

  /**
   * Process thermal frame for range analysis
   */
  processFrame(frame: ThermalFrame): void {
    // Update frame history
    this.frameHistory.push(frame);
    if (this.frameHistory.length > 50) {
      this.frameHistory.shift();
    }

    // Add to temperature history
    const temps = Array.from(frame.temperatureData).filter(t => t > -100 && t < 200);
    this.temperatureHistory.push(...temps);
    
    // Limit temperature history
    if (this.temperatureHistory.length > 1000) {
      this.temperatureHistory = this.temperatureHistory.slice(-1000);
    }

    // Update background temperature
    this.updateBackgroundTemperature(frame);

    // Check alert thresholds
    this.checkAlertThresholds(frame);
  }

  /**
   * Update background temperature estimation
   */
  private updateBackgroundTemperature(frame: ThermalFrame): void {
    // Use median temperature as background estimate
    const temps = Array.from(frame.temperatureData).filter(t => t > -50 && t < 100);
    temps.sort((a, b) => a - b);
    
    if (temps.length > 0) {
      const median = temps[Math.floor(temps.length / 2)];
      const updateRate = this.detectionSettings.backgroundUpdateRate;
      this.backgroundTemperature = this.backgroundTemperature * (1 - updateRate) + median * updateRate;
    }
  }

  /**
   * Check alert thresholds
   */
  private checkAlertThresholds(frame: ThermalFrame): void {
    const temps = Array.from(frame.temperatureData);

    for (const threshold of this.alertThresholds) {
      if (!threshold.enabled) continue;

      const violations = this.findThresholdViolations(temps, threshold);
      
      for (const violation of violations) {
        this.emitTemperatureAlert(violation, threshold, frame);
      }
    }
  }

  /**
   * Find threshold violations in temperature data
   */
  private findThresholdViolations(
    temperatures: number[], 
    threshold: AlertThreshold
  ): Array<{ index: number; temperature: number; position: { x: number; y: number } }> {
    const violations: Array<{ index: number; temperature: number; position: { x: number; y: number } }> = [];
    const frameWidth = Math.sqrt(temperatures.length); // Assume square frame for simplicity

    for (let i = 0; i < temperatures.length; i++) {
      const temp = temperatures[i];
      let isViolation = false;

      switch (threshold.condition) {
        case 'above':
          isViolation = temp > threshold.temperature;
          break;
        case 'below':
          isViolation = temp < threshold.temperature;
          break;
        case 'range':
          isViolation = Math.abs(temp - threshold.temperature) > threshold.hysteresis;
          break;
      }

      if (isViolation) {
        const x = i % frameWidth;
        const y = Math.floor(i / frameWidth);
        violations.push({ index: i, temperature: temp, position: { x, y } });
      }
    }

    return violations;
  }

  /**
   * Emit temperature alert
   */
  private emitTemperatureAlert(
    violation: { index: number; temperature: number; position: { x: number; y: number } },
    threshold: AlertThreshold,
    frame: ThermalFrame
  ): void {
    const alert: ThermalAlert = {
      id: `temp_alert_${Date.now()}_${Math.random()}`,
      type: AlertType.TEMPERATURE_THRESHOLD,
      priority: threshold.priority,
      message: `${threshold.name}: ${violation.temperature.toFixed(1)}°C`,
      temperature: violation.temperature,
      threshold: threshold.temperature,
      position: { x: violation.position.x, y: violation.position.y, temperature: violation.temperature },
      timestamp: frame.timestamp,
      acknowledged: false,
      autoResolved: false,
      metadata: {
        source: 'temperature_threshold',
        relatedAlerts: [],
        suggestedAction: this.generateSuggestedAction(threshold, violation.temperature),
        escalationLevel: 0
      }
    };

    this.emit('temperature-alert', alert);
  }

  /**
   * Generate suggested action for alert
   */
  private generateSuggestedAction(threshold: AlertThreshold, temperature: number): string {
    const delta = Math.abs(temperature - threshold.temperature);

    if (threshold.condition === 'below' && temperature < threshold.temperature) {
      if (delta > 10) {
        return 'Investigate possible equipment malfunction or environmental anomaly';
      } else {
        return 'Monitor for continued cooling trend';
      }
    } else if (threshold.condition === 'above' && temperature > threshold.temperature) {
      if (delta > 10) {
        return 'Check for heat sources or equipment overheating';
      } else {
        return 'Monitor for continued heating trend';
      }
    }

    return 'Monitor temperature trend and investigate if persistent';
  }

  /**
   * Add alert threshold
   */
  addAlertThreshold(threshold: Omit<AlertThreshold, 'enabled'>): void {
    const newThreshold: AlertThreshold = {
      ...threshold,
      enabled: true
    };

    this.alertThresholds.push(newThreshold);
    this.currentProfile = null; // Clear profile when manually adding

    this.emit('threshold-added', newThreshold);
    logger.info(`Added temperature threshold: ${threshold.name}`);
  }

  /**
   * Remove alert threshold
   */
  removeAlertThreshold(name: string): boolean {
    const index = this.alertThresholds.findIndex(t => t.name === name);
    
    if (index !== -1) {
      const removed = this.alertThresholds.splice(index, 1)[0];
      this.emit('threshold-removed', removed);
      logger.info(`Removed temperature threshold: ${name}`);
      return true;
    }

    return false;
  }

  /**
   * Update alert threshold
   */
  updateAlertThreshold(name: string, updates: Partial<AlertThreshold>): boolean {
    const threshold = this.alertThresholds.find(t => t.name === name);
    
    if (threshold) {
      Object.assign(threshold, updates);
      this.currentProfile = null; // Clear profile when manually updating
      this.emit('threshold-updated', threshold);
      logger.info(`Updated temperature threshold: ${name}`);
      return true;
    }

    return false;
  }

  /**
   * Generate isotherms
   */
  private generateIsotherms(): void {
    const isotherms: IsothermConfig[] = [];
    const { min, max } = this.currentRange;
    const spacing = this.isothermSettings.spacing;

    // Generate isotherms at regular intervals
    for (let temp = Math.ceil(min / spacing) * spacing; temp <= max; temp += spacing) {
      const intensity = (temp - min) / (max - min);
      const color = this.getIsothermColor(intensity);

      isotherms.push({
        id: `isotherm_${temp}`,
        temperature: temp,
        color,
        thickness: 1,
        style: 'solid',
        visible: true,
        label: `${temp}°C`
      });
    }

    this.isothermSettings.isotherms = isotherms;
    this.emit('isotherms-generated', isotherms);
  }

  /**
   * Get isotherm color based on intensity
   */
  private getIsothermColor(intensity: number): string {
    // Generate color from blue (cold) to red (hot)
    const hue = (1 - intensity) * 240; // 240° = blue, 0° = red
    return `hsl(${hue}, 100%, 50%)`;
  }

  /**
   * Set isotherm settings
   */
  setIsothermSettings(settings: Partial<IsothermSettings>): void {
    this.isothermSettings = { ...this.isothermSettings, ...settings };

    if (settings.enabled && this.isothermSettings.autoGenerate) {
      this.generateIsotherms();
    }

    this.emit('isotherm-settings-changed', this.isothermSettings);
  }

  /**
   * Add custom isotherm
   */
  addIsotherm(config: Omit<IsothermConfig, 'id'>): void {
    const isotherm: IsothermConfig = {
      id: `custom_${Date.now()}`,
      ...config
    };

    this.isothermSettings.isotherms.push(isotherm);
    this.emit('isotherm-added', isotherm);
  }

  /**
   * Remove isotherm
   */
  removeIsotherm(id: string): boolean {
    const index = this.isothermSettings.isotherms.findIndex(i => i.id === id);
    
    if (index !== -1) {
      const removed = this.isothermSettings.isotherms.splice(index, 1)[0];
      this.emit('isotherm-removed', removed);
      return true;
    }

    return false;
  }

  /**
   * Set environmental context
   */
  setEnvironmentalContext(context: EnvironmentalContext): void {
    this.environmentalContext = context;
    
    // Adjust detection settings based on environment
    this.adjustSettingsForEnvironment(context);
    
    this.emit('environmental-context-updated', context);
  }

  /**
   * Adjust settings based on environmental context
   */
  private adjustSettingsForEnvironment(context: EnvironmentalContext): void {
    const adjustments: Partial<DetectionSettings> = {};

    // Adjust for room temperature
    const roomTempDelta = Math.abs(context.roomTemp - 22); // Deviation from standard room temp
    if (roomTempDelta > 5) {
      adjustments.temperatureThreshold = this.detectionSettings.temperatureThreshold + roomTempDelta * 0.2;
    }

    // Adjust for humidity
    if (context.relativeHumidity && context.relativeHumidity > 70) {
      adjustments.noiseReduction = Math.min(0.8, this.detectionSettings.noiseReduction + 0.1);
    }

    // Adjust for airflow
    if (context.airflow && context.airflow > 0.5) {
      adjustments.temporalWindow = Math.min(30, this.detectionSettings.temporalWindow + 5);
    }

    if (Object.keys(adjustments).length > 0) {
      this.detectionSettings = { ...this.detectionSettings, ...adjustments };
      this.emit('settings-adjusted-for-environment', adjustments);
    }
  }

  /**
   * Get current temperature range
   */
  getTemperatureRange(): TemperatureRange {
    return { ...this.currentRange };
  }

  /**
   * Get detection settings
   */
  getDetectionSettings(): DetectionSettings {
    return { ...this.detectionSettings };
  }

  /**
   * Get alert thresholds
   */
  getAlertThresholds(): AlertThreshold[] {
    return this.alertThresholds.map(t => ({ ...t }));
  }

  /**
   * Get isotherm settings
   */
  getIsothermSettings(): IsothermSettings {
    return {
      ...this.isothermSettings,
      isotherms: this.isothermSettings.isotherms.map(i => ({ ...i }))
    };
  }

  /**
   * Get auto-range settings
   */
  getAutoRangeSettings(): AutoRangeSettings {
    return { ...this.autoRangeSettings };
  }

  /**
   * Get all profiles
   */
  getProfiles(): TemperatureProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): TemperatureProfile | null {
    return this.currentProfile ? this.profiles.get(this.currentProfile) || null : null;
  }

  /**
   * Get background temperature
   */
  getBackgroundTemperature(): number {
    return this.backgroundTemperature;
  }

  /**
   * Get temperature statistics
   */
  getTemperatureStatistics(): {
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    sampleCount: number;
  } {
    if (this.temperatureHistory.length === 0) {
      return { min: 0, max: 0, mean: 0, stdDev: 0, sampleCount: 0 };
    }

    const temps = this.temperatureHistory;
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const mean = temps.reduce((sum, t) => sum + t, 0) / temps.length;
    const variance = temps.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / temps.length;
    const stdDev = Math.sqrt(variance);

    return { min, max, mean, stdDev, sampleCount: temps.length };
  }

  /**
   * Reset temperature history
   */
  resetTemperatureHistory(): void {
    this.temperatureHistory = [];
    this.frameHistory = [];
    this.backgroundTemperature = 20;
    
    this.emit('history-reset');
    logger.info('Temperature history reset');
  }

  /**
   * Create custom profile
   */
  createCustomProfile(profile: Omit<TemperatureProfile, 'id' | 'category'>): TemperatureProfile {
    const customProfile: TemperatureProfile = {
      id: `custom_${Date.now()}`,
      category: 'custom',
      ...profile
    };

    this.profiles.set(customProfile.id, customProfile);
    
    this.emit('profile-created', customProfile);
    logger.info(`Created custom temperature profile: ${customProfile.name}`);

    return customProfile;
  }

  /**
   * Update detection settings
   */
  updateDetectionSettings(updates: Partial<DetectionSettings>): void {
    this.detectionSettings = { ...this.detectionSettings, ...updates };
    this.currentProfile = null; // Clear profile when manually updating

    this.emit('detection-settings-updated', this.detectionSettings);
  }

  /**
   * Cleanup
   */
  dispose(): void {
    if (this.autoRangeTimer) {
      clearInterval(this.autoRangeTimer);
      this.autoRangeTimer = null;
    }

    this.frameHistory = [];
    this.temperatureHistory = [];
    
    this.removeAllListeners();
  }
}