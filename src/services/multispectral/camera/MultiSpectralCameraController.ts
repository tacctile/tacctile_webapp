import { EventEmitter } from 'events';
import {
  MultiSpectralCamera,
  MultiSpectralCameraType,
  SpectralBand,
  SpectralFrame,
  SpectralCaptureSettings,
  SpectralSequence,
  ExposureMode,
  SpectralFilter,
  PolarizationState,
  MultiSpectralEvent,
  SPECTRAL_BAND_INFO
} from '../types';
import { logger } from '../../../utils/logger';

export class MultiSpectralCameraController extends EventEmitter {
  private camera: MultiSpectralCamera;
  private isCapturing: boolean;
  private captureSequence?: SpectralSequence;
  private frameBuffer: SpectralFrame[];
  private calibrationFrames: Map<SpectralBand, SpectralFrame[]>;
  private deviceHandle?: any;
  private lastCaptureTime: number;

  constructor(camera: MultiSpectralCamera) {
    super();
    this.camera = { ...camera };
    this.isCapturing = false;
    this.frameBuffer = [];
    this.calibrationFrames = new Map();
    this.lastCaptureTime = 0;
  }

  async initialize(): Promise<boolean> {
    try {
      logger.info(`Initializing multi-spectral camera: ${this.camera.name}`);
      this.camera.status = 'connecting';
      this.emit('status-changed', this.camera.status);

      // Initialize based on camera type
      const success = await this.initializeCameraByType();
      
      if (success) {
        this.camera.status = 'connected';
        await this.loadDefaultSettings();
        await this.performInitialCalibration();
        this.emit('camera-initialized', this.camera);
        logger.info(`Camera ${this.camera.name} initialized successfully`);
      } else {
        this.camera.status = 'error';
        this.emit('error', new Error('Failed to initialize camera'));
      }

      this.emit('status-changed', this.camera.status);
      return success;
    } catch (error) {
      this.camera.status = 'error';
      this.emit('status-changed', this.camera.status);
      this.emit('error', error);
      logger.error(`Camera initialization failed:`, error);
      return false;
    }
  }

  private async initializeCameraByType(): Promise<boolean> {
    switch (this.camera.type) {
      case MultiSpectralCameraType.UV_SPECIALIZED:
        return await this.initializeUVCamera();
      case MultiSpectralCameraType.IR_SPECIALIZED:
        return await this.initializeIRCamera();
      case MultiSpectralCameraType.FULL_SPECTRUM:
        return await this.initializeFullSpectrumCamera();
      case MultiSpectralCameraType.HYPERSPECTRAL:
        return await this.initializeHyperspectralCamera();
      case MultiSpectralCameraType.FILTER_WHEEL:
        return await this.initializeFilterWheelCamera();
      case MultiSpectralCameraType.POLARIMETRIC:
        return await this.initializePolarimetricCamera();
      default:
        throw new Error(`Unsupported camera type: ${this.camera.type}`);
    }
  }

  private async initializeUVCamera(): Promise<boolean> {
    logger.info('Initializing UV specialized camera');
    
    // UV cameras typically need special handling for sensor sensitivity
    const uvSettings = {
      sensorType: 'UV-enhanced CCD',
      quantumEfficiency: this.getUVQuantumEfficiency(),
      darkCurrentCompensation: true,
      coolingRequired: true
    };

    // Simulate UV camera initialization
    await this.simulateDeviceConnection();
    
    // Configure for UV bands
    this.camera.capabilities.supportedBands = [
      SpectralBand.UV_A,
      SpectralBand.UV_B,
      SpectralBand.UV_C
    ];

    // UV cameras typically need longer exposures
    this.camera.capabilities.minExposure = 10;   // 10ms minimum
    this.camera.capabilities.maxExposure = 10000; // 10 second maximum
    
    this.emit('camera-configured', { type: 'uv', settings: uvSettings });
    return true;
  }

  private async initializeIRCamera(): Promise<boolean> {
    logger.info('Initializing IR specialized camera');
    
    // IR cameras often require cooling and specialized sensor handling
    const irSettings = {
      sensorType: 'InGaAs/MCT',
      coolingSystem: 'TEC/Stirling',
      shutterType: 'Global',
      spectralResponse: this.getIRSpectralResponse()
    };

    await this.simulateDeviceConnection();
    
    // Configure for IR bands
    this.camera.capabilities.supportedBands = [
      SpectralBand.NIR,
      SpectralBand.SWIR,
      SpectralBand.MWIR,
      SpectralBand.LWIR
    ];

    // IR cameras may have different exposure characteristics
    this.camera.capabilities.minExposure = 1;    // 1ms minimum
    this.camera.capabilities.maxExposure = 5000; // 5 second maximum
    
    this.emit('camera-configured', { type: 'ir', settings: irSettings });
    return true;
  }

  private async initializeFullSpectrumCamera(): Promise<boolean> {
    logger.info('Initializing full spectrum camera');
    
    const fullSpectrumSettings = {
      sensorType: 'Modified CMOS/CCD',
      filterRemoved: true,
      spectralRange: { min: 200, max: 1100 },
      specialLenses: true
    };

    await this.simulateDeviceConnection();
    
    // Configure for all visible and near-UV/NIR
    this.camera.capabilities.supportedBands = [
      SpectralBand.UV_A,
      SpectralBand.VISIBLE,
      SpectralBand.RED,
      SpectralBand.GREEN,
      SpectralBand.BLUE,
      SpectralBand.NIR,
      SpectralBand.FULL_SPECTRUM
    ];

    this.emit('camera-configured', { type: 'full_spectrum', settings: fullSpectrumSettings });
    return true;
  }

  private async initializeHyperspectralCamera(): Promise<boolean> {
    logger.info('Initializing hyperspectral camera');
    
    const hyperSettings = {
      spectralResolution: 2.5,  // nm
      spectralBands: 400,       // Number of bands
      spatialResolution: { width: 1024, height: 1024 },
      acquisitionMode: 'pushbroom'
    };

    await this.simulateDeviceConnection();
    
    // Hyperspectral cameras support many bands
    this.camera.capabilities.supportedBands = Object.values(SpectralBand);
    this.camera.capabilities.maxResolution = { width: 1024, height: 1024 };
    
    this.emit('camera-configured', { type: 'hyperspectral', settings: hyperSettings });
    return true;
  }

  private async initializeFilterWheelCamera(): Promise<boolean> {
    logger.info('Initializing filter wheel camera');
    
    const filterWheelSettings = {
      wheelPositions: 8,
      filterChangeTime: 200,  // ms
      positionAccuracy: 0.1,  // degrees
      motorType: 'stepper'
    };

    await this.simulateDeviceConnection();
    
    // Filter wheel cameras support bands based on available filters
    this.camera.capabilities.supportedBands = [
      SpectralBand.VISIBLE,
      SpectralBand.RED,
      SpectralBand.GREEN,
      SpectralBand.BLUE,
      SpectralBand.NIR,
      SpectralBand.UV_A
    ];

    this.camera.capabilities.hasFilterWheel = true;
    
    this.emit('camera-configured', { type: 'filter_wheel', settings: filterWheelSettings });
    return true;
  }

  private async initializePolarimetricCamera(): Promise<boolean> {
    logger.info('Initializing polarimetric camera');
    
    const polSettings = {
      polarizationStates: 4,
      rotationAccuracy: 0.5,  // degrees
      acquisitionMode: 'simultaneous',
      stokesParameters: true
    };

    await this.simulateDeviceConnection();
    
    this.camera.capabilities.supportedBands = [
      SpectralBand.VISIBLE,
      SpectralBand.RED,
      SpectralBand.GREEN,
      SpectralBand.BLUE,
      SpectralBand.NIR
    ];

    this.camera.capabilities.hasPolarizer = true;
    
    this.emit('camera-configured', { type: 'polarimetric', settings: polSettings });
    return true;
  }

  private async simulateDeviceConnection(): Promise<void> {
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create mock device handle
    this.deviceHandle = {
      connected: true,
      deviceId: this.camera.id,
      lastActivity: Date.now()
    };
  }

  private getUVQuantumEfficiency(): number[] {
    // Simulated UV quantum efficiency curve
    return Array.from({ length: 200 }, (_, i) => {
      const wavelength = 200 + i;
      if (wavelength < 280) return 0.1 + (wavelength - 200) * 0.002;
      if (wavelength < 350) return 0.3 + (wavelength - 280) * 0.01;
      return 0.8 - (wavelength - 350) * 0.01;
    });
  }

  private getIRSpectralResponse(): number[] {
    // Simulated IR spectral response
    return Array.from({ length: 1000 }, (_, i) => {
      const wavelength = 700 + i * 10; // 700-17000 nm
      if (wavelength < 1000) return 0.7 + (wavelength - 700) * 0.001;
      if (wavelength < 2500) return 0.9;
      if (wavelength < 5000) return 0.8 - (wavelength - 2500) * 0.0001;
      return 0.5;
    });
  }

  private async loadDefaultSettings(): Promise<void> {
    // Load default capture settings based on camera capabilities
    this.camera.currentSettings = {
      spectralBand: this.camera.capabilities.supportedBands[0],
      exposureMode: ExposureMode.AUTO,
      exposureTime: SPECTRAL_BAND_INFO[this.camera.capabilities.supportedBands[0]].typicalExposure,
      gain: 1.0,
      binning: { x: 1, y: 1 },
      roi: {
        x: 0,
        y: 0,
        width: this.camera.capabilities.maxResolution.width,
        height: this.camera.capabilities.maxResolution.height
      }
    };

    this.emit('settings-loaded', this.camera.currentSettings);
  }

  private async performInitialCalibration(): Promise<void> {
    logger.info('Performing initial camera calibration');
    
    try {
      // Capture dark frames for noise characterization
      await this.captureDarkFrames();
      
      // Perform flat field calibration if light source available
      await this.performFlatFieldCalibration();
      
      this.emit('calibration-complete', {
        darkFrames: this.calibrationFrames.size,
        timestamp: new Date()
      });
    } catch (error) {
      logger.warn('Initial calibration failed:', error);
      this.emit('calibration-failed', error);
    }
  }

  private async captureDarkFrames(): Promise<void> {
    logger.info('Capturing dark frames for noise characterization');
    
    for (const band of this.camera.capabilities.supportedBands.slice(0, 3)) {
      const darkFrames: SpectralFrame[] = [];
      
      for (let i = 0; i < 5; i++) {
        const frame = await this.captureDarkFrame(band);
        darkFrames.push(frame);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.calibrationFrames.set(band, darkFrames);
    }
  }

  private async captureDarkFrame(band: SpectralBand): Promise<SpectralFrame> {
    // Simulate dark frame capture (sensor covered/no light)
    const width = this.camera.capabilities.maxResolution.width;
    const height = this.camera.capabilities.maxResolution.height;
    const size = width * height;
    
    // Generate dark frame noise pattern
    const rawData = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      rawData[i] = Math.random() * 10; // Dark current + read noise
    }

    // Convert to ImageData for display
    const imageData = new ImageData(width, height);
    for (let i = 0; i < size; i++) {
      const pixelValue = Math.min(255, rawData[i] * 25);
      const idx = i * 4;
      imageData.data[idx] = pixelValue;     // R
      imageData.data[idx + 1] = pixelValue; // G
      imageData.data[idx + 2] = pixelValue; // B
      imageData.data[idx + 3] = 255;        // A
    }

    return {
      id: `dark_${band}_${Date.now()}`,
      timestamp: Date.now(),
      frameNumber: 0,
      spectralBand: band,
      wavelengthRange: SPECTRAL_BAND_INFO[band].wavelengthRange,
      imageData,
      rawData,
      width,
      height,
      exposureTime: this.camera.currentSettings.exposureTime,
      gain: this.camera.currentSettings.gain,
      metadata: this.createFrameMetadata(true, false)
    };
  }

  private async performFlatFieldCalibration(): Promise<void> {
    // Flat field calibration would require uniform illumination
    // For now, just log that it would be performed
    logger.info('Flat field calibration would be performed here');
  }

  async captureFrame(settings?: Partial<SpectralCaptureSettings>): Promise<SpectralFrame> {
    if (this.camera.status !== 'connected') {
      throw new Error('Camera not connected');
    }

    const captureSettings = { ...this.camera.currentSettings, ...settings };
    this.camera.status = 'capturing';
    this.emit('status-changed', this.camera.status);

    try {
      logger.debug(`Capturing frame: ${captureSettings.spectralBand}`);
      
      // Apply capture settings
      await this.applyCaptureSettings(captureSettings);
      
      // Perform actual capture
      const frame = await this.performCapture(captureSettings);
      
      // Post-process frame
      const processedFrame = await this.processFrame(frame);
      
      // Add to buffer
      this.frameBuffer.push(processedFrame);
      if (this.frameBuffer.length > 100) {
        this.frameBuffer.shift(); // Keep only last 100 frames
      }

      this.camera.status = 'connected';
      this.emit('status-changed', this.camera.status);
      this.emit('frame-captured', processedFrame);
      
      this.lastCaptureTime = Date.now();
      return processedFrame;
    } catch (error) {
      this.camera.status = 'error';
      this.emit('status-changed', this.camera.status);
      this.emit('error', error);
      throw error;
    }
  }

  private async applyCaptureSettings(settings: SpectralCaptureSettings): Promise<void> {
    // Apply exposure settings
    if (settings.exposureMode === ExposureMode.MANUAL) {
      await this.setExposureTime(settings.exposureTime);
    } else if (settings.exposureMode === ExposureMode.AUTO) {
      await this.performAutoExposure(settings.spectralBand);
    }

    // Apply gain
    await this.setGain(settings.gain);
    
    // Set ROI
    await this.setROI(settings.roi);
    
    // Apply filter if camera has filter wheel
    if (settings.filter && this.camera.capabilities.hasFilterWheel) {
      await this.setFilter(settings.filter);
    }

    // Set polarization if camera has polarizer
    if (settings.polarization && this.camera.capabilities.hasPolarizer) {
      await this.setPolarization(settings.polarization);
    }

    // Update current settings
    this.camera.currentSettings = settings;
    this.emit('settings-applied', settings);
  }

  private async setExposureTime(exposureTime: number): Promise<void> {
    const clampedExposure = Math.max(
      this.camera.capabilities.minExposure,
      Math.min(this.camera.capabilities.maxExposure, exposureTime)
    );
    
    logger.debug(`Setting exposure time: ${clampedExposure}ms`);
    // Simulate hardware communication delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.emit('exposure-changed', clampedExposure);
  }

  private async performAutoExposure(band: SpectralBand): Promise<void> {
    logger.debug(`Performing auto exposure for band: ${band}`);
    
    // Simulate auto exposure algorithm
    const targetBrightness = 128; // Middle gray
    let exposureTime = SPECTRAL_BAND_INFO[band].typicalExposure;
    
    // Take test shot
    const testFrame = await this.performCapture({
      ...this.camera.currentSettings,
      exposureTime,
      spectralBand: band
    });
    
    // Calculate average brightness
    const avgBrightness = this.calculateAverageBrightness(testFrame.rawData!);
    
    // Adjust exposure based on brightness
    if (avgBrightness < targetBrightness * 0.8) {
      exposureTime *= (targetBrightness / avgBrightness);
    } else if (avgBrightness > targetBrightness * 1.2) {
      exposureTime *= (targetBrightness / avgBrightness);
    }
    
    // Clamp to valid range
    exposureTime = Math.max(
      this.camera.capabilities.minExposure,
      Math.min(this.camera.capabilities.maxExposure, exposureTime)
    );
    
    await this.setExposureTime(exposureTime);
  }

  private calculateAverageBrightness(rawData: Float32Array): number {
    const sum = Array.from(rawData).reduce((a, b) => a + b, 0);
    return sum / rawData.length;
  }

  private async setGain(gain: number): Promise<void> {
    const clampedGain = Math.max(
      this.camera.capabilities.gainRange.min,
      Math.min(this.camera.capabilities.gainRange.max, gain)
    );
    
    logger.debug(`Setting gain: ${clampedGain}`);
    await new Promise(resolve => setTimeout(resolve, 30));
    
    this.emit('gain-changed', clampedGain);
  }

  private async setROI(roi: { x: number; y: number; width: number; height: number }): Promise<void> {
    logger.debug(`Setting ROI: ${roi.x},${roi.y} ${roi.width}x${roi.height}`);
    await new Promise(resolve => setTimeout(resolve, 20));
    
    this.emit('roi-changed', roi);
  }

  private async setFilter(filter: SpectralFilter): Promise<void> {
    logger.debug(`Setting filter: ${filter.name}`);
    
    // Simulate filter wheel movement
    await new Promise(resolve => setTimeout(resolve, 500));
    
    this.emit('filter-changed', filter);
  }

  private async setPolarization(polarization: PolarizationState): Promise<void> {
    logger.debug(`Setting polarization: ${polarization}`);
    
    // Simulate polarizer rotation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    this.emit('polarization-changed', polarization);
  }

  private async performCapture(settings: SpectralCaptureSettings): Promise<SpectralFrame> {
    const width = settings.roi.width;
    const height = settings.roi.height;
    const size = width * height;
    
    // Simulate capture delay based on exposure time
    await new Promise(resolve => setTimeout(resolve, Math.min(settings.exposureTime, 100)));
    
    // Generate simulated spectral data
    const rawData = this.generateSpectralData(settings.spectralBand, size, settings);
    
    // Convert to ImageData for display
    const imageData = this.convertToImageData(rawData, width, height, settings.spectralBand);
    
    const frame: SpectralFrame = {
      id: `frame_${Date.now()}`,
      timestamp: Date.now(),
      frameNumber: this.frameBuffer.length,
      spectralBand: settings.spectralBand,
      wavelengthRange: SPECTRAL_BAND_INFO[settings.spectralBand].wavelengthRange,
      imageData,
      rawData,
      width,
      height,
      exposureTime: settings.exposureTime,
      gain: settings.gain,
      filter: settings.filter,
      polarization: settings.polarization,
      metadata: this.createFrameMetadata(false, false)
    };

    return frame;
  }

  private generateSpectralData(band: SpectralBand, size: number, settings: SpectralCaptureSettings): Float32Array {
    const rawData = new Float32Array(size);
    
    // Generate band-specific spectral response
    for (let i = 0; i < size; i++) {
      let value = 0;
      
      switch (band) {
        case SpectralBand.UV_A:
        case SpectralBand.UV_B:
        case SpectralBand.UV_C:
          // UV typically shows fluorescence and material absorption
          value = this.generateUVResponse(i, size);
          break;
        case SpectralBand.VISIBLE:
        case SpectralBand.RED:
        case SpectralBand.GREEN:
        case SpectralBand.BLUE:
          // Visible light standard response
          value = this.generateVisibleResponse(i, size, band);
          break;
        case SpectralBand.NIR:
        case SpectralBand.SWIR:
          // Near/Short-wave IR shows vegetation and material properties
          value = this.generateNIRResponse(i, size);
          break;
        case SpectralBand.MWIR:
        case SpectralBand.LWIR:
          // Thermal infrared
          value = this.generateThermalResponse(i, size);
          break;
        case SpectralBand.FULL_SPECTRUM:
          // Combined response across all bands
          value = this.generateFullSpectrumResponse(i, size);
          break;
        default:
          value = Math.random() * 4095; // 12-bit
      }
      
      // Apply exposure time and gain
      value = value * (settings.exposureTime / 100) * settings.gain;
      
      // Add noise
      value += (Math.random() - 0.5) * 10;
      
      // Clamp to sensor range
      rawData[i] = Math.max(0, Math.min(4095, value));
    }
    
    return rawData;
  }

  private generateUVResponse(index: number, size: number): number {
    // UV often reveals hidden patterns, fluorescence
    const x = (index % Math.sqrt(size)) / Math.sqrt(size);
    const y = Math.floor(index / Math.sqrt(size)) / Math.sqrt(size);
    
    // Create UV-specific patterns (security marks, fluorescence)
    return 500 + 
           Math.sin(x * 20) * 200 +
           Math.cos(y * 15) * 150 +
           (Math.random() < 0.1 ? 1000 : 0); // Fluorescence spots
  }

  private generateVisibleResponse(index: number, size: number, band: SpectralBand): number {
    const x = (index % Math.sqrt(size)) / Math.sqrt(size);
    const y = Math.floor(index / Math.sqrt(size)) / Math.sqrt(size);
    
    let baseValue = 800;
    
    // Create color-specific patterns
    switch (band) {
      case SpectralBand.RED:
        baseValue += Math.sin(x * 10) * 300;
        break;
      case SpectralBand.GREEN:
        baseValue += Math.cos(y * 12) * 250;
        break;
      case SpectralBand.BLUE:
        baseValue += Math.sin(x * 8) * Math.cos(y * 8) * 200;
        break;
      default:
        baseValue += (Math.sin(x * 5) + Math.cos(y * 7)) * 200;
    }
    
    return baseValue;
  }

  private generateNIRResponse(index: number, size: number): number {
    // NIR shows vegetation health, material properties
    const x = (index % Math.sqrt(size)) / Math.sqrt(size);
    const y = Math.floor(index / Math.sqrt(size)) / Math.sqrt(size);
    
    // Simulate vegetation (high NIR reflectance) vs. other materials
    const isVegetation = (x + y) % 0.3 < 0.15;
    
    return isVegetation ? 
           2000 + Math.random() * 500 :  // Vegetation reflects strongly in NIR
           400 + Math.random() * 200;    // Other materials absorb NIR
  }

  private generateThermalResponse(index: number, size: number): number {
    // Thermal IR shows temperature variations
    const x = (index % Math.sqrt(size)) / Math.sqrt(size);
    const y = Math.floor(index / Math.sqrt(size)) / Math.sqrt(size);
    
    // Create thermal gradient
    const centerX = 0.5;
    const centerY = 0.5;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    
    // Hot spot in center, cooling towards edges
    return 1500 + (0.5 - distance) * 1000 + Math.random() * 100;
  }

  private generateFullSpectrumResponse(index: number, size: number): number {
    // Combine responses from multiple bands
    return (this.generateVisibleResponse(index, size, SpectralBand.VISIBLE) +
            this.generateNIRResponse(index, size) +
            this.generateUVResponse(index, size)) / 3;
  }

  private convertToImageData(rawData: Float32Array, width: number, height: number, band: SpectralBand): ImageData {
    const imageData = new ImageData(width, height);
    const data = imageData.data;
    
    // Normalize raw data to 0-255 range
    const maxValue = Math.max(...rawData);
    const minValue = Math.min(...rawData);
    const range = maxValue - minValue;
    
    for (let i = 0; i < rawData.length; i++) {
      const normalizedValue = ((rawData[i] - minValue) / range) * 255;
      const idx = i * 4;
      
      // Apply band-specific coloring
      switch (band) {
        case SpectralBand.UV_A:
        case SpectralBand.UV_B:
        case SpectralBand.UV_C:
          // Purple/blue for UV
          data[idx] = normalizedValue * 0.6;     // R
          data[idx + 1] = normalizedValue * 0.3; // G
          data[idx + 2] = normalizedValue;       // B
          break;
        case SpectralBand.RED:
          data[idx] = normalizedValue;           // R
          data[idx + 1] = normalizedValue * 0.3; // G
          data[idx + 2] = normalizedValue * 0.3; // B
          break;
        case SpectralBand.GREEN:
          data[idx] = normalizedValue * 0.3;     // R
          data[idx + 1] = normalizedValue;       // G
          data[idx + 2] = normalizedValue * 0.3; // B
          break;
        case SpectralBand.BLUE:
          data[idx] = normalizedValue * 0.3;     // R
          data[idx + 1] = normalizedValue * 0.3; // G
          data[idx + 2] = normalizedValue;       // B
          break;
        case SpectralBand.NIR:
          // False color red for NIR
          data[idx] = normalizedValue;           // R
          data[idx + 1] = normalizedValue * 0.5; // G
          data[idx + 2] = normalizedValue * 0.2; // B
          break;
        default:
          // Grayscale for other bands
          data[idx] = normalizedValue;           // R
          data[idx + 1] = normalizedValue;       // G
          data[idx + 2] = normalizedValue;       // B
      }
      
      data[idx + 3] = 255; // Alpha
    }
    
    return imageData;
  }

  private createFrameMetadata(isDark: boolean, isFlat: boolean): any {
    return {
      captureSettings: {
        iso: 100,
        aperture: 2.8,
        shutterSpeed: this.camera.currentSettings.exposureTime,
        whiteBalance: 5500,
        focusDistance: null
      },
      environmentalData: {
        temperature: 22.5 + (Math.random() - 0.5) * 2,
        humidity: 45 + (Math.random() - 0.5) * 10,
        pressure: 1013 + (Math.random() - 0.5) * 20,
        lightLevel: isDark ? 0 : 500 + Math.random() * 1000
      },
      calibration: {
        darkFrame: isDark,
        flatField: isFlat,
        spectralResponse: null
      },
      processing: {
        demosaiced: false,
        corrected: false,
        normalized: false
      }
    };
  }

  private async processFrame(frame: SpectralFrame): Promise<SpectralFrame> {
    // Apply dark frame subtraction if available
    const darkFrames = this.calibrationFrames.get(frame.spectralBand);
    if (darkFrames && darkFrames.length > 0 && frame.rawData) {
      const avgDarkFrame = this.averageFrames(darkFrames);
      for (let i = 0; i < frame.rawData.length; i++) {
        frame.rawData[i] = Math.max(0, frame.rawData[i] - avgDarkFrame[i]);
      }
      frame.metadata.processing.corrected = true;
    }

    return frame;
  }

  private averageFrames(frames: SpectralFrame[]): Float32Array {
    const avgData = new Float32Array(frames[0].rawData!.length);
    
    for (const frame of frames) {
      for (let i = 0; i < avgData.length; i++) {
        avgData[i] += frame.rawData![i] / frames.length;
      }
    }
    
    return avgData;
  }

  async captureSequence(sequence: SpectralSequence): Promise<SpectralFrame[]> {
    if (this.isCapturing) {
      throw new Error('Capture already in progress');
    }

    this.isCapturing = true;
    this.captureSequence = sequence;
    const frames: SpectralFrame[] = [];

    try {
      this.emit('sequence-started', sequence);
      
      for (let i = 0; i < sequence.bands.length; i++) {
        const band = sequence.bands[i];
        const exposureTime = sequence.exposureTimes[i];
        const gain = sequence.gains[i];
        const filter = sequence.filters[i];
        const polarization = sequence.polarizations[i];

        const settings: SpectralCaptureSettings = {
          spectralBand: band,
          exposureMode: ExposureMode.MANUAL,
          exposureTime,
          gain,
          binning: this.camera.currentSettings.binning,
          roi: this.camera.currentSettings.roi,
          filter: filter || undefined,
          polarization: polarization || undefined
        };

        const frame = await this.captureFrame(settings);
        frames.push(frame);

        this.emit('sequence-progress', {
          sequence,
          currentBand: band,
          progress: ((i + 1) / sequence.bands.length) * 100,
          framesCompleted: i + 1
        });

        // Delay between captures
        if (i < sequence.bands.length - 1 && sequence.captureDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, sequence.captureDelay));
        }
      }

      this.emit('sequence-completed', { sequence, frames });
      return frames;
    } catch (error) {
      this.emit('sequence-failed', { sequence, error });
      throw error;
    } finally {
      this.isCapturing = false;
      this.captureSequence = undefined;
    }
  }

  getRecentFrames(count = 10): SpectralFrame[] {
    return this.frameBuffer.slice(-count);
  }

  getCameraInfo(): MultiSpectralCamera {
    return { ...this.camera };
  }

  getCapabilities(): MultiSpectralCamera['capabilities'] {
    return { ...this.camera.capabilities };
  }

  updateSettings(settings: Partial<SpectralCaptureSettings>): void {
    this.camera.currentSettings = { ...this.camera.currentSettings, ...settings };
    this.emit('settings-updated', this.camera.currentSettings);
  }

  async disconnect(): Promise<void> {
    if (this.isCapturing) {
      this.isCapturing = false;
    }

    this.camera.status = 'disconnected';
    this.deviceHandle = undefined;
    this.emit('status-changed', this.camera.status);
    this.emit('disconnected');
    
    logger.info(`Camera ${this.camera.name} disconnected`);
  }

  destroy(): void {
    this.disconnect();
    this.frameBuffer = [];
    this.calibrationFrames.clear();
    this.removeAllListeners();
  }
}