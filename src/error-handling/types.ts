// Error Handling Types and Classification System

export interface ApplicationError extends Error {
  readonly id: string;
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly category: ErrorCategory;
  readonly context: ErrorContext;
  readonly timestamp: number;
  readonly correlationId?: string;
  readonly causedBy?: ApplicationError;
  readonly metadata: ErrorMetadata;
  readonly recoverable: boolean;
  readonly userMessage: string;
  readonly technicalDetails: string;
  readonly suggestions: string[];
}

export enum ErrorCode {
  // System Errors (1000-1999)
  SYSTEM_STARTUP_FAILED = 'SYS_1001',
  DATABASE_CONNECTION_FAILED = 'SYS_1002',
  DATABASE_MIGRATION_FAILED = 'SYS_1003',
  FILE_SYSTEM_ACCESS_DENIED = 'SYS_1004',
  MEMORY_ALLOCATION_FAILED = 'SYS_1005',
  PROCESS_CRASHED = 'SYS_1006',
  CONFIGURATION_INVALID = 'SYS_1007',
  DEPENDENCY_MISSING = 'SYS_1008',
  
  // Authentication & Authorization (2000-2999)
  AUTH_LOGIN_FAILED = 'AUTH_2001',
  AUTH_SESSION_EXPIRED = 'AUTH_2002',
  AUTH_PERMISSION_DENIED = 'AUTH_2003',
  AUTH_TOKEN_INVALID = 'AUTH_2004',
  AUTH_ACCOUNT_LOCKED = 'AUTH_2005',
  AUTH_PASSWORD_INVALID = 'AUTH_2006',
  
  // Investigation Management (3000-3999)
  INVESTIGATION_NOT_FOUND = 'INV_3001',
  INVESTIGATION_ACCESS_DENIED = 'INV_3002',
  INVESTIGATION_CREATION_FAILED = 'INV_3003',
  INVESTIGATION_UPDATE_FAILED = 'INV_3004',
  INVESTIGATION_DELETE_FAILED = 'INV_3005',
  INVESTIGATION_SESSION_FAILED = 'INV_3006',
  
  // Evidence Management (4000-4999)
  EVIDENCE_NOT_FOUND = 'EVD_4001',
  EVIDENCE_UPLOAD_FAILED = 'EVD_4002',
  EVIDENCE_CORRUPTION_DETECTED = 'EVD_4003',
  EVIDENCE_INTEGRITY_FAILED = 'EVD_4004',
  EVIDENCE_ACCESS_DENIED = 'EVD_4005',
  EVIDENCE_ANALYSIS_FAILED = 'EVD_4006',
  EVIDENCE_CHAIN_BROKEN = 'EVD_4007',
  
  // Sensor Management (5000-5999)
  SENSOR_CONNECTION_FAILED = 'SNS_5001',
  SENSOR_CALIBRATION_FAILED = 'SNS_5002',
  SENSOR_DATA_INVALID = 'SNS_5003',
  SENSOR_OFFLINE = 'SNS_5004',
  SENSOR_CONFIGURATION_ERROR = 'SNS_5005',
  SENSOR_SAMPLING_FAILED = 'SNS_5006',
  SENSOR_ANOMALY_DETECTED = 'SNS_5007',
  
  // Network & Communication (6000-6999)
  NETWORK_CONNECTION_LOST = 'NET_6001',
  NETWORK_TIMEOUT = 'NET_6002',
  NETWORK_AUTHENTICATION_FAILED = 'NET_6003',
  NETWORK_SERVICE_UNAVAILABLE = 'NET_6004',
  NETWORK_PROTOCOL_ERROR = 'NET_6005',
  
  // File Operations (7000-7999)
  FILE_NOT_FOUND = 'FILE_7001',
  FILE_ACCESS_DENIED = 'FILE_7002',
  FILE_CORRUPTED = 'FILE_7003',
  FILE_TOO_LARGE = 'FILE_7004',
  FILE_FORMAT_UNSUPPORTED = 'FILE_7005',
  FILE_WRITE_FAILED = 'FILE_7006',
  FILE_READ_FAILED = 'FILE_7007',
  
  // User Interface (8000-8999)
  UI_COMPONENT_CRASHED = 'UI_8001',
  UI_RENDER_FAILED = 'UI_8002',
  UI_VALIDATION_FAILED = 'UI_8003',
  UI_NAVIGATION_FAILED = 'UI_8004',
  UI_RESOURCE_LOADING_FAILED = 'UI_8005',
  
  // Data Processing (9000-9999)
  DATA_VALIDATION_FAILED = 'DATA_9001',
  DATA_TRANSFORMATION_FAILED = 'DATA_9002',
  DATA_CORRUPTION_DETECTED = 'DATA_9003',
  DATA_EXPORT_FAILED = 'DATA_9004',
  DATA_IMPORT_FAILED = 'DATA_9005',
  DATA_SYNC_FAILED = 'DATA_9006',
  
  // Unknown/Generic
  UNKNOWN_ERROR = 'UNK_0001'
}

export enum ErrorSeverity {
  CRITICAL = 'critical',    // System cannot continue, immediate action required
  HIGH = 'high',           // Major functionality affected, user workflow broken
  MEDIUM = 'medium',       // Minor functionality affected, workaround available
  LOW = 'low',            // Cosmetic issue, no impact on functionality
  INFO = 'info'           // Informational, no action required
}

export enum ErrorCategory {
  SYSTEM = 'system',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  INVESTIGATION = 'investigation',
  EVIDENCE = 'evidence',
  SENSOR = 'sensor',
  NETWORK = 'network',
  DATABASE = 'database',
  FILE_SYSTEM = 'file_system',
  USER_INTERFACE = 'user_interface',
  DATA_PROCESSING = 'data_processing',
  CONFIGURATION = 'configuration',
  INTEGRATION = 'integration',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic'
}

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  investigationId?: string;
  component: string;
  function: string;
  file: string;
  line?: number;
  userAgent?: string;
  url?: string;
  requestId?: string;
  operatingSystem: string;
  electronVersion: string;
  appVersion: string;
  buildVersion: string;
  environment: string;
  timestamp: number;
  additionalData?: Record<string, unknown>;
}

export interface ErrorMetadata {
  stackTrace: string;
  innerErrors?: ApplicationError[];
  performanceMetrics?: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    networkLatency?: number;
  };
  environmentVariables?: Record<string, string>;
  systemInfo?: {
    platform: string;
    arch: string;
    version: string;
    totalMemory: number;
    freeMemory: number;
    uptime: number;
  };
  userActions?: UserAction[];
  debugInfo?: Record<string, unknown>;
}

export interface UserAction {
  timestamp: number;
  action: string;
  component: string;
  details: Record<string, unknown>;
}

export interface ErrorReport {
  id: string;
  error: ApplicationError;
  reportedAt: number;
  reportedBy?: string;
  status: ErrorReportStatus;
  assignedTo?: string;
  resolution?: ErrorResolution;
  reproductionSteps?: string[];
  workaround?: string;
  tags: string[];
  priority: ErrorPriority;
  duplicateOf?: string;
  relatedErrors: string[];
}

export enum ErrorReportStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  WONT_FIX = 'wont_fix',
  DUPLICATE = 'duplicate'
}

export enum ErrorPriority {
  P0 = 'p0', // Critical - immediate fix required
  P1 = 'p1', // High - fix in next release
  P2 = 'p2', // Medium - fix when possible
  P3 = 'p3', // Low - fix if time permits
  P4 = 'p4'  // Backlog - nice to have
}

export interface ErrorResolution {
  type: ResolutionType;
  description: string;
  resolvedBy: string;
  resolvedAt: number;
  version?: string;
  commitHash?: string;
  testResults?: string;
}

export enum ResolutionType {
  FIXED = 'fixed',
  WORKAROUND = 'workaround',
  CONFIGURATION_CHANGE = 'configuration_change',
  DOCUMENTATION = 'documentation',
  NOT_REPRODUCIBLE = 'not_reproducible',
  BY_DESIGN = 'by_design'
}

export interface ErrorRecoveryStrategy {
  code: ErrorCode;
  strategy: RecoveryType;
  maxAttempts: number;
  delayMs: number;
  condition?: (error: ApplicationError) => boolean;
  action: (error: ApplicationError) => Promise<boolean>;
  fallbackAction?: (error: ApplicationError) => Promise<void>;
}

export enum RecoveryType {
  RETRY = 'retry',
  RESTART_COMPONENT = 'restart_component',
  RESTART_APPLICATION = 'restart_application',
  FALLBACK_MODE = 'fallback_mode',
  SAFE_MODE = 'safe_mode',
  DATA_RECOVERY = 'data_recovery',
  USER_INTERVENTION = 'user_intervention',
  NONE = 'none'
}

export interface ErrorHandler {
  canHandle(error: Error | ApplicationError): boolean;
  handle(error: ApplicationError): Promise<ErrorHandlerResult>;
  priority: number;
}

export interface ErrorHandlerResult {
  handled: boolean;
  recovered: boolean;
  userNotified: boolean;
  logged: boolean;
  reported: boolean;
  nextAction?: ErrorHandlerAction;
}

export enum ErrorHandlerAction {
  CONTINUE = 'continue',
  RETRY = 'retry',
  RESTART = 'restart',
  SHUTDOWN = 'shutdown',
  SAFE_MODE = 'safe_mode',
  USER_INTERVENTION = 'user_intervention'
}

export interface ErrorDialog {
  type: ErrorDialogType;
  title: string;
  message: string;
  details?: string;
  actions: ErrorDialogAction[];
  icon?: string;
  allowClose: boolean;
  autoClose?: number;
  modal: boolean;
  persistent: boolean;
}

export enum ErrorDialogType {
  ERROR = 'error',
  WARNING = 'warning',
  CRITICAL = 'critical',
  RECOVERY = 'recovery',
  CONFIRMATION = 'confirmation'
}

export interface ErrorDialogAction {
  id: string;
  label: string;
  action: () => Promise<void> | void;
  style: 'primary' | 'secondary' | 'danger' | 'warning';
  disabled?: boolean;
  loading?: boolean;
}

export interface CrashReport {
  id: string;
  timestamp: number;
  appVersion: string;
  electronVersion: string;
  platform: string;
  architecture: string;
  processType: 'main' | 'renderer' | 'worker';
  exitCode?: number;
  signal?: string;
  crashDump?: string;
  minidump?: string;
  error?: ApplicationError;
  lastUserActions: UserAction[];
  systemMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    diskSpace: number;
    processes: number;
  };
  reproduced: boolean;
  reported: boolean;
  analyzed: boolean;
}

export interface ErrorLogger {
  log(error: ApplicationError): Promise<void>;
  query(filters: ErrorLogQuery): Promise<ApplicationError[]>;
  count(filters: ErrorLogQuery): Promise<number>;
  cleanup(olderThan: Date): Promise<number>;
}

export interface ErrorLogQuery {
  severity?: ErrorSeverity[];
  category?: ErrorCategory[];
  code?: ErrorCode[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  userId?: string;
  investigationId?: string;
  component?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'severity' | 'code';
  sortOrder?: 'asc' | 'desc';
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByCode: Record<ErrorCode, number>;
  topErrors: Array<{
    code: ErrorCode;
    count: number;
    lastOccurrence: Date;
  }>;
  errorTrends: Array<{
    date: Date;
    count: number;
    severity: ErrorSeverity;
  }>;
  meanTimeToResolution: number;
  recoveryRate: number;
  crashRate: number;
  userAffectedCount: number;
}

export interface ErrorConfiguration {
  logging: {
    enabled: boolean;
    level: ErrorSeverity;
    maxFileSize: number;
    maxFiles: number;
    format: 'json' | 'text';
    includeStackTrace: boolean;
    includeUserActions: boolean;
    includeSystemInfo: boolean;
  };
  reporting: {
    enabled: boolean;
    endpoint?: string;
    apiKey?: string;
    includePersonalData: boolean;
    batchSize: number;
    retryAttempts: number;
    reportingInterval: number;
  };
  recovery: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    fallbackMode: boolean;
    safeMode: boolean;
  };
  dialogs: {
    enabled: boolean;
    showTechnicalDetails: boolean;
    allowUserReporting: boolean;
    autoClose: boolean;
    autoCloseDelay: number;
  };
  analytics: {
    enabled: boolean;
    retentionDays: number;
    aggregationInterval: number;
  };
}

export interface ErrorNotification {
  id: string;
  error: ApplicationError;
  channels: NotificationChannel[];
  recipients: string[];
  template: string;
  sent: boolean;
  sentAt?: number;
  retryCount: number;
}

export enum NotificationChannel {
  EMAIL = 'email',
  SLACK = 'slack',
  WEBHOOK = 'webhook',
  IN_APP = 'in_app',
  DESKTOP = 'desktop',
  LOG_FILE = 'log_file'
}

export interface ErrorThreshold {
  category: ErrorCategory;
  severity: ErrorSeverity;
  count: number;
  timeWindow: number; // milliseconds
  action: ThresholdAction;
}

export enum ThresholdAction {
  LOG_WARNING = 'log_warning',
  SEND_NOTIFICATION = 'send_notification',
  ENABLE_SAFE_MODE = 'enable_safe_mode',
  RESTART_COMPONENT = 'restart_component',
  SHUTDOWN_APPLICATION = 'shutdown_application'
}

export interface ErrorCollector {
  collect(): Promise<ApplicationError[]>;
  clear(): Promise<void>;
  count(): Promise<number>;
  subscribe(callback: (error: ApplicationError) => void): () => void;
}

export interface ErrorReporter {
  report(error: ApplicationError): Promise<string>;
  reportBatch(errors: ApplicationError[]): Promise<string[]>;
  getReportStatus(reportId: string): Promise<ErrorReportStatus>;
}

export interface ErrorTransformer {
  transform(error: Error): ApplicationError;
  enrich(error: ApplicationError): ApplicationError;
}

export interface ErrorFilter {
  shouldProcess(error: ApplicationError): boolean;
  shouldLog(error: ApplicationError): boolean;
  shouldReport(error: ApplicationError): boolean;
  shouldNotify(error: ApplicationError): boolean;
}

export interface ErrorAggregator {
  aggregate(errors: ApplicationError[]): ErrorAnalytics;
  groupBy(errors: ApplicationError[], field: keyof ApplicationError): Record<string, ApplicationError[]>;
  trending(errors: ApplicationError[], timeWindow: number): Array<{
    period: Date;
    count: number;
    errors: ApplicationError[];
  }>;
}

// Error Factory Interface
export interface ErrorFactory {
  create(
    code: ErrorCode,
    message: string,
    context: Partial<ErrorContext>,
    cause?: Error
  ): ApplicationError;
  
  createSystem(message: string, context: Partial<ErrorContext>, cause?: Error): ApplicationError;
  createValidation(message: string, context: Partial<ErrorContext>): ApplicationError;
  createNetwork(message: string, context: Partial<ErrorContext>): ApplicationError;
  createDatabase(message: string, context: Partial<ErrorContext>, cause?: Error): ApplicationError;
  createAuth(message: string, context: Partial<ErrorContext>): ApplicationError;
  createFileSystem(message: string, context: Partial<ErrorContext>, cause?: Error): ApplicationError;
}

// Events
export interface ErrorEvents {
  'error:occurred': (error: ApplicationError) => void;
  'error:handled': (error: ApplicationError, result: ErrorHandlerResult) => void;
  'error:recovered': (error: ApplicationError) => void;
  'error:reported': (error: ApplicationError, reportId: string) => void;
  'error:dialog:shown': (error: ApplicationError, dialog: ErrorDialog) => void;
  'error:dialog:closed': (error: ApplicationError, action?: string) => void;
  'error:threshold:exceeded': (threshold: ErrorThreshold, errors: ApplicationError[]) => void;
  'crash:detected': (crashReport: CrashReport) => void;
  'crash:reported': (crashReport: CrashReport) => void;
}