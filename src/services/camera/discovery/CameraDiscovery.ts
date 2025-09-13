/**
 * Camera Discovery Service
 * Discovers and manages various types of cameras
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { 
  CameraDevice, 
  CameraType, 
  CameraStatus,
  NetworkDiscoveryOptions,
  ONVIFDevice
} from '../types';
import { NetworkScanner } from './NetworkScanner';
import { ONVIFDiscovery } from './ONVIFDiscovery';
import { USBDetector } from './USBDetector';
import { MobileConnector } from './MobileConnector';
import { logger } from '../../../utils/logger';

export class CameraDiscovery extends EventEmitter {
  private cameras: Map<string, CameraDevice> = new Map();
  private networkScanner: NetworkScanner;
  private onvifDiscovery: ONVIFDiscovery;
  private usbDetector: USBDetector;
  private mobileConnector: MobileConnector;
  private discoveryInterval: NodeJS.Timeout | null = null;
  private isScanning = false;

  constructor() {
    super();
    this.networkScanner = new NetworkScanner();
    this.onvifDiscovery = new ONVIFDiscovery();
    this.usbDetector = new USBDetector();
    this.mobileConnector = new MobileConnector();
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for discovery services
   */
  private setupEventHandlers(): void {
    // USB camera events
    this.usbDetector.on('camera-connected', (camera) => {
      this.addCamera(camera);
    });
    
    this.usbDetector.on('camera-disconnected', (cameraId) => {
      this.removeCamera(cameraId);
    });
    
    // Network camera events
    this.networkScanner.on('camera-found', (camera) => {
      this.addCamera(camera);
    });
    
    // ONVIF camera events
    this.onvifDiscovery.on('device-found', (device) => {
      this.addONVIFDevice(device);
    });
    
    // Mobile app events
    this.mobileConnector.on('device-connected', (device) => {
      this.addMobileDevice(device);
    });
    
    this.mobileConnector.on('device-disconnected', (deviceId) => {
      this.removeCamera(deviceId);
    });
  }

  /**
   * Start camera discovery
   */
  async startDiscovery(options?: {
    continuous?: boolean;
    interval?: number;
    network?: NetworkDiscoveryOptions;
  }): Promise<void> {
    if (this.isScanning) {
      logger.warn('Discovery already in progress');
      return;
    }
    
    this.isScanning = true;
    logger.info('Starting camera discovery');
    
    try {
      // Start all discovery methods in parallel
      await Promise.all([
        this.discoverUSBCameras(),
        this.discoverNetworkCameras(options?.network),
        this.discoverONVIFCameras(),
        this.startMobileListener()
      ]);
      
      // Setup continuous discovery if requested
      if (options?.continuous) {
        const interval = options.interval || 30000; // Default 30 seconds
        this.discoveryInterval = setInterval(() => {
          this.refreshDiscovery(options.network);
        }, interval);
      }
      
      this.emit('discovery-complete', Array.from(this.cameras.values()));
      logger.info(`Discovery complete. Found ${this.cameras.size} cameras`);
      
    } catch (error) {
      logger.error('Discovery failed', error);
      this.emit('discovery-error', error);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Stop camera discovery
   */
  stopDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }
    
    this.usbDetector.stopMonitoring();
    this.networkScanner.stopScan();
    this.onvifDiscovery.stopDiscovery();
    this.mobileConnector.stopListening();
    
    logger.info('Discovery stopped');
  }

  /**
   * Discover USB cameras
   */
  private async discoverUSBCameras(): Promise<void> {
    try {
      const cameras = await this.usbDetector.detectCameras();
      
      for (const camera of cameras) {
        this.addCamera(camera);
      }
      
      // Start monitoring for changes
      this.usbDetector.startMonitoring();
      
      logger.info(`Found ${cameras.length} USB cameras`);
    } catch (error) {
      logger.error('USB camera discovery failed', error);
    }
  }

  /**
   * Discover network cameras
   */
  private async discoverNetworkCameras(options?: NetworkDiscoveryOptions): Promise<void> {
    try {
      // Get network interfaces
      const interfaces = this.getNetworkInterfaces();
      
      for (const iface of interfaces) {
        const subnet = this.getSubnetFromInterface(iface);
        
        const scanOptions: NetworkDiscoveryOptions = {
          scanIPRange: subnet,
          scanPorts: options?.scanPorts || [554, 8554, 80, 8080], // Common RTSP/HTTP ports
          timeout: options?.timeout || 2000,
          protocols: options?.protocols || ['rtsp', 'http'],
          concurrent: options?.concurrent || 10
        };
        
        const cameras = await this.networkScanner.scan(scanOptions);
        
        for (const camera of cameras) {
          this.addCamera(camera);
        }
      }
      
      logger.info('Network camera scan complete');
    } catch (error) {
      logger.error('Network camera discovery failed', error);
    }
  }

  /**
   * Discover ONVIF cameras
   */
  private async discoverONVIFCameras(): Promise<void> {
    try {
      const devices = await this.onvifDiscovery.discover();
      
      for (const device of devices) {
        await this.addONVIFDevice(device);
      }
      
      logger.info(`Found ${devices.length} ONVIF devices`);
    } catch (error) {
      logger.error('ONVIF discovery failed', error);
    }
  }

  /**
   * Start mobile app listener
   */
  private async startMobileListener(): Promise<void> {
    try {
      await this.mobileConnector.startListening();
      logger.info('Mobile app listener started');
    } catch (error) {
      logger.error('Failed to start mobile listener', error);
    }
  }

  /**
   * Add ONVIF device as camera
   */
  private async addONVIFDevice(device: ONVIFDevice): Promise<void> {
    try {
      // Get device profiles and capabilities
      const profiles = await this.onvifDiscovery.getProfiles(device);
      
      for (const profile of profiles) {
        const camera: CameraDevice = {
          id: `onvif_${device.address}_${profile.token}`,
          name: `ONVIF Camera - ${profile.name}`,
          type: CameraType.IP_ONVIF,
          status: CameraStatus.DISCONNECTED,
          capabilities: {
            resolutions: profile.videoEncoder ? [profile.videoEncoder.resolution] : [],
            frameRates: profile.videoEncoder ? [profile.videoEncoder.frameRate] : [],
            hasAudio: !!profile.audioEncoder,
            hasPTZ: device.capabilities?.ptz || false,
            hasNightVision: false,
            hasMotionDetection: device.capabilities?.analytics || false,
            hasIR: false,
            supportedCodecs: profile.videoEncoder ? [profile.videoEncoder.encoding] : [],
            supportedProtocols: ['rtsp', 'onvif']
          },
          connection: {
            type: 'network',
            address: device.address,
            port: device.port,
            username: device.username,
            password: device.password,
            rtspUrl: profile.streamUri,
            onvifUrl: `http://${device.address}:${device.port}/onvif/device_service`
          },
          lastSeen: new Date()
        };
        
        this.addCamera(camera);
      }
    } catch (error) {
      logger.error(`Failed to add ONVIF device ${device.address}`, error);
    }
  }

  /**
   * Add mobile device as camera
   */
  private addMobileDevice(device: any): void {
    const camera: CameraDevice = {
      id: `mobile_${device.deviceId}`,
      name: device.deviceName,
      type: CameraType.MOBILE,
      status: CameraStatus.CONNECTED,
      capabilities: {
        resolutions: [device.capabilities.maxResolution],
        frameRates: [30, 60],
        hasAudio: true,
        hasPTZ: false,
        hasNightVision: false,
        hasMotionDetection: true,
        hasIR: false,
        supportedCodecs: device.capabilities.supportedCodecs,
        supportedProtocols: ['webrtc', 'websocket']
      },
      connection: {
        type: 'mobile',
        address: device.address
      },
      lastSeen: new Date(),
      metadata: {
        manufacturer: device.platform === 'ios' ? 'Apple' : 'Android',
        model: device.deviceName
      }
    };
    
    this.addCamera(camera);
  }

  /**
   * Add camera to registry
   */
  private addCamera(camera: CameraDevice): void {
    const existing = this.cameras.get(camera.id);
    
    if (existing) {
      // Update existing camera
      camera.status = existing.status;
      camera.stream = existing.stream;
    }
    
    this.cameras.set(camera.id, camera);
    this.emit('camera-added', camera);
    
    logger.info(`Camera added: ${camera.name} (${camera.type})`);
  }

  /**
   * Remove camera from registry
   */
  private removeCamera(cameraId: string): void {
    const camera = this.cameras.get(cameraId);
    
    if (camera) {
      this.cameras.delete(cameraId);
      this.emit('camera-removed', camera);
      logger.info(`Camera removed: ${camera.name}`);
    }
  }

  /**
   * Refresh discovery
   */
  private async refreshDiscovery(options?: NetworkDiscoveryOptions): Promise<void> {
    logger.debug('Refreshing camera discovery');
    
    // Mark all cameras as potentially disconnected
    for (const camera of this.cameras.values()) {
      if (camera.type !== CameraType.USB && camera.type !== CameraType.MOBILE) {
        camera.lastSeen = new Date(Date.now() - 60000); // 1 minute ago
      }
    }
    
    // Re-run discovery
    await Promise.all([
      this.discoverUSBCameras(),
      this.discoverNetworkCameras(options),
      this.discoverONVIFCameras()
    ]);
    
    // Remove cameras not seen recently
    const cutoff = Date.now() - 120000; // 2 minutes
    for (const [id, camera] of this.cameras.entries()) {
      if (camera.lastSeen.getTime() < cutoff) {
        this.removeCamera(id);
      }
    }
  }

  /**
   * Get network interfaces
   */
  private getNetworkInterfaces(): os.NetworkInterfaceInfo[] {
    const interfaces: os.NetworkInterfaceInfo[] = [];
    const networkInterfaces = os.networkInterfaces();
    
    for (const name in networkInterfaces) {
      const iface = networkInterfaces[name];
      if (iface) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            interfaces.push(addr);
          }
        }
      }
    }
    
    return interfaces;
  }

  /**
   * Get subnet from interface
   */
  private getSubnetFromInterface(iface: os.NetworkInterfaceInfo): string {
    const parts = iface.address.split('.');
    const netmask = iface.netmask.split('.');
    
    const subnet = parts.map((part, i) => {
      const mask = parseInt(netmask[i]);
      return parseInt(part) & mask;
    });
    
    // Return subnet with wildcard for last octet
    return `${subnet[0]}.${subnet[1]}.${subnet[2]}.0/24`;
  }

  /**
   * Get discovered cameras
   */
  getCameras(): CameraDevice[] {
    return Array.from(this.cameras.values());
  }

  /**
   * Get camera by ID
   */
  getCamera(cameraId: string): CameraDevice | undefined {
    return this.cameras.get(cameraId);
  }

  /**
   * Get cameras by type
   */
  getCamerasByType(type: CameraType): CameraDevice[] {
    return Array.from(this.cameras.values()).filter(c => c.type === type);
  }

  /**
   * Test camera connection
   */
  async testConnection(cameraId: string): Promise<boolean> {
    const camera = this.cameras.get(cameraId);
    if (!camera) return false;
    
    try {
      switch (camera.type) {
        case CameraType.USB:
          return await this.usbDetector.testCamera(camera);
          
        case CameraType.IP_RTSP:
          return await this.networkScanner.testRTSP(camera.connection.rtspUrl!);
          
        case CameraType.IP_ONVIF:
          return await this.onvifDiscovery.testConnection(camera.connection);
          
        case CameraType.MOBILE:
          return await this.mobileConnector.ping(camera.id);
          
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Connection test failed for ${cameraId}`, error);
      return false;
    }
  }

  /**
   * Update camera status
   */
  updateCameraStatus(cameraId: string, status: CameraStatus): void {
    const camera = this.cameras.get(cameraId);
    
    if (camera) {
      camera.status = status;
      camera.lastSeen = new Date();
      this.emit('camera-status-changed', { cameraId, status });
    }
  }

  /**
   * Manual camera addition
   */
  async addManualCamera(config: {
    name: string;
    type: CameraType;
    connection: any;
  }): Promise<CameraDevice | null> {
    try {
      let camera: CameraDevice | null = null;
      
      switch (config.type) {
        case CameraType.IP_RTSP:
          camera = await this.networkScanner.addRTSPCamera(
            config.name,
            config.connection.rtspUrl
          );
          break;
          
        case CameraType.IP_ONVIF: {
          const device: ONVIFDevice = {
            address: config.connection.address,
            port: config.connection.port || 80,
            username: config.connection.username,
            password: config.connection.password
          };
          await this.addONVIFDevice(device);
          return this.getCameras().find(c => 
            c.connection.address === device.address
          ) || null;
        }
          
        default:
          logger.warn(`Manual addition not supported for type ${config.type}`);
      }
      
      if (camera) {
        this.addCamera(camera);
      }
      
      return camera;
    } catch (error) {
      logger.error('Failed to add manual camera', error);
      return null;
    }
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopDiscovery();
    this.cameras.clear();
    this.removeAllListeners();
  }
}