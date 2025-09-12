export enum SpectralBand {
  UV_A = 'uva',           // 315-400 nm
  UV_B = 'uvb',           // 280-315 nm  
  UV_C = 'uvc',           // 200-280 nm
  VISIBLE = 'visible',    // 400-700 nm
  RED = 'red',            // 620-750 nm
  GREEN = 'green',        // 495-570 nm
  BLUE = 'blue',          // 450-495 nm
  NIR = 'nir',            // 700-1000 nm (Near Infrared)
  SWIR = 'swir',          // 1000-2500 nm (Short-wave Infrared)
  MWIR = 'mwir',          // 3000-8000 nm (Mid-wave Infrared)
  LWIR = 'lwir',          // 8000-15000 nm (Long-wave Infrared)
  FULL_SPECTRUM = 'full'  // Complete range
}

export enum SpectralFilterType {
  BANDPASS = 'bandpass',
  LONGPASS = 'longpass',
  SHORTPASS = 'shortpass',
  NOTCH = 'notch',
  NEUTRAL_DENSITY = 'neutral_density',
  POLARIZING = 'polarizing',
  DICHROIC = 'dichroic'
}

export enum PolarizationState {
  LINEAR_0 = 'linear_0',       // 0 degrees
  LINEAR_45 = 'linear_45',     // 45 degrees
  LINEAR_90 = 'linear_90',     // 90 degrees
  LINEAR_135 = 'linear_135',   // 135 degrees
  CIRCULAR_LEFT = 'circular_left',
  CIRCULAR_RIGHT = 'circular_right',
  UNPOLARIZED = 'unpolarized'
}

export enum MultiSpectralCameraType {
  UV_SPECIALIZED = 'uv_specialized',
  IR_SPECIALIZED = 'ir_specialized',
  FULL_SPECTRUM = 'full_spectrum',
  HYPERSPECTRAL = 'hyperspectral',
  FILTER_WHEEL = 'filter_wheel',
  POLARIMETRIC = 'polarimetric'
}

export enum ComparisonMode {
  SIDE_BY_SIDE = 'side_by_side',
  OVERLAY = 'overlay',
  DIFFERENCE = 'difference',
  RATIO = 'ratio',
  COMPOSITE = 'composite',
  ANIMATION = 'animation',
  SPLIT_VIEW = 'split_view'
}

export enum ExposureMode {
  AUTO = 'auto',
  MANUAL = 'manual',
  PRIORITY = 'priority',
  BRACKETING = 'bracketing',
  HDR = 'hdr'
}

export interface SpectralFilter {
  id: string;
  name: string;
  type: SpectralFilterType;
  spectralBand: SpectralBand;
  centerWavelength: number;    // nm
  bandwidth: number;           // nm
  transmittance: number;       // 0-1
  position?: number;           // For filter wheel
  polarization?: PolarizationState;
  manufacturer?: string;
  partNumber?: string;
  isActive: boolean;
}

export interface SpectralFrame {
  id: string;
  timestamp: number;
  frameNumber: number;
  spectralBand: SpectralBand;
  wavelengthRange: {
    min: number;
    max: number;
  };
  imageData: ImageData;
  rawData?: Float32Array;      // Raw sensor values
  width: number;
  height: number;
  exposureTime: number;        // ms
  gain: number;
  filter?: SpectralFilter;
  polarization?: PolarizationState;
  metadata: SpectralFrameMetadata;
}

export interface SpectralFrameMetadata {
  captureSettings: {
    iso: number;
    aperture: number;
    shutterSpeed: number;
    whiteBalance: number;
    focusDistance?: number;
  };
  environmentalData: {
    temperature: number;
    humidity: number;
    pressure: number;
    lightLevel: number;
  };
  calibration: {
    darkFrame?: boolean;
    flatField?: boolean;
    spectralResponse?: number[];
  };
  processing: {
    demosaiced: boolean;
    corrected: boolean;
    normalized: boolean;
  };
}

export interface MultiSpectralCamera {
  id: string;
  name: string;
  type: MultiSpectralCameraType;
  manufacturer: string;
  model: string;
  connection: {
    type: 'usb' | 'ethernet' | 'serial' | 'wireless';
    address: string;
    port?: number;
  };
  capabilities: {
    supportedBands: SpectralBand[];
    maxResolution: { width: number; height: number };
    minExposure: number;
    maxExposure: number;
    gainRange: { min: number; max: number };
    hasFilterWheel: boolean;
    hasPolarizer: boolean;
    bitDepth: number;
    frameRate: number;
  };
  status: 'disconnected' | 'connecting' | 'connected' | 'capturing' | 'error';
  currentSettings: SpectralCaptureSettings;
}

export interface SpectralCaptureSettings {
  spectralBand: SpectralBand;
  exposureMode: ExposureMode;
  exposureTime: number;        // ms
  gain: number;
  binning: { x: number; y: number };
  roi: { x: number; y: number; width: number; height: number };
  filter?: SpectralFilter;
  polarization?: PolarizationState;
  captureSequence?: SpectralSequence;
}

export interface SpectralSequence {
  id: string;
  name: string;
  bands: SpectralBand[];
  exposureTimes: number[];     // Per band
  gains: number[];             // Per band
  filters: (SpectralFilter | null)[];
  polarizations: (PolarizationState | null)[];
  captureDelay: number;        // ms between captures
  autoWhiteBalance: boolean;
  darkFrameCapture: boolean;
}

export interface FilterWheel {
  id: string;
  name: string;
  positions: number;
  currentPosition: number;
  filters: (SpectralFilter | null)[];
  isMoving: boolean;
  homePosition: number;
  speed: number;               // positions/second
}

export interface PolarizationController {
  id: string;
  name: string;
  type: 'manual' | 'motorized' | 'liquid_crystal';
  currentState: PolarizationState;
  availableStates: PolarizationState[];
  rotationAngle: number;       // degrees
  isRotating: boolean;
  rotationSpeed: number;       // degrees/second
}

export interface SpectralExposureSettings {
  [SpectralBand.UV_A]: number;
  [SpectralBand.UV_B]: number;
  [SpectralBand.UV_C]: number;
  [SpectralBand.VISIBLE]: number;
  [SpectralBand.RED]: number;
  [SpectralBand.GREEN]: number;
  [SpectralBand.BLUE]: number;
  [SpectralBand.NIR]: number;
  [SpectralBand.SWIR]: number;
  [SpectralBand.MWIR]: number;
  [SpectralBand.LWIR]: number;
  [SpectralBand.FULL_SPECTRUM]: number;
}

export interface MultiSpectralRecording {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'paused' | 'stopped' | 'completed' | 'error';
  frameCount: number;
  bands: SpectralBand[];
  outputPath: string;
  format: MultiSpectralFormat;
  compression: boolean;
  metadata: MultiSpectralRecordingMetadata;
}

export interface MultiSpectralRecordingMetadata {
  camera: MultiSpectralCamera;
  captureSettings: SpectralCaptureSettings;
  sequence?: SpectralSequence;
  environmentalConditions: {
    temperature: number;
    humidity: number;
    pressure: number;
    lightLevel: number;
  };
  calibrationData?: {
    darkFrames: string[];
    flatFields: string[];
    spectralResponse: string;
  };
}

export enum MultiSpectralFormat {
  TIFF_SEQUENCE = 'tiff_sequence',
  HDF5 = 'hdf5',
  ENVI = 'envi',
  NETCDF = 'netcdf',
  RAW_BINARY = 'raw_binary',
  MATLAB = 'matlab',
  FITS = 'fits'
}

export interface ComparisonVisualization {
  id: string;
  mode: ComparisonMode;
  frames: SpectralFrame[];
  settings: ComparisonSettings;
  outputCanvas?: HTMLCanvasElement;
}

export interface ComparisonSettings {
  opacity: number;             // For overlay mode
  colorMapping: {
    [key in SpectralBand]?: string; // CSS color
  };
  normalization: 'none' | 'minmax' | 'histogram' | 'zscore';
  enhancement: {
    contrast: number;
    brightness: number;
    gamma: number;
  };
  falseColor: boolean;
  interpolation: 'nearest' | 'bilinear' | 'bicubic';
}

export interface SpectralAnalysisResult {
  reflectanceSpectrum?: number[];
  absorptionPeaks?: number[];
  spectralIndices?: {
    ndvi?: number;           // Normalized Difference Vegetation Index
    ndwi?: number;           // Normalized Difference Water Index
    evi?: number;            // Enhanced Vegetation Index
    savi?: number;           // Soil Adjusted Vegetation Index
  };
  materialClassification?: string[];
  anomalyDetection?: {
    anomalies: { x: number; y: number; confidence: number }[];
    threshold: number;
  };
}

export interface MultiSpectralCalibration {
  id: string;
  name: string;
  timestamp: Date;
  camera: string;
  spectralBands: SpectralBand[];
  calibrationType: 'dark' | 'flat' | 'spectral_response' | 'geometric';
  calibrationData: {
    darkFrames?: { [band: string]: Float32Array };
    flatFields?: { [band: string]: Float32Array };
    spectralResponse?: { [band: string]: number[] };
    geometricTransform?: number[][];
  };
  isActive: boolean;
  quality: {
    signalToNoise: number;
    uniformity: number;
    accuracy: number;
  };
}

export interface SpectralImageProcessingParams {
  demosaicing: {
    algorithm: 'bilinear' | 'malvar' | 'ahd' | 'vng';
    colorSpace: 'rgb' | 'xyz' | 'lab';
  };
  calibration: {
    applyDarkFrame: boolean;
    applyFlatField: boolean;
    applySpectralResponse: boolean;
  };
  enhancement: {
    autoLevels: boolean;
    gammaCorrection: number;
    contrastEnhancement: boolean;
    noiseReduction: boolean;
  };
  registration: {
    enabled: boolean;
    referenceFrame: number;
    algorithm: 'phase_correlation' | 'optical_flow' | 'feature_matching';
  };
}

export interface MultiSpectralWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  isActive: boolean;
  autoExecute: boolean;
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'capture' | 'calibration' | 'processing' | 'analysis' | 'export';
  parameters: any;
  enabled: boolean;
  order: number;
  dependencies?: string[];
}

export interface SpectralROI {
  id: string;
  name: string;
  coordinates: { x: number; y: number }[];
  spectralBand: SpectralBand;
  isActive: boolean;
  statistics?: {
    mean: number;
    std: number;
    min: number;
    max: number;
    histogram: number[];
  };
}

export interface MultiSpectralEvent {
  timestamp: Date;
  type: 'capture' | 'calibration' | 'error' | 'warning' | 'info';
  source: string;
  message: string;
  data?: any;
}

export interface SpectralBandInfo {
  band: SpectralBand;
  wavelengthRange: { min: number; max: number };
  commonApplications: string[];
  typicalExposure: number;
  description: string;
}

// Predefined spectral band information
export const SPECTRAL_BAND_INFO: Record<SpectralBand, SpectralBandInfo> = {
  [SpectralBand.UV_A]: {
    band: SpectralBand.UV_A,
    wavelengthRange: { min: 315, max: 400 },
    commonApplications: ['Fluorescence', 'Authentication', 'Material analysis'],
    typicalExposure: 50,
    description: 'Long-wave ultraviolet, useful for fluorescence imaging'
  },
  [SpectralBand.UV_B]: {
    band: SpectralBand.UV_B,
    wavelengthRange: { min: 280, max: 315 },
    commonApplications: ['Sterilization', 'Medical', 'Forensics'],
    typicalExposure: 100,
    description: 'Medium-wave ultraviolet, biologically active'
  },
  [SpectralBand.UV_C]: {
    band: SpectralBand.UV_C,
    wavelengthRange: { min: 200, max: 280 },
    commonApplications: ['Disinfection', 'Spectroscopy', 'Research'],
    typicalExposure: 200,
    description: 'Short-wave ultraviolet, germicidal range'
  },
  [SpectralBand.VISIBLE]: {
    band: SpectralBand.VISIBLE,
    wavelengthRange: { min: 400, max: 700 },
    commonApplications: ['Photography', 'Microscopy', 'General imaging'],
    typicalExposure: 10,
    description: 'Human-visible spectrum'
  },
  [SpectralBand.RED]: {
    band: SpectralBand.RED,
    wavelengthRange: { min: 620, max: 750 },
    commonApplications: ['Vegetation analysis', 'Medical', 'Astronomy'],
    typicalExposure: 15,
    description: 'Red portion of visible spectrum'
  },
  [SpectralBand.GREEN]: {
    band: SpectralBand.GREEN,
    wavelengthRange: { min: 495, max: 570 },
    commonApplications: ['Plant health', 'Underwater', 'Microscopy'],
    typicalExposure: 8,
    description: 'Green portion of visible spectrum'
  },
  [SpectralBand.BLUE]: {
    band: SpectralBand.BLUE,
    wavelengthRange: { min: 450, max: 495 },
    commonApplications: ['Atmospheric', 'Water quality', 'Fluorescence'],
    typicalExposure: 12,
    description: 'Blue portion of visible spectrum'
  },
  [SpectralBand.NIR]: {
    band: SpectralBand.NIR,
    wavelengthRange: { min: 700, max: 1000 },
    commonApplications: ['Vegetation', 'Agriculture', 'Remote sensing'],
    typicalExposure: 25,
    description: 'Near-infrared, vegetation analysis'
  },
  [SpectralBand.SWIR]: {
    band: SpectralBand.SWIR,
    wavelengthRange: { min: 1000, max: 2500 },
    commonApplications: ['Mineral mapping', 'Moisture detection', 'Geology'],
    typicalExposure: 50,
    description: 'Short-wave infrared, material identification'
  },
  [SpectralBand.MWIR]: {
    band: SpectralBand.MWIR,
    wavelengthRange: { min: 3000, max: 8000 },
    commonApplications: ['Thermal imaging', 'Gas detection', 'Military'],
    typicalExposure: 30,
    description: 'Mid-wave infrared, thermal applications'
  },
  [SpectralBand.LWIR]: {
    band: SpectralBand.LWIR,
    wavelengthRange: { min: 8000, max: 15000 },
    commonApplications: ['Thermal imaging', 'Building inspection', 'Medical'],
    typicalExposure: 40,
    description: 'Long-wave infrared, thermal imaging'
  },
  [SpectralBand.FULL_SPECTRUM]: {
    band: SpectralBand.FULL_SPECTRUM,
    wavelengthRange: { min: 200, max: 15000 },
    commonApplications: ['Research', 'Scientific analysis', 'Comprehensive imaging'],
    typicalExposure: 20,
    description: 'Full electromagnetic spectrum coverage'
  }
};