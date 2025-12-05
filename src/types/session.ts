/**
 * Session Timeline Types
 * Types for the chronological "truth" view of all investigation media
 */

import type { Evidence, EvidenceFlag, EvidenceType, FlagType } from './index';

// ============================================================================
// TIMELINE ITEM TYPES
// ============================================================================

/**
 * Represents a media file placed on the timeline
 * Position is determined automatically by metadata timestamp
 */
export interface TimelineItem {
  id: string;
  evidenceId: string;
  type: EvidenceType;
  title: string;
  fileName: string;
  thumbnailUrl?: string;

  // Timestamp from file metadata (Unix timestamp in milliseconds)
  capturedAt: number;

  // Duration for audio/video (in seconds), undefined for images/sensor logs
  duration?: number;

  // End timestamp (capturedAt + duration in ms)
  endAt?: number;

  // Flag/finding aggregation
  flags: TimelineItemFlag[];
  flagCount: number;
  hasEdits: boolean; // Has been edited in any tool

  // User who captured this
  capturedBy?: string;
  deviceInfo?: string;

  // Track assignment (for visual stacking)
  trackIndex: number;
}

/**
 * Aggregated flag info for display on timeline
 */
export interface TimelineItemFlag {
  id: string;
  type: FlagType;
  timestamp: number; // Offset within the media in seconds
  absoluteTimestamp: number; // Actual timeline timestamp in ms
  title: string;
  confidence: 'low' | 'medium' | 'high';
  userId: string;
  userDisplayName: string;
}

// ============================================================================
// DATA LAYER TYPES
// ============================================================================

/**
 * Data layers that can be toggled on/off
 */
export type DataLayerType =
  | 'video'
  | 'audio'
  | 'photo'
  | 'sensor'
  | 'thermal'
  | 'motion'
  | 'radio_sweep'
  | 'flags'
  | 'user_markers';

export interface DataLayer {
  id: DataLayerType;
  label: string;
  icon: string;
  color: string;
  visible: boolean;
  itemCount: number;
}

export const DEFAULT_DATA_LAYERS: DataLayer[] = [
  { id: 'video', label: 'Video', icon: 'videocam', color: '#ff6b6b', visible: true, itemCount: 0 },
  { id: 'audio', label: 'Audio', icon: 'mic', color: '#4ecdc4', visible: true, itemCount: 0 },
  { id: 'photo', label: 'Photos', icon: 'photo_camera', color: '#ffe66d', visible: true, itemCount: 0 },
  { id: 'sensor', label: 'Sensor Readings', icon: 'sensors', color: '#a855f7', visible: true, itemCount: 0 },
  { id: 'thermal', label: 'Thermal', icon: 'thermostat', color: '#f97316', visible: true, itemCount: 0 },
  { id: 'motion', label: 'Motion', icon: 'motion_photos_on', color: '#06b6d4', visible: true, itemCount: 0 },
  { id: 'radio_sweep', label: 'Radio Sweep', icon: 'radio', color: '#ec4899', visible: true, itemCount: 0 },
  { id: 'flags', label: 'All Flags', icon: 'flag', color: '#19abb5', visible: true, itemCount: 0 },
  { id: 'user_markers', label: 'User Markers', icon: 'person_pin', color: '#84cc16', visible: true, itemCount: 0 },
];

// ============================================================================
// TIME RANGE & ZOOM TYPES
// ============================================================================

export interface TimeRange {
  start: number; // Unix timestamp in ms
  end: number;   // Unix timestamp in ms
}

export interface ZoomLevel {
  id: string;
  label: string;
  pixelsPerSecond: number; // How many pixels represent one second
  snapToUnit: 'second' | 'minute' | 'hour'; // Ruler snap granularity
}

export const ZOOM_LEVELS: ZoomLevel[] = [
  { id: 'seconds', label: 'Seconds', pixelsPerSecond: 100, snapToUnit: 'second' },
  { id: 'minutes', label: 'Minutes', pixelsPerSecond: 10, snapToUnit: 'minute' },
  { id: 'hours', label: 'Hours', pixelsPerSecond: 1, snapToUnit: 'hour' },
  { id: 'overview', label: 'Overview', pixelsPerSecond: 0.1, snapToUnit: 'hour' },
];

// ============================================================================
// CLOCK SYNC TYPES
// ============================================================================

export type ClockSyncStatus = 'unknown' | 'verified' | 'unverified' | 'mismatch';

export interface DeviceClockInfo {
  deviceId: string;
  deviceName: string;
  lastKnownOffset?: number; // Offset from server time in ms
  syncStatus: ClockSyncStatus;
  lastVerifiedAt?: Date;
}

export interface ClockSyncPromptState {
  shown: boolean;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  devices: DeviceClockInfo[];
}

// ============================================================================
// SESSION TIMELINE STATE TYPES
// ============================================================================

export interface SessionTimelineState {
  // Investigation context
  investigationId: string | null;
  investigationTitle: string;

  // Timeline data
  items: TimelineItem[];
  isLoading: boolean;
  error: string | null;

  // Time range (derived from items)
  fullTimeRange: TimeRange | null; // Full range of all items
  visibleTimeRange: TimeRange | null; // Current viewport

  // Zoom & pan
  zoomLevel: ZoomLevel;
  scrollPosition: number; // Horizontal scroll in pixels

  // Data layers
  dataLayers: DataLayer[];

  // Selection (for info panel)
  selectedItemId: string | null;
  hoveredItemId: string | null;

  // Playhead (for synced viewing across tools)
  playheadPosition: number | null; // Unix timestamp in ms
  isPlaying: boolean;
  playbackSpeed: number;

  // Clock sync
  clockSyncPrompt: ClockSyncPromptState;

  // Refresh state
  lastRefreshedAt: Date | null;
  autoRefreshEnabled: boolean;
  autoRefreshIntervalMs: number;
}

export interface SessionTimelineActions {
  // Data loading
  loadTimeline: (investigationId: string) => Promise<void>;
  refreshTimeline: () => Promise<void>;
  importFromHub: () => Promise<void>;

  // Zoom & navigation
  setZoomLevel: (level: ZoomLevel) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToView: () => void;
  scrollTo: (timestamp: number) => void;
  setScrollPosition: (position: number) => void;

  // Data layers
  toggleDataLayer: (layerId: DataLayerType) => void;
  setDataLayerVisibility: (layerId: DataLayerType, visible: boolean) => void;
  showAllLayers: () => void;
  hideAllLayers: () => void;

  // Selection
  selectItem: (itemId: string | null) => void;
  setHoveredItem: (itemId: string | null) => void;

  // Playhead
  setPlayheadPosition: (timestamp: number | null) => void;
  togglePlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;

  // Clock sync
  showClockSyncPrompt: () => void;
  acknowledgeClockSync: () => void;
  verifyDeviceClock: (deviceId: string) => Promise<void>;

  // Auto-refresh
  setAutoRefresh: (enabled: boolean) => void;
  setAutoRefreshInterval: (intervalMs: number) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Maps EvidenceType to DataLayerType
 */
export const EVIDENCE_TYPE_TO_LAYER: Record<EvidenceType, DataLayerType> = {
  video: 'video',
  audio: 'audio',
  photo: 'photo',
  sensor_reading: 'sensor',
  thermal: 'thermal',
  motion: 'motion',
  radio_sweep: 'radio_sweep',
  document: 'photo', // Documents shown in photo layer
  other: 'photo',    // Other shown in photo layer
};

/**
 * Get color for evidence type
 */
export const EVIDENCE_TYPE_COLORS: Record<EvidenceType, string> = {
  video: '#ff6b6b',
  audio: '#4ecdc4',
  photo: '#ffe66d',
  sensor_reading: '#a855f7',
  thermal: '#f97316',
  motion: '#06b6d4',
  radio_sweep: '#ec4899',
  document: '#9ca3af',
  other: '#6b7280',
};

/**
 * Convert Evidence to TimelineItem
 */
export function evidenceToTimelineItem(
  evidence: Evidence,
  flags: EvidenceFlag[],
  trackIndex: number
): TimelineItem {
  const capturedAt = evidence.metadata.capturedAt
    ? new Date(evidence.metadata.capturedAt).getTime()
    : new Date(evidence.createdAt).getTime();

  const durationMs = evidence.duration ? evidence.duration * 1000 : undefined;

  const timelineFlags: TimelineItemFlag[] = flags.map(flag => ({
    id: flag.id,
    type: flag.type,
    timestamp: flag.timestamp,
    absoluteTimestamp: capturedAt + (flag.timestamp * 1000),
    title: flag.title,
    confidence: flag.confidence,
    userId: flag.userId,
    userDisplayName: flag.userDisplayName,
  }));

  return {
    id: `timeline-${evidence.id}`,
    evidenceId: evidence.id,
    type: evidence.type,
    title: evidence.title,
    fileName: evidence.fileName,
    thumbnailUrl: evidence.thumbnailUrl,
    capturedAt,
    duration: evidence.duration,
    endAt: durationMs ? capturedAt + durationMs : undefined,
    flags: timelineFlags,
    flagCount: flags.length,
    hasEdits: false, // Will be set based on edit history
    capturedBy: evidence.userId,
    deviceInfo: evidence.metadata.device,
    trackIndex,
  };
}

/**
 * Format timestamp for display
 */
export function formatTimelineTimestamp(timestamp: number, format: 'full' | 'time' | 'date' = 'full'): string {
  const date = new Date(timestamp);

  switch (format) {
    case 'time':
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    case 'date':
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    case 'full':
    default:
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
  }
}

/**
 * Format duration for display
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
