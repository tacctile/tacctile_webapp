import { EventEmitter } from 'events';
import {
  SpectralBand,
  SpectralExposureSettings,
  ExposureMode,
  SpectralFrame,
  MultiSpectralCamera,
  SPECTRAL_BAND_INFO
} from '../types';
import { logger } from '../../../utils/logger';

export class SpectralExposureController extends EventEmitter {
  private camera: MultiSpectralCamera;
  private exposureSettings: SpectralExposureSettings;
  private autoExposureTargets: Map<SpectralBand, number>;
  private exposureProfiles: Map<string, ExposureProfile>;
  private meteringModes: Map<SpectralBand, MeteringMode>;
  private isAutoExposureActive: boolean;
  private exposureHistory: ExposureHistoryEntry[];
  private bracketingSettings?: BracketingSettings;

  constructor(camera: MultiSpectralCamera) {
    super();
    this.camera = camera;
    this.isAutoExposureActive = false;
    this.exposureHistory = [];
    
    this.initializeDefaultExposureSettings();
    this.initializeAutoExposureTargets();
    this.initializeExposureProfiles();
    this.initializeMeteringModes();
  }

  private initializeDefaultExposureSettings(): void {
    // Initialize with band-specific default exposures
    this.exposureSettings = {
      [SpectralBand.UV_A]: SPECTRAL_BAND_INFO[SpectralBand.UV_A].typicalExposure,
      [SpectralBand.UV_B]: SPECTRAL_BAND_INFO[SpectralBand.UV_B].typicalExposure,
      [SpectralBand.UV_C]: SPECTRAL_BAND_INFO[SpectralBand.UV_C].typicalExposure,
      [SpectralBand.VISIBLE]: SPECTRAL_BAND_INFO[SpectralBand.VISIBLE].typicalExposure,
      [SpectralBand.RED]: SPECTRAL_BAND_INFO[SpectralBand.RED].typicalExposure,
      [SpectralBand.GREEN]: SPECTRAL_BAND_INFO[SpectralBand.GREEN].typicalExposure,
      [SpectralBand.BLUE]: SPECTRAL_BAND_INFO[SpectralBand.BLUE].typicalExposure,
      [SpectralBand.NIR]: SPECTRAL_BAND_INFO[SpectralBand.NIR].typicalExposure,
      [SpectralBand.SWIR]: SPECTRAL_BAND_INFO[SpectralBand.SWIR].typicalExposure,
      [SpectralBand.MWIR]: SPECTRAL_BAND_INFO[SpectralBand.MWIR].typicalExposure,
      [SpectralBand.LWIR]: SPECTRAL_BAND_INFO[SpectralBand.LWIR].typicalExposure,
      [SpectralBand.FULL_SPECTRUM]: SPECTRAL_BAND_INFO[SpectralBand.FULL_SPECTRUM].typicalExposure
    };
  }

  private initializeAutoExposureTargets(): void {
    // Target brightness levels for each spectral band (0-255 scale)
    this.autoExposureTargets = new Map([
      [SpectralBand.UV_A, 120],      // Slightly dimmer for UV
      [SpectralBand.UV_B, 110],
      [SpectralBand.UV_C, 100],
      [SpectralBand.VISIBLE, 128],   // Middle gray for visible
      [SpectralBand.RED, 125],
      [SpectralBand.GREEN, 130],     // Slightly brighter for green
      [SpectralBand.BLUE, 120],
      [SpectralBand.NIR, 140],       // Brighter for NIR (vegetation)
      [SpectralBand.SWIR, 110],
      [SpectralBand.MWIR, 100],      // Thermal bands use lower targets
      [SpectralBand.LWIR, 95],
      [SpectralBand.FULL_SPECTRUM, 125]
    ]);
  }

  private initializeExposureProfiles(): void {
    this.exposureProfiles = new Map();

    // Standard photography profile
    this.exposureProfiles.set('standard', {
      name: 'Standard Photography',
      description: 'Balanced exposure for general imaging',
      bandSettings: new Map([
        [SpectralBand.VISIBLE, { exposure: 10, gain: 1.0, priority: 'balanced' }],
        [SpectralBand.RED, { exposure: 15, gain: 1.0, priority: 'balanced' }],
        [SpectralBand.GREEN, { exposure: 8, gain: 1.0, priority: 'balanced' }],
        [SpectralBand.BLUE, { exposure: 12, gain: 1.0, priority: 'balanced' }],
        [SpectralBand.NIR, { exposure: 25, gain: 1.2, priority: 'balanced' }]
      ]),
      meteringMode: 'matrix',
      autoMode: true
    });

    // Scientific analysis profile
    this.exposureProfiles.set('scientific', {
      name: 'Scientific Analysis',
      description: 'Optimized for quantitative measurements',
      bandSettings: new Map([
        [SpectralBand.UV_A, { exposure: 50, gain: 1.5, priority: 'quality' }],
        [SpectralBand.UV_B, { exposure: 100, gain: 2.0, priority: 'quality' }],
        [SpectralBand.UV_C, { exposure: 200, gain: 2.5, priority: 'quality' }],
        [SpectralBand.VISIBLE, { exposure: 20, gain: 1.0, priority: 'quality' }],
        [SpectralBand.NIR, { exposure: 30, gain: 1.0, priority: 'quality' }],
        [SpectralBand.SWIR, { exposure: 60, gain: 1.8, priority: 'quality' }]
      ]),
      meteringMode: 'spot',
      autoMode: false
    });

    // High dynamic range profile
    this.exposureProfiles.set('hdr', {
      name: 'High Dynamic Range',
      description: 'Multiple exposures for extended dynamic range',
      bandSettings: new Map([
        [SpectralBand.VISIBLE, { exposure: 5, gain: 1.0, priority: 'speed' }],
        [SpectralBand.RED, { exposure: 8, gain: 1.0, priority: 'speed' }],
        [SpectralBand.GREEN, { exposure: 4, gain: 1.0, priority: 'speed' }],
        [SpectralBand.BLUE, { exposure: 6, gain: 1.0, priority: 'speed' }]
      ]),
      meteringMode: 'matrix',
      autoMode: true,
      bracketingEnabled: true,
      bracketingSteps: 5,
      bracketingRange: 3.0 // EV steps
    });

    // Forensic analysis profile
    this.exposureProfiles.set('forensic', {
      name: 'Forensic Analysis',
      description: 'UV and visible optimized for evidence capture',
      bandSettings: new Map([
        [SpectralBand.UV_A, { exposure: 80, gain: 2.0, priority: 'quality' }],
        [SpectralBand.UV_B, { exposure: 150, gain: 2.5, priority: 'quality' }],
        [SpectralBand.VISIBLE, { exposure: 15, gain: 1.0, priority: 'quality' }],
        [SpectralBand.BLUE, { exposure: 20, gain: 1.2, priority: 'quality' }]
      ]),
      meteringMode: 'center-weighted',
      autoMode: false
    });

    // Thermal imaging profile
    this.exposureProfiles.set('thermal', {
      name: 'Thermal Imaging',
      description: 'Optimized for thermal infrared bands',
      bandSettings: new Map([
        [SpectralBand.MWIR, { exposure: 30, gain: 1.0, priority: 'balanced' }],
        [SpectralBand.LWIR, { exposure: 40, gain: 1.0, priority: 'balanced' }],
        [SpectralBand.SWIR, { exposure: 50, gain: 1.2, priority: 'balanced' }]
      ]),
      meteringMode: 'matrix',
      autoMode: true
    });
  }

  private initializeMeteringModes(): void {
    // Default metering mode for each band
    this.meteringModes = new Map([
      [SpectralBand.UV_A, 'spot'],           // UV often needs spot metering
      [SpectralBand.UV_B, 'spot'],
      [SpectralBand.UV_C, 'spot'],
      [SpectralBand.VISIBLE, 'matrix'],      // Visible uses matrix metering
      [SpectralBand.RED, 'matrix'],
      [SpectralBand.GREEN, 'matrix'],
      [SpectralBand.BLUE, 'matrix'],
      [SpectralBand.NIR, 'center-weighted'], // NIR often center-weighted
      [SpectralBand.SWIR, 'center-weighted'],
      [SpectralBand.MWIR, 'matrix'],         // Thermal uses matrix
      [SpectralBand.LWIR, 'matrix'],
      [SpectralBand.FULL_SPECTRUM, 'matrix']
    ]);
  }

  async setExposureForBand(band: SpectralBand, exposureTime: number): Promise<boolean> {
    if (!this.camera.capabilities.supportedBands.includes(band)) {
      throw new Error(`Spectral band ${band} not supported by camera`);
    }

    const clampedExposure = this.clampExposureTime(exposureTime);
    
    if (clampedExposure !== exposureTime) {
      logger.warn(`Exposure time clamped from ${exposureTime}ms to ${clampedExposure}ms for ${band}`);
    }

    try {
      this.exposureSettings[band] = clampedExposure;
      
      // Apply to hardware if this is the current band
      if (this.camera.currentSettings.spectralBand === band) {
        await this.applyExposureToHardware(band, clampedExposure);
      }

      // Record in history
      this.addToExposureHistory(band, clampedExposure, 'manual');
      
      this.emit('exposure-changed', { band, exposureTime: clampedExposure });
      logger.debug(`Set exposure for ${band}: ${clampedExposure}ms`);
      
      return true;
    } catch (error) {
      logger.error(`Failed to set exposure for ${band}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  private clampExposureTime(exposureTime: number): number {
    return Math.max(
      this.camera.capabilities.minExposure,
      Math.min(this.camera.capabilities.maxExposure, exposureTime)
    );
  }

  private async applyExposureToHardware(band: SpectralBand, exposureTime: number): Promise<void> {
    // Simulate hardware communication
    logger.debug(`Applying exposure ${exposureTime}ms to hardware for ${band}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async performAutoExposure(band: SpectralBand, testFrame?: SpectralFrame): Promise<number> {
    if (!this.camera.capabilities.supportedBands.includes(band)) {
      throw new Error(`Spectral band ${band} not supported by camera`);
    }

    try {
      logger.info(`Performing auto exposure for ${band}`);
      this.isAutoExposureActive = true;
      this.emit('auto-exposure-started', { band });

      // Get current exposure as starting point
      let currentExposure = this.exposureSettings[band];
      const targetBrightness = this.autoExposureTargets.get(band) || 128;
      const meteringMode = this.meteringModes.get(band) || 'matrix';

      let bestExposure = currentExposure;
      let iterations = 0;
      const maxIterations = 8;
      const convergenceThreshold = 5; // brightness units

      while (iterations < maxIterations) {
        // Capture test frame or use provided frame
        const frame = testFrame || await this.captureTestFrame(band, currentExposure);
        
        // Analyze brightness based on metering mode
        const measuredBrightness = this.analyzeBrightness(frame, meteringMode);
        const brightnessError = targetBrightness - measuredBrightness;
        
        logger.debug(`Auto exposure iteration ${iterations + 1}: target=${targetBrightness}, measured=${measuredBrightness.toFixed(1)}, error=${brightnessError.toFixed(1)}`);

        // Check convergence
        if (Math.abs(brightnessError) < convergenceThreshold) {
          bestExposure = currentExposure;
          break;
        }

        // Calculate exposure adjustment
        const adjustmentFactor = this.calculateExposureAdjustment(brightnessError, measuredBrightness, targetBrightness);
        currentExposure = this.clampExposureTime(currentExposure * adjustmentFactor);

        // Prevent getting stuck in small oscillations
        if (iterations > 3 && Math.abs(brightnessError) < convergenceThreshold * 2) {
          bestExposure = currentExposure;
          break;
        }

        iterations++;
        
        // Emit progress
        this.emit('auto-exposure-progress', {
          band,
          iteration: iterations,
          currentExposure,
          measuredBrightness,
          targetBrightness,
          error: brightnessError
        });

        // Brief delay between iterations
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Apply final exposure setting
      await this.setExposureForBand(band, bestExposure);
      
      // Record successful auto exposure
      this.addToExposureHistory(band, bestExposure, 'auto', {
        iterations,
        finalBrightness: targetBrightness,
        meteringMode
      });

      this.emit('auto-exposure-completed', {
        band,
        finalExposure: bestExposure,
        iterations,
        converged: iterations < maxIterations
      });

      logger.info(`Auto exposure completed for ${band}: ${bestExposure}ms (${iterations} iterations)`);
      return bestExposure;
    } catch (error) {
      this.emit('auto-exposure-failed', { band, error });
      logger.error(`Auto exposure failed for ${band}:`, error);
      throw error;
    } finally {
      this.isAutoExposureActive = false;
    }
  }

  private async captureTestFrame(band: SpectralBand, exposureTime: number): Promise<SpectralFrame> {
    // Simulate test frame capture
    const width = 640;
    const height = 480;
    const size = width * height;
    
    // Generate test frame data with exposure-dependent brightness
    const rawData = new Float32Array(size);
    const baseIntensity = this.getBaseIntensityForBand(band);
    const exposureMultiplier = Math.sqrt(exposureTime / SPECTRAL_BAND_INFO[band].typicalExposure);
    
    for (let i = 0; i < size; i++) {
      // Create some spatial variation
      const x = (i % width) / width;
      const y = Math.floor(i / width) / height;
      const spatialVariation = 0.8 + 0.4 * (Math.sin(x * 6) + Math.cos(y * 8)) / 2;
      
      rawData[i] = (baseIntensity * exposureMultiplier * spatialVariation) + (Math.random() - 0.5) * 20;
    }

    // Convert to ImageData
    const imageData = new ImageData(width, height);
    const maxVal = Math.max(...rawData);
    const minVal = Math.min(...rawData);
    const range = maxVal - minVal;
    
    for (let i = 0; i < size; i++) {
      const normalized = ((rawData[i] - minVal) / range) * 255;
      const idx = i * 4;
      imageData.data[idx] = normalized;
      imageData.data[idx + 1] = normalized;
      imageData.data[idx + 2] = normalized;
      imageData.data[idx + 3] = 255;
    }

    return {
      id: `test_frame_${band}_${Date.now()}`,
      timestamp: Date.now(),
      frameNumber: 0,
      spectralBand: band,
      wavelengthRange: SPECTRAL_BAND_INFO[band].wavelengthRange,
      imageData,
      rawData,
      width,
      height,
      exposureTime,
      gain: 1.0,
      metadata: {
        captureSettings: {
          iso: 100,
          aperture: 2.8,
          shutterSpeed: exposureTime,
          whiteBalance: 5500
        },
        environmentalData: {
          temperature: 22,
          humidity: 45,
          pressure: 1013,
          lightLevel: 500
        },
        calibration: {
          darkFrame: false,
          flatField: false
        },
        processing: {
          demosaiced: false,
          corrected: false,
          normalized: false
        }
      }
    };
  }

  private getBaseIntensityForBand(band: SpectralBand): number {
    // Simulate different base intensities for different spectral bands
    const intensities: Record<SpectralBand, number> = {
      [SpectralBand.UV_A]: 800,
      [SpectralBand.UV_B]: 600,
      [SpectralBand.UV_C]: 400,
      [SpectralBand.VISIBLE]: 1200,
      [SpectralBand.RED]: 1100,
      [SpectralBand.GREEN]: 1300,
      [SpectralBand.BLUE]: 1000,
      [SpectralBand.NIR]: 1500,
      [SpectralBand.SWIR]: 900,
      [SpectralBand.MWIR]: 700,
      [SpectralBand.LWIR]: 650,
      [SpectralBand.FULL_SPECTRUM]: 1000
    };
    
    return intensities[band];
  }

  private analyzeBrightness(frame: SpectralFrame, meteringMode: MeteringMode): number {
    if (!frame.rawData) throw new Error('Frame missing raw data for brightness analysis');

    const data = Array.from(frame.rawData);
    
    switch (meteringMode) {
      case 'matrix':
        return this.calculateMatrixMetering(data, frame.width, frame.height);
      case 'center-weighted':
        return this.calculateCenterWeightedMetering(data, frame.width, frame.height);
      case 'spot':
        return this.calculateSpotMetering(data, frame.width, frame.height);
      default:
        return data.reduce((sum, val) => sum + val, 0) / data.length;
    }
  }

  private calculateMatrixMetering(data: number[], width: number, height: number): number {
    // Divide image into zones and weight them
    const zones = this.divideIntoZones(data, width, height, 9); // 3x3 grid
    const weights = [0.8, 1.0, 0.8, 1.0, 1.5, 1.0, 0.8, 1.0, 0.8]; // Center weighted
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < zones.length; i++) {
      const zoneAvg = zones[i].reduce((sum, val) => sum + val, 0) / zones[i].length;
      weightedSum += zoneAvg * weights[i];
      totalWeight += weights[i];
    }
    
    return weightedSum / totalWeight;
  }

  private calculateCenterWeightedMetering(data: number[], width: number, height: number): number {
    let weightedSum = 0;
    let totalWeight = 0;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const weight = Math.max(0.1, 1 - (distance / maxDistance) * 0.8);
        
        const index = y * width + x;
        weightedSum += data[index] * weight;
        totalWeight += weight;
      }
    }
    
    return weightedSum / totalWeight;
  }

  private calculateSpotMetering(data: number[], width: number, height: number): number {
    // Use center 5% of image
    const spotSize = Math.floor(Math.min(width, height) * 0.05);
    const centerX = Math.floor(width / 2);
    const centerY = Math.floor(height / 2);
    
    let sum = 0;
    let count = 0;
    
    for (let y = centerY - spotSize; y <= centerY + spotSize; y++) {
      for (let x = centerX - spotSize; x <= centerX + spotSize; x++) {
        if (x >= 0 && x < width && y >= 0 && y < height) {
          sum += data[y * width + x];
          count++;
        }
      }
    }
    
    return count > 0 ? sum / count : 0;
  }

  private divideIntoZones(data: number[], width: number, height: number, numZones: number): number[][] {
    const zonesPerRow = Math.sqrt(numZones);
    const zoneWidth = Math.floor(width / zonesPerRow);
    const zoneHeight = Math.floor(height / zonesPerRow);
    const zones: number[][] = [];
    
    for (let zoneY = 0; zoneY < zonesPerRow; zoneY++) {
      for (let zoneX = 0; zoneX < zonesPerRow; zoneX++) {
        const zone: number[] = [];
        
        for (let y = zoneY * zoneHeight; y < (zoneY + 1) * zoneHeight; y++) {
          for (let x = zoneX * zoneWidth; x < (zoneX + 1) * zoneWidth; x++) {
            if (x < width && y < height) {
              zone.push(data[y * width + x]);
            }
          }
        }
        
        zones.push(zone);
      }
    }
    
    return zones;
  }

  private calculateExposureAdjustment(error: number, currentBrightness: number, targetBrightness: number): number {
    // Use a logarithmic approach for exposure adjustment
    const ratio = targetBrightness / Math.max(currentBrightness, 1);
    
    // Limit adjustment to prevent overshooting
    const maxAdjustment = 4.0;
    const minAdjustment = 0.25;
    
    return Math.max(minAdjustment, Math.min(maxAdjustment, ratio));
  }

  async applyExposureProfile(profileName: string): Promise<boolean> {
    const profile = this.exposureProfiles.get(profileName);
    if (!profile) {
      throw new Error(`Exposure profile not found: ${profileName}`);
    }

    try {
      logger.info(`Applying exposure profile: ${profile.name}`);
      
      // Apply band-specific settings
      for (const [band, settings] of profile.bandSettings) {
        if (this.camera.capabilities.supportedBands.includes(band)) {
          await this.setExposureForBand(band, settings.exposure);
          this.meteringModes.set(band, profile.meteringMode);
        }
      }

      // Configure bracketing if enabled
      if (profile.bracketingEnabled) {
        this.bracketingSettings = {
          enabled: true,
          steps: profile.bracketingSteps || 3,
          range: profile.bracketingRange || 2.0,
          sequence: this.generateBracketingSequence(profile.bracketingSteps || 3, profile.bracketingRange || 2.0)
        };
      }

      this.emit('profile-applied', {
        profileName,
        profile,
        affectedBands: Array.from(profile.bandSettings.keys())
      });

      logger.info(`Exposure profile ${profile.name} applied successfully`);
      return true;
    } catch (error) {
      logger.error(`Failed to apply exposure profile ${profileName}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  private generateBracketingSequence(steps: number, range: number): number[] {
    const sequence: number[] = [];
    const stepSize = (range * 2) / (steps - 1);
    
    for (let i = 0; i < steps; i++) {
      const evAdjustment = -range + (i * stepSize);
      const multiplier = Math.pow(2, evAdjustment);
      sequence.push(multiplier);
    }
    
    return sequence;
  }

  async captureExposureBracket(band: SpectralBand, baseExposure?: number): Promise<SpectralFrame[]> {
    if (!this.bracketingSettings?.enabled) {
      throw new Error('Bracketing not enabled');
    }

    const exposure = baseExposure || this.exposureSettings[band];
    const frames: SpectralFrame[] = [];

    try {
      this.emit('bracketing-started', { band, baseExposure: exposure, steps: this.bracketingSettings.steps });

      for (let i = 0; i < this.bracketingSettings.sequence.length; i++) {
        const multiplier = this.bracketingSettings.sequence[i];
        const bracketExposure = this.clampExposureTime(exposure * multiplier);
        
        const frame = await this.captureTestFrame(band, bracketExposure);
        frames.push(frame);
        
        this.emit('bracket-progress', {
          band,
          step: i + 1,
          totalSteps: this.bracketingSettings.sequence.length,
          exposure: bracketExposure,
          multiplier
        });
      }

      this.emit('bracketing-completed', { band, frames: frames.length });
      return frames;
    } catch (error) {
      this.emit('bracketing-failed', { band, error });
      throw error;
    }
  }

  setAutoExposureTarget(band: SpectralBand, targetBrightness: number): void {
    if (targetBrightness < 0 || targetBrightness > 255) {
      throw new Error('Target brightness must be between 0 and 255');
    }

    this.autoExposureTargets.set(band, targetBrightness);
    this.emit('auto-target-changed', { band, target: targetBrightness });
    logger.debug(`Set auto exposure target for ${band}: ${targetBrightness}`);
  }

  setMeteringMode(band: SpectralBand, mode: MeteringMode): void {
    this.meteringModes.set(band, mode);
    this.emit('metering-mode-changed', { band, mode });
    logger.debug(`Set metering mode for ${band}: ${mode}`);
  }

  private addToExposureHistory(band: SpectralBand, exposure: number, method: 'manual' | 'auto', metadata?: any): void {
    const entry: ExposureHistoryEntry = {
      timestamp: Date.now(),
      band,
      exposure,
      method,
      metadata
    };

    this.exposureHistory.push(entry);
    
    // Keep only last 100 entries
    if (this.exposureHistory.length > 100) {
      this.exposureHistory.shift();
    }
  }

  getExposureForBand(band: SpectralBand): number {
    return this.exposureSettings[band];
  }

  getAllExposureSettings(): SpectralExposureSettings {
    return { ...this.exposureSettings };
  }

  getExposureProfiles(): ExposureProfile[] {
    return Array.from(this.exposureProfiles.values());
  }

  getAutoExposureTarget(band: SpectralBand): number {
    return this.autoExposureTargets.get(band) || 128;
  }

  getMeteringMode(band: SpectralBand): MeteringMode {
    return this.meteringModes.get(band) || 'matrix';
  }

  getExposureHistory(band?: SpectralBand, limit?: number): ExposureHistoryEntry[] {
    let history = [...this.exposureHistory];
    
    if (band) {
      history = history.filter(entry => entry.band === band);
    }
    
    if (limit) {
      history = history.slice(-limit);
    }
    
    return history.reverse(); // Most recent first
  }

  isAutoExposureRunning(): boolean {
    return this.isAutoExposureActive;
  }

  getBracketingSettings(): BracketingSettings | null {
    return this.bracketingSettings ? { ...this.bracketingSettings } : null;
  }

  setBracketingSettings(settings: Partial<BracketingSettings>): void {
    this.bracketingSettings = {
      enabled: settings.enabled ?? false,
      steps: settings.steps ?? 3,
      range: settings.range ?? 2.0,
      sequence: settings.sequence ?? this.generateBracketingSequence(settings.steps ?? 3, settings.range ?? 2.0)
    };
    
    this.emit('bracketing-settings-changed', this.bracketingSettings);
  }

  addCustomExposureProfile(name: string, profile: Omit<ExposureProfile, 'name'>): void {
    const completeProfile: ExposureProfile = {
      ...profile,
      name
    };
    
    this.exposureProfiles.set(name, completeProfile);
    this.emit('profile-added', { name, profile: completeProfile });
    logger.info(`Added custom exposure profile: ${name}`);
  }

  removeExposureProfile(name: string): boolean {
    if (this.exposureProfiles.delete(name)) {
      this.emit('profile-removed', name);
      logger.info(`Removed exposure profile: ${name}`);
      return true;
    }
    return false;
  }

  async emergencyStop(): Promise<void> {
    if (this.isAutoExposureActive) {
      logger.warn('Emergency stop triggered for exposure controller');
      this.isAutoExposureActive = false;
      this.emit('emergency-stop');
    }
  }

  destroy(): void {
    this.isAutoExposureActive = false;
    this.exposureHistory = [];
    this.exposureProfiles.clear();
    this.autoExposureTargets.clear();
    this.meteringModes.clear();
    this.removeAllListeners();
  }
}

// Supporting interfaces and types
interface ExposureProfile {
  name: string;
  description: string;
  bandSettings: Map<SpectralBand, {
    exposure: number;
    gain: number;
    priority: 'speed' | 'quality' | 'balanced';
  }>;
  meteringMode: MeteringMode;
  autoMode: boolean;
  bracketingEnabled?: boolean;
  bracketingSteps?: number;
  bracketingRange?: number; // EV range
}

interface ExposureHistoryEntry {
  timestamp: number;
  band: SpectralBand;
  exposure: number;
  method: 'manual' | 'auto';
  metadata?: any;
}

interface BracketingSettings {
  enabled: boolean;
  steps: number;
  range: number; // EV range
  sequence: number[]; // Exposure multipliers
}

type MeteringMode = 'matrix' | 'center-weighted' | 'spot';