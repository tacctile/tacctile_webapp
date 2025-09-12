// Database Schema Types and Interfaces

export interface DatabaseConnection {
  path: string;
  version: number;
  isOpen: boolean;
  readonly: boolean;
  walMode: boolean;
}

export interface MigrationInfo {
  version: number;
  name: string;
  description: string;
  upScript: string;
  downScript: string;
  appliedAt?: number;
  executionTime?: number;
}

// Investigation & Case Management
export interface Investigation {
  id: string;
  name: string;
  description: string;
  case_number: string;
  status: InvestigationStatus;
  priority: InvestigationPriority;
  assigned_to: string;
  location: string;
  coordinates?: string; // JSON: {lat, lng}
  start_date: number; // Unix timestamp
  end_date?: number;
  estimated_duration?: number; // minutes
  tags: string; // JSON array
  metadata: string; // JSON object
  created_at: number;
  updated_at: number;
  created_by: string;
  updated_by: string;
  archived: boolean;
  archived_at?: number;
}

export enum InvestigationStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ARCHIVED = 'archived'
}

export enum InvestigationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
  CRITICAL = 'critical'
}

export interface InvestigationSession {
  id: string;
  investigation_id: string;
  session_number: number;
  name: string;
  description: string;
  start_time: number;
  end_time?: number;
  duration?: number; // calculated field in minutes
  status: SessionStatus;
  location: string;
  coordinates?: string; // JSON
  weather_conditions?: string;
  equipment_used: string; // JSON array
  team_members: string; // JSON array
  objectives: string; // JSON array
  findings_summary?: string;
  notes: string;
  created_at: number;
  updated_at: number;
  created_by: string;
}

export enum SessionStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ABORTED = 'aborted'
}

export interface InvestigationTeamMember {
  id: string;
  investigation_id: string;
  user_id: string;
  role: TeamRole;
  permissions: string; // JSON array
  assigned_at: number;
  assigned_by: string;
  removed_at?: number;
  removed_by?: string;
  is_active: boolean;
}

export enum TeamRole {
  LEAD_INVESTIGATOR = 'lead_investigator',
  INVESTIGATOR = 'investigator',
  TECHNICAL_SPECIALIST = 'technical_specialist',
  OBSERVER = 'observer',
  CONSULTANT = 'consultant'
}

// Evidence Management
export interface Evidence {
  id: string;
  investigation_id: string;
  session_id?: string;
  evidence_number: string;
  name: string;
  description: string;
  type: EvidenceType;
  category: EvidenceCategory;
  subcategory?: string;
  file_path?: string;
  file_size?: number;
  file_hash?: string; // SHA-256
  mime_type?: string;
  thumbnail_path?: string;
  location_found?: string;
  coordinates?: string; // JSON
  collection_time: number;
  collected_by: string;
  chain_of_custody: string; // JSON array
  tags: string; // JSON array
  metadata: string; // JSON object - sensor data, EXIF, etc.
  integrity_verified: boolean;
  integrity_check_time?: number;
  integrity_check_by?: string;
  analysis_status: AnalysisStatus;
  analysis_notes?: string;
  significance: SignificanceLevel;
  is_primary_evidence: boolean;
  related_evidence: string; // JSON array of evidence IDs
  created_at: number;
  updated_at: number;
  archived: boolean;
  archived_at?: number;
}

export enum EvidenceType {
  PHYSICAL = 'physical',
  DIGITAL = 'digital',
  PHOTOGRAPHIC = 'photographic',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  SENSOR_DATA = 'sensor_data',
  MEASUREMENT = 'measurement',
  TESTIMONY = 'testimony',
  OTHER = 'other'
}

export enum EvidenceCategory {
  EMF_READING = 'emf_reading',
  AUDIO_RECORDING = 'audio_recording',
  VISUAL_EVIDENCE = 'visual_evidence',
  MOTION_DETECTION = 'motion_detection',
  ENVIRONMENTAL_DATA = 'environmental_data',
  EQUIPMENT_MALFUNCTION = 'equipment_malfunction',
  PERSONAL_EXPERIENCE = 'personal_experience',
  HISTORICAL_RESEARCH = 'historical_research',
  WITNESS_ACCOUNT = 'witness_account',
  CORRELATION_ANALYSIS = 'correlation_analysis'
}

export enum AnalysisStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REQUIRES_EXPERT_REVIEW = 'requires_expert_review',
  INCONCLUSIVE = 'inconclusive',
  DEBUNKED = 'debunked'
}

export enum SignificanceLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface EvidenceFile {
  id: string;
  evidence_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_hash: string;
  mime_type: string;
  encoding?: string;
  thumbnail_path?: string;
  preview_path?: string;
  is_primary: boolean;
  upload_time: number;
  uploaded_by: string;
  processing_status: ProcessingStatus;
  processing_error?: string;
  metadata: string; // JSON - EXIF, codec info, etc.
}

export enum ProcessingStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  ERROR = 'error',
  CORRUPTED = 'corrupted'
}

export interface EvidenceAnnotation {
  id: string;
  evidence_id: string;
  annotator_id: string;
  annotation_type: AnnotationType;
  content: string;
  position_data?: string; // JSON - coordinates for visual annotations
  timestamp_start?: number; // for time-based media
  timestamp_end?: number;
  confidence_score?: number;
  verified_by?: string;
  verified_at?: number;
  tags: string; // JSON array
  created_at: number;
  updated_at: number;
}

export enum AnnotationType {
  TEXT_NOTE = 'text_note',
  HIGHLIGHT = 'highlight',
  SHAPE_OVERLAY = 'shape_overlay',
  TIMESTAMP_MARKER = 'timestamp_marker',
  MEASUREMENT = 'measurement',
  IDENTIFICATION = 'identification',
  ANOMALY_DETECTION = 'anomaly_detection'
}

// Sensor Data Management
export interface SensorReading {
  id: string;
  investigation_id: string;
  session_id?: string;
  sensor_id: string;
  sensor_type: SensorType;
  reading_time: number;
  location?: string;
  coordinates?: string; // JSON
  raw_value: number;
  processed_value?: number;
  unit: string;
  quality_score?: number; // 0-1
  calibration_offset?: number;
  environmental_factors?: string; // JSON
  anomaly_detected: boolean;
  anomaly_confidence?: number;
  metadata: string; // JSON
  created_at: number;
}

export enum SensorType {
  EMF = 'emf',
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  PRESSURE = 'pressure',
  MOTION = 'motion',
  AUDIO = 'audio',
  LIGHT = 'light',
  MAGNETIC = 'magnetic',
  RADIATION = 'radiation',
  VIBRATION = 'vibration',
  GPS = 'gps',
  ACCELEROMETER = 'accelerometer',
  GYROSCOPE = 'gyroscope'
}

export interface SensorConfiguration {
  id: string;
  sensor_id: string;
  sensor_name: string;
  sensor_type: SensorType;
  manufacturer: string;
  model: string;
  serial_number?: string;
  firmware_version?: string;
  calibration_date?: number;
  calibration_due_date?: number;
  sampling_rate: number; // Hz
  resolution: number;
  accuracy: string;
  measurement_range: string; // JSON {min, max}
  configuration_data: string; // JSON
  is_active: boolean;
  last_maintenance?: number;
  created_at: number;
  updated_at: number;
}

export interface SensorAlert {
  id: string;
  sensor_reading_id?: string;
  sensor_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  threshold_value?: number;
  actual_value?: number;
  message: string;
  triggered_at: number;
  acknowledged_at?: number;
  acknowledged_by?: string;
  resolved_at?: number;
  resolved_by?: string;
  investigation_id?: string;
  session_id?: string;
  metadata: string; // JSON
}

export enum AlertType {
  THRESHOLD_EXCEEDED = 'threshold_exceeded',
  THRESHOLD_BELOW = 'threshold_below',
  ANOMALY_DETECTED = 'anomaly_detected',
  SENSOR_MALFUNCTION = 'sensor_malfunction',
  CALIBRATION_DUE = 'calibration_due',
  BATTERY_LOW = 'battery_low',
  COMMUNICATION_LOST = 'communication_lost',
  DATA_CORRUPTION = 'data_corruption'
}

export enum AlertSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// User Management & Preferences
export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  department?: string;
  organization?: string;
  certification_level?: string;
  phone_number?: string;
  emergency_contact?: string; // JSON
  preferences: string; // JSON
  permissions: string; // JSON array
  last_login?: number;
  login_count: number;
  account_status: AccountStatus;
  created_at: number;
  updated_at: number;
  created_by?: string;
}

export enum UserRole {
  ADMIN = 'admin',
  SENIOR_INVESTIGATOR = 'senior_investigator',
  INVESTIGATOR = 'investigator',
  ANALYST = 'analyst',
  TECHNICIAN = 'technician',
  VIEWER = 'viewer'
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  LOCKED = 'locked',
  PENDING_VERIFICATION = 'pending_verification'
}

export interface UserPreference {
  id: string;
  user_id: string;
  category: PreferenceCategory;
  key: string;
  value: string;
  data_type: PreferenceDataType;
  is_encrypted: boolean;
  updated_at: number;
}

export enum PreferenceCategory {
  UI_SETTINGS = 'ui_settings',
  NOTIFICATION_SETTINGS = 'notification_settings',
  SENSOR_SETTINGS = 'sensor_settings',
  DISPLAY_SETTINGS = 'display_settings',
  EXPORT_SETTINGS = 'export_settings',
  PRIVACY_SETTINGS = 'privacy_settings',
  WORKSPACE_SETTINGS = 'workspace_settings'
}

export enum PreferenceDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  ENCRYPTED = 'encrypted'
}

export interface UserSession {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string;
  user_agent: string;
  device_info?: string; // JSON
  login_time: number;
  last_activity: number;
  logout_time?: number;
  session_duration?: number;
  is_active: boolean;
  location?: string;
}

// Audit Trail & Logging
export interface AuditLog {
  id: string;
  user_id?: string;
  session_id?: string;
  action: AuditAction;
  entity_type: EntityType;
  entity_id?: string;
  old_values?: string; // JSON
  new_values?: string; // JSON
  ip_address?: string;
  user_agent?: string;
  timestamp: number;
  success: boolean;
  error_message?: string;
  risk_level: RiskLevel;
  investigation_id?: string;
  metadata: string; // JSON
}

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  EXPORT = 'export',
  IMPORT = 'import',
  BACKUP = 'backup',
  RESTORE = 'restore',
  PERMISSION_CHANGE = 'permission_change',
  PASSWORD_CHANGE = 'password_change',
  DATA_MIGRATION = 'data_migration',
  SYSTEM_EVENT = 'system_event'
}

export enum EntityType {
  INVESTIGATION = 'investigation',
  EVIDENCE = 'evidence',
  SENSOR_READING = 'sensor_reading',
  USER = 'user',
  USER_PREFERENCE = 'user_preference',
  AUDIT_LOG = 'audit_log',
  SENSOR_CONFIGURATION = 'sensor_configuration',
  SYSTEM_SETTING = 'system_setting',
  INVESTIGATION_SESSION = 'investigation_session',
  FILE = 'file'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SystemLog {
  id: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: string; // JSON
  source: string;
  timestamp: number;
  investigation_id?: string;
  session_id?: string;
  user_id?: string;
  error_code?: string;
  stack_trace?: string;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export enum LogCategory {
  APPLICATION = 'application',
  DATABASE = 'database',
  SENSOR = 'sensor',
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  USER_ACTION = 'user_action',
  SYSTEM = 'system',
  INTEGRATION = 'integration'
}

// System Configuration
export interface SystemSetting {
  id: string;
  category: SettingCategory;
  key: string;
  value: string;
  data_type: SettingDataType;
  description: string;
  is_encrypted: boolean;
  requires_restart: boolean;
  validation_rule?: string; // JSON
  default_value: string;
  updated_at: number;
  updated_by: string;
}

export enum SettingCategory {
  DATABASE = 'database',
  SECURITY = 'security',
  SENSOR = 'sensor',
  FILE_STORAGE = 'file_storage',
  NOTIFICATION = 'notification',
  BACKUP = 'backup',
  INTEGRATION = 'integration',
  UI = 'ui',
  PERFORMANCE = 'performance',
  LOGGING = 'logging'
}

export enum SettingDataType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  JSON = 'json',
  PASSWORD = 'password',
  PATH = 'path',
  URL = 'url',
  EMAIL = 'email'
}

// Backup & Archive
export interface BackupRecord {
  id: string;
  backup_name: string;
  backup_type: BackupType;
  file_path: string;
  file_size: number;
  compression_ratio?: number;
  includes_files: boolean;
  date_range_start?: number;
  date_range_end?: number;
  investigation_ids?: string; // JSON array
  created_at: number;
  created_by: string;
  restore_count: number;
  last_restored_at?: number;
  last_restored_by?: string;
  checksum: string;
  metadata: string; // JSON
}

export enum BackupType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
  INVESTIGATION_SPECIFIC = 'investigation_specific',
  DATA_ONLY = 'data_only',
  CONFIGURATION_ONLY = 'configuration_only'
}

// Database Indexes and Constraints
export interface IndexInfo {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type: IndexType;
}

export enum IndexType {
  BTREE = 'btree',
  HASH = 'hash',
  PARTIAL = 'partial',
  EXPRESSION = 'expression',
  UNIQUE = 'unique',
  COMPOSITE = 'composite'
}

export interface ForeignKeyConstraint {
  name: string;
  table: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: ForeignKeyAction;
  onDelete: ForeignKeyAction;
}

export enum ForeignKeyAction {
  CASCADE = 'CASCADE',
  RESTRICT = 'RESTRICT',
  SET_NULL = 'SET NULL',
  SET_DEFAULT = 'SET DEFAULT',
  NO_ACTION = 'NO ACTION'
}

// Query and Performance Types
export interface QueryPerformance {
  query: string;
  execution_time: number;
  rows_examined: number;
  rows_returned: number;
  index_used?: string[];
  timestamp: number;
  user_id?: string;
}

export interface DatabaseStatistics {
  total_size: number;
  table_count: number;
  index_count: number;
  largest_table: string;
  largest_table_size: number;
  most_accessed_table: string;
  average_query_time: number;
  slow_queries_count: number;
  last_analyzed: number;
}

// Migration System Types
export interface Migration {
  version: number;
  name: string;
  description: string;
  up: string;
  down: string;
  dependencies?: number[];
  applied_at?: number;
  execution_time?: number;
  checksum: string;
}

export interface MigrationState {
  current_version: number;
  target_version?: number;
  in_progress: boolean;
  last_migration_at?: number;
  failed_migration?: number;
  error_message?: string;
}

// Data Export/Import Types
export interface ExportJob {
  id: string;
  user_id: string;
  export_type: ExportType;
  format: ExportFormat;
  filters: string; // JSON
  file_path?: string;
  file_size?: number;
  status: JobStatus;
  progress: number; // 0-100
  started_at: number;
  completed_at?: number;
  error_message?: string;
  records_exported?: number;
  includes_files: boolean;
}

export enum ExportType {
  INVESTIGATION = 'investigation',
  EVIDENCE = 'evidence',
  SENSOR_DATA = 'sensor_data',
  AUDIT_LOGS = 'audit_logs',
  FULL_DATABASE = 'full_database',
  CUSTOM_QUERY = 'custom_query'
}

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml',
  PDF = 'pdf',
  SQLITE = 'sqlite',
  EXCEL = 'excel'
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}