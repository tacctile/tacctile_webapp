/**
 * Network Security & Firewall Management Types
 * Comprehensive type definitions for secure multi-device investigation setups
 */

export interface NetworkDevice {
  id: string;
  name: string;
  type: DeviceType;
  ipAddress: string;
  macAddress: string;
  port?: number;
  status: DeviceStatus;
  capabilities: DeviceCapabilities;
  security: SecurityConfiguration;
  lastSeen: Date;
  trustLevel: TrustLevel;
  location?: string;
}

export enum DeviceType {
  INVESTIGATION_LAPTOP = 'investigation_laptop',
  MOBILE_DEVICE = 'mobile_device',
  IP_CAMERA = 'ip_camera',
  AUDIO_RECORDER = 'audio_recorder',
  EMF_SENSOR = 'emf_sensor',
  THERMAL_CAMERA = 'thermal_camera',
  SLS_DEVICE = 'sls_device',
  LASER_GRID = 'laser_grid',
  NETWORK_HUB = 'network_hub',
  UNKNOWN = 'unknown'
}

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  CONNECTING = 'connecting',
  SUSPICIOUS = 'suspicious',
  BLOCKED = 'blocked',
  QUARANTINED = 'quarantined'
}

export enum TrustLevel {
  TRUSTED = 'trusted',
  KNOWN = 'known',
  UNKNOWN = 'unknown',
  SUSPICIOUS = 'suspicious',
  BLOCKED = 'blocked'
}

export interface DeviceCapabilities {
  encrypted: boolean;
  authentication: string[];
  protocols: NetworkProtocol[];
  maxBandwidth?: number;
  features: string[];
}

export interface SecurityConfiguration {
  encrypted: boolean;
  certificateValidated: boolean;
  authenticationRequired: boolean;
  allowedProtocols: NetworkProtocol[];
  firewallRules: FirewallRule[];
  rateLimiting?: RateLimitConfig;
}

export interface NetworkProtocol {
  name: string;
  version: string;
  secure: boolean;
  port: number;
  description: string;
}

export interface FirewallRule {
  id: string;
  name: string;
  action: FirewallAction;
  direction: TrafficDirection;
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'ANY';
  sourceIP?: string;
  sourcePort?: number | string;
  destinationIP?: string;
  destinationPort?: number | string;
  enabled: boolean;
  priority: number;
  description: string;
  createdAt: Date;
}

export enum FirewallAction {
  ALLOW = 'allow',
  BLOCK = 'block',
  QUARANTINE = 'quarantine',
  LOG = 'log',
  ALERT = 'alert'
}

export enum TrafficDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  BIDIRECTIONAL = 'bidirectional'
}

export interface NetworkSecurityPolicy {
  id: string;
  name: string;
  description: string;
  rules: SecurityRule[];
  deviceTypes: DeviceType[];
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityRule {
  id: string;
  type: SecurityRuleType;
  condition: SecurityCondition;
  action: SecurityAction;
  parameters: Record<string, any>;
}

export enum SecurityRuleType {
  TRAFFIC_ANALYSIS = 'traffic_analysis',
  INTRUSION_DETECTION = 'intrusion_detection',
  DATA_PROTECTION = 'data_protection',
  ACCESS_CONTROL = 'access_control',
  ENCRYPTION_ENFORCEMENT = 'encryption_enforcement'
}

export interface SecurityCondition {
  type: 'ip_range' | 'device_type' | 'traffic_pattern' | 'bandwidth' | 'time_window' | 'custom';
  value: any;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in_range' | 'matches';
}

export interface SecurityAction {
  type: 'allow' | 'block' | 'quarantine' | 'alert' | 'log' | 'throttle' | 'encrypt';
  parameters: Record<string, any>;
  notification?: NotificationConfig;
}

export interface NotificationConfig {
  channels: ('email' | 'sms' | 'desktop' | 'audit_log')[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  throttle?: number; // minutes
}

export interface RateLimitConfig {
  requests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  blockDuration?: number;
}

export interface NetworkConnection {
  id: string;
  sourceDevice: string;
  targetDevice: string;
  protocol: NetworkProtocol;
  status: ConnectionStatus;
  bandwidth: BandwidthUsage;
  security: ConnectionSecurity;
  metrics: ConnectionMetrics;
  establishedAt: Date;
  lastActivity: Date;
}

export enum ConnectionStatus {
  ESTABLISHING = 'establishing',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  ENCRYPTED = 'encrypted',
  DISCONNECTING = 'disconnecting',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  SUSPICIOUS = 'suspicious'
}

export interface BandwidthUsage {
  current: number; // bytes per second
  average: number;
  peak: number;
  limit?: number;
  history: BandwidthDataPoint[];
}

export interface BandwidthDataPoint {
  timestamp: Date;
  upload: number;
  download: number;
  total: number;
}

export interface ConnectionSecurity {
  encrypted: boolean;
  encryptionAlgorithm?: string;
  certificateValid: boolean;
  certificateExpiry?: Date;
  integrityVerified: boolean;
  authenticationMethod?: string;
}

export interface ConnectionMetrics {
  packetsTransmitted: number;
  packetsReceived: number;
  bytesTransmitted: number;
  bytesReceived: number;
  latency: number;
  jitter: number;
  packetLoss: number;
  errors: number;
}

export interface CommunicationChannel {
  id: string;
  name: string;
  type: ChannelType;
  participants: string[]; // device IDs
  security: ChannelSecurity;
  configuration: ChannelConfiguration;
  status: ChannelStatus;
  createdAt: Date;
  lastActivity: Date;
}

export enum ChannelType {
  DEVICE_TO_DEVICE = 'device_to_device',
  MULTICAST = 'multicast',
  BROADCAST = 'broadcast',
  INVESTIGATION_SYNC = 'investigation_sync',
  EVIDENCE_TRANSFER = 'evidence_transfer',
  COMMAND_CONTROL = 'command_control'
}

export interface ChannelSecurity {
  endToEndEncryption: boolean;
  keyExchangeProtocol: string;
  encryptionAlgorithm: string;
  signatureVerification: boolean;
  forwardSecrecy: boolean;
  authenticationRequired: boolean;
}

export interface ChannelConfiguration {
  maxParticipants: number;
  bandwidthLimit?: number;
  compressionEnabled: boolean;
  priority: ChannelPriority;
  retransmissionEnabled: boolean;
  bufferSize: number;
  timeout: number;
}

export enum ChannelPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
  EVIDENCE = 'evidence'
}

export enum ChannelStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISCONNECTED = 'disconnected',
  ERROR = 'error'
}

export interface NetworkThreat {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  source: string; // IP address or device ID
  target: string;
  description: string;
  indicators: ThreatIndicator[];
  detectedAt: Date;
  status: ThreatStatus;
  mitigation?: MitigationAction;
}

export enum ThreatType {
  PORT_SCAN = 'port_scan',
  BRUTE_FORCE = 'brute_force',
  DOS_ATTACK = 'dos_attack',
  MITM_ATTACK = 'mitm_attack',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_EXFILTRATION = 'data_exfiltration',
  MALWARE_COMMUNICATION = 'malware_communication',
  SUSPICIOUS_TRAFFIC = 'suspicious_traffic',
  UNKNOWN_DEVICE = 'unknown_device'
}

export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ThreatIndicator {
  type: 'ip' | 'domain' | 'hash' | 'pattern' | 'behavioral';
  value: string;
  confidence: number; // 0-100
  description: string;
}

export enum ThreatStatus {
  DETECTED = 'detected',
  ANALYZING = 'analyzing',
  CONFIRMED = 'confirmed',
  MITIGATED = 'mitigated',
  FALSE_POSITIVE = 'false_positive'
}

export interface MitigationAction {
  type: 'block' | 'quarantine' | 'throttle' | 'monitor' | 'alert';
  appliedAt: Date;
  automatic: boolean;
  effectiveness: number; // 0-100
  description: string;
}

export interface NetworkMetrics {
  totalDevices: number;
  onlineDevices: number;
  trustedDevices: number;
  suspiciousDevices: number;
  activeConnections: number;
  totalBandwidth: number;
  usedBandwidth: number;
  threatsDetected: number;
  threatsBlocked: number;
  uptime: number;
  lastUpdate: Date;
}

export interface NetworkScanResult {
  scanId: string;
  startTime: Date;
  endTime: Date;
  networkRange: string;
  devicesFound: NetworkDevice[];
  vulnerabilities: SecurityVulnerability[];
  recommendations: SecurityRecommendation[];
}

export interface SecurityVulnerability {
  id: string;
  type: VulnerabilityType;
  severity: ThreatSeverity;
  deviceId: string;
  description: string;
  cve?: string;
  mitigation: string;
  detectedAt: Date;
}

export enum VulnerabilityType {
  OPEN_PORT = 'open_port',
  WEAK_PASSWORD = 'weak_password',
  UNENCRYPTED_TRAFFIC = 'unencrypted_traffic',
  OUTDATED_FIRMWARE = 'outdated_firmware',
  DEFAULT_CREDENTIALS = 'default_credentials',
  MISSING_SECURITY_UPDATES = 'missing_security_updates'
}

export interface SecurityRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'firewall' | 'encryption' | 'authentication' | 'monitoring' | 'configuration';
  description: string;
  action: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}

export interface NetworkSecurityConfiguration {
  enableFirewall: boolean;
  enableIntrusionDetection: boolean;
  enableThreatAnalysis: boolean;
  enableBandwidthMonitoring: boolean;
  enableEncryptionEnforcement: boolean;
  defaultTrustLevel: TrustLevel;
  scanInterval: number; // minutes
  logRetention: number; // days
  alertThresholds: AlertThresholds;
  autoMitigation: AutoMitigationConfig;
}

export interface AlertThresholds {
  bandwidthUsage: number; // percentage
  connectionAttempts: number;
  failedAuthentications: number;
  unknownDevices: number;
  suspiciousTraffic: number;
}

export interface AutoMitigationConfig {
  enabled: boolean;
  blockSuspiciousIPs: boolean;
  quarantineUnknownDevices: boolean;
  throttleHighTraffic: boolean;
  requireReauthentication: boolean;
  notifyAdministrator: boolean;
}

export interface NetworkEvent {
  id: string;
  timestamp: Date;
  type: NetworkEventType;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  details: Record<string, any>;
}

export enum NetworkEventType {
  DEVICE_CONNECTED = 'device_connected',
  DEVICE_DISCONNECTED = 'device_disconnected',
  THREAT_DETECTED = 'threat_detected',
  FIREWALL_BLOCK = 'firewall_block',
  AUTHENTICATION_FAILED = 'authentication_failed',
  BANDWIDTH_EXCEEDED = 'bandwidth_exceeded',
  CONFIGURATION_CHANGED = 'configuration_changed',
  SECURITY_ALERT = 'security_alert'
}