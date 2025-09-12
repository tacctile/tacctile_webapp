/**
 * Network Security & Firewall Management System Integration
 * Unified export and integration layer for network security components
 */

import { EventEmitter } from 'events';
import { app, ipcMain } from 'electron';
import { NetworkSecurityManager } from './NetworkSecurityManager';
import { SecureCommunicationManager } from './SecureCommunicationManager';
import {
  NetworkDevice,
  NetworkSecurityConfiguration,
  NetworkMetrics,
  NetworkThreat,
  FirewallRule,
  CommunicationChannel,
  DeviceMessage,
  NetworkScanResult,
  SecureCommunicationConfig,
  MessageType
} from './types';

export class NetworkSecuritySystem extends EventEmitter {
  private securityManager: NetworkSecurityManager;
  private communicationManager: SecureCommunicationManager;
  private initialized: boolean = false;

  constructor() {
    super();
    
    this.securityManager = new NetworkSecurityManager();
    this.communicationManager = new SecureCommunicationManager();
    
    this.setupEventForwarding();
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize security manager
      await this.securityManager.initialize();
      
      // Initialize communication manager
      await this.communicationManager.initialize();
      
      // Setup IPC handlers
      this.setupIPCHandlers();
      
      this.initialized = true;
      
      console.log('Network Security System initialized successfully');
      this.emit('system-initialized');
      
    } catch (error) {
      console.error('Failed to initialize Network Security System:', error);
      throw error;
    }
  }

  // Device Management API
  public async registerDevice(device: Partial<NetworkDevice>): Promise<NetworkDevice> {
    return await this.securityManager.registerDevice(device);
  }

  public async updateDeviceStatus(deviceId: string, status: any): Promise<boolean> {
    return await this.securityManager.updateDeviceStatus(deviceId, status);
  }

  public getDevice(deviceId: string): NetworkDevice | null {
    return this.securityManager.getDevice(deviceId);
  }

  public getAllDevices(): NetworkDevice[] {
    return this.securityManager.getAllDevices();
  }

  // Firewall Management API
  public async addFirewallRule(rule: Omit<FirewallRule, 'id' | 'createdAt'>): Promise<FirewallRule> {
    return await this.securityManager.addFirewallRule(rule);
  }

  public async removeFirewallRule(ruleId: string): Promise<boolean> {
    return await this.securityManager.removeFirewallRule(ruleId);
  }

  public getFirewallRules(): FirewallRule[] {
    return this.securityManager.getFirewallRules();
  }

  // Threat Detection API
  public async detectThreat(type: any, source: string, target: string, description: string): Promise<NetworkThreat> {
    return await this.securityManager.detectThreat(type, source, target, description);
  }

  public async mitigateThreat(threatId: string, action: any): Promise<boolean> {
    return await this.securityManager.mitigateThreat(threatId, action);
  }

  public getThreats(status?: any): NetworkThreat[] {
    return this.securityManager.getThreats(status);
  }

  // Network Scanning API
  public async performSecurityScan(networkRange?: string): Promise<NetworkScanResult> {
    return await this.securityManager.performSecurityScan(networkRange);
  }

  // Communication Management API
  public async createChannel(name: string, type: any, participants: string[]): Promise<CommunicationChannel> {
    return await this.communicationManager.createChannel(name, type, participants);
  }

  public async joinChannel(channelId: string, deviceId: string): Promise<boolean> {
    return await this.communicationManager.joinChannel(channelId, deviceId);
  }

  public async leaveChannel(channelId: string, deviceId: string): Promise<boolean> {
    return await this.communicationManager.leaveChannel(channelId, deviceId);
  }

  public async sendMessage(deviceId: string, message: DeviceMessage): Promise<boolean> {
    return await this.communicationManager.sendMessage(deviceId, message);
  }

  public async broadcastToChannel(channelId: string, message: any): Promise<number> {
    return await this.communicationManager.broadcastToChannel(channelId, message);
  }

  public getConnectedDevices(): string[] {
    return this.communicationManager.getConnectedDevices();
  }

  public getChannels(): CommunicationChannel[] {
    return this.communicationManager.getChannels();
  }

  // Metrics and Configuration API
  public getNetworkMetrics(): NetworkMetrics {
    return this.securityManager.getNetworkMetrics();
  }

  public async updateSecurityConfiguration(config: Partial<NetworkSecurityConfiguration>): Promise<void> {
    await this.securityManager.updateConfiguration(config);
  }

  public getSecurityConfiguration(): NetworkSecurityConfiguration {
    return this.securityManager.getConfiguration();
  }

  public async updateCommunicationConfiguration(config: Partial<SecureCommunicationConfig>): Promise<void> {
    await this.communicationManager.updateConfiguration(config);
  }

  public getCommunicationConfiguration(): SecureCommunicationConfig {
    return this.communicationManager.getConfiguration();
  }

  // Event Forwarding
  private setupEventForwarding(): void {
    // Forward security manager events
    this.securityManager.on('device-registered', (device) => this.emit('device-registered', device));
    this.securityManager.on('device-status-changed', (device, oldStatus) => 
      this.emit('device-status-changed', device, oldStatus));
    this.securityManager.on('threat-detected', (threat) => this.emit('threat-detected', threat));
    this.securityManager.on('threat-mitigated', (threat) => this.emit('threat-mitigated', threat));
    this.securityManager.on('firewall-rule-added', (rule) => this.emit('firewall-rule-added', rule));
    this.securityManager.on('security-scan-completed', (result) => this.emit('security-scan-completed', result));
    this.securityManager.on('metrics-updated', (metrics) => this.emit('metrics-updated', metrics));

    // Forward communication manager events
    this.communicationManager.on('channel-created', (channel) => this.emit('channel-created', channel));
    this.communicationManager.on('device-connected', (deviceId) => this.emit('device-connected', deviceId));
    this.communicationManager.on('device-disconnected', (deviceId) => this.emit('device-disconnected', deviceId));
    this.communicationManager.on('device-authenticated', (deviceId) => this.emit('device-authenticated', deviceId));
    this.communicationManager.on('message-received', (message, deviceId) => 
      this.emit('message-received', message, deviceId));
    this.communicationManager.on('evidence-sync-request', (deviceId, payload) => 
      this.emit('evidence-sync-request', deviceId, payload));
    this.communicationManager.on('data-transfer', (deviceId, payload) => 
      this.emit('data-transfer', deviceId, payload));
  }

  // IPC Handlers for Renderer Process
  private setupIPCHandlers(): void {
    // Device Management
    ipcMain.handle('network-security:get-devices', () => {
      return this.getAllDevices();
    });

    ipcMain.handle('network-security:get-device', (_, deviceId: string) => {
      return this.getDevice(deviceId);
    });

    ipcMain.handle('network-security:register-device', (_, device: Partial<NetworkDevice>) => {
      return this.registerDevice(device);
    });

    ipcMain.handle('network-security:update-device-status', (_, deviceId: string, status: any) => {
      return this.updateDeviceStatus(deviceId, status);
    });

    // Firewall Management
    ipcMain.handle('network-security:get-firewall-rules', () => {
      return this.getFirewallRules();
    });

    ipcMain.handle('network-security:add-firewall-rule', (_, rule: Omit<FirewallRule, 'id' | 'createdAt'>) => {
      return this.addFirewallRule(rule);
    });

    ipcMain.handle('network-security:remove-firewall-rule', (_, ruleId: string) => {
      return this.removeFirewallRule(ruleId);
    });

    // Threat Management
    ipcMain.handle('network-security:get-threats', (_, status?: any) => {
      return this.getThreats(status);
    });

    ipcMain.handle('network-security:mitigate-threat', (_, threatId: string, action: any) => {
      return this.mitigateThreat(threatId, action);
    });

    // Network Scanning
    ipcMain.handle('network-security:scan-network', (_, networkRange?: string) => {
      return this.performSecurityScan(networkRange);
    });

    // Communication Channels
    ipcMain.handle('network-security:get-channels', () => {
      return this.getChannels();
    });

    ipcMain.handle('network-security:create-channel', (_, name: string, type: any, participants: string[]) => {
      return this.createChannel(name, type, participants);
    });

    ipcMain.handle('network-security:join-channel', (_, channelId: string, deviceId: string) => {
      return this.joinChannel(channelId, deviceId);
    });

    ipcMain.handle('network-security:leave-channel', (_, channelId: string, deviceId: string) => {
      return this.leaveChannel(channelId, deviceId);
    });

    ipcMain.handle('network-security:send-message', (_, deviceId: string, message: DeviceMessage) => {
      return this.sendMessage(deviceId, message);
    });

    ipcMain.handle('network-security:get-connected-devices', () => {
      return this.getConnectedDevices();
    });

    // Metrics and Configuration
    ipcMain.handle('network-security:get-metrics', () => {
      return this.getNetworkMetrics();
    });

    ipcMain.handle('network-security:get-security-config', () => {
      return this.getSecurityConfiguration();
    });

    ipcMain.handle('network-security:update-security-config', (_, config: Partial<NetworkSecurityConfiguration>) => {
      return this.updateSecurityConfiguration(config);
    });

    ipcMain.handle('network-security:get-communication-config', () => {
      return this.getCommunicationConfiguration();
    });

    ipcMain.handle('network-security:update-communication-config', (_, config: Partial<SecureCommunicationConfig>) => {
      return this.updateCommunicationConfiguration(config);
    });

    console.log('Network Security IPC handlers registered');
  }

  // Integration with Investigation Equipment
  public async setupInvestigationNetwork(): Promise<void> {
    try {
      // Create investigation-specific communication channel
      const investigationChannel = await this.createChannel(
        'Investigation Command',
        'investigation_sync' as any,
        []
      );

      // Setup device discovery for investigation equipment
      const scanResult = await this.performSecurityScan('192.168.1.0/24');
      
      for (const device of scanResult.devicesFound) {
        if (this.isInvestigationEquipment(device)) {
          await this.joinChannel(investigationChannel.id, device.id);
        }
      }

      this.emit('investigation-network-ready', investigationChannel);
      
    } catch (error) {
      console.error('Failed to setup investigation network:', error);
      throw error;
    }
  }

  private isInvestigationEquipment(device: NetworkDevice): boolean {
    // Determine if device is investigation equipment based on type or capabilities
    const investigationTypes = [
      'ip_camera', 'audio_recorder', 'emf_sensor', 
      'thermal_camera', 'sls_device', 'laser_grid'
    ];
    
    return investigationTypes.includes(device.type as string);
  }

  // Evidence Transfer Security
  public async secureEvidenceTransfer(sourceDeviceId: string, targetDeviceId: string, evidenceData: any): Promise<boolean> {
    try {
      // Create secure channel for evidence transfer
      const transferChannel = await this.createChannel(
        `Evidence Transfer: ${sourceDeviceId} -> ${targetDeviceId}`,
        'evidence_transfer' as any,
        [sourceDeviceId, targetDeviceId]
      );

      // Send evidence data through secure channel
      const message: DeviceMessage = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        channelId: transferChannel.id,
        senderId: sourceDeviceId,
        receiverId: targetDeviceId,
        type: MessageType.DATA_TRANSFER,
        priority: 'evidence' as any,
        payload: {
          type: 'evidence',
          data: evidenceData,
          checksum: this.calculateChecksum(evidenceData)
        },
        encrypted: true
      };

      const success = await this.sendMessage(targetDeviceId, message);
      
      // Clean up transfer channel
      setTimeout(() => {
        this.communicationManager.removeChannel(transferChannel.id);
      }, 60000); // Remove after 1 minute

      return success;
      
    } catch (error) {
      console.error('Failed to transfer evidence securely:', error);
      return false;
    }
  }

  private calculateChecksum(data: any): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // System Health and Monitoring
  public getSystemHealth(): any {
    const securityMetrics = this.getNetworkMetrics();
    const connectedDevices = this.getConnectedDevices();
    const activeChannels = this.getChannels().filter(c => c.status === 'active').length;
    const openThreats = this.getThreats('detected').length;

    return {
      security: {
        ...securityMetrics,
        status: openThreats === 0 ? 'secure' : openThreats > 5 ? 'critical' : 'warning'
      },
      communication: {
        connectedDevices: connectedDevices.length,
        activeChannels,
        status: connectedDevices.length > 0 ? 'operational' : 'offline'
      },
      overall: {
        status: this.determineOverallStatus(securityMetrics, connectedDevices.length, openThreats),
        uptime: this.getUptime(),
        lastUpdate: new Date()
      }
    };
  }

  private determineOverallStatus(securityMetrics: NetworkMetrics, connectedDevices: number, openThreats: number): string {
    if (openThreats > 5) return 'critical';
    if (openThreats > 0 || securityMetrics.suspiciousDevices > 0) return 'warning';
    if (connectedDevices === 0) return 'offline';
    return 'healthy';
  }

  private getUptime(): number {
    return process.uptime() * 1000; // Convert to milliseconds
  }

  public destroy(): void {
    // Remove IPC handlers
    ipcMain.removeHandler('network-security:get-devices');
    ipcMain.removeHandler('network-security:get-device');
    ipcMain.removeHandler('network-security:register-device');
    ipcMain.removeHandler('network-security:update-device-status');
    ipcMain.removeHandler('network-security:get-firewall-rules');
    ipcMain.removeHandler('network-security:add-firewall-rule');
    ipcMain.removeHandler('network-security:remove-firewall-rule');
    ipcMain.removeHandler('network-security:get-threats');
    ipcMain.removeHandler('network-security:mitigate-threat');
    ipcMain.removeHandler('network-security:scan-network');
    ipcMain.removeHandler('network-security:get-channels');
    ipcMain.removeHandler('network-security:create-channel');
    ipcMain.removeHandler('network-security:join-channel');
    ipcMain.removeHandler('network-security:leave-channel');
    ipcMain.removeHandler('network-security:send-message');
    ipcMain.removeHandler('network-security:get-connected-devices');
    ipcMain.removeHandler('network-security:get-metrics');
    ipcMain.removeHandler('network-security:get-security-config');
    ipcMain.removeHandler('network-security:update-security-config');
    ipcMain.removeHandler('network-security:get-communication-config');
    ipcMain.removeHandler('network-security:update-communication-config');

    // Destroy managers
    this.securityManager.destroy();
    this.communicationManager.destroy();

    this.removeAllListeners();
    console.log('Network Security System destroyed');
  }
}

// Export types and classes
export * from './types';
export { NetworkSecurityManager } from './NetworkSecurityManager';
export { SecureCommunicationManager } from './SecureCommunicationManager';