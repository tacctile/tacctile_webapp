/**
 * Network Security Manager
 * Core network security protocols and firewall management for multi-device investigation setups
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import {
  NetworkDevice,
  DeviceType,
  DeviceStatus,
  TrustLevel,
  FirewallRule,
  FirewallAction,
  TrafficDirection,
  NetworkSecurityPolicy,
  NetworkThreat,
  ThreatType,
  ThreatSeverity,
  ThreatStatus,
  NetworkMetrics,
  NetworkScanResult,
  SecurityVulnerability,
  VulnerabilityType,
  SecurityRecommendation,
  NetworkSecurityConfiguration,
  NetworkEvent,
  NetworkEventType,
  MitigationAction,
} from './types';

export class NetworkSecurityManager extends EventEmitter {
  private devices: Map<string, NetworkDevice> = new Map();
  private firewallRules: Map<string, FirewallRule> = new Map();
  private securityPolicies: Map<string, NetworkSecurityPolicy> = new Map();
  private threats: Map<string, NetworkThreat> = new Map();
  private rateLimiters: Map<string, RateLimiterMemory> = new Map();
  private configPath: string;
  private logPath: string;
  private configuration: NetworkSecurityConfiguration;
  private scanTimer: NodeJS.Timeout | null = null;
  private monitoringTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'network-security-config.json');
    this.logPath = path.join(userDataPath, 'network-security-logs');
    
    this.configuration = this.getDefaultConfiguration();
  }

  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logPath, { recursive: true });
      await this.loadConfiguration();
      await this.loadSecurityPolicies();
      await this.initializeDefaultFirewallRules();
      await this.startNetworkMonitoring();
      
      await this.logEvent({
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: NetworkEventType.CONFIGURATION_CHANGED,
        severity: 'info',
        source: 'NetworkSecurityManager',
        message: 'Network Security Manager initialized successfully',
        details: { 
          firewall_enabled: this.configuration.enableFirewall,
          intrusion_detection: this.configuration.enableIntrusionDetection
        }
      });

      console.log('NetworkSecurityManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize NetworkSecurityManager:', error);
      throw error;
    }
  }

  // Device Management
  public async registerDevice(device: Partial<NetworkDevice>): Promise<NetworkDevice> {
    const networkDevice: NetworkDevice = {
      id: device.id || crypto.randomUUID(),
      name: device.name || `Unknown Device (${device.ipAddress})`,
      type: device.type || DeviceType.UNKNOWN,
      ipAddress: device.ipAddress || 'unknown',
      macAddress: device.macAddress || '',
      port: device.port,
      status: DeviceStatus.CONNECTING,
      capabilities: device.capabilities || {
        encrypted: false,
        authentication: [],
        protocols: [],
        features: []
      },
      security: device.security || {
        encrypted: false,
        certificateValidated: false,
        authenticationRequired: true,
        allowedProtocols: [],
        firewallRules: []
      },
      lastSeen: new Date(),
      trustLevel: device.trustLevel || this.configuration.defaultTrustLevel,
      location: device.location
    };

    // Apply security assessment
    await this.assessDeviceSecurity(networkDevice);
    
    this.devices.set(networkDevice.id, networkDevice);
    
    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: NetworkEventType.DEVICE_CONNECTED,
      severity: 'info',
      source: networkDevice.id,
      message: `Device registered: ${networkDevice.name}`,
      details: {
        device_type: networkDevice.type,
        ip_address: networkDevice.ipAddress,
        trust_level: networkDevice.trustLevel
      }
    });

    this.emit('device-registered', networkDevice);
    return networkDevice;
  }

  public async updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    const oldStatus = device.status;
    device.status = status;
    device.lastSeen = new Date();

    if (status === DeviceStatus.SUSPICIOUS || status === DeviceStatus.BLOCKED) {
      await this.handleSuspiciousDevice(device);
    }

    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: status === DeviceStatus.OFFLINE ? 
        NetworkEventType.DEVICE_DISCONNECTED : 
        NetworkEventType.DEVICE_CONNECTED,
      severity: status === DeviceStatus.SUSPICIOUS ? 'warning' : 'info',
      source: deviceId,
      message: `Device status changed: ${oldStatus} -> ${status}`,
      details: { old_status: oldStatus, new_status: status }
    });

    this.emit('device-status-changed', device, oldStatus);
    return true;
  }

  public getDevice(deviceId: string): NetworkDevice | null {
    return this.devices.get(deviceId) || null;
  }

  public getAllDevices(): NetworkDevice[] {
    return Array.from(this.devices.values());
  }

  public getDevicesByType(type: DeviceType): NetworkDevice[] {
    return Array.from(this.devices.values()).filter(device => device.type === type);
  }

  public getDevicesByTrustLevel(trustLevel: TrustLevel): NetworkDevice[] {
    return Array.from(this.devices.values()).filter(device => device.trustLevel === trustLevel);
  }

  // Firewall Management
  public async addFirewallRule(rule: Omit<FirewallRule, 'id' | 'createdAt'>): Promise<FirewallRule> {
    const firewallRule: FirewallRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date()
    };

    this.firewallRules.set(firewallRule.id, firewallRule);
    await this.saveConfiguration();

    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: NetworkEventType.CONFIGURATION_CHANGED,
      severity: 'info',
      source: 'NetworkSecurityManager',
      message: `Firewall rule added: ${firewallRule.name}`,
      details: {
        rule_id: firewallRule.id,
        action: firewallRule.action,
        direction: firewallRule.direction
      }
    });

    this.emit('firewall-rule-added', firewallRule);
    return firewallRule;
  }

  public async removeFirewallRule(ruleId: string): Promise<boolean> {
    const rule = this.firewallRules.get(ruleId);
    if (!rule) return false;

    this.firewallRules.delete(ruleId);
    await this.saveConfiguration();

    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: NetworkEventType.CONFIGURATION_CHANGED,
      severity: 'info',
      source: 'NetworkSecurityManager',
      message: `Firewall rule removed: ${rule.name}`,
      details: { rule_id: ruleId }
    });

    this.emit('firewall-rule-removed', rule);
    return true;
  }

  public getFirewallRules(): FirewallRule[] {
    return Array.from(this.firewallRules.values())
      .sort((a, b) => a.priority - b.priority);
  }

  public async evaluateTrafficAgainstFirewall(
    sourceIP: string, 
    destinationIP: string, 
    protocol: string, 
    port: number
  ): Promise<{ allowed: boolean; rule?: FirewallRule }> {
    for (const rule of this.getFirewallRules()) {
      if (!rule.enabled) continue;

      if (this.matchesFirewallRule(rule, sourceIP, destinationIP, protocol, port)) {
        const allowed = rule.action === FirewallAction.ALLOW;
        
        if (!allowed) {
          await this.logEvent({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            type: NetworkEventType.FIREWALL_BLOCK,
            severity: 'warning',
            source: sourceIP,
            message: `Traffic blocked by firewall rule: ${rule.name}`,
            details: {
              rule_id: rule.id,
              destination: destinationIP,
              protocol,
              port
            }
          });
        }

        return { allowed, rule };
      }
    }

    // Default deny policy
    return { allowed: false };
  }

  // Threat Detection and Response
  public async detectThreat(
    type: ThreatType,
    source: string,
    target: string,
    description: string,
    severity: ThreatSeverity = ThreatSeverity.MEDIUM
  ): Promise<NetworkThreat> {
    const threat: NetworkThreat = {
      id: crypto.randomUUID(),
      type,
      severity,
      source,
      target,
      description,
      indicators: [],
      detectedAt: new Date(),
      status: ThreatStatus.DETECTED
    };

    this.threats.set(threat.id, threat);

    // Apply automatic mitigation if enabled
    if (this.configuration.autoMitigation.enabled) {
      const mitigation = await this.applyAutoMitigation(threat);
      if (mitigation) {
        threat.mitigation = mitigation;
        threat.status = ThreatStatus.MITIGATED;
      }
    }

    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: NetworkEventType.THREAT_DETECTED,
      severity: severity === ThreatSeverity.CRITICAL ? 'critical' : 'warning',
      source: source,
      message: `${type} detected from ${source} targeting ${target}`,
      details: {
        threat_id: threat.id,
        threat_type: type,
        severity: severity,
        description: description
      }
    });

    this.emit('threat-detected', threat);
    return threat;
  }

  public async mitigateThreat(threatId: string, action: MitigationAction): Promise<boolean> {
    const threat = this.threats.get(threatId);
    if (!threat) return false;

    threat.mitigation = action;
    threat.status = ThreatStatus.MITIGATED;

    // Apply mitigation action
    await this.executeMitigationAction(threat, action);

    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: NetworkEventType.SECURITY_ALERT,
      severity: 'info',
      source: 'NetworkSecurityManager',
      message: `Threat mitigated: ${threat.type}`,
      details: {
        threat_id: threatId,
        mitigation_type: action.type,
        automatic: action.automatic
      }
    });

    this.emit('threat-mitigated', threat);
    return true;
  }

  public getThreats(status?: ThreatStatus): NetworkThreat[] {
    const threats = Array.from(this.threats.values());
    return status ? threats.filter(t => t.status === status) : threats;
  }

  // Network Scanning
  public async performSecurityScan(networkRange?: string): Promise<NetworkScanResult> {
    const scanId = crypto.randomUUID();
    const startTime = new Date();
    
    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: startTime,
      type: NetworkEventType.SECURITY_ALERT,
      severity: 'info',
      source: 'NetworkSecurityManager',
      message: 'Network security scan started',
      details: { scan_id: scanId, network_range: networkRange }
    });

    // Perform device discovery
    const devicesFound = await this.discoverNetworkDevices(networkRange);
    
    // Assess vulnerabilities
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: SecurityRecommendation[] = [];

    for (const device of devicesFound) {
      const deviceVulns = await this.assessDeviceVulnerabilities(device);
      vulnerabilities.push(...deviceVulns);
    }

    // Generate recommendations
    recommendations.push(...this.generateSecurityRecommendations(vulnerabilities));

    const endTime = new Date();
    const result: NetworkScanResult = {
      scanId,
      startTime,
      endTime,
      networkRange: networkRange || 'auto-detected',
      devicesFound,
      vulnerabilities,
      recommendations
    };

    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: endTime,
      type: NetworkEventType.SECURITY_ALERT,
      severity: 'info',
      source: 'NetworkSecurityManager',
      message: 'Network security scan completed',
      details: {
        scan_id: scanId,
        devices_found: devicesFound.length,
        vulnerabilities_found: vulnerabilities.length
      }
    });

    this.emit('security-scan-completed', result);
    return result;
  }

  // Metrics and Monitoring
  public getNetworkMetrics(): NetworkMetrics {
    const devices = Array.from(this.devices.values());
    const threats = Array.from(this.threats.values());

    return {
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === DeviceStatus.ONLINE).length,
      trustedDevices: devices.filter(d => d.trustLevel === TrustLevel.TRUSTED).length,
      suspiciousDevices: devices.filter(d => d.trustLevel === TrustLevel.SUSPICIOUS).length,
      activeConnections: this.getActiveConnectionsCount(),
      totalBandwidth: this.getTotalBandwidth(),
      usedBandwidth: this.getUsedBandwidth(),
      threatsDetected: threats.length,
      threatsBlocked: threats.filter(t => t.status === ThreatStatus.MITIGATED).length,
      uptime: this.getUptime(),
      lastUpdate: new Date()
    };
  }

  // Configuration Management
  public async updateConfiguration(config: Partial<NetworkSecurityConfiguration>): Promise<void> {
    this.configuration = { ...this.configuration, ...config };
    await this.saveConfiguration();

    await this.logEvent({
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: NetworkEventType.CONFIGURATION_CHANGED,
      severity: 'info',
      source: 'NetworkSecurityManager',
      message: 'Network security configuration updated',
      details: config
    });

    this.emit('configuration-updated', this.configuration);
  }

  public getConfiguration(): NetworkSecurityConfiguration {
    return { ...this.configuration };
  }

  // Private Methods
  private async assessDeviceSecurity(device: NetworkDevice): Promise<void> {
    // Check for security vulnerabilities
    if (!device.security.encrypted) {
      device.trustLevel = TrustLevel.SUSPICIOUS;
    }

    // Check for known device patterns
    if (device.type === DeviceType.UNKNOWN) {
      device.trustLevel = TrustLevel.UNKNOWN;
    }

    // Rate limiting setup
    if (!this.rateLimiters.has(device.id)) {
      this.rateLimiters.set(device.id, new RateLimiterMemory({
        points: 100, // Number of requests
        duration: 60, // Per 60 seconds
      }));
    }
  }

  private async handleSuspiciousDevice(device: NetworkDevice): Promise<void> {
    if (this.configuration.autoMitigation.quarantineUnknownDevices) {
      device.status = DeviceStatus.QUARANTINED;
      
      // Create quarantine firewall rule
      await this.addFirewallRule({
        name: `Quarantine ${device.name}`,
        action: FirewallAction.BLOCK,
        direction: TrafficDirection.BIDIRECTIONAL,
        protocol: 'ANY',
        sourceIP: device.ipAddress,
        enabled: true,
        priority: 1,
        description: `Auto-quarantine for suspicious device ${device.name}`
      });
    }
  }

  private matchesFirewallRule(
    rule: FirewallRule, 
    sourceIP: string, 
    destinationIP: string, 
    protocol: string, 
    port: number
  ): boolean {
    // Simple matching logic - can be enhanced with CIDR, port ranges, etc.
    if (rule.sourceIP && rule.sourceIP !== sourceIP && rule.sourceIP !== '*') {
      return false;
    }

    if (rule.destinationIP && rule.destinationIP !== destinationIP && rule.destinationIP !== '*') {
      return false;
    }

    if (rule.protocol !== 'ANY' && rule.protocol.toLowerCase() !== protocol.toLowerCase()) {
      return false;
    }

    if (rule.destinationPort && 
        rule.destinationPort !== '*' && 
        parseInt(rule.destinationPort.toString()) !== port) {
      return false;
    }

    return true;
  }

  private async applyAutoMitigation(threat: NetworkThreat): Promise<MitigationAction | undefined> {
    const config = this.configuration.autoMitigation;

    if (!config.enabled) return undefined;

    let action: MitigationAction | undefined;

    switch (threat.type) {
      case ThreatType.BRUTE_FORCE:
      case ThreatType.DOS_ATTACK:
        if (config.blockSuspiciousIPs) {
          action = {
            type: 'block',
            appliedAt: new Date(),
            automatic: true,
            effectiveness: 90,
            description: `Automatic IP block for ${threat.type}`
          };
          await this.blockIP(threat.source);
        }
        break;

      case ThreatType.UNAUTHORIZED_ACCESS:
        if (config.requireReauthentication) {
          action = {
            type: 'monitor',
            appliedAt: new Date(),
            automatic: true,
            effectiveness: 70,
            description: 'Enhanced monitoring and reauthentication required'
          };
        }
        break;
    }

    return action;
  }

  private async executeMitigationAction(threat: NetworkThreat, action: MitigationAction): Promise<void> {
    switch (action.type) {
      case 'block':
        await this.blockIP(threat.source);
        break;
      case 'quarantine': {
        const device = Array.from(this.devices.values())
          .find(d => d.ipAddress === threat.source);
        if (device) {
          await this.handleSuspiciousDevice(device);
        }
        break;
      }
      case 'throttle':
        await this.throttleIP(threat.source);
        break;
    }
  }

  private async blockIP(ipAddress: string): Promise<void> {
    await this.addFirewallRule({
      name: `Auto-block ${ipAddress}`,
      action: FirewallAction.BLOCK,
      direction: TrafficDirection.BIDIRECTIONAL,
      protocol: 'ANY',
      sourceIP: ipAddress,
      enabled: true,
      priority: 1,
      description: `Automatic block for suspicious IP ${ipAddress}`
    });
  }

  private async throttleIP(ipAddress: string): Promise<void> {
    const limiter = new RateLimiterMemory({
      points: 10, // Reduced requests
      duration: 60,
      blockDuration: 300 // 5 minutes
    });
    
    this.rateLimiters.set(`throttle_${ipAddress}`, limiter);
  }

  private async discoverNetworkDevices(_networkRange?: string): Promise<NetworkDevice[]> {
    // Integration with existing NetworkScanner
    return Array.from(this.devices.values());
  }

  private async assessDeviceVulnerabilities(device: NetworkDevice): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check for unencrypted traffic
    if (!device.security.encrypted) {
      vulnerabilities.push({
        id: crypto.randomUUID(),
        type: VulnerabilityType.UNENCRYPTED_TRAFFIC,
        severity: ThreatSeverity.HIGH,
        deviceId: device.id,
        description: 'Device is transmitting unencrypted data',
        mitigation: 'Enable encryption for all device communications',
        detectedAt: new Date()
      });
    }

    // Check for default authentication
    if (!device.security.authenticationRequired) {
      vulnerabilities.push({
        id: crypto.randomUUID(),
        type: VulnerabilityType.WEAK_PASSWORD,
        severity: ThreatSeverity.MEDIUM,
        deviceId: device.id,
        description: 'Device does not require authentication',
        mitigation: 'Enable and configure strong authentication',
        detectedAt: new Date()
      });
    }

    return vulnerabilities;
  }

  private generateSecurityRecommendations(vulnerabilities: SecurityVulnerability[]): SecurityRecommendation[] {
    const recommendations: SecurityRecommendation[] = [];
    const vulnTypes = new Set(vulnerabilities.map(v => v.type));

    if (vulnTypes.has(VulnerabilityType.UNENCRYPTED_TRAFFIC)) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'high',
        category: 'encryption',
        description: 'Enable end-to-end encryption for all device communications',
        action: 'Configure TLS/SSL certificates and enforce encrypted protocols',
        impact: 'Protects sensitive investigation data from interception',
        effort: 'medium'
      });
    }

    if (vulnTypes.has(VulnerabilityType.WEAK_PASSWORD)) {
      recommendations.push({
        id: crypto.randomUUID(),
        priority: 'high',
        category: 'authentication',
        description: 'Implement strong authentication mechanisms',
        action: 'Configure multi-factor authentication and strong password policies',
        impact: 'Prevents unauthorized access to investigation equipment',
        effort: 'low'
      });
    }

    return recommendations;
  }

  private getActiveConnectionsCount(): number {
    // Count active device connections
    return Array.from(this.devices.values())
      .filter(d => d.status === DeviceStatus.ONLINE).length;
  }

  private getTotalBandwidth(): number {
    // Return total available bandwidth in bytes/sec
    return 1000000000; // 1 Gbps default
  }

  private getUsedBandwidth(): number {
    // Calculate current bandwidth usage
    return 0; // Placeholder
  }

  private getUptime(): number {
    // Return uptime in milliseconds
    return Date.now() - (global as Record<string, unknown>).startTime || 0;
  }

  private async initializeDefaultFirewallRules(): Promise<void> {
    const defaultRules: Omit<FirewallRule, 'id' | 'createdAt'>[] = [
      {
        name: 'Allow Internal Network',
        action: FirewallAction.ALLOW,
        direction: TrafficDirection.BIDIRECTIONAL,
        protocol: 'ANY',
        sourceIP: '192.168.0.0/16',
        enabled: true,
        priority: 10,
        description: 'Allow internal network communication'
      },
      {
        name: 'Block External Access',
        action: FirewallAction.BLOCK,
        direction: TrafficDirection.INBOUND,
        protocol: 'ANY',
        enabled: true,
        priority: 20,
        description: 'Block external inbound connections'
      }
    ];

    for (const rule of defaultRules) {
      await this.addFirewallRule(rule);
    }
  }

  private async startNetworkMonitoring(): Promise<void> {
    if (this.scanTimer) clearInterval(this.scanTimer);
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);

    // Periodic network scanning
    this.scanTimer = setInterval(async () => {
      if (this.configuration.enableIntrusionDetection) {
        await this.performSecurityScan();
      }
    }, this.configuration.scanInterval * 60 * 1000);

    // Continuous monitoring
    this.monitoringTimer = setInterval(() => {
      this.emit('metrics-updated', this.getNetworkMetrics());
    }, 30000); // Every 30 seconds
  }

  private getDefaultConfiguration(): NetworkSecurityConfiguration {
    return {
      enableFirewall: true,
      enableIntrusionDetection: true,
      enableThreatAnalysis: true,
      enableBandwidthMonitoring: true,
      enableEncryptionEnforcement: true,
      defaultTrustLevel: TrustLevel.UNKNOWN,
      scanInterval: 30,
      logRetention: 90,
      alertThresholds: {
        bandwidthUsage: 80,
        connectionAttempts: 100,
        failedAuthentications: 10,
        unknownDevices: 5,
        suspiciousTraffic: 50
      },
      autoMitigation: {
        enabled: true,
        blockSuspiciousIPs: true,
        quarantineUnknownDevices: true,
        throttleHighTraffic: true,
        requireReauthentication: true,
        notifyAdministrator: true
      }
    };
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const saved = JSON.parse(data);
      this.configuration = { ...this.getDefaultConfiguration(), ...saved };
    } catch (error) {
      // Use default configuration
      await this.saveConfiguration();
    }
  }

  private async saveConfiguration(): Promise<void> {
    try {
      const configData = {
        ...this.configuration,
        firewallRules: Array.from(this.firewallRules.values()),
        securityPolicies: Array.from(this.securityPolicies.values())
      };
      
      await fs.writeFile(this.configPath, JSON.stringify(configData, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save network security configuration:', error);
    }
  }

  private async loadSecurityPolicies(): Promise<void> {
    // Load from configuration file
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const saved = JSON.parse(data);
      
      if (saved.firewallRules) {
        for (const rule of saved.firewallRules) {
          this.firewallRules.set(rule.id, {
            ...rule,
            createdAt: new Date(rule.createdAt)
          });
        }
      }

      if (saved.securityPolicies) {
        for (const policy of saved.securityPolicies) {
          this.securityPolicies.set(policy.id, {
            ...policy,
            createdAt: new Date(policy.createdAt),
            updatedAt: new Date(policy.updatedAt)
          });
        }
      }
    } catch (error) {
      // No existing policies
    }
  }

  private async logEvent(event: NetworkEvent): Promise<void> {
    try {
      const logFile = path.join(this.logPath, `network-${new Date().toISOString().split('T')[0]}.log`);
      const logEntry = JSON.stringify(event) + '\n';
      await fs.appendFile(logFile, logEntry, 'utf8');
      
      this.emit('event-logged', event);
    } catch (error) {
      console.error('Failed to log network event:', error);
    }
  }

  public destroy(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    this.removeAllListeners();
    console.log('NetworkSecurityManager destroyed');
  }
}