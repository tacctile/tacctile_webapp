/**
 * Laser Projector Controller
 * Controls various types of laser projectors for grid pattern projection
 */

import { EventEmitter } from 'events';
import { SerialPort } from 'serialport';
import * as net from 'net';
import { 
  LaserProjector, 
  LaserStatus, 
  GridPattern, 
  ProjectorCapabilities,
  SafetyConfig,
  LaserDot,
  Vector2,
  LaserColor,
  PatternType
} from '../types';
import { logger } from '../../../utils/logger';

export interface ProjectorCommand {
  type: 'power' | 'pattern' | 'position' | 'intensity' | 'color' | 'safety';
  parameters: { [key: string]: any };
  timestamp: number;
}

export class LaserProjectorController extends EventEmitter {
  private projector: LaserProjector;
  private serialConnection: SerialPort | null = null;
  private networkConnection: net.Socket | null = null;
  private isConnected: boolean = false;
  private currentPattern: GridPattern | null = null;
  private safetyConfig: SafetyConfig;
  private commandQueue: ProjectorCommand[] = [];
  private processingCommand: boolean = false;
  private temperatureMonitor: NodeJS.Timeout | null = null;
  private powerOutput: number = 0; // Current power output in mW

  constructor(projector: LaserProjector, safetyConfig: SafetyConfig) {
    super();
    this.projector = projector;
    this.safetyConfig = safetyConfig;
  }

  /**
   * Connect to laser projector
   */
  async connect(): Promise<boolean> {
    logger.info(`Connecting to laser projector: ${this.projector.name}`);
    
    try {
      this.projector.status = LaserStatus.CONNECTING;
      this.emit('status-changed', this.projector.status);

      switch (this.projector.connection.type) {
        case 'serial':
          await this.connectSerial();
          break;
        case 'network':
          await this.connectNetwork();
          break;
        case 'usb':
          await this.connectUSB();
          break;
        case 'gpio':
          await this.connectGPIO();
          break;
        default:
          throw new Error(`Unsupported connection type: ${this.projector.connection.type}`);
      }

      this.isConnected = true;
      this.projector.status = LaserStatus.CONNECTED;
      this.projector.lastSeen = new Date();

      // Initialize safety monitoring
      this.startSafetyMonitoring();

      // Send initialization commands
      await this.initializeProjector();

      this.emit('connected');
      this.emit('status-changed', this.projector.status);
      logger.info(`Laser projector connected: ${this.projector.name}`);

      return true;
    } catch (error) {
      this.projector.status = LaserStatus.ERROR;
      this.emit('status-changed', this.projector.status);
      this.emit('error', error);
      logger.error('Failed to connect to laser projector', error);
      return false;
    }
  }

  /**
   * Connect via serial port
   */
  private async connectSerial(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { port, baudRate = 9600 } = this.projector.connection;
      
      if (!port) {
        reject(new Error('Serial port not specified'));
        return;
      }

      this.serialConnection = new SerialPort({
        path: port,
        baudRate: baudRate
      });

      this.serialConnection.on('open', () => {
        logger.info(`Serial connection opened on ${port}`);
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
   * Connect via network
   */
  private async connectNetwork(): Promise<void> {
    return new Promise((resolve, reject) => {
      const { address, port = 8080 } = this.projector.connection;
      
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
   * Connect via USB
   */
  private async connectUSB(): Promise<void> {
    // USB connection implementation would depend on specific device drivers
    // This is a placeholder for USB HID or other USB protocols
    
    logger.info('USB connection not yet implemented');
    throw new Error('USB connection not yet implemented');
  }

  /**
   * Connect via GPIO (Raspberry Pi)
   */
  private async connectGPIO(): Promise<void> {
    // GPIO connection for Raspberry Pi or similar platforms
    // Would use libraries like pigpio or onoff
    
    logger.info('GPIO connection not yet implemented');
    throw new Error('GPIO connection not yet implemented');
  }

  /**
   * Initialize projector settings
   */
  private async initializeProjector(): Promise<void> {
    // Send initialization sequence
    await this.sendCommand({
      type: 'power',
      parameters: { enabled: false }, // Start with laser off
      timestamp: Date.now()
    });

    await this.sendCommand({
      type: 'intensity',
      parameters: { level: 0 },
      timestamp: Date.now()
    });

    // Query projector capabilities if supported
    if (this.supportsCommand('query_caps')) {
      await this.queryCapabilities();
    }
  }

  /**
   * Start safety monitoring
   */
  private startSafetyMonitoring(): void {
    if (this.safetyConfig.temperatureMonitoring) {
      this.temperatureMonitor = setInterval(() => {
        this.checkTemperature();
      }, 5000); // Check every 5 seconds
    }

    // Emergency stop handler
    if (this.safetyConfig.emergencyStop) {
      process.on('SIGINT', () => {
        this.emergencyStop();
      });
    }

    // Automatic shutoff timer
    if (this.safetyConfig.shutoffTimeout > 0) {
      setTimeout(() => {
        this.emergencyStop();
        logger.warn('Safety shutoff timeout reached');
      }, this.safetyConfig.shutoffTimeout * 1000);
    }
  }

  /**
   * Project grid pattern
   */
  async projectPattern(pattern: GridPattern): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Projector not connected');
    }

    // Safety check
    if (this.powerOutput > this.safetyConfig.maxPowerOutput) {
      throw new Error('Power output exceeds safety limit');
    }

    this.currentPattern = pattern;
    this.projector.status = LaserStatus.PROJECTING;
    this.emit('status-changed', this.projector.status);

    logger.info(`Projecting pattern: ${pattern.name}`);

    try {
      // Enable laser
      await this.sendCommand({
        type: 'power',
        parameters: { enabled: true },
        timestamp: Date.now()
      });

      // Set overall intensity
      await this.sendCommand({
        type: 'intensity',
        parameters: { level: pattern.intensity },
        timestamp: Date.now()
      });

      // Project pattern based on type
      switch (pattern.type) {
        case PatternType.GRID:
          await this.projectGridPattern(pattern);
          break;
        case PatternType.RANDOM_DOTS:
          await this.projectRandomDots(pattern);
          break;
        case PatternType.CONCENTRIC_CIRCLES:
          await this.projectConcentricCircles(pattern);
          break;
        case PatternType.SPIRAL:
          await this.projectSpiral(pattern);
          break;
        case PatternType.CROSS_HATCH:
          await this.projectCrossHatch(pattern);
          break;
        case PatternType.CONSTELLATION:
          await this.projectConstellation(pattern);
          break;
        case PatternType.CUSTOM:
          await this.projectCustomPattern(pattern);
          break;
      }

      this.emit('pattern-projected', pattern);
      
    } catch (error) {
      this.projector.status = LaserStatus.ERROR;
      this.emit('status-changed', this.projector.status);
      throw error;
    }
  }

  /**
   * Project grid pattern
   */
  private async projectGridPattern(pattern: GridPattern): Promise<void> {
    const dots = this.generateGridDots(pattern);
    
    for (const dot of dots) {
      await this.projectDot(dot);
    }
  }

  /**
   * Generate grid dots
   */
  private generateGridDots(pattern: GridPattern): LaserDot[] {
    const dots: LaserDot[] = [];
    const { spacing = 50 } = pattern.parameters;
    const { width, height } = pattern.bounds;
    
    const dotsX = Math.floor(width / spacing);
    const dotsY = Math.floor(height / spacing);
    
    for (let y = 0; y < dotsY; y++) {
      for (let x = 0; x < dotsX; x++) {
        const position = {
          x: (x - dotsX / 2) * spacing + pattern.bounds.centerX,
          y: (y - dotsY / 2) * spacing + pattern.bounds.centerY
        };

        dots.push({
          id: `grid_${x}_${y}`,
          position,
          intensity: pattern.intensity,
          color: pattern.color,
          size: 5,
          enabled: true
        });
      }
    }
    
    return dots;
  }

  /**
   * Project random dots pattern
   */
  private async projectRandomDots(pattern: GridPattern): Promise<void> {
    const { density = 100 } = pattern.parameters;
    const { width, height } = pattern.bounds;
    
    for (let i = 0; i < density; i++) {
      const position = {
        x: (Math.random() - 0.5) * width + pattern.bounds.centerX,
        y: (Math.random() - 0.5) * height + pattern.bounds.centerY
      };

      const dot: LaserDot = {
        id: `random_${i}`,
        position,
        intensity: pattern.intensity * (0.5 + Math.random() * 0.5),
        color: pattern.color,
        size: 3 + Math.random() * 4,
        enabled: true
      };

      await this.projectDot(dot);
    }
  }

  /**
   * Project concentric circles pattern
   */
  private async projectConcentricCircles(pattern: GridPattern): Promise<void> {
    const { radius = 100, layers = 5 } = pattern.parameters;
    
    for (let layer = 1; layer <= layers; layer++) {
      const currentRadius = (radius / layers) * layer;
      const circumference = 2 * Math.PI * currentRadius;
      const dotsInCircle = Math.floor(circumference / 10); // 10 pixel spacing
      
      for (let i = 0; i < dotsInCircle; i++) {
        const angle = (2 * Math.PI * i) / dotsInCircle;
        const position = {
          x: Math.cos(angle) * currentRadius + pattern.bounds.centerX,
          y: Math.sin(angle) * currentRadius + pattern.bounds.centerY
        };

        const dot: LaserDot = {
          id: `circle_${layer}_${i}`,
          position,
          intensity: pattern.intensity,
          color: pattern.color,
          size: 4,
          enabled: true
        };

        await this.projectDot(dot);
      }
    }
  }

  /**
   * Project spiral pattern
   */
  private async projectSpiral(pattern: GridPattern): Promise<void> {
    const { radius = 100, density = 200 } = pattern.parameters;
    
    for (let i = 0; i < density; i++) {
      const t = i / density;
      const angle = t * 10 * Math.PI; // 5 full rotations
      const currentRadius = t * radius;
      
      const position = {
        x: Math.cos(angle) * currentRadius + pattern.bounds.centerX,
        y: Math.sin(angle) * currentRadius + pattern.bounds.centerY
      };

      const dot: LaserDot = {
        id: `spiral_${i}`,
        position,
        intensity: pattern.intensity,
        color: pattern.color,
        size: 3,
        enabled: true
      };

      await this.projectDot(dot);
    }
  }

  /**
   * Project cross-hatch pattern
   */
  private async projectCrossHatch(pattern: GridPattern): Promise<void> {
    const { spacing = 30 } = pattern.parameters;
    const { width, height } = pattern.bounds;
    
    // Horizontal lines
    const linesY = Math.floor(height / spacing);
    for (let y = 0; y < linesY; y++) {
      const dotsPerLine = Math.floor(width / 10);
      for (let x = 0; x < dotsPerLine; x++) {
        const position = {
          x: (x - dotsPerLine / 2) * 10 + pattern.bounds.centerX,
          y: (y - linesY / 2) * spacing + pattern.bounds.centerY
        };

        await this.projectDot({
          id: `hatch_h_${y}_${x}`,
          position,
          intensity: pattern.intensity,
          color: pattern.color,
          size: 2,
          enabled: true
        });
      }
    }

    // Vertical lines
    const linesX = Math.floor(width / spacing);
    for (let x = 0; x < linesX; x++) {
      const dotsPerLine = Math.floor(height / 10);
      for (let y = 0; y < dotsPerLine; y++) {
        const position = {
          x: (x - linesX / 2) * spacing + pattern.bounds.centerX,
          y: (y - dotsPerLine / 2) * 10 + pattern.bounds.centerY
        };

        await this.projectDot({
          id: `hatch_v_${x}_${y}`,
          position,
          intensity: pattern.intensity,
          color: pattern.color,
          size: 2,
          enabled: true
        });
      }
    }
  }

  /**
   * Project constellation pattern
   */
  private async projectConstellation(pattern: GridPattern): Promise<void> {
    // Predefined star patterns
    const constellations = {
      'big_dipper': [
        { x: -100, y: 50 }, { x: -50, y: 60 }, { x: 0, y: 55 },
        { x: 50, y: 45 }, { x: 80, y: 20 }, { x: 60, y: -10 }, { x: 90, y: -30 }
      ],
      'orion': [
        { x: -80, y: 100 }, { x: -40, y: 80 }, { x: 0, y: 60 },
        { x: 40, y: 80 }, { x: 80, y: 100 }, { x: -20, y: 20 },
        { x: 0, y: 0 }, { x: 20, y: 20 }
      ]
    };

    const selectedConstellation = constellations['big_dipper']; // Default
    
    for (let i = 0; i < selectedConstellation.length; i++) {
      const star = selectedConstellation[i];
      const position = {
        x: star.x + pattern.bounds.centerX,
        y: star.y + pattern.bounds.centerY
      };

      await this.projectDot({
        id: `star_${i}`,
        position,
        intensity: pattern.intensity * (0.7 + Math.random() * 0.3),
        color: pattern.color,
        size: 6,
        enabled: true
      });
    }
  }

  /**
   * Project custom pattern
   */
  private async projectCustomPattern(pattern: GridPattern): Promise<void> {
    for (const dot of pattern.dots) {
      if (dot.enabled) {
        await this.projectDot(dot);
      }
    }
  }

  /**
   * Project individual dot
   */
  private async projectDot(dot: LaserDot): Promise<void> {
    await this.sendCommand({
      type: 'position',
      parameters: {
        x: dot.position.x,
        y: dot.position.y
      },
      timestamp: Date.now()
    });

    await this.sendCommand({
      type: 'intensity',
      parameters: {
        level: dot.intensity
      },
      timestamp: Date.now()
    });

    if (this.projector.capabilities.hasColorControl) {
      await this.sendCommand({
        type: 'color',
        parameters: {
          r: dot.color.r,
          g: dot.color.g,
          b: dot.color.b
        },
        timestamp: Date.now()
      });
    }

    // Small delay to allow positioning
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  /**
   * Stop projection
   */
  async stopProjection(): Promise<void> {
    logger.info('Stopping laser projection');

    await this.sendCommand({
      type: 'power',
      parameters: { enabled: false },
      timestamp: Date.now()
    });

    this.currentPattern = null;
    this.powerOutput = 0;
    this.projector.status = LaserStatus.CONNECTED;
    this.emit('status-changed', this.projector.status);
    this.emit('projection-stopped');
  }

  /**
   * Emergency stop
   */
  async emergencyStop(): Promise<void> {
    logger.warn('EMERGENCY STOP activated');

    try {
      // Immediately disable laser
      await this.sendCommand({
        type: 'power',
        parameters: { enabled: false },
        timestamp: Date.now()
      });

      await this.sendCommand({
        type: 'safety',
        parameters: { emergency: true },
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('Error during emergency stop', error);
    }

    this.currentPattern = null;
    this.powerOutput = 0;
    this.projector.status = LaserStatus.ERROR;
    this.emit('status-changed', this.projector.status);
    this.emit('emergency-stop');
  }

  /**
   * Send command to projector
   */
  private async sendCommand(command: ProjectorCommand): Promise<void> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push(command);
      
      if (!this.processingCommand) {
        this.processCommandQueue().then(resolve).catch(reject);
      } else {
        resolve();
      }
    });
  }

  /**
   * Process command queue
   */
  private async processCommandQueue(): Promise<void> {
    if (this.processingCommand || this.commandQueue.length === 0) {
      return;
    }

    this.processingCommand = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift()!;
      
      try {
        await this.executeCommand(command);
      } catch (error) {
        logger.error('Command execution failed', error);
        this.emit('command-error', { command, error });
      }
    }

    this.processingCommand = false;
  }

  /**
   * Execute individual command
   */
  private async executeCommand(command: ProjectorCommand): Promise<void> {
    const commandString = this.formatCommand(command);
    
    if (this.serialConnection) {
      await this.sendSerialCommand(commandString);
    } else if (this.networkConnection) {
      await this.sendNetworkCommand(commandString);
    }
  }

  /**
   * Format command for transmission
   */
  private formatCommand(command: ProjectorCommand): string {
    // Generic command format - would be customized per projector type
    switch (command.type) {
      case 'power':
        return `PWR ${command.parameters.enabled ? 1 : 0}\n`;
      case 'position':
        return `POS ${command.parameters.x} ${command.parameters.y}\n`;
      case 'intensity':
        return `INT ${Math.round(command.parameters.level * 255)}\n`;
      case 'color':
        return `RGB ${command.parameters.r} ${command.parameters.g} ${command.parameters.b}\n`;
      case 'safety':
        return `SAFE ${command.parameters.emergency ? 1 : 0}\n`;
      default:
        return `UNK\n`;
    }
  }

  /**
   * Send serial command
   */
  private async sendSerialCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.serialConnection) {
        reject(new Error('Serial connection not available'));
        return;
      }

      this.serialConnection.write(command, (error) => {
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
  private async sendNetworkCommand(command: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.networkConnection) {
        reject(new Error('Network connection not available'));
        return;
      }

      this.networkConnection.write(command, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Handle serial data
   */
  private handleSerialData(data: Buffer): void {
    const response = data.toString().trim();
    this.processResponse(response);
  }

  /**
   * Handle network data
   */
  private handleNetworkData(data: Buffer): void {
    const response = data.toString().trim();
    this.processResponse(response);
  }

  /**
   * Process response from projector
   */
  private processResponse(response: string): void {
    this.emit('response', response);

    // Parse response based on projector protocol
    if (response.startsWith('OK')) {
      // Command acknowledged
    } else if (response.startsWith('ERR')) {
      this.emit('error', new Error(`Projector error: ${response}`));
    } else if (response.startsWith('TEMP')) {
      const temperature = parseFloat(response.split(' ')[1]);
      this.emit('temperature', temperature);
      
      if (temperature > 60) { // 60°C threshold
        this.emergencyStop();
      }
    }
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    this.isConnected = false;
    this.projector.status = LaserStatus.DISCONNECTED;
    this.emit('status-changed', this.projector.status);
    this.emit('disconnected');
    
    if (this.temperatureMonitor) {
      clearInterval(this.temperatureMonitor);
      this.temperatureMonitor = null;
    }
  }

  /**
   * Check temperature
   */
  private async checkTemperature(): Promise<void> {
    if (this.supportsCommand('query_temp')) {
      await this.sendCommand({
        type: 'safety',
        parameters: { query: 'temperature' },
        timestamp: Date.now()
      });
    }
  }

  /**
   * Query projector capabilities
   */
  private async queryCapabilities(): Promise<void> {
    await this.sendCommand({
      type: 'safety',
      parameters: { query: 'capabilities' },
      timestamp: Date.now()
    });
  }

  /**
   * Check if projector supports command
   */
  private supportsCommand(command: string): boolean {
    // Would check against projector capabilities
    return true; // Placeholder
  }

  /**
   * Disconnect from projector
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from laser projector');

    // Stop projection first
    if (this.currentPattern) {
      await this.stopProjection();
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

    if (this.temperatureMonitor) {
      clearInterval(this.temperatureMonitor);
      this.temperatureMonitor = null;
    }

    this.isConnected = false;
    this.projector.status = LaserStatus.DISCONNECTED;
    this.emit('status-changed', this.projector.status);
  }

  /**
   * Get current status
   */
  getStatus(): LaserStatus {
    return this.projector.status;
  }

  /**
   * Get current pattern
   */
  getCurrentPattern(): GridPattern | null {
    return this.currentPattern;
  }

  /**
   * Check if connected
   */
  isProjectorConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get power output
   */
  getPowerOutput(): number {
    return this.powerOutput;
  }

  /**
   * Cleanup
   */
  async dispose(): Promise<void> {
    await this.disconnect();
    this.removeAllListeners();
  }
}