/**
 * Streaming Tool Types
 * OBS Studio-inspired streaming and recording functionality
 */

// ============================================================================
// Scene & Source Types
// ============================================================================

export type SourceType =
  | 'camera'
  | 'screen_share'
  | 'image'
  | 'text'
  | 'emf_widget'
  | 'temperature_widget'
  | 'motion_widget'
  | 'timestamp_widget'
  | 'audio_meter'
  | 'browser'
  | 'color';

export interface SourceTransform {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

export interface SourceSettings {
  // Camera source settings
  deviceId?: string;
  facingMode?: 'user' | 'environment';

  // Screen share settings
  displaySurface?: 'monitor' | 'window' | 'browser';

  // Image source settings
  imageUrl?: string;
  imageFit?: 'contain' | 'cover' | 'fill' | 'none';

  // Text source settings
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
  fontWeight?: 'normal' | 'bold';

  // Widget settings
  sensorId?: string;
  unit?: string;
  showLabel?: boolean;
  labelText?: string;
  alertThreshold?: number;
  alertColor?: string;

  // Browser source settings
  url?: string;
  refreshInterval?: number;

  // Color source settings
  color?: string;

  // Audio meter settings
  audioSourceId?: string;
  meterStyle?: 'bar' | 'circular' | 'wave';
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  transform: SourceTransform;
  settings: SourceSettings;
  zIndex: number;
  groupId?: string;
  filters?: SourceFilter[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SourceFilter {
  id: string;
  name: string;
  type: 'blur' | 'chromakey' | 'color_correction' | 'sharpen' | 'lut' | 'mask';
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface SourceGroup {
  id: string;
  name: string;
  sourceIds: string[];
  collapsed: boolean;
}

// ============================================================================
// Scene Types
// ============================================================================

export interface Scene {
  id: string;
  name: string;
  sources: Source[];
  groups: SourceGroup[];
  thumbnail?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SceneTransition {
  type: 'cut' | 'fade' | 'slide' | 'swipe' | 'stinger';
  duration: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  direction?: 'left' | 'right' | 'up' | 'down';
  stingerUrl?: string;
}

// ============================================================================
// Stream Output Types
// ============================================================================

export type StreamPlatform =
  | 'custom_rtmp'
  | 'youtube'
  | 'twitch'
  | 'facebook'
  | 'kick'
  | 'tiktok';

export interface StreamDestination {
  id: string;
  name: string;
  platform: StreamPlatform;
  enabled: boolean;
  serverUrl: string;
  streamKey: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
  bitrate?: number;
  droppedFrames?: number;
  lastConnectedAt?: Date;
}

export interface StreamSettings {
  // Video encoding
  resolution: StreamResolution;
  fps: 24 | 30 | 60;
  videoBitrate: number;
  videoCodec: 'h264' | 'vp9' | 'av1';
  keyframeInterval: number;

  // Audio encoding
  audioBitrate: number;
  audioCodec: 'aac' | 'opus';
  audioSampleRate: 44100 | 48000;
  audioChannels: 1 | 2;

  // Advanced
  preset: 'ultrafast' | 'superfast' | 'veryfast' | 'faster' | 'fast' | 'medium' | 'slow';
  profile: 'baseline' | 'main' | 'high';
  tune?: 'zerolatency' | 'film' | 'animation' | 'stillimage';
}

export interface StreamResolution {
  width: number;
  height: number;
  label: string;
}

export const STREAM_RESOLUTIONS: StreamResolution[] = [
  { width: 854, height: 480, label: '480p' },
  { width: 1280, height: 720, label: '720p' },
  { width: 1920, height: 1080, label: '1080p' },
  { width: 2560, height: 1440, label: '1440p' },
  { width: 3840, height: 2160, label: '4K' },
];

// ============================================================================
// Recording Types
// ============================================================================

export type RecordingFormat = 'mp4' | 'webm' | 'mkv';
export type RecordingQuality = 'low' | 'medium' | 'high' | 'lossless';

export interface RecordingSettings {
  format: RecordingFormat;
  quality: RecordingQuality;
  videoBitrate: number;
  audioBitrate: number;
  splitBySize?: number; // MB
  splitByDuration?: number; // seconds

  // Storage settings
  storageType: 'local' | 'cloud' | 'both';
  localPath?: string;
  cloudProvider?: 'firebase' | 'supabase' | 's3';
  cloudPath?: string;

  // Replay buffer
  replayBufferEnabled: boolean;
  replayBufferDuration: number; // seconds
}

export interface Recording {
  id: string;
  investigationId?: string;
  sceneId: string;
  filename: string;
  format: RecordingFormat;
  duration: number;
  fileSize: number;
  storageType: 'local' | 'cloud';
  localUrl?: string;
  cloudUrl?: string;
  thumbnail?: string;
  startedAt: Date;
  endedAt?: Date;
  status: 'recording' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// ============================================================================
// Audio Types
// ============================================================================

export interface AudioSource {
  id: string;
  name: string;
  type: 'microphone' | 'system' | 'virtual';
  deviceId?: string;
  volume: number;
  muted: boolean;
  monitorEnabled: boolean;
  filters?: AudioFilter[];
}

export interface AudioFilter {
  id: string;
  type: 'noise_suppression' | 'noise_gate' | 'compressor' | 'limiter' | 'eq';
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface AudioMixer {
  sources: AudioSource[];
  masterVolume: number;
  masterMuted: boolean;
}

// ============================================================================
// Streaming Tool State
// ============================================================================

export type StreamingMode = 'setup' | 'preview' | 'live';
export type ViewMode = 'studio' | 'program' | 'multiview';

export interface StreamingToolState {
  // Mode and view
  mode: StreamingMode;
  viewMode: ViewMode;

  // Scenes
  scenes: Scene[];
  activeSceneId: string | null;
  previewSceneId: string | null;
  transition: SceneTransition;

  // Sources
  selectedSourceId: string | null;
  availableDevices: MediaDeviceInfo[];

  // Streaming
  isStreaming: boolean;
  streamStartTime: Date | null;
  destinations: StreamDestination[];
  streamSettings: StreamSettings;

  // Recording
  isRecording: boolean;
  recordingStartTime: Date | null;
  recordings: Recording[];
  recordingSettings: RecordingSettings;

  // Audio
  audioMixer: AudioMixer;

  // Preview
  previewEnabled: boolean;
  previewVolume: number;

  // Stats
  streamStats: StreamStats | null;
}

export interface StreamStats {
  fps: number;
  droppedFrames: number;
  totalFrames: number;
  bitrate: number;
  cpuUsage: number;
  memoryUsage: number;
  duration: number;
  status: 'good' | 'warning' | 'critical';
}

// ============================================================================
// Streaming Tool Actions
// ============================================================================

export interface StreamingToolActions {
  // Scene management
  createScene: (name: string) => string;
  deleteScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => string;
  renameScene: (sceneId: string, name: string) => void;
  setActiveScene: (sceneId: string) => void;
  setPreviewScene: (sceneId: string) => void;
  reorderScenes: (sceneIds: string[]) => void;

  // Source management
  addSource: (sceneId: string, source: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) => string;
  removeSource: (sceneId: string, sourceId: string) => void;
  updateSource: (sceneId: string, sourceId: string, updates: Partial<Source>) => void;
  updateSourceTransform: (sceneId: string, sourceId: string, transform: Partial<SourceTransform>) => void;
  selectSource: (sourceId: string | null) => void;
  reorderSources: (sceneId: string, sourceIds: string[]) => void;

  // Transition
  setTransition: (transition: Partial<SceneTransition>) => void;
  executeTransition: () => void;

  // Streaming
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  updateStreamSettings: (settings: Partial<StreamSettings>) => void;

  // Destinations
  addDestination: (destination: Omit<StreamDestination, 'id' | 'status'>) => string;
  removeDestination: (destinationId: string) => void;
  updateDestination: (destinationId: string, updates: Partial<StreamDestination>) => void;
  toggleDestination: (destinationId: string) => void;
  testDestination: (destinationId: string) => Promise<boolean>;

  // Recording
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Recording | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  updateRecordingSettings: (settings: Partial<RecordingSettings>) => void;
  saveReplayBuffer: () => Promise<Recording | null>;

  // Audio
  updateAudioSource: (sourceId: string, updates: Partial<AudioSource>) => void;
  addAudioSource: (source: Omit<AudioSource, 'id'>) => string;
  removeAudioSource: (sourceId: string) => void;
  setMasterVolume: (volume: number) => void;
  setMasterMuted: (muted: boolean) => void;

  // Mode and view
  setMode: (mode: StreamingMode) => void;
  setViewMode: (viewMode: ViewMode) => void;
  setPreviewEnabled: (enabled: boolean) => void;

  // Devices
  refreshDevices: () => Promise<void>;

  // Stats
  updateStreamStats: (stats: Partial<StreamStats>) => void;

  // Reset
  resetStore: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULT_SOURCE_TRANSFORM: SourceTransform = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  locked: false,
};

export const DEFAULT_STREAM_SETTINGS: StreamSettings = {
  resolution: { width: 1920, height: 1080, label: '1080p' }, // 1080p
  fps: 30,
  videoBitrate: 4500,
  videoCodec: 'h264',
  keyframeInterval: 2,
  audioBitrate: 128,
  audioCodec: 'aac',
  audioSampleRate: 48000,
  audioChannels: 2,
  preset: 'veryfast',
  profile: 'main',
  tune: 'zerolatency',
};

export const DEFAULT_RECORDING_SETTINGS: RecordingSettings = {
  format: 'mp4',
  quality: 'high',
  videoBitrate: 8000,
  audioBitrate: 192,
  storageType: 'local',
  replayBufferEnabled: false,
  replayBufferDuration: 30,
};

export const DEFAULT_TRANSITION: SceneTransition = {
  type: 'fade',
  duration: 300,
  easing: 'ease-in-out',
};

export const DEFAULT_AUDIO_MIXER: AudioMixer = {
  sources: [],
  masterVolume: 1,
  masterMuted: false,
};

// Platform presets for quick setup
export const PLATFORM_PRESETS: Record<StreamPlatform, { serverUrl: string; label: string }> = {
  custom_rtmp: { serverUrl: '', label: 'Custom RTMP Server' },
  youtube: { serverUrl: 'rtmp://a.rtmp.youtube.com/live2', label: 'YouTube Live' },
  twitch: { serverUrl: 'rtmp://live.twitch.tv/app', label: 'Twitch' },
  facebook: { serverUrl: 'rtmps://live-api-s.facebook.com:443/rtmp', label: 'Facebook Live' },
  kick: { serverUrl: 'rtmp://ingest.kick.com/live', label: 'Kick' },
  tiktok: { serverUrl: 'rtmp://push.tiktokv.com/live', label: 'TikTok Live' },
};
