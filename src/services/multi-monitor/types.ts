export interface DisplayInfo {
  id: string;
  name: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  workArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scaleFactor: number;
  rotation: number;
  isPrimary: boolean;
  isInternal: boolean;
  colorDepth: number;
  accelerometerSupport: boolean;
  touchSupport: boolean;
  monochrome: boolean;
  displayFrequency?: number;
}

export interface WindowConfiguration {
  id: string;
  title: string;
  displayId: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  windowType: WindowType;
  alwaysOnTop: boolean;
  resizable: boolean;
  minimizable: boolean;
  maximizable: boolean;
  closable: boolean;
  fullscreenable: boolean;
  transparent: boolean;
  opacity: number;
  hasShadow: boolean;
  focusable: boolean;
  skipTaskbar: boolean;
  kiosk: boolean;
  frame: boolean;
  show: boolean;
  parent?: string;
  modal: boolean;
  webPreferences: {
    nodeIntegration: boolean;
    contextIsolation: boolean;
    enableRemoteModule: boolean;
    webSecurity: boolean;
  };
}

export enum WindowType {
  MAIN_CONTROL = 'main_control',
  MONITORING_DISPLAY = 'monitoring_display',
  DATA_STREAM = 'data_stream',
  EMF_VISUALIZATION = 'emf_visualization',
  AUDIO_ANALYZER = 'audio_analyzer',
  CAMERA_FEED = 'camera_feed',
  CORRELATION_MATRIX = 'correlation_matrix',
  ENVIRONMENTAL_METRICS = 'environmental_metrics',
  SESSION_TIMELINE = 'session_timeline',
  ALERT_PANEL = 'alert_panel',
  SETTINGS_PANEL = 'settings_panel',
  DEBUG_CONSOLE = 'debug_console'
}

export interface MonitoringInterface {
  id: string;
  type: MonitoringInterfaceType;
  displayId: string;
  windowId: string;
  dataStreams: DataStreamConfig[];
  layout: LayoutConfiguration;
  refreshRate: number;
  autoScale: boolean;
  interactionMode: InteractionMode;
  theme: InterfaceTheme;
  filters: DataFilter[];
  alerts: AlertConfiguration;
}

export enum MonitoringInterfaceType {
  LIVE_DASHBOARD = 'live_dashboard',
  STREAMING_CHARTS = 'streaming_charts',
  REAL_TIME_HEATMAP = 'real_time_heatmap',
  WAVEFORM_MONITOR = 'waveform_monitor',
  CORRELATION_VIEWER = 'correlation_viewer',
  ALERT_CENTER = 'alert_center',
  STATUS_BOARD = 'status_board',
  DATA_GRID = 'data_grid'
}

export interface DataStreamConfig {
  id: string;
  name: string;
  source: DataStreamSource;
  type: DataStreamType;
  updateInterval: number;
  bufferSize: number;
  compression: boolean;
  encryption: boolean;
  priority: StreamPriority;
  format: DataFormat;
  transform?: DataTransform;
}

export enum DataStreamSource {
  MOTION_DETECTOR = 'motion_detector',
  EMF_SENSOR = 'emf_sensor',
  AUDIO_ANALYZER = 'audio_analyzer',
  ENVIRONMENTAL_SENSOR = 'environmental_sensor',
  CAMERA_360 = 'camera_360',
  CORRELATION_ENGINE = 'correlation_engine',
  BASELINE_MONITOR = 'baseline_monitor',
  SENSITIVITY_CONTROLLER = 'sensitivity_controller'
}

export enum DataStreamType {
  TIME_SERIES = 'time_series',
  SPATIAL_DATA = 'spatial_data',
  FREQUENCY_SPECTRUM = 'frequency_spectrum',
  IMAGE_FEED = 'image_feed',
  EVENT_LOG = 'event_log',
  CORRELATION_MATRIX = 'correlation_matrix',
  STATUS_DATA = 'status_data',
  ALERT_STREAM = 'alert_stream'
}

export enum StreamPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  BACKGROUND = 'background'
}

export enum DataFormat {
  JSON = 'json',
  BINARY = 'binary',
  PROTOBUF = 'protobuf',
  COMPRESSED_JSON = 'compressed_json',
  WEBSOCKET = 'websocket',
  WEBRTC = 'webrtc'
}

export interface DataTransform {
  type: TransformType;
  parameters: Record<string, any>;
  pipeline: TransformStep[];
}

export enum TransformType {
  FILTER = 'filter',
  AGGREGATE = 'aggregate',
  NORMALIZE = 'normalize',
  DOWNSAMPLE = 'downsample',
  SMOOTH = 'smooth',
  THRESHOLD = 'threshold',
  CORRELATION = 'correlation'
}

export interface TransformStep {
  operation: string;
  parameters: Record<string, any>;
}

export interface LayoutConfiguration {
  type: LayoutType;
  columns: number;
  rows: number;
  widgets: WidgetConfiguration[];
  responsive: boolean;
  padding: number;
  margin: number;
  gap: number;
}

export enum LayoutType {
  GRID = 'grid',
  FLEX = 'flex',
  ABSOLUTE = 'absolute',
  MASONRY = 'masonry',
  TABS = 'tabs',
  ACCORDION = 'accordion'
}

export interface WidgetConfiguration {
  id: string;
  type: WidgetType;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  dataStream: string;
  properties: Record<string, any>;
  style: WidgetStyle;
  interactions: WidgetInteraction[];
}

export enum WidgetType {
  LINE_CHART = 'line_chart',
  BAR_CHART = 'bar_chart',
  HEATMAP = 'heatmap',
  GAUGE = 'gauge',
  STATUS_INDICATOR = 'status_indicator',
  DATA_TABLE = 'data_table',
  VIDEO_PLAYER = 'video_player',
  WAVEFORM = 'waveform',
  SPECTRUM_ANALYZER = 'spectrum_analyzer',
  CORRELATION_GRAPH = 'correlation_graph',
  MAP_VIEW = 'map_view',
  TEXT_DISPLAY = 'text_display',
  ALERT_LIST = 'alert_list',
  TIMELINE = 'timeline'
}

export interface WidgetStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
  fontColor: string;
  padding: number;
  margin: number;
  shadow: boolean;
  gradient?: string;
}

export interface WidgetInteraction {
  type: InteractionType;
  action: string;
  parameters: Record<string, any>;
}

export enum InteractionType {
  CLICK = 'click',
  DOUBLE_CLICK = 'double_click',
  RIGHT_CLICK = 'right_click',
  HOVER = 'hover',
  DRAG = 'drag',
  RESIZE = 'resize',
  KEYBOARD = 'keyboard'
}

export enum InteractionMode {
  READ_only = 'read_only',
  INTERACTIVE = 'interactive',
  CONTROL = 'control',
  HYBRID = 'hybrid'
}

export enum InterfaceTheme {
  DARK = 'dark',
  LIGHT = 'light',
  HIGH_CONTRAST = 'high_contrast',
  NIGHT_VISION = 'night_vision',
  CUSTOM = 'custom'
}

export interface DataFilter {
  id: string;
  name: string;
  type: FilterType;
  parameters: Record<string, any>;
  enabled: boolean;
}

export enum FilterType {
  TIME_RANGE = 'time_range',
  VALUE_RANGE = 'value_range',
  FREQUENCY_RANGE = 'frequency_range',
  SPATIAL_RANGE = 'spatial_range',
  THRESHOLD = 'threshold',
  MOVING_AVERAGE = 'moving_average',
  PATTERN = 'pattern'
}

export interface AlertConfiguration {
  enabled: boolean;
  rules: AlertRule[];
  notifications: NotificationConfig[];
  escalation: EscalationConfig;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  threshold: number;
  duration: number;
  severity: AlertSeverity;
  enabled: boolean;
  actions: AlertAction[];
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info'
}

export interface AlertCondition {
  metric: string;
  operator: ComparisonOperator;
  value: number;
  timeWindow: number;
  aggregation?: AggregationType;
}

export enum ComparisonOperator {
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN_OR_EQUAL = 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL = 'less_than_or_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains'
}

export enum AggregationType {
  AVERAGE = 'average',
  SUM = 'sum',
  COUNT = 'count',
  MIN = 'min',
  MAX = 'max',
  MEDIAN = 'median',
  PERCENTILE = 'percentile'
}

export interface AlertAction {
  type: AlertActionType;
  parameters: Record<string, any>;
  delay: number;
  retry: number;
}

export enum AlertActionType {
  NOTIFICATION = 'notification',
  EMAIL = 'email',
  SOUND = 'sound',
  HIGHLIGHT = 'highlight',
  POPUP = 'popup',
  LOG = 'log',
  WEBHOOK = 'webhook'
}

export interface NotificationConfig {
  type: NotificationType;
  enabled: boolean;
  settings: Record<string, any>;
}

export enum NotificationType {
  SYSTEM = 'system',
  BROWSER = 'browser',
  AUDIO = 'audio',
  VISUAL = 'visual',
  EMAIL = 'email',
  WEBHOOK = 'webhook'
}

export interface EscalationConfig {
  enabled: boolean;
  levels: EscalationLevel[];
  maxAttempts: number;
}

export interface EscalationLevel {
  level: number;
  delay: number;
  actions: AlertAction[];
}

export interface SessionLayout {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  displays: DisplayLayoutConfig[];
  windows: WindowConfiguration[];
  monitoringInterfaces: MonitoringInterface[];
  globalSettings: GlobalLayoutSettings;
  tags: string[];
  isDefault: boolean;
  isLocked: boolean;
}

export interface DisplayLayoutConfig {
  displayId: string;
  role: DisplayRole;
  windows: string[];
  priority: number;
}

export enum DisplayRole {
  PRIMARY_CONTROL = 'primary_control',
  SECONDARY_MONITORING = 'secondary_monitoring',
  DATA_VISUALIZATION = 'data_visualization',
  ALERT_DISPLAY = 'alert_display',
  STATUS_BOARD = 'status_board',
  DEBUG_CONSOLE = 'debug_console'
}

export interface GlobalLayoutSettings {
  autoArrange: boolean;
  snapToGrid: boolean;
  gridSize: number;
  theme: InterfaceTheme;
  animations: boolean;
  tooltips: boolean;
  shortcuts: KeyboardShortcut[];
  accessibility: AccessibilitySettings;
}

export interface KeyboardShortcut {
  key: string;
  modifiers: string[];
  action: string;
  context: string;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  largeText: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  reducedMotion: boolean;
  colorBlindSupport: boolean;
}

export interface WorkspaceTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  displayCount: number;
  layout: SessionLayout;
  previewImage?: string;
  requirements: TemplateRequirement[];
  compatibility: CompatibilityInfo;
  usage: UsageStatistics;
  ratings: TemplateRating;
}

export enum TemplateCategory {
  INVESTIGATION = 'investigation',
  SURVEILLANCE = 'surveillance',
  ANALYSIS = 'analysis',
  MONITORING = 'monitoring',
  DEBUGGING = 'debugging',
  PRESENTATION = 'presentation',
  CUSTOM = 'custom'
}

export interface TemplateRequirement {
  type: RequirementType;
  specification: string;
  optional: boolean;
}

export enum RequirementType {
  MIN_DISPLAYS = 'min_displays',
  MIN_RESOLUTION = 'min_resolution',
  HARDWARE = 'hardware',
  SOFTWARE = 'software',
  NETWORK = 'network'
}

export interface CompatibilityInfo {
  electronVersion: string[];
  operatingSystem: string[];
  minimumRAM: number;
  minimumStorage: number;
  gpuAcceleration: boolean;
}

export interface UsageStatistics {
  timesUsed: number;
  averageSessionDuration: number;
  lastUsed: number;
  userRating: number;
}

export interface TemplateRating {
  average: number;
  count: number;
  breakdown: Record<number, number>;
}

export interface WindowSpawnConfig {
  parentWindowId?: string;
  targetDisplayId: string;
  windowType: WindowType;
  position: WindowPosition;
  size: WindowSize;
  options: WindowOptions;
  lifecycle: WindowLifecycle;
}

export interface WindowPosition {
  x: number;
  y: number;
  anchor: PositionAnchor;
  offset?: { x: number; y: number };
}

export enum PositionAnchor {
  TOP_LEFT = 'top_left',
  TOP_CENTER = 'top_center',
  TOP_RIGHT = 'top_right',
  CENTER_LEFT = 'center_left',
  CENTER = 'center',
  CENTER_RIGHT = 'center_right',
  BOTTOM_LEFT = 'bottom_left',
  BOTTOM_CENTER = 'bottom_center',
  BOTTOM_RIGHT = 'bottom_right'
}

export interface WindowSize {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number;
}

export interface WindowOptions {
  title: string;
  icon?: string;
  backgroundColor?: string;
  transparent?: boolean;
  opacity?: number;
  alwaysOnTop?: boolean;
  skipTaskbar?: boolean;
  kiosk?: boolean;
  fullscreen?: boolean;
  simpleFullscreen?: boolean;
  frame?: boolean;
  titleBarStyle?: TitleBarStyle;
  resizable?: boolean;
  movable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  closable?: boolean;
  focusable?: boolean;
  show?: boolean;
  modal?: boolean;
  acceptFirstMouse?: boolean;
  disableAutoHideCursor?: boolean;
  enableLargerThanScreen?: boolean;
  darkTheme?: boolean;
}

export enum TitleBarStyle {
  DEFAULT = 'default',
  HIDDEN = 'hidden',
  HIDDEN_INSET = 'hiddenInset',
  CUSTOM_BUTTONS_ON_HOVER = 'customButtonsOnHover'
}

export interface WindowLifecycle {
  autoShow: boolean;
  showTimeout?: number;
  persistPosition: boolean;
  persistSize: boolean;
  restoreOnReopen: boolean;
  closeWithParent: boolean;
  destroyOnClose: boolean;
}

export interface MultiMonitorSession {
  id: string;
  name: string;
  description: string;
  startTime: number;
  endTime?: number;
  status: SessionStatus;
  layout: SessionLayout;
  activeWindows: ActiveWindow[];
  dataStreams: ActiveDataStream[];
  alerts: SessionAlert[];
  performance: SessionPerformance;
  settings: SessionSettings;
}

export enum SessionStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export interface ActiveWindow {
  windowId: string;
  displayId: string;
  processId: number;
  isVisible: boolean;
  isFocused: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  lastActivity: number;
}

export interface ActiveDataStream {
  streamId: string;
  source: DataStreamSource;
  bytesReceived: number;
  packetsReceived: number;
  lastUpdate: number;
  isHealthy: boolean;
  errors: number;
}

export interface SessionAlert {
  id: string;
  timestamp: number;
  severity: AlertSeverity;
  source: string;
  message: string;
  acknowledged: boolean;
  resolved: boolean;
}

export interface SessionPerformance {
  cpuUsage: number;
  memoryUsage: number;
  gpuUsage: number;
  networkBandwidth: number;
  frameRate: Record<string, number>;
  latency: Record<string, number>;
}

export interface SessionSettings {
  autoSave: boolean;
  saveInterval: number;
  logLevel: LogLevel;
  enablePerformanceMonitoring: boolean;
  enableDiagnostics: boolean;
  maxLogSize: number;
  compressionLevel: number;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface DisplayDetectionResult {
  displays: DisplayInfo[];
  changes: DisplayChange[];
  timestamp: number;
  capabilities: DisplayCapabilities;
}

export interface DisplayChange {
  type: DisplayChangeType;
  displayId: string;
  oldState?: Partial<DisplayInfo>;
  newState?: Partial<DisplayInfo>;
}

export enum DisplayChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
  MOVED = 'moved',
  RESIZED = 'resized',
  ROTATED = 'rotated',
  SCALE_CHANGED = 'scale_changed',
  PRIMARY_CHANGED = 'primary_changed'
}

export interface DisplayCapabilities {
  maxDisplays: number;
  supportedResolutions: Resolution[];
  supportedRefreshRates: number[];
  hdrSupport: boolean;
  wideColorGamut: boolean;
  touchSupport: boolean;
  penSupport: boolean;
}

export interface Resolution {
  width: number;
  height: number;
  aspectRatio: string;
}

export interface MonitoringConfiguration {
  globalRefreshRate: number;
  dataRetentionPeriod: number;
  maxConcurrentStreams: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  performanceOptimization: boolean;
  debugMode: boolean;
  logVerbosity: LogLevel;
}

export interface PositioningStrategy {
  type: PositioningType;
  parameters: Record<string, any>;
  fallback?: PositioningStrategy;
}

export enum PositioningType {
  AUTOMATIC = 'automatic',
  MANUAL = 'manual',
  TEMPLATE_BASED = 'template_based',
  SMART_ARRANGEMENT = 'smart_arrangement',
  CASCADE = 'cascade',
  TILE = 'tile',
  STACK = 'stack'
}