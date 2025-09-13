/**
 * License Protection & Anti-Piracy Types
 * Comprehensive type definitions for software protection, license validation,
 * hardware fingerprinting, and anti-tampering measures
 */

import { EventEmitter } from 'events';

// Core License Types
export interface LicenseInfo {
  id: string;
  key: string;
  type: LicenseType;
  tier: SubscriptionTier;
  userId: string;
  hardwareId: string;
  issuedAt: Date;
  activatedAt?: Date;
  expiresAt?: Date;
  lastValidated?: Date;
  status: LicenseStatus;
  features: LicenseFeature[];
  maxSeats: number;
  currentSeats: number;
  gracePeriodDays: number;
  allowOfflineDays: number;
  lastOnlineValidation?: Date;
  metadata: LicenseMetadata;
}

export enum LicenseType {
  TRIAL = 'trial',
  PERSONAL = 'personal',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  EDUCATIONAL = 'educational',
  LIFETIME = 'lifetime'
}

export enum SubscriptionTier {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  ULTIMATE = 'ultimate'
}

export enum LicenseStatus {
  VALID = 'valid',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  SUSPENDED = 'suspended',
  GRACE_PERIOD = 'grace_period',
  OFFLINE_MODE = 'offline_mode',
  INVALID = 'invalid',
  TRIAL_EXPIRED = 'trial_expired'
}

export interface LicenseFeature {
  name: string;
  enabled: boolean;
  maxUsage?: number;
  currentUsage?: number;
  resetInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  lastReset?: Date;
}

export interface LicenseMetadata {
  customerName: string;
  customerEmail: string;
  company?: string;
  purchaseDate: Date;
  paymentMethod?: string;
  invoiceId?: string;
  notes?: string;
  customFields: Record<string, unknown>;
}

// Hardware Fingerprinting
export interface HardwareFingerprint {
  id: string;
  machineId: string;
  cpuInfo: CPUInfo;
  systemInfo: SystemInfo;
  networkInfo: NetworkInfo;
  storageInfo: StorageInfo;
  displayInfo: DisplayInfo;
  biosInfo: BIOSInfo;
  fingerprint: string;
  confidence: number;
  generatedAt: Date;
  lastSeen: Date;
}

export interface CPUInfo {
  manufacturer: string;
  brand: string;
  family: string;
  model: string;
  stepping: string;
  speed: number;
  cores: number;
  cache: CPUCache;
  flags: string[];
}

export interface CPUCache {
  l1d?: number;
  l1i?: number;
  l2?: number;
  l3?: number;
}

export interface SystemInfo {
  platform: string;
  distro: string;
  release: string;
  codename?: string;
  kernel: string;
  arch: string;
  hostname: string;
  fqdn?: string;
  serial?: string;
}

export interface NetworkInfo {
  interfaces: NetworkInterface[];
  defaultInterface?: string;
  defaultGateway?: string;
}

export interface NetworkInterface {
  iface: string;
  mac: string;
  ip4?: string;
  ip6?: string;
  internal: boolean;
  virtual: boolean;
  operstate?: string;
  type?: string;
  duplex?: string;
  mtu?: number;
  speed?: number;
}

export interface StorageInfo {
  drives: DriveInfo[];
  totalSize: number;
  usedSize: number;
  freeSize: number;
}

export interface DriveInfo {
  device: string;
  type: string;
  name: string;
  vendor?: string;
  size: number;
  physical?: string;
  uuid?: string;
  label?: string;
  model?: string;
  serial?: string;
  removable: boolean;
  protocol?: string;
}

export interface DisplayInfo {
  displays: Display[];
  resolution: string;
  pixelDepth: number;
  resolutionX: number;
  resolutionY: number;
}

export interface Display {
  vendor?: string;
  model?: string;
  main: boolean;
  builtin: boolean;
  connection?: string;
  sizeX?: number;
  sizeY?: number;
  pixelDepth?: number;
  resolutionX?: number;
  resolutionY?: number;
  currentResX?: number;
  currentResY?: number;
}

export interface BIOSInfo {
  vendor?: string;
  version?: string;
  releaseDate?: string;
  revision?: string;
}

// Subscription Management
export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  startDate: Date;
  endDate?: Date;
  trialEndDate?: Date;
  renewalDate?: Date;
  canceledAt?: Date;
  pausedAt?: Date;
  gracePeriodEndDate?: Date;
  paymentMethod: PaymentMethod;
  pricing: SubscriptionPricing;
  features: SubscriptionFeature[];
  seats: SeatManagement;
  billingCycle: BillingCycle;
  autoRenewal: boolean;
  metadata: SubscriptionMetadata;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  TRIAL = 'trial',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  SUSPENDED = 'suspended',
  PAUSED = 'paused',
  EXPIRED = 'expired',
  INCOMPLETE = 'incomplete'
}

export interface PaymentMethod {
  type: 'card' | 'paypal' | 'bank_transfer' | 'invoice' | 'crypto';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  country?: string;
  fingerprint?: string;
}

export interface SubscriptionPricing {
  currency: string;
  amount: number;
  setupFee?: number;
  taxRate?: number;
  discountPercent?: number;
  discountAmount?: number;
  total: number;
}

export interface SubscriptionFeature {
  name: string;
  enabled: boolean;
  limit?: number;
  used?: number;
  overage?: number;
  overageRate?: number;
}

export interface SeatManagement {
  totalSeats: number;
  usedSeats: number;
  availableSeats: number;
  seats: Seat[];
  primaryAccountId: string;
  allowSelfService: boolean;
  maxSeats: number;
}

export interface Seat {
  id: string;
  userId: string;
  email: string;
  role: SeatRole;
  status: SeatStatus;
  assignedAt: Date;
  lastActiveAt?: Date;
  permissions: SeatPermission[];
}

export enum SeatRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer'
}

export enum SeatStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING = 'pending',
  SUSPENDED = 'suspended'
}

export interface SeatPermission {
  feature: string;
  access: 'full' | 'read' | 'write' | 'none';
  restrictions?: string[];
}

export enum BillingCycle {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime'
}

export interface SubscriptionMetadata {
  source: string;
  campaign?: string;
  referrer?: string;
  promoCode?: string;
  salesRep?: string;
  notes?: string;
  customFields: Record<string, unknown>;
}

// Anti-Tampering & Code Protection
export interface ProtectionConfiguration {
  enableCodeObfuscation: boolean;
  enableAntiDebug: boolean;
  enableIntegrityCheck: boolean;
  enableRuntimeProtection: boolean;
  enableVMDetection: boolean;
  enableProcessHollowing: boolean;
  enableAPIHooking: boolean;
  maxDebuggerDetections: number;
  tamperResponseAction: TamperResponseAction;
  criticalFunctions: string[];
  protectedModules: string[];
}

export enum TamperResponseAction {
  LOG_ONLY = 'log_only',
  DISABLE_FEATURES = 'disable_features',
  EXIT_APPLICATION = 'exit_application',
  REVOKE_LICENSE = 'revoke_license',
  ALERT_SERVER = 'alert_server'
}

export interface TamperDetection {
  id: string;
  type: TamperType;
  severity: TamperSeverity;
  description: string;
  detectedAt: Date;
  details: TamperDetails;
  responseAction: TamperResponseAction;
  handled: boolean;
}

export enum TamperType {
  DEBUGGER_ATTACHED = 'debugger_attached',
  PROCESS_INJECTION = 'process_injection',
  DLL_INJECTION = 'dll_injection',
  MEMORY_PATCHING = 'memory_patching',
  FILE_MODIFICATION = 'file_modification',
  VIRTUAL_MACHINE = 'virtual_machine',
  EMULATOR_DETECTED = 'emulator_detected',
  ANTI_VM_BYPASS = 'anti_vm_bypass',
  API_HOOKING = 'api_hooking',
  INTEGRITY_VIOLATION = 'integrity_violation'
}

export enum TamperSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TamperDetails {
  processName?: string;
  processId?: number;
  moduleNames?: string[];
  memoryAddresses?: string[];
  stackTrace?: string[];
  environment?: Record<string, string>;
  additionalInfo?: Record<string, unknown>;
}

// Validation & Authentication
export interface ValidationRequest {
  licenseKey: string;
  hardwareFingerprint: string;
  productId: string;
  version: string;
  checkFeatures?: string[];
  timestamp: Date;
  signature?: string;
}

export interface ValidationResponse {
  valid: boolean;
  license?: LicenseInfo;
  features?: LicenseFeature[];
  subscription?: Subscription;
  gracePeriod?: GracePeriodInfo;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  nextValidation?: Date;
  serverTime: Date;
  signature: string;
}

export interface GracePeriodInfo {
  active: boolean;
  remainingDays: number;
  reason: GracePeriodReason;
  startedAt: Date;
  endsAt: Date;
}

export enum GracePeriodReason {
  PAYMENT_FAILED = 'payment_failed',
  NETWORK_ISSUES = 'network_issues',
  SERVER_MAINTENANCE = 'server_maintenance',
  LICENSE_RENEWAL = 'license_renewal',
  SUBSCRIPTION_UPGRADE = 'subscription_upgrade'
}

export interface ValidationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Offline Management
export interface OfflineConfiguration {
  maxOfflineDays: number;
  gracePeriodDays: number;
  requiredFeatures: string[];
  degradedFeatures: string[];
  emergencyMode: boolean;
  lastOnlineCheck: Date;
  nextRequiredCheck: Date;
  offlineLicenseData: EncryptedOfflineLicense;
}

export interface EncryptedOfflineLicense {
  data: string;
  signature: string;
  expiresAt: Date;
  issuer: string;
  algorithm: string;
}

// Events and Logging
export interface LicenseProtectionEvent {
  id: string;
  timestamp: Date;
  type: ProtectionEventType;
  severity: EventSeverity;
  source: string;
  message: string;
  userId?: string;
  licenseId?: string;
  hardwareId?: string;
  details: Record<string, unknown>;
  handled: boolean;
}

export enum ProtectionEventType {
  LICENSE_VALIDATED = 'license_validated',
  LICENSE_EXPIRED = 'license_expired',
  LICENSE_REVOKED = 'license_revoked',
  TAMPER_DETECTED = 'tamper_detected',
  HARDWARE_CHANGED = 'hardware_changed',
  SUBSCRIPTION_RENEWED = 'subscription_renewed',
  SUBSCRIPTION_CANCELED = 'subscription_canceled',
  SEAT_ASSIGNED = 'seat_assigned',
  SEAT_REMOVED = 'seat_removed',
  OFFLINE_MODE_STARTED = 'offline_mode_started',
  OFFLINE_MODE_ENDED = 'offline_mode_ended',
  GRACE_PERIOD_STARTED = 'grace_period_started',
  GRACE_PERIOD_ENDED = 'grace_period_ended',
  FEATURE_BLOCKED = 'feature_blocked',
  PROTECTION_BYPASSED = 'protection_bypassed'
}

export enum EventSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

// API Types
export interface LicenseServerConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  enableSSL: boolean;
  caCertificate?: string;
  clientCertificate?: string;
  clientKey?: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: Date;
  requestId: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// Configuration and Settings
export interface LicenseProtectionConfig {
  productId: string;
  productName: string;
  version: string;
  serverConfig: LicenseServerConfig;
  protection: ProtectionConfiguration;
  offline: OfflineConfiguration;
  validation: ValidationConfiguration;
  features: FeatureConfiguration[];
  encryption: EncryptionConfiguration;
  logging: LoggingConfiguration;
}

export interface ValidationConfiguration {
  checkInterval: number; // milliseconds
  retryInterval: number; // milliseconds
  maxRetries: number;
  timeoutMs: number;
  cacheValidation: boolean;
  cacheDurationMs: number;
  requireOnlineValidation: boolean;
  allowCachedValidation: boolean;
}

export interface FeatureConfiguration {
  name: string;
  requiresLicense: boolean;
  requiresSubscription: boolean;
  minTier: SubscriptionTier;
  gracefulDegradation: boolean;
  offlineAvailable: boolean;
  maxUsage?: number;
  resetInterval?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export interface EncryptionConfiguration {
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  keyDerivation: 'PBKDF2' | 'Argon2id';
  keyIterations: number;
  saltSize: number;
  ivSize: number;
  tagSize: number;
  compressionEnabled: boolean;
}

export interface LoggingConfiguration {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  maxFileSize: number;
  maxFiles: number;
  anonymize: boolean;
  excludeEvents: ProtectionEventType[];
  remoteLogging: boolean;
  remoteEndpoint?: string;
}

// Manager Interfaces
export interface ILicenseProtectionManager extends EventEmitter {
  initialize(): Promise<void>;
  validateLicense(request?: Partial<ValidationRequest>): Promise<ValidationResponse>;
  checkFeatureAccess(featureName: string): Promise<boolean>;
  getHardwareFingerprint(): Promise<HardwareFingerprint>;
  startProtection(): Promise<void>;
  stopProtection(): Promise<void>;
  enableOfflineMode(): Promise<void>;
  disableOfflineMode(): Promise<void>;
  getProtectionStatus(): Promise<ProtectionStatus>;
  destroy(): Promise<void>;
}

export interface ISubscriptionManager extends EventEmitter {
  initialize(): Promise<void>;
  getSubscription(customerId: string): Promise<Subscription | null>;
  validateSubscription(subscriptionId: string): Promise<ValidationResponse>;
  assignSeat(subscriptionId: string, userId: string, email: string): Promise<Seat>;
  removeSeat(subscriptionId: string, seatId: string): Promise<boolean>;
  updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription>;
  cancelSubscription(subscriptionId: string, reason?: string): Promise<boolean>;
  renewSubscription(subscriptionId: string): Promise<Subscription>;
  getSubscriptionUsage(subscriptionId: string): Promise<SubscriptionUsage>;
  destroy(): Promise<void>;
}

export interface ProtectionStatus {
  isActive: boolean;
  isOnline: boolean;
  lastValidation: Date;
  nextValidation: Date;
  offlineDaysRemaining: number;
  gracePeriodActive: boolean;
  tamperDetections: TamperDetection[];
  protectionLevel: ProtectionLevel;
}

export enum ProtectionLevel {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  ADVANCED = 'advanced',
  MAXIMUM = 'maximum'
}

export interface SubscriptionUsage {
  features: Record<string, FeatureUsage>;
  seats: SeatUsage;
  billing: BillingUsage;
  period: UsagePeriod;
}

export interface FeatureUsage {
  name: string;
  used: number;
  limit: number;
  resetDate: Date;
  overage: number;
}

export interface SeatUsage {
  total: number;
  active: number;
  inactive: number;
  lastActive: Record<string, Date>;
}

export interface BillingUsage {
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  amountDue: number;
  amountPaid: number;
  nextBillingDate: Date;
}

export interface UsagePeriod {
  start: Date;
  end: Date;
  type: 'monthly' | 'quarterly' | 'yearly';
}

// Enterprise License Management Extensions
export interface EnterpriseAccount {
  id: string;
  organizationId: string;
  name: string;
  domain: string;
  primaryAdminId: string;
  admins: EnterpriseAdmin[];
  settings: EnterpriseSettings;
  billing: EnterpriseBilling;
  security: EnterpriseSecuritySettings;
  compliance: ComplianceSettings;
  audit: AuditConfiguration;
  createdAt: Date;
  updatedAt: Date;
  status: EnterpriseAccountStatus;
}

export enum EnterpriseAccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING_SETUP = 'pending_setup',
  TRIAL = 'trial',
  CANCELED = 'canceled'
}

export interface EnterpriseAdmin {
  userId: string;
  email: string;
  role: EnterpriseRole;
  permissions: EnterprisePermission[];
  assignedAt: Date;
  assignedBy: string;
  lastActiveAt?: Date;
  status: AdminStatus;
}

export enum EnterpriseRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER_MANAGER = 'user_manager',
  BILLING_ADMIN = 'billing_admin',
  SECURITY_ADMIN = 'security_admin',
  COMPLIANCE_OFFICER = 'compliance_officer'
}

export enum AdminStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_ACTIVATION = 'pending_activation'
}

export interface EnterprisePermission {
  resource: EnterpriseResource;
  actions: EnterpriseAction[];
  conditions?: PermissionCondition[];
  scope?: PermissionScope;
}

export enum EnterpriseResource {
  USERS = 'users',
  SEATS = 'seats',
  LICENSES = 'licenses',
  BILLING = 'billing',
  SECURITY = 'security',
  AUDIT_LOGS = 'audit_logs',
  SETTINGS = 'settings',
  DEVICES = 'devices',
  SUBSCRIPTIONS = 'subscriptions',
  ANALYTICS = 'analytics'
}

export enum EnterpriseAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  ASSIGN = 'assign',
  REVOKE = 'revoke',
  SUSPEND = 'suspend',
  ACTIVATE = 'activate',
  TRANSFER = 'transfer',
  MONITOR = 'monitor'
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains';
  value: unknown;
}

export interface PermissionScope {
  organizationIds?: string[];
  departmentIds?: string[];
  userIds?: string[];
  resourceIds?: string[];
}

export interface EnterpriseSettings {
  seatAllocation: SeatAllocationSettings;
  userManagement: UserManagementSettings;
  security: EnterpriseSecuritySettings;
  notifications: NotificationSettings;
  integrations: IntegrationSettings;
  branding: BrandingSettings;
}

export interface SeatAllocationSettings {
  autoAssignment: boolean;
  allowSelfProvisioning: boolean;
  requireApproval: boolean;
  maxSeatsPerUser: number;
  seatRetentionDays: number;
  transferCooldownHours: number;
  preventAbuseEnabled: boolean;
  maxTransfersPerMonth: number;
}

export interface UserManagementSettings {
  singleSignOn: SSOConfiguration;
  directoryIntegration: DirectoryIntegration;
  userProvisioning: UserProvisioningSettings;
  sessionManagement: SessionManagementSettings;
}

export interface SSOConfiguration {
  enabled: boolean;
  provider: SSOProvider;
  configuration: Record<string, unknown>;
  domainRestriction: string[];
  enforceSSO: boolean;
}

export enum SSOProvider {
  SAML = 'saml',
  OAUTH2 = 'oauth2',
  OIDC = 'oidc',
  LDAP = 'ldap',
  ACTIVE_DIRECTORY = 'active_directory'
}

export interface DirectoryIntegration {
  enabled: boolean;
  provider: DirectoryProvider;
  syncInterval: number;
  syncAttributes: string[];
  configuration: Record<string, unknown>;
}

export enum DirectoryProvider {
  AZURE_AD = 'azure_ad',
  GOOGLE_WORKSPACE = 'google_workspace',
  OKTA = 'okta',
  LDAP = 'ldap',
  ACTIVE_DIRECTORY = 'active_directory'
}

export interface UserProvisioningSettings {
  autoProvisioning: boolean;
  deprovisionOnRemoval: boolean;
  groupBasedProvisioning: boolean;
  defaultRole: SeatRole;
  welcomeEmailEnabled: boolean;
}

export interface SessionManagementSettings {
  maxSessions: number;
  sessionTimeout: number;
  idleTimeout: number;
  forceLogoutOnSuspension: boolean;
  deviceBinding: boolean;
}

export interface EnterpriseSecuritySettings {
  deviceManagement: DeviceManagementSettings;
  accessControl: AccessControlSettings;
  auditLogging: AuditLoggingSettings;
  threatDetection: ThreatDetectionSettings;
}

export interface DeviceManagementSettings {
  maxDevicesPerUser: number;
  deviceRegistrationRequired: boolean;
  deviceTrustRequired: boolean;
  allowBYOD: boolean;
  mdmIntegration: boolean;
  deviceComplianceRequired: boolean;
  automaticDeauthorization: boolean;
  deviceRetentionDays: number;
}

export interface AccessControlSettings {
  ipWhitelisting: IPWhitelistSettings;
  geofencing: GeofencingSettings;
  timeBasedAccess: TimeBasedAccessSettings;
  riskBasedAccess: RiskBasedAccessSettings;
}

export interface IPWhitelistSettings {
  enabled: boolean;
  allowedIPs: string[];
  allowedCIDRs: string[];
  blockUnknownIPs: boolean;
  notifyOnBlockedAccess: boolean;
}

export interface GeofencingSettings {
  enabled: boolean;
  allowedCountries: string[];
  allowedRegions: string[];
  blockVPNs: boolean;
  blockProxies: boolean;
  notifyOnSuspiciousLocation: boolean;
}

export interface TimeBasedAccessSettings {
  enabled: boolean;
  allowedTimeZones: string[];
  businessHoursOnly: boolean;
  businessHours: TimeWindow[];
  weekendsAllowed: boolean;
  holidaysAllowed: boolean;
}

export interface TimeWindow {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  days: number[];    // 0-6 (Sunday-Saturday)
}

export interface RiskBasedAccessSettings {
  enabled: boolean;
  riskThreshold: RiskLevel;
  requireMFAOnHighRisk: boolean;
  blockOnCriticalRisk: boolean;
  adaptiveAuthEnabled: boolean;
  behaviorAnalysis: boolean;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuditLoggingSettings {
  enabled: boolean;
  level: AuditLevel;
  retentionDays: number;
  externalLogging: boolean;
  realTimeAlerts: boolean;
  complianceMode: boolean;
}

export enum AuditLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  DETAILED = 'detailed',
  COMPREHENSIVE = 'comprehensive'
}

export interface ThreatDetectionSettings {
  enabled: boolean;
  sensitivity: ThreatSensitivity;
  realTimeMonitoring: boolean;
  automaticResponse: boolean;
  mlBasedDetection: boolean;
  behaviorBaselines: boolean;
}

export enum ThreatSensitivity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  PARANOID = 'paranoid'
}

// Anti-Abuse & Fraud Detection Types
export interface AbuseDetectionSystem {
  id: string;
  enabled: boolean;
  configuration: AbuseDetectionConfiguration;
  rules: AbuseDetectionRule[];
  alerts: AbuseAlert[];
  analytics: AbuseAnalytics;
  lastUpdated: Date;
}

export interface AbuseDetectionConfiguration {
  licenseSharing: LicenseSharingDetection;
  usagePatterns: UsagePatternDetection;
  deviceActivation: DeviceActivationDetection;
  subscriptionFraud: SubscriptionFraudDetection;
  behaviorAnalysis: BehaviorAnalysisSettings;
  responseActions: AbuseResponseActions;
}

export interface LicenseSharingDetection {
  enabled: boolean;
  maxSimultaneousUsers: number;
  maxDevicesPerLicense: number;
  locationVarianceThreshold: number; // km
  timeVarianceThreshold: number; // minutes
  suspiciousPatterns: LicenseSharingPattern[];
  confidence: DetectionConfidence;
}

export interface LicenseSharingPattern {
  name: string;
  description: string;
  indicators: PatternIndicator[];
  weight: number;
  enabled: boolean;
}

export interface PatternIndicator {
  type: IndicatorType;
  threshold: number;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  timeWindow: number; // seconds
}

export enum IndicatorType {
  SIMULTANEOUS_LOGINS = 'simultaneous_logins',
  GEOGRAPHIC_DISTANCE = 'geographic_distance',
  DEVICE_COUNT = 'device_count',
  IP_DIVERSITY = 'ip_diversity',
  TIME_OVERLAP = 'time_overlap',
  USAGE_FREQUENCY = 'usage_frequency',
  FEATURE_USAGE_PATTERN = 'feature_usage_pattern'
}

export enum DetectionConfidence {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CERTAIN = 'certain'
}

export interface UsagePatternDetection {
  enabled: boolean;
  baselineBuilding: BaselineConfiguration;
  anomalyDetection: AnomalyDetectionSettings;
  patterns: UsagePattern[];
  thresholds: UsageThresholds;
}

export interface BaselineConfiguration {
  enabled: boolean;
  learningPeriodDays: number;
  minDataPoints: number;
  updateFrequency: number; // hours
  seasonality: boolean;
}

export interface AnomalyDetectionSettings {
  algorithm: AnomalyAlgorithm;
  sensitivity: number;
  minConfidence: number;
  excludeWeekends: boolean;
  excludeHolidays: boolean;
}

export enum AnomalyAlgorithm {
  STATISTICAL = 'statistical',
  MACHINE_LEARNING = 'machine_learning',
  ISOLATION_FOREST = 'isolation_forest',
  LSTM = 'lstm'
}

export interface UsagePattern {
  name: string;
  type: UsagePatternType;
  normalRange: NumberRange;
  anomalyThreshold: number;
  timeWindow: number; // minutes
  enabled: boolean;
}

export enum UsagePatternType {
  LOGIN_FREQUENCY = 'login_frequency',
  SESSION_DURATION = 'session_duration',
  FEATURE_USAGE = 'feature_usage',
  DATA_TRANSFER = 'data_transfer',
  API_CALLS = 'api_calls',
  CONCURRENT_SESSIONS = 'concurrent_sessions'
}

export interface NumberRange {
  min: number;
  max: number;
}

export interface UsageThresholds {
  dailyLogins: number;
  sessionsPerHour: number;
  concurrentSessions: number;
  dataTransferMB: number;
  apiCallsPerMinute: number;
  featureUsageRate: number;
}

export interface DeviceActivationDetection {
  enabled: boolean;
  maxDevicesPerAccount: number;
  activationRateLimit: ActivationRateLimit;
  deviceTrustScore: DeviceTrustConfiguration;
  fraudulentPatterns: DeviceFraudPattern[];
}

export interface ActivationRateLimit {
  maxPerHour: number;
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  cooldownPeriod: number; // minutes
}

export interface DeviceTrustConfiguration {
  enabled: boolean;
  minTrustScore: number;
  factors: TrustFactor[];
  decayRate: number; // points per day
}

export interface TrustFactor {
  name: string;
  type: TrustFactorType;
  weight: number;
  enabled: boolean;
}

export enum TrustFactorType {
  AGE = 'age',
  USAGE_HISTORY = 'usage_history',
  LOCATION_CONSISTENCY = 'location_consistency',
  BEHAVIOR_CONSISTENCY = 'behavior_consistency',
  HARDWARE_REPUTATION = 'hardware_reputation',
  NETWORK_REPUTATION = 'network_reputation'
}

export interface DeviceFraudPattern {
  name: string;
  description: string;
  indicators: DeviceFraudIndicator[];
  riskScore: number;
  enabled: boolean;
}

export interface DeviceFraudIndicator {
  type: DeviceFraudIndicatorType;
  threshold: number;
  weight: number;
}

export enum DeviceFraudIndicatorType {
  RAPID_ACTIVATIONS = 'rapid_activations',
  SHARED_HARDWARE_ID = 'shared_hardware_id',
  VM_DETECTION = 'vm_detection',
  EMULATOR_DETECTION = 'emulator_detection',
  SUSPICIOUS_LOCATION = 'suspicious_location',
  KNOWN_BAD_IP = 'known_bad_ip'
}

export interface SubscriptionFraudDetection {
  enabled: boolean;
  paymentFraud: PaymentFraudDetection;
  accountFraud: AccountFraudDetection;
  usageFraud: UsageFraudDetection;
  chargebackPrevention: ChargebackPreventionSettings;
}

export interface PaymentFraudDetection {
  enabled: boolean;
  riskScore: PaymentRiskConfiguration;
  blockedCountries: string[];
  blockedBins: string[]; // Bank Identification Numbers
  velocityChecks: VelocityCheckSettings;
}

export interface PaymentRiskConfiguration {
  enabled: boolean;
  threshold: number;
  factors: PaymentRiskFactor[];
  externalProviders: ExternalRiskProvider[];
}

export interface PaymentRiskFactor {
  name: string;
  type: PaymentRiskType;
  weight: number;
  enabled: boolean;
}

export enum PaymentRiskType {
  CARD_TYPE = 'card_type',
  ISSUER_COUNTRY = 'issuer_country',
  BIN_REPUTATION = 'bin_reputation',
  EMAIL_REPUTATION = 'email_reputation',
  IP_REPUTATION = 'ip_reputation',
  VELOCITY = 'velocity',
  CHARGEBACK_HISTORY = 'chargeback_history'
}

export interface ExternalRiskProvider {
  name: string;
  provider: RiskProviderType;
  configuration: Record<string, unknown>;
  weight: number;
  enabled: boolean;
}

export enum RiskProviderType {
  MAXMIND = 'maxmind',
  SIFT = 'sift',
  KOUNT = 'kount',
  RISKIFIED = 'riskified'
}

export interface VelocityCheckSettings {
  enabled: boolean;
  maxTransactionsPerHour: number;
  maxTransactionsPerDay: number;
  maxAmountPerHour: number;
  maxAmountPerDay: number;
  uniqueCardLimit: number;
}

export interface AccountFraudDetection {
  enabled: boolean;
  duplicateDetection: DuplicateDetectionSettings;
  fakeAccountDetection: FakeAccountDetectionSettings;
  abusePatterns: AccountAbusePattern[];
}

export interface DuplicateDetectionSettings {
  enabled: boolean;
  matchThreshold: number;
  factors: DuplicateDetectionFactor[];
}

export interface DuplicateDetectionFactor {
  type: DuplicateFactorType;
  weight: number;
  fuzzyMatch: boolean;
  enabled: boolean;
}

export enum DuplicateFactorType {
  EMAIL = 'email',
  PHONE = 'phone',
  NAME = 'name',
  ADDRESS = 'address',
  DEVICE_ID = 'device_id',
  HARDWARE_FINGERPRINT = 'hardware_fingerprint',
  PAYMENT_METHOD = 'payment_method'
}

export interface FakeAccountDetectionSettings {
  enabled: boolean;
  emailVerification: EmailVerificationSettings;
  phoneVerification: PhoneVerificationSettings;
  socialVerification: SocialVerificationSettings;
  behaviorAnalysis: BehaviorAnalysisSettings;
}

export interface EmailVerificationSettings {
  enabled: boolean;
  disposableEmailBlocking: boolean;
  domainReputation: boolean;
  mxValidation: boolean;
  roleAccountBlocking: boolean;
}

export interface PhoneVerificationSettings {
  enabled: boolean;
  smsVerification: boolean;
  voipBlocking: boolean;
  lineTypeValidation: boolean;
  carrierValidation: boolean;
}

export interface SocialVerificationSettings {
  enabled: boolean;
  linkedinVerification: boolean;
  facebookVerification: boolean;
  githubVerification: boolean;
  minimumSocialScore: number;
}

export interface BehaviorAnalysisSettings {
  enabled: boolean;
  mouseMovementAnalysis: boolean;
  typingPatternAnalysis: boolean;
  sessionBehaviorAnalysis: boolean;
  deviceBehaviorAnalysis: boolean;
  minimumBehaviorScore: number;
}

export interface AccountAbusePattern {
  name: string;
  description: string;
  indicators: AccountAbuseIndicator[];
  severity: AbuseSeverity;
  enabled: boolean;
}

export interface AccountAbuseIndicator {
  type: AccountAbuseType;
  threshold: number;
  timeWindow: number; // hours
  weight: number;
}

export enum AccountAbuseType {
  RAPID_REGISTRATION = 'rapid_registration',
  BULK_OPERATIONS = 'bulk_operations',
  UNUSUAL_ACTIVITY = 'unusual_activity',
  POLICY_VIOLATIONS = 'policy_violations',
  SPAM_BEHAVIOR = 'spam_behavior',
  RESOURCE_ABUSE = 'resource_abuse'
}

export enum AbuseSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface UsageFraudDetection {
  enabled: boolean;
  overageDetection: OverageDetectionSettings;
  featureAbuse: FeatureAbuseDetection;
  resourceAbuse: ResourceAbuseDetection;
}

export interface OverageDetectionSettings {
  enabled: boolean;
  thresholdMultiplier: number; // e.g., 2.0 = 200% of limit
  alertThreshold: number;
  suspensionThreshold: number;
  gracePeriodHours: number;
}

export interface FeatureAbuseDetection {
  enabled: boolean;
  patterns: FeatureAbusePattern[];
  rateLimiting: FeatureRateLimiting;
}

export interface FeatureAbusePattern {
  featureName: string;
  maxUsagePerHour: number;
  maxUsagePerDay: number;
  suspiciousPatterns: string[];
  enabled: boolean;
}

export interface FeatureRateLimiting {
  enabled: boolean;
  globalLimits: Record<string, number>;
  userLimits: Record<string, number>;
  burstLimits: Record<string, number>;
}

export interface ResourceAbuseDetection {
  enabled: boolean;
  cpuUsageThreshold: number; // percentage
  memoryUsageThreshold: number; // MB
  diskUsageThreshold: number; // MB
  networkUsageThreshold: number; // MB/min
  concurrentConnectionsThreshold: number;
}

export interface ChargebackPreventionSettings {
  enabled: boolean;
  riskScoring: boolean;
  preventiveActions: ChargebackPreventiveAction[];
  disputeManagement: boolean;
  representmentAutomation: boolean;
}

export interface ChargebackPreventiveAction {
  triggerScore: number;
  action: PreventiveActionType;
  parameters: Record<string, unknown>;
  enabled: boolean;
}

export enum PreventiveActionType {
  REQUIRE_ADDITIONAL_AUTH = 'require_additional_auth',
  DELAY_FULFILLMENT = 'delay_fulfillment',
  MANUAL_REVIEW = 'manual_review',
  BLOCK_TRANSACTION = 'block_transaction',
  REQUEST_DOCUMENTATION = 'request_documentation'
}

export interface AbuseDetectionRule {
  id: string;
  name: string;
  description: string;
  type: AbuseRuleType;
  conditions: AbuseRuleCondition[];
  actions: AbuseRuleAction[];
  severity: AbuseSeverity;
  confidence: DetectionConfidence;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
}

export enum AbuseRuleType {
  LICENSE_SHARING = 'license_sharing',
  USAGE_ANOMALY = 'usage_anomaly',
  DEVICE_FRAUD = 'device_fraud',
  PAYMENT_FRAUD = 'payment_fraud',
  ACCOUNT_FRAUD = 'account_fraud',
  SUBSCRIPTION_ABUSE = 'subscription_abuse',
  RESOURCE_ABUSE = 'resource_abuse'
}

export interface AbuseRuleCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
  weight: number;
}

export enum RuleOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  IN = 'in',
  NOT_IN = 'not_in',
  REGEX = 'regex',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists'
}

export interface AbuseRuleAction {
  type: AbuseActionType;
  parameters: Record<string, unknown>;
  delaySeconds?: number;
  condition?: string; // JavaScript condition
}

export enum AbuseActionType {
  LOG_EVENT = 'log_event',
  SEND_ALERT = 'send_alert',
  SUSPEND_ACCOUNT = 'suspend_account',
  REVOKE_LICENSE = 'revoke_license',
  LIMIT_FEATURES = 'limit_features',
  REQUIRE_VERIFICATION = 'require_verification',
  BLOCK_IP = 'block_ip',
  TERMINATE_SESSIONS = 'terminate_sessions',
  ESCALATE_TO_ADMIN = 'escalate_to_admin',
  TRIGGER_MANUAL_REVIEW = 'trigger_manual_review'
}

export interface AbuseAlert {
  id: string;
  ruleId: string;
  userId?: string;
  accountId?: string;
  licenseId?: string;
  deviceId?: string;
  type: AbuseRuleType;
  severity: AbuseSeverity;
  confidence: DetectionConfidence;
  title: string;
  description: string;
  evidence: AbuseEvidence[];
  status: AlertStatus;
  assignedTo?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: AlertResolution;
  metadata: Record<string, unknown>;
}

export enum AlertStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated'
}

export interface AbuseEvidence {
  type: EvidenceType;
  data: unknown;
  timestamp: Date;
  source: string;
  confidence: number;
}

export enum EvidenceType {
  USAGE_DATA = 'usage_data',
  DEVICE_DATA = 'device_data',
  LOCATION_DATA = 'location_data',
  BEHAVIOR_DATA = 'behavior_data',
  PAYMENT_DATA = 'payment_data',
  NETWORK_DATA = 'network_data',
  LOG_DATA = 'log_data'
}

export interface AlertResolution {
  action: ResolutionAction;
  reason: string;
  resolvedBy: string;
  evidence?: string;
  followUpRequired: boolean;
}

export enum ResolutionAction {
  NO_ACTION = 'no_action',
  WARNING_ISSUED = 'warning_issued',
  ACCOUNT_SUSPENDED = 'account_suspended',
  LICENSE_REVOKED = 'license_revoked',
  FEATURES_LIMITED = 'features_limited',
  MANUAL_REVIEW = 'manual_review',
  FALSE_POSITIVE = 'false_positive'
}

export interface AbuseAnalytics {
  detectionRate: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  averageResponseTime: number; // minutes
  topAbuseTypes: AbuseTypeStats[];
  trendData: AbuseTrendData[];
  riskDistribution: RiskDistribution;
  lastUpdated: Date;
}

export interface AbuseTypeStats {
  type: AbuseRuleType;
  count: number;
  percentage: number;
  averageSeverity: number;
  resolved: number;
  pending: number;
}

export interface AbuseTrendData {
  period: Date;
  detections: number;
  falsePositives: number;
  averageConfidence: number;
  topRules: string[];
}

export interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

// Device Management and Hardware Binding Extensions
export interface DeviceRegistry {
  id: string;
  accountId: string;
  devices: RegisteredDevice[];
  settings: DeviceRegistrySettings;
  policies: DevicePolicy[];
  trustScores: DeviceTrustScore[];
  lastUpdated: Date;
}

export interface RegisteredDevice {
  id: string;
  userId: string;
  deviceId: string;
  hardwareFingerprint: HardwareFingerprint;
  deviceInfo: DeviceInfo;
  registrationInfo: DeviceRegistrationInfo;
  status: DeviceStatus;
  trustScore: number;
  riskScore: number;
  usage: DeviceUsage;
  compliance: DeviceCompliance;
  security: DeviceSecurityInfo;
  lastSeen: Date;
  createdAt: Date;
}

export interface DeviceInfo {
  name: string;
  type: DeviceType;
  os: OperatingSystemInfo;
  hardware: HardwareInfo;
  network: DeviceNetworkInfo;
  location: DeviceLocation;
  userAgent?: string;
}

export enum DeviceType {
  DESKTOP = 'desktop',
  LAPTOP = 'laptop',
  TABLET = 'tablet',
  MOBILE = 'mobile',
  SERVER = 'server',
  VIRTUAL_MACHINE = 'virtual_machine',
  CONTAINER = 'container',
  UNKNOWN = 'unknown'
}

export interface OperatingSystemInfo {
  platform: Platform;
  name: string;
  version: string;
  build?: string;
  architecture: string;
  kernel?: string;
}

export enum Platform {
  WINDOWS = 'windows',
  MACOS = 'macos',
  LINUX = 'linux',
  IOS = 'ios',
  ANDROID = 'android',
  UNKNOWN = 'unknown'
}

export interface HardwareInfo {
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  uuid?: string;
  processorId?: string;
  motherboardId?: string;
  diskId?: string;
  networkMac?: string;
  totalMemory?: number;
  cpuCores?: number;
  isVirtual: boolean;
  vmType?: string;
}

export interface DeviceNetworkInfo {
  ipAddress: string;
  macAddress?: string;
  networkName?: string;
  connectionType: ConnectionType;
  isVPN: boolean;
  isProxy: boolean;
  isp?: string;
  asn?: string;
  country?: string;
  region?: string;
  city?: string;
}

export enum ConnectionType {
  ETHERNET = 'ethernet',
  WIFI = 'wifi',
  CELLULAR = 'cellular',
  VPN = 'vpn',
  PROXY = 'proxy',
  UNKNOWN = 'unknown'
}

export interface DeviceLocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  lastUpdated: Date;
}

export interface DeviceRegistrationInfo {
  method: RegistrationMethod;
  registeredBy: string;
  registeredAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
}

export enum RegistrationMethod {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  ADMIN_APPROVED = 'admin_approved',
  SELF_SERVICE = 'self_service',
  BULK_IMPORT = 'bulk_import'
}

export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PENDING_APPROVAL = 'pending_approval',
  SUSPENDED = 'suspended',
  BLOCKED = 'blocked',
  COMPROMISED = 'compromised',
  DEAUTHORIZED = 'deauthorized'
}

export interface DeviceUsage {
  totalSessions: number;
  totalHours: number;
  lastSession: DeviceSession;
  recentSessions: DeviceSession[];
  features: DeviceFeatureUsage[];
  patterns: DeviceUsagePattern[];
}

export interface DeviceSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // seconds
  features: string[];
  location: DeviceLocation;
  ipAddress: string;
  activities: SessionActivity[];
  ended: boolean;
  endReason?: SessionEndReason;
}

export interface SessionActivity {
  timestamp: Date;
  type: ActivityType;
  feature?: string;
  details: Record<string, unknown>;
}

export enum ActivityType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  FEATURE_ACCESS = 'feature_access',
  API_CALL = 'api_call',
  DATA_ACCESS = 'data_access',
  SETTING_CHANGE = 'setting_change',
  FILE_OPERATION = 'file_operation',
  NETWORK_REQUEST = 'network_request'
}

export enum SessionEndReason {
  USER_LOGOUT = 'user_logout',
  TIMEOUT = 'timeout',
  ADMIN_TERMINATION = 'admin_termination',
  SECURITY_VIOLATION = 'security_violation',
  DEVICE_DEAUTHORIZED = 'device_deauthorized',
  LICENSE_EXPIRED = 'license_expired',
  SYSTEM_SHUTDOWN = 'system_shutdown'
}

export interface DeviceFeatureUsage {
  feature: string;
  usageCount: number;
  totalTime: number; // seconds
  lastUsed: Date;
  averageSessionTime: number;
}

export interface DeviceUsagePattern {
  type: UsagePatternType;
  pattern: string;
  frequency: number;
  confidence: number;
  lastDetected: Date;
}

export interface DeviceCompliance {
  status: ComplianceStatus;
  checks: ComplianceCheck[];
  violations: ComplianceViolation[];
  lastEvaluation: Date;
  nextEvaluation: Date;
}

export enum ComplianceStatus {
  COMPLIANT = 'compliant',
  NON_COMPLIANT = 'non_compliant',
  PARTIALLY_COMPLIANT = 'partially_compliant',
  UNKNOWN = 'unknown',
  EXEMPT = 'exempt'
}

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  type: ComplianceCheckType;
  status: ComplianceCheckStatus;
  result: unknown;
  lastChecked: Date;
  nextCheck: Date;
  mandatory: boolean;
}

export enum ComplianceCheckType {
  OS_VERSION = 'os_version',
  ANTIVIRUS = 'antivirus',
  FIREWALL = 'firewall',
  ENCRYPTION = 'encryption',
  PATCH_LEVEL = 'patch_level',
  CONFIGURATION = 'configuration',
  CERTIFICATE = 'certificate',
  POLICY = 'policy'
}

export enum ComplianceCheckStatus {
  PASS = 'pass',
  FAIL = 'fail',
  WARNING = 'warning',
  NOT_APPLICABLE = 'not_applicable',
  ERROR = 'error'
}

export interface ComplianceViolation {
  checkId: string;
  severity: ViolationSeverity;
  description: string;
  remediation: string;
  detectedAt: Date;
  resolvedAt?: Date;
  waived: boolean;
  waivedBy?: string;
  waivedReason?: string;
}

export enum ViolationSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface DeviceSecurityInfo {
  isJailbroken: boolean;
  isRooted: boolean;
  hasDebugger: boolean;
  hasEmulator: boolean;
  hasVirtualMachine: boolean;
  hasKeylogger: boolean;
  hasRemoteAccess: boolean;
  securitySoftware: SecuritySoftware[];
  threats: SecurityThreat[];
  lastSecurityScan: Date;
}

export interface SecuritySoftware {
  name: string;
  type: SecuritySoftwareType;
  version: string;
  enabled: boolean;
  upToDate: boolean;
  lastUpdated: Date;
}

export enum SecuritySoftwareType {
  ANTIVIRUS = 'antivirus',
  FIREWALL = 'firewall',
  ANTI_MALWARE = 'anti_malware',
  ENDPOINT_PROTECTION = 'endpoint_protection',
  MDM = 'mdm',
  DLP = 'dlp'
}

export interface SecurityThreat {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  description: string;
  detectedAt: Date;
  resolvedAt?: Date;
  status: ThreatStatus;
  source: string;
  details: Record<string, unknown>;
}

export enum ThreatType {
  MALWARE = 'malware',
  VIRUS = 'virus',
  TROJAN = 'trojan',
  KEYLOGGER = 'keylogger',
  ROOTKIT = 'rootkit',
  SPYWARE = 'spyware',
  ADWARE = 'adware',
  POTENTIALLY_UNWANTED = 'potentially_unwanted',
  SUSPICIOUS_BEHAVIOR = 'suspicious_behavior',
  POLICY_VIOLATION = 'policy_violation'
}

export enum ThreatSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ThreatStatus {
  ACTIVE = 'active',
  QUARANTINED = 'quarantined',
  REMOVED = 'removed',
  IGNORED = 'ignored',
  FALSE_POSITIVE = 'false_positive'
}

export interface DeviceRegistrySettings {
  autoRegistration: boolean;
  requireApproval: boolean;
  maxDevicesPerUser: number;
  deviceRetentionDays: number;
  trustScoreThreshold: number;
  riskScoreThreshold: number;
  complianceRequired: boolean;
  securityScanRequired: boolean;
}

export interface DevicePolicy {
  id: string;
  name: string;
  description: string;
  type: DevicePolicyType;
  scope: PolicyScope;
  rules: PolicyRule[];
  enforcement: PolicyEnforcement;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum DevicePolicyType {
  COMPLIANCE = 'compliance',
  SECURITY = 'security',
  ACCESS_CONTROL = 'access_control',
  USAGE = 'usage',
  CONFIGURATION = 'configuration'
}

export interface PolicyScope {
  users: string[];
  groups: string[];
  deviceTypes: DeviceType[];
  platforms: Platform[];
  locations: string[];
}

export interface PolicyRule {
  id: string;
  name: string;
  condition: PolicyCondition;
  action: PolicyAction;
  enabled: boolean;
}

export interface PolicyCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
  logicalOperator?: 'AND' | 'OR';
}

export interface PolicyAction {
  type: PolicyActionType;
  parameters: Record<string, unknown>;
  notification?: NotificationSettings;
}

export enum PolicyActionType {
  ALLOW = 'allow',
  DENY = 'deny',
  WARN = 'warn',
  QUARANTINE = 'quarantine',
  WIPE = 'wipe',
  LOCK = 'lock',
  REQUIRE_AUTH = 'require_auth',
  LIMIT_FEATURES = 'limit_features',
  LOG_ONLY = 'log_only'
}

export interface PolicyEnforcement {
  mode: EnforcementMode;
  gracePeriod: number; // hours
  escalation: EscalationSettings;
  exceptions: PolicyException[];
}

export enum EnforcementMode {
  DISABLED = 'disabled',
  MONITOR = 'monitor',
  WARN = 'warn',
  ENFORCE = 'enforce',
  BLOCK = 'block'
}

export interface EscalationSettings {
  enabled: boolean;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  level: number;
  delayHours: number;
  action: PolicyActionType;
  notifyAdmins: boolean;
}

export interface PolicyException {
  id: string;
  userId?: string;
  deviceId?: string;
  reason: string;
  expiresAt?: Date;
  approvedBy: string;
  approvedAt: Date;
}

export interface DeviceTrustScore {
  deviceId: string;
  score: number;
  factors: TrustScoreFactor[];
  history: TrustScoreHistory[];
  lastUpdated: Date;
}

export interface TrustScoreFactor {
  factor: TrustFactorType;
  score: number;
  weight: number;
  lastUpdated: Date;
  details: Record<string, unknown>;
}

export interface TrustScoreHistory {
  timestamp: Date;
  score: number;
  change: number;
  reason: string;
  triggeredBy: string;
}

// Notification and Integration Types
export interface NotificationSettings {
  enabled: boolean;
  channels: NotificationChannel[];
  recipients: NotificationRecipient[];
  conditions: NotificationCondition[];
  rateLimit: NotificationRateLimit;
}

export interface NotificationChannel {
  type: NotificationChannelType;
  configuration: Record<string, unknown>;
  enabled: boolean;
  priority: number;
}

export enum NotificationChannelType {
  EMAIL = 'email',
  SMS = 'sms',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  PUSH = 'push',
  IN_APP = 'in_app',
  TEAMS = 'teams',
  DISCORD = 'discord'
}

export interface NotificationRecipient {
  id: string;
  type: RecipientType;
  address: string;
  channels: NotificationChannelType[];
  severity: EventSeverity[];
  enabled: boolean;
}

export enum RecipientType {
  USER = 'user',
  ADMIN = 'admin',
  GROUP = 'group',
  EXTERNAL = 'external'
}

export interface NotificationCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface NotificationRateLimit {
  enabled: boolean;
  maxPerHour: number;
  maxPerDay: number;
  cooldownMinutes: number;
}

export interface IntegrationSettings {
  siem: SIEMIntegration;
  ticketing: TicketingIntegration;
  mdm: MDMIntegration;
  identity: IdentityIntegration;
  analytics: AnalyticsIntegration;
  webhooks: WebhookIntegration[];
}

export interface SIEMIntegration {
  enabled: boolean;
  provider: SIEMProvider;
  configuration: Record<string, unknown>;
  eventTypes: ProtectionEventType[];
  batchSize: number;
  flushInterval: number; // seconds
}

export enum SIEMProvider {
  SPLUNK = 'splunk',
  ELK = 'elk',
  QRADAR = 'qradar',
  ARCSIGHT = 'arcsight',
  SENTINEL = 'sentinel',
  SUMO_LOGIC = 'sumo_logic'
}

export interface TicketingIntegration {
  enabled: boolean;
  provider: TicketingProvider;
  configuration: Record<string, unknown>;
  autoCreateTickets: boolean;
  severityMapping: Record<AbuseSeverity, string>;
  assignmentRules: TicketAssignmentRule[];
}

export enum TicketingProvider {
  JIRA = 'jira',
  SERVICE_NOW = 'service_now',
  ZENDESK = 'zendesk',
  FRESHDESK = 'freshdesk',
  LINEAR = 'linear'
}

export interface TicketAssignmentRule {
  condition: NotificationCondition[];
  assignee: string;
  priority: string;
  labels: string[];
}

export interface MDMIntegration {
  enabled: boolean;
  provider: MDMProvider;
  configuration: Record<string, unknown>;
  syncDevices: boolean;
  enforcePolicies: boolean;
  complianceReporting: boolean;
}

export enum MDMProvider {
  INTUNE = 'intune',
  JAMF = 'jamf',
  WORKSPACE_ONE = 'workspace_one',
  KANDJI = 'kandji',
  MOSYLE = 'mosyle'
}

export interface IdentityIntegration {
  enabled: boolean;
  provider: IdentityProvider;
  configuration: Record<string, unknown>;
  syncUsers: boolean;
  syncGroups: boolean;
  attributeMapping: Record<string, string>;
}

export enum IdentityProvider {
  AZURE_AD = 'azure_ad',
  OKTA = 'okta',
  PING_IDENTITY = 'ping_identity',
  AUTH0 = 'auth0',
  ONELOGIN = 'onelogin'
}

export interface AnalyticsIntegration {
  enabled: boolean;
  provider: AnalyticsProvider;
  configuration: Record<string, unknown>;
  trackEvents: ProtectionEventType[];
  customDimensions: Record<string, string>;
}

export enum AnalyticsProvider {
  GOOGLE_ANALYTICS = 'google_analytics',
  MIXPANEL = 'mixpanel',
  AMPLITUDE = 'amplitude',
  SEGMENT = 'segment',
  CUSTOM = 'custom'
}

export interface WebhookIntegration {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  eventTypes: ProtectionEventType[];
  retryPolicy: WebhookRetryPolicy;
  enabled: boolean;
}

export interface WebhookRetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffSeconds: number;
  retryOnStatuses: number[];
}

// Additional Configuration Types
export interface ComplianceSettings {
  enabled: boolean;
  framework: ComplianceFramework[];
  reporting: ComplianceReporting;
  auditing: ComplianceAuditing;
  retention: DataRetentionSettings;
  privacy: PrivacySettings;
}

export enum ComplianceFramework {
  SOC2 = 'soc2',
  ISO27001 = 'iso27001',
  GDPR = 'gdpr',
  CCPA = 'ccpa',
  HIPAA = 'hipaa',
  PCI_DSS = 'pci_dss',
  NIST = 'nist',
  FedRAMP = 'fedramp'
}

export interface ComplianceReporting {
  enabled: boolean;
  frequency: ReportingFrequency;
  recipients: string[];
  includeDetails: boolean;
  automaticGeneration: boolean;
  customReports: CustomReport[];
}

export enum ReportingFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually'
}

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  query: string;
  schedule: ReportSchedule;
  format: ReportFormat;
  recipients: string[];
  enabled: boolean;
}

export interface ReportSchedule {
  frequency: ReportingFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  hour: number;
  timezone: string;
}

export enum ReportFormat {
  PDF = 'pdf',
  CSV = 'csv',
  JSON = 'json',
  XML = 'xml',
  HTML = 'html'
}

export interface ComplianceAuditing {
  enabled: boolean;
  auditTrail: AuditTrailSettings;
  dataClassification: DataClassificationSettings;
  accessLogging: AccessLoggingSettings;
  changeTracking: ChangeTrackingSettings;
}

export interface AuditTrailSettings {
  enabled: boolean;
  retentionDays: number;
  immutableStorage: boolean;
  encryption: boolean;
  digitalSignature: boolean;
  realTimeMonitoring: boolean;
}

export interface DataClassificationSettings {
  enabled: boolean;
  categories: DataCategory[];
  autoClassification: boolean;
  labelingRequired: boolean;
  accessControls: boolean;
}

export interface DataCategory {
  id: string;
  name: string;
  description: string;
  sensitivity: DataSensitivity;
  retention: number; // days
  encryption: boolean;
  accessRestrictions: string[];
}

export enum DataSensitivity {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  TOP_SECRET = 'top_secret'
}

export interface AccessLoggingSettings {
  enabled: boolean;
  logSuccessfulAccess: boolean;
  logFailedAccess: boolean;
  logPrivilegedAccess: boolean;
  logDataAccess: boolean;
  logConfigChanges: boolean;
  realTimeAlerts: boolean;
}

export interface ChangeTrackingSettings {
  enabled: boolean;
  trackConfigChanges: boolean;
  trackPolicyChanges: boolean;
  trackUserChanges: boolean;
  trackPermissionChanges: boolean;
  approvalRequired: boolean;
  rollbackCapability: boolean;
}

export interface DataRetentionSettings {
  enabled: boolean;
  policies: RetentionPolicy[];
  automaticPurging: boolean;
  legalHolds: LegalHold[];
  archiving: ArchivingSettings;
}

export interface RetentionPolicy {
  id: string;
  name: string;
  dataType: DataType;
  retentionPeriod: number; // days
  action: RetentionAction;
  conditions: RetentionCondition[];
  enabled: boolean;
}

export enum DataType {
  USER_DATA = 'user_data',
  AUDIT_LOGS = 'audit_logs',
  LICENSE_DATA = 'license_data',
  DEVICE_DATA = 'device_data',
  USAGE_DATA = 'usage_data',
  SECURITY_LOGS = 'security_logs',
  BILLING_DATA = 'billing_data'
}

export enum RetentionAction {
  DELETE = 'delete',
  ARCHIVE = 'archive',
  ANONYMIZE = 'anonymize',
  ENCRYPT = 'encrypt'
}

export interface RetentionCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface LegalHold {
  id: string;
  name: string;
  description: string;
  dataTypes: DataType[];
  startDate: Date;
  endDate?: Date;
  custodians: string[];
  status: LegalHoldStatus;
}

export enum LegalHoldStatus {
  ACTIVE = 'active',
  RELEASED = 'released',
  PENDING = 'pending',
  EXPIRED = 'expired'
}

export interface ArchivingSettings {
  enabled: boolean;
  provider: ArchivingProvider;
  configuration: Record<string, unknown>;
  compression: boolean;
  encryption: boolean;
  indexing: boolean;
  searchCapability: boolean;
}

export enum ArchivingProvider {
  AWS_S3 = 'aws_s3',
  AZURE_BLOB = 'azure_blob',
  GOOGLE_CLOUD = 'google_cloud',
  LOCAL_STORAGE = 'local_storage',
  NETWORK_STORAGE = 'network_storage'
}

export interface PrivacySettings {
  enabled: boolean;
  dataMinimization: boolean;
  consentManagement: ConsentManagementSettings;
  rightToErasure: boolean;
  dataPortability: boolean;
  privacyByDesign: boolean;
  impactAssessments: boolean;
}

export interface ConsentManagementSettings {
  enabled: boolean;
  granularConsent: boolean;
  consentWithdrawal: boolean;
  consentLogging: boolean;
  consentExpiration: number; // days
  renewalReminders: boolean;
}

export interface BrandingSettings {
  enabled: boolean;
  logo: string;
  colors: BrandColors;
  fonts: BrandFonts;
  customCSS: string;
  whiteLabeling: boolean;
  customDomain: string;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  error: string;
  warning: string;
  success: string;
}

export interface BrandFonts {
  primary: string;
  secondary: string;
  monospace: string;
}

export interface EnterpriseBilling {
  accountId: string;
  billingContact: BillingContact;
  paymentMethod: EnterprisePaymentMethod;
  invoicing: InvoicingSettings;
  usage: EnterpriseUsageTracking;
  costCenter: CostCenter[];
  budgets: Budget[];
}

export interface BillingContact {
  name: string;
  email: string;
  phone?: string;
  address: BillingAddress;
  taxId?: string;
  purchaseOrderRequired: boolean;
}

export interface BillingAddress {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface EnterprisePaymentMethod {
  type: EnterprisePaymentType;
  details: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
}

export enum EnterprisePaymentType {
  INVOICE = 'invoice',
  ACH = 'ach',
  WIRE = 'wire',
  CREDIT_CARD = 'credit_card',
  PURCHASE_ORDER = 'purchase_order'
}

export interface InvoicingSettings {
  frequency: BillingCycle;
  terms: InvoiceTerms;
  format: InvoiceFormat;
  delivery: InvoiceDelivery;
  customFields: CustomInvoiceField[];
}

export enum InvoiceTerms {
  NET_15 = 'net_15',
  NET_30 = 'net_30',
  NET_45 = 'net_45',
  NET_60 = 'net_60',
  NET_90 = 'net_90',
  DUE_ON_RECEIPT = 'due_on_receipt'
}

export enum InvoiceFormat {
  PDF = 'pdf',
  HTML = 'html',
  XML = 'xml'
}

export interface InvoiceDelivery {
  method: DeliveryMethod;
  recipients: string[];
  ccRecipients?: string[];
  bccRecipients?: string[];
}

export enum DeliveryMethod {
  EMAIL = 'email',
  PORTAL = 'portal',
  API = 'api',
  MAIL = 'mail'
}

export interface CustomInvoiceField {
  name: string;
  value: string;
  required: boolean;
  position: FieldPosition;
}

export enum FieldPosition {
  HEADER = 'header',
  LINE_ITEM = 'line_item',
  FOOTER = 'footer'
}

export interface EnterpriseUsageTracking {
  enabled: boolean;
  granularity: UsageGranularity;
  metrics: UsageMetric[];
  reporting: UsageReporting;
  alerts: UsageAlert[];
}

export enum UsageGranularity {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly'
}

export interface UsageMetric {
  name: string;
  type: MetricType;
  unit: string;
  aggregation: AggregationType;
  filters: MetricFilter[];
  enabled: boolean;
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

export enum AggregationType {
  SUM = 'sum',
  AVERAGE = 'average',
  COUNT = 'count',
  MAX = 'max',
  MIN = 'min',
  PERCENTILE = 'percentile'
}

export interface MetricFilter {
  field: string;
  operator: RuleOperator;
  value: unknown;
}

export interface UsageReporting {
  enabled: boolean;
  frequency: ReportingFrequency;
  recipients: string[];
  includeCosts: boolean;
  includeForecasts: boolean;
  customReports: UsageReport[];
}

export interface UsageReport {
  id: string;
  name: string;
  metrics: string[];
  dimensions: string[];
  filters: MetricFilter[];
  schedule: ReportSchedule;
  enabled: boolean;
}

export interface UsageAlert {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  operator: RuleOperator;
  window: number; // minutes
  notifications: NotificationSettings;
  enabled: boolean;
}

export interface CostCenter {
  id: string;
  name: string;
  description?: string;
  owner: string;
  budget?: number;
  users: string[];
  allocations: CostAllocation[];
}

export interface CostAllocation {
  type: AllocationType;
  percentage?: number;
  amount?: number;
  formula?: string;
}

export enum AllocationType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  USAGE_BASED = 'usage_based',
  FORMULA_BASED = 'formula_based'
}

export interface Budget {
  id: string;
  name: string;
  type: BudgetType;
  amount: number;
  period: BudgetPeriod;
  costCenters: string[];
  alerts: BudgetAlert[];
  enabled: boolean;
}

export enum BudgetType {
  FIXED = 'fixed',
  USAGE_BASED = 'usage_based',
  ROLLING = 'rolling'
}

export interface BudgetPeriod {
  type: BudgetPeriodType;
  startDate: Date;
  endDate: Date;
}

export enum BudgetPeriodType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

export interface BudgetAlert {
  threshold: number; // percentage
  type: BudgetAlertType;
  recipients: string[];
  enabled: boolean;
}

export enum BudgetAlertType {
  WARNING = 'warning',
  CRITICAL = 'critical',
  EXCEEDED = 'exceeded'
}

export interface AuditConfiguration {
  enabled: boolean;
  retention: number; // days
  events: AuditEventType[];
  storage: AuditStorageSettings;
  reporting: AuditReportingSettings;
  compliance: AuditComplianceSettings;
}

export enum AuditEventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  LICENSE_VALIDATION = 'license_validation',
  PERMISSION_CHANGE = 'permission_change',
  POLICY_CHANGE = 'policy_change',
  DEVICE_REGISTRATION = 'device_registration',
  DEVICE_DEAUTHORIZATION = 'device_deauthorization',
  SEAT_ASSIGNMENT = 'seat_assignment',
  SEAT_REMOVAL = 'seat_removal',
  SUBSCRIPTION_CHANGE = 'subscription_change',
  SECURITY_VIOLATION = 'security_violation',
  ADMIN_ACTION = 'admin_action',
  COMPLIANCE_CHECK = 'compliance_check',
  DATA_ACCESS = 'data_access',
  CONFIGURATION_CHANGE = 'configuration_change'
}

export interface AuditStorageSettings {
  location: StorageLocation;
  encryption: boolean;
  compression: boolean;
  integrity: IntegritySettings;
  backup: BackupSettings;
}

export enum StorageLocation {
  LOCAL = 'local',
  CLOUD = 'cloud',
  HYBRID = 'hybrid'
}

export interface IntegritySettings {
  enabled: boolean;
  algorithm: IntegrityAlgorithm;
  verification: VerificationSettings;
}

export enum IntegrityAlgorithm {
  SHA256 = 'sha256',
  SHA512 = 'sha512',
  BLAKE2 = 'blake2'
}

export interface VerificationSettings {
  frequency: VerificationFrequency;
  alertOnFailure: boolean;
  automaticRepair: boolean;
}

export enum VerificationFrequency {
  CONTINUOUS = 'continuous',
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

export interface BackupSettings {
  enabled: boolean;
  frequency: BackupFrequency;
  retention: number; // days
  offsite: boolean;
  encryption: boolean;
  testing: BackupTestingSettings;
}

export enum BackupFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly'
}

export interface BackupTestingSettings {
  enabled: boolean;
  frequency: TestingFrequency;
  automated: boolean;
  reportResults: boolean;
}

export enum TestingFrequency {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly'
}

export interface AuditReportingSettings {
  enabled: boolean;
  frequency: ReportingFrequency;
  recipients: string[];
  includeRawLogs: boolean;
  customQueries: AuditQuery[];
}

export interface AuditQuery {
  id: string;
  name: string;
  description: string;
  query: string;
  parameters: QueryParameter[];
  schedule: ReportSchedule;
  enabled: boolean;
}

export interface QueryParameter {
  name: string;
  type: ParameterType;
  defaultValue?: unknown;
  required: boolean;
}

export enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  ARRAY = 'array'
}

export interface AuditComplianceSettings {
  frameworks: ComplianceFramework[];
  mapping: ComplianceMapping[];
  attestation: AttestationSettings;
  certification: CertificationSettings;
}

export interface ComplianceMapping {
  framework: ComplianceFramework;
  control: string;
  auditEvents: AuditEventType[];
  requirements: ComplianceRequirement[];
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  mandatory: boolean;
  evidence: EvidenceRequirement[];
}

export interface EvidenceRequirement {
  type: EvidenceType;
  frequency: EvidenceFrequency;
  retention: number; // days
  format: EvidenceFormat;
}

export enum EvidenceFrequency {
  CONTINUOUS = 'continuous',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUALLY = 'annually'
}

export enum EvidenceFormat {
  LOG = 'log',
  REPORT = 'report',
  SCREENSHOT = 'screenshot',
  DOCUMENT = 'document',
  CERTIFICATE = 'certificate'
}

export interface AttestationSettings {
  enabled: boolean;
  frequency: AttestationFrequency;
  attestors: Attestor[];
  requirements: AttestationRequirement[];
}

export enum AttestationFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi_annually',
  ANNUALLY = 'annually'
}

export interface Attestor {
  userId: string;
  email: string;
  role: string;
  scope: AttestationScope;
}

export interface AttestationScope {
  frameworks: ComplianceFramework[];
  controls: string[];
  systems: string[];
}

export interface AttestationRequirement {
  id: string;
  description: string;
  framework: ComplianceFramework;
  control: string;
  frequency: AttestationFrequency;
  evidence: boolean;
}

export interface CertificationSettings {
  enabled: boolean;
  certifications: Certification[];
  auditors: ExternalAuditor[];
  evidence: CertificationEvidence;
}

export interface Certification {
  id: string;
  name: string;
  framework: ComplianceFramework;
  status: CertificationStatus;
  issuedDate?: Date;
  expiryDate?: Date;
  auditor?: string;
  scope: string[];
  requirements: CertificationRequirement[];
}

export enum CertificationStatus {
  NOT_CERTIFIED = 'not_certified',
  IN_PROGRESS = 'in_progress',
  CERTIFIED = 'certified',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended'
}

export interface CertificationRequirement {
  id: string;
  description: string;
  status: RequirementStatus;
  evidence: string[];
  dueDate?: Date;
  completedDate?: Date;
  assignee?: string;
}

export enum RequirementStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NOT_APPLICABLE = 'not_applicable',
  WAIVED = 'waived'
}

export interface ExternalAuditor {
  id: string;
  name: string;
  company: string;
  email: string;
  certifications: string[];
  specializations: ComplianceFramework[];
}

export interface CertificationEvidence {
  autoCollection: boolean;
  repository: EvidenceRepository;
  organization: EvidenceOrganization;
  retention: EvidenceRetention;
}

export interface EvidenceRepository {
  type: RepositoryType;
  configuration: Record<string, unknown>;
  encryption: boolean;
  accessControls: RepositoryAccessControl[];
}

export enum RepositoryType {
  LOCAL = 'local',
  CLOUD = 'cloud',
  DATABASE = 'database',
  HYBRID = 'hybrid'
}

export interface RepositoryAccessControl {
  userId: string;
  permissions: RepositoryPermission[];
  restrictions: string[];
}

export enum RepositoryPermission {
  READ = 'read',
  WRITE = 'write',
  DELETE = 'delete',
  ADMIN = 'admin'
}

export interface EvidenceOrganization {
  categories: EvidenceCategory[];
  tagging: EvidenceTagging;
  searchConfiguration: EvidenceSearchConfiguration;
}

export interface EvidenceCategory {
  id: string;
  name: string;
  description: string;
  parent?: string;
  metadata: Record<string, unknown>;
}

export interface EvidenceTagging {
  enabled: boolean;
  autoTagging: boolean;
  predefinedTags: string[];
  customTags: boolean;
}

export interface EvidenceSearchConfiguration {
  enabled: boolean;
  indexing: boolean;
  fullTextSearch: boolean;
  metadataSearch: boolean;
  facetedSearch: boolean;
}

export interface EvidenceRetention {
  policies: EvidenceRetentionPolicy[];
  automaticPurging: boolean;
  archiving: boolean;
}

export interface EvidenceRetentionPolicy {
  id: string;
  name: string;
  evidenceTypes: EvidenceType[];
  retentionPeriod: number; // days
  action: RetentionAction;
  conditions: RetentionCondition[];
}

// Additional Missing Response Types
export interface AbuseResponseActions {
  immediate: ImmediateResponseAction[];
  escalated: EscalatedResponseAction[];
  automated: AutomatedResponseAction[];
  manual: ManualResponseAction[];
}

export interface ImmediateResponseAction {
  type: ImmediateActionType;
  trigger: ResponseTrigger;
  parameters: Record<string, unknown>;
  enabled: boolean;
}

export enum ImmediateActionType {
  BLOCK_REQUEST = 'block_request',
  RATE_LIMIT = 'rate_limit',
  CAPTCHA_CHALLENGE = 'captcha_challenge',
  LOG_ALERT = 'log_alert',
  TEMPORARY_SUSPENSION = 'temporary_suspension'
}

export interface ResponseTrigger {
  confidence: DetectionConfidence;
  severity: AbuseSeverity;
  ruleTypes: AbuseRuleType[];
  conditions: TriggerCondition[];
}

export interface TriggerCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
  weight: number;
}

export interface EscalatedResponseAction {
  type: EscalatedActionType;
  delayMinutes: number;
  conditions: EscalationCondition[];
  approvalRequired: boolean;
  assignees: string[];
}

export enum EscalatedActionType {
  ACCOUNT_REVIEW = 'account_review',
  LICENSE_SUSPENSION = 'license_suspension',
  DEVICE_QUARANTINE = 'device_quarantine',
  MANUAL_INVESTIGATION = 'manual_investigation',
  LEGAL_ESCALATION = 'legal_escalation'
}

export interface EscalationCondition {
  field: string;
  operator: RuleOperator;
  value: unknown;
  timeWindow: number; // minutes
}

export interface AutomatedResponseAction {
  type: AutomatedActionType;
  schedule: ActionSchedule;
  conditions: AutomationCondition[];
  rollbackCapable: boolean;
}

export enum AutomatedActionType {
  PATTERN_ANALYSIS = 'pattern_analysis',
  RISK_ASSESSMENT = 'risk_assessment',
  BEHAVIORAL_UPDATE = 'behavioral_update',
  THRESHOLD_ADJUSTMENT = 'threshold_adjustment',
  WHITELIST_UPDATE = 'whitelist_update'
}

export interface ActionSchedule {
  frequency: ScheduleFrequency;
  time: string; // HH:MM format
  timezone: string;
  enabled: boolean;
}

export enum ScheduleFrequency {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ON_DEMAND = 'on_demand'
}

export interface AutomationCondition {
  metric: string;
  threshold: number;
  comparison: ComparisonType;
  timeWindow: number; // hours
}

export enum ComparisonType {
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EQUALS = 'equals',
  PERCENTAGE_CHANGE = 'percentage_change'
}

export interface ManualResponseAction {
  type: ManualActionType;
  priority: ActionPriority;
  assignee: string;
  dueDate?: Date;
  instructions: string;
  requiredEvidence: string[];
}

export enum ManualActionType {
  USER_INTERVIEW = 'user_interview',
  EVIDENCE_COLLECTION = 'evidence_collection',
  TECHNICAL_ANALYSIS = 'technical_analysis',
  LEGAL_REVIEW = 'legal_review',
  EXECUTIVE_DECISION = 'executive_decision'
}

export enum ActionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Extended Manager Interface Types
export interface IEnterpriseAccountManager extends EventEmitter {
  initialize(): Promise<void>;
  createAccount(account: Partial<EnterpriseAccount>): Promise<EnterpriseAccount>;
  updateAccount(accountId: string, updates: Partial<EnterpriseAccount>): Promise<EnterpriseAccount>;
  getAccount(accountId: string): Promise<EnterpriseAccount | null>;
  suspendAccount(accountId: string, reason: string): Promise<boolean>;
  activateAccount(accountId: string): Promise<boolean>;
  assignAdmin(accountId: string, admin: Partial<EnterpriseAdmin>): Promise<EnterpriseAdmin>;
  removeAdmin(accountId: string, adminId: string): Promise<boolean>;
  updatePermissions(accountId: string, adminId: string, permissions: EnterprisePermission[]): Promise<boolean>;
  destroy(): Promise<void>;
}

export interface IAbuseDetectionManager extends EventEmitter {
  initialize(): Promise<void>;
  detectAbuse(data: AbuseDetectionData): Promise<AbuseDetectionResult>;
  createRule(rule: Partial<AbuseDetectionRule>): Promise<AbuseDetectionRule>;
  updateRule(ruleId: string, updates: Partial<AbuseDetectionRule>): Promise<AbuseDetectionRule>;
  deleteRule(ruleId: string): Promise<boolean>;
  getAlerts(filters?: AlertFilters): Promise<AbuseAlert[]>;
  resolveAlert(alertId: string, resolution: AlertResolution): Promise<boolean>;
  getAnalytics(timeRange?: TimeRange): Promise<AbuseAnalytics>;
  trainModel(trainingData: TrainingData[]): Promise<ModelTrainingResult>;
  destroy(): Promise<void>;
}

export interface AbuseDetectionData {
  userId?: string;
  deviceId?: string;
  licenseId?: string;
  sessionData: SessionData;
  usageMetrics: UsageMetrics;
  deviceMetrics: DeviceMetrics;
  networkMetrics: NetworkMetrics;
  timestamp: Date;
}

export interface SessionData {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  ipAddress: string;
  userAgent: string;
  location: GeolocationData;
  activities: SessionActivity[];
}

export interface GeolocationData {
  latitude?: number;
  longitude?: number;
  country?: string;
  region?: string;
  city?: string;
  timezone?: string;
  accuracy?: number;
}

export interface UsageMetrics {
  featureUsage: FeatureUsageMetric[];
  apiCalls: APICallMetric[];
  dataTransfer: DataTransferMetric;
  concurrentSessions: number;
  loginFrequency: LoginFrequencyMetric;
}

export interface FeatureUsageMetric {
  feature: string;
  usageCount: number;
  duration: number; // seconds
  intensity: number; // operations per minute
  pattern: string;
}

export interface APICallMetric {
  endpoint: string;
  method: string;
  callCount: number;
  responseTime: number; // milliseconds
  errorRate: number; // percentage
  dataSize: number; // bytes
}

export interface DataTransferMetric {
  upload: number; // bytes
  download: number; // bytes
  total: number; // bytes
  timeWindow: number; // seconds
}

export interface LoginFrequencyMetric {
  hourly: number;
  daily: number;
  weekly: number;
  monthly: number;
  unusual: boolean;
}

export interface DeviceMetrics {
  hardwareFingerprint: string;
  trustScore: number;
  riskScore: number;
  complianceStatus: ComplianceStatus;
  securityFlags: SecurityFlag[];
  performanceMetrics: DevicePerformanceMetrics;
}

export interface SecurityFlag {
  type: SecurityFlagType;
  severity: ThreatSeverity;
  detected: boolean;
  details: string;
}

export enum SecurityFlagType {
  JAILBREAK = 'jailbreak',
  ROOT = 'root',
  DEBUGGER = 'debugger',
  EMULATOR = 'emulator',
  VPN = 'vpn',
  PROXY = 'proxy',
  VM = 'vm',
  SUSPICIOUS_PROCESS = 'suspicious_process'
}

export interface DevicePerformanceMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  diskUsage: number; // MB
  networkLatency: number; // milliseconds
  batteryLevel?: number; // percentage
  temperature?: number; // celsius
}

export interface NetworkMetrics {
  connectionType: ConnectionType;
  bandwidth: NetworkBandwidth;
  latency: number; // milliseconds
  packetLoss: number; // percentage
  vpnDetected: boolean;
  proxyDetected: boolean;
  reputation: NetworkReputation;
}

export interface NetworkBandwidth {
  upload: number; // bps
  download: number; // bps
  measured: boolean;
  timestamp: Date;
}

export interface NetworkReputation {
  score: number; // 0-100
  sources: ReputationSource[];
  categories: string[];
  riskLevel: RiskLevel;
}

export interface ReputationSource {
  name: string;
  score: number;
  category: string;
  lastUpdated: Date;
}

export interface AbuseDetectionResult {
  detected: boolean;
  confidence: DetectionConfidence;
  severity: AbuseSeverity;
  ruleMatches: RuleMatch[];
  riskScore: number;
  recommendedActions: RecommendedAction[];
  evidence: AbuseEvidence[];
  metadata: Record<string, unknown>;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  confidence: number;
  severity: AbuseSeverity;
  matchedConditions: MatchedCondition[];
  weight: number;
}

export interface MatchedCondition {
  field: string;
  operator: RuleOperator;
  expectedValue: unknown;
  actualValue: unknown;
  weight: number;
}

export interface RecommendedAction {
  type: AbuseActionType;
  priority: ActionPriority;
  parameters: Record<string, unknown>;
  reason: string;
  confidence: number;
}

export interface AlertFilters {
  types?: AbuseRuleType[];
  severities?: AbuseSeverity[];
  statuses?: AlertStatus[];
  dateRange?: TimeRange;
  userIds?: string[];
  assignees?: string[];
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface TrainingData {
  features: Record<string, number>;
  label: boolean; // true for abuse, false for legitimate
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface ModelTrainingResult {
  success: boolean;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  modelVersion: string;
  trainedAt: Date;
  trainingDuration: number; // seconds
}

export interface IDeviceManagementManager extends EventEmitter {
  initialize(): Promise<void>;
  registerDevice(device: Partial<RegisteredDevice>): Promise<RegisteredDevice>;
  deauthorizeDevice(deviceId: string, reason?: string): Promise<boolean>;
  updateDeviceStatus(deviceId: string, status: DeviceStatus): Promise<boolean>;
  getDevice(deviceId: string): Promise<RegisteredDevice | null>;
  getDevicesByUser(userId: string): Promise<RegisteredDevice[]>;
  transferDevice(deviceId: string, fromUserId: string, toUserId: string): Promise<DeviceTransferResult>;
  calculateTrustScore(deviceId: string): Promise<DeviceTrustScore>;
  enforcePolicy(policyId: string, deviceId?: string): Promise<PolicyEnforcementResult>;
  generateComplianceReport(accountId: string): Promise<ComplianceReport>;
  destroy(): Promise<void>;
}

export interface DeviceTransferResult {
  success: boolean;
  transferId: string;
  fromUserId: string;
  toUserId: string;
  deviceId: string;
  transferredAt: Date;
  approvedBy?: string;
  restrictions?: TransferRestriction[];
}

export interface TransferRestriction {
  type: RestrictionType;
  reason: string;
  expiresAt?: Date;
  conditions: string[];
}

export enum RestrictionType {
  COOLDOWN = 'cooldown',
  APPROVAL_REQUIRED = 'approval_required',
  SECURITY_REVIEW = 'security_review',
  COMPLIANCE_CHECK = 'compliance_check',
  TEMPORARY_BLOCK = 'temporary_block'
}

export interface PolicyEnforcementResult {
  success: boolean;
  policyId: string;
  deviceId?: string;
  affectedDevices: number;
  actions: PolicyAction[];
  violations: PolicyViolation[];
  enforcedAt: Date;
}

export interface PolicyViolation {
  deviceId: string;
  ruleId: string;
  severity: ViolationSeverity;
  description: string;
  action: PolicyActionType;
  resolved: boolean;
}

export interface ComplianceReport {
  accountId: string;
  generatedAt: Date;
  period: ReportPeriod;
  summary: ComplianceSummary;
  deviceCompliance: DeviceComplianceReport[];
  violations: ComplianceViolation[];
  trends: ComplianceTrend[];
  recommendations: ComplianceRecommendation[];
}

export interface ReportPeriod {
  start: Date;
  end: Date;
  type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
}

export interface ComplianceSummary {
  totalDevices: number;
  compliantDevices: number;
  nonCompliantDevices: number;
  complianceRate: number; // percentage
  criticalViolations: number;
  resolvedViolations: number;
  pendingActions: number;
}

export interface DeviceComplianceReport {
  deviceId: string;
  userId: string;
  status: ComplianceStatus;
  score: number; // 0-100
  checks: ComplianceCheckResult[];
  violations: ComplianceViolation[];
  lastEvaluated: Date;
}

export interface ComplianceCheckResult {
  checkId: string;
  name: string;
  status: ComplianceCheckStatus;
  score: number;
  details: string;
  evaluatedAt: Date;
}

export interface ComplianceTrend {
  period: Date;
  complianceRate: number;
  violationCount: number;
  improvement: number; // percentage change
  topViolationTypes: string[];
}

export interface ComplianceRecommendation {
  priority: ActionPriority;
  category: string;
  description: string;
  impact: string;
  effort: ImplementationEffort;
  timeline: string;
  resources: string[];
}

export enum ImplementationEffort {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}