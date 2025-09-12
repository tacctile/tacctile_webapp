/**
 * Video Service Type Definitions
 */

export interface VideoMetadata {
  duration: number;
  frameRate: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
  format: string;
  hasAudio: boolean;
  audioCodec?: string;
  audioBitrate?: number;
  audioSampleRate?: number;
  audioChannels?: number;
  creationTime?: Date;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface VideoFrame {
  index: number;
  timestamp: number;
  data: ImageData;
  keyFrame: boolean;
  motion?: number;
  anomalies?: FrameAnomaly[];
}

export interface FrameAnomaly {
  type: VideoAnomalyType;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  motion: number;
  description: string;
  startFrame?: number;
  endFrame?: number;
}

export enum VideoAnomalyType {
  MOTION = 'motion',
  APPARITION = 'apparition',
  ORB_MOVEMENT = 'orb_movement',
  SHADOW_FIGURE = 'shadow_figure',
  LIGHT_ANOMALY = 'light_anomaly',
  DISTORTION = 'distortion',
  MANIFESTATION = 'manifestation',
  PORTAL = 'portal',
  ENERGY_SURGE = 'energy_surge'
}

export interface VideoEnhancements {
  brightness: number;      // -100 to 100
  contrast: number;        // -100 to 100
  saturation: number;      // 0 to 200
  gamma: number;          // 0.1 to 3.0
  exposure: number;       // -2 to 2
  highlights: number;     // -100 to 100
  shadows: number;        // -100 to 100
  temperature: number;    // -100 to 100
  tint: number;          // -100 to 100
  sharpness: number;     // 0 to 100
  denoise: number;       // 0 to 100
  stabilization: boolean;
}

export interface MotionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  direction: number;
  speed: number;
  frames: number[];
}

export interface TimelineMarker {
  id: string;
  timestamp: number;
  type: 'anomaly' | 'motion' | 'manual' | 'audio';
  label: string;
  description?: string;
  confidence?: number;
  color?: string;
}

export interface PlaybackState {
  playing: boolean;
  currentTime: number;
  playbackRate: number;
  loop: boolean;
  loopStart?: number;
  loopEnd?: number;
  volume: number;
  muted: boolean;
}

export interface VideoAnalysisResult {
  anomalies: FrameAnomaly[];
  motionRegions: MotionRegion[];
  timeline: TimelineMarker[];
  statistics: {
    totalFrames: number;
    analyzedFrames: number;
    anomalyFrames: number;
    motionFrames: number;
    averageMotion: number;
    peakMotion: number;
    anomalyTypes: Map<VideoAnomalyType, number>;
  };
}

export interface FrameExtractionOptions {
  startTime?: number;
  endTime?: number;
  interval?: number;
  keyFramesOnly?: boolean;
  maxFrames?: number;
  quality?: number;
}

export interface VideoExportOptions {
  format: 'mp4' | 'webm' | 'avi' | 'mov';
  codec: string;
  bitrate?: number;
  quality?: 'low' | 'medium' | 'high' | 'lossless';
  resolution?: { width: number; height: number };
  frameRate?: number;
  includeAudio?: boolean;
  watermark?: string;
}

export interface MotionDetectionConfig {
  sensitivity: number;        // 0 to 1
  threshold: number;         // 0 to 255
  minArea: number;          // Minimum area for motion detection
  maxArea: number;          // Maximum area for motion detection
  history: number;          // Number of frames to compare
  algorithm: 'frame_diff' | 'optical_flow' | 'background_subtraction';
  ignoreRegions?: Array<{x: number; y: number; width: number; height: number}>;
}

export interface ColorCorrectionParams {
  whiteBalance: {
    temperature: number;
    tint: number;
  };
  colorGrading: {
    lift: { r: number; g: number; b: number };
    gamma: { r: number; g: number; b: number };
    gain: { r: number; g: number; b: number };
  };
  hueShift: number;
  vibrance: number;
  curves?: {
    rgb?: Array<{x: number; y: number}>;
    red?: Array<{x: number; y: number}>;
    green?: Array<{x: number; y: number}>;
    blue?: Array<{x: number; y: number}>;
  };
}

export interface VideoFilter {
  name: string;
  type: 'color' | 'transform' | 'temporal' | 'detection' | 'enhancement';
  params: any;
  enabled: boolean;
}

export interface VideoCache {
  frames: Map<number, VideoFrame>;
  thumbnails: Map<number, ImageData>;
  maxSize: number;
  strategy: 'lru' | 'fifo' | 'adaptive';
}

export interface FFmpegCommand {
  input: string;
  output?: string;
  filters: string[];
  options: Map<string, string>;
  format?: string;
}

export interface VideoProcessor {
  process(input: VideoFrame, params: any): VideoFrame;
  processSequence(frames: VideoFrame[], params: any): VideoFrame[];
  name: string;
  description: string;
}

export interface StabilizationParams {
  smoothing: number;       // 0 to 100
  cropRatio: number;      // 0 to 1
  maxShift: number;       // Maximum pixels to shift
  maxAngle: number;       // Maximum rotation in degrees
  algorithm: 'phase_correlation' | 'optical_flow' | 'feature_matching';
}

export interface TemporalFilter {
  type: 'averaging' | 'median' | 'bilateral' | 'motion_compensated';
  strength: number;
  windowSize: number;
  preserveMotion: boolean;
}

export interface SceneDetection {
  threshold: number;
  minSceneLength: number;
  method: 'histogram' | 'edge_change' | 'motion_analysis';
}

export interface VideoSegment {
  startFrame: number;
  endFrame: number;
  startTime: number;
  endTime: number;
  type: 'scene' | 'motion' | 'static' | 'anomaly';
  confidence: number;
  description?: string;
}