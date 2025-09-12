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
  customFields: Record<string, any>;
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
  customFields: Record<string, any>;
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
  additionalInfo?: Record<string, any>;
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
  details?: any;
  recoverable: boolean;
}

export interface ValidationWarning {
  code: string;
  message: string;
  details?: any;
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
  details: Record<string, any>;
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

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: Date;
  requestId: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: any;
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