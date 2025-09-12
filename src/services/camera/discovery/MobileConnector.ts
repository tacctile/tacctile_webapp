/**
 * Mobile App Connector
 * Connects to mobile devices for camera streaming
 */

import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import * as http from 'http';
import { MobileAppConnection, MobileCapabilities } from '../types';
import { logger } from '../../../utils/logger';

export class MobileConnector extends EventEmitter {
  private wsServer: WebSocket.Server | null = null;
  private httpServer: http.Server | null = null;
  private connections: Map<string, MobileConnection> = new Map();
  private discoveryInterval: NodeJS.Timeout | null = null;
  private port = 8765;

  /**
   * Start listening for mobile connections
   */
  async startListening(port = 8765): Promise<void> {
    this.port = port;

    try {
      // Create HTTP server for initial connection
      this.httpServer = http.createServer((req, res) => {
        if (req.url === '/discover' && req.method === 'GET') {
          // Discovery endpoint for mobile apps
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            service: 'Tacctile Camera Hub',
            version: '1.0.0',
            port: this.port,
            capabilities: ['streaming', 'recording', 'control']
          }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      // Create WebSocket server for streaming
      this.wsServer = new WebSocket.Server({ server: this.httpServer });

      this.wsServer.on('connection', (ws, req) => {
        this.handleNewConnection(ws, req);
      });

      // Start listening
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.listen(this.port, () => {
          logger.info(`Mobile connector listening on port ${this.port}`);
          resolve();
        }).on('error', reject);
      });

      // Start mDNS broadcasting for discovery
      this.startDiscoveryBroadcast();

    } catch (error) {
      logger.error('Failed to start mobile connector', error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleNewConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const clientIp = req.socket.remoteAddress || 'unknown';
    logger.info(`New mobile connection from ${clientIp}`);

    const connection = new MobileConnection(ws, clientIp);

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(connection, data);
    });

    // Handle disconnection
    ws.on('close', () => {
      this.handleDisconnection(connection);
    });

    ws.on('error', (error) => {
      logger.error(`Mobile connection error from ${clientIp}`, error);
    });

    // Send initial handshake
    connection.send({
      type: 'handshake',
      timestamp: Date.now()
    });
  }

  /**
   * Handle message from mobile device
   */
  private handleMessage(connection: MobileConnection, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'register':
          this.registerDevice(connection, message);
          break;

        case 'capabilities':
          this.updateCapabilities(connection, message);
          break;

        case 'stream_start':
          this.handleStreamStart(connection, message);
          break;

        case 'stream_data':
          this.handleStreamData(connection, message);
          break;

        case 'stream_stop':
          this.handleStreamStop(connection);
          break;

        case 'ping':
          connection.send({ type: 'pong', timestamp: Date.now() });
          break;

        case 'status':
          this.handleStatusUpdate(connection, message);
          break;

        default:
          logger.debug(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Failed to handle mobile message', error);
    }
  }

  /**
   * Register mobile device
   */
  private registerDevice(connection: MobileConnection, message: any): void {
    const deviceInfo: MobileAppConnection = {
      deviceId: message.deviceId,
      deviceName: message.deviceName,
      platform: message.platform,
      appVersion: message.appVersion,
      connectionType: message.connectionType || 'wifi',
      capabilities: message.capabilities || {},
      lastPing: new Date()
    };

    connection.deviceInfo = deviceInfo;
    connection.deviceId = message.deviceId;

    this.connections.set(message.deviceId, connection);

    // Send acknowledgment
    connection.send({
      type: 'registered',
      deviceId: message.deviceId,
      timestamp: Date.now()
    });

    // Emit device connected event
    this.emit('device-connected', deviceInfo);

    logger.info(`Mobile device registered: ${deviceInfo.deviceName} (${deviceInfo.platform})`);
  }

  /**
   * Update device capabilities
   */
  private updateCapabilities(connection: MobileConnection, message: any): void {
    if (connection.deviceInfo) {
      connection.deviceInfo.capabilities = message.capabilities;
      
      this.emit('capabilities-updated', {
        deviceId: connection.deviceId,
        capabilities: message.capabilities
      });
    }
  }

  /**
   * Handle stream start
   */
  private handleStreamStart(connection: MobileConnection, message: any): void {
    connection.streaming = true;
    connection.streamConfig = message.config;

    this.emit('stream-started', {
      deviceId: connection.deviceId,
      config: message.config
    });

    // Send acknowledgment
    connection.send({
      type: 'stream_started',
      timestamp: Date.now()
    });
  }

  /**
   * Handle stream data
   */
  private handleStreamData(connection: MobileConnection, message: any): void {
    if (!connection.streaming) return;

    // Forward stream data to subscribers
    this.emit('stream-data', {
      deviceId: connection.deviceId,
      data: message.data,
      timestamp: message.timestamp,
      frameNumber: message.frameNumber
    });
  }

  /**
   * Handle stream stop
   */
  private handleStreamStop(connection: MobileConnection): void {
    connection.streaming = false;
    connection.streamConfig = null;

    this.emit('stream-stopped', {
      deviceId: connection.deviceId
    });

    // Send acknowledgment
    connection.send({
      type: 'stream_stopped',
      timestamp: Date.now()
    });
  }

  /**
   * Handle status update
   */
  private handleStatusUpdate(connection: MobileConnection, message: any): void {
    if (connection.deviceInfo) {
      connection.deviceInfo.lastPing = new Date();
    }

    this.emit('status-update', {
      deviceId: connection.deviceId,
      status: message.status
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(connection: MobileConnection): void {
    if (connection.deviceId) {
      this.connections.delete(connection.deviceId);
      
      this.emit('device-disconnected', connection.deviceId);
      
      logger.info(`Mobile device disconnected: ${connection.deviceId}`);
    }
  }

  /**
   * Start discovery broadcast
   */
  private startDiscoveryBroadcast(): void {
    // Broadcast discovery information periodically
    this.discoveryInterval = setInterval(() => {
      // In a real implementation, this would use mDNS/Bonjour
      // For now, just log
      logger.debug('Broadcasting discovery information');
    }, 10000);
  }

  /**
   * Send command to mobile device
   */
  sendCommand(deviceId: string, command: any): boolean {
    const connection = this.connections.get(deviceId);
    
    if (connection && connection.isConnected()) {
      connection.send(command);
      return true;
    }
    
    return false;
  }

  /**
   * Request stream from mobile device
   */
  requestStream(deviceId: string, config: any): boolean {
    return this.sendCommand(deviceId, {
      type: 'request_stream',
      config,
      timestamp: Date.now()
    });
  }

  /**
   * Stop stream from mobile device
   */
  stopStream(deviceId: string): boolean {
    return this.sendCommand(deviceId, {
      type: 'stop_stream',
      timestamp: Date.now()
    });
  }

  /**
   * Take snapshot from mobile device
   */
  requestSnapshot(deviceId: string): boolean {
    return this.sendCommand(deviceId, {
      type: 'snapshot',
      timestamp: Date.now()
    });
  }

  /**
   * Ping mobile device
   */
  async ping(deviceId: string): Promise<boolean> {
    const connection = this.connections.get(deviceId);
    
    if (!connection || !connection.isConnected()) {
      return false;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 5000);

      const handler = (data: any) => {
        if (data.deviceId === deviceId && data.type === 'pong') {
          clearTimeout(timeout);
          this.removeListener('message', handler);
          resolve(true);
        }
      };

      this.on('message', handler);
      
      connection.send({
        type: 'ping',
        timestamp: Date.now()
      });
    });
  }

  /**
   * Get connected devices
   */
  getConnectedDevices(): MobileAppConnection[] {
    return Array.from(this.connections.values())
      .filter(conn => conn.deviceInfo !== null)
      .map(conn => conn.deviceInfo!);
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();

    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = null;
    }

    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }

    logger.info('Mobile connector stopped');
  }
}

/**
 * Mobile connection wrapper
 */
class MobileConnection {
  ws: WebSocket;
  address: string;
  deviceId: string | null = null;
  deviceInfo: MobileAppConnection | null = null;
  streaming = false;
  streamConfig: any = null;

  constructor(ws: WebSocket, address: string) {
    this.ws = ws;
    this.address = address;
  }

  send(data: any): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  isConnected(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }
}