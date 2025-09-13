// Configuration System Types for Professional Investigation Software

export interface ConfigurationSchema {
  userPreferences: UserPreferences;
  hardwareCalibrations: HardwareCalibrations;
  toolDefaults: ToolDefaults;
  workspaceLayouts: WorkspaceLayouts;
  systemSettings: SystemSettings;
  securitySettings: SecuritySettings;
}

// User Preferences
export interface UserPreferences {
  appearance: AppearanceSettings;
  behavior: BehaviorSettings;
  accessibility: AccessibilitySettings;
  notifications: NotificationSettings;
  shortcuts: KeyboardShortcuts;
  language: LanguageSettings;
  privacy: PrivacySettings;
}

export interface AppearanceSettings {
  theme: 'light' | 'dark' | 'auto' | 'high-contrast';
  fontSize: number; // 12-24
  fontFamily: string;
  uiScale: number; // 0.8-2.0
  colorScheme: 'default' | 'colorblind-friendly' | 'custom';
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
  };
  animationsEnabled: boolean;
  compactMode: boolean;
  showTooltips: boolean;
  iconSet: 'default' | 'minimal' | 'detailed';
}

export interface BehaviorSettings {
  autoSave: boolean;
  autoSaveInterval: number; // minutes
  confirmOnExit: boolean;
  confirmOnDelete: boolean;
  doubleClickAction: 'open' | 'select' | 'edit';
  defaultFileFormat: string;
  maxRecentFiles: number;
  showWelcomeScreen: boolean;
  enableDragDrop: boolean;
  multiSelectMode: 'ctrl' | 'click' | 'touch';
  scrollSensitivity: number; // 0.1-2.0
  zoomSensitivity: number; // 0.1-2.0
}

export interface AccessibilitySettings {
  highContrast: boolean;
  screenReaderSupport: boolean;
  keyboardNavigation: boolean;
  voiceCommands: boolean;
  gestureControls: boolean;
  textToSpeech: boolean;
  speechRate: number; // 0.5-2.0
  focusIndicator: 'default' | 'enhanced' | 'custom';
  reducedMotion: boolean;
  colorBlindnessType: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  email: boolean;
  types: {
    errors: boolean;
    warnings: boolean;
    info: boolean;
    updates: boolean;
    investigations: boolean;
    evidence: boolean;
    calibrations: boolean;
    backups: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string; // HH:MM
    end: string; // HH:MM
  };
  priority: 'all' | 'important' | 'critical';
}

export interface KeyboardShortcuts {
  [key: string]: {
    action: string;
    keys: string[];
    context: 'global' | 'investigation' | 'evidence' | 'analysis';
    enabled: boolean;
    customizable: boolean;
  };
}

export interface LanguageSettings {
  locale: string; // ISO 639-1 + ISO 3166-1
  dateFormat: 'MM/dd/yyyy' | 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'custom';
  timeFormat: '12h' | '24h';
  numberFormat: 'US' | 'EU' | 'custom';
  timezone: string; // IANA timezone
  currency: string; // ISO 4217
  unitSystem: 'metric' | 'imperial' | 'mixed';
}

export interface PrivacySettings {
  telemetryEnabled: boolean;
  crashReporting: boolean;
  usageAnalytics: boolean;
  errorReporting: boolean;
  anonymizeData: boolean;
  dataRetention: number; // days
  shareImprovement: boolean;
  locationTracking: boolean;
}

// Hardware Calibrations
export interface HardwareCalibrations {
  sensors: SensorCalibrations;
  displays: DisplayCalibrations;
  input: InputCalibrations;
  audio: AudioCalibrations;
  network: NetworkCalibrations;
}

export interface SensorCalibrations {
  [sensorId: string]: {
    type: string;
    name: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    calibrationDate: string;
    expiryDate: string;
    parameters: {
      [parameter: string]: {
        value: number;
        unit: string;
        tolerance: number;
        range: { min: number; max: number };
        certified: boolean;
        certificationBody?: string;
      };
    };
    temperatureCoefficient?: number;
    humidityCoefficient?: number;
    pressureCoefficient?: number;
    drift: {
      daily: number;
      monthly: number;
      annual: number;
    };
    accuracy: number;
    precision: number;
    resolution: number;
    stability: number;
    linearity: number;
    hysteresis: number;
    lastVerified: string;
    nextCalibrationDue: string;
    calibrationCertificate?: string; // file path
    notes: string;
    active: boolean;
  };
}

export interface DisplayCalibrations {
  [displayId: string]: {
    name: string;
    manufacturer: string;
    model: string;
    serialNumber: string;
    resolution: { width: number; height: number };
    refreshRate: number;
    colorProfile: string;
    brightness: number; // 0-100
    contrast: number; // 0-100
    gamma: number; // 1.0-3.0
    colorTemperature: number; // Kelvin
    colorSpace: 'sRGB' | 'AdobeRGB' | 'DCI-P3' | 'Rec2020' | 'custom';
    whitePoint: { x: number; y: number };
    blackPoint: { x: number; y: number };
    calibrationMatrix: number[][];
    lutTable?: number[][];
    lastCalibrated: string;
    calibrationExpiry: string;
    uniformity: {
      brightness: number; // percentage
      color: number; // deltaE
    };
    verified: boolean;
    primary: boolean;
  };
}

export interface InputCalibrations {
  mouse: {
    sensitivity: number;
    acceleration: boolean;
    dpi: number;
    pollRate: number;
    buttonMapping: { [button: string]: string };
  };
  keyboard: {
    repeatDelay: number;
    repeatRate: number;
    layout: string;
    customMapping: { [key: string]: string };
  };
  touchpad: {
    sensitivity: number;
    tapToClick: boolean;
    twoFingerScroll: boolean;
    threeFingerGestures: boolean;
    palmRejection: boolean;
  };
  stylus?: {
    pressure: { min: number; max: number };
    tilt: { x: number; y: number };
    rotation: number;
    buttonMapping: { [button: string]: string };
  };
  gamepad?: {
    deadzone: number;
    sensitivity: number;
    buttonMapping: { [button: string]: string };
  };
}

export interface AudioCalibrations {
  input: {
    [deviceId: string]: {
      name: string;
      gain: number; // dB
      volume: number; // 0-100
      sampleRate: number;
      bitDepth: number;
      channels: number;
      noiseSuppression: boolean;
      echoCancellation: boolean;
      autoGainControl: boolean;
      frequencyResponse: number[];
      calibrationTone: number; // Hz
      signalToNoise: number; // dB
    };
  };
  output: {
    [deviceId: string]: {
      name: string;
      volume: number; // 0-100
      balance: number; // -100 to 100
      equalizer: number[]; // frequency band gains
      spatialAudio: boolean;
      crossfeed: number;
      limitingEnabled: boolean;
      limitingThreshold: number; // dB
    };
  };
}

export interface NetworkCalibrations {
  latency: {
    [endpoint: string]: {
      averageLatency: number; // ms
      jitter: number; // ms
      packetLoss: number; // percentage
      lastMeasured: string;
      samples: number;
    };
  };
  bandwidth: {
    [connection: string]: {
      download: number; // Mbps
      upload: number; // Mbps
      lastMeasured: string;
      reliability: number; // percentage
    };
  };
  servers: {
    [server: string]: {
      endpoint: string;
      priority: number;
      timeout: number;
      retries: number;
      healthCheck: string;
      lastCheck: string;
      status: 'active' | 'inactive' | 'degraded';
    };
  };
}

// Tool Defaults
export interface ToolDefaults {
  analysis: AnalysisToolDefaults;
  forensics: ForensicsToolDefaults;
  visualization: VisualizationToolDefaults;
  reporting: ReportingToolDefaults;
  export: ExportToolDefaults;
  import: ImportToolDefaults;
}

export interface AnalysisToolDefaults {
  algorithms: {
    [algorithmName: string]: {
      enabled: boolean;
      parameters: Record<string, unknown>;
      priority: number;
      timeout: number;
      memoryLimit: number;
      cpuLimit: number;
      parallelism: boolean;
      caching: boolean;
      precision: number;
    };
  };
  filters: {
    [filterType: string]: {
      enabled: boolean;
      threshold: number;
      sensitivity: number;
      parameters: Record<string, unknown>;
    };
  };
  processing: {
    batchSize: number;
    maxConcurrent: number;
    retryAttempts: number;
    retryDelay: number;
    progressReporting: boolean;
    backgroundProcessing: boolean;
  };
}

export interface ForensicsToolDefaults {
  hashAlgorithms: string[];
  verificationLevel: 'basic' | 'standard' | 'forensic';
  chainOfCustody: {
    automaticLogging: boolean;
    requireSignatures: boolean;
    timestampServer: string;
    hashingFrequency: 'continuous' | 'periodic' | 'manual';
  };
  acquisition: {
    compressionLevel: number;
    errorHandling: 'strict' | 'lenient' | 'interactive';
    verifyAfterAcquisition: boolean;
    generateReport: boolean;
    preserveTimestamps: boolean;
  };
  analysis: {
    deepScan: boolean;
    recoverDeleted: boolean;
    extractMetadata: boolean;
    generateThumbnails: boolean;
    indexFullText: boolean;
  };
}

export interface VisualizationToolDefaults {
  charts: {
    [chartType: string]: {
      colorScheme: string;
      showGrid: boolean;
      showLegend: boolean;
      showTooltips: boolean;
      animation: boolean;
      responsive: boolean;
      exportFormat: string;
      dpi: number;
    };
  };
  graphs: {
    layout: 'force' | 'hierarchical' | 'circular' | 'tree';
    nodeSize: number;
    edgeWidth: number;
    clustering: boolean;
    labeling: 'always' | 'hover' | 'never';
    physics: boolean;
  };
  maps: {
    provider: 'openstreetmap' | 'google' | 'mapbox' | 'custom';
    style: string;
    clustering: boolean;
    heatmaps: boolean;
    layers: string[];
    controls: string[];
  };
}

export interface ReportingToolDefaults {
  format: 'pdf' | 'html' | 'docx' | 'json';
  template: string;
  includeCharts: boolean;
  includeImages: boolean;
  includeRawData: boolean;
  includeMetadata: boolean;
  includeCertifications: boolean;
  watermark: string;
  encryption: boolean;
  digitalSignature: boolean;
  compression: number;
  pageSize: 'A4' | 'US Letter' | 'Legal' | 'Custom';
  margins: { top: number; right: number; bottom: number; left: number };
  fonts: {
    heading: string;
    body: string;
    code: string;
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface ExportToolDefaults {
  formats: {
    [format: string]: {
      enabled: boolean;
      compression: number;
      quality: number;
      parameters: Record<string, unknown>;
    };
  };
  naming: {
    pattern: string;
    includeTimestamp: boolean;
    includeVersion: boolean;
    sanitizeNames: boolean;
  };
  metadata: {
    preserve: boolean;
    strip: string[];
    add: Record<string, string>;
  };
  validation: {
    verify: boolean;
    checksum: string;
    signature: boolean;
  };
}

export interface ImportToolDefaults {
  formats: {
    [format: string]: {
      enabled: boolean;
      parser: string;
      validation: string;
      errorHandling: 'strict' | 'lenient' | 'interactive';
    };
  };
  processing: {
    batchSize: number;
    concurrent: number;
    timeout: number;
    retries: number;
  };
  validation: {
    structure: boolean;
    content: boolean;
    integrity: boolean;
    duplicates: 'skip' | 'merge' | 'error';
  };
}

// Workspace Layouts
export interface WorkspaceLayouts {
  current: string;
  layouts: {
    [layoutName: string]: WorkspaceLayout;
  };
  recent: string[];
  autosave: boolean;
  syncAcrossDevices: boolean;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  version: string;
  author: string;
  tags: string[];
  shared: boolean;
  readonly: boolean;
  windows: WindowLayout[];
  panels: PanelLayout[];
  toolbars: ToolbarLayout[];
  menus: MenuLayout[];
  shortcuts: KeyboardShortcuts;
  theme: string;
  zoom: number;
  viewport: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface WindowLayout {
  id: string;
  type: string;
  title: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  state: 'normal' | 'maximized' | 'minimized' | 'fullscreen';
  visible: boolean;
  resizable: boolean;
  moveable: boolean;
  alwaysOnTop: boolean;
  modal: boolean;
  parent?: string;
  children: string[];
  zIndex: number;
  opacity: number;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface PanelLayout {
  id: string;
  type: string;
  title: string;
  location: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'floating';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  docked: boolean;
  collapsible: boolean;
  collapsed: boolean;
  resizable: boolean;
  tabs: TabLayout[];
  splitter?: {
    orientation: 'horizontal' | 'vertical';
    position: number;
    panels: string[];
  };
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface TabLayout {
  id: string;
  title: string;
  icon?: string;
  closable: boolean;
  active: boolean;
  pinned: boolean;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface ToolbarLayout {
  id: string;
  type: string;
  location: 'top' | 'bottom' | 'left' | 'right';
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  visible: boolean;
  locked: boolean;
  customizable: boolean;
  items: ToolbarItemLayout[];
  orientation: 'horizontal' | 'vertical';
  size: 'small' | 'medium' | 'large';
  style: 'icons' | 'text' | 'both';
}

export interface ToolbarItemLayout {
  id: string;
  type: 'button' | 'dropdown' | 'separator' | 'spacer' | 'search' | 'custom';
  action: string;
  icon?: string;
  text?: string;
  tooltip?: string;
  enabled: boolean;
  visible: boolean;
  order: number;
  group?: string;
  shortcut?: string;
  style?: Record<string, unknown>;
}

export interface MenuLayout {
  id: string;
  type: 'main' | 'context' | 'popup';
  items: MenuItemLayout[];
  style: Record<string, unknown>;
}

export interface MenuItemLayout {
  id: string;
  type: 'item' | 'separator' | 'submenu';
  text: string;
  icon?: string;
  action?: string;
  shortcut?: string;
  enabled: boolean;
  visible: boolean;
  checked?: boolean;
  submenu?: MenuItemLayout[];
  order: number;
}

// System Settings
export interface SystemSettings {
  performance: PerformanceSettings;
  storage: StorageSettings;
  backup: BackupSettings;
  updates: UpdateSettings;
  logging: LoggingSettings;
  monitoring: MonitoringSettings;
}

export interface PerformanceSettings {
  maxMemoryUsage: number; // MB
  maxCpuUsage: number; // percentage
  maxDiskUsage: number; // MB
  concurrentOperations: number;
  cacheSize: number; // MB
  preloadData: boolean;
  backgroundProcessing: boolean;
  priorityMode: 'performance' | 'balanced' | 'efficiency';
  gpuAcceleration: boolean;
  multiThreading: boolean;
  vectorInstructions: boolean;
  memoryCompression: boolean;
}

export interface StorageSettings {
  dataDirectory: string;
  tempDirectory: string;
  cacheDirectory: string;
  logDirectory: string;
  backupDirectory: string;
  maxCacheSize: number; // MB
  maxTempSize: number; // MB
  cleanupInterval: number; // hours
  compression: boolean;
  encryption: boolean;
  indexing: boolean;
  monitoring: boolean;
}

export interface BackupSettings {
  enabled: boolean;
  automatic: boolean;
  schedule: string; // cron expression
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  location: 'local' | 'cloud' | 'both';
  encryption: boolean;
  compression: boolean;
  verification: boolean;
  incremental: boolean;
  exclude: string[];
  include: string[];
  maxBackupSize: number; // MB
  notifications: boolean;
}

export interface UpdateSettings {
  channel: 'stable' | 'beta' | 'dev';
  automatic: boolean;
  checkInterval: number; // hours
  downloadInBackground: boolean;
  installOnRestart: boolean;
  backupBeforeUpdate: boolean;
  rollbackEnabled: boolean;
  notifications: boolean;
  proxySettings?: {
    enabled: boolean;
    server: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export interface LoggingSettings {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  categories: {
    [category: string]: {
      enabled: boolean;
      level: string;
      file?: string;
    };
  };
  maxFileSize: number; // MB
  maxFiles: number;
  format: 'json' | 'text' | 'structured';
  includeStackTrace: boolean;
  includeTimestamp: boolean;
  includeContext: boolean;
  compression: boolean;
  encryption: boolean;
  remoteLogging?: {
    enabled: boolean;
    endpoint: string;
    apiKey: string;
    batchSize: number;
    flushInterval: number;
  };
}

export interface MonitoringSettings {
  enabled: boolean;
  interval: number; // seconds
  metrics: {
    performance: boolean;
    memory: boolean;
    disk: boolean;
    network: boolean;
    errors: boolean;
    users: boolean;
  };
  alerts: {
    enabled: boolean;
    thresholds: {
      cpu: number;
      memory: number;
      disk: number;
      errors: number;
    };
    notifications: string[];
  };
  retention: number; // days
  aggregation: number; // minutes
}

// Security Settings
export interface SecuritySettings {
  authentication: AuthenticationSettings;
  authorization: AuthorizationSettings;
  encryption: EncryptionSettings;
  audit: AuditSettings;
  network: NetworkSecuritySettings;
}

export interface AuthenticationSettings {
  method: 'password' | 'biometric' | 'smartcard' | '2fa' | 'sso';
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    maxAge: number; // days
    history: number;
    lockoutAttempts: number;
    lockoutDuration: number; // minutes
  };
  sessionTimeout: number; // minutes
  rememberMe: boolean;
  singleSignOn?: {
    enabled: boolean;
    provider: string;
    clientId: string;
    redirectUrl: string;
  };
  twoFactor?: {
    enabled: boolean;
    method: 'totp' | 'sms' | 'email';
    backupCodes: boolean;
  };
}

export interface AuthorizationSettings {
  roleBasedAccess: boolean;
  permissions: {
    [resource: string]: {
      [role: string]: string[]; // actions
    };
  };
  defaultRole: string;
  guestAccess: boolean;
  adminOverride: boolean;
  auditPermissions: boolean;
}

export interface EncryptionSettings {
  dataAtRest: {
    enabled: boolean;
    algorithm: string;
    keyRotation: number; // days
    keyDerivation: string;
  };
  dataInTransit: {
    enabled: boolean;
    tlsVersion: string;
    cipherSuites: string[];
    certificateValidation: boolean;
  };
  database: {
    enabled: boolean;
    algorithm: string;
    keyManagement: 'local' | 'hsm' | 'cloud';
  };
  backups: {
    enabled: boolean;
    algorithm: string;
    keyStorage: string;
  };
}

export interface AuditSettings {
  enabled: boolean;
  categories: {
    authentication: boolean;
    authorization: boolean;
    dataAccess: boolean;
    configuration: boolean;
    system: boolean;
    errors: boolean;
  };
  retention: number; // days
  tamperProof: boolean;
  realTimeAlerts: boolean;
  exportFormat: 'json' | 'xml' | 'csv';
  digitallySigned: boolean;
}

export interface NetworkSecuritySettings {
  firewall: {
    enabled: boolean;
    rules: {
      [rule: string]: {
        action: 'allow' | 'deny' | 'log';
        source: string;
        destination: string;
        port: number;
        protocol: 'tcp' | 'udp' | 'icmp';
      };
    };
  };
  proxy: {
    enabled: boolean;
    server: string;
    port: number;
    authentication: boolean;
    whitelist: string[];
    blacklist: string[];
  };
  vpn: {
    enabled: boolean;
    server: string;
    protocol: string;
    authentication: string;
    encryption: string;
  };
  intrusion: {
    detection: boolean;
    prevention: boolean;
    sensitivity: 'low' | 'medium' | 'high';
    alerts: boolean;
  };
}

// Configuration Management Types
export interface ConfigurationMetadata {
  version: string;
  created: string;
  modified: string;
  author: string;
  description: string;
  tags: string[];
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  size: number;
  platform: string;
  appVersion: string;
  schemaVersion: string;
}

export interface ConfigurationValidation {
  schema: string;
  rules: ValidationRule[];
  strictMode: boolean;
  warningsAsErrors: boolean;
}

export interface ValidationRule {
  path: string;
  type: 'required' | 'type' | 'range' | 'enum' | 'regex' | 'custom';
  message: string;
  severity: 'error' | 'warning' | 'info';
  validator?: (value: unknown, config: Record<string, unknown>) => boolean;
  parameters?: Record<string, unknown>;
}

export interface ConfigurationBackup {
  id: string;
  name: string;
  description: string;
  created: string;
  size: number;
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  automatic: boolean;
  retained: boolean;
  configuration: Partial<ConfigurationSchema>;
  metadata: ConfigurationMetadata;
}

export interface ConfigurationMigration {
  fromVersion: string;
  toVersion: string;
  description: string;
  reversible: boolean;
  migrate: (config: Record<string, unknown>) => Record<string, unknown>;
  rollback?: (config: Record<string, unknown>) => Record<string, unknown>;
  validate?: (config: Record<string, unknown>) => ValidationResult[];
}

export interface ValidationResult {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  value?: unknown;
  suggestion?: string;
}

export interface ConfigurationDiff {
  added: Array<{ path: string; value: unknown }>;
  modified: Array<{ path: string; oldValue: unknown; newValue: unknown }>;
  removed: Array<{ path: string; value: unknown }>;
}

export interface PlatformCapabilities {
  os: string;
  version: string;
  arch: string;
  features: string[];
  permissions: string[];
  paths: {
    config: string;
    data: string;
    temp: string;
    cache: string;
    logs: string;
  };
  limits: {
    maxMemory: number;
    maxStorage: number;
    maxFiles: number;
  };
}

// Events
export interface ConfigurationEvents {
  'config:loaded': (config: ConfigurationSchema) => void;
  'config:saved': (config: ConfigurationSchema) => void;
  'config:changed': (path: string, oldValue: unknown, newValue: unknown) => void;
  'config:validated': (results: ValidationResult[]) => void;
  'config:backup-created': (backup: ConfigurationBackup) => void;
  'config:backup-restored': (backup: ConfigurationBackup) => void;
  'config:migration-started': (migration: ConfigurationMigration) => void;
  'config:migration-completed': (migration: ConfigurationMigration) => void;
  'config:error': (error: Error, context: string) => void;
}