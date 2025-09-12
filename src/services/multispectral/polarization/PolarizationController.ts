import { EventEmitter } from 'events';
import {
  PolarizationController as IPolarizationController,
  PolarizationState,
  SpectralFrame,
  MultiSpectralEvent
} from '../types';
import { Logger } from '../../../utils/Logger';

const logger = new Logger('PolarizationController');

export class PolarizationController extends EventEmitter {
  private controller: IPolarizationController;
  private isCalibrated: boolean;
  private calibrationData: PolarizationCalibrationData;
  private stokesParameters: StokesParameters;
  private acquisitionMode: PolarizationAcquisitionMode;

  constructor(config: Partial<IPolarizationController>) {
    super();
    
    this.controller = {
      id: config.id || 'polarizer-default',
      name: config.name || 'Default Polarization Controller',
      type: config.type || 'motorized',
      currentState: PolarizationState.UNPOLARIZED,
      availableStates: config.availableStates || [
        PolarizationState.LINEAR_0,
        PolarizationState.LINEAR_45,
        PolarizationState.LINEAR_90,
        PolarizationState.LINEAR_135,
        PolarizationState.UNPOLARIZED
      ],
      rotationAngle: 0,
      isRotating: false,
      rotationSpeed: config.rotationSpeed || 10 // degrees/second
    };
    
    this.isCalibrated = false;
    this.calibrationData = this.initializeCalibration();
    this.stokesParameters = { s0: 0, s1: 0, s2: 0, s3: 0 };
    this.acquisitionMode = 'sequential';
    
    this.initializeController();
  }

  private initializeCalibration(): PolarizationCalibrationData {
    return {
      timestamp: new Date(),
      angularOffsets: new Map([
        [PolarizationState.LINEAR_0, 0],
        [PolarizationState.LINEAR_45, 45],
        [PolarizationState.LINEAR_90, 90],
        [PolarizationState.LINEAR_135, 135]
      ]),
      extinctionRatios: new Map([
        [PolarizationState.LINEAR_0, 1000],
        [PolarizationState.LINEAR_45, 1000],
        [PolarizationState.LINEAR_90, 1000],
        [PolarizationState.LINEAR_135, 1000]
      ]),
      transmissionEfficiency: new Map([
        [PolarizationState.LINEAR_0, 0.45],
        [PolarizationState.LINEAR_45, 0.45],
        [PolarizationState.LINEAR_90, 0.45],
        [PolarizationState.LINEAR_135, 0.45]
      ]),
      retardanceCalibration: {
        quarterWave: { retardance: 90, wavelength: 550 },
        halfWave: { retardance: 180, wavelength: 550 }
      },
      isValid: false
    };
  }

  private async initializeController(): Promise<void> {
    try {
      logger.info(`Initializing polarization controller: ${this.controller.name}`);
      
      // Initialize based on controller type
      switch (this.controller.type) {
        case 'manual':
          await this.initializeManualController();
          break;
        case 'motorized':
          await this.initializeMotorizedController();
          break;
        case 'liquid_crystal':
          await this.initializeLiquidCrystalController();
          break;
        default:
          throw new Error(`Unsupported controller type: ${this.controller.type}`);
      }

      // Perform initial homing
      await this.homeController();
      
      this.emit('controller-initialized', this.controller);
      logger.info(`Polarization controller initialized successfully`);
    } catch (error) {
      this.emit('error', error);
      logger.error(`Failed to initialize polarization controller:`, error);
    }
  }

  private async initializeManualController(): Promise<void> {
    logger.info('Initializing manual polarization controller');
    
    // Manual controllers don't require motorized initialization
    this.controller.rotationSpeed = 0; // Manual rotation
    this.controller.availableStates = [
      PolarizationState.LINEAR_0,
      PolarizationState.LINEAR_90,
      PolarizationState.UNPOLARIZED
    ];
    
    // Simulate manual controller ready
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async initializeMotorizedController(): Promise<void> {
    logger.info('Initializing motorized polarization controller');
    
    // Simulate motor controller connection
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Enable all polarization states for motorized controller
    this.controller.availableStates = [
      PolarizationState.LINEAR_0,
      PolarizationState.LINEAR_45,
      PolarizationState.LINEAR_90,
      PolarizationState.LINEAR_135,
      PolarizationState.CIRCULAR_LEFT,
      PolarizationState.CIRCULAR_RIGHT,
      PolarizationState.UNPOLARIZED
    ];
    
    // Set rotation parameters
    this.controller.rotationSpeed = 15; // degrees/second
  }

  private async initializeLiquidCrystalController(): Promise<void> {
    logger.info('Initializing liquid crystal polarization controller');
    
    // LC controllers can achieve any polarization state electronically
    await new Promise(resolve => setTimeout(resolve, 800));
    
    this.controller.availableStates = Object.values(PolarizationState);
    this.controller.rotationSpeed = 90; // Fast electronic switching
    this.acquisitionMode = 'simultaneous'; // Can measure multiple states at once
  }

  private async homeController(): Promise<void> {
    if (this.controller.type === 'manual') {
      logger.info('Manual controller - no homing required');
      return;
    }

    logger.info('Homing polarization controller...');
    this.controller.isRotating = true;
    this.emit('rotation-started');
    
    // Simulate homing movement
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    this.controller.rotationAngle = 0;
    this.controller.currentState = PolarizationState.LINEAR_0;
    this.controller.isRotating = false;
    
    this.emit('rotation-completed', { angle: 0, state: PolarizationState.LINEAR_0 });
    logger.info('Polarization controller homed successfully');
  }

  async setPolarizationState(state: PolarizationState): Promise<boolean> {
    if (!this.controller.availableStates.includes(state)) {
      throw new Error(`Polarization state ${state} not supported by this controller`);
    }

    if (this.controller.isRotating) {
      throw new Error('Controller is currently rotating');
    }

    if (this.controller.currentState === state) {
      logger.debug(`Already at polarization state: ${state}`);
      return true;
    }

    try {
      logger.info(`Setting polarization state to: ${state}`);
      
      const targetAngle = this.getAngleForState(state);
      await this.rotateTo(targetAngle);
      
      this.controller.currentState = state;
      this.emit('polarization-changed', { 
        state, 
        angle: this.controller.rotationAngle,
        timestamp: Date.now()
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to set polarization state to ${state}:`, error);
      this.emit('error', error);
      return false;
    }
  }

  private getAngleForState(state: PolarizationState): number {
    const baseAngles: Record<PolarizationState, number> = {
      [PolarizationState.LINEAR_0]: 0,
      [PolarizationState.LINEAR_45]: 45,
      [PolarizationState.LINEAR_90]: 90,
      [PolarizationState.LINEAR_135]: 135,
      [PolarizationState.CIRCULAR_LEFT]: 45,  // 45° + quarter wave plate
      [PolarizationState.CIRCULAR_RIGHT]: -45, // -45° + quarter wave plate
      [PolarizationState.UNPOLARIZED]: 0
    };

    let angle = baseAngles[state];
    
    // Apply calibration offset if available
    const offset = this.calibrationData.angularOffsets.get(state);
    if (offset !== undefined) {
      angle += offset;
    }
    
    return angle;
  }

  private async rotateTo(targetAngle: number): Promise<void> {
    const currentAngle = this.controller.rotationAngle;
    const angleDiff = this.normalizeAngle(targetAngle - currentAngle);
    
    if (Math.abs(angleDiff) < 0.1) {
      return; // Already at target
    }

    this.controller.isRotating = true;
    this.emit('rotation-started');
    
    try {
      // Calculate rotation time based on angle difference and speed
      const rotationTime = Math.abs(angleDiff) / this.controller.rotationSpeed * 1000;
      
      // Simulate rotation with progress updates
      const steps = 10;
      const stepTime = rotationTime / steps;
      const angleStep = angleDiff / steps;
      
      for (let i = 0; i < steps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepTime));
        this.controller.rotationAngle = this.normalizeAngle(currentAngle + angleStep * (i + 1));
        this.emit('rotation-progress', {
          currentAngle: this.controller.rotationAngle,
          targetAngle,
          progress: ((i + 1) / steps) * 100
        });
      }
      
      this.controller.rotationAngle = this.normalizeAngle(targetAngle);
      
    } finally {
      this.controller.isRotating = false;
      this.emit('rotation-completed', { 
        angle: this.controller.rotationAngle, 
        state: this.controller.currentState 
      });
    }
  }

  private normalizeAngle(angle: number): number {
    while (angle < 0) angle += 360;
    while (angle >= 360) angle -= 360;
    return angle;
  }

  async measureStokesParameters(frames: SpectralFrame[]): Promise<StokesParameters> {
    if (frames.length < 4) {
      throw new Error('At least 4 frames with different polarization states required for Stokes analysis');
    }

    try {
      logger.info('Computing Stokes parameters from polarimetric measurements');
      
      // Extract intensity measurements at different polarization angles
      const intensities = await this.extractPolarizedIntensities(frames);
      
      // Calculate Stokes parameters using standard formulation
      // S0 = I_0° + I_90°  (total intensity)
      // S1 = I_0° - I_90°  (linear polarization along 0°-90°)
      // S2 = I_45° - I_135° (linear polarization along 45°-135°)  
      // S3 = I_RCP - I_LCP (circular polarization)
      
      const s0 = intensities.i0 + intensities.i90;
      const s1 = intensities.i0 - intensities.i90;
      const s2 = intensities.i45 - intensities.i135;
      const s3 = (intensities.iRCP || 0) - (intensities.iLCP || 0);
      
      this.stokesParameters = { s0, s1, s2, s3 };
      
      // Calculate derived parameters
      const degreeOfPolarization = Math.sqrt(s1*s1 + s2*s2 + s3*s3) / s0;
      const angleOfPolarization = 0.5 * Math.atan2(s2, s1) * 180 / Math.PI;
      const ellipticity = 0.5 * Math.atan2(s3, Math.sqrt(s1*s1 + s2*s2)) * 180 / Math.PI;
      
      const result = {
        ...this.stokesParameters,
        degreeOfPolarization,
        angleOfPolarization,
        ellipticity
      };
      
      this.emit('stokes-computed', result);
      logger.info(`Stokes parameters computed: DoP=${degreeOfPolarization.toFixed(3)}, AoP=${angleOfPolarization.toFixed(1)}°`);
      
      return result;
    } catch (error) {
      logger.error('Failed to compute Stokes parameters:', error);
      this.emit('error', error);
      throw error;
    }
  }

  private async extractPolarizedIntensities(frames: SpectralFrame[]): Promise<PolarizedIntensities> {
    const intensities: PolarizedIntensities = {
      i0: 0,
      i45: 0,
      i90: 0,
      i135: 0
    };

    for (const frame of frames) {
      if (!frame.rawData || !frame.polarization) continue;
      
      // Calculate average intensity for this polarization state
      const avgIntensity = Array.from(frame.rawData).reduce((sum, val) => sum + val, 0) / frame.rawData.length;
      
      switch (frame.polarization) {
        case PolarizationState.LINEAR_0:
          intensities.i0 = avgIntensity;
          break;
        case PolarizationState.LINEAR_45:
          intensities.i45 = avgIntensity;
          break;
        case PolarizationState.LINEAR_90:
          intensities.i90 = avgIntensity;
          break;
        case PolarizationState.LINEAR_135:
          intensities.i135 = avgIntensity;
          break;
        case PolarizationState.CIRCULAR_LEFT:
          intensities.iLCP = avgIntensity;
          break;
        case PolarizationState.CIRCULAR_RIGHT:
          intensities.iRCP = avgIntensity;
          break;
      }
    }

    return intensities;
  }

  async performPolarimetricCalibration(): Promise<boolean> {
    if (this.controller.isRotating) {
      throw new Error('Cannot calibrate while controller is rotating');
    }

    try {
      logger.info('Starting polarimetric calibration sequence');
      this.emit('calibration-started');
      
      // Calibrate angular positions
      await this.calibrateAngularPositions();
      
      // Measure extinction ratios
      await this.measureExtinctionRatios();
      
      // Calibrate transmission efficiency
      await this.calibrateTransmissionEfficiency();
      
      // Verify retardance for circular polarization
      if (this.controller.availableStates.includes(PolarizationState.CIRCULAR_LEFT)) {
        await this.calibrateRetardance();
      }
      
      this.calibrationData.timestamp = new Date();
      this.calibrationData.isValid = true;
      this.isCalibrated = true;
      
      this.emit('calibration-completed', this.calibrationData);
      logger.info('Polarimetric calibration completed successfully');
      
      return true;
    } catch (error) {
      this.emit('calibration-failed', error);
      logger.error('Polarimetric calibration failed:', error);
      return false;
    }
  }

  private async calibrateAngularPositions(): Promise<void> {
    logger.info('Calibrating angular positions...');
    
    // For each linear polarization state, measure actual angle
    const linearStates = [
      PolarizationState.LINEAR_0,
      PolarizationState.LINEAR_45,
      PolarizationState.LINEAR_90,
      PolarizationState.LINEAR_135
    ];
    
    for (const state of linearStates) {
      if (!this.controller.availableStates.includes(state)) continue;
      
      await this.setPolarizationState(state);
      
      // Simulate angle measurement (in real system would use photodetector analysis)
      const nominalAngle = this.getAngleForState(state);
      const measuredAngle = nominalAngle + (Math.random() - 0.5) * 2; // ±1° error simulation
      const offset = measuredAngle - nominalAngle;
      
      this.calibrationData.angularOffsets.set(state, offset);
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private async measureExtinctionRatios(): Promise<void> {
    logger.info('Measuring extinction ratios...');
    
    // For each polarization state, measure maximum vs minimum transmission
    for (const state of this.controller.availableStates) {
      if (state === PolarizationState.UNPOLARIZED) continue;
      
      // Simulate extinction ratio measurement
      const baseExtinction = 500 + Math.random() * 1000; // 500-1500 typical range
      this.calibrationData.extinctionRatios.set(state, baseExtinction);
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  private async calibrateTransmissionEfficiency(): Promise<void> {
    logger.info('Calibrating transmission efficiency...');
    
    // Measure transmission through each polarization state
    for (const state of this.controller.availableStates) {
      // Simulate transmission measurement
      let efficiency = 0.45; // Typical polarizer efficiency
      
      if (state === PolarizationState.UNPOLARIZED) {
        efficiency = 1.0; // No polarizer
      } else if ([PolarizationState.CIRCULAR_LEFT, PolarizationState.CIRCULAR_RIGHT].includes(state)) {
        efficiency = 0.25; // Polarizer + retarder losses
      }
      
      // Add some measurement variation
      efficiency *= (0.95 + Math.random() * 0.1);
      
      this.calibrationData.transmissionEfficiency.set(state, efficiency);
      
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  private async calibrateRetardance(): Promise<void> {
    logger.info('Calibrating retardance for circular polarization...');
    
    // Simulate retardance calibration for quarter-wave and half-wave plates
    const qwRetardance = 90 + (Math.random() - 0.5) * 5; // ±2.5° variation
    const hwRetardance = 180 + (Math.random() - 0.5) * 5;
    
    this.calibrationData.retardanceCalibration = {
      quarterWave: { retardance: qwRetardance, wavelength: 550 },
      halfWave: { retardance: hwRetardance, wavelength: 550 }
    };
  }

  async capturePolarimetricSequence(baseSettings: any): Promise<SpectralFrame[]> {
    const frames: SpectralFrame[] = [];
    const states = [
      PolarizationState.LINEAR_0,
      PolarizationState.LINEAR_45,
      PolarizationState.LINEAR_90,
      PolarizationState.LINEAR_135
    ];
    
    // Add circular states if available
    if (this.controller.availableStates.includes(PolarizationState.CIRCULAR_LEFT)) {
      states.push(PolarizationState.CIRCULAR_LEFT, PolarizationState.CIRCULAR_RIGHT);
    }

    try {
      this.emit('sequence-started', { states, acquisitionMode: this.acquisitionMode });
      
      for (let i = 0; i < states.length; i++) {
        const state = states[i];
        
        if (this.acquisitionMode === 'sequential') {
          // Set polarization and capture frame
          await this.setPolarizationState(state);
          await new Promise(resolve => setTimeout(resolve, 100)); // Settling time
        }
        
        // Simulate frame capture (would interface with camera)
        const frame = await this.simulateFrameCapture(state, baseSettings);
        frames.push(frame);
        
        this.emit('sequence-progress', {
          currentState: state,
          progress: ((i + 1) / states.length) * 100,
          framesCompleted: i + 1
        });
      }
      
      this.emit('sequence-completed', { frames, statesCount: states.length });
      return frames;
    } catch (error) {
      this.emit('sequence-failed', error);
      throw error;
    }
  }

  private async simulateFrameCapture(state: PolarizationState, settings: any): Promise<SpectralFrame> {
    // This would interface with the actual camera
    // For simulation, create a mock frame with polarization information
    
    const width = 640;
    const height = 480;
    const size = width * height;
    
    // Generate polarization-dependent data
    const rawData = new Float32Array(size);
    const intensity = this.getIntensityForPolarization(state);
    
    for (let i = 0; i < size; i++) {
      rawData[i] = intensity + (Math.random() - 0.5) * 100;
    }
    
    // Create image data
    const imageData = new ImageData(width, height);
    const normalized = Array.from(rawData).map(v => Math.min(255, Math.max(0, v / 4)));
    
    for (let i = 0; i < size; i++) {
      const idx = i * 4;
      const val = normalized[i];
      imageData.data[idx] = val;     // R
      imageData.data[idx + 1] = val; // G  
      imageData.data[idx + 2] = val; // B
      imageData.data[idx + 3] = 255; // A
    }

    return {
      id: `pol_frame_${state}_${Date.now()}`,
      timestamp: Date.now(),
      frameNumber: 0,
      spectralBand: settings.spectralBand,
      wavelengthRange: { min: 400, max: 700 },
      imageData,
      rawData,
      width,
      height,
      exposureTime: settings.exposureTime || 10,
      gain: settings.gain || 1.0,
      polarization: state,
      metadata: {
        captureSettings: settings,
        environmentalData: {
          temperature: 22,
          humidity: 45,
          pressure: 1013,
          lightLevel: 500
        },
        calibration: {
          darkFrame: false,
          flatField: false,
          spectralResponse: null
        },
        processing: {
          demosaiced: false,
          corrected: false,
          normalized: false
        }
      }
    };
  }

  private getIntensityForPolarization(state: PolarizationState): number {
    // Simulate different intensities for different polarization states
    const baseIntensity = 2000;
    
    switch (state) {
      case PolarizationState.LINEAR_0: return baseIntensity * 1.0;
      case PolarizationState.LINEAR_45: return baseIntensity * 0.8;
      case PolarizationState.LINEAR_90: return baseIntensity * 0.6;
      case PolarizationState.LINEAR_135: return baseIntensity * 0.7;
      case PolarizationState.CIRCULAR_LEFT: return baseIntensity * 0.5;
      case PolarizationState.CIRCULAR_RIGHT: return baseIntensity * 0.5;
      case PolarizationState.UNPOLARIZED: return baseIntensity * 0.9;
      default: return baseIntensity;
    }
  }

  getCurrentState(): PolarizationState {
    return this.controller.currentState;
  }

  getAvailableStates(): PolarizationState[] {
    return [...this.controller.availableStates];
  }

  getControllerInfo(): IPolarizationController {
    return { ...this.controller };
  }

  getCalibrationData(): PolarizationCalibrationData {
    return { ...this.calibrationData };
  }

  isRotating(): boolean {
    return this.controller.isRotating;
  }

  isCalibrationValid(): boolean {
    return this.isCalibrated && this.calibrationData.isValid;
  }

  setAcquisitionMode(mode: PolarizationAcquisitionMode): void {
    this.acquisitionMode = mode;
    this.emit('acquisition-mode-changed', mode);
  }

  getAcquisitionMode(): PolarizationAcquisitionMode {
    return this.acquisitionMode;
  }

  async emergencyStop(): Promise<void> {
    if (this.controller.isRotating) {
      logger.warn('Emergency stop triggered for polarization controller');
      this.controller.isRotating = false;
      this.emit('emergency-stop');
    }
  }

  destroy(): void {
    this.controller.isRotating = false;
    this.isCalibrated = false;
    this.removeAllListeners();
  }
}

// Supporting interfaces and types
interface PolarizedIntensities {
  i0: number;    // 0 degrees
  i45: number;   // 45 degrees  
  i90: number;   // 90 degrees
  i135: number;  // 135 degrees
  iLCP?: number; // Left circular
  iRCP?: number; // Right circular
}

interface StokesParameters {
  s0: number; // Total intensity
  s1: number; // Linear horizontal vs vertical
  s2: number; // Linear +45° vs -45°
  s3: number; // Right vs left circular
  degreeOfPolarization?: number;
  angleOfPolarization?: number;
  ellipticity?: number;
}

interface PolarizationCalibrationData {
  timestamp: Date;
  angularOffsets: Map<PolarizationState, number>;
  extinctionRatios: Map<PolarizationState, number>;
  transmissionEfficiency: Map<PolarizationState, number>;
  retardanceCalibration: {
    quarterWave: { retardance: number; wavelength: number };
    halfWave: { retardance: number; wavelength: number };
  };
  isValid: boolean;
}

type PolarizationAcquisitionMode = 'sequential' | 'simultaneous';