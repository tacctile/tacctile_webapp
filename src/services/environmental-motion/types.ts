export enum MotionDetectionAlgorithm {
  BACKGROUND_SUBTRACTION = 'background_subtraction',
  OPTICAL_FLOW = 'optical_flow',
  FRAME_DIFFERENCE = 'frame_difference',
  GAUSSIAN_MIXTURE = 'gaussian_mixture',
  TEMPORAL_DIFFERENCE = 'temporal_difference',
  EDGE_BASED = 'edge_based',
  AI_ENHANCED = 'ai_enhanced',
  HYBRID = 'hybrid'
}

export enum EMFFrequencyBand {
  ELF = 'elf',           // 3-30 Hz
  SLF = 'slf',           // 30-300 Hz
  ULF = 'ulf',           // 300-3000 Hz
  VLF = 'vlf',           // 3-30 kHz
  LF = 'lf',             // 30-300 kHz
  MF = 'mf',             // 300-3000 kHz
  HF = 'hf',             // 3-30 MHz
  VHF = 'vhf',           // 30-300 MHz
  UHF = 'uhf',           // 300-3000 MHz
  MICROWAVE = 'microwave' // > 3 GHz
}

export enum AudioFrequencyBand {
  INFRASONIC = 'infrasonic',     // < 20 Hz
  LOW_BASS = 'low_bass',         // 20-60 Hz
  BASS = 'bass',                 // 60-250 Hz
  LOW_MIDRANGE = 'low_midrange', // 250-500 Hz
  MIDRANGE = 'midrange',         // 500-2000 Hz
  HIGH_MIDRANGE = 'high_midrange', // 2-4 kHz
  PRESENCE = 'presence',         // 4-6 kHz
  BRILLIANCE = 'brilliance',     // 6-20 kHz
  ULTRASONIC = 'ultrasonic'      // > 20 kHz
}

export enum RecordingMode {
  STANDARD = 'standard',         // Single camera
  PANORAMIC_180 = 'panoramic_180',
  PANORAMIC_360 = 'panoramic_360',
  STEREO = 'stereo',            // Dual camera
  MULTI_ANGLE = 'multi_angle',   // Multiple fixed cameras
  TRACKING = 'tracking'          // PTZ camera following motion
}

export enum EnvironmentalSensor {
  TEMPERATURE = 'temperature',
  HUMIDITY = 'humidity',
  PRESSURE = 'pressure',
  VIBRATION = 'vibration',
  SEISMIC = 'seismic',
  MAGNETIC = 'magnetic',
  ELECTRIC_FIELD = 'electric_field',
  GRAVITY = 'gravity',
  RADIATION = 'radiation',
  AIR_QUALITY = 'air_quality'
}

export enum CorrelationMethod {
  TEMPORAL = 'temporal',         // Time-based correlation
  SPATIAL = 'spatial',           // Location-based correlation
  FREQUENCY = 'frequency',       // Frequency domain correlation
  CROSS_CORRELATION = 'cross_correlation',
  COHERENCE = 'coherence',
  MUTUAL_INFORMATION = 'mutual_information'
}

export interface MotionVector {
  x: number;
  y: number;
  magnitude: number;
  angle: number;
  confidence: number;
}

export interface MotionRegion {
  id: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  center: { x: number; y: number };
  area: number;
  velocity: MotionVector;
  timestamp: number;
  confidence: number;
  classification?: string;
}

export interface EMFReading {
  timestamp: number;
  frequencyBand: EMFFrequencyBand;
  intensity: number;        // in μT (microtesla) or V/m
  frequency: number;        // in Hz
  coordinates?: { x: number; y: number; z: number };
  fieldType: 'magnetic' | 'electric' | 'combined';
  source?: string;
}

export interface AudioReading {
  timestamp: number;
  frequencyBand: AudioFrequencyBand;
  amplitude: number;        // in dB
  frequency: number;        // in Hz
  waveform?: Float32Array;
  spectralData?: Float32Array;
  direction?: number;       // degrees from north
  classification?: string;
}

export interface EnvironmentalReading {
  timestamp: number;
  sensor: EnvironmentalSensor;
  value: number;
  unit: string;
  location?: { x: number; y: number; z: number };
  accuracy: number;
  calibrated: boolean;
}

export interface MotionEvent {
  id: string;
  timestamp: number;
  duration: number;
  motionRegions: MotionRegion[];
  emfReadings: EMFReading[];
  audioReadings: AudioReading[];
  environmentalReadings: EnvironmentalReading[];
  algorithm: MotionDetectionAlgorithm;
  confidence: number;
  classification?: {
    type: string;
    probability: number;
    characteristics: string[];
  };
  correlations: CorrelationAnalysis[];
}

export interface CorrelationAnalysis {
  id: string;
  method: CorrelationMethod;
  sources: string[];        // Which data sources were correlated
  coefficient: number;      // Correlation strength (-1 to 1)
  significance: number;     // Statistical significance (p-value)
  timeDelay?: number;       // Time delay between correlated events (ms)
  description: string;
}

export interface MotionDetectionSettings {
  algorithm: MotionDetectionAlgorithm;
  sensitivity: number;      // 0-100
  minimumObjectSize: number; // pixels
  maximumObjectSize: number; // pixels
  threshold: number;        // Detection threshold
  backgroundLearningRate: number; // For adaptive algorithms
  noiseReduction: boolean;
  morphologicalOps: boolean;
  contourFiltering: boolean;
  temporalFiltering: {
    enabled: boolean;
    frameHistory: number;
    consistencyThreshold: number;
  };
}

export interface EMFVisualizationSettings {
  colorMapping: {
    [key in EMFFrequencyBand]?: string;
  };
  intensityScale: 'linear' | 'logarithmic';
  fieldLines: boolean;
  heatmap: boolean;
  vectorField: boolean;
  threshold: number;
  updateRate: number;       // Hz
  averaging: {
    enabled: boolean;
    windowSize: number;
  };
}

export interface AudioVisualizationSettings {
  spectrogram: {
    enabled: boolean;
    windowSize: number;
    overlap: number;
    colormap: string;
  };
  waveform: {
    enabled: boolean;
    timeWindow: number;     // seconds
    amplitude: number;
  };
  frequencyBars: {
    enabled: boolean;
    bands: number;
    logScale: boolean;
  };
  spatialAudio: {
    enabled: boolean;
    directionality: boolean;
  };
}

export interface RecordingConfiguration {
  mode: RecordingMode;
  resolution: { width: number; height: number };
  frameRate: number;
  duration?: number;        // seconds, undefined for continuous
  quality: 'low' | 'medium' | 'high' | 'ultra';
  format: 'mp4' | 'avi' | 'mkv' | 'webm';
  audioEnabled: boolean;
  emfLogging: boolean;
  environmentalLogging: boolean;
  compression: boolean;
  outputPath?: string;
}

export interface EnvironmentalBaseline {
  id: string;
  timestamp: Date;
  duration: number;         // seconds
  location: string;
  conditions: {
    temperature: { mean: number; std: number; range: [number, number] };
    humidity: { mean: number; std: number; range: [number, number] };
    pressure: { mean: number; std: number; range: [number, number] };
    emf: {
      [band in EMFFrequencyBand]?: { mean: number; std: number; range: [number, number] };
    };
    audio: {
      backgroundLevel: number; // dB
      dominantFrequencies: number[];
      spectralProfile: Float32Array;
    };
    motion: {
      averageActivity: number;
      quietPeriods: number[];   // timestamps of low activity
      noiseSources: string[];
    };
  };
  isActive: boolean;
  confidence: number;
}

export interface SensitivitySettings {
  motion: {
    general: number;          // 0-100
    spatial: number;          // Spatial noise filtering
    temporal: number;         // Temporal consistency
    objectSize: {
      minimum: number;
      maximum: number;
    };
  };
  emf: {
    [band in EMFFrequencyBand]?: {
      threshold: number;
      sensitivity: number;
    };
  };
  audio: {
    [band in AudioFrequencyBand]?: {
      threshold: number;      // dB above baseline
      sensitivity: number;
    };
  };
  environmental: {
    [sensor in EnvironmentalSensor]?: {
      threshold: number;      // Change threshold
      sensitivity: number;
    };
  };
}

export interface Camera360Config {
  type: 'fisheye' | 'dual_fisheye' | 'multi_camera' | 'rotating_camera';
  calibration: {
    intrinsicMatrix: number[][];
    distortionCoefficients: number[];
    fov: number;              // degrees
    projection: 'equirectangular' | 'stereographic' | 'cylindrical';
  };
  stitching: {
    blending: boolean;
    featherRadius: number;
    exposureCompensation: boolean;
    seamFinderType: string;
  };
  unwrapping: {
    enabled: boolean;
    outputProjection: 'equirectangular' | 'cylindrical' | 'perspective';
    viewingAngle: number;
  };
}

export interface MotionAnalysisResult {
  timestamp: number;
  totalMotion: number;      // Overall motion intensity
  motionCenters: { x: number; y: number; intensity: number }[];
  dominantDirection: number; // degrees
  velocity: {
    average: number;
    maximum: number;
    distribution: number[];
  };
  patterns: {
    oscillatory: boolean;
    directional: boolean;
    random: boolean;
    periodic: {
      detected: boolean;
      period?: number;        // seconds
      confidence?: number;
    };
  };
  anomalies: {
    sudden: boolean;
    unusual: boolean;
    description?: string;
  };
}

export interface MultiSourceCorrelation {
  timestamp: number;
  correlations: {
    motionEmf: CorrelationAnalysis;
    motionAudio: CorrelationAnalysis;
    emfAudio: CorrelationAnalysis;
    motionEnvironmental: CorrelationAnalysis;
    emfEnvironmental: CorrelationAnalysis;
    audioEnvironmental: CorrelationAnalysis;
  };
  overallCorrelation: number;
  anomalyScore: number;
  interpretation: {
    likelySource: string;
    confidence: number;
    explanation: string;
  };
}

export interface VisualizationOverlay {
  id: string;
  type: 'motion_vectors' | 'emf_heatmap' | 'audio_spectrogram' | 'correlation_graph';
  enabled: boolean;
  opacity: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  settings: any;
  updateRate: number;       // Hz
}

export interface DetectionSession {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  location: string;
  baseline: EnvironmentalBaseline;
  settings: {
    motion: MotionDetectionSettings;
    emf: EMFVisualizationSettings;
    audio: AudioVisualizationSettings;
    sensitivity: SensitivitySettings;
    recording: RecordingConfiguration;
  };
  events: MotionEvent[];
  correlations: MultiSourceCorrelation[];
  statistics: SessionStatistics;
  status: 'preparing' | 'calibrating' | 'monitoring' | 'paused' | 'completed' | 'error';
}

export interface SessionStatistics {
  totalEvents: number;
  eventsByType: Map<string, number>;
  averageEventDuration: number;
  peakActivity: {
    timestamp: number;
    intensity: number;
  };
  quietPeriods: {
    start: number;
    duration: number;
  }[];
  correlationSummary: {
    strongCorrelations: number;
    moderateCorrelations: number;
    weakCorrelations: number;
  };
  dataQuality: {
    motionConfidence: number;
    emfReliability: number;
    audioClarity: number;
    environmentalStability: number;
  };
}

export interface CalibrationData {
  timestamp: Date;
  cameraCalibration: {
    intrinsicMatrix: number[][];
    distortionCoefficients: number[];
    reprojectionError: number;
  };
  emfCalibration: {
    baseline: EMFReading[];
    sensitivity: number[];
    calibrationMatrix: number[][];
  };
  audioCalibration: {
    backgroundNoise: Float32Array;
    frequencyResponse: Float32Array;
    microphoneCalibration: number[];
  };
  environmentalCalibration: {
    [sensor in EnvironmentalSensor]?: {
      offset: number;
      scale: number;
      accuracy: number;
    };
  };
  isValid: boolean;
  expiryDate: Date;
}

export interface MotionTrackingState {
  activeTrackers: Map<string, ObjectTracker>;
  trackingHistory: TrackingHistory[];
  predictions: MotionPrediction[];
  lostTracks: string[];
  trackingQuality: number;
}

export interface ObjectTracker {
  id: string;
  position: { x: number; y: number };
  velocity: MotionVector;
  acceleration: { x: number; y: number };
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  age: number;              // frames since creation
  lastSeen: number;         // timestamp
  classification?: {
    type: string;
    confidence: number;
  };
  predictedPath: { x: number; y: number }[];
}

export interface TrackingHistory {
  trackerId: string;
  positions: { x: number; y: number; timestamp: number }[];
  velocities: MotionVector[];
  events: string[];         // significant tracking events
}

export interface MotionPrediction {
  trackerId: string;
  predictedPosition: { x: number; y: number };
  confidence: number;
  timeHorizon: number;      // seconds
  probabilityField?: number[][]; // 2D probability distribution
}

export interface EMFVisualizationFrame {
  timestamp: number;
  fieldData: EMFFieldData;
  heatmapData?: number[][];
  vectorField?: { x: number; y: number; magnitude: number }[][];
  fieldLines?: { points: { x: number; y: number }[] }[];
  annotations: {
    sources: { x: number; y: number; intensity: number; label: string }[];
    anomalies: { x: number; y: number; type: string; severity: number }[];
  };
}

export interface EMFFieldData {
  width: number;
  height: number;
  resolution: number;       // meters per pixel
  readings: {
    [band in EMFFrequencyBand]?: number[][];
  };
  timestamp: number;
  units: 'tesla' | 'gauss' | 'vm' | 'am';
}

export interface AudioOverlayData {
  timestamp: number;
  spectrogram?: {
    frequencies: number[];
    times: number[];
    magnitudes: number[][];
  };
  waveform?: Float32Array;
  spatialData?: {
    direction: number;
    distance?: number;
    confidence: number;
  }[];
  frequencyPeaks: {
    frequency: number;
    amplitude: number;
    bandwidth: number;
  }[];
  classification?: {
    type: string;
    confidence: number;
    characteristics: string[];
  };
}

export interface DetectionAlert {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'motion' | 'emf' | 'audio' | 'environmental' | 'correlation';
  message: string;
  data: any;
  acknowledged: boolean;
  actions?: string[];      // Suggested actions
}

export interface SystemPerformance {
  frameRate: {
    current: number;
    target: number;
    average: number;
  };
  processingTime: {
    motion: number;         // ms per frame
    emf: number;
    audio: number;
    correlation: number;
  };
  memoryUsage: {
    total: number;          // MB
    available: number;
    buffers: number;
  };
  cpuUsage: number;         // percentage
  diskUsage: {
    recording: number;      // MB/s
    available: number;      // GB
  };
  networkUsage?: {
    upload: number;         // KB/s
    download: number;
  };
}

// Event types for the EventEmitter-based architecture
export interface EnvironmentalMotionEvents {
  'motion-detected': { event: MotionEvent };
  'emf-anomaly': { reading: EMFReading; anomaly: string };
  'audio-event': { reading: AudioReading; classification?: string };
  'correlation-found': { correlation: MultiSourceCorrelation };
  'baseline-established': { baseline: EnvironmentalBaseline };
  'calibration-complete': { calibration: CalibrationData };
  'alert-triggered': { alert: DetectionAlert };
  'session-started': { session: DetectionSession };
  'session-ended': { session: DetectionSession; summary: SessionStatistics };
  'tracking-update': { state: MotionTrackingState };
  'performance-update': { performance: SystemPerformance };
  'error': { error: Error; context: string };
}

// Configuration presets for different use cases
export const DETECTION_PRESETS = {
  PARANORMAL_INVESTIGATION: {
    name: 'Paranormal Investigation',
    description: 'High sensitivity for detecting subtle anomalies',
    settings: {
      motion: {
        algorithm: MotionDetectionAlgorithm.HYBRID,
        sensitivity: 85,
        minimumObjectSize: 10,
        threshold: 5
      },
      emf: {
        updateRate: 60,
        threshold: 0.1,
        fieldLines: true
      },
      audio: {
        infrasonic: true,
        ultrasonic: true,
        sensitivity: 90
      }
    }
  },
  SECURITY_MONITORING: {
    name: 'Security Monitoring',
    description: 'Balanced detection for security applications',
    settings: {
      motion: {
        algorithm: MotionDetectionAlgorithm.BACKGROUND_SUBTRACTION,
        sensitivity: 60,
        minimumObjectSize: 50,
        threshold: 15
      },
      emf: {
        updateRate: 10,
        threshold: 1.0,
        fieldLines: false
      },
      audio: {
        sensitivity: 50
      }
    }
  },
  SCIENTIFIC_RESEARCH: {
    name: 'Scientific Research',
    description: 'Maximum precision for research applications',
    settings: {
      motion: {
        algorithm: MotionDetectionAlgorithm.OPTICAL_FLOW,
        sensitivity: 95,
        minimumObjectSize: 5,
        threshold: 2
      },
      emf: {
        updateRate: 120,
        threshold: 0.05,
        fieldLines: true,
        vectorField: true
      },
      audio: {
        sensitivity: 95,
        fullSpectrum: true
      }
    }
  }
};