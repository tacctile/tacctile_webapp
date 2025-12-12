/**
 * Video Tool Types
 * Types for the DaVinci Resolve-inspired video viewer/analyzer tool
 */

import type { FilterType, FilterParams } from '../services/video/GPUVideoFilters';

// ============================================================================
// VIDEO SOURCE TYPES
// ============================================================================

/**
 * Represents a video source/file in the media pool
 */
export interface VideoSource {
  id: string;
  /** Display name */
  name: string;
  /** Video file URL or blob URL */
  url: string;
  /** Duration in seconds */
  duration: number;
  /** Video width in pixels */
  width: number;
  /** Video height in pixels */
  height: number;
  /** Frame rate */
  fps: number;
  /** Thumbnail URL */
  thumbnailUrl?: string;
  /** File size in bytes */
  fileSize?: number;
  /** MIME type */
  mimeType: string;
  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Represents a file marker on the timeline
 */
export interface VideoMarker {
  id: string;
  /** Time position in seconds */
  time: number;
  /** Marker label/title */
  label: string;
  /** Optional notes/description */
  notes?: string;
  /** Marker color */
  color: string;
  /** Confidence level for file flag */
  confidence?: 'low' | 'medium' | 'high';
  /** User who created this marker */
  userId: string;
  /** User display name */
  userDisplayName?: string;
  /** Tags for categorization */
  tags: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** Last modified timestamp */
  updatedAt: Date;
}

// ============================================================================
// ADJUSTMENT TYPES
// ============================================================================

/**
 * Video adjustment settings (non-destructive)
 */
export interface VideoAdjustments {
  /** Brightness adjustment (-100 to +100, maps to -1 to 1) */
  brightness: number;
  /** Contrast adjustment (0 to 200, maps to 0 to 2) */
  contrast: number;
  /** Saturation adjustment (0 to 200, maps to 0 to 2) */
  saturation: number;
  /** Gamma adjustment (0.1 to 3.0) */
  gamma: number;
  /** Active filter preset */
  activeFilter: VideoFilterPreset;
  /** Filter intensity (0 to 100) */
  filterIntensity: number;
}

/**
 * Available filter presets
 */
export type VideoFilterPreset =
  | 'normal'
  | 'nightVision'
  | 'thermal'
  | 'edgeDetect'
  | 'denoise'
  | 'sharpen';

/**
 * Maps filter presets to GPU filter types
 */
export const FILTER_PRESET_MAP: Record<VideoFilterPreset, FilterType> = {
  normal: 'colorAdjust',
  nightVision: 'nightVision',
  thermal: 'thermal',
  edgeDetect: 'edgeDetect',
  denoise: 'denoise',
  sharpen: 'sharpen',
};

// ============================================================================
// CAMERA GRID TYPES
// ============================================================================

/**
 * Grid layout options for multi-camera view
 */
export type CameraGridLayout = '1x1' | '2x2' | '3x3';

/**
 * Camera slot in the grid
 */
export interface CameraSlot {
  /** Slot index (0-based) */
  index: number;
  /** Assigned video source ID (null if empty) */
  sourceId: string | null;
  /** Individual playback sync enabled */
  syncEnabled: boolean;
  /** Individual mute state */
  muted: boolean;
}

// ============================================================================
// PLAYBACK TYPES
// ============================================================================

/**
 * Playback speed options
 */
export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

/**
 * Playback state
 */
export interface VideoPlaybackState {
  /** Whether video is playing */
  isPlaying: boolean;
  /** Current playback time in seconds */
  currentTime: number;
  /** Total duration in seconds */
  duration: number;
  /** Playback speed multiplier */
  speed: PlaybackSpeed;
  /** Volume (0 to 1) */
  volume: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Whether loop is enabled */
  looping: boolean;
  /** Current frame number */
  currentFrame: number;
  /** Total frame count */
  totalFrames: number;
}

// ============================================================================
// TIMELINE TYPES
// ============================================================================

/**
 * Timeline track for multi-layer display
 */
export interface TimelineTrack {
  id: string;
  /** Track label */
  label: string;
  /** Track type */
  type: 'video' | 'audio' | 'markers';
  /** Whether track is visible */
  visible: boolean;
  /** Track height in pixels */
  height: number;
  /** Track color */
  color: string;
}

/**
 * Visible time range on timeline
 */
export interface TimeRange {
  start: number;
  end: number;
}

/**
 * Audio waveform data for timeline display
 */
export interface WaveformData {
  /** Normalized amplitude values (0-1) */
  peaks: Float32Array;
  /** Sample rate used for generation */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
}

// ============================================================================
// VIDEO TOOL STATE
// ============================================================================

/**
 * Full state for video tool store
 */
export interface VideoToolState {
  // Sources
  /** All video sources in the media pool */
  sources: VideoSource[];
  /** Currently active source ID */
  activeSourceId: string | null;

  // Playback
  /** Playback state */
  playback: VideoPlaybackState;

  // Adjustments
  /** Current adjustment settings */
  adjustments: VideoAdjustments;

  // Markers
  /** File markers on timeline */
  markers: VideoMarker[];

  // Camera Grid
  /** Current grid layout */
  gridLayout: CameraGridLayout;
  /** Camera slots configuration */
  cameraSlots: CameraSlot[];

  // Timeline
  /** Timeline tracks */
  tracks: TimelineTrack[];
  /** Visible time range */
  visibleTimeRange: TimeRange;
  /** Timeline zoom level (pixels per second) */
  zoom: number;
  /** Audio waveform data */
  waveformData: WaveformData | null;

  // UI State
  /** Loading state */
  isLoading: boolean;
  /** Processing state (e.g., generating thumbnails) */
  isProcessing: boolean;
  /** Error message */
  error: string | null;
  /** Whether adjustments panel is visible */
  adjustmentsPanelVisible: boolean;
  /** Whether media pool is visible */
  mediaPoolVisible: boolean;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

export const DEFAULT_ADJUSTMENTS: VideoAdjustments = {
  brightness: 0,
  contrast: 100,
  saturation: 100,
  gamma: 1.0,
  activeFilter: 'normal',
  filterIntensity: 100,
};

export const DEFAULT_PLAYBACK_STATE: VideoPlaybackState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  speed: 1,
  volume: 1,
  muted: false,
  looping: false,
  currentFrame: 0,
  totalFrames: 0,
};

export const DEFAULT_TRACKS: TimelineTrack[] = [
  { id: 'video-1', label: 'Video', type: 'video', visible: true, height: 60, color: '#19abb5' },
  { id: 'audio-1', label: 'Audio', type: 'audio', visible: true, height: 40, color: '#36d1da' },
  { id: 'markers-1', label: 'Markers', type: 'markers', visible: true, height: 30, color: '#ffc107' },
];

/**
 * Get default camera slots for a grid layout
 */
export function getDefaultCameraSlots(layout: CameraGridLayout): CameraSlot[] {
  const count = layout === '1x1' ? 1 : layout === '2x2' ? 4 : 9;
  return Array.from({ length: count }, (_, index) => ({
    index,
    sourceId: null,
    syncEnabled: true,
    muted: index > 0, // Only first slot has audio by default
  }));
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format time as timecode (HH:MM:SS:FF)
 */
export function formatTimecode(seconds: number, fps: number = 30): string {
  const totalFrames = Math.floor(seconds * fps);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = totalFrames % fps;

  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
    frames.toString().padStart(2, '0'),
  ].join(':');
}

/**
 * Parse timecode to seconds
 */
export function parseTimecode(timecode: string, fps: number = 30): number {
  const parts = timecode.split(':').map(Number);
  if (parts.length !== 4) return 0;

  const [hours, minutes, seconds, frames] = parts;
  return hours * 3600 + minutes * 60 + seconds + frames / fps;
}

/**
 * Convert adjustment value to filter param (normalize ranges)
 */
export function adjustmentToFilterParams(adjustments: VideoAdjustments): FilterParams {
  return {
    brightness: adjustments.brightness / 100, // -1 to 1
    contrast: adjustments.contrast / 100, // 0 to 2
    saturation: adjustments.saturation / 100, // 0 to 2
    gamma: adjustments.gamma,
    intensity: adjustments.filterIntensity / 100,
    sensitivity: adjustments.filterIntensity / 100,
    threshold: 0.1,
    strength: adjustments.filterIntensity / 100,
    amount: adjustments.filterIntensity / 100,
  };
}

/**
 * Keyboard shortcut definitions for video tool
 */
export const VIDEO_SHORTCUTS = {
  playPause: ' ', // Space
  frameBack: 'ArrowLeft',
  frameForward: 'ArrowRight',
  marker: 'm',
  gridToggle: 'g',
  speedUp: ']',
  speedDown: '[',
  mute: 'k',
  fullscreen: 'f',
} as const;

/**
 * Marker colors for file types
 */
export const MARKER_COLORS = {
  default: '#19abb5',
  file: '#4caf50',
  anomaly: '#ff9800',
  critical: '#f44336',
  note: '#9c27b0',
} as const;
