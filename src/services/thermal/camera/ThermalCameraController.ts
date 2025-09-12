/**
 * Thermal Camera Controller
 * Manages thermal camera integration and data acquisition
 */

import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import * as net from 'net';
import * as usb from 'usb';
import {
  ThermalCamera,
  ThermalCameraType,
  ThermalStatus,
  ThermalFrame,
  ThermalCapabilities,
  ThermalCalibration,
  CameraSettings,
  ThermalConnection
} from '../types';
import { logger } from '../../../utils/logger';

export interface CameraCommand {
  type: 'capture' | 'calibrate' | 'settings' | 'shutter' | 'focus' | 'gain';
  parameters: { [key: string]: any };
  timestamp: number;
}

export class ThermalCameraController extends EventEmitter {
  private camera: ThermalCamera;
  private settings: CameraSettings;
  private isConnected: boolean = false;
  private isStreaming: boolean = false;
  
  private serialConnection: SerialPort | null = null;
  private networkConnection: net.Socket | null = null;
  private usbDevice: usb.Device | null = null;
  
  private frameBuffer: Buffer[] = [];
  private frameCounter: number = 0;
  private lastShutterTime: number = 0;
  private calibrationInProgress: boolean = false;
  
  private streamInterval: NodeJS.Timeout | null = null;
  private temperatureCalibration: ThermalCalibration | null = null;

  constructor(camera: ThermalCamera) {
    super();
    this.camera = camera;
    this.settings = this.getDefaultSettings();
  }

  /**
   * Get default camera settings
   */
  private getDefaultSettings(): CameraSettings {
    return {
      frameRate: 9, // Hz
      integrationTime: 8000, // microseconds
      gain: 1.0,
      bias: 0,
      shutterMode: 'auto',
      focusMode: 'auto',
      temperatureRange: {
        min: -20,
        max: 120,
        accuracy: 2
      }
    };
  }

  /**
   * Connect to thermal camera
   */
  async connect(): Promise<boolean> {
    logger.info(`Connecting to thermal camera: ${this.camera.name}`);
    
    try {
      this.camera.status = ThermalStatus.CONNECTING;
      this.emit('status-changed', this.camera.status);

      switch (this.camera.connection.type) {
        case 'usb':
          await this.connectUSB();
          break;
        case 'network':
          await this.connectNetwork();
          break;
        case 'serial':
          await this.connectSerial();
          break;
        case 'bluetooth':
          await this.connectBluetooth();
          break;
        default:
          throw new Error(`Unsupported connection type: ${this.camera.connection.type}`);
      }

      this.isConnected = true;
      this.camera.status = ThermalStatus.CONNECTED;
      this.camera.lastSeen = new Date();

      // Initialize camera
      await this.initializeCamera();

      // Load calibration if available
      await this.loadCalibration();

      this.emit('connected');
      this.emit('status-changed', this.camera.status);
      logger.info(`Thermal camera connected: ${this.camera.name}`);

      return true;
    } catch (error) {
      this.camera.status = ThermalStatus.ERROR;
      this.emit('status-changed', this.camera.status);
      this.emit('error', error);
      logger.error('Failed to connect to thermal camera', error);
      return false;
    }
  }

  /**
   * Connect via USB
   */
  private async connectUSB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const devices = usb.getDeviceList();
      
      // Find thermal camera by vendor/product ID
      const thermalDevice = devices.find(device => {
        return this.isKnownThermalCamera(device.deviceDescriptor);
      });

      if (!thermalDevice) {
        reject(new Error('Thermal camera not found via USB'));
        return;
      }

      try {
        thermalDevice.open();
        this.usbDevice = thermalDevice;
        
        // Set up USB communication
        this.setupUSBCommunication(thermalDevice);
        
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if USB device is a known thermal camera
   */
  private isKnownThermalCamera(descriptor: usb.DeviceDescriptor): boolean {
    const knownDevices = [
      { vendorId: 0x09cb, productId: 0x1996 }, // FLIR One
      { vendorId: 0x289d, productId: 0x0010 }, // Seek Thermal
      { vendorId: 0x1554, productId: 0x0200 }, // Optris PI
      { vendorId: 0x289d, productId: 0x0011 }, // Seek Compact
    ];

    return knownDevices.some(known => 
      known.vendorId === descriptor.idVendor && 
      known.productId === descriptor.idProduct
    );
  }

  /**
   * Set up USB communication
   */
  private setupUSBCommunication(device: usb.Device): void {
    const interfaces = device.interfaces;
    
    if (interfaces && interfaces.length > 0) {
      const iface = interfaces[0];
      
      try {
        if (iface.isKernelDriverActive()) {
          iface.detachKernelDriver();
        }
        
        iface.claim();
        
        // Set up endpoints for thermal data
        const endpoints = iface.endpoints;
        const bulkIn = endpoints.find(ep => 
          ep.direction === 'in' && ep.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK
        ) as usb.InEndpoint;

        if (bulkIn) {
          bulkIn.on('data', (data: Buffer) => {
            this.handleUSBData(data);
          });
          
          bulkIn.on('error', (error) => {
            this.emit('error', error);
          });
        }
      } catch (error) {
        logger.error('Error setting up USB communication', error);
      }
    }
  }

  /**
   * Connect via network
   */
  private async connectNetwork(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { address, port = 23 } = this.camera.connection;
      
      if (!address) {
        reject(new Error('Network address not specified'));
        return;
      }

      this.networkConnection = new net.Socket();

      this.networkConnection.connect(port, address, () => {
        logger.info(`Network connection established to ${address}:${port}`);
        resolve();
      });

      this.networkConnection.on('error', (error) => {
        reject(error);
      });

      this.networkConnection.on('data', (data) => {
        this.handleNetworkData(data);
      });

      this.networkConnection.on('close', () => {
        this.handleDisconnection();
      });
    });
  }

  /**
   * Connect via serial
   */
  private async connectSerial(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { devicePath, baudRate = 115200 } = this.camera.connection;
      
      if (!devicePath) {
        reject(new Error('Serial device path not specified'));
        return;
      }

      this.serialConnection = new SerialPort({
        path: devicePath,
        baudRate: baudRate
      });

      this.serialConnection.on('open', () => {
        logger.info(`Serial connection opened on ${devicePath}`);
        resolve();
      });

      this.serialConnection.on('error', (error) => {
        reject(error);
      });

      this.serialConnection.on('data', (data) => {
        this.handleSerialData(data);
      });

      this.serialConnection.on('close', () => {
        this.handleDisconnection();
      });
    });
  }

  /**
   * Connect via Bluetooth
   */
  private async connectBluetooth(): Promise<void> {
    // Bluetooth implementation would use noble or similar library
    throw new Error('Bluetooth connection not yet implemented');
  }

  /**
   * Initialize camera settings
   */
  private async initializeCamera(): Promise<void> {
    // Set initial camera parameters based on camera type
    switch (this.camera.type) {
      case ThermalCameraType.FLIR_ONE:
        await this.initializeFLIROne();
        break;
      case ThermalCameraType.FLIR_LEPTON:
        await this.initializeFLIRLepton();
        break;
      case ThermalCameraType.SEEK_THERMAL:
        await this.initializeSeekThermal();
        break;
      case ThermalCameraType.OPTRIS_PI:
        await this.initializeOptrisPI();
        break;
      default:
        await this.initializeGenericCamera();
    }

    // Apply default settings
    await this.applySettings(this.settings);
  }

  /**
   * Initialize FLIR One camera
   */
  private async initializeFLIROne(): Promise<void> {
    // FLIR One specific initialization
    await this.sendCommand({
      type: 'settings',
      parameters: {
        mode: 'radiometric',
        shutterless: true,
        agcMode: 'linear'
      },
      timestamp: Date.now()
    });
  }

  /**
   * Initialize FLIR Lepton
   */
  private async initializeFLIRLepton(): Promise<void> {
    // FLIR Lepton specific initialization
    await this.sendCommand({
      type: 'settings',
      parameters: {
        telemetryMode: 'enabled',
        shutterMode: 'auto',
        gainMode: 'high'
      },
      timestamp: Date.now()
    });
  }

  /**
   * Initialize Seek Thermal
   */
  private async initializeSeekThermal(): Promise<void> {
    // Seek Thermal specific initialization
    await this.sendCommand({
      type: 'settings',
      parameters: {
        shutterless: true,
        calibrationMode: 'auto'
      },
      timestamp: Date.now()
    });
  }

  /**
   * Initialize Optris PI
   */
  private async initializeOptrisPI(): Promise<void> {
    // Optris PI specific initialization
    await this.sendCommand({
      type: 'settings',
      parameters: {
        temperatureRange: this.settings.temperatureRange,
        emissivity: 0.95,
        focusMotor: 'auto'
      },
      timestamp: Date.now()
    });
  }

  /**
   * Initialize generic camera
   */
  private async initializeGenericCamera(): Promise<void> {
    // Generic initialization for unknown cameras
    logger.warn('Using generic thermal camera initialization');
  }

  /**
   * Start streaming thermal data
   */
  async startStream(): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Camera not connected');
    }

    if (this.isStreaming) {
      logger.warn('Stream already active');
      return;
    }

    this.camera.status = ThermalStatus.STREAMING;
    this.isStreaming = true;
    this.frameCounter = 0;

    // Start frame acquisition based on frame rate
    const intervalMs = 1000 / this.settings.frameRate;
    
    this.streamInterval = setInterval(() => {
      this.captureFrame();
    }, intervalMs);

    // Perform initial shutter calibration if needed
    if (this.settings.shutterMode === 'auto' && !this.camera.capabilities.shutterless) {
      await this.performShutterCalibration();
    }

    this.emit('stream-started');
    this.emit('status-changed', this.camera.status);
    logger.info('Thermal stream started');
  }

  /**
   * Stop streaming
   */
  async stopStream(): Promise<void> {
    if (!this.isStreaming) return;

    this.isStreaming = false;
    this.camera.status = ThermalStatus.CONNECTED;

    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }

    this.emit('stream-stopped');
    this.emit('status-changed', this.camera.status);
    logger.info('Thermal stream stopped');
  }

  /**
   * Capture single frame
   */
  private async captureFrame(): Promise<void> {
    try {
      await this.sendCommand({
        type: 'capture',
        parameters: {},
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error capturing frame', error);
      this.emit('frame-error', error);
    }
  }

  /**
   * Process raw thermal data into ThermalFrame
   */
  private processThermalData(data: Buffer): ThermalFrame | null {
    try {
      // This would be camera-specific parsing
      const frame = this.parseRawData(data);
      
      if (!frame) return null;

      // Apply calibration if available
      if (this.temperatureCalibration) {
        this.applyTemperatureCalibration(frame);
      }

      // Calculate statistics
      this.calculateFrameStatistics(frame);

      this.frameCounter++;
      frame.frameNumber = this.frameCounter;
      frame.timestamp = Date.now();

      return frame;
    } catch (error) {
      logger.error('Error processing thermal data', error);
      return null;
    }
  }

  /**
   * Parse raw camera data (camera-specific)
   */
  private parseRawData(data: Buffer): ThermalFrame | null {
    // This would be implemented per camera type
    // For now, return a mock frame
    const width = this.camera.capabilities.resolution.width;
    const height = this.camera.capabilities.resolution.height;
    const pixelCount = width * height;

    // Convert raw data to temperature array
    const temperatureData = new Float32Array(pixelCount);
    
    // Simple conversion for demonstration
    for (let i = 0; i < pixelCount && i * 2 < data.length; i++) {
      const rawValue = data.readUInt16LE(i * 2);
      temperatureData[i] = this.rawToTemperature(rawValue);
    }

    return {
      timestamp: Date.now(),
      frameNumber: this.frameCounter,
      temperatureData,
      width,
      height,
      minTemp: 0,
      maxTemp: 0,
      avgTemp: 0,
      emissivity: 0.95,
      reflectedTemp: 20,
      ambientTemp: 22,
      metadata: {
        shutterCount: 0,
        fpaTemp: 25,
        housingTemp: 24,
        distance: 1.0,
        atmosphericTransmission: 0.95
      }
    };
  }

  /**
   * Convert raw sensor value to temperature
   */
  private rawToTemperature(rawValue: number): number {
    // Camera-specific conversion formula
    // This is a simplified Planck's law approximation
    
    const R = 15000; // Camera-specific constant
    const B = 1428; // Wien displacement constant
    const F = 1; // Focal length factor
    const O = 0; // Offset

    if (rawValue === 0) return 0;

    const temperature = (B / Math.log(R / rawValue + F)) - 273.15 + O;
    return Math.max(-50, Math.min(200, temperature)); // Clamp to reasonable range
  }

  /**
   * Apply temperature calibration
   */
  private applyTemperatureCalibration(frame: ThermalFrame): void {
    if (!this.temperatureCalibration) return;

    const calibration = this.temperatureCalibration;
    const { emissivity, reflectedTemp, atmosphericTemp, transmittance, distance } = calibration;

    // Apply radiometric calibration corrections
    for (let i = 0; i < frame.temperatureData.length; i++) {
      let temp = frame.temperatureData[i];
      
      // Atmospheric correction
      temp = temp + (atmosphericTemp - temp) * (1 - transmittance);
      
      // Emissivity correction
      temp = (temp + 273.15) / emissivity - 273.15;
      
      // Reflected temperature correction
      temp = temp - reflectedTemp * (1 - emissivity);
      
      frame.temperatureData[i] = temp;
    }

    // Update frame metadata
    frame.emissivity = emissivity;
    frame.reflectedTemp = reflectedTemp;
    frame.ambientTemp = atmosphericTemp;
  }

  /**
   * Calculate frame statistics
   */
  private calculateFrameStatistics(frame: ThermalFrame): void {
    const temps = Array.from(frame.temperatureData).filter(t => t > -273); // Valid temperatures
    
    if (temps.length === 0) return;

    frame.minTemp = Math.min(...temps);
    frame.maxTemp = Math.max(...temps);
    frame.avgTemp = temps.reduce((sum, t) => sum + t, 0) / temps.length;
  }

  /**
   * Perform shutter calibration
   */
  private async performShutterCalibration(): Promise<void> {
    if (this.calibrationInProgress) return;

    this.calibrationInProgress = true;
    this.camera.status = ThermalStatus.CALIBRATING;
    this.emit('status-changed', this.camera.status);

    try {
      logger.info('Performing shutter calibration');

      await this.sendCommand({
        type: 'shutter',
        parameters: { action: 'close' },
        timestamp: Date.now()
      });

      // Wait for shutter to close and capture dark frame
      await new Promise(resolve => setTimeout(resolve, 500));

      await this.sendCommand({
        type: 'shutter',
        parameters: { action: 'open' },
        timestamp: Date.now()
      });

      this.lastShutterTime = Date.now();
      this.emit('calibration-completed');

    } catch (error) {
      logger.error('Shutter calibration failed', error);
      this.emit('calibration-failed', error);
    } finally {
      this.calibrationInProgress = false;
      this.camera.status = this.isStreaming ? ThermalStatus.STREAMING : ThermalStatus.CONNECTED;
      this.emit('status-changed', this.camera.status);
    }
  }

  /**
   * Apply camera settings
   */
  async applySettings(newSettings: Partial<CameraSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };

    if (this.isConnected) {
      // Apply settings to camera
      if (newSettings.frameRate !== undefined) {
        await this.sendCommand({
          type: 'settings',
          parameters: { frameRate: newSettings.frameRate },
          timestamp: Date.now()
        });

        // Update stream interval if streaming
        if (this.isStreaming && this.streamInterval) {
          clearInterval(this.streamInterval);
          const intervalMs = 1000 / newSettings.frameRate;
          this.streamInterval = setInterval(() => this.captureFrame(), intervalMs);
        }
      }

      if (newSettings.integrationTime !== undefined) {
        await this.sendCommand({
          type: 'settings',
          parameters: { integrationTime: newSettings.integrationTime },
          timestamp: Date.now()
        });
      }

      if (newSettings.gain !== undefined) {
        await this.sendCommand({
          type: 'gain',
          parameters: { value: newSettings.gain },
          timestamp: Date.now()
        });
      }

      if (newSettings.temperatureRange !== undefined) {
        await this.sendCommand({
          type: 'settings',
          parameters: { temperatureRange: newSettings.temperatureRange },
          timestamp: Date.now()
        });
      }
    }

    this.emit('settings-changed', this.settings);
  }

  /**
   * Load calibration data
   */
  private async loadCalibration(): Promise<void> {
    try {
      // Try to load calibration from camera memory or file
      const calibrationData = await this.readCalibrationFromCamera();
      
      if (calibrationData) {
        this.temperatureCalibration = calibrationData;
        this.emit('calibration-loaded', calibrationData);
        logger.info('Calibration data loaded');
      }
    } catch (error) {
      logger.warn('No calibration data available', error);
    }
  }

  /**
   * Read calibration from camera
   */
  private async readCalibrationFromCamera(): Promise<ThermalCalibration | null> {
    // Camera-specific calibration reading
    // Return null if not available
    return null;
  }

  /**
   * Set calibration data
   */
  async setCalibration(calibration: ThermalCalibration): Promise<void> {
    this.temperatureCalibration = calibration;
    
    // Save to camera if supported
    try {
      await this.sendCommand({
        type: 'calibrate',
        parameters: calibration,
        timestamp: Date.now()
      });
      
      this.emit('calibration-updated', calibration);
      logger.info('Calibration updated');
    } catch (error) {
      logger.warn('Could not save calibration to camera', error);
    }
  }

  /**
   * Send command to camera
   */
  private async sendCommand(command: CameraCommand): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Camera not connected');
    }

    const commandData = this.formatCommand(command);

    if (this.serialConnection) {
      await this.sendSerialCommand(commandData);
    } else if (this.networkConnection) {
      await this.sendNetworkCommand(commandData);
    } else if (this.usbDevice) {
      await this.sendUSBCommand(commandData);
    }
  }

  /**
   * Format command for transmission
   */
  private formatCommand(command: CameraCommand): Buffer {
    // Camera-specific command formatting
    const commandString = JSON.stringify(command);
    return Buffer.from(commandString + '\n');
  }

  /**
   * Send serial command
   */
  private async sendSerialCommand(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.serialConnection) {
        reject(new Error('Serial connection not available'));
        return;
      }

      this.serialConnection.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send network command
   */
  private async sendNetworkCommand(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.networkConnection) {
        reject(new Error('Network connection not available'));
        return;
      }

      this.networkConnection.write(data, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Send USB command
   */
  private async sendUSBCommand(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.usbDevice) {
        reject(new Error('USB device not available'));
        return;
      }

      // USB command sending implementation
      resolve();
    });
  }

  /**
   * Handle USB data
   */
  private handleUSBData(data: Buffer): void {
    this.frameBuffer.push(data);
    this.processFrameBuffer();
  }

  /**
   * Handle network data
   */
  private handleNetworkData(data: Buffer): void {
    this.frameBuffer.push(data);
    this.processFrameBuffer();
  }

  /**
   * Handle serial data
   */
  private handleSerialData(data: Buffer): void {
    this.frameBuffer.push(data);
    this.processFrameBuffer();
  }

  /**
   * Process accumulated frame data
   */
  private processFrameBuffer(): void {
    // Combine buffer chunks into complete frames
    const totalLength = this.frameBuffer.reduce((sum, buf) => sum + buf.length, 0);
    const expectedFrameSize = this.getExpectedFrameSize();

    if (totalLength >= expectedFrameSize) {
      const frameData = Buffer.concat(this.frameBuffer);
      const frame = this.processThermalData(frameData.slice(0, expectedFrameSize));
      
      if (frame) {
        this.emit('frame', frame);
      }

      // Keep remaining data for next frame
      if (frameData.length > expectedFrameSize) {
        this.frameBuffer = [frameData.slice(expectedFrameSize)];
      } else {
        this.frameBuffer = [];
      }
    }
  }

  /**
   * Get expected frame size in bytes
   */
  private getExpectedFrameSize(): number {
    const { width, height } = this.camera.capabilities.resolution;
    
    // Most thermal cameras use 16-bit per pixel + metadata
    return width * height * 2 + 1024; // 1KB metadata buffer
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    this.isConnected = false;
    this.isStreaming = false;
    this.camera.status = ThermalStatus.DISCONNECTED;

    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }

    this.emit('status-changed', this.camera.status);
    this.emit('disconnected');
    logger.warn('Thermal camera disconnected');
  }

  /**
   * Disconnect from camera
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting thermal camera');

    if (this.isStreaming) {
      await this.stopStream();
    }

    // Close connections
    if (this.serialConnection) {
      this.serialConnection.close();
      this.serialConnection = null;
    }

    if (this.networkConnection) {
      this.networkConnection.destroy();
      this.networkConnection = null;
    }

    if (this.usbDevice) {
      this.usbDevice.close();
      this.usbDevice = null;
    }

    this.isConnected = false;
    this.camera.status = ThermalStatus.DISCONNECTED;
    this.emit('status-changed', this.camera.status);
  }

  /**
   * Get current settings
   */
  getSettings(): CameraSettings {
    return { ...this.settings };
  }

  /**
   * Get camera info
   */
  getCameraInfo(): ThermalCamera {
    return { ...this.camera };
  }

  /**
   * Get calibration data
   */
  getCalibration(): ThermalCalibration | null {
    return this.temperatureCalibration;
  }

  /**
   * Check connection status
   */
  isConnectedToCamera(): boolean {
    return this.isConnected;
  }

  /**
   * Check streaming status
   */
  isStreamingActive(): boolean {
    return this.isStreaming;
  }

  /**
   * Get frame counter
   */
  getFrameCount(): number {
    return this.frameCounter;
  }

  /**
   * Reset frame counter
   */
  resetFrameCounter(): void {
    this.frameCounter = 0;
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    await this.disconnect();
    this.frameBuffer = [];
    this.removeAllListeners();
  }
}