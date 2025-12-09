/**
 * Multi-View Types
 * Types and constants for the multi-view pop-out window feature
 */

// Layout types for multi-view configurations
export type MultiViewLayoutType =
  | 'two-across'
  | 'two-stacked'
  | 'two-left-one-right'
  | 'one-left-two-right'
  | 'three-across'
  | 'two-by-two';

// Tool types available in multi-view tiles
export type MultiViewToolType =
  | 'video-viewer'
  | 'audio-viewer'
  | 'timeline'
  | 'notes'
  | 'images'
  | 'flags'
  | null;

// Tile assignments for each position
export interface TileAssignments {
  tile1: MultiViewToolType;
  tile2: MultiViewToolType;
  tile3: MultiViewToolType;
  tile4: MultiViewToolType;
}

// Layout configuration
export interface LayoutConfig {
  id: MultiViewLayoutType;
  name: string;
  tiles: number;
  defaultWidth: number;
  defaultHeight: number;
}

// Sync message types for BroadcastChannel communication
export type MultiViewSyncMessageType =
  | 'playhead_update'
  | 'play_state_change'
  | 'file_change'
  | 'flag_added'
  | 'flag_removed'
  | 'speed_change'
  | 'ping'
  | 'pong';

// Sync message payload
export interface MultiViewSyncMessage {
  type: MultiViewSyncMessageType;
  timestamp: number; // Message timestamp
  source: 'main' | 'popout'; // Which window sent the message
  windowId: string; // Unique window identifier
  payload: {
    playheadPosition?: number;
    isPlaying?: boolean;
    playbackSpeed?: number;
    selectedFileId?: string;
    selectedFileType?: 'video' | 'audio' | 'image';
    flagId?: string;
    flagTimestamp?: number;
    flagLabel?: string;
  };
}

// Multi-view window state
export interface MultiViewWindowState {
  isConnected: boolean;
  lastPing: number | null;
  mainWindowActive: boolean;
}

// Layout configurations with default window sizes
export const LAYOUT_CONFIGS: LayoutConfig[] = [
  { id: 'two-across', name: 'Two Across', tiles: 2, defaultWidth: 1200, defaultHeight: 800 },
  { id: 'two-stacked', name: 'Two Stacked', tiles: 2, defaultWidth: 1000, defaultHeight: 900 },
  { id: 'two-left-one-right', name: 'Two Left + One Right', tiles: 3, defaultWidth: 1400, defaultHeight: 900 },
  { id: 'one-left-two-right', name: 'One Left + Two Right', tiles: 3, defaultWidth: 1400, defaultHeight: 900 },
  { id: 'three-across', name: 'Three Across', tiles: 3, defaultWidth: 1600, defaultHeight: 700 },
  { id: 'two-by-two', name: '2x2 Grid', tiles: 4, defaultWidth: 1400, defaultHeight: 1000 },
];

// Tool display names
export const TOOL_DISPLAY_NAMES: Record<NonNullable<MultiViewToolType>, string> = {
  'video-viewer': 'Video Viewer',
  'audio-viewer': 'Audio Viewer',
  'timeline': 'Timeline',
  'notes': 'Notes',
  'images': 'Images',
  'flags': 'Flags',
};

// Tool icons (Material Symbols)
export const TOOL_ICONS: Record<NonNullable<MultiViewToolType>, string> = {
  'video-viewer': 'movie',
  'audio-viewer': 'graphic_eq',
  'timeline': 'calendar_month',
  'notes': 'sticky_note_2',
  'images': 'photo_library',
  'flags': 'flag',
};

// BroadcastChannel name
export const MULTIVIEW_CHANNEL_NAME = 'tacctile-multiview-sync';

// Helper to get layout config by id
export const getLayoutConfig = (layoutId: MultiViewLayoutType): LayoutConfig | undefined => {
  return LAYOUT_CONFIGS.find(config => config.id === layoutId);
};

// Helper to parse URL parameters for multi-view
export const parseMultiViewParams = (searchParams: URLSearchParams): {
  layout: MultiViewLayoutType;
  tiles: TileAssignments;
  sessionId?: string;
  sessionName?: string;
} => {
  const layout = (searchParams.get('layout') || 'two-across') as MultiViewLayoutType;
  const sessionId = searchParams.get('sessionId') || undefined;
  const sessionName = searchParams.get('sessionName') || undefined;

  const tiles: TileAssignments = {
    tile1: (searchParams.get('tile1') as MultiViewToolType) || null,
    tile2: (searchParams.get('tile2') as MultiViewToolType) || null,
    tile3: (searchParams.get('tile3') as MultiViewToolType) || null,
    tile4: (searchParams.get('tile4') as MultiViewToolType) || null,
  };

  return { layout, tiles, sessionId, sessionName };
};

// Helper to build multi-view URL
export const buildMultiViewUrl = (
  layout: MultiViewLayoutType,
  tiles: TileAssignments,
  sessionId?: string,
  sessionName?: string
): string => {
  const params = new URLSearchParams();
  params.set('layout', layout);

  if (tiles.tile1) params.set('tile1', tiles.tile1);
  if (tiles.tile2) params.set('tile2', tiles.tile2);
  if (tiles.tile3) params.set('tile3', tiles.tile3);
  if (tiles.tile4) params.set('tile4', tiles.tile4);

  if (sessionId) params.set('sessionId', sessionId);
  if (sessionName) params.set('sessionName', sessionName);

  return `/multiview?${params.toString()}`;
};
