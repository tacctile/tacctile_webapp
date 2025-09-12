/**
 * Image Service Type Definitions
 */

export interface EditorConfig {
  useWebGL: boolean;
  maxTextureSize: number;
  preserveOriginal: boolean;
  autoSave: boolean;
}

export interface EditorState {
  isLoading: boolean;
  hasChanges: boolean;
  currentTool: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

export interface ImageLayer {
  id: string;
  name: string;
  imageData: ImageData;
  visible: boolean;
  opacity: number;
  blendMode: string;
  locked: boolean;
  mask?: ImageData;
  adjustments?: ImageAdjustments;
}

export interface ImageAdjustments {
  brightness: number;      // -1 to 1
  contrast: number;        // -1 to 1
  saturation: number;      // 0 to 2
  exposure: number;        // -2 to 2
  highlights: number;      // -1 to 1
  shadows: number;         // -1 to 1
  whites: number;          // -1 to 1
  blacks: number;          // -1 to 1
  temperature: number;     // -1 to 1 (blue to yellow)
  tint: number;           // -1 to 1 (green to magenta)
  vibrance: number;       // 0 to 2
  clarity: number;        // 0 to 1
  dehaze: number;         // 0 to 1
  vignette: number;       // 0 to 1
  grain: number;          // 0 to 1
}

export interface EditOperation {
  type: 'adjustment' | 'filter' | 'layer' | 'transform' | 'draw';
  data: any;
  timestamp: number;
  layer?: string;
}

export interface FilterDefinition {
  name: string;
  displayName: string;
  category: FilterCategory;
  params: FilterParam[];
  shader?: string;
  process?: (imageData: ImageData, params: any) => ImageData;
}

export enum FilterCategory {
  BASIC = 'basic',
  COLOR = 'color',
  BLUR = 'blur',
  SHARPEN = 'sharpen',
  NOISE = 'noise',
  ARTISTIC = 'artistic',
  DISTORTION = 'distortion',
  PARANORMAL = 'paranormal'
}

export interface FilterParam {
  name: string;
  type: 'number' | 'boolean' | 'select' | 'color';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface Histogram {
  red: Uint32Array;
  green: Uint32Array;
  blue: Uint32Array;
  luminance: Uint32Array;
  statistics: {
    mean: ChannelStats;
    median: ChannelStats;
    mode: ChannelStats;
    stdDev: ChannelStats;
    min: ChannelStats;
    max: ChannelStats;
  };
}

export interface ChannelStats {
  r: number;
  g: number;
  b: number;
  l: number;
}

export interface ImageAnomaly {
  type: AnomalyType;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  intensity: number;
  description: string;
  pixels?: Uint8ClampedArray;
}

export enum AnomalyType {
  ORB = 'orb',
  FIGURE = 'figure',
  SHADOW = 'shadow',
  MIST = 'mist',
  LIGHT_STREAK = 'light_streak',
  FACE = 'face',
  DISTORTION = 'distortion',
  ENERGY_FIELD = 'energy_field',
  UNKNOWN = 'unknown'
}

export interface WebGLShader {
  vertex: string;
  fragment: string;
  uniforms: { [key: string]: any };
  attributes?: { [key: string]: any };
}

export interface ExportOptions {
  format: 'png' | 'jpeg' | 'webp';
  quality: number;
  metadata?: boolean;
  watermark?: string;
}

export interface ColorSpace {
  name: 'sRGB' | 'AdobeRGB' | 'ProPhoto' | 'Linear';
  gamut: number[][];
  whitePoint: [number, number];
}

export interface NoiseProfile {
  luminance: {
    amount: number;
    frequency: number;
  };
  color: {
    amount: number;
    frequency: number;
  };
  pattern: 'gaussian' | 'uniform' | 'salt_pepper';
}

export interface SharpnessParams {
  amount: number;
  radius: number;
  threshold: number;
  masking: number;
}

export interface BlurParams {
  radius: number;
  sigma?: number;
  type: 'gaussian' | 'box' | 'motion' | 'radial' | 'zoom';
  angle?: number;
  centerX?: number;
  centerY?: number;
}

export interface EdgeDetectionParams {
  threshold: number;
  kernel: 'sobel' | 'prewitt' | 'roberts' | 'laplacian' | 'canny';
  direction?: 'horizontal' | 'vertical' | 'both';
}

export interface ColorBalance {
  shadows: {
    cyan_red: number;
    magenta_green: number;
    yellow_blue: number;
  };
  midtones: {
    cyan_red: number;
    magenta_green: number;
    yellow_blue: number;
  };
  highlights: {
    cyan_red: number;
    magenta_green: number;
    yellow_blue: number;
  };
  preserveLuminosity: boolean;
}

export interface CurvesAdjustment {
  rgb?: Point[];
  red?: Point[];
  green?: Point[];
  blue?: Point[];
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelsAdjustment {
  input: {
    black: number;
    gray: number;
    white: number;
  };
  output: {
    black: number;
    white: number;
  };
  channel: 'rgb' | 'red' | 'green' | 'blue';
}

export interface SelectionMask {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  feather: number;
  inverted: boolean;
}

export interface Transform {
  scale: { x: number; y: number };
  rotation: number;
  translation: { x: number; y: number };
  skew: { x: number; y: number };
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export interface Kernel {
  size: number;
  data: Float32Array;
  divisor?: number;
  offset?: number;
}

export interface ColorProfile {
  name: string;
  description: string;
  data: ArrayBuffer;
  type: 'ICC' | 'custom';
}

export interface MetadataExif {
  make?: string;
  model?: string;
  dateTime?: Date;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  flash?: boolean;
  gps?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
}

export interface ProcessingPipeline {
  stages: ProcessingStage[];
  cache: boolean;
  parallel: boolean;
}

export interface ProcessingStage {
  id: string;
  type: 'filter' | 'adjustment' | 'transform' | 'analysis';
  operation: string;
  params: any;
  enabled: boolean;
}