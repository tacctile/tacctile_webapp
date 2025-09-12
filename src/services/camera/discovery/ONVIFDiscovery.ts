/**
 * ONVIF Discovery
 * Discovers and manages ONVIF-compliant IP cameras
 */

import { EventEmitter } from 'events';
import * as dgram from 'dgram';
import * as http from 'http';
import { parseStringPromise } from 'xml2js';
import { 
  ONVIFDevice,
  ONVIFProfile,
  ONVIFCapabilities,
  Resolution
} from '../types';
import { logger } from '../../../utils/logger';

export class ONVIFDiscovery extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private discovering = false;
  private discoveryTimeout: NodeJS.Timeout | null = null;

  /**
   * Discover ONVIF devices on network
   */
  async discover(timeout = 5000): Promise<ONVIFDevice[]> {
    if (this.discovering) {
      throw new Error('Discovery already in progress');
    }

    this.discovering = true;
    const devices: Map<string, ONVIFDevice> = new Map();

    return new Promise((resolve, reject) => {
      try {
        // Create UDP socket for WS-Discovery
        this.socket = dgram.createSocket('udp4');

        this.socket.on('message', async (msg, rinfo) => {
          try {
            const device = await this.parseDiscoveryResponse(msg.toString(), rinfo.address);
            if (device) {
              devices.set(device.address, device);
              this.emit('device-found', device);
            }
          } catch (error) {
            logger.debug('Failed to parse discovery response', error);
          }
        });

        this.socket.on('error', (error) => {
          logger.error('Discovery socket error', error);
        });

        this.socket.bind(() => {
          // Send WS-Discovery probe
          const probe = this.createDiscoveryProbe();
          this.socket!.setBroadcast(true);
          this.socket!.send(probe, 3702, '239.255.255.250');
          
          logger.info('ONVIF discovery probe sent');
        });

        // Set timeout
        this.discoveryTimeout = setTimeout(() => {
          this.stopDiscovery();
          resolve(Array.from(devices.values()));
        }, timeout);

      } catch (error) {
        this.discovering = false;
        reject(error);
      }
    });
  }

  /**
   * Create WS-Discovery probe message
   */
  private createDiscoveryProbe(): Buffer {
    const messageId = this.generateUUID();
    
    const probe = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope 
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
  xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <soap:Header>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
    <wsa:MessageID>urn:uuid:${messageId}</wsa:MessageID>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
  </soap:Header>
  <soap:Body>
    <wsd:Probe>
      <wsd:Types>tds:Device</wsd:Types>
    </wsd:Probe>
  </soap:Body>
</soap:Envelope>`;

    return Buffer.from(probe);
  }

  /**
   * Parse discovery response
   */
  private async parseDiscoveryResponse(
    response: string,
    address: string
  ): Promise<ONVIFDevice | null> {
    try {
      const result = await parseStringPromise(response, {
        explicitArray: false,
        ignoreAttrs: true
      });

      const envelope = result['soap:Envelope'] || result['SOAP-ENV:Envelope'];
      if (!envelope) return null;

      const body = envelope['soap:Body'] || envelope['SOAP-ENV:Body'];
      if (!body) return null;

      const probeMatch = body['wsd:ProbeMatches']?.['wsd:ProbeMatch'];
      if (!probeMatch) return null;

      const xaddrs = probeMatch['wsa:XAddrs'] || probeMatch['XAddrs'];
      if (!xaddrs) return null;

      // Parse device service URL
      const urls = xaddrs.split(' ');
      const deviceUrl = urls.find((url: string) => url.includes('onvif'));
      
      if (!deviceUrl) return null;

      const urlParts = new URL(deviceUrl);
      
      return {
        address: address,
        port: parseInt(urlParts.port) || 80,
        capabilities: await this.getDeviceCapabilities(deviceUrl)
      };
    } catch (error) {
      logger.debug(`Failed to parse response from ${address}`, error);
      return null;
    }
  }

  /**
   * Get device capabilities
   */
  private async getDeviceCapabilities(deviceUrl: string): Promise<ONVIFCapabilities> {
    try {
      const request = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope 
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <soap:Body>
    <tds:GetCapabilities>
      <tds:Category>All</tds:Category>
    </tds:GetCapabilities>
  </soap:Body>
</soap:Envelope>`;

      const response = await this.sendSOAPRequest(deviceUrl, request);
      const result = await parseStringPromise(response, {
        explicitArray: false,
        ignoreAttrs: true
      });

      const capabilities = result['soap:Envelope']?.['soap:Body']?.['tds:GetCapabilitiesResponse']?.['tds:Capabilities'];
      
      return {
        analytics: !!capabilities?.Analytics,
        device: !!capabilities?.Device,
        events: !!capabilities?.Events,
        imaging: !!capabilities?.Imaging,
        media: !!capabilities?.Media,
        ptz: !!capabilities?.PTZ,
        recording: !!capabilities?.Recording
      };
    } catch (error) {
      // Return default capabilities on error
      return {
        analytics: false,
        device: true,
        events: false,
        imaging: false,
        media: true,
        ptz: false,
        recording: false
      };
    }
  }

  /**
   * Get device profiles
   */
  async getProfiles(device: ONVIFDevice): Promise<ONVIFProfile[]> {
    try {
      const mediaUrl = await this.getMediaServiceUrl(device);
      if (!mediaUrl) return [];

      const request = this.createAuthenticatedRequest(device, `
<trt:GetProfiles xmlns:trt="http://www.onvif.org/ver10/media/wsdl"/>
      `);

      const response = await this.sendSOAPRequest(mediaUrl, request);
      const result = await parseStringPromise(response, {
        explicitArray: false,
        ignoreAttrs: true
      });

      const profiles = result['soap:Envelope']?.['soap:Body']?.['trt:GetProfilesResponse']?.['trt:Profiles'];
      
      if (!profiles) return [];

      const profileArray = Array.isArray(profiles) ? profiles : [profiles];
      
      return profileArray.map((profile: any) => ({
        name: profile.Name,
        token: profile.token,
        streamUri: '', // Will be filled by getStreamUri
        videoEncoder: profile.VideoEncoderConfiguration ? {
          resolution: {
            width: parseInt(profile.VideoEncoderConfiguration.Resolution?.Width) || 1920,
            height: parseInt(profile.VideoEncoderConfiguration.Resolution?.Height) || 1080,
            label: `${profile.VideoEncoderConfiguration.Resolution?.Width}x${profile.VideoEncoderConfiguration.Resolution?.Height}`
          },
          frameRate: parseInt(profile.VideoEncoderConfiguration.RateControl?.FrameRateLimit) || 30,
          bitrate: parseInt(profile.VideoEncoderConfiguration.RateControl?.BitrateLimit) || 4096,
          encoding: profile.VideoEncoderConfiguration.Encoding || 'H264'
        } : undefined,
        audioEncoder: profile.AudioEncoderConfiguration ? {
          encoding: profile.AudioEncoderConfiguration.Encoding || 'G711',
          bitrate: parseInt(profile.AudioEncoderConfiguration.Bitrate) || 64,
          sampleRate: parseInt(profile.AudioEncoderConfiguration.SampleRate) || 8000
        } : undefined
      }));
    } catch (error) {
      logger.error('Failed to get profiles', error);
      return [];
    }
  }

  /**
   * Get stream URI for profile
   */
  async getStreamUri(device: ONVIFDevice, profileToken: string): Promise<string | null> {
    try {
      const mediaUrl = await this.getMediaServiceUrl(device);
      if (!mediaUrl) return null;

      const request = this.createAuthenticatedRequest(device, `
<trt:GetStreamUri xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  <trt:StreamSetup>
    <tt:Stream xmlns:tt="http://www.onvif.org/ver10/schema">RTP-Unicast</tt:Stream>
    <tt:Transport xmlns:tt="http://www.onvif.org/ver10/schema">
      <tt:Protocol>RTSP</tt:Protocol>
    </tt:Transport>
  </trt:StreamSetup>
  <trt:ProfileToken>${profileToken}</trt:ProfileToken>
</trt:GetStreamUri>
      `);

      const response = await this.sendSOAPRequest(mediaUrl, request);
      const result = await parseStringPromise(response, {
        explicitArray: false,
        ignoreAttrs: true
      });

      const uri = result['soap:Envelope']?.['soap:Body']?.['trt:GetStreamUriResponse']?.['trt:MediaUri']?.['tt:Uri'];
      
      if (uri && device.username && device.password) {
        // Add credentials to URI
        const url = new URL(uri);
        url.username = device.username;
        url.password = device.password;
        return url.toString();
      }

      return uri || null;
    } catch (error) {
      logger.error('Failed to get stream URI', error);
      return null;
    }
  }

  /**
   * Get media service URL
   */
  private async getMediaServiceUrl(device: ONVIFDevice): Promise<string | null> {
    try {
      const deviceUrl = `http://${device.address}:${device.port}/onvif/device_service`;
      
      const request = this.createAuthenticatedRequest(device, `
<tds:GetServices xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <tds:IncludeCapability>false</tds:IncludeCapability>
</tds:GetServices>
      `);

      const response = await this.sendSOAPRequest(deviceUrl, request);
      const result = await parseStringPromise(response, {
        explicitArray: false,
        ignoreAttrs: true
      });

      const services = result['soap:Envelope']?.['soap:Body']?.['tds:GetServicesResponse']?.['tds:Service'];
      const serviceArray = Array.isArray(services) ? services : [services];
      
      const mediaService = serviceArray.find((s: any) => 
        s.Namespace === 'http://www.onvif.org/ver10/media/wsdl'
      );

      return mediaService?.XAddr || null;
    } catch (error) {
      // Fallback to default media service URL
      return `http://${device.address}:${device.port}/onvif/media_service`;
    }
  }

  /**
   * Create authenticated SOAP request
   */
  private createAuthenticatedRequest(device: ONVIFDevice, body: string): string {
    if (!device.username || !device.password) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
    }

    // Create WS-Security header
    const created = new Date().toISOString();
    const nonce = this.generateNonce();
    const password = device.password;
    
    // For simplicity, using plain text password (should use digest in production)
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${device.username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${password}</wsse:Password>
        <wsse:Nonce>${nonce}</wsse:Nonce>
        <wsu:Created xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;
  }

  /**
   * Send SOAP request
   */
  private sendSOAPRequest(url: string, request: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlParts = new URL(url);
      
      const options = {
        hostname: urlParts.hostname,
        port: parseInt(urlParts.port) || 80,
        path: urlParts.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml',
          'Content-Length': Buffer.byteLength(request)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(request);
      req.end();
    });
  }

  /**
   * Test ONVIF connection
   */
  async testConnection(connection: any): Promise<boolean> {
    try {
      const device: ONVIFDevice = {
        address: connection.address,
        port: connection.port || 80,
        username: connection.username,
        password: connection.password
      };

      const deviceUrl = `http://${device.address}:${device.port}/onvif/device_service`;
      
      const request = this.createAuthenticatedRequest(device, `
<tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>
      `);

      const response = await this.sendSOAPRequest(deviceUrl, request);
      return response.includes('GetDeviceInformationResponse');
    } catch (error) {
      return false;
    }
  }

  /**
   * Stop discovery
   */
  stopDiscovery(): void {
    if (this.discoveryTimeout) {
      clearTimeout(this.discoveryTimeout);
      this.discoveryTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    this.discovering = false;
  }

  /**
   * Generate UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Generate nonce
   */
  private generateNonce(): string {
    const array = new Uint8Array(16);
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return Buffer.from(array).toString('base64');
  }
}