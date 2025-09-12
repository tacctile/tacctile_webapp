import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  HardwareCalibrations,
  SensorCalibrations,
  DisplayCalibrations,
  InputCalibrations,
  AudioCalibrations,
  NetworkCalibrations,
  ValidationResult
} from './types';
import { ConfigurationManager } from './ConfigurationManager';

export interface CalibrationCertificate {
  id: string;
  sensorId: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  standard: string; // ISO, NIST, etc.
  accreditation: string;
  calibrationData: any;
  digitalSignature: string;
  attachments: string[]; // File paths to certificate documents
}

export interface CalibrationSchedule {
  sensorId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  lastCalibrated: string;
  nextDue: string;
  autoCalibrate: boolean;
  reminderEnabled: boolean;
  reminderDays: number; // Days before due date to remind
}

export interface CalibrationValidation {
  sensorId: string;
  validatedAt: string;
  validatedBy: string;
  method: 'automatic' | 'manual' | 'certified';
  referenceStandard: string;
  results: {
    accuracy: number;
    precision: number;
    drift: number;
    linearity: number;
    hysteresis: number;
    passed: boolean;
  };
  certificate?: string;
}

export interface CalibrationHistory {
  sensorId: string;
  calibrations: Array<{
    date: string;
    type: 'initial' | 'periodic' | 'verification' | 'adjustment';
    performedBy: string;
    method: string;
    beforeValues: Record<string, number>;
    afterValues: Record<string, number>;
    adjustment: Record<string, number>;
    certificate?: string;
    notes: string;
  }>;
}

export interface HardwareProfile {
  id: string;
  name: string;
  description: string;
  deviceType: 'sensor' | 'display' | 'audio' | 'input' | 'network';
  manufacturer: string;
  model: string;
  serialNumber: string;
  firmware: string;
  driver: string;
  capabilities: string[];
  specifications: Record<string, any>;
  calibrationRequirements: {
    frequency: string;
    method: string;
    standards: string[];
    environmentalConditions: {
      temperatureRange: { min: number; max: number };
      humidityRange: { min: number; max: number };
      pressureRange?: { min: number; max: number };
    };
  };
}

export class HardwareCalibrationManager extends EventEmitter {
  private configManager: ConfigurationManager;
  private calibrations: HardwareCalibrations;
  private certificates: Map<string, CalibrationCertificate> = new Map();
  private schedules: Map<string, CalibrationSchedule> = new Map();
  private validations: Map<string, CalibrationValidation[]> = new Map();
  private history: Map<string, CalibrationHistory> = new Map();
  private profiles: Map<string, HardwareProfile> = new Map();
  private certificatesPath: string;
  private schedulerInterval?: NodeJS.Timeout;

  constructor(configManager: ConfigurationManager, certificatesPath: string = './certificates') {
    super();
    this.configManager = configManager;
    this.certificatesPath = certificatesPath;
    this.calibrations = this.configManager.get('hardwareCalibrations', this.getDefaultCalibrations());
    
    this.setupScheduler();
    this.loadCertificates();
    this.loadSchedules();
    this.loadValidations();
    this.loadHistory();
    this.loadHardwareProfiles();
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Hardware Calibration Manager...');
      
      await this.ensureDirectories();
      await this.validateExistingCalibrations();
      await this.checkCalibrationSchedules();
      this.startScheduler();
      
      this.emit('calibration-manager-initialized');
      console.log('Hardware Calibration Manager initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize Hardware Calibration Manager:', error);
      this.emit('calibration-error', error);
      throw error;
    }
  }

  // Sensor Calibration Management
  public async addSensorCalibration(
    sensorId: string,
    calibrationData: HardwareCalibrations['sensors'][string]
  ): Promise<void> {
    try {
      // Validate calibration data
      const validationResults = this.validateSensorCalibration(calibrationData);
      if (validationResults.some(r => r.severity === 'error')) {
        throw new Error('Sensor calibration validation failed');
      }

      // Store calibration
      this.calibrations.sensors[sensorId] = {
        ...calibrationData,
        lastVerified: new Date().toISOString()
      };

      await this.saveCalibrations();
      
      // Create calibration schedule if needed
      await this.createCalibrationSchedule(sensorId, calibrationData);
      
      // Record in history
      await this.recordCalibrationHistory(sensorId, 'initial', calibrationData);
      
      this.emit('sensor-calibration-added', { sensorId, calibration: calibrationData });
      
    } catch (error) {
      console.error('Failed to add sensor calibration:', error);
      throw error;
    }
  }

  public async updateSensorCalibration(
    sensorId: string,
    updates: Partial<HardwareCalibrations['sensors'][string]>
  ): Promise<void> {
    const existing = this.calibrations.sensors[sensorId];
    if (!existing) {
      throw new Error(`Sensor calibration not found: ${sensorId}`);
    }

    const beforeValues = this.extractParameterValues(existing.parameters);
    const updatedCalibration = { ...existing, ...updates };
    
    // Validate updated calibration
    const validationResults = this.validateSensorCalibration(updatedCalibration);
    if (validationResults.some(r => r.severity === 'error')) {
      throw new Error('Updated sensor calibration validation failed');
    }

    this.calibrations.sensors[sensorId] = updatedCalibration;
    await this.saveCalibrations();
    
    // Record adjustment in history
    const afterValues = this.extractParameterValues(updatedCalibration.parameters);
    await this.recordCalibrationAdjustment(sensorId, beforeValues, afterValues);
    
    this.emit('sensor-calibration-updated', { sensorId, calibration: updatedCalibration });
  }

  public getSensorCalibration(sensorId: string): HardwareCalibrations['sensors'][string] | undefined {
    return this.calibrations.sensors[sensorId];
  }

  public listSensorCalibrations(): Array<{ id: string; calibration: HardwareCalibrations['sensors'][string] }> {
    return Object.entries(this.calibrations.sensors).map(([id, calibration]) => ({ id, calibration }));
  }

  public async deleteSensorCalibration(sensorId: string): Promise<void> {
    if (!this.calibrations.sensors[sensorId]) {
      throw new Error(`Sensor calibration not found: ${sensorId}`);
    }

    delete this.calibrations.sensors[sensorId];
    await this.saveCalibrations();
    
    // Clean up related data
    this.schedules.delete(sensorId);
    this.validations.delete(sensorId);
    this.history.delete(sensorId);
    
    this.emit('sensor-calibration-deleted', sensorId);
  }

  // Display Calibration Management
  public async addDisplayCalibration(
    displayId: string,
    calibrationData: HardwareCalibrations['displays'][string]
  ): Promise<void> {
    const validationResults = this.validateDisplayCalibration(calibrationData);
    if (validationResults.some(r => r.severity === 'error')) {
      throw new Error('Display calibration validation failed');
    }

    this.calibrations.displays[displayId] = calibrationData;
    await this.saveCalibrations();
    
    this.emit('display-calibration-added', { displayId, calibration: calibrationData });
  }

  public async updateDisplayCalibration(
    displayId: string,
    updates: Partial<HardwareCalibrations['displays'][string]>
  ): Promise<void> {
    const existing = this.calibrations.displays[displayId];
    if (!existing) {
      throw new Error(`Display calibration not found: ${displayId}`);
    }

    const updatedCalibration = { ...existing, ...updates };
    const validationResults = this.validateDisplayCalibration(updatedCalibration);
    if (validationResults.some(r => r.severity === 'error')) {
      throw new Error('Updated display calibration validation failed');
    }

    this.calibrations.displays[displayId] = updatedCalibration;
    await this.saveCalibrations();
    
    this.emit('display-calibration-updated', { displayId, calibration: updatedCalibration });
  }

  // Audio Calibration Management
  public async addAudioCalibration(
    deviceId: string,
    type: 'input' | 'output',
    calibrationData: any
  ): Promise<void> {
    if (type === 'input') {
      this.calibrations.audio.input[deviceId] = calibrationData;
    } else {
      this.calibrations.audio.output[deviceId] = calibrationData;
    }
    
    await this.saveCalibrations();
    this.emit('audio-calibration-added', { deviceId, type, calibration: calibrationData });
  }

  // Certificate Management
  public async addCalibrationCertificate(certificate: CalibrationCertificate): Promise<void> {
    // Validate certificate
    if (!this.validateCertificate(certificate)) {
      throw new Error('Invalid calibration certificate');
    }

    this.certificates.set(certificate.id, certificate);
    await this.saveCertificates();
    
    // Update sensor calibration with certificate reference
    const sensor = this.calibrations.sensors[certificate.sensorId];
    if (sensor) {
      sensor.calibrationCertificate = path.join(this.certificatesPath, `${certificate.id}.json`);
      await this.saveCalibrations();
    }
    
    this.emit('certificate-added', certificate);
  }

  public getCertificate(certificateId: string): CalibrationCertificate | undefined {
    return this.certificates.get(certificateId);
  }

  public getCertificatesForSensor(sensorId: string): CalibrationCertificate[] {
    return Array.from(this.certificates.values())
      .filter(cert => cert.sensorId === sensorId)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }

  public async verifyCertificate(certificateId: string): Promise<boolean> {
    const certificate = this.certificates.get(certificateId);
    if (!certificate) return false;

    try {
      // Verify digital signature
      const data = JSON.stringify({
        sensorId: certificate.sensorId,
        issuedBy: certificate.issuedBy,
        issuedAt: certificate.issuedAt,
        calibrationData: certificate.calibrationData
      });
      
      // This is a simplified verification - real implementation would use proper cryptography
      const expectedSignature = crypto.createHash('sha256').update(data).digest('hex');
      return certificate.digitalSignature === expectedSignature;
      
    } catch (error) {
      console.error('Certificate verification failed:', error);
      return false;
    }
  }

  // Calibration Scheduling
  public async createCalibrationSchedule(
    sensorId: string,
    calibrationData: HardwareCalibrations['sensors'][string]
  ): Promise<void> {
    const schedule: CalibrationSchedule = {
      sensorId,
      frequency: this.determineCalibrationFrequency(calibrationData),
      lastCalibrated: calibrationData.calibrationDate,
      nextDue: this.calculateNextCalibrationDate(calibrationData.calibrationDate, calibrationData.expiryDate),
      autoCalibrate: false,
      reminderEnabled: true,
      reminderDays: 7
    };

    this.schedules.set(sensorId, schedule);
    await this.saveSchedules();
    
    this.emit('schedule-created', schedule);
  }

  public async updateCalibrationSchedule(
    sensorId: string,
    updates: Partial<CalibrationSchedule>
  ): Promise<void> {
    const existing = this.schedules.get(sensorId);
    if (!existing) {
      throw new Error(`Schedule not found for sensor: ${sensorId}`);
    }

    const updatedSchedule = { ...existing, ...updates };
    this.schedules.set(sensorId, updatedSchedule);
    await this.saveSchedules();
    
    this.emit('schedule-updated', updatedSchedule);
  }

  public getCalibrationSchedule(sensorId: string): CalibrationSchedule | undefined {
    return this.schedules.get(sensorId);
  }

  public getOverdueCalibrations(): Array<{ sensorId: string; schedule: CalibrationSchedule; daysOverdue: number }> {
    const now = new Date();
    const overdue: Array<{ sensorId: string; schedule: CalibrationSchedule; daysOverdue: number }> = [];

    for (const [sensorId, schedule] of this.schedules) {
      const dueDate = new Date(schedule.nextDue);
      if (now > dueDate) {
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        overdue.push({ sensorId, schedule, daysOverdue });
      }
    }

    return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
  }

  public getUpcomingCalibrations(days: number = 30): Array<{ sensorId: string; schedule: CalibrationSchedule; daysUntilDue: number }> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    const upcoming: Array<{ sensorId: string; schedule: CalibrationSchedule; daysUntilDue: number }> = [];

    for (const [sensorId, schedule] of this.schedules) {
      const dueDate = new Date(schedule.nextDue);
      if (dueDate > now && dueDate <= futureDate) {
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        upcoming.push({ sensorId, schedule, daysUntilDue });
      }
    }

    return upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  }

  // Calibration Validation
  public async validateCalibration(
    sensorId: string,
    method: 'automatic' | 'manual' | 'certified' = 'automatic'
  ): Promise<CalibrationValidation> {
    const sensor = this.calibrations.sensors[sensorId];
    if (!sensor) {
      throw new Error(`Sensor not found: ${sensorId}`);
    }

    const validation: CalibrationValidation = {
      sensorId,
      validatedAt: new Date().toISOString(),
      validatedBy: method === 'manual' ? 'user' : 'system',
      method,
      referenceStandard: method === 'certified' ? 'NIST' : 'internal',
      results: await this.performCalibrationTest(sensor),
      certificate: method === 'certified' ? this.generateValidationCertificate(sensorId) : undefined
    };

    // Store validation results
    if (!this.validations.has(sensorId)) {
      this.validations.set(sensorId, []);
    }
    this.validations.get(sensorId)!.push(validation);
    await this.saveValidations();

    // Update sensor verification status
    sensor.lastVerified = validation.validatedAt;
    await this.saveCalibrations();

    this.emit('calibration-validated', validation);
    return validation;
  }

  public getValidationHistory(sensorId: string): CalibrationValidation[] {
    return this.validations.get(sensorId) || [];
  }

  // Hardware Profile Management
  public async addHardwareProfile(profile: HardwareProfile): Promise<void> {
    this.profiles.set(profile.id, profile);
    await this.saveHardwareProfiles();
    
    this.emit('hardware-profile-added', profile);
  }

  public getHardwareProfile(profileId: string): HardwareProfile | undefined {
    return this.profiles.get(profileId);
  }

  public listHardwareProfiles(deviceType?: string): HardwareProfile[] {
    const profiles = Array.from(this.profiles.values());
    return deviceType ? profiles.filter(p => p.deviceType === deviceType) : profiles;
  }

  // Import/Export
  public exportCalibrations(): any {
    return {
      calibrations: this.calibrations,
      certificates: Array.from(this.certificates.values()),
      schedules: Array.from(this.schedules.values()),
      validations: Object.fromEntries(this.validations),
      history: Object.fromEntries(this.history),
      profiles: Array.from(this.profiles.values()),
      exportedAt: new Date().toISOString()
    };
  }

  public async importCalibrations(data: any): Promise<void> {
    try {
      if (data.calibrations) {
        this.calibrations = data.calibrations;
        await this.saveCalibrations();
      }

      if (data.certificates) {
        for (const cert of data.certificates) {
          this.certificates.set(cert.id, cert);
        }
        await this.saveCertificates();
      }

      if (data.schedules) {
        for (const schedule of data.schedules) {
          this.schedules.set(schedule.sensorId, schedule);
        }
        await this.saveSchedules();
      }

      if (data.profiles) {
        for (const profile of data.profiles) {
          this.profiles.set(profile.id, profile);
        }
        await this.saveHardwareProfiles();
      }

      this.emit('calibrations-imported', data);
      
    } catch (error) {
      console.error('Failed to import calibrations:', error);
      throw error;
    }
  }

  // Private Methods
  private async saveCalibrations(): Promise<void> {
    await this.configManager.set('hardwareCalibrations', this.calibrations);
  }

  private async saveCertificates(): Promise<void> {
    const certificateFile = path.join(this.certificatesPath, 'certificates.json');
    const data = JSON.stringify(Array.from(this.certificates.values()), null, 2);
    await fs.writeFile(certificateFile, data, 'utf8');
  }

  private async saveSchedules(): Promise<void> {
    const scheduleFile = path.join(this.certificatesPath, 'schedules.json');
    const data = JSON.stringify(Array.from(this.schedules.values()), null, 2);
    await fs.writeFile(scheduleFile, data, 'utf8');
  }

  private async saveValidations(): Promise<void> {
    const validationFile = path.join(this.certificatesPath, 'validations.json');
    const data = JSON.stringify(Object.fromEntries(this.validations), null, 2);
    await fs.writeFile(validationFile, data, 'utf8');
  }

  private async saveHardwareProfiles(): Promise<void> {
    const profileFile = path.join(this.certificatesPath, 'profiles.json');
    const data = JSON.stringify(Array.from(this.profiles.values()), null, 2);
    await fs.writeFile(profileFile, data, 'utf8');
  }

  private async loadCertificates(): Promise<void> {
    try {
      const certificateFile = path.join(this.certificatesPath, 'certificates.json');
      const data = await fs.readFile(certificateFile, 'utf8');
      const certificates = JSON.parse(data);
      for (const cert of certificates) {
        this.certificates.set(cert.id, cert);
      }
    } catch (error) {
      console.log('No existing certificates found');
    }
  }

  private async loadSchedules(): Promise<void> {
    try {
      const scheduleFile = path.join(this.certificatesPath, 'schedules.json');
      const data = await fs.readFile(scheduleFile, 'utf8');
      const schedules = JSON.parse(data);
      for (const schedule of schedules) {
        this.schedules.set(schedule.sensorId, schedule);
      }
    } catch (error) {
      console.log('No existing schedules found');
    }
  }

  private async loadValidations(): Promise<void> {
    try {
      const validationFile = path.join(this.certificatesPath, 'validations.json');
      const data = await fs.readFile(validationFile, 'utf8');
      const validations = JSON.parse(data);
      this.validations = new Map(Object.entries(validations));
    } catch (error) {
      console.log('No existing validations found');
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const historyFile = path.join(this.certificatesPath, 'history.json');
      const data = await fs.readFile(historyFile, 'utf8');
      const history = JSON.parse(data);
      this.history = new Map(Object.entries(history));
    } catch (error) {
      console.log('No existing history found');
    }
  }

  private async loadHardwareProfiles(): Promise<void> {
    try {
      const profileFile = path.join(this.certificatesPath, 'profiles.json');
      const data = await fs.readFile(profileFile, 'utf8');
      const profiles = JSON.parse(data);
      for (const profile of profiles) {
        this.profiles.set(profile.id, profile);
      }
    } catch (error) {
      console.log('No existing hardware profiles found');
    }
  }

  private validateSensorCalibration(calibration: HardwareCalibrations['sensors'][string]): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check required fields
    if (!calibration.type) {
      results.push({
        path: 'type',
        message: 'Sensor type is required',
        severity: 'error',
        code: 'MISSING_SENSOR_TYPE'
      });
    }

    if (!calibration.calibrationDate) {
      results.push({
        path: 'calibrationDate',
        message: 'Calibration date is required',
        severity: 'error',
        code: 'MISSING_CALIBRATION_DATE'
      });
    }

    if (!calibration.expiryDate) {
      results.push({
        path: 'expiryDate',
        message: 'Expiry date is required',
        severity: 'error',
        code: 'MISSING_EXPIRY_DATE'
      });
    }

    // Check expiry
    if (calibration.expiryDate && new Date(calibration.expiryDate) < new Date()) {
      results.push({
        path: 'expiryDate',
        message: 'Calibration has expired',
        severity: 'warning',
        code: 'CALIBRATION_EXPIRED'
      });
    }

    // Validate parameters
    for (const [paramName, param] of Object.entries(calibration.parameters || {})) {
      if (param.value < param.range.min || param.value > param.range.max) {
        results.push({
          path: `parameters.${paramName}.value`,
          message: `Parameter ${paramName} value is outside acceptable range`,
          severity: 'error',
          code: 'PARAMETER_OUT_OF_RANGE'
        });
      }
    }

    return results;
  }

  private validateDisplayCalibration(calibration: HardwareCalibrations['displays'][string]): ValidationResult[] {
    const results: ValidationResult[] = [];

    if (calibration.brightness < 0 || calibration.brightness > 100) {
      results.push({
        path: 'brightness',
        message: 'Display brightness must be between 0 and 100',
        severity: 'error',
        code: 'INVALID_BRIGHTNESS'
      });
    }

    if (calibration.contrast < 0 || calibration.contrast > 100) {
      results.push({
        path: 'contrast',
        message: 'Display contrast must be between 0 and 100',
        severity: 'error',
        code: 'INVALID_CONTRAST'
      });
    }

    if (calibration.gamma < 1.0 || calibration.gamma > 3.0) {
      results.push({
        path: 'gamma',
        message: 'Display gamma must be between 1.0 and 3.0',
        severity: 'error',
        code: 'INVALID_GAMMA'
      });
    }

    return results;
  }

  private validateCertificate(certificate: CalibrationCertificate): boolean {
    return !!(certificate.id && 
             certificate.sensorId && 
             certificate.issuedBy && 
             certificate.issuedAt && 
             certificate.digitalSignature);
  }

  private async validateExistingCalibrations(): Promise<void> {
    for (const [sensorId, calibration] of Object.entries(this.calibrations.sensors)) {
      const results = this.validateSensorCalibration(calibration);
      const errors = results.filter(r => r.severity === 'error');
      if (errors.length > 0) {
        console.warn(`Sensor calibration ${sensorId} has validation errors:`, errors);
      }
    }
  }

  private async checkCalibrationSchedules(): Promise<void> {
    const overdue = this.getOverdueCalibrations();
    const upcoming = this.getUpcomingCalibrations(7); // Next 7 days

    if (overdue.length > 0) {
      this.emit('calibrations-overdue', overdue);
    }

    if (upcoming.length > 0) {
      this.emit('calibrations-due-soon', upcoming);
    }
  }

  private setupScheduler(): void {
    // Check schedules daily
    this.schedulerInterval = setInterval(async () => {
      await this.checkCalibrationSchedules();
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private startScheduler(): void {
    // Initial check
    this.checkCalibrationSchedules();
  }

  private determineCalibrationFrequency(calibration: HardwareCalibrations['sensors'][string]): CalibrationSchedule['frequency'] {
    // Logic to determine frequency based on sensor type and criticality
    if (calibration.type.includes('pressure') || calibration.type.includes('temperature')) {
      return 'monthly';
    } else if (calibration.type.includes('flow') || calibration.type.includes('level')) {
      return 'quarterly';
    } else {
      return 'yearly';
    }
  }

  private calculateNextCalibrationDate(calibrationDate: string, expiryDate: string): string {
    // Calculate next calibration date based on expiry
    const expiry = new Date(expiryDate);
    const nextCalibration = new Date(expiry.getTime() - (30 * 24 * 60 * 60 * 1000)); // 30 days before expiry
    return nextCalibration.toISOString();
  }

  private extractParameterValues(parameters: any): Record<string, number> {
    const values: Record<string, number> = {};
    for (const [name, param] of Object.entries(parameters || {})) {
      values[name] = (param as any).value;
    }
    return values;
  }

  private async recordCalibrationHistory(
    sensorId: string,
    type: 'initial' | 'periodic' | 'verification' | 'adjustment',
    calibrationData: any
  ): Promise<void> {
    if (!this.history.has(sensorId)) {
      this.history.set(sensorId, { sensorId, calibrations: [] });
    }

    const history = this.history.get(sensorId)!;
    history.calibrations.push({
      date: new Date().toISOString(),
      type,
      performedBy: 'system',
      method: 'automatic',
      beforeValues: {},
      afterValues: this.extractParameterValues(calibrationData.parameters),
      adjustment: {},
      notes: `${type} calibration performed`
    });

    // Keep only last 100 entries
    if (history.calibrations.length > 100) {
      history.calibrations.shift();
    }

    await this.saveValidations(); // Save history with validations
  }

  private async recordCalibrationAdjustment(
    sensorId: string,
    beforeValues: Record<string, number>,
    afterValues: Record<string, number>
  ): Promise<void> {
    if (!this.history.has(sensorId)) {
      this.history.set(sensorId, { sensorId, calibrations: [] });
    }

    const adjustment: Record<string, number> = {};
    for (const [param, afterValue] of Object.entries(afterValues)) {
      const beforeValue = beforeValues[param] || 0;
      adjustment[param] = afterValue - beforeValue;
    }

    const history = this.history.get(sensorId)!;
    history.calibrations.push({
      date: new Date().toISOString(),
      type: 'adjustment',
      performedBy: 'user',
      method: 'manual',
      beforeValues,
      afterValues,
      adjustment,
      notes: 'Calibration parameters adjusted'
    });

    await this.saveValidations();
  }

  private async performCalibrationTest(sensor: HardwareCalibrations['sensors'][string]): Promise<CalibrationValidation['results']> {
    // Simulate calibration test
    // Real implementation would interface with actual hardware
    
    return {
      accuracy: Math.random() * 100,
      precision: Math.random() * 100,
      drift: Math.random() * 10,
      linearity: Math.random() * 100,
      hysteresis: Math.random() * 5,
      passed: Math.random() > 0.1 // 90% pass rate for simulation
    };
  }

  private generateValidationCertificate(sensorId: string): string {
    const certificateId = `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return certificateId;
  }

  private getDefaultCalibrations(): HardwareCalibrations {
    return {
      sensors: {},
      displays: {},
      input: {
        mouse: {
          sensitivity: 1.0,
          acceleration: false,
          dpi: 800,
          pollRate: 125,
          buttonMapping: {}
        },
        keyboard: {
          repeatDelay: 500,
          repeatRate: 30,
          layout: 'US',
          customMapping: {}
        },
        touchpad: {
          sensitivity: 1.0,
          tapToClick: true,
          twoFingerScroll: true,
          threeFingerGestures: true,
          palmRejection: true
        }
      },
      audio: {
        input: {},
        output: {}
      },
      network: {
        latency: {},
        bandwidth: {},
        servers: {}
      }
    };
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.certificatesPath, { recursive: true });
  }

  public async dispose(): Promise<void> {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }

    await this.saveCertificates();
    await this.saveSchedules();
    await this.saveValidations();
    await this.saveHardwareProfiles();
    
    this.removeAllListeners();
  }
}