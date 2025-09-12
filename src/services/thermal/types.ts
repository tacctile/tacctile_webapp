/**
 * Thermal Detection Type Definitions
 */

export enum ThermalCameraType {
  FLIR_ONE = 'flir_one',
  FLIR_LEPTON = 'flir_lepton',
  SEEK_THERMAL = 'seek_thermal',
  OPTRIS_PI = 'optris_pi',
  HIKMICRO = 'hikmicro',
  GUIDE_IR = 'guide_ir',
  GENERIC_USB = 'generic_usb',
  NETWORK_THERMAL = 'network_thermal'
}

export enum ThermalStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  CALIBRATING = 'calibrating',
  STREAMING = 'streaming',
  RECORDING = 'recording',
  ERROR = 'error'
}

export interface ThermalCamera {
  id: string;
  name: string;
  type: ThermalCameraType;
  status: ThermalStatus;
  connection: ThermalConnection;
  capabilities: ThermalCapabilities;
  calibration?: ThermalCalibration;
  lastSeen: Date;
}

export interface ThermalConnection {
  type: 'usb' | 'network' | 'serial' | 'bluetooth';
  devicePath?: string;
  address?: string;
  port?: number;
  baudRate?: number;
  protocol?: 'radiometric' | 'agc' | 'raw14bit';
}

export interface ThermalCapabilities {
  resolution: ThermalResolution;
  temperatureRange: TemperatureRange;
  thermalSensitivity: number; // NETD in mK
  frameRate: number;
  spectralRange: SpectralRange;
  radiometricCapable: boolean;
  shutterless: boolean;
  supportedPalettes: ColorPalette[];
  focusType: 'fixed' | 'manual' | 'auto';
}

export interface ThermalResolution {
  width: number;
  height: number;
  pixelPitch: number; // micrometers
}

export interface TemperatureRange {
  min: number; // Celsius
  max: number; // Celsius
  accuracy: number; // ±°C
}

export interface SpectralRange {
  min: number; // micrometers
  max: number; // micrometers
}

export enum ColorPalette {
  IRON = 'iron',
  RAINBOW = 'rainbow',
  WHITE_HOT = 'white_hot',
  BLACK_HOT = 'black_hot',
  RED_HOT = 'red_hot',
  ARCTIC = 'arctic',
  GLOWBOW = 'glowbow',
  INSTALERT = 'instalert',
  LAVA = 'lava',
  MEDICAL = 'medical',
  SEPIA = 'sepia',
  CUSTOM = 'custom'
}

export interface ThermalFrame {
  timestamp: number;
  frameNumber: number;
  temperatureData: Float32Array; // Temperature values in Celsius
  width: number;
  height: number;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  emissivity: number;
  reflectedTemp: number;
  ambientTemp: number;
  metadata: ThermalFrameMetadata;
}

export interface ThermalFrameMetadata {
  shutterCount: number;
  fpaTemp: number; // Focal Plane Array temperature
  housingTemp: number;
  humidity?: number;
  distance?: number; // meters to target
  atmosphericTransmission?: number;
}

export interface TemperatureAnomaly {
  id: string;
  type: AnomalyType;
  position: ThermalPoint;
  area: ThermalRegion;
  temperature: TemperatureStats;
  duration: number; // milliseconds
  intensity: number; // 0-1 relative to background
  confidence: number;
  timestamp: number;
  frameNumber: number;
  description: string;
  metadata: AnomalyMetadata;
}

export enum AnomalyType {
  HOT_SPOT = 'hot_spot',
  COLD_SPOT = 'cold_spot',
  TEMPERATURE_GRADIENT = 'temperature_gradient',
  SUDDEN_CHANGE = 'sudden_change',
  MOVING_HEAT_SOURCE = 'moving_heat_source',
  PHANTOM_SIGNATURE = 'phantom_signature',
  THERMAL_SHADOW = 'thermal_shadow',
  HEAT_PLUME = 'heat_plume'
}

export interface ThermalPoint {
  x: number;
  y: number;
  temperature: number;
}

export interface ThermalRegion {
  boundingBox: ThermalBoundingBox;
  contour: ThermalPoint[];
  area: number; // pixels
  perimeter: number; // pixels
  centroid: ThermalPoint;
}

export interface ThermalBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemperatureStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  range: number;
}

export interface AnomalyMetadata {
  backgroundTemp: number;
  temperatureDelta: number;
  thermalGradient: number;
  movementVector?: ThermalVector;
  shapeAnalysis: ShapeAnalysis;
  temporalPattern: TemporalPattern;
  environmentalContext: EnvironmentalContext;
}

export interface ThermalVector {
  dx: number;
  dy: number;
  magnitude: number;
  angle: number; // radians
}

export interface ShapeAnalysis {
  aspectRatio: number;
  circularity: number;
  compactness: number;
  solidity: number;
  eccentricity: number;
}

export interface TemporalPattern {
  isRecurring: boolean;
  periodicity?: number; // seconds
  growthRate?: number; // temperature change per second
  stability: number; // 0-1, higher = more stable
}

export interface EnvironmentalContext {
  roomTemp: number;
  relativeHumidity?: number;
  airflow?: number;
  nearbyHeatSources: string[];
  timeOfDay: string;
  seasonalFactor: number;
}

export interface ThermalVisualization {
  palette: ColorPalette;
  temperatureRange: TemperatureRange;
  contrastSettings: ContrastSettings;
  overlaySettings: OverlaySettings;
  measurementTools: MeasurementTool[];
}

export interface ContrastSettings {
  autoAdjust: boolean;
  manualMin?: number;
  manualMax?: number;
  gamma: number;
  histogramEqualization: boolean;
  edgeEnhancement: number;
}

export interface OverlaySettings {
  showTemperatureValues: boolean;
  showIsotherms: boolean;
  isotherms: IsothermSettings[];
  showMeasurements: boolean;
  showAnomalies: boolean;
  showColorBar: boolean;
  transparency: number; // 0-1
}

export interface IsothermSettings {
  temperature: number;
  color: string;
  thickness: number;
  style: 'solid' | 'dashed' | 'dotted';
}

export interface MeasurementTool {
  id: string;
  type: 'spot' | 'line' | 'area' | 'circle';
  points: ThermalPoint[];
  temperature?: TemperatureStats;
  label: string;
  visible: boolean;
  color: string;
}

export interface ThermalCalibration {
  blackbodyTemp: number;
  emissivity: number;
  reflectedTemp: number;
  atmosphericTemp: number;
  relativeHumidity: number;
  distance: number;
  transmittance: number;
  timestamp: Date;
  accuracy: number;
  calibrationMatrix?: number[];
}

export interface ThermalRecording {
  id: string;
  cameraId: string;
  startTime: Date;
  endTime?: Date;
  frameCount: number;
  duration: number;
  outputPath: string;
  format: ThermalFormat;
  compressionSettings: CompressionSettings;
  status: 'recording' | 'stopped' | 'error';
  metadata: RecordingMetadata;
}

export enum ThermalFormat {
  RADIOMETRIC_MP4 = 'radiometric_mp4',
  VISUAL_MP4 = 'visual_mp4',
  SEQ_FILE = 'seq_file',
  TIFF_SEQUENCE = 'tiff_sequence',
  CSV_DATA = 'csv_data',
  HDF5 = 'hdf5',
  RAW_BINARY = 'raw_binary'
}

export interface CompressionSettings {
  lossless: boolean;
  quality: number; // 0-100
  framerate: number;
  bitrate?: number;
  codec?: string;
}

export interface RecordingMetadata {
  investigationType: string;
  location: string;
  investigatorName: string;
  equipment: string;
  environmentalConditions: EnvironmentalConditions;
  notes: string;
  anomaliesDetected: number;
  avgTemperature: number;
  tempVariation: number;
}

export interface EnvironmentalConditions {
  ambientTemp: number;
  humidity: number;
  barometricPressure?: number;
  windSpeed?: number;
  weatherConditions: string;
  indoorOutdoor: 'indoor' | 'outdoor';
}

export interface ThermalAlert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  message: string;
  temperature: number;
  threshold: number;
  position: ThermalPoint;
  timestamp: number;
  acknowledged: boolean;
  autoResolved: boolean;
  metadata: AlertMetadata;
}

export enum AlertType {
  TEMPERATURE_THRESHOLD = 'temperature_threshold',
  RAPID_CHANGE = 'rapid_change',
  ANOMALY_DETECTED = 'anomaly_detected',
  EQUIPMENT_OVERHEATING = 'equipment_overheating',
  CALIBRATION_DRIFT = 'calibration_drift',
  SYSTEM_ERROR = 'system_error'
}

export enum AlertPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AlertMetadata {
  source: string;
  relatedAlerts: string[];
  suggestedAction: string;
  autoAcknowledgeTime?: number;
  escalationLevel: number;
}

export interface ThermalAnalysis {
  sessionId: string;
  frameCount: number;
  duration: number;
  temperatureStatistics: GlobalTemperatureStats;
  anomalies: TemperatureAnomaly[];
  spatialAnalysis: SpatialAnalysis;
  temporalAnalysis: TemporalAnalysis;
  environmentalAnalysis: EnvironmentalAnalysis;
  recommendations: string[];
  confidence: number;
}

export interface GlobalTemperatureStats {
  overallMin: number;
  overallMax: number;
  overallMean: number;
  overallStdDev: number;
  temporalVariation: number;
  spatialVariation: number;
  hotSpotCount: number;
  coldSpotCount: number;
}

export interface SpatialAnalysis {
  heatMap: HeatMapData;
  thermalGradients: ThermalGradient[];
  symmetryAnalysis: SymmetryAnalysis;
  clusterAnalysis: ClusterAnalysis;
}

export interface HeatMapData {
  data: Float32Array;
  width: number;
  height: number;
  resolution: number; // pixels per meter
}

export interface ThermalGradient {
  startPoint: ThermalPoint;
  endPoint: ThermalPoint;
  gradient: number; // °C per meter
  direction: number; // radians
  strength: number; // magnitude
}

export interface SymmetryAnalysis {
  horizontalSymmetry: number; // 0-1
  verticalSymmetry: number; // 0-1
  radialSymmetry: number; // 0-1
  symmetryCenter: ThermalPoint;
}

export interface ClusterAnalysis {
  clusters: ThermalCluster[];
  optimalClusterCount: number;
  silhouetteScore: number;
}

export interface ThermalCluster {
  id: string;
  centroid: ThermalPoint;
  members: ThermalPoint[];
  averageTemp: number;
  variance: number;
  density: number;
}

export interface TemporalAnalysis {
  trendAnalysis: TrendAnalysis;
  periodicityAnalysis: PeriodicityAnalysis;
  changePoints: ChangePoint[];
  stabilityMetrics: StabilityMetrics;
}

export interface TrendAnalysis {
  overallTrend: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number; // 0-1
  linearFit: LinearFit;
  seasonalComponents: SeasonalComponent[];
}

export interface LinearFit {
  slope: number; // °C per minute
  intercept: number;
  rSquared: number;
  confidence: number;
}

export interface SeasonalComponent {
  period: number; // minutes
  amplitude: number; // °C
  phase: number; // radians
}

export interface PeriodicityAnalysis {
  dominantFrequencies: FrequencyComponent[];
  isPeriodic: boolean;
  periodStrength: number;
  noiseLevel: number;
}

export interface FrequencyComponent {
  frequency: number; // Hz
  amplitude: number;
  phase: number;
  significance: number;
}

export interface ChangePoint {
  timestamp: number;
  frameNumber: number;
  temperatureBefore: number;
  temperatureAfter: number;
  changeType: 'sudden' | 'gradual';
  significance: number;
  duration: number;
}

export interface StabilityMetrics {
  variance: number;
  meanAbsoluteDeviation: number;
  stabilityIndex: number; // 0-1, higher = more stable
  fluctuationRate: number; // changes per minute
}

export interface EnvironmentalAnalysis {
  ambientInfluence: number; // 0-1
  hvacImpact: number; // 0-1
  solarInfluence?: number; // 0-1
  occupancyEffect: number; // 0-1
  weatherCorrelation: number; // -1 to 1
}

export interface ThermalExportOptions {
  includeRawData: boolean;
  includeVisualImages: boolean;
  includeAnalysis: boolean;
  includeMetadata: boolean;
  temperatureUnit: 'celsius' | 'fahrenheit' | 'kelvin';
  imageFormat: 'png' | 'jpg' | 'tiff';
  dataFormat: 'csv' | 'json' | 'hdf5' | 'matlab';
  compression: boolean;
  quality: number; // 0-100
}

export interface ProcessingPipeline {
  preprocessing: PreprocessingStep[];
  detection: DetectionAlgorithm[];
  postprocessing: PostprocessingStep[];
  analysis: AnalysisStep[];
}

export interface PreprocessingStep {
  type: 'noise_reduction' | 'bad_pixel_correction' | 'non_uniformity_correction' | 'temporal_filter';
  parameters: { [key: string]: any };
  enabled: boolean;
}

export interface DetectionAlgorithm {
  name: string;
  type: 'threshold_based' | 'statistical' | 'edge_detection' | 'machine_learning';
  parameters: { [key: string]: any };
  enabled: boolean;
  sensitivity: number; // 0-1
}

export interface PostprocessingStep {
  type: 'morphological_ops' | 'region_growing' | 'contour_filtering' | 'temporal_coherence';
  parameters: { [key: string]: any };
  enabled: boolean;
}

export interface AnalysisStep {
  type: 'statistical_analysis' | 'pattern_recognition' | 'trend_analysis' | 'correlation_analysis';
  parameters: { [key: string]: any };
  enabled: boolean;
}

export interface ThermalSettings {
  camera: CameraSettings;
  detection: DetectionSettings;
  visualization: VisualizationSettings;
  recording: RecordingSettings;
  alerts: AlertSettings;
}

export interface CameraSettings {
  frameRate: number;
  integrationTime: number;
  gain: number;
  bias: number;
  shutterMode: 'auto' | 'manual';
  focusMode: 'auto' | 'manual' | 'fixed';
  temperatureRange: TemperatureRange;
}

export interface DetectionSettings {
  sensitivity: number; // 0-1
  minAnomalySize: number; // pixels
  maxAnomalySize: number; // pixels
  temperatureThreshold: number; // °C
  gradientThreshold: number; // °C/pixel
  temporalWindow: number; // frames
  backgroundUpdateRate: number; // 0-1
  noiseReduction: number; // 0-1
}

export interface VisualizationSettings {
  defaultPalette: ColorPalette;
  contrastMode: 'auto' | 'manual' | 'histogram';
  temperatureLabels: boolean;
  isotherms: boolean;
  measurementOverlays: boolean;
  anomalyHighlights: boolean;
  colorBarVisible: boolean;
  overlayOpacity: number; // 0-1
}

export interface RecordingSettings {
  defaultFormat: ThermalFormat;
  autoRecord: boolean;
  maxFileSize: number; // MB
  maxDuration: number; // minutes
  compressionLevel: number; // 0-9
  includeMetadata: boolean;
  radiometricData: boolean;
}

export interface AlertSettings {
  enableAlerts: boolean;
  temperatureAlerts: TemperatureAlertConfig[];
  anomalyAlerts: AnomalyAlertConfig;
  systemAlerts: SystemAlertConfig;
  notificationMethod: 'visual' | 'audio' | 'both';
  autoAcknowledgeTime: number; // seconds
}

export interface TemperatureAlertConfig {
  name: string;
  threshold: number;
  condition: 'above' | 'below';
  hysteresis: number; // °C
  region?: ThermalRegion;
  enabled: boolean;
  priority: AlertPriority;
}

export interface AnomalyAlertConfig {
  minIntensity: number; // 0-1
  minDuration: number; // milliseconds
  types: AnomalyType[];
  confidenceThreshold: number; // 0-1
  enabled: boolean;
}

export interface SystemAlertConfig {
  calibrationDrift: boolean;
  equipmentOverheating: boolean;
  connectionLoss: boolean;
  storageSpace: boolean;
  performanceIssues: boolean;
}

export interface ThermalSystemStatus {
  camera: ThermalStatus;
  recording: 'active' | 'stopped' | 'paused';
  analysis: 'running' | 'stopped';
  alerts: number;
  temperature: {
    current: number;
    min: number;
    max: number;
  };
  performance: {
    frameRate: number;
    processingLatency: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  storage: {
    available: number; // GB
    used: number; // GB
    recordingsCount: number;
  };
}

export interface ThermalEvent {
  type: 'anomaly_detected' | 'temperature_alert' | 'calibration_update' | 'recording_started' | 'recording_stopped';
  data: any;
  timestamp: number;
  source: string;
}