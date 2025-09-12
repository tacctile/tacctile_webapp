/**
 * Camera System Type Definitions
 */

export enum CameraType {
  USB = 'usb',
  IP_RTSP = 'ip_rtsp',
  IP_ONVIF = 'ip_onvif',
  WIFI = 'wifi',
  MOBILE = 'mobile',
  VIRTUAL = 'virtual'
}

export enum CameraStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  STREAMING = 'streaming',
  RECORDING = 'recording',
  ERROR = 'error'
}

export enum StreamQuality {
  LOW = 'low',      // 480p
  MEDIUM = 'medium', // 720p
  HIGH = 'high',    // 1080p
  ULTRA = 'ultra'   // 4K
}

export interface CameraDevice {
  id: string;
  name: string;
  type: CameraType;
  status: CameraStatus;
  capabilities: CameraCapabilities;
  connection: CameraConnection;
  stream?: MediaStream;
  lastSeen: Date;
  metadata?: CameraMetadata;
}

export interface CameraCapabilities {
  resolutions: Resolution[];
  frameRates: number[];
  hasAudio: boolean;
  hasPTZ: boolean;
  hasNightVision: boolean;
  hasMotionDetection: boolean;
  hasIR: boolean;
  supportedCodecs: string[];
  supportedProtocols: string[];
}

export interface Resolution {
  width: number;
  height: number;
  label: string;
}

export interface CameraConnection {
  type: 'usb' | 'network' | 'bluetooth' | 'mobile';
  address?: string;
  port?: number;
  username?: string;
  password?: string;
  rtspUrl?: string;
  onvifUrl?: string;
  devicePath?: string;
}

export interface CameraMetadata {
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  macAddress?: string;
  location?: string;
  description?: string;
}

export interface StreamConfig {
  cameraId: string;
  quality: StreamQuality;
  resolution: Resolution;
  frameRate: number;
  bitrate?: number;
  codec?: string;
  enableAudio?: boolean;
  enableMotionDetection?: boolean;
}

export interface RecordingConfig {
  cameraId: string;
  outputPath: string;
  format: 'mp4' | 'webm' | 'mkv' | 'avi';
  quality: StreamQuality;
  maxDuration?: number;
  maxFileSize?: number;
  segmentDuration?: number;
  enableTimestamp?: boolean;
  enableWatermark?: boolean;
}

export interface CameraGrid {
  layout: GridLayout;
  cameras: GridCamera[];
  activeView?: string;
  fullscreenCamera?: string;
}

export interface GridLayout {
  type: '1x1' | '2x2' | '3x3' | '4x4' | 'custom';
  rows: number;
  columns: number;
}

export interface GridCamera {
  cameraId: string;
  position: { row: number; column: number };
  span?: { rows: number; columns: number };
  streamConfig: StreamConfig;
}

export interface ONVIFDevice {
  address: string;
  port: number;
  username?: string;
  password?: string;
  profiles?: ONVIFProfile[];
  capabilities?: ONVIFCapabilities;
}

export interface ONVIFProfile {
  name: string;
  token: string;
  streamUri: string;
  snapshotUri?: string;
  videoEncoder?: {
    resolution: Resolution;
    frameRate: number;
    bitrate: number;
    encoding: string;
  };
  audioEncoder?: {
    encoding: string;
    bitrate: number;
    sampleRate: number;
  };
}

export interface ONVIFCapabilities {
  analytics: boolean;
  device: boolean;
  events: boolean;
  imaging: boolean;
  media: boolean;
  ptz: boolean;
  recording: boolean;
}

export interface PTZControl {
  pan: { min: number; max: number; current: number };
  tilt: { min: number; max: number; current: number };
  zoom: { min: number; max: number; current: number };
  presets?: PTZPreset[];
}

export interface PTZPreset {
  name: string;
  token: string;
  pan: number;
  tilt: number;
  zoom: number;
}

export interface MotionEvent {
  cameraId: string;
  timestamp: Date;
  region: { x: number; y: number; width: number; height: number };
  confidence: number;
  duration: number;
  snapshot?: string;
}

export interface CameraAlert {
  id: string;
  cameraId: string;
  type: 'motion' | 'connection' | 'storage' | 'anomaly';
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
}

export interface RecordingSession {
  id: string;
  cameraId: string;
  startTime: Date;
  endTime?: Date;
  status: 'recording' | 'paused' | 'stopped' | 'error';
  config: RecordingConfig;
  files: RecordingFile[];
  statistics: RecordingStats;
}

export interface RecordingFile {
  path: string;
  size: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  hasAudio: boolean;
}

export interface RecordingStats {
  totalFrames: number;
  droppedFrames: number;
  totalBytes: number;
  averageFps: number;
  averageBitrate: number;
}

export interface NetworkDiscoveryOptions {
  scanIPRange?: string;
  scanPorts?: number[];
  timeout?: number;
  protocols?: ('rtsp' | 'onvif' | 'http')[];
  concurrent?: number;
}

export interface MobileAppConnection {
  deviceId: string;
  deviceName: string;
  platform: 'ios' | 'android';
  appVersion: string;
  connectionType: 'wifi' | 'cellular' | 'bluetooth';
  capabilities: MobileCapabilities;
  lastPing: Date;
}

export interface MobileCapabilities {
  cameras: {
    front: boolean;
    back: boolean;
    wide?: boolean;
    telephoto?: boolean;
  };
  sensors: {
    accelerometer: boolean;
    gyroscope: boolean;
    magnetometer: boolean;
    gps: boolean;
  };
  maxResolution: Resolution;
  supportedCodecs: string[];
}

export interface StreamStatistics {
  cameraId: string;
  timestamp: Date;
  fps: number;
  bitrate: number;
  resolution: Resolution;
  packetsReceived: number;
  packetsLost: number;
  latency: number;
  jitter: number;
  bufferLevel: number;
}

export interface CameraSchedule {
  cameraId: string;
  enabled: boolean;
  schedules: ScheduleEntry[];
}

export interface ScheduleEntry {
  dayOfWeek: number[];
  startTime: string;
  endTime: string;
  action: 'record' | 'motion_detect' | 'disable';
  config?: Partial<RecordingConfig>;
}

export interface StorageConfig {
  primaryPath: string;
  secondaryPaths?: string[];
  maxStorageGB: number;
  retentionDays: number;
  recycleOldest: boolean;
  minFreeSpaceGB: number;
  segmentSizeMB: number;
}

export interface CameraSystemConfig {
  storage: StorageConfig;
  network: {
    discoveryEnabled: boolean;
    discoveryInterval: number;
    maxConnections: number;
    bandwidthLimit?: number;
  };
  recording: {
    defaultQuality: StreamQuality;
    defaultFormat: string;
    enableMotionTriggered: boolean;
    preRecordSeconds: number;
    postRecordSeconds: number;
  };
  alerts: {
    emailEnabled: boolean;
    pushEnabled: boolean;
    webhookUrl?: string;
  };
}

export interface CameraEvent {
  type: 'connected' | 'disconnected' | 'error' | 'motion' | 'recording_start' | 'recording_stop';
  cameraId: string;
  timestamp: Date;
  data?: any;
}

export interface MultiStreamOptions {
  maxStreams: number;
  adaptiveBitrate: boolean;
  loadBalancing: boolean;
  failover: boolean;
  recordAll: boolean;
}

export interface CameraCommand {
  type: 'start_stream' | 'stop_stream' | 'start_recording' | 'stop_recording' | 
        'snapshot' | 'ptz_move' | 'ptz_preset' | 'set_quality' | 'restart';
  cameraId: string;
  params?: any;
}

export interface StreamBuffer {
  cameraId: string;
  chunks: ArrayBuffer[];
  duration: number;
  startTime: Date;
  currentSize: number;
  maxSize: number;
}