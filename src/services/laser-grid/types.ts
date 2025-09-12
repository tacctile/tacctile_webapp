/**
 * Laser Grid Detection Type Definitions
 */

export enum LaserType {
  RED_DOT = 'red_dot',
  GREEN_DOT = 'green_dot',
  INFRARED = 'infrared',
  BLUE_DOT = 'blue_dot',
  MULTI_COLOR = 'multi_color'
}

export enum ProjectorType {
  USB_LASER = 'usb_laser',
  SERIAL_LASER = 'serial_laser',
  NETWORK_LASER = 'network_laser',
  ARDUINO_CONTROLLED = 'arduino_controlled',
  RASPBERRY_PI = 'raspberry_pi',
  CUSTOM_HARDWARE = 'custom_hardware'
}

export enum LaserStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CALIBRATING = 'calibrating',
  PROJECTING = 'projecting',
  RECORDING = 'recording',
  ERROR = 'error'
}

export interface LaserProjector {
  id: string;
  name: string;
  type: ProjectorType;
  laserType: LaserType;
  status: LaserStatus;
  connection: ProjectorConnection;
  capabilities: ProjectorCapabilities;
  currentPattern?: GridPattern;
  lastSeen: Date;
}

export interface ProjectorConnection {
  type: 'usb' | 'serial' | 'network' | 'gpio';
  port?: string;
  address?: string;
  baudRate?: number;
  devicePath?: string;
}

export interface ProjectorCapabilities {
  maxPower: number;           // mW
  wavelength: number;         // nm
  beamDivergence: number;     // mrad
  maxProjectionDistance: number; // meters
  supportedPatterns: PatternType[];
  hasPowerControl: boolean;
  hasColorControl: boolean;
  hasPatternControl: boolean;
  maxDots: number;
}

export enum PatternType {
  GRID = 'grid',
  RANDOM_DOTS = 'random_dots',
  CONCENTRIC_CIRCLES = 'concentric_circles',
  SPIRAL = 'spiral',
  CROSS_HATCH = 'cross_hatch',
  CONSTELLATION = 'constellation',
  CUSTOM = 'custom'
}

export interface GridPattern {
  id: string;
  name: string;
  type: PatternType;
  dots: LaserDot[];
  bounds: PatternBounds;
  intensity: number;      // 0-1
  color: LaserColor;
  animationSpeed?: number; // For moving patterns
  parameters: PatternParameters;
}

export interface LaserDot {
  id: string;
  position: Vector2;
  intensity: number;
  color: LaserColor;
  size: number;          // Beam diameter in pixels
  enabled: boolean;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface LaserColor {
  r: number;
  g: number;
  b: number;
  wavelength?: number;
}

export interface PatternBounds {
  width: number;         // Pattern width in degrees
  height: number;        // Pattern height in degrees
  centerX: number;       // Center offset X
  centerY: number;       // Center offset Y
  rotation: number;      // Pattern rotation in degrees
}

export interface PatternParameters {
  spacing?: number;      // Dot spacing for grid patterns
  density?: number;      // Dot density for random patterns
  radius?: number;       // Radius for circular patterns
  layers?: number;       // Number of layers for complex patterns
  customData?: any;      // Pattern-specific parameters
}

export interface GridDisturbance {
  id: string;
  timestamp: number;
  frameNumber: number;
  affectedDots: string[];
  disturbanceType: DisturbanceType;
  intensity: number;
  position: Vector2;
  size: Vector2;
  duration: number;      // milliseconds
  confidence: number;
  metadata: DisturbanceMetadata;
}

export enum DisturbanceType {
  DOT_OCCLUSION = 'dot_occlusion',      // Dots blocked
  DOT_DISPLACEMENT = 'dot_displacement', // Dots moved
  DOT_DIMMING = 'dot_dimming',          // Dots dimmed
  DOT_BRIGHTENING = 'dot_brightening',   // Dots brightened
  PATTERN_DISTORTION = 'pattern_distortion', // Pattern warped
  SHADOW_CAST = 'shadow_cast',          // Shadow in grid
  INTERFERENCE = 'interference',         // External light interference
  UNKNOWN = 'unknown'
}

export interface DisturbanceMetadata {
  originalPositions: Vector2[];
  currentPositions: Vector2[];
  originalIntensities: number[];
  currentIntensities: number[];
  velocityVector?: Vector2;
  boundingBox: BoundingBox2D;
  classification: string;
}

export interface BoundingBox2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectionSettings {
  sensitivity: number;           // 0-1
  minimumDisturbanceSize: number; // pixels
  minimumDuration: number;       // milliseconds
  occlusionThreshold: number;    // 0-1
  motionThreshold: number;       // pixels/frame
  noiseReduction: number;        // 0-1
  temporalFiltering: boolean;
  spatialFiltering: boolean;
  autoCalibration: boolean;
}

export interface CameraFrame {
  imageData: Uint8Array;
  width: number;
  height: number;
  timestamp: number;
  frameNumber: number;
  exposure: number;
  gain: number;
}

export interface ProcessedFrame {
  originalFrame: CameraFrame;
  detectedDots: DetectedDot[];
  disturbances: GridDisturbance[];
  gridAlignment: GridAlignment;
  timestamp: number;
}

export interface DetectedDot {
  id?: string;
  position: Vector2;
  intensity: number;
  size: number;
  confidence: number;
  matched: boolean;      // Matched to expected grid position
  expectedPosition?: Vector2;
  displacement?: Vector2;
}

export interface GridAlignment {
  rotation: number;
  scale: Vector2;
  translation: Vector2;
  confidence: number;
  calibrationMatrix: number[]; // 3x3 transformation matrix
}

export interface RecordingSession {
  id: string;
  projectorId: string;
  startTime: Date;
  endTime?: Date;
  pattern: GridPattern;
  settings: DetectionSettings;
  frameCount: number;
  disturbanceCount: number;
  outputPath: string;
  status: 'recording' | 'stopped' | 'error';
}

export interface DisturbanceEvent {
  session: RecordingSession;
  disturbance: GridDisturbance;
  context: {
    frameBefore: CameraFrame;
    frameAfter: CameraFrame;
    ambientConditions: AmbientConditions;
  };
}

export interface AmbientConditions {
  lightLevel: number;    // lux
  temperature?: number;  // celsius
  humidity?: number;     // percentage
  timestamp: number;
}

export interface CalibrationData {
  projectorId: string;
  cameraMatrix: number[];    // 3x3 camera intrinsics
  distortionCoeffs: number[]; // Lens distortion coefficients
  projectionMatrix: number[]; // Projector-camera transformation
  gridTransform: number[];    // Grid-to-camera coordinate transform
  timestamp: Date;
  accuracy: number;          // Calibration accuracy score
}

export interface VisualizationConfig {
  showOriginalDots: boolean;
  showDetectedDots: boolean;
  showDisturbances: boolean;
  showTrails: boolean;
  showGrid: boolean;
  overlayOpacity: number;
  disturbanceColor: string;
  trailLength: number;       // frames
  highlightThreshold: number; // confidence threshold for highlighting
}

export interface HardwareConfig {
  projector: LaserProjector;
  camera: CameraConfig;
  synchronization: SyncConfig;
  safety: SafetyConfig;
}

export interface CameraConfig {
  deviceId: string;
  resolution: { width: number; height: number };
  frameRate: number;
  exposure: number;
  gain: number;
  whiteBalance: number;
  focus: number;
  autoExposure: boolean;
}

export interface SyncConfig {
  enabled: boolean;
  triggerSource: 'camera' | 'projector' | 'external';
  frequency: number;         // Hz
  phase: number;            // degrees
}

export interface SafetyConfig {
  maxPowerOutput: number;    // mW
  shutoffTimeout: number;    // seconds
  temperatureMonitoring: boolean;
  emergencyStop: boolean;
  safetyInterlocks: string[];
}

export interface PatternTemplate {
  name: string;
  type: PatternType;
  description: string;
  defaultParameters: PatternParameters;
  previewImage?: string;
  category: 'basic' | 'advanced' | 'paranormal' | 'custom';
}

export interface DetectionAlgorithm {
  name: string;
  type: 'blob_detection' | 'template_matching' | 'optical_flow' | 'neural_network';
  parameters: { [key: string]: any };
  enabled: boolean;
  weight: number;           // Algorithm weight in ensemble
}

export interface ProcessingPipeline {
  preprocessing: PreprocessingStep[];
  detection: DetectionAlgorithm[];
  postprocessing: PostprocessingStep[];
  validation: ValidationStep[];
}

export interface PreprocessingStep {
  type: 'gaussian_blur' | 'median_filter' | 'background_subtraction' | 'histogram_equalization';
  parameters: { [key: string]: any };
  enabled: boolean;
}

export interface PostprocessingStep {
  type: 'morphological_ops' | 'contour_filtering' | 'cluster_analysis' | 'temporal_coherence';
  parameters: { [key: string]: any };
  enabled: boolean;
}

export interface ValidationStep {
  type: 'size_filter' | 'intensity_filter' | 'geometry_check' | 'temporal_consistency';
  parameters: { [key: string]: any };
  enabled: boolean;
}

export interface AnalysisResult {
  sessionId: string;
  totalDisturbances: number;
  significantEvents: GridDisturbance[];
  statisticalSummary: DisturbanceStatistics;
  recommendations: string[];
  confidence: number;
}

export interface DisturbanceStatistics {
  averageIntensity: number;
  averageDuration: number;
  spatialDistribution: { [key: string]: number };
  temporalDistribution: { [key: string]: number };
  typeDistribution: { [key in DisturbanceType]: number };
  peakActivity: {
    time: number;
    intensity: number;
    location: Vector2;
  };
}

export interface ExportFormat {
  type: 'video' | 'images' | 'csv' | 'json' | 'pdf_report';
  options: ExportOptions;
}

export interface ExportOptions {
  includeOriginal: boolean;
  includeOverlays: boolean;
  includeAnalysis: boolean;
  compression?: string;
  quality?: number;
  frameRange?: { start: number; end: number };
}

export interface GridEvent {
  type: 'disturbance_detected' | 'pattern_changed' | 'calibration_updated' | 'session_started' | 'session_ended';
  data: any;
  timestamp: number;
}

export interface SystemStatus {
  projector: LaserStatus;
  camera: 'connected' | 'disconnected' | 'error';
  detection: 'active' | 'paused' | 'stopped';
  recording: 'active' | 'paused' | 'stopped';
  lastUpdate: Date;
  performance: PerformanceMetrics;
}

export interface PerformanceMetrics {
  frameRate: number;
  processingLatency: number; // milliseconds
  cpuUsage: number;         // percentage
  memoryUsage: number;      // MB
  detectionAccuracy: number; // 0-1
}