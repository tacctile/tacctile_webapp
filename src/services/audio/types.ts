/**
 * Audio Service Type Definitions
 */

export enum EngineState {
  STOPPED = 'stopped',
  READY = 'ready',
  PLAYING = 'playing',
  PAUSED = 'paused',
  RECORDING = 'recording',
  ERROR = 'error'
}

export interface TransportState {
  playing: boolean;
  recording: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
}

export interface AudioEngineConfig {
  sampleRate: number;
  bufferSize: number;
  maxTracks: number;
  latencyHint: 'interactive' | 'balanced' | 'playback';
}

export interface TrackConfig {
  id: string;
  name: string;
  type: 'audio' | 'aux';
  channelCount: number;
  color?: string;
}

export interface TrackState {
  muted: boolean;
  solo: boolean;
  armed: boolean;
  volume: number;
  pan: number;
  recording: boolean;
}

export interface AudioRegion {
  id: string;
  trackId: string;
  buffer: AudioBuffer;
  startTime: number;
  duration: number;
  offset: number;
  gain: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
}

export interface Effect {
  id: string;
  type: EffectType;
  name: string;
  enabled: boolean;
  params: EffectParams;
  node?: AudioNode;
}

export enum EffectType {
  REVERB = 'reverb',
  DELAY = 'delay',
  CHORUS = 'chorus',
  COMPRESSOR = 'compressor',
  EQ = 'eq',
  FILTER = 'filter',
  DISTORTION = 'distortion',
  GATE = 'gate',
  LIMITER = 'limiter',
  PITCH_SHIFT = 'pitch_shift'
}

export interface EffectParams {
  [key: string]: number | boolean | string;
}

export interface ReverbParams extends EffectParams {
  roomSize: number;
  decay: number;
  wetness: number;
  preDelay: number;
  damping: number;
}

export interface DelayParams extends EffectParams {
  time: number;
  feedback: number;
  wetness: number;
  type: 'normal' | 'ping-pong';
}

export interface CompressorParams extends EffectParams {
  threshold: number;
  ratio: number;
  attack: number;
  release: number;
  knee: number;
  makeupGain: number;
}

export interface EQBand {
  frequency: number;
  gain: number;
  Q: number;
  type: 'lowshelf' | 'highshelf' | 'peaking' | 'notch' | 'lowpass' | 'highpass';
}

export interface EQParams extends EffectParams {
  bands: EQBand[];
}

export interface FilterParams extends EffectParams {
  frequency: number;
  Q: number;
  type: BiquadFilterType;
  gain?: number;
}

export interface SpectralData {
  frequencies: Float32Array;
  timeDomain: Float32Array;
  spectrum: number[][];
  peak: number;
  rms: number;
}

export interface SpectrogramConfig {
  fftSize: number;
  hopSize: number;
  windowFunction: 'hann' | 'hamming' | 'blackman' | 'bartlett';
  colorMap: 'viridis' | 'plasma' | 'inferno' | 'magma' | 'grayscale';
  minDecibels: number;
  maxDecibels: number;
}

export interface EVPAnalysisConfig {
  sensitivity: number;
  minFrequency: number;
  maxFrequency: number;
  voiceThreshold: number;
  noiseGateThreshold: number;
  classificationThreshold: number;
}

export interface EVPDetection {
  timestamp: number;
  duration: number;
  confidence: number;
  classification: EVPClass;
  frequency: number;
  amplitude: number;
  spectralFeatures: SpectralFeatures;
  transcript?: string;
}

export enum EVPClass {
  CLASS_A = 'class_a', // Clear and easily understood
  CLASS_B = 'class_b', // Fairly loud, might need some interpretation
  CLASS_C = 'class_c', // Faint, often requires amplification
  UNKNOWN = 'unknown'
}

export interface SpectralFeatures {
  centroid: number;
  spread: number;
  flux: number;
  rolloff: number;
  flatness: number;
  energy: number;
  zcr: number; // Zero crossing rate
  mfcc: number[]; // Mel-frequency cepstral coefficients
}

export interface NoiseProfile {
  id: string;
  name: string;
  spectrum: Float32Array;
  timestamp: number;
}

export interface NoiseReductionConfig {
  algorithm: 'spectral_subtraction' | 'wiener' | 'adaptive';
  strength: number;
  smoothing: number;
  noiseFloor: number;
  preserveVoice: boolean;
  gateThreshold: number;
}

export interface AudioAnalysisResult {
  id: string;
  timestamp: number;
  duration: number;
  sampleRate: number;
  channels: number;
  peak: number;
  rms: number;
  lufs: number;
  spectralData: SpectralData;
  evpDetections: EVPDetection[];
  anomalies: AudioAnomaly[];
}

export interface AudioAnomaly {
  type: AnomalyType;
  timestamp: number;
  duration: number;
  frequency?: number;
  amplitude?: number;
  confidence: number;
  description: string;
}

export enum AnomalyType {
  INFRASOUND = 'infrasound',
  ULTRASOUND = 'ultrasound',
  FREQUENCY_SPIKE = 'frequency_spike',
  HARMONIC_PATTERN = 'harmonic_pattern',
  AMPLITUDE_SURGE = 'amplitude_surge',
  PHASE_ANOMALY = 'phase_anomaly',
  DOPPLER_SHIFT = 'doppler_shift'
}

export interface TimelineConfig {
  pixelsPerSecond: number;
  gridInterval: number;
  snapToGrid: boolean;
  showWaveform: boolean;
  showSpectrogram: boolean;
  autoScroll: boolean;
}

export interface Marker {
  id: string;
  time: number;
  label: string;
  color: string;
  type: 'marker' | 'region';
  endTime?: number;
}

export interface AudioExportOptions {
  format: 'wav' | 'mp3' | 'flac' | 'ogg';
  quality: number;
  sampleRate: number;
  bitDepth: 16 | 24 | 32;
  normalize: boolean;
  trimSilence: boolean;
  fadeIn: number;
  fadeOut: number;
}

export interface RecordingOptions {
  device?: string;
  channels: 1 | 2;
  sampleRate: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  monitoring: boolean;
}

export interface MeteringData {
  peak: number[];
  rms: number[];
  clip: boolean;
}

export interface PluginHost {
  id: string;
  name: string;
  type: 'vst' | 'au' | 'lv2' | 'native';
  parameters: PluginParameter[];
}

export interface PluginParameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  automatable: boolean;
}

export interface AutomationPoint {
  time: number;
  value: number;
  curve: 'linear' | 'exponential' | 'step';
}

export interface AutomationLane {
  id: string;
  parameter: string;
  points: AutomationPoint[];
  enabled: boolean;
}