/**
 * Secure Communication Manager
 * Manages secure communication channels for multi-device investigation setups
 */

import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import * as crypto from 'crypto';
import * as https from 'https';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import {
  CommunicationChannel,
  ChannelType,
  ChannelStatus,
  ChannelConfiguration,
  ChannelPriority,
} from './types';

export interface SecureCommunicationConfig {
  port: number;
  maxConnections: number;
  enableEncryption: boolean;
  certificatePath?: string;
  keyPath?: string;
  allowSelfSigned: boolean;
  heartbeatInterval: number;
  maxChannels: number;
}

export interface DeviceMessage {
  id: string;
  timestamp: Date;
  channelId: string;
  senderId: string;
  receiverId?: string; // for direct messages
  type: MessageType;
  priority: ChannelPriority;
  payload: Record<string, unknown>;
  signature?: string;
  encrypted: boolean;
}

export enum MessageType {
  HANDSHAKE = 'handshake',
  AUTHENTICATION = 'authentication',
  DEVICE_STATUS = 'device_status',
  EVIDENCE_SYNC = 'evidence_sync',
  COMMAND = 'command',
  RESPONSE = 'response',
  HEARTBEAT = 'heartbeat',
  ALERT = 'alert',
  DATA_TRANSFER = 'data_transfer',
  INVESTIGATION_UPDATE = 'investigation_update'
}

export interface ConnectionInfo {
  deviceId: string;
  websocket: WebSocket;
  authenticated: boolean;
  encryptionKey?: Buffer;
  lastHeartbeat: Date;
  capabilities: string[];
  channels: Set<string>;
}

export class SecureCommunicationManager extends EventEmitter {
  private server: WebSocket.Server | null = null;
  private httpsServer: https.Server | null = null;
  private connections: Map<string, ConnectionInfo> = new Map();
  private channels: Map<string, CommunicationChannel> = new Map();
  private messageQueue: Map<string, DeviceMessage[]> = new Map();
  private configuration: SecureCommunicationConfig;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private certificatesPath: string;

  constructor(config?: Partial<SecureCommunicationConfig>) {
    super();
    
    const userDataPath = app.getPath('userData');
    this.certificatesPath = path.join(userDataPath, 'certificates');
    
    this.configuration = {
      port: 8443,
      maxConnections: 50,
      enableEncryption: true,
      allowSelfSigned: false,
      heartbeatInterval: 30000, // 30 seconds
      maxChannels: 100,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.certificatesPath, { recursive: true });
      
      if (this.configuration.enableEncryption) {
        await this.ensureSSLCertificates();
        await this.createHTTPSServer();
      }
      
      await this.createWebSocketServer();
      this.startHeartbeatMonitoring();
      
      console.log(`SecureCommunicationManager initialized on port ${this.configuration.port}`);
      this.emit('server-started', { port: this.configuration.port });
    } catch (error) {
      console.error('Failed to initialize SecureCommunicationManager:', error);
      throw error;
    }
  }

  // Channel Management
  public async createChannel(
    name: string,
    type: ChannelType,
    participants: string[],
    config?: Partial<ChannelConfiguration>
  ): Promise<CommunicationChannel> {
    if (this.channels.size >= this.configuration.maxChannels) {
      throw new Error('Maximum number of channels reached');
    }

    const channel: CommunicationChannel = {
      id: crypto.randomUUID(),
      name,
      type,
      participants: [...participants],
      security: {
        endToEndEncryption: true,
        keyExchangeProtocol: 'ECDH',
        encryptionAlgorithm: 'AES-256-GCM',
        signatureVerification: true,
        forwardSecrecy: true,
        authenticationRequired: true
      },
      configuration: {
        maxParticipants: 10,
        compressionEnabled: true,
        priority: ChannelPriority.NORMAL,
        retransmissionEnabled: true,
        bufferSize: 1024 * 1024, // 1MB
        timeout: 30000,
        ...config
      },
      status: ChannelStatus.INITIALIZING,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.channels.set(channel.id, channel);
    
    // Initialize channel encryption keys
    await this.initializeChannelSecurity(channel);
    
    // Notify participants
    await this.notifyChannelCreated(channel);
    
    channel.status = ChannelStatus.ACTIVE;
    
    this.emit('channel-created', channel);
    return channel;
  }

  public async joinChannel(channelId: string, deviceId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    const connection = this.connections.get(deviceId);
    
    if (!channel || !connection) return false;
    
    if (channel.participants.length >= channel.configuration.maxParticipants) {
      return false;
    }

    if (!channel.participants.includes(deviceId)) {
      channel.participants.push(deviceId);
      connection.channels.add(channelId);
      channel.lastActivity = new Date();
      
      await this.notifyChannelJoined(channel, deviceId);
      this.emit('device-joined-channel', channel, deviceId);
    }
    
    return true;
  }

  public async leaveChannel(channelId: string, deviceId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    const connection = this.connections.get(deviceId);
    
    if (!channel || !connection) return false;
    
    const index = channel.participants.indexOf(deviceId);
    if (index !== -1) {
      channel.participants.splice(index, 1);
      connection.channels.delete(channelId);
      channel.lastActivity = new Date();
      
      await this.notifyChannelLeft(channel, deviceId);
      this.emit('device-left-channel', channel, deviceId);
      
      // Remove channel if empty
      if (channel.participants.length === 0) {
        await this.removeChannel(channelId);
      }
    }
    
    return true;
  }

  public async removeChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) return false;
    
    // Notify all participants
    for (const participantId of channel.participants) {
      const connection = this.connections.get(participantId);
      if (connection) {
        connection.channels.delete(channelId);
        await this.sendMessage(participantId, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          channelId,
          senderId: 'system',
          type: MessageType.ALERT,
          priority: ChannelPriority.HIGH,
          payload: { type: 'channel_removed', channelId },
          encrypted: false
        });
      }
    }
    
    this.channels.delete(channelId);
    this.emit('channel-removed', channel);
    return true;
  }

  // Message Handling
  public async sendMessage(deviceId: string, message: DeviceMessage): Promise<boolean> {
    const connection = this.connections.get(deviceId);
    if (!connection || connection.websocket.readyState !== WebSocket.OPEN) {
      // Queue message for later delivery
      this.queueMessage(deviceId, message);
      return false;
    }

    try {
      let messageData = JSON.stringify(message);
      
      if (message.encrypted && connection.encryptionKey) {
        messageData = await this.encryptMessage(messageData, connection.encryptionKey);
      }
      
      connection.websocket.send(messageData);
      this.emit('message-sent', message, deviceId);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      this.queueMessage(deviceId, message);
      return false;
    }
  }

  public async broadcastToChannel(channelId: string, message: Omit<DeviceMessage, 'receiverId'>): Promise<number> {
    const channel = this.channels.get(channelId);
    if (!channel) return 0;

    let sentCount = 0;
    const fullMessage: DeviceMessage = {
      ...message,
      channelId
    };

    for (const participantId of channel.participants) {
      if (await this.sendMessage(participantId, fullMessage)) {
        sentCount++;
      }
    }

    channel.lastActivity = new Date();
    return sentCount;
  }

  // Device Connection Management
  public async authenticateDevice(deviceId: string, credentials: Record<string, unknown>): Promise<boolean> {
    const connection = this.connections.get(deviceId);
    if (!connection) return false;

    // Implement device authentication logic
    // This could integrate with the existing AuthenticationManager
    const authenticated = await this.validateDeviceCredentials(deviceId, credentials);
    
    connection.authenticated = authenticated;
    
    if (authenticated) {
      // Generate encryption key for this connection
      connection.encryptionKey = crypto.randomBytes(32);
      
      await this.sendMessage(deviceId, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        channelId: 'auth',
        senderId: 'system',
        type: MessageType.AUTHENTICATION,
        priority: ChannelPriority.HIGH,
        payload: { 
          status: 'authenticated',
          encryptionKey: connection.encryptionKey.toString('base64')
        },
        encrypted: false
      });
      
      // Deliver queued messages
      await this.deliverQueuedMessages(deviceId);
      
      this.emit('device-authenticated', deviceId);
    }

    return authenticated;
  }

  public getConnectedDevices(): string[] {
    return Array.from(this.connections.keys()).filter(deviceId => {
      const conn = this.connections.get(deviceId);
      return conn?.authenticated && conn.websocket.readyState === WebSocket.OPEN;
    });
  }

  public getDeviceChannels(deviceId: string): CommunicationChannel[] {
    const connection = this.connections.get(deviceId);
    if (!connection) return [];

    return Array.from(connection.channels).map(channelId => 
      this.channels.get(channelId)).filter(Boolean) as CommunicationChannel[];
  }

  public isDeviceConnected(deviceId: string): boolean {
    const connection = this.connections.get(deviceId);
    return connection?.websocket.readyState === WebSocket.OPEN || false;
  }

  // Security Methods
  private async encryptMessage(message: string, key: Buffer): Promise<string> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', key);
    
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex')
    });
  }

  private async decryptMessage(encryptedData: string, key: Buffer): Promise<string> {
    const data = JSON.parse(encryptedData);
    const decipher = crypto.createDecipher('aes-256-gcm', key);
    
    decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));
    
    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async validateDeviceCredentials(deviceId: string, credentials: Record<string, unknown>): Promise<boolean> {
    // Integration point with authentication system
    // For now, basic validation
    return credentials && credentials.deviceId === deviceId && credentials.token;
  }

  private async initializeChannelSecurity(channel: CommunicationChannel): Promise<void> {
    // Generate channel-specific encryption keys
    const channelKey = crypto.randomBytes(32);
    
    // Store encrypted channel key (in production, use proper key management)
    const encryptedKey = crypto.createHash('sha256')
      .update(channel.id + channelKey.toString('hex'))
      .digest();
    
    // This would be stored securely and distributed to channel participants
    (channel as Record<string, unknown>)._encryptionKey = encryptedKey;
  }

  // Server Management
  private async createHTTPSServer(): Promise<void> {
    let serverOptions: https.ServerOptions = {};

    if (this.configuration.certificatePath && this.configuration.keyPath) {
      try {
        const cert = await fs.readFile(this.configuration.certificatePath);
        const key = await fs.readFile(this.configuration.keyPath);
        serverOptions = { cert, key };
      } catch (error) {
        console.warn('Failed to load SSL certificates, falling back to self-signed');
        serverOptions = await this.generateSelfSignedCertificate();
      }
    } else {
      serverOptions = await this.generateSelfSignedCertificate();
    }

    this.httpsServer = https.createServer(serverOptions);
  }

  private async createWebSocketServer(): Promise<void> {
    const serverOptions: WebSocket.ServerOptions = {
      port: this.configuration.port,
      server: this.httpsServer || undefined,
      verifyClient: this.verifyClient.bind(this)
    };

    this.server = new WebSocket.Server(serverOptions);

    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', (error) => {
      console.error('WebSocket server error:', error);
      this.emit('server-error', error);
    });

    if (this.httpsServer) {
      this.httpsServer.listen(this.configuration.port);
    }
  }

  private verifyClient(info: Record<string, unknown>): boolean {
    // Implement client verification logic
    const _origin = info.origin;
    const _ip = info.req.connection.remoteAddress;
    
    // Basic verification - can be enhanced with IP whitelisting, certificate validation, etc.
    return this.connections.size < this.configuration.maxConnections;
  }

  private handleConnection(websocket: WebSocket, _request: Record<string, unknown>): void {
    const deviceId = crypto.randomUUID(); // Temporary ID until authentication
    
    const connection: ConnectionInfo = {
      deviceId,
      websocket,
      authenticated: false,
      lastHeartbeat: new Date(),
      capabilities: [],
      channels: new Set()
    };

    this.connections.set(deviceId, connection);

    websocket.on('message', (data) => this.handleMessage(deviceId, data));
    websocket.on('close', () => this.handleDisconnection(deviceId));
    websocket.on('error', (error) => this.handleConnectionError(deviceId, error));
    websocket.on('pong', () => {
      connection.lastHeartbeat = new Date();
    });

    this.emit('device-connected', deviceId);
  }

  private async handleMessage(deviceId: string, data: WebSocket.Data): Promise<void> {
    try {
      const connection = this.connections.get(deviceId);
      if (!connection) return;

      let messageData = data.toString();
      
      // Decrypt if necessary
      if (connection.encryptionKey) {
        try {
          messageData = await this.decryptMessage(messageData, connection.encryptionKey);
        } catch (error) {
          // Message might not be encrypted
        }
      }

      const message: DeviceMessage = JSON.parse(messageData);
      
      // Update last activity
      connection.lastHeartbeat = new Date();
      
      // Handle different message types
      await this.processMessage(deviceId, message);
      
      this.emit('message-received', message, deviceId);
    } catch (error) {
      console.error('Failed to handle message:', error);
    }
  }

  private async processMessage(deviceId: string, message: DeviceMessage): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) return;

    switch (message.type) {
      case MessageType.HANDSHAKE:
        await this.handleHandshake(deviceId, message);
        break;
        
      case MessageType.AUTHENTICATION:
        await this.authenticateDevice(deviceId, message.payload);
        break;
        
      case MessageType.HEARTBEAT:
        // Already handled by updating lastHeartbeat
        break;
        
      case MessageType.DEVICE_STATUS:
        this.emit('device-status-update', deviceId, message.payload);
        break;
        
      case MessageType.EVIDENCE_SYNC:
        await this.handleEvidenceSync(deviceId, message);
        break;
        
      case MessageType.DATA_TRANSFER:
        await this.handleDataTransfer(deviceId, message);
        break;
        
      default:
        // Forward message to channel participants
        if (message.channelId) {
          await this.forwardChannelMessage(message);
        }
    }
  }

  private async handleHandshake(deviceId: string, message: DeviceMessage): Promise<void> {
    const connection = this.connections.get(deviceId);
    if (!connection) return;

    // Update device capabilities
    connection.capabilities = message.payload.capabilities || [];
    
    // Send handshake response
    await this.sendMessage(deviceId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      channelId: 'system',
      senderId: 'server',
      type: MessageType.HANDSHAKE,
      priority: ChannelPriority.HIGH,
      payload: {
        serverCapabilities: ['encryption', 'channels', 'evidence-sync'],
        requiresAuthentication: true
      },
      encrypted: false
    });
  }

  private async handleEvidenceSync(deviceId: string, message: DeviceMessage): Promise<void> {
    // Handle evidence synchronization between devices
    this.emit('evidence-sync-request', deviceId, message.payload);
  }

  private async handleDataTransfer(deviceId: string, message: DeviceMessage): Promise<void> {
    // Handle large data transfers
    this.emit('data-transfer', deviceId, message.payload);
  }

  private async forwardChannelMessage(message: DeviceMessage): Promise<void> {
    const channel = this.channels.get(message.channelId);
    if (!channel) return;

    // Forward to all channel participants except sender
    for (const participantId of channel.participants) {
      if (participantId !== message.senderId) {
        await this.sendMessage(participantId, message);
      }
    }
    
    channel.lastActivity = new Date();
  }

  private handleDisconnection(deviceId: string): void {
    const connection = this.connections.get(deviceId);
    if (connection) {
      // Leave all channels
      for (const channelId of connection.channels) {
        this.leaveChannel(channelId, deviceId);
      }
    }
    
    this.connections.delete(deviceId);
    this.emit('device-disconnected', deviceId);
  }

  private handleConnectionError(deviceId: string, error: Error): void {
    console.error(`Connection error for device ${deviceId}:`, error);
    this.handleDisconnection(deviceId);
  }

  private startHeartbeatMonitoring(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      const timeout = this.configuration.heartbeatInterval * 2; // 2x heartbeat interval

      for (const [deviceId, connection] of this.connections) {
        const timeSinceLastHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat > timeout) {
          console.log(`Device ${deviceId} timed out, disconnecting`);
          connection.websocket.terminate();
          this.handleDisconnection(deviceId);
        } else {
          // Send ping to check connection
          if (connection.websocket.readyState === WebSocket.OPEN) {
            connection.websocket.ping();
          }
        }
      }
    }, this.configuration.heartbeatInterval);
  }

  // Message Queue Management
  private queueMessage(deviceId: string, message: DeviceMessage): void {
    if (!this.messageQueue.has(deviceId)) {
      this.messageQueue.set(deviceId, []);
    }
    
    const queue = this.messageQueue.get(deviceId);
    if (!queue) return;
    queue.push(message);
    
    // Limit queue size
    if (queue.length > 100) {
      queue.shift(); // Remove oldest message
    }
  }

  private async deliverQueuedMessages(deviceId: string): Promise<void> {
    const queue = this.messageQueue.get(deviceId);
    if (!queue || queue.length === 0) return;

    for (const message of queue) {
      await this.sendMessage(deviceId, message);
    }
    
    this.messageQueue.delete(deviceId);
  }

  // Notification Methods
  private async notifyChannelCreated(channel: CommunicationChannel): Promise<void> {
    const message: DeviceMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      channelId: channel.id,
      senderId: 'system',
      type: MessageType.ALERT,
      priority: ChannelPriority.HIGH,
      payload: {
        type: 'channel_created',
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type
        }
      },
      encrypted: false
    };

    for (const participantId of channel.participants) {
      await this.sendMessage(participantId, message);
    }
  }

  private async notifyChannelJoined(channel: CommunicationChannel, deviceId: string): Promise<void> {
    const message: DeviceMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      channelId: channel.id,
      senderId: 'system',
      type: MessageType.ALERT,
      priority: ChannelPriority.NORMAL,
      payload: {
        type: 'device_joined',
        deviceId
      },
      encrypted: false
    };

    for (const participantId of channel.participants) {
      if (participantId !== deviceId) {
        await this.sendMessage(participantId, message);
      }
    }
  }

  private async notifyChannelLeft(channel: CommunicationChannel, deviceId: string): Promise<void> {
    const message: DeviceMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      channelId: channel.id,
      senderId: 'system',
      type: MessageType.ALERT,
      priority: ChannelPriority.NORMAL,
      payload: {
        type: 'device_left',
        deviceId
      },
      encrypted: false
    };

    for (const participantId of channel.participants) {
      await this.sendMessage(participantId, message);
    }
  }

  // Certificate Management
  private async ensureSSLCertificates(): Promise<void> {
    if (!this.configuration.certificatePath || !this.configuration.keyPath) {
      // Generate self-signed certificates
      await this.generateSelfSignedCertificate();
    }
  }

  private async generateSelfSignedCertificate(): Promise<https.ServerOptions> {
    // Generate self-signed certificate for development/testing
    const _keyPath = path.join(this.certificatesPath, 'private-key.pem');
    const _certPath = path.join(this.certificatesPath, 'certificate.pem');

    // In production, use proper certificate generation
    // For now, return empty options (will use HTTP instead of HTTPS)
    return {};
  }

  public getChannels(): CommunicationChannel[] {
    return Array.from(this.channels.values());
  }

  public getConnectionInfo(deviceId: string): ConnectionInfo | null {
    return this.connections.get(deviceId) || null;
  }

  public async updateConfiguration(config: Partial<SecureCommunicationConfig>): Promise<void> {
    this.configuration = { ...this.configuration, ...config };
    this.emit('configuration-updated', this.configuration);
  }

  public getConfiguration(): SecureCommunicationConfig {
    return { ...this.configuration };
  }

  public destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      connection.websocket.terminate();
    }

    // Close servers
    if (this.server) {
      this.server.close();
    }
    
    if (this.httpsServer) {
      this.httpsServer.close();
    }

    this.removeAllListeners();
    console.log('SecureCommunicationManager destroyed');
  }
}