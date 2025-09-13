/**
 * Thermal Calibrator
 * Handles thermal camera calibration for accurate temperature measurements
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import {
  ThermalCalibration,
  ThermalFrame,
  CameraIntrinsics,
  CameraExtrinsics,
  EnvironmentalConditions,
  CalibrationStep,
  CalibrationSession
} from '../types';
import { logger } from '../../../utils/logger';

export interface BlackbodyTarget {
  id: string;
  name: string;
  temperature: number; // °C
  emissivity: number;
  size: { width: number; height: number }; // pixels
  position: { x: number; y: number }; // pixels
}

export interface CalibrationTarget {
  type: 'blackbody' | 'reference_object' | 'ambient';
  temperature: number;
  emissivity: number;
  reflectedTemp?: number;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface CalibrationSettings {
  targetCount: number;
  temperatureRange: { min: number; max: number };
  environmentalStabilizationTime: number; // seconds
  measurementDuration: number; // seconds
  accuracyRequirement: number; // ±°C
  emissivityRange: { min: number; max: number };
  distanceRange: { min: number; max: number }; // meters
}

export interface CalibrationResult {
  success: boolean;
  accuracy: number; // ±°C
  calibrationMatrix: number[];
  temperatureCorrection: (rawTemp: number, emissivity: number, distance: number) => number;
  validationMetrics: ValidationMetrics;
  recommendations: string[];
}

export interface ValidationMetrics {
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  maxError: number;
  correlation: number;
  outlierCount: number;
  confidenceInterval: { lower: number; upper: number };
}

export class ThermalCalibrator extends EventEmitter {
  private calibrationSession: CalibrationSession | null = null;
  private targets: CalibrationTarget[] = [];
  private measurements: CalibrationMeasurement[] = [];
  private environmentalConditions: EnvironmentalConditions | null = null;
  private settings: CalibrationSettings;

  constructor(settings?: Partial<CalibrationSettings>) {
    super();
    
    this.settings = {
      targetCount: 5,
      temperatureRange: { min: 15, max: 50 },
      environmentalStabilizationTime: 300, // 5 minutes
      measurementDuration: 60, // 1 minute
      accuracyRequirement: 2.0, // ±2°C
      emissivityRange: { min: 0.1, max: 1.0 },
      distanceRange: { min: 0.5, max: 5.0 },
      ...settings
    };
  }

  /**
   * Start calibration process
   */
  async startCalibration(
    environmentalConditions: EnvironmentalConditions,
    targets?: CalibrationTarget[]
  ): Promise<CalibrationSession> {
    if (this.calibrationSession && this.calibrationSession.status === 'in_progress') {
      throw new Error('Calibration already in progress');
    }

    this.environmentalConditions = environmentalConditions;
    this.targets = targets || this.generateDefaultTargets();
    this.measurements = [];

    const steps = this.generateCalibrationSteps();

    this.calibrationSession = {
      id: `thermal_calib_${Date.now()}`,
      sensorId: 'thermal_camera',
      steps,
      startTime: new Date(),
      status: 'in_progress'
    };

    this.emit('calibration-started', this.calibrationSession);
    logger.info('Started thermal camera calibration');

    // Begin first step
    await this.processNextStep();

    return this.calibrationSession;
  }

  /**
   * Generate default calibration targets
   */
  private generateDefaultTargets(): CalibrationTarget[] {
    const targets: CalibrationTarget[] = [];
    const { min, max } = this.settings.temperatureRange;
    const steps = this.settings.targetCount - 1;

    // Generate temperature targets across range
    for (let i = 0; i <= steps; i++) {
      const temperature = min + (max - min) * i / steps;
      
      targets.push({
        type: i === 0 ? 'ambient' : 'blackbody',
        temperature,
        emissivity: 0.95, // Typical blackbody emissivity
        reflectedTemp: this.environmentalConditions?.ambientTemp || 20
      });
    }

    return targets;
  }

  /**
   * Generate calibration steps
   */
  private generateCalibrationSteps(): CalibrationStep[] {
    const steps: CalibrationStep[] = [];

    // Environmental stabilization
    steps.push({
      name: 'Environmental Stabilization',
      description: 'Allow environment and equipment to stabilize',
      type: 'wait',
      duration: this.settings.environmentalStabilizationTime * 1000,
      completed: false
    });

    // Target setup and measurement steps
    for (let i = 0; i < this.targets.length; i++) {
      const target = this.targets[i];

      steps.push({
        name: `Setup Target ${i + 1}`,
        description: `Set up ${target.type} at ${target.temperature}°C`,
        type: 'move',
        targetPosition: target.position ? { 
          x: target.position.x, 
          y: target.position.y, 
          z: target.temperature 
        } : undefined,
        completed: false
      });

      steps.push({
        name: `Measure Target ${i + 1}`,
        description: `Measure temperature of target ${i + 1}`,
        type: 'capture',
        duration: this.settings.measurementDuration * 1000,
        completed: false
      });
    }

    // Data processing
    steps.push({
      name: 'Process Calibration Data',
      description: 'Calculate calibration parameters',
      type: 'wait',
      duration: 5000,
      completed: false
    });

    // Validation
    steps.push({
      name: 'Validate Calibration',
      description: 'Test calibration accuracy',
      type: 'capture',
      duration: 30000,
      completed: false
    });

    return steps;
  }

  /**
   * Process next calibration step
   */
  private async processNextStep(): Promise<void> {
    if (!this.calibrationSession) return;

    const currentStep = this.calibrationSession.steps.find(s => !s.completed);
    if (!currentStep) {
      await this.completeCalibration();
      return;
    }

    this.emit('step-started', currentStep);

    try {
      switch (currentStep.name) {
        case 'Environmental Stabilization':
          await this.environmentalStabilization(currentStep);
          break;
        case currentStep.name.startsWith('Setup Target') ? currentStep.name : '':
          await this.setupTarget(currentStep);
          break;
        case currentStep.name.startsWith('Measure Target') ? currentStep.name : '':
          await this.measureTarget(currentStep);
          break;
        case 'Process Calibration Data':
          await this.processCalibrationData(currentStep);
          break;
        case 'Validate Calibration':
          await this.validateCalibration(currentStep);
          break;
      }

      currentStep.completed = true;
      this.emit('step-completed', currentStep);

      // Move to next step
      setTimeout(() => this.processNextStep(), 1000);

    } catch (error) {
      this.emit('step-failed', { step: currentStep, error });
      logger.error('Calibration step failed', error);
    }
  }

  /**
   * Environmental stabilization step
   */
  private async environmentalStabilization(step: CalibrationStep): Promise<void> {
    if (!step.duration) return;

    this.emit('stabilization-started', {
      duration: step.duration,
      conditions: this.environmentalConditions
    });

    // Wait for stabilization
    await new Promise(resolve => setTimeout(resolve, step.duration));

    // Check environmental conditions
    if (this.environmentalConditions) {
      const conditions = this.environmentalConditions;
      const warnings: string[] = [];

      if (conditions.humidity > 80) {
        warnings.push('High humidity may affect accuracy');
      }

      if (Math.abs(conditions.ambientTemp - 22) > 10) {
        warnings.push('Extreme ambient temperature detected');
      }

      if (warnings.length > 0) {
        this.emit('environmental-warnings', warnings);
      }
    }

    this.emit('stabilization-completed');
  }

  /**
   * Setup calibration target
   */
  private async setupTarget(step: CalibrationStep): Promise<void> {
    const targetIndex = this.getCurrentTargetIndex(step.name);
    const target = this.targets[targetIndex];

    if (!target) throw new Error('Target not found');

    this.emit('target-setup-started', {
      targetIndex,
      target,
      instructions: this.getTargetSetupInstructions(target)
    });

    // Wait for user to set up target (in real implementation)
    await new Promise(resolve => setTimeout(resolve, 5000));

    this.emit('target-setup-completed', { targetIndex, target });
  }

  /**
   * Get target setup instructions
   */
  private getTargetSetupInstructions(target: CalibrationTarget): string[] {
    const instructions: string[] = [];

    switch (target.type) {
      case 'blackbody':
        instructions.push(`Set blackbody temperature to ${target.temperature}°C`);
        instructions.push('Wait for temperature stabilization');
        instructions.push('Ensure blackbody is in camera field of view');
        instructions.push(`Verify emissivity setting: ${target.emissivity}`);
        break;
      case 'reference_object':
        instructions.push(`Use reference object at ${target.temperature}°C`);
        instructions.push(`Set emissivity to ${target.emissivity}`);
        instructions.push('Position object in center of field of view');
        break;
      case 'ambient':
        instructions.push('Measure ambient temperature');
        instructions.push('Use object with known emissivity');
        instructions.push('Ensure uniform temperature across surface');
        break;
    }

    return instructions;
  }

  /**
   * Measure calibration target
   */
  private async measureTarget(step: CalibrationStep): Promise<void> {
    const targetIndex = this.getCurrentTargetIndex(step.name);
    const target = this.targets[targetIndex];

    if (!target) throw new Error('Target not found');

    this.emit('measurement-started', {
      targetIndex,
      target,
      duration: step.duration || this.settings.measurementDuration * 1000
    });

    // Start measurement collection
    const measurements: number[] = [];
    const measurementInterval = 1000; // 1 second intervals
    const totalMeasurements = (step.duration || this.settings.measurementDuration * 1000) / measurementInterval;

    for (let i = 0; i < totalMeasurements; i++) {
      // In real implementation, this would capture actual thermal frame
      const mockTemp = target.temperature + (Math.random() - 0.5) * 2; // ±1°C noise
      measurements.push(mockTemp);

      this.emit('measurement-progress', {
        targetIndex,
        progress: (i + 1) / totalMeasurements,
        currentTemp: mockTemp,
        expectedTemp: target.temperature
      });

      await new Promise(resolve => setTimeout(resolve, measurementInterval));
    }

    // Calculate statistics
    const stats = this.calculateMeasurementStatistics(measurements);
    
    const measurement: CalibrationMeasurement = {
      targetIndex,
      target,
      measurements,
      statistics: stats,
      environmentalConditions: this.environmentalConditions!,
      timestamp: Date.now()
    };

    this.measurements.push(measurement);

    this.emit('measurement-completed', {
      targetIndex,
      target,
      statistics: stats,
      deviation: Math.abs(stats.mean - target.temperature)
    });
  }

  /**
   * Calculate measurement statistics
   */
  private calculateMeasurementStatistics(measurements: number[]): {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    median: number;
  } {
    const sorted = [...measurements].sort((a, b) => a - b);
    const mean = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    const variance = measurements.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / measurements.length;
    
    return {
      mean,
      stdDev: Math.sqrt(variance),
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)]
    };
  }

  /**
   * Process calibration data
   */
  private async processCalibrationData(step: CalibrationStep): Promise<void> {
    this.emit('processing-started', {
      measurementCount: this.measurements.length
    });

    // Calculate calibration parameters using least squares regression
    const calibrationResult = this.calculateCalibrationParameters();

    if (!calibrationResult.success) {
      throw new Error('Calibration parameter calculation failed');
    }

    this.emit('processing-completed', calibrationResult);
  }

  /**
   * Calculate calibration parameters
   */
  private calculateCalibrationParameters(): CalibrationResult {
    if (this.measurements.length < 3) {
      return {
        success: false,
        accuracy: 999,
        calibrationMatrix: [],
        temperatureCorrection: (rawTemp: number) => rawTemp,
        validationMetrics: this.getEmptyValidationMetrics(),
        recommendations: ['Insufficient calibration data']
      };
    }

    // Prepare data for regression
    const dataPoints: Array<{ x: number; y: number; emissivity: number; distance: number }> = [];
    
    for (const measurement of this.measurements) {
      const measuredTemp = measurement.statistics.mean;
      const referenceTemp = measurement.target.temperature;
      
      dataPoints.push({
        x: measuredTemp,
        y: referenceTemp,
        emissivity: measurement.target.emissivity,
        distance: 1.0 // Default distance if not measured
      });
    }

    // Simple linear regression for now (could be extended to multivariate)
    const regression = this.performLinearRegression(dataPoints);
    
    // Create calibration matrix [slope, intercept, emissivity_factor, distance_factor]
    const calibrationMatrix = [
      regression.slope,
      regression.intercept,
      1.0, // Emissivity factor
      0.0  // Distance factor
    ];

    // Create temperature correction function
    const temperatureCorrection = (rawTemp: number, emissivity = 0.95, distance = 1.0): number => {
      let correctedTemp = rawTemp * calibrationMatrix[0] + calibrationMatrix[1];
      
      // Apply emissivity correction
      correctedTemp = correctedTemp / emissivity;
      
      // Apply distance correction (atmospheric absorption)
      const atmosphericLoss = distance * 0.01; // 1% per meter (simplified)
      correctedTemp = correctedTemp / (1 - atmosphericLoss);
      
      return correctedTemp;
    };

    // Calculate validation metrics
    const validationMetrics = this.calculateValidationMetrics(dataPoints, temperatureCorrection);
    
    // Generate recommendations
    const recommendations = this.generateCalibrationRecommendations(validationMetrics, calibrationMatrix);

    const result: CalibrationResult = {
      success: validationMetrics.meanAbsoluteError <= this.settings.accuracyRequirement,
      accuracy: validationMetrics.meanAbsoluteError,
      calibrationMatrix,
      temperatureCorrection,
      validationMetrics,
      recommendations
    };

    return result;
  }

  /**
   * Perform linear regression
   */
  private performLinearRegression(dataPoints: Array<{ x: number; y: number }>): {
    slope: number;
    intercept: number;
    correlation: number;
  } {
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point) => sum + point.x, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.y, 0);
    const sumXY = dataPoints.reduce((sum, point) => sum + point.x * point.y, 0);
    const sumXX = dataPoints.reduce((sum, point) => sum + point.x * point.x, 0);
    const sumYY = dataPoints.reduce((sum, point) => sum + point.y * point.y, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate correlation coefficient
    const numerator = n * sumXY - sumX * sumY;
    const denominatorX = Math.sqrt(n * sumXX - sumX * sumX);
    const denominatorY = Math.sqrt(n * sumYY - sumY * sumY);
    const correlation = numerator / (denominatorX * denominatorY);

    return { slope, intercept, correlation };
  }

  /**
   * Calculate validation metrics
   */
  private calculateValidationMetrics(
    dataPoints: Array<{ x: number; y: number }>,
    correctionFunction: (temp: number) => number
  ): ValidationMetrics {
    const errors: number[] = [];
    let outlierCount = 0;

    for (const point of dataPoints) {
      const correctedTemp = correctionFunction(point.x);
      const error = Math.abs(correctedTemp - point.y);
      errors.push(error);

      if (error > this.settings.accuracyRequirement * 2) {
        outlierCount++;
      }
    }

    const meanAbsoluteError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
    const rootMeanSquareError = Math.sqrt(
      errors.reduce((sum, err) => sum + err * err, 0) / errors.length
    );
    const maxError = Math.max(...errors);

    // Calculate correlation between corrected and reference temperatures
    const correctedTemps = dataPoints.map(p => correctionFunction(p.x));
    const referenceTemps = dataPoints.map(p => p.y);
    const correlation = this.calculateCorrelation(correctedTemps, referenceTemps);

    // Calculate confidence interval (95%)
    const sortedErrors = [...errors].sort((a, b) => a - b);
    const lowerIndex = Math.floor(errors.length * 0.025);
    const upperIndex = Math.floor(errors.length * 0.975);

    return {
      meanAbsoluteError,
      rootMeanSquareError,
      maxError,
      correlation,
      outlierCount,
      confidenceInterval: {
        lower: sortedErrors[lowerIndex] || 0,
        upper: sortedErrors[upperIndex] || 0
      }
    };
  }

  /**
   * Calculate correlation coefficient
   */
  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominatorX = Math.sqrt(n * sumXX - sumX * sumX);
    const denominatorY = Math.sqrt(n * sumYY - sumY * sumY);

    return denominatorX && denominatorY ? numerator / (denominatorX * denominatorY) : 0;
  }

  /**
   * Generate calibration recommendations
   */
  private generateCalibrationRecommendations(
    metrics: ValidationMetrics,
    calibrationMatrix: number[]
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.meanAbsoluteError > this.settings.accuracyRequirement) {
      recommendations.push(`Accuracy requirement not met (${metrics.meanAbsoluteError.toFixed(2)}°C > ${this.settings.accuracyRequirement}°C)`);
      recommendations.push('Consider using more calibration targets');
      recommendations.push('Check environmental stability');
    }

    if (metrics.correlation < 0.95) {
      recommendations.push('Poor correlation detected - check measurement consistency');
      recommendations.push('Verify target temperatures with external reference');
    }

    if (metrics.outlierCount > 0) {
      recommendations.push(`${metrics.outlierCount} outlier(s) detected - review calibration targets`);
    }

    if (Math.abs(calibrationMatrix[0] - 1.0) > 0.1) {
      recommendations.push('Significant gain correction required - check sensor linearity');
    }

    if (Math.abs(calibrationMatrix[1]) > 5.0) {
      recommendations.push('Large offset correction required - check sensor bias');
    }

    if (recommendations.length === 0) {
      recommendations.push('Calibration completed successfully');
      recommendations.push('No significant issues detected');
    }

    return recommendations;
  }

  /**
   * Validate calibration
   */
  private async validateCalibration(step: CalibrationStep): Promise<void> {
    this.emit('validation-started');

    // Perform validation measurements with known references
    // This would involve measuring additional targets not used in calibration

    await new Promise(resolve => setTimeout(resolve, step.duration || 30000));

    this.emit('validation-completed', {
      success: true,
      accuracy: 1.5 // Mock validation result
    });
  }

  /**
   * Complete calibration process
   */
  private async completeCalibration(): Promise<void> {
    if (!this.calibrationSession) return;

    const calibrationResult = this.calculateCalibrationParameters();

    if (calibrationResult.success) {
      const calibrationData: ThermalCalibration = {
        blackbodyTemp: this.targets[0]?.temperature || 20,
        emissivity: 0.95,
        reflectedTemp: this.environmentalConditions?.ambientTemp || 20,
        atmosphericTemp: this.environmentalConditions?.ambientTemp || 20,
        relativeHumidity: this.environmentalConditions?.humidity || 50,
        distance: 1.0,
        transmittance: 0.95,
        timestamp: new Date(),
        accuracy: calibrationResult.accuracy,
        calibrationMatrix: calibrationResult.calibrationMatrix
      };

      this.calibrationSession.result = calibrationData;
      this.calibrationSession.status = 'completed';
      this.calibrationSession.endTime = new Date();

      this.emit('calibration-completed', {
        session: this.calibrationSession,
        result: calibrationResult,
        calibrationData
      });

    } else {
      this.calibrationSession.status = 'failed';
      this.calibrationSession.error = 'Calibration accuracy requirements not met';

      this.emit('calibration-failed', {
        session: this.calibrationSession,
        result: calibrationResult
      });
    }

    logger.info('Thermal calibration completed', {
      success: calibrationResult.success,
      accuracy: calibrationResult.accuracy
    });
  }

  /**
   * Get current target index from step name
   */
  private getCurrentTargetIndex(stepName: string): number {
    const match = stepName.match(/Target (\d+)/);
    return match ? parseInt(match[1]) - 1 : 0;
  }

  /**
   * Get empty validation metrics
   */
  private getEmptyValidationMetrics(): ValidationMetrics {
    return {
      meanAbsoluteError: 0,
      rootMeanSquareError: 0,
      maxError: 0,
      correlation: 0,
      outlierCount: 0,
      confidenceInterval: { lower: 0, upper: 0 }
    };
  }

  /**
   * Add measurement from external source
   */
  addMeasurement(frame: ThermalFrame, targetTemp: number, emissivity = 0.95): void {
    // Extract temperature from specific region of frame
    const regionTemp = this.extractRegionTemperature(frame);
    
    if (this.calibrationSession && this.calibrationSession.status === 'in_progress') {
      // Add to current calibration process
      this.emit('external-measurement', {
        measuredTemp: regionTemp,
        targetTemp,
        deviation: Math.abs(regionTemp - targetTemp)
      });
    }
  }

  /**
   * Extract temperature from region of interest
   */
  private extractRegionTemperature(frame: ThermalFrame): number {
    // Simple center region extraction for now
    const centerX = Math.floor(frame.width / 2);
    const centerY = Math.floor(frame.height / 2);
    const regionSize = 10;

    let sum = 0;
    let count = 0;

    for (let y = centerY - regionSize; y <= centerY + regionSize; y++) {
      for (let x = centerX - regionSize; x <= centerX + regionSize; x++) {
        if (x >= 0 && x < frame.width && y >= 0 && y < frame.height) {
          const index = y * frame.width + x;
          sum += frame.temperatureData[index];
          count++;
        }
      }
    }

    return count > 0 ? sum / count : 0;
  }

  /**
   * Cancel calibration
   */
  cancelCalibration(): void {
    if (this.calibrationSession) {
      this.calibrationSession.status = 'failed';
      this.calibrationSession.error = 'Calibration cancelled by user';
      
      this.emit('calibration-cancelled', this.calibrationSession);
      logger.info('Thermal calibration cancelled');
    }
  }

  /**
   * Get calibration session
   */
  getCalibrationSession(): CalibrationSession | null {
    return this.calibrationSession;
  }

  /**
   * Get calibration settings
   */
  getSettings(): CalibrationSettings {
    return { ...this.settings };
  }

  /**
   * Update calibration settings
   */
  updateSettings(newSettings: Partial<CalibrationSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.emit('settings-updated', this.settings);
  }

  /**
   * Get progress
   */
  getProgress(): number {
    if (!this.calibrationSession) return 0;
    
    const completed = this.calibrationSession.steps.filter(s => s.completed).length;
    return completed / this.calibrationSession.steps.length;
  }

  /**
   * Save calibration data
   */
  async saveCalibration(calibrationData: ThermalCalibration, filePath: string): Promise<void> {
    
    const saveData = {
      calibration: calibrationData,
      measurements: this.measurements,
      environmentalConditions: this.environmentalConditions,
      settings: this.settings,
      exportTime: new Date().toISOString()
    };

    fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2));
    logger.info(`Calibration data saved to ${filePath}`);
  }

  /**
   * Load calibration data
   */
  async loadCalibration(filePath: string): Promise<ThermalCalibration> {
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    if (data.measurements) {
      this.measurements = data.measurements;
    }
    
    if (data.environmentalConditions) {
      this.environmentalConditions = data.environmentalConditions;
    }

    this.emit('calibration-loaded', data.calibration);
    logger.info(`Calibration data loaded from ${filePath}`);
    
    return data.calibration;
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.calibrationSession = null;
    this.targets = [];
    this.measurements = [];
    this.environmentalConditions = null;
    
    this.removeAllListeners();
  }
}

interface CalibrationMeasurement {
  targetIndex: number;
  target: CalibrationTarget;
  measurements: number[];
  statistics: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    median: number;
  };
  environmentalConditions: EnvironmentalConditions;
  timestamp: number;
}