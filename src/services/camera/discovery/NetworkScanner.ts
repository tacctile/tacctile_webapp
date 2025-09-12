/**
 * Network Scanner
 * Scans network for IP cameras
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import * as http from 'http';
import { 
  CameraDevice, 
  CameraType, 
  CameraStatus,
  NetworkDiscoveryOptions,
  Resolution
} from '../types';
import { logger } from '../../../utils/logger';

export class NetworkScanner extends EventEmitter {
  private scanning = false;
  private abortController: AbortController | null = null;

  /**
   * Scan network for cameras
   */
  async scan(options: NetworkDiscoveryOptions): Promise<CameraDevice[]> {
    if (this.scanning) {
      throw new Error('Scan already in progress');
    }

    this.scanning = true;
    this.abortController = new AbortController();
    const cameras: CameraDevice[] = [];

    try {
      const ipRange = this.parseIPRange(options.scanIPRange || '192.168.1.0/24');
      const ports = options.scanPorts || [554, 8554];
      const protocols = options.protocols || ['rtsp'];
      const concurrent = options.concurrent || 10;
      const timeout = options.timeout || 2000;

      logger.info(`Scanning ${ipRange.length} IPs on ports ${ports.join(', ')}`);

      // Batch IP scanning for performance
      for (let i = 0; i < ipRange.length; i += concurrent) {
        if (this.abortController.signal.aborted) break;

        const batch = ipRange.slice(i, i + concurrent);
        const batchPromises = batch.map(ip => 
          this.scanIP(ip, ports, protocols, timeout)
        );

        const results = await Promise.allSettled(batchPromises);
        
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value) {
            cameras.push(result.value);
            this.emit('camera-found', result.value);
          }
        }
      }

      logger.info(`Network scan complete. Found ${cameras.length} cameras`);
      return cameras;

    } finally {
      this.scanning = false;
      this.abortController = null;
    }
  }

  /**
   * Scan single IP address
   */
  private async scanIP(
    ip: string,
    ports: number[],
    protocols: string[],
    timeout: number
  ): Promise<CameraDevice | null> {
    for (const port of ports) {
      for (const protocol of protocols) {
        try {
          if (protocol === 'rtsp') {
            const rtspUrl = `rtsp://${ip}:${port}`;
            if (await this.testRTSP(rtspUrl, timeout)) {
              return this.createRTSPCamera(ip, port, rtspUrl);
            }
          } else if (protocol === 'http') {
            if (await this.testHTTP(ip, port, timeout)) {
              const camera = await this.identifyHTTPCamera(ip, port);
              if (camera) return camera;
            }
          }
        } catch (error) {
          // Continue scanning
        }
      }
    }

    return null;
  }

  /**
   * Test RTSP connection
   */
  async testRTSP(rtspUrl: string, timeout = 2000): Promise<boolean> {
    return new Promise((resolve) => {
      const urlParts = new URL(rtspUrl);
      const port = parseInt(urlParts.port) || 554;
      
      const socket = new net.Socket();
      const timer = setTimeout(() => {
        socket.destroy();
        resolve(false);
      }, timeout);

      socket.on('connect', () => {
        // Send RTSP OPTIONS request
        const request = `OPTIONS ${rtspUrl} RTSP/1.0\r\nCSeq: 1\r\n\r\n`;
        socket.write(request);
      });

      socket.on('data', (data) => {
        clearTimeout(timer);
        socket.destroy();
        
        // Check for RTSP response
        const response = data.toString();
        resolve(response.includes('RTSP/1.0'));
      });

      socket.on('error', () => {
        clearTimeout(timer);
        resolve(false);
      });

      socket.connect(port, urlParts.hostname);
    });
  }

  /**
   * Test HTTP connection
   */
  private async testHTTP(ip: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const options = {
        hostname: ip,
        port: port,
        path: '/',
        method: 'GET',
        timeout: timeout
      };

      const req = http.request(options, (res) => {
        resolve(res.statusCode !== undefined);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  }

  /**
   * Identify HTTP camera
   */
  private async identifyHTTPCamera(ip: string, port: number): Promise<CameraDevice | null> {
    try {
      // Check common camera endpoints
      const endpoints = [
        '/cgi-bin/snapshot.cgi',
        '/snapshot.jpg',
        '/image.jpg',
        '/mjpeg',
        '/video.mjpeg'
      ];

      for (const endpoint of endpoints) {
        const response = await this.httpGet(`http://${ip}:${port}${endpoint}`);
        
        if (response && response.headers['content-type']?.includes('image')) {
          return this.createHTTPCamera(ip, port, endpoint);
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * HTTP GET request
   */
  private httpGet(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      http.get(url, { timeout: 2000 }, (res) => {
        if (res.statusCode === 200) {
          resolve({ headers: res.headers });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      }).on('error', reject);
    });
  }

  /**
   * Create RTSP camera device
   */
  private createRTSPCamera(ip: string, port: number, rtspUrl: string): CameraDevice {
    return {
      id: `rtsp_${ip}_${port}`,
      name: `RTSP Camera - ${ip}`,
      type: CameraType.IP_RTSP,
      status: CameraStatus.DISCONNECTED,
      capabilities: {
        resolutions: [
          { width: 1920, height: 1080, label: '1080p' },
          { width: 1280, height: 720, label: '720p' },
          { width: 640, height: 480, label: '480p' }
        ],
        frameRates: [15, 25, 30],
        hasAudio: true,
        hasPTZ: false,
        hasNightVision: false,
        hasMotionDetection: false,
        hasIR: false,
        supportedCodecs: ['h264', 'h265'],
        supportedProtocols: ['rtsp']
      },
      connection: {
        type: 'network',
        address: ip,
        port: port,
        rtspUrl: rtspUrl
      },
      lastSeen: new Date()
    };
  }

  /**
   * Create HTTP camera device
   */
  private createHTTPCamera(ip: string, port: number, endpoint: string): CameraDevice {
    return {
      id: `http_${ip}_${port}`,
      name: `HTTP Camera - ${ip}`,
      type: CameraType.WIFI,
      status: CameraStatus.DISCONNECTED,
      capabilities: {
        resolutions: [
          { width: 1920, height: 1080, label: '1080p' },
          { width: 1280, height: 720, label: '720p' }
        ],
        frameRates: [15, 30],
        hasAudio: false,
        hasPTZ: false,
        hasNightVision: false,
        hasMotionDetection: false,
        hasIR: false,
        supportedCodecs: ['mjpeg', 'jpeg'],
        supportedProtocols: ['http']
      },
      connection: {
        type: 'network',
        address: ip,
        port: port,
        rtspUrl: `http://${ip}:${port}${endpoint}`
      },
      lastSeen: new Date()
    };
  }

  /**
   * Parse IP range
   */
  private parseIPRange(range: string): string[] {
    const ips: string[] = [];
    
    if (range.includes('/')) {
      // CIDR notation
      const [baseIP, maskBits] = range.split('/');
      const baseParts = baseIP.split('.').map(Number);
      
      if (maskBits === '24') {
        // Simple /24 subnet
        for (let i = 1; i < 255; i++) {
          ips.push(`${baseParts[0]}.${baseParts[1]}.${baseParts[2]}.${i}`);
        }
      }
    } else if (range.includes('-')) {
      // Range notation (e.g., 192.168.1.1-254)
      const [start, end] = range.split('-');
      const startParts = start.split('.').map(Number);
      const endNum = parseInt(end);
      
      for (let i = startParts[3]; i <= endNum; i++) {
        ips.push(`${startParts[0]}.${startParts[1]}.${startParts[2]}.${i}`);
      }
    } else {
      // Single IP
      ips.push(range);
    }

    return ips;
  }

  /**
   * Add manual RTSP camera
   */
  async addRTSPCamera(name: string, rtspUrl: string): Promise<CameraDevice | null> {
    try {
      const url = new URL(rtspUrl);
      const ip = url.hostname;
      const port = parseInt(url.port) || 554;

      if (await this.testRTSP(rtspUrl)) {
        const camera = this.createRTSPCamera(ip, port, rtspUrl);
        camera.name = name;
        return camera;
      }

      return null;
    } catch (error) {
      logger.error(`Failed to add RTSP camera: ${error}`);
      return null;
    }
  }

  /**
   * Stop current scan
   */
  stopScan(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.scanning = false;
  }

  /**
   * Check if scanning
   */
  isScanning(): boolean {
    return this.scanning;
  }
}