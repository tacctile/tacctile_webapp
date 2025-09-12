export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  profile: UserProfile;
  securitySettings: UserSecuritySettings;
  createdAt: Date;
  updatedAt: Date;
  lastLogin: Date | null;
  isActive: boolean;
  isVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export type UserRole = 'admin' | 'investigator' | 'analyst' | 'viewer' | 'guest';

export interface UserProfile {
  firstName: string;
  lastName: string;
  department?: string;
  badgeNumber?: string;
  agency?: string;
  phone?: string;
  avatar?: string;
  timezone: string;
  language: string;
}

export interface UserSecuritySettings {
  mfaEnabled: boolean;
  mfaMethod: MFAMethod;
  passwordLastChanged: Date;
  sessionTimeout: number; // in minutes
  ipWhitelist: string[];
  allowedDevices: string[];
  requirePasswordChange: boolean;
  accountLocked: boolean;
}

export type MFAMethod = 'totp' | 'sms' | 'email' | 'hardware' | 'none';

export interface Permission {
  resource: string;
  actions: string[];
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
  value: any;
}

export interface AuthenticationCredentials {
  username: string;
  password: string;
  mfaCode?: string;
  deviceId?: string;
  rememberDevice?: boolean;
}

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  session?: UserSession;
  token?: string;
  refreshToken?: string;
  error?: AuthenticationError;
  requiresMFA?: boolean;
  mfaChallenge?: MFAChallenge;
}

export interface AuthenticationError {
  code: AuthErrorCode;
  message: string;
  remainingAttempts?: number;
  lockoutDuration?: number;
  details?: any;
}

export type AuthErrorCode = 
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_DISABLED'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'SESSION_EXPIRED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'DEVICE_NOT_AUTHORIZED'
  | 'IP_NOT_WHITELISTED'
  | 'RATE_LIMITED'
  | 'UNKNOWN_ERROR';

export interface UserSession {
  id: string;
  userId: string;
  deviceId: string;
  deviceInfo: DeviceInfo;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivity: Date;
  isActive: boolean;
  permissions: Permission[];
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: DeviceType;
  platform: string;
  version: string;
  fingerprint: string;
  trusted: boolean;
  registeredAt: Date;
}

export type DeviceType = 'desktop' | 'laptop' | 'mobile' | 'tablet' | 'server';

export interface MFAChallenge {
  challengeId: string;
  method: MFAMethod;
  expiresAt: Date;
  qrCode?: string; // For TOTP setup
  backupCodes?: string[];
}

export interface MFASetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  method: MFAMethod;
}

export interface License {
  id: string;
  userId: string;
  licenseKey: string;
  type: LicenseType;
  tier: LicenseTier;
  status: LicenseStatus;
  features: string[];
  limitations: LicenseLimitation[];
  issuedAt: Date;
  activatedAt: Date | null;
  expiresAt: Date | null;
  maxDevices: number;
  currentDevices: number;
  organizationId?: string;
  metadata: Record<string, any>;
}

export type LicenseType = 'perpetual' | 'subscription' | 'trial' | 'educational' | 'volume';
export type LicenseTier = 'basic' | 'professional' | 'enterprise' | 'forensic' | 'academic';
export type LicenseStatus = 'active' | 'expired' | 'suspended' | 'revoked' | 'pending';

export interface LicenseLimitation {
  type: 'storage' | 'cases' | 'evidence' | 'users' | 'exports' | 'features';
  limit: number;
  current: number;
}

export interface EncryptionKey {
  id: string;
  algorithm: EncryptionAlgorithm;
  keyData: string; // Base64 encoded
  salt: string;
  iv?: string;
  createdAt: Date;
  expiresAt: Date | null;
  purpose: KeyPurpose;
  userId?: string;
  metadata: Record<string, any>;
}

export type EncryptionAlgorithm = 'AES-256-GCM' | 'AES-256-CBC' | 'ChaCha20-Poly1305' | 'RSA-2048' | 'RSA-4096';
export type KeyPurpose = 'user-data' | 'evidence' | 'database' | 'backup' | 'transport' | 'signing';

export interface EncryptedData {
  algorithm: EncryptionAlgorithm;
  data: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt
  keyId?: string;
  checksum: string; // SHA-256 hash for integrity
  metadata?: Record<string, any>;
}

export interface EvidenceItem {
  id: string;
  caseId: string;
  name: string;
  description: string;
  type: EvidenceType;
  mimeType: string;
  size: number;
  hash: string; // SHA-256 hash
  encryptionKeyId: string;
  accessLevel: AccessLevel;
  chainOfCustody: CustodyRecord[];
  metadata: EvidenceMetadata;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastAccessedAt: Date | null;
  lastAccessedBy: string | null;
}

export type EvidenceType = 
  | 'image' | 'video' | 'audio' | 'document' | 'database' 
  | 'network' | 'memory' | 'disk' | 'mobile' | 'other';

export type AccessLevel = 'public' | 'internal' | 'confidential' | 'restricted' | 'classified';

export interface CustodyRecord {
  id: string;
  action: CustodyAction;
  userId: string;
  userName: string;
  timestamp: Date;
  location?: string;
  reason: string;
  digitalSignature: string;
  witnessId?: string;
}

export type CustodyAction = 
  | 'created' | 'accessed' | 'modified' | 'copied' | 'moved' 
  | 'deleted' | 'exported' | 'analyzed' | 'transferred' | 'sealed';

export interface EvidenceMetadata {
  originalFilename: string;
  originalPath?: string;
  sourceDevice?: string;
  acquisitionDate?: Date;
  acquisitionMethod?: string;
  examinerNotes?: string;
  legalHold?: boolean;
  retentionPolicy?: string;
  customFields?: Record<string, any>;
}

export interface SecurityAuditLog {
  id: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent?: string;
  result: AuditResult;
  details: Record<string, any>;
  riskLevel: RiskLevel;
  location?: string;
  deviceId?: string;
}

export type AuditAction = 
  | 'login' | 'logout' | 'login_failed' | 'password_changed' | 'mfa_setup'
  | 'user_created' | 'user_modified' | 'user_deleted' | 'user_locked'
  | 'evidence_created' | 'evidence_accessed' | 'evidence_modified' | 'evidence_deleted'
  | 'case_created' | 'case_accessed' | 'case_modified' | 'case_closed'
  | 'export_created' | 'report_generated' | 'backup_created' | 'system_config_changed'
  | 'license_validated' | 'permission_denied' | 'security_violation';

export type AuditResult = 'success' | 'failure' | 'blocked' | 'warning';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityPolicy {
  id: string;
  name: string;
  version: string;
  effectiveDate: Date;
  passwordPolicy: PasswordPolicy;
  sessionPolicy: SessionPolicy;
  mfaPolicy: MFAPolicy;
  accessPolicy: AccessPolicy;
  auditPolicy: AuditPolicy;
  encryptionPolicy: EncryptionPolicy;
  backupPolicy: BackupPolicy;
  complianceSettings: ComplianceSettings;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number; // Number of previous passwords to prevent reuse
  maxAge: number; // Days before password expires
  lockoutAttempts: number;
  lockoutDuration: number; // Minutes
}

export interface SessionPolicy {
  maxDuration: number; // Minutes
  inactivityTimeout: number; // Minutes
  maxConcurrentSessions: number;
  requireMFAForSensitive: boolean;
  ipWhitelistRequired: boolean;
  deviceRegistrationRequired: boolean;
}

export interface MFAPolicy {
  required: boolean;
  requiredForRoles: UserRole[];
  allowedMethods: MFAMethod[];
  backupCodesEnabled: boolean;
  graceLoginCount: number;
}

export interface AccessPolicy {
  defaultRole: UserRole;
  roleBasedAccess: boolean;
  attributeBasedAccess: boolean;
  ipRestrictions: boolean;
  timeRestrictions: boolean;
  deviceRestrictions: boolean;
}

export interface AuditPolicy {
  enabled: boolean;
  logLevel: 'minimal' | 'standard' | 'detailed' | 'verbose';
  retentionDays: number;
  realTimeMonitoring: boolean;
  alertThresholds: AlertThreshold[];
}

export interface AlertThreshold {
  event: AuditAction;
  count: number;
  timeWindow: number; // Minutes
  severity: RiskLevel;
}

export interface EncryptionPolicy {
  algorithm: EncryptionAlgorithm;
  keyRotationDays: number;
  encryptAtRest: boolean;
  encryptInTransit: boolean;
  encryptBackups: boolean;
  keyEscrowEnabled: boolean;
}

export interface BackupPolicy {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  retention: number; // Days
  encryption: boolean;
  compression: boolean;
  verification: boolean;
}

export interface ComplianceSettings {
  standards: ComplianceStandard[];
  dataRetentionDays: number;
  dataResidency: string[];
  privacySettings: PrivacySettings;
  forensicMode: boolean;
}

export type ComplianceStandard = 
  | 'CJIS' | 'FISMA' | 'NIST' | 'ISO27001' | 'SOC2' 
  | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'FedRAMP';

export interface PrivacySettings {
  dataMasking: boolean;
  pseudonymization: boolean;
  rightToErasure: boolean;
  consentManagement: boolean;
  dataPortability: boolean;
}

export interface OfflineAuthData {
  userId: string;
  username: string;
  passwordHash: string;
  salt: string;
  mfaSecret?: string;
  permissions: Permission[];
  lastSync: Date;
  validUntil: Date;
  deviceFingerprint: string;
  encryptionKey: string;
}

export interface SecurityMetrics {
  totalUsers: number;
  activeUsers: number;
  lockedAccounts: number;
  failedLoginAttempts24h: number;
  mfaEnabledUsers: number;
  activeSessions: number;
  averageSessionDuration: number;
  securityViolations24h: number;
  lastSecurityAudit: Date;
  complianceScore: number;
}

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: RiskLevel;
  timestamp: Date;
  userId?: string;
  deviceId?: string;
  ipAddress: string;
  description: string;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export type SecurityEventType = 
  | 'brute_force_attack' | 'suspicious_login' | 'privilege_escalation'
  | 'data_breach_attempt' | 'malware_detected' | 'unauthorized_access'
  | 'policy_violation' | 'system_compromise' | 'insider_threat';

// Event handler types for type-safe event listening
export interface SecurityManagerEvents {
  'user-authenticated': (user: User, session: UserSession) => void;
  'user-logout': (userId: string, sessionId: string) => void;
  'authentication-failed': (username: string, error: AuthenticationError) => void;
  'session-expired': (sessionId: string) => void;
  'security-violation': (event: SecurityEvent) => void;
  'mfa-required': (userId: string, challenge: MFAChallenge) => void;
  'license-status-changed': (license: License) => void;
  'audit-log-created': (log: SecurityAuditLog) => void;
}