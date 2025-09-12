/**
 * USB Camera Detector
 * Detects and manages USB cameras
 */

import { EventEmitter } from 'events';
import { 
  CameraDevice, 
  CameraType, 
  CameraStatus,
  Resolution
} from '../types';
import { logger } from '../../../utils/logger';

export class USBDetector extends EventEmitter {
  private monitoring: boolean = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private knownDevices: Set<string> = new Set();

  /**
   * Detect USB cameras
   */
  async detectCameras(): Promise<CameraDevice[]> {
    const cameras: CameraDevice[] = [];

    try {
      // Get media devices from browser API
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      for (const device of videoDevices) {
        // Skip built-in cameras for USB detection
        if (device.label.toLowerCase().includes('built-in') || 
            device.label.toLowerCase().includes('integrated')) {
          continue;
        }

        const camera = await this.createUSBCamera(device);
        if (camera) {
          cameras.push(camera);
          this.knownDevices.add(device.deviceId);
        }
      }

      logger.info(`Detected ${cameras.length} USB cameras`);
      return cameras;

    } catch (error) {
      logger.error('USB camera detection failed', error);
      return [];
    }
  }

  /**
   * Create USB camera device
   */
  private async createUSBCamera(device: MediaDeviceInfo): Promise<CameraDevice | null> {
    try {
      // Get camera capabilities
      const capabilities = await this.getCameraCapabilities(device.deviceId);
      
      return {
        id: `usb_${device.deviceId}`,
        name: device.label || `USB Camera ${device.deviceId.substring(0, 8)}`,
        type: CameraType.USB,
        status: CameraStatus.DISCONNECTED,
        capabilities: {
          resolutions: capabilities.resolutions,
          frameRates: capabilities.frameRates,
          hasAudio: false,
          hasPTZ: false,
          hasNightVision: false,
          hasMotionDetection: false,
          hasIR: false,
          supportedCodecs: ['vp8', 'vp9', 'h264'],
          supportedProtocols: ['webrtc']
        },
        connection: {
          type: 'usb',
          devicePath: device.deviceId
        },
        lastSeen: new Date(),
        metadata: {
          manufacturer: this.extractManufacturer(device.label),
          model: this.extractModel(device.label)
        }
      };
    } catch (error) {
      logger.error(`Failed to create USB camera for ${device.label}`, error);
      return null;
    }
  }

  /**
   * Get camera capabilities
   */
  private async getCameraCapabilities(deviceId: string): Promise<{
    resolutions: Resolution[];
    frameRates: number[];
  }> {
    try {
      // Request stream with device ID to get capabilities
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: deviceId },
          width: { ideal: 4096 },
          height: { ideal: 2160 }
        }
      });

      const videoTrack = stream.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : null;
      const settings = videoTrack.getSettings();

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());

      // Extract resolutions
      const resolutions: Resolution[] = [];
      
      // Common resolutions to test
      const commonResolutions = [
        { width: 3840, height: 2160, label: '4K' },
        { width: 1920, height: 1080, label: '1080p' },
        { width: 1280, height: 720, label: '720p' },
        { width: 640, height: 480, label: '480p' },
        { width: 320, height: 240, label: '240p' }
      ];

      if (capabilities) {
        // Filter resolutions based on capabilities
        for (const res of commonResolutions) {
          if (capabilities.width?.max && capabilities.width.max >= res.width &&
              capabilities.height?.max && capabilities.height.max >= res.height) {
            resolutions.push(res);
          }
        }
      } else {
        // Use current settings as baseline
        resolutions.push({
          width: settings.width || 1920,
          height: settings.height || 1080,
          label: `${settings.width}x${settings.height}`
        });
      }

      // Extract frame rates
      const frameRates: number[] = [];
      
      if (capabilities?.frameRate) {
        const minFps = Math.ceil(capabilities.frameRate.min || 15);
        const maxFps = Math.floor(capabilities.frameRate.max || 30);
        
        // Common frame rates
        [15, 24, 25, 30, 60].forEach(fps => {
          if (fps >= minFps && fps <= maxFps) {
            frameRates.push(fps);
          }
        });
      } else {
        frameRates.push(30); // Default
      }

      return { resolutions, frameRates };

    } catch (error) {
      // Return defaults on error
      return {
        resolutions: [
          { width: 1920, height: 1080, label: '1080p' },
          { width: 1280, height: 720, label: '720p' },
          { width: 640, height: 480, label: '480p' }
        ],
        frameRates: [30]
      };
    }
  }

  /**
   * Extract manufacturer from label
   */
  private extractManufacturer(label: string): string {
    const manufacturers = ['Logitech', 'Microsoft', 'Razer', 'Creative', 'Genius', 'HP', 'Dell'];
    
    for (const manufacturer of manufacturers) {
      if (label.toLowerCase().includes(manufacturer.toLowerCase())) {
        return manufacturer;
      }
    }
    
    return 'Unknown';
  }

  /**
   * Extract model from label
   */
  private extractModel(label: string): string {
    // Remove manufacturer name if found
    const manufacturer = this.extractManufacturer(label);
    if (manufacturer !== 'Unknown') {
      return label.replace(new RegExp(manufacturer, 'i'), '').trim();
    }
    return label;
  }

  /**
   * Start monitoring for USB camera changes
   */
  startMonitoring(): void {
    if (this.monitoring) return;

    this.monitoring = true;
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);

    // Also poll periodically as backup
    this.monitorInterval = setInterval(() => {
      this.checkForChanges();
    }, 5000);

    logger.info('USB camera monitoring started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.monitoring = false;

    navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    logger.info('USB camera monitoring stopped');
  }

  /**
   * Handle device change event
   */
  private handleDeviceChange = async (): Promise<void> => {
    await this.checkForChanges();
  };

  /**
   * Check for camera changes
   */
  private async checkForChanges(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      const currentDeviceIds = new Set<string>();
      
      // Check for new devices
      for (const device of videoDevices) {
        // Skip built-in cameras
        if (device.label.toLowerCase().includes('built-in') || 
            device.label.toLowerCase().includes('integrated')) {
          continue;
        }

        currentDeviceIds.add(device.deviceId);
        
        if (!this.knownDevices.has(device.deviceId)) {
          // New camera connected
          const camera = await this.createUSBCamera(device);
          if (camera) {
            this.knownDevices.add(device.deviceId);
            this.emit('camera-connected', camera);
            logger.info(`USB camera connected: ${camera.name}`);
          }
        }
      }
      
      // Check for removed devices
      for (const deviceId of this.knownDevices) {
        if (!currentDeviceIds.has(deviceId)) {
          // Camera disconnected
          this.knownDevices.delete(deviceId);
          this.emit('camera-disconnected', `usb_${deviceId}`);
          logger.info(`USB camera disconnected: ${deviceId}`);
        }
      }
    } catch (error) {
      logger.error('Failed to check for USB camera changes', error);
    }
  }

  /**
   * Test USB camera
   */
  async testCamera(camera: CameraDevice): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          deviceId: { exact: camera.connection.devicePath }
        }
      });

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get camera stream
   */
  async getCameraStream(
    deviceId: string,
    constraints?: MediaTrackConstraints
  ): Promise<MediaStream | null> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          ...constraints
        }
      });
      
      return stream;
    } catch (error) {
      logger.error(`Failed to get camera stream for ${deviceId}`, error);
      return null;
    }
  }

  /**
   * Take snapshot from camera
   */
  async takeSnapshot(deviceId: string): Promise<Blob | null> {
    try {
      const stream = await this.getCameraStream(deviceId);
      if (!stream) return null;

      // Create video element
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      // Wait for video to load
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve;
      });

      // Create canvas and capture frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);

      // Stop stream
      stream.getTracks().forEach(track => track.stop());

      // Convert to blob
      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });

    } catch (error) {
      logger.error(`Failed to take snapshot from ${deviceId}`, error);
      return null;
    }
  }

  /**
   * Get available USB cameras
   */
  async getAvailableCameras(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => 
        device.kind === 'videoinput' &&
        !device.label.toLowerCase().includes('built-in') &&
        !device.label.toLowerCase().includes('integrated')
      );
    } catch (error) {
      logger.error('Failed to get available cameras', error);
      return [];
    }
  }
}