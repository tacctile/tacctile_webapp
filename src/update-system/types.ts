export interface UpdateConfiguration {
  updateServerUrl: string;
  publicKey: string;
  channel: UpdateChannel;
  checkInterval: number; // in milliseconds
  autoDownload: boolean;
  autoInstall: boolean;
  allowPrerelease: boolean;
  enableRollback: boolean;
  maxRollbackVersions: number;
  updateCacheDirectory: string;
  signatureVerification: boolean;
  subscriptionValidation: boolean;
}

export type UpdateChannel = 'stable' | 'beta' | 'alpha' | 'development';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseName?: string;
  releaseNotes?: string;
  files: UpdateFileInfo[];
  signature: string;
  checksum: string;
  minimumSystemVersion?: string;
  requiredSubscriptionTier?: SubscriptionTier;
  rollbackSupported: boolean;
  criticalUpdate: boolean;
  size: number;
  channel: UpdateChannel;
}

export interface UpdateFileInfo {
  url: string;
  sha512: string;
  size: number;
  blockMapSize?: number;
}

export interface UpdateProgress {
  bytesPerSecond: number;
  percent: number;
  total: number;
  transferred: number;
  stage: UpdateStage;
  estimatedTimeRemaining?: number;
}

export type UpdateStage = 
  | 'checking-for-update'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'verifying-signature'
  | 'validating-subscription'
  | 'preparing-install'
  | 'installing'
  | 'install-complete'
  | 'error'
  | 'rollback-available'
  | 'rolling-back'
  | 'rollback-complete';

export interface UpdateError {
  code: UpdateErrorCode;
  message: string;
  details?: any;
  recoverable: boolean;
  timestamp: Date;
}

export type UpdateErrorCode = 
  | 'NETWORK_ERROR'
  | 'SIGNATURE_VERIFICATION_FAILED'
  | 'SUBSCRIPTION_INVALID'
  | 'INSUFFICIENT_DISK_SPACE'
  | 'PERMISSION_DENIED'
  | 'CORRUPTED_UPDATE'
  | 'INCOMPATIBLE_VERSION'
  | 'ROLLBACK_FAILED'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface UpdateEvent {
  type: UpdateEventType;
  data?: any;
  timestamp: Date;
}

export type UpdateEventType =
  | 'checking-for-updates'
  | 'update-available'
  | 'update-not-available'
  | 'download-progress'
  | 'update-downloaded'
  | 'update-installed'
  | 'update-error'
  | 'rollback-available'
  | 'rollback-initiated'
  | 'rollback-complete'
  | 'subscription-validated'
  | 'subscription-invalid';

export interface SubscriptionInfo {
  userId: string;
  email: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  expiresAt: Date;
  features: string[];
  signature: string;
}

export type SubscriptionTier = 'basic' | 'professional' | 'enterprise' | 'developer';

export type SubscriptionStatus = 'active' | 'expired' | 'suspended' | 'cancelled';

export interface UpdateServerConfig {
  baseUrl: string;
  endpoints: {
    checkUpdate: string;
    downloadUpdate: string;
    validateSubscription: string;
    reportMetrics: string;
  };
  security: {
    publicKeyPath: string;
    signatureAlgorithm: 'RSA-SHA256' | 'ECDSA-SHA256';
    certificatePinning: boolean;
    tlsVersion: string;
  };
  caching: {
    enabled: boolean;
    maxCacheSize: number;
    cacheDuration: number;
  };
}

export interface RollbackInfo {
  version: string;
  installDate: Date;
  backupPath: string;
  configSnapshot: any;
  reason?: string;
  automatic: boolean;
}

export interface UpdateMetrics {
  updateId: string;
  version: string;
  downloadStartTime: Date;
  downloadEndTime?: Date;
  downloadSpeed: number;
  installStartTime?: Date;
  installEndTime?: Date;
  success: boolean;
  errorCode?: UpdateErrorCode;
  rollbackOccurred: boolean;
  userInteraction: boolean;
}

export interface SecurityValidation {
  signatureValid: boolean;
  checksumValid: boolean;
  certificateValid: boolean;
  subscriptionValid: boolean;
  validationTimestamp: Date;
  validationErrors: string[];
}

export interface UpdatePolicy {
  automaticUpdates: boolean;
  criticalUpdatesOnly: boolean;
  updateWindow: {
    startHour: number;
    endHour: number;
    timezone: string;
  };
  deferralLimit: number; // hours
  forceUpdateThreshold: number; // critical updates
  bandwidthLimit: number; // bytes per second, 0 = unlimited
  wifiOnlyDownloads: boolean;
}

export interface UpdateNotification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  actions?: UpdateNotificationAction[];
  persistent: boolean;
  timestamp: Date;
}

export interface UpdateNotificationAction {
  id: string;
  label: string;
  style: 'primary' | 'secondary' | 'danger';
  callback: () => void;
}

export interface VersionHistory {
  versions: VersionInfo[];
  currentVersion: string;
  rollbackAvailable: boolean;
  lastUpdateCheck: Date;
}

export interface VersionInfo {
  version: string;
  installDate: Date;
  channel: UpdateChannel;
  size: number;
  canRollback: boolean;
  backupExists: boolean;
}

export interface UpdateSystemState {
  initialized: boolean;
  checking: boolean;
  downloading: boolean;
  installing: boolean;
  rollingBack: boolean;
  lastCheck: Date | null;
  currentProgress: UpdateProgress | null;
  availableUpdate: UpdateInfo | null;
  pendingUpdate: UpdateInfo | null;
  error: UpdateError | null;
  subscription: SubscriptionInfo | null;
  rollbackVersions: RollbackInfo[];
  notifications: UpdateNotification[];
}

// Event handler types for type-safe event listening
export interface UpdateManagerEvents {
  'checking-for-update': () => void;
  'update-available': (info: UpdateInfo) => void;
  'update-not-available': (info: UpdateInfo) => void;
  'download-progress': (progress: UpdateProgress) => void;
  'update-downloaded': (info: UpdateInfo) => void;
  'before-quit-for-update': () => void;
  'update-error': (error: UpdateError) => void;
  'rollback-available': (versions: RollbackInfo[]) => void;
  'rollback-complete': (version: string) => void;
  'subscription-status': (info: SubscriptionInfo) => void;
}