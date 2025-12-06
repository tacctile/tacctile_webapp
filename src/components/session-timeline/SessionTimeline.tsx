/**
 * SessionTimeline Component
 * Rebuilt to match the exact layout structure and styling of Video, Audio, and Image Tools
 * @refresh Force Vercel cache refresh - Dec 2024
 *
 * Layout:
 * - LEFT PANEL (280px): EvidenceBank + MetadataPanel
 * - CENTER: Video preview (top) + Timeline with swim lanes (bottom)
 * - RIGHT PANEL (280px): Image preview (top) + FlagsPanel (bottom)
 * - BOTTOM: TransportControls (48px)
 *
 * Infrastructure kept for Phase 2:
 * - User lane data structure supporting 10+ users
 * - Device metadata fields
 * - Clock sync logic (just not the popup)
 */

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  ListItemIcon,
  ListItemText,
  Dialog,
  Button,
  Snackbar,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import PhotoIcon from '@mui/icons-material/Photo';
import ImageIcon from '@mui/icons-material/Image';
import FilterListIcon from '@mui/icons-material/FilterList';
import FlagIcon from '@mui/icons-material/Flag';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoIcon from '@mui/icons-material/Info';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DragHandleIcon from '@mui/icons-material/DragHandle';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';
import { MetadataPanel, FlagsPanel, type Flag } from '@/components/common';

import { usePlayheadStore } from '../../stores/usePlayheadStore';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { useAppPersistence } from '../../stores/useAppPersistence';
import { useHomeStore, type SessionEvidence } from '../../stores/useHomeStore';
import {
  detectFileType,
  sortFilesByType,
  extractUserFromFile,
  generateImportId,
  type MediaFileType,
} from '@/utils/fileTypes';
import {
  generateTestMetadataIfDev,
  formatGPSCoordinates,
  isDevelopmentMode,
} from '@/utils/testMetadataGenerator';

// ============================================================================
// TYPES
// ============================================================================

interface TimelineMediaItem {
  id: string;
  evidenceId: string;
  type: 'video' | 'audio' | 'photo';
  fileName: string;
  thumbnailUrl?: string;
  capturedAt: number; // absolute timestamp
  duration?: number; // seconds
  endAt?: number; // absolute timestamp
  user: string;
  deviceInfo?: string;
  format?: string;
  gps?: string;
  flagCount: number;
  hasEdits: boolean;
  flags: TimelineFlag[];
}

interface TimelineFlag {
  id: string;
  timestamp: number; // relative to file start (seconds)
  absoluteTimestamp: number;
  title: string;
  note?: string;
  confidence: 'low' | 'medium' | 'high';
  userId: string;
  userDisplayName: string;
  color?: string;
}

// Lane height options
type LaneHeightSize = 'small' | 'medium' | 'large';
const LANE_HEIGHT_MULTIPLIERS: Record<LaneHeightSize, number> = {
  small: 0.5,
  medium: 1,
  large: 1.5,
};
const BASE_LANE_HEIGHT = 36;

// LocalStorage keys
const STORAGE_KEY_LANE_HEIGHT = 'sessionTimeline_laneHeight';
const STORAGE_KEY_DIVIDER_POSITION = 'sessionTimeline_dividerPosition';
const STORAGE_KEY_REMOVED_ITEMS = 'sessionTimeline_removedItems';
const STORAGE_KEY_LOCKED_ITEMS = 'sessionTimeline_lockedItems';
const STORAGE_KEY_UNLOCKED_ITEMS = 'sessionTimeline_unlockedItems';
const STORAGE_KEY_TIME_OFFSETS = 'sessionTimeline_timeOffsets';
const STORAGE_KEY_LANE_ASSIGNMENTS = 'sessionTimeline_laneAssignments'; // Now stores row indices instead of user names
const LANE_ASSIGNMENTS_VERSION = 2; // Increment to force reset when data format changes
const STORAGE_KEY_LANE_VERSION = 'sessionTimeline_laneAssignmentsVersion';

// Movement constants
const SHIFT_1_SECOND = 1000; // 1 second in ms
const SHIFT_10_SECONDS = 10000; // 10 seconds in ms
const SHIFT_1_FRAME = 1000 / 30; // ~33ms for 30fps

// Context menu state interface
interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  item: TimelineMediaItem | null;
}

interface SwimLane {
  id: string;
  user: string;
  type: 'video' | 'audio' | 'image';
  isPermanent: boolean;
  items: TimelineMediaItem[];
}

// ============================================================================
// TETRIS AUTO-PACKING CONSTANTS
// ============================================================================

// Minimum duration for images in collision detection (1 second in ms)
const IMAGE_MIN_DURATION_MS = 1000;

// NOTE: generateDummyData is kept for reference but no longer used
// Session evidence is now loaded from the active session via useHomeStore
const generateDummyData = (): TimelineMediaItem[] => {
  // Session starts 2 hours ago, spans 90 minutes
  const sessionStart = Date.now() - 2 * 60 * 60 * 1000;

  const items: TimelineMediaItem[] = [
    // Sarah's videos
    {
      id: 'v1',
      evidenceId: 'ev-v1',
      type: 'video',
      fileName: 'sarah_main_camera.mp4',
      capturedAt: sessionStart,
      duration: 2400, // 40 min
      endAt: sessionStart + 2400 * 1000,
      user: 'Sarah',
      deviceInfo: 'Sony A7IV',
      format: 'H.265 / 4K',
      gps: '39.95°N, 75.16°W',
      flagCount: 3,
      hasEdits: true,
      flags: [
        { id: 'f1', timestamp: 342, absoluteTimestamp: sessionStart + 342 * 1000, title: 'Shadow movement', note: 'Dark figure moved across doorway', confidence: 'medium', userId: 'sarah', userDisplayName: 'Sarah', color: '#ff6b6b' },
        { id: 'f2', timestamp: 1124, absoluteTimestamp: sessionStart + 1124 * 1000, title: 'Light anomaly', confidence: 'low', userId: 'sarah', userDisplayName: 'Sarah', color: '#ffe66d' },
        { id: 'f3', timestamp: 1890, absoluteTimestamp: sessionStart + 1890 * 1000, title: 'Cold spot detected', note: 'Temperature dropped 8 degrees', confidence: 'high', userId: 'mike', userDisplayName: 'Mike', color: '#4ecdc4' },
      ],
    },
    {
      id: 'v2',
      evidenceId: 'ev-v2',
      type: 'video',
      fileName: 'sarah_handheld.mp4',
      capturedAt: sessionStart + 45 * 60 * 1000, // 45 min in
      duration: 1200, // 20 min
      endAt: sessionStart + 45 * 60 * 1000 + 1200 * 1000,
      user: 'Sarah',
      deviceInfo: 'iPhone 15 Pro',
      format: 'H.265 / 4K',
      gps: '39.95°N, 75.16°W',
      flagCount: 2,
      hasEdits: false,
      flags: [
        { id: 'f4', timestamp: 234, absoluteTimestamp: sessionStart + 45 * 60 * 1000 + 234 * 1000, title: 'Orb captured', confidence: 'medium', userId: 'jen', userDisplayName: 'Jen', color: '#a855f7' },
        { id: 'f5', timestamp: 890, absoluteTimestamp: sessionStart + 45 * 60 * 1000 + 890 * 1000, title: 'Door moved', note: 'Door closed on its own', confidence: 'high', userId: 'sarah', userDisplayName: 'Sarah', color: '#ff6b6b' },
      ],
    },
    // Mike's videos
    {
      id: 'v3',
      evidenceId: 'ev-v3',
      type: 'video',
      fileName: 'mike_basement_cam.mp4',
      capturedAt: sessionStart + 10 * 60 * 1000, // 10 min in
      duration: 3600, // 60 min
      endAt: sessionStart + 10 * 60 * 1000 + 3600 * 1000,
      user: 'Mike',
      deviceInfo: 'GoPro Hero 11',
      format: 'H.264 / 4K',
      gps: '39.95°N, 75.16°W',
      flagCount: 1,
      hasEdits: true,
      flags: [
        { id: 'f6', timestamp: 1567, absoluteTimestamp: sessionStart + 10 * 60 * 1000 + 1567 * 1000, title: 'Footsteps heard', note: 'Clear footsteps on floor above', confidence: 'high', userId: 'mike', userDisplayName: 'Mike', color: '#4ecdc4' },
      ],
    },
    // Jen's video
    {
      id: 'v4',
      evidenceId: 'ev-v4',
      type: 'video',
      fileName: 'jen_static_attic.mp4',
      capturedAt: sessionStart + 5 * 60 * 1000,
      duration: 4800, // 80 min
      endAt: sessionStart + 5 * 60 * 1000 + 4800 * 1000,
      user: 'Jen',
      deviceInfo: 'Wyze Cam v3',
      format: 'H.264 / 1080p',
      gps: null,
      flagCount: 0,
      hasEdits: false,
      flags: [],
    },
    // Unassigned video (catch-all lane)
    {
      id: 'v5',
      evidenceId: 'ev-v5',
      type: 'video',
      fileName: 'imported_security_footage.mp4',
      capturedAt: sessionStart + 30 * 60 * 1000,
      duration: 1800, // 30 min
      endAt: sessionStart + 30 * 60 * 1000 + 1800 * 1000,
      user: '', // No user - goes to catch-all
      deviceInfo: 'Security DVR',
      format: 'H.264 / 720p',
      gps: null,
      flagCount: 1,
      hasEdits: false,
      flags: [
        { id: 'f7', timestamp: 456, absoluteTimestamp: sessionStart + 30 * 60 * 1000 + 456 * 1000, title: 'Motion detected', confidence: 'low', userId: 'system', userDisplayName: 'System', color: '#9ca3af' },
      ],
    },

    // Sarah's audio
    {
      id: 'a1',
      evidenceId: 'ev-a1',
      type: 'audio',
      fileName: 'sarah_recorder_master.wav',
      capturedAt: sessionStart + 5 * 60 * 1000,
      duration: 3000, // 50 min
      endAt: sessionStart + 5 * 60 * 1000 + 3000 * 1000,
      user: 'Sarah',
      deviceInfo: 'Zoom H6',
      format: 'WAV / 96kHz',
      gps: null,
      flagCount: 4,
      hasEdits: true,
      flags: [
        { id: 'f8', timestamp: 482, absoluteTimestamp: sessionStart + 5 * 60 * 1000 + 482 * 1000, title: 'Class A EVP - Voice', note: 'Clear voice saying "help me"', confidence: 'high', userId: 'sarah', userDisplayName: 'Sarah', color: '#ff6b6b' },
        { id: 'f9', timestamp: 1256, absoluteTimestamp: sessionStart + 5 * 60 * 1000 + 1256 * 1000, title: 'Whisper detected', confidence: 'medium', userId: 'sarah', userDisplayName: 'Sarah', color: '#ff6b6b' },
        { id: 'f10', timestamp: 1890, absoluteTimestamp: sessionStart + 5 * 60 * 1000 + 1890 * 1000, title: 'Unexplained knock', confidence: 'medium', userId: 'mike', userDisplayName: 'Mike', color: '#4ecdc4' },
        { id: 'f11', timestamp: 2400, absoluteTimestamp: sessionStart + 5 * 60 * 1000 + 2400 * 1000, title: 'Breathing sound', note: 'Heavy breathing, no one present', confidence: 'high', userId: 'jen', userDisplayName: 'Jen', color: '#a855f7' },
      ],
    },
    // Mike's audio
    {
      id: 'a2',
      evidenceId: 'ev-a2',
      type: 'audio',
      fileName: 'mike_spirit_box_session.wav',
      capturedAt: sessionStart + 60 * 60 * 1000, // 1 hour in
      duration: 900, // 15 min
      endAt: sessionStart + 60 * 60 * 1000 + 900 * 1000,
      user: 'Mike',
      deviceInfo: 'SB7 Spirit Box',
      format: 'WAV / 48kHz',
      gps: null,
      flagCount: 2,
      hasEdits: false,
      flags: [
        { id: 'f12', timestamp: 156, absoluteTimestamp: sessionStart + 60 * 60 * 1000 + 156 * 1000, title: 'Response to question', note: 'Said name when asked', confidence: 'medium', userId: 'mike', userDisplayName: 'Mike', color: '#4ecdc4' },
        { id: 'f13', timestamp: 567, absoluteTimestamp: sessionStart + 60 * 60 * 1000 + 567 * 1000, title: 'Multiple words', confidence: 'low', userId: 'mike', userDisplayName: 'Mike', color: '#4ecdc4' },
      ],
    },
    // Jen's audio
    {
      id: 'a3',
      evidenceId: 'ev-a3',
      type: 'audio',
      fileName: 'jen_ambient_recording.wav',
      capturedAt: sessionStart,
      duration: 5400, // 90 min - full session
      endAt: sessionStart + 5400 * 1000,
      user: 'Jen',
      deviceInfo: 'Tascam DR-40X',
      format: 'WAV / 96kHz',
      gps: null,
      flagCount: 1,
      hasEdits: false,
      flags: [
        { id: 'f14', timestamp: 3200, absoluteTimestamp: sessionStart + 3200 * 1000, title: 'Loud bang', note: 'Origin unknown', confidence: 'high', userId: 'jen', userDisplayName: 'Jen', color: '#a855f7' },
      ],
    },

    // Sarah's images
    {
      id: 'i1',
      evidenceId: 'ev-i1',
      type: 'photo',
      fileName: 'sarah_anomaly_window.jpg',
      capturedAt: sessionStart + 25 * 60 * 1000,
      user: 'Sarah',
      deviceInfo: 'Canon EOS R5',
      format: 'RAW / CR3',
      gps: '39.95°N, 75.16°W',
      flagCount: 1,
      hasEdits: true,
      flags: [
        { id: 'f15', timestamp: 0, absoluteTimestamp: sessionStart + 25 * 60 * 1000, title: 'Figure in window', note: 'Possible figure reflection', confidence: 'low', userId: 'sarah', userDisplayName: 'Sarah', color: '#ff6b6b' },
      ],
    },
    {
      id: 'i2',
      evidenceId: 'ev-i2',
      type: 'photo',
      fileName: 'sarah_cold_spot.jpg',
      capturedAt: sessionStart + 52 * 60 * 1000,
      user: 'Sarah',
      deviceInfo: 'iPhone 15 Pro',
      format: 'HEIC',
      gps: '39.95°N, 75.16°W',
      flagCount: 0,
      hasEdits: false,
      flags: [],
    },
    // Mike's images
    {
      id: 'i3',
      evidenceId: 'ev-i3',
      type: 'photo',
      fileName: 'mike_orb_hallway.jpg',
      capturedAt: sessionStart + 35 * 60 * 1000,
      user: 'Mike',
      deviceInfo: 'Full Spectrum Camera',
      format: 'JPEG',
      gps: null,
      flagCount: 2,
      hasEdits: true,
      flags: [
        { id: 'f16', timestamp: 0, absoluteTimestamp: sessionStart + 35 * 60 * 1000, title: 'Multiple orbs', note: '3 distinct orbs visible', confidence: 'medium', userId: 'mike', userDisplayName: 'Mike', color: '#4ecdc4' },
        { id: 'f17', timestamp: 0, absoluteTimestamp: sessionStart + 35 * 60 * 1000, title: 'Light streak', confidence: 'low', userId: 'sarah', userDisplayName: 'Sarah', color: '#ff6b6b' },
      ],
    },
    {
      id: 'i4',
      evidenceId: 'ev-i4',
      type: 'photo',
      fileName: 'mike_basement_corner.jpg',
      capturedAt: sessionStart + 72 * 60 * 1000,
      user: 'Mike',
      deviceInfo: 'GoPro Hero 11',
      format: 'JPEG',
      gps: null,
      flagCount: 0,
      hasEdits: false,
      flags: [],
    },
    // Jen's images
    {
      id: 'i5',
      evidenceId: 'ev-i5',
      type: 'photo',
      fileName: 'jen_thermal_capture.jpg',
      capturedAt: sessionStart + 45 * 60 * 1000,
      user: 'Jen',
      deviceInfo: 'FLIR One Pro',
      format: 'JPEG / Thermal',
      gps: null,
      flagCount: 1,
      hasEdits: false,
      flags: [
        { id: 'f18', timestamp: 0, absoluteTimestamp: sessionStart + 45 * 60 * 1000, title: 'Cold spot - 12°F drop', confidence: 'high', userId: 'jen', userDisplayName: 'Jen', color: '#a855f7' },
      ],
    },
    {
      id: 'i6',
      evidenceId: 'ev-i6',
      type: 'photo',
      fileName: 'jen_attic_shadow.jpg',
      capturedAt: sessionStart + 68 * 60 * 1000,
      user: 'Jen',
      deviceInfo: 'Wyze Cam v3',
      format: 'JPEG',
      gps: null,
      flagCount: 1,
      hasEdits: true,
      flags: [
        { id: 'f19', timestamp: 0, absoluteTimestamp: sessionStart + 68 * 60 * 1000, title: 'Shadow figure', note: 'Human-shaped shadow with no source', confidence: 'medium', userId: 'jen', userDisplayName: 'Jen', color: '#a855f7' },
      ],
    },
    // Unassigned image
    {
      id: 'i7',
      evidenceId: 'ev-i7',
      type: 'photo',
      fileName: 'imported_old_photo.jpg',
      capturedAt: sessionStart + 20 * 60 * 1000,
      user: '', // No user - goes to catch-all
      deviceInfo: 'Unknown',
      format: 'JPEG',
      gps: null,
      flagCount: 0,
      hasEdits: false,
      flags: [],
    },
  ];

  return items;
};

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const MainContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0d0d0d',
});

// Unified Preview Section (Top of Center) - shows video, audio, or image based on selection
const UnifiedPreviewSection = styled(Box)({
  flex: 1,
  minHeight: 200,
  backgroundColor: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
});

const PreviewPlaceholder = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: '#444',
});

// Embedded Transport Controls (directly under preview)
const EmbeddedTransportControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '8px 16px',
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
});

const TransportButton = styled(IconButton)({
  color: '#888',
  padding: 6,
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

const PlayButton = styled(IconButton)({
  color: '#fff',
  backgroundColor: '#19abb5',
  padding: 8,
  '&:hover': {
    backgroundColor: '#147a82',
  },
});

// Resizable divider between video preview and timeline
const ResizeDivider = styled(Box)({
  height: 8,
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #252525',
  borderBottom: '1px solid #252525',
  cursor: 'row-resize',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background-color 0.15s',
  '&:hover': {
    backgroundColor: '#252525',
  },
  '&:active': {
    backgroundColor: '#333',
  },
});

// Lane height control toolbar
const LaneHeightToolbar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 12px',
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
});

// Timeline Section (Bottom of Center) - height controlled dynamically
const TimelineSection = styled(Box)({
  minHeight: 150,
  backgroundColor: '#0d0d0d',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const TimeRuler = styled(Box)({
  height: 24,
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden',
  paddingLeft: 100, // Offset for lane labels
});

const TimeRulerTick = styled(Box)({
  position: 'absolute',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
});

const TimeRulerLabel = styled(Typography)({
  fontSize: 9,
  color: '#555',
  fontFamily: '"JetBrains Mono", monospace',
  whiteSpace: 'nowrap',
});

const SwimLanesContainer = styled(Box)({
  flex: 1,
  overflow: 'auto',
  position: 'relative',
  '&::-webkit-scrollbar': {
    width: 6,
    height: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#0d0d0d',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

const SwimLaneSection = styled(Box)({
  borderBottom: '1px solid #1f1f1f',
});

const SwimLaneSectionHeader = styled(Box)<{ color: string }>(({ color }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  backgroundColor: '#1a1a1a',
  cursor: 'pointer',
  userSelect: 'none',
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
  borderLeft: `3px solid ${color}`,
}));

const SectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase',
  flex: 1,
});

// SwimLane height is now controlled dynamically
const SwimLane = styled(Box)<{ laneHeight?: number; dimmed?: boolean }>(({ laneHeight = 36, dimmed = false }) => ({
  height: laneHeight,
  minHeight: 18,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  borderBottom: '1px solid #1a1a1a',
  backgroundColor: '#0d0d0d',
  opacity: dimmed ? 0.5 : 1,
  transition: 'opacity 0.15s, height 0.15s',
}));

const LaneLabel = styled(Box)<{ laneHeight?: number; isDragging?: boolean; isDragOver?: boolean }>(({ laneHeight = 36, isDragging, isDragOver }) => ({
  width: 100,
  minWidth: 100,
  padding: '0 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: laneHeight < 24 ? 8 : 10,
  color: '#666',
  backgroundColor: isDragOver ? 'rgba(25, 171, 181, 0.15)' : '#141414',
  height: '100%',
  borderRight: '1px solid #1f1f1f',
  overflow: 'hidden',
  cursor: 'grab',
  opacity: isDragging ? 0.5 : 1,
  transition: 'background-color 0.15s, opacity 0.15s',
  borderTop: isDragOver ? '2px solid #19abb5' : '2px solid transparent',
  '&:hover': {
    backgroundColor: isDragOver ? 'rgba(25, 171, 181, 0.15)' : '#1a1a1a',
  },
  '&:active': {
    cursor: 'grabbing',
  },
}));

const LaneContent = styled(Box)<{ isDragOver?: boolean; canDrop?: boolean }>(({ isDragOver, canDrop }) => ({
  flex: 1,
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
  transition: 'background-color 0.15s, border-color 0.15s',
  ...(isDragOver && canDrop && {
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
    borderLeft: '3px solid #19abb5',
  }),
  ...(isDragOver && !canDrop && {
    backgroundColor: 'rgba(229, 115, 115, 0.1)',
    borderLeft: '3px solid #e57373',
  }),
}));

const TimelineClip = styled(Box)<{
  clipType: 'video' | 'audio' | 'image';
  highlighted?: boolean;
  clipHeight?: number;
}>(({ clipType, highlighted, clipHeight = 28 }) => {
  const colors: Record<string, string> = {
    video: '#c45c5c',
    audio: '#5a9a6b',
    image: '#5a7fbf',
  };
  return {
    position: 'absolute',
    top: 4,
    height: Math.max(16, clipHeight),
    backgroundColor: colors[clipType] || '#666',
    borderRadius: 3,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    paddingLeft: 4,
    gap: 4,
    cursor: 'pointer',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: clipHeight < 20 ? 8 : 10,
    color: '#fff',
    border: highlighted ? '2px solid #19abb5' : '2px solid transparent',
    boxShadow: highlighted ? '0 0 10px rgba(25, 171, 181, 0.6)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s, height 0.15s',
    '&:hover': {
      filter: 'brightness(1.15)',
      zIndex: 5,
    },
  };
});

const TimelineImage = styled(Box)<{ highlighted?: boolean; imageHeight?: number }>(({ highlighted, imageHeight = 28 }) => ({
  position: 'absolute',
  top: 4,
  width: Math.max(16, imageHeight * 0.6),
  height: Math.max(16, imageHeight),
  backgroundColor: '#5a7fbf',
  borderRadius: 3,
  cursor: 'pointer',
  border: highlighted ? '2px solid #19abb5' : '2px solid transparent',
  boxShadow: highlighted ? '0 0 10px rgba(25, 171, 181, 0.6)' : 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  transition: 'width 0.15s, height 0.15s',
  '&:hover': {
    filter: 'brightness(1.15)',
    zIndex: 5,
  },
}));

// Thin vertical line for images on timeline
const TimelineImageLine = styled(Box)<{ highlighted?: boolean; imageHeight?: number }>(({ highlighted, imageHeight = 28 }) => ({
  position: 'absolute',
  top: 2,
  width: 2,
  minWidth: 2,
  height: Math.max(16, imageHeight - 4),
  backgroundColor: '#5a7fbf',
  borderRadius: 1,
  cursor: 'pointer',
  border: highlighted ? '1px solid #19abb5' : '1px solid transparent',
  boxShadow: highlighted ? '0 0 8px rgba(25, 171, 181, 0.6)' : 'none',
  transition: 'all 0.15s',
  zIndex: 2,
  // Expand clickable hitbox
  '&::before': {
    content: '""',
    position: 'absolute',
    left: -4,
    right: -4,
    top: -2,
    bottom: -2,
    minWidth: 12,
  },
  '&:hover': {
    width: 4,
    backgroundColor: '#7b9fd4',
    boxShadow: '0 0 6px rgba(90, 127, 191, 0.6)',
    zIndex: 15,
  },
}));

// Image thumbnail popup on hover
const ImageThumbnailPopup = styled(Box)({
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: 8,
  padding: 4,
  backgroundColor: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
  zIndex: 100,
  pointerEvents: 'none',
  minWidth: 100,
});

// File drop zone overlay
const FileDropOverlay = styled(Box)<{ isActive: boolean }>(({ isActive }) => ({
  position: 'absolute',
  inset: 0,
  backgroundColor: isActive ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  border: isActive ? '2px dashed #19abb5' : '2px dashed transparent',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: isActive ? 'auto' : 'none',
  transition: 'all 0.2s ease',
  zIndex: isActive ? 50 : -1,
}));

// Import button styled component
const ImportButton = styled(Button)({
  fontSize: 10,
  color: '#888',
  backgroundColor: '#252525',
  border: '1px solid #333',
  padding: '4px 10px',
  textTransform: 'none',
  marginLeft: 'auto',
  '&:hover': {
    backgroundColor: '#333',
    borderColor: '#19abb5',
    color: '#19abb5',
  },
  '& .MuiButton-startIcon': {
    marginRight: 4,
  },
});


// Flag markers - vertical lines spanning the height of the clip
const FlagLine = styled(Box)<{ color?: string; clipHeight?: number }>(({ color, clipHeight = 28 }) => ({
  position: 'absolute',
  top: 0,
  width: 2,
  height: '100%',
  backgroundColor: color || '#19abb5',
  cursor: 'pointer',
  zIndex: 10,
  opacity: 0.9,
  transition: 'all 0.15s',
  '&:hover': {
    width: 3,
    opacity: 1,
    boxShadow: `0 0 8px ${color || '#19abb5'}`,
  },
}));


// ============================================================================
// COMPONENT
// ============================================================================

interface SessionTimelineProps {
  investigationId?: string;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  investigationId = 'demo-investigation',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lanesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  // Image preview modal state (for when active file is an image)
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Active session state from stores
  const activeSessionId = useAppPersistence((state) => state.activeSessionId);
  const sessions = useHomeStore((state) => state.sessions);
  const addSessionEvidence = useHomeStore((state) => state.addSessionEvidence);

  // Get the active session
  const activeSession = useMemo(() => {
    if (!activeSessionId) return null;
    return sessions.find((s) => s.id === activeSessionId) || null;
  }, [activeSessionId, sessions]);

  // Timeline items - loaded from active session
  const [items, setItems] = useState<TimelineMediaItem[]>([]);

  // Section collapse state
  const [videoSectionCollapsed, setVideoSectionCollapsed] = useState(false);
  const [audioSectionCollapsed, setAudioSectionCollapsed] = useState(false);
  const [imagesSectionCollapsed, setImagesSectionCollapsed] = useState(false);

  // Active file visibility - only one file can be active at a time
  const [activeFileId, setActiveFileId] = useState<string | null>(null);

  // Lane height setting (persisted to localStorage)
  const [laneHeightSize, setLaneHeightSize] = useState<LaneHeightSize>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_LANE_HEIGHT);
      if (saved && (saved === 'small' || saved === 'medium' || saved === 'large')) {
        return saved as LaneHeightSize;
      }
    }
    return 'medium';
  });

  // Resizable divider position (percentage of container height for video preview)
  // Default is 50% for video preview area
  const [dividerPosition, setDividerPosition] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_DIVIDER_POSITION);
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 20 && val <= 80) {
          return val;
        }
      }
    }
    return 50;
  });
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);

  // Flag user filter
  const [flagUserFilter, setFlagUserFilter] = useState<string>('all');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Items removed from timeline (stored by ID, can be re-added by dragging from Evidence Bank)
  const [removedItemIds, setRemovedItemIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_REMOVED_ITEMS);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });

  // Selected item for metadata panel (from timeline click)
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<TimelineMediaItem | null>(null);

  // Dragging from Evidence Bank
  const [draggedEvidenceId, setDraggedEvidenceId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<{ row: number; type: string } | null>(null);

  // Lock state management
  // Files WITH timestamps are LOCKED by default, files WITHOUT timestamps are UNLOCKED by default
  // These sets track manual overrides from the default behavior
  const [manuallyUnlockedItems, setManuallyUnlockedItems] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_UNLOCKED_ITEMS);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });
  const [manuallyLockedItems, setManuallyLockedItems] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_LOCKED_ITEMS);
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });

  // Time offsets for non-timestamped files (ms offset from default position)
  // Files without timestamps can be shifted horizontally
  const [itemTimeOffsets, setItemTimeOffsets] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_TIME_OFFSETS);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  // Row assignments for items manually moved to different rows (itemId -> row index)
  // When an item is dragged to a different row, it's stored here to override auto-packing
  const [itemRowAssignments, setItemRowAssignments] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY_LANE_ASSIGNMENTS);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Convert old string-based assignments to numbers (backward compat)
          const result: Record<string, number> = {};
          Object.entries(parsed).forEach(([id, val]) => {
            if (typeof val === 'number') {
              result[id] = val;
            }
            // Skip old string-based assignments - they'll be auto-packed
          });
          return result;
        } catch {
          return {};
        }
      }
    }
    return {};
  });

  // Clean up stale localStorage data from old lane assignment format
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check version - if outdated or missing, clear lane assignments
    const savedVersion = localStorage.getItem(STORAGE_KEY_LANE_VERSION);
    const currentVersion = savedVersion ? parseInt(savedVersion, 10) : 0;

    if (currentVersion < LANE_ASSIGNMENTS_VERSION) {
      // Clear old format data - Tetris algorithm will auto-pack fresh
      localStorage.removeItem(STORAGE_KEY_LANE_ASSIGNMENTS);
      localStorage.setItem(STORAGE_KEY_LANE_VERSION, String(LANE_ASSIGNMENTS_VERSION));
      setItemRowAssignments({});
      return;
    }

    // Also check for any string-based values (old format used user names as strings)
    const saved = localStorage.getItem(STORAGE_KEY_LANE_ASSIGNMENTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasOldFormat = Object.values(parsed).some(v => typeof v === 'string');
        if (hasOldFormat) {
          localStorage.removeItem(STORAGE_KEY_LANE_ASSIGNMENTS);
          setItemRowAssignments({});
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY_LANE_ASSIGNMENTS);
        setItemRowAssignments({});
      }
    }
  }, []);

  // Toast state for locked file movement attempts
  const [lockedMoveToast, setLockedMoveToast] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });

  // File drop zone state
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [fileDragCounter, setFileDragCounter] = useState(0); // Track nested drag events
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notification state for import feedback
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Image hover state for thumbnail popup
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);

  // Loading state (for realistic UX)
  const [isLoading, setIsLoading] = useState(true);

  // Global playhead store
  const globalTimestamp = usePlayheadStore((state) => state.timestamp);
  const setGlobalTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const setSessionBounds = usePlayheadStore((state) => state.setSessionBounds);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const togglePlayback = usePlayheadStore((state) => state.togglePlayback);
  const jumpToStart = usePlayheadStore((state) => state.jumpToStart);
  const jumpToEnd = usePlayheadStore((state) => state.jumpToEnd);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);

  // Navigation store
  const navigateToTool = useNavigationStore((state) => state.navigateToTool);

  // Calculate time range from items (accounting for time offsets)
  // IMPORTANT: Must account for minimum visual durations to prevent clipping
  const timeRange = useMemo(() => {
    if (items.length === 0) return null;
    let minTime = Infinity;
    let maxTime = -Infinity;
    items.forEach((item) => {
      // Account for time offset when calculating bounds
      const offset = itemTimeOffsets[item.id] || 0;
      const effectiveStart = item.capturedAt + offset;
      // For items with duration, calculate effective end time
      // Photos use IMAGE_MIN_DURATION_MS (1 second) as minimum for visual width
      // Videos/audio without duration also get minimum to prevent zero-width bounds
      const baseDurationMs = (item.duration || 0) * 1000;
      const durationMs = item.type === 'photo'
        ? Math.max(baseDurationMs, IMAGE_MIN_DURATION_MS)
        : Math.max(baseDurationMs, IMAGE_MIN_DURATION_MS); // Apply minimum to all types
      const effectiveEnd = effectiveStart + durationMs;
      // Use endAt if available (for backwards compatibility), otherwise compute from duration
      const itemEndTime = item.endAt ? Math.max(item.endAt + offset, effectiveEnd) : effectiveEnd;

      minTime = Math.min(minTime, effectiveStart);
      maxTime = Math.max(maxTime, itemEndTime);
    });
    // Add 2% padding to ensure no items render at the very edge
    const duration = maxTime - minTime;
    const padding = Math.max(duration * 0.02, 1000); // At least 1 second padding
    return { start: minTime - padding, end: maxTime + padding };
  }, [items, itemTimeOffsets]);

  // Initialize on mount
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Load session evidence when active session changes
  useEffect(() => {
    if (activeSession && activeSession.evidence) {
      // Convert SessionEvidence to TimelineMediaItem
      const sessionItems: TimelineMediaItem[] = activeSession.evidence.map((ev: SessionEvidence) => ({
        id: ev.id,
        evidenceId: ev.evidenceId,
        type: ev.type,
        fileName: ev.fileName,
        thumbnailUrl: ev.thumbnailUrl,
        capturedAt: ev.capturedAt,
        duration: ev.duration,
        endAt: ev.endAt,
        user: ev.user,
        deviceInfo: ev.deviceInfo,
        format: ev.format,
        gps: ev.gps,
        flagCount: ev.flagCount,
        hasEdits: ev.hasEdits,
        flags: ev.flags.map((f) => ({
          id: f.id,
          timestamp: f.timestamp,
          absoluteTimestamp: f.absoluteTimestamp,
          title: f.title,
          note: f.note,
          confidence: f.confidence,
          userId: f.userId,
          userDisplayName: f.userDisplayName,
          color: f.color,
        })),
      }));
      setItems(sessionItems);
    } else {
      // No active session or empty evidence - start with empty timeline
      setItems([]);
    }
    // Reset removed items when session changes
    setRemovedItemIds(new Set());
    setActiveFileId(null);
  }, [activeSessionId, activeSession]);

  // Set session bounds when time range changes
  useEffect(() => {
    if (timeRange) {
      setSessionBounds(timeRange.start, timeRange.end);
      // Initialize playhead to start if not set
      if (globalTimestamp < timeRange.start || globalTimestamp > timeRange.end) {
        setGlobalTimestamp(timeRange.start);
      }
    }
  }, [timeRange, setSessionBounds, setGlobalTimestamp, globalTimestamp]);

  // Initialize active file to first video on mount
  useEffect(() => {
    if (items.length > 0 && !activeFileId) {
      const firstVideo = items.find((item) => item.type === 'video');
      if (firstVideo) {
        setActiveFileId(firstVideo.id);
      }
    }
  }, [items, activeFileId]);

  // Handle Esc key to close image modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && imageModalOpen) {
        setImageModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageModalOpen]);

  // Persist lane height to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANE_HEIGHT, laneHeightSize);
  }, [laneHeightSize]);

  // Persist divider position to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_DIVIDER_POSITION, dividerPosition.toString());
  }, [dividerPosition]);

  // Persist removed items to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_REMOVED_ITEMS, JSON.stringify(Array.from(removedItemIds)));
  }, [removedItemIds]);

  // Persist lock state to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_UNLOCKED_ITEMS, JSON.stringify(Array.from(manuallyUnlockedItems)));
  }, [manuallyUnlockedItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOCKED_ITEMS, JSON.stringify(Array.from(manuallyLockedItems)));
  }, [manuallyLockedItems]);

  // Persist time offsets to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TIME_OFFSETS, JSON.stringify(itemTimeOffsets));
  }, [itemTimeOffsets]);

  // Persist row assignments to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LANE_ASSIGNMENTS, JSON.stringify(itemRowAssignments));
  }, [itemRowAssignments]);

  // Auto-hide locked move toast after 2 seconds
  useEffect(() => {
    if (lockedMoveToast.visible) {
      const timer = setTimeout(() => {
        setLockedMoveToast({ visible: false, message: '' });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [lockedMoveToast.visible]);

  // Calculate the actual lane height in pixels
  const laneHeight = useMemo(() => {
    return Math.round(BASE_LANE_HEIGHT * LANE_HEIGHT_MULTIPLIERS[laneHeightSize]);
  }, [laneHeightSize]);

  // Clip height is lane height minus top padding (4px each side)
  const clipHeight = useMemo(() => {
    return Math.max(16, laneHeight - 8);
  }, [laneHeight]);

  // Filter out removed items for timeline display (items remain in Evidence Bank)
  const visibleItems = useMemo(() => {
    return items.filter(item => !removedItemIds.has(item.id));
  }, [items, removedItemIds]);


  // Convert timeline items to evidence items for EvidenceBank
  const evidenceItems = useMemo(() => {
    return items.map((item): EvidenceItem => ({
      id: item.id,
      type: item.type === 'photo' ? 'image' : item.type,
      fileName: item.fileName,
      duration: item.duration,
      capturedAt: item.capturedAt,
      user: item.user || 'Unknown',
      deviceInfo: item.deviceInfo,
      flagCount: item.flagCount,
      hasFindings: item.hasEdits || item.flagCount > 0,
    }));
  }, [items]);

  // Helper to compute effective start time for an item (used in overlap detection)
  const computeEffectiveStartTime = useCallback((item: TimelineMediaItem): number => {
    const offset = itemTimeOffsets[item.id] || 0;
    const hasTimestamp = item.capturedAt !== undefined && item.capturedAt !== null && item.capturedAt > 0;
    const baseTime = hasTimestamp ? item.capturedAt : (timeRange?.start || 0);
    return baseTime + offset;
  }, [itemTimeOffsets, timeRange]);

  // Helper to compute effective end time for an item
  // Used for collision detection in Tetris auto-packing algorithm
  const computeEffectiveEndTime = useCallback((item: TimelineMediaItem): number => {
    const startTime = computeEffectiveStartTime(item);
    // All items get a minimum duration for collision detection to prevent overlaps
    // Photos: Use IMAGE_MIN_DURATION_MS (1 second) for visual marker width
    // Videos/Audio: Use IMAGE_MIN_DURATION_MS as minimum for items without duration
    const baseDurationMs = (item.duration || 0) * 1000;
    const durationMs = Math.max(baseDurationMs, IMAGE_MIN_DURATION_MS);
    return startTime + durationMs;
  }, [computeEffectiveStartTime]);

  // ============================================================================
  // TETRIS AUTO-PACKING ALGORITHM
  // Each media type (VIDEO, AUDIO, IMAGES) manages its own rows independently.
  // Items are placed in the first row where they fit without overlapping.
  // Manual row assignments (from dragging) override auto-packing.
  // ============================================================================

  // [BUILD:TL-x7k] Tetris auto-pack items into rows for a specific media type
  const packItemsIntoRows = useCallback((
    typeItems: TimelineMediaItem[],
    manualAssignments: Record<string, number>
  ): { rows: TimelineMediaItem[][]; rowAssignments: Map<string, number> } => {
    console.log('[TETRIS-x7k] packItemsIntoRows called with', typeItems.length, 'items');

    const rowAssignments = new Map<string, number>();
    const rows: TimelineMediaItem[][] = [];
    const rowOccupied: Array<Array<{start: number; end: number}>> = [];

    const sortedItems = [...typeItems].sort((a, b) => {
      return computeEffectiveStartTime(a) - computeEffectiveStartTime(b);
    });

    sortedItems.forEach((item, idx) => {
      const itemStart = computeEffectiveStartTime(item);
      const itemEnd = computeEffectiveEndTime(item);

      console.log(`[TETRIS-x7k] Item ${idx}: ${item.fileName.substring(0, 15)}... start=${itemStart} end=${itemEnd} duration=${item.duration}s`);

      if (manualAssignments[item.id] !== undefined) {
        const targetRow = manualAssignments[item.id];
        console.log(`[TETRIS-x7k] -> Manual assignment to row ${targetRow}`);
        while (rows.length <= targetRow) {
          rows.push([]);
          rowOccupied.push([]);
        }
        rows[targetRow].push(item);
        rowOccupied[targetRow].push({ start: itemStart, end: itemEnd });
        rowAssignments.set(item.id, targetRow);
        return;
      }

      let assignedRowIndex = -1;
      for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
        const occupied = rowOccupied[rowIdx];
        let fits = true;
        for (const interval of occupied) {
          const overlaps = itemStart < interval.end && itemEnd > interval.start;
          if (overlaps) {
            console.log(`[TETRIS-x7k]   Row ${rowIdx} overlap: [${itemStart}-${itemEnd}] vs [${interval.start}-${interval.end}]`);
            fits = false;
            break;
          }
        }
        if (fits) {
          assignedRowIndex = rowIdx;
          console.log(`[TETRIS-x7k]   Row ${rowIdx} fits!`);
          break;
        }
      }

      if (assignedRowIndex === -1) {
        assignedRowIndex = rows.length;
        rows.push([]);
        rowOccupied.push([]);
        console.log(`[TETRIS-x7k]   Created new row ${assignedRowIndex}`);
      }

      rows[assignedRowIndex].push(item);
      rowOccupied[assignedRowIndex].push({ start: itemStart, end: itemEnd });
      rowAssignments.set(item.id, assignedRowIndex);
      console.log(`[TETRIS-x7k] -> Assigned to row ${assignedRowIndex}`);
    });

    console.log(`[TETRIS-x7k] Result: ${rows.length} rows`);
    return { rows, rowAssignments };
  }, [computeEffectiveStartTime, computeEffectiveEndTime]);

  // Packed row data for each media type using Tetris auto-packing algorithm
  const packedRowData = useMemo(() => {
    // Filter visible items by type
    const videoItems = visibleItems.filter(item => item.type === 'video');
    const audioItems = visibleItems.filter(item => item.type === 'audio');
    const imageItems = visibleItems.filter(item => item.type === 'photo');

    // Pack each type into rows
    const videoPacked = packItemsIntoRows(videoItems, itemRowAssignments);
    const audioPacked = packItemsIntoRows(audioItems, itemRowAssignments);
    const imagesPacked = packItemsIntoRows(imageItems, itemRowAssignments);

    return {
      videoRows: videoPacked.rows,
      videoRowAssignments: videoPacked.rowAssignments,
      audioRows: audioPacked.rows,
      audioRowAssignments: audioPacked.rowAssignments,
      imageRows: imagesPacked.rows,
      imageRowAssignments: imagesPacked.rowAssignments,
    };
  }, [visibleItems, itemRowAssignments, packItemsIntoRows]);

  // Get the row index for an item (for vertical movement)
  const getItemRowIndex = useCallback((item: TimelineMediaItem): number => {
    if (item.type === 'video') {
      return packedRowData.videoRowAssignments.get(item.id) ?? 0;
    } else if (item.type === 'audio') {
      return packedRowData.audioRowAssignments.get(item.id) ?? 0;
    } else {
      return packedRowData.imageRowAssignments.get(item.id) ?? 0;
    }
  }, [packedRowData]);

  // Get total number of rows for a media type
  const getRowCount = useCallback((type: 'video' | 'audio' | 'photo'): number => {
    if (type === 'video') {
      return packedRowData.videoRows.length;
    } else if (type === 'audio') {
      return packedRowData.audioRows.length;
    } else {
      return packedRowData.imageRows.length;
    }
  }, [packedRowData]);

  // Computed values for section visibility
  // Only show sections when there are items of that type
  const hasVideoItems = useMemo(() => {
    return visibleItems.some(item => item.type === 'video');
  }, [visibleItems]);

  const hasAudioItems = useMemo(() => {
    return visibleItems.some(item => item.type === 'audio');
  }, [visibleItems]);

  const hasImageItems = useMemo(() => {
    return visibleItems.some(item => item.type === 'photo');
  }, [visibleItems]);

  // Get flags for the currently selected/active file
  const currentFlags = useMemo(() => {
    // If no file is selected/active, return empty array
    if (!activeFileId) {
      return [];
    }

    // Find the active item
    const activeItem = items.find(item => item.id === activeFileId);
    if (!activeItem) {
      return [];
    }

    // Get all flags for the selected file
    const flags: Flag[] = activeItem.flags.map((flag) => ({
      id: flag.id,
      timestamp: flag.absoluteTimestamp,
      label: flag.title,
      note: flag.note,
      createdBy: flag.userDisplayName,
      createdAt: flag.absoluteTimestamp,
    }));

    // Apply user filter
    if (flagUserFilter !== 'all') {
      return flags.filter((f) => f.createdBy === flagUserFilter);
    }

    return flags;
  }, [items, activeFileId, flagUserFilter]);

  // Get unique flag creators for filter dropdown
  const flagUsers = useMemo(() => {
    const userSet = new Set<string>();
    items.forEach((item) => {
      item.flags.forEach((flag) => {
        if (flag.userDisplayName) {
          userSet.add(flag.userDisplayName);
        }
      });
    });
    return Array.from(userSet).sort();
  }, [items]);

  // Calculate clip position on timeline
  // Check if an item has a real timestamp (vs defaulting to session start)
  const hasRealTimestamp = useCallback((item: TimelineMediaItem): boolean => {
    return item.capturedAt !== undefined && item.capturedAt !== null && item.capturedAt > 0;
  }, []);

  // Get effective start time for an item (accounting for time offsets)
  const getEffectiveStartTime = useCallback(
    (item: TimelineMediaItem): number => {
      const offset = itemTimeOffsets[item.id] || 0;
      // For items without timestamps, default position is session start
      const baseTime = hasRealTimestamp(item) ? item.capturedAt : (timeRange?.start || 0);
      return baseTime + offset;
    },
    [itemTimeOffsets, timeRange, hasRealTimestamp]
  );

  const getClipPosition = useCallback(
    (startTime: number, duration?: number) => {
      if (!timeRange) return { left: 0, width: 0 };
      const totalDuration = timeRange.end - timeRange.start;
      const left = ((startTime - timeRange.start) / totalDuration) * 100;
      const width = duration
        ? ((duration * 1000) / totalDuration) * 100
        : 0.5; // Min width for images
      return { left: `${Math.max(0, Math.min(100, left))}%`, width: `${Math.max(0.5, Math.min(100 - left, width))}%` };
    },
    [timeRange]
  );

  // Handle item single click (show metadata)
  const handleItemClick = useCallback(
    (item: TimelineMediaItem) => {
      const evidenceItem: EvidenceItem = {
        id: item.id,
        type: item.type === 'photo' ? 'image' : item.type,
        fileName: item.fileName,
        duration: item.duration,
        capturedAt: item.capturedAt,
        user: item.user || 'Unknown',
        deviceInfo: item.deviceInfo,
        flagCount: item.flagCount,
        hasFindings: item.hasEdits || item.flagCount > 0,
      };
      setSelectedEvidence(evidenceItem);
    },
    []
  );

  // Handle item double click (focus file, jump playhead to start, load in preview)
  // NO automatic navigation to other tools
  const handleItemDoubleClick = useCallback(
    (item: TimelineMediaItem) => {
      // Make this the active file
      setActiveFileId(item.id);
      // Jump playhead to the start of this file
      setGlobalTimestamp(item.capturedAt);
      // Also select it for metadata display
      handleItemClick(item);
    },
    [setGlobalTimestamp, handleItemClick]
  );

  // Handle flag click (jump to timestamp)
  const handleFlagClick = useCallback(
    (flag: Flag) => {
      setGlobalTimestamp(flag.timestamp);
    },
    [setGlobalTimestamp]
  );


  // Toggle file visibility (only one can be active at a time)
  const handleFileVisibilityToggle = useCallback((fileId: string) => {
    setActiveFileId((prev) => (prev === fileId ? null : fileId));
  }, []);

  // Format timecode from timestamp
  const formatTimecode = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }, []);

  // Format duration in seconds to human readable
  const formatDuration = useCallback((seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  }, []);

  // Format timestamp for display on blocks (just time, shorter format)
  const formatBlockTimestamp = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Determine if an item is locked
  // Files WITH timestamps (capturedAt) are LOCKED by default
  // Files WITHOUT timestamps are UNLOCKED by default
  // Manual overrides are tracked in manuallyUnlockedItems and manuallyLockedItems
  const isItemLocked = useCallback((item: TimelineMediaItem): boolean => {
    const hasTimestamp = item.capturedAt !== undefined && item.capturedAt !== null && item.capturedAt > 0;

    if (hasTimestamp) {
      // Default locked, check if manually unlocked
      return !manuallyUnlockedItems.has(item.id);
    } else {
      // Default unlocked, check if manually locked
      return manuallyLockedItems.has(item.id);
    }
  }, [manuallyUnlockedItems, manuallyLockedItems]);

  // Toggle lock state for an item
  const toggleItemLock = useCallback((item: TimelineMediaItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }

    const hasTimestamp = item.capturedAt !== undefined && item.capturedAt !== null && item.capturedAt > 0;

    if (hasTimestamp) {
      // Default is locked - toggle by adding/removing from manuallyUnlockedItems
      setManuallyUnlockedItems(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id); // Re-lock (back to default)
        } else {
          next.add(item.id); // Unlock
        }
        return next;
      });
    } else {
      // Default is unlocked - toggle by adding/removing from manuallyLockedItems
      setManuallyLockedItems(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) {
          next.delete(item.id); // Re-unlock (back to default)
        } else {
          next.add(item.id); // Lock
        }
        return next;
      });
    }
  }, []);

  // ============================================================================
  // MOVEMENT LOGIC (Arrow Key Controls) - Row-based System
  // ============================================================================

  // Get all items in a specific row for overlap checking
  const getItemsInRow = useCallback((rowIndex: number, itemType: 'video' | 'audio' | 'photo'): TimelineMediaItem[] => {
    if (itemType === 'video') {
      return packedRowData.videoRows[rowIndex] || [];
    } else if (itemType === 'audio') {
      return packedRowData.audioRows[rowIndex] || [];
    } else {
      return packedRowData.imageRows[rowIndex] || [];
    }
  }, [packedRowData]);

  // Check if a time position would cause overlap with other items in the same row
  // Returns the nearest valid position if overlap would occur, or null if position is valid
  const checkRowOverlap = useCallback((
    movingItem: TimelineMediaItem,
    newStartTime: number,
    targetRowIndex: number
  ): { valid: boolean; snappedTime?: number } => {
    const otherItems = getItemsInRow(targetRowIndex, movingItem.type).filter(i => i.id !== movingItem.id);
    const movingDuration = movingItem.type === 'photo'
      ? IMAGE_MIN_DURATION_MS
      : (movingItem.duration || 0) * 1000;
    const newEndTime = newStartTime + movingDuration;

    for (const item of otherItems) {
      const itemStart = computeEffectiveStartTime(item);
      const itemDuration = item.type === 'photo'
        ? IMAGE_MIN_DURATION_MS
        : (item.duration || 0) * 1000;
      const itemEnd = itemStart + itemDuration;

      // Check for overlap: new item overlaps with existing item
      if (newStartTime < itemEnd && newEndTime > itemStart) {
        // Try snapping to just before or after the blocking item
        const snapBefore = itemStart - movingDuration;
        const snapAfter = itemEnd;

        // Choose the snap position closest to the intended position
        const distBefore = Math.abs(newStartTime - snapBefore);
        const distAfter = Math.abs(newStartTime - snapAfter);

        if (distBefore <= distAfter && snapBefore >= (timeRange?.start || 0)) {
          return { valid: false, snappedTime: snapBefore };
        } else if (snapAfter + movingDuration <= (timeRange?.end || Infinity)) {
          return { valid: false, snappedTime: snapAfter };
        }
        // Can't fit anywhere - prevent movement
        return { valid: false };
      }
    }

    return { valid: true };
  }, [getItemsInRow, computeEffectiveStartTime, timeRange]);

  // Move item horizontally (shift time position)
  // Only allowed when file is unlocked (locked files cannot move)
  const moveItemHorizontal = useCallback((item: TimelineMediaItem, shiftMs: number) => {
    // Check if item is locked - locked files cannot move horizontally
    if (isItemLocked(item)) {
      setLockedMoveToast({ visible: true, message: 'File is locked - unlock to move' });
      return false;
    }

    const currentOffset = itemTimeOffsets[item.id] || 0;
    const newOffset = currentOffset + shiftMs;
    const currentRowIndex = getItemRowIndex(item);

    // Calculate new absolute time
    const baseTime = timeRange?.start || 0;
    const newStartTime = baseTime + newOffset;

    // Check bounds
    if (newStartTime < (timeRange?.start || 0)) {
      return false;
    }
    const itemDuration = item.type === 'photo'
      ? IMAGE_MIN_DURATION_MS
      : (item.duration || 0) * 1000;
    if (newStartTime + itemDuration > (timeRange?.end || Infinity)) {
      return false;
    }

    // Check for overlaps in the current row
    const overlapCheck = checkRowOverlap(item, newStartTime, currentRowIndex);
    if (!overlapCheck.valid && !overlapCheck.snappedTime) {
      setLockedMoveToast({ visible: true, message: 'Cannot move: would overlap' });
      return false;
    }

    const finalOffset = overlapCheck.snappedTime
      ? overlapCheck.snappedTime - baseTime
      : newOffset;

    setItemTimeOffsets(prev => ({
      ...prev,
      [item.id]: finalOffset,
    }));
    return true;
  }, [isItemLocked, itemTimeOffsets, getItemRowIndex, timeRange, checkRowOverlap]);

  // Check if moving to a target row would cause overlap (stricter - no time snapping)
  const checkTargetRowOverlap = useCallback((
    movingItem: TimelineMediaItem,
    targetRowIndex: number
  ): boolean => {
    const itemStart = computeEffectiveStartTime(movingItem);
    const itemEnd = computeEffectiveEndTime(movingItem);

    const otherItems = getItemsInRow(targetRowIndex, movingItem.type).filter(i => i.id !== movingItem.id);

    for (const item of otherItems) {
      const otherStart = computeEffectiveStartTime(item);
      const otherEnd = computeEffectiveEndTime(item);

      // Check for overlap
      if (itemStart < otherEnd && itemEnd > otherStart) {
        return true; // Has overlap
      }
    }

    return false; // No overlap
  }, [getItemsInRow, computeEffectiveStartTime, computeEffectiveEndTime]);

  // Move item vertically (change rows)
  // Snaps to first available row in the requested direction, skipping occupied rows
  const moveItemVertical = useCallback((item: TimelineMediaItem, direction: 'up' | 'down') => {
    // Check if item is locked
    if (isItemLocked(item)) {
      setLockedMoveToast({ visible: true, message: 'File is locked' });
      return false;
    }

    const currentRowIndex = getItemRowIndex(item);
    const totalRows = getRowCount(item.type);

    // Search for the first available row in the requested direction
    const step = direction === 'up' ? -1 : 1;
    let targetRowIndex = currentRowIndex + step;

    // For "down" movement, allow creating a new row beyond current rows
    const maxRowIndex = direction === 'down' ? totalRows : totalRows - 1;

    // Keep searching in the requested direction until we find a free row or hit bounds
    while (targetRowIndex >= 0 && targetRowIndex <= maxRowIndex) {
      // Check for overlap in the target row
      const hasOverlap = checkTargetRowOverlap(item, targetRowIndex);

      if (!hasOverlap) {
        // Found a free row - move to it
        setItemRowAssignments(prev => ({
          ...prev,
          [item.id]: targetRowIndex,
        }));
        return true;
      }

      // Row is occupied, try the next one in the same direction
      targetRowIndex += step;
    }

    // No free row found in that direction
    setLockedMoveToast({ visible: true, message: 'Cannot move: no open row in that direction' });
    return false;
  }, [isItemLocked, getItemRowIndex, getRowCount, checkTargetRowOverlap]);

  // Handle arrow key movement for the active/selected item
  const handleArrowKeyMovement = useCallback((e: KeyboardEvent) => {
    // Only handle arrow keys
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      return;
    }

    // Need an active file to move
    const activeItem = activeFileId ? items.find(i => i.id === activeFileId) : null;
    if (!activeItem) {
      return;
    }

    // Prevent default scrolling behavior
    e.preventDefault();

    switch (e.key) {
      case 'ArrowUp':
        moveItemVertical(activeItem, 'up');
        break;
      case 'ArrowDown':
        moveItemVertical(activeItem, 'down');
        break;
      case 'ArrowLeft': {
        // Shift time earlier (only for non-timestamped files)
        let shiftAmount = SHIFT_1_SECOND;
        if (e.shiftKey) {
          shiftAmount = SHIFT_10_SECONDS;
        } else if (e.ctrlKey || e.metaKey) {
          shiftAmount = SHIFT_1_FRAME;
        }
        moveItemHorizontal(activeItem, -shiftAmount);
        break;
      }
      case 'ArrowRight': {
        // Shift time later (only for non-timestamped files)
        let shiftAmount = SHIFT_1_SECOND;
        if (e.shiftKey) {
          shiftAmount = SHIFT_10_SECONDS;
        } else if (e.ctrlKey || e.metaKey) {
          shiftAmount = SHIFT_1_FRAME;
        }
        moveItemHorizontal(activeItem, shiftAmount);
        break;
      }
    }
  }, [activeFileId, items, moveItemVertical, moveItemHorizontal]);

  // Register arrow key movement handler
  useEffect(() => {
    window.addEventListener('keydown', handleArrowKeyMovement);
    return () => window.removeEventListener('keydown', handleArrowKeyMovement);
  }, [handleArrowKeyMovement]);

  // ============================================================================
  // CONTEXT MENU HANDLERS
  // ============================================================================

  // Open context menu on right-click
  const handleContextMenu = useCallback((event: React.MouseEvent, item: TimelineMediaItem) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      item,
    });
  }, []);

  // Close context menu
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu: Add flag at current playhead position
  const handleAddFlagAtPlayhead = useCallback(() => {
    if (contextMenu?.item) {
      console.log('Add flag at playhead:', formatTimecode(globalTimestamp), 'for item:', contextMenu.item.fileName);
      // TODO: Integrate with flag creation system
    }
    handleCloseContextMenu();
  }, [contextMenu, globalTimestamp, formatTimecode, handleCloseContextMenu]);

  // Context menu: Open in respective tool
  const handleOpenInTool = useCallback(() => {
    if (contextMenu?.item) {
      const toolMap: Record<string, 'video' | 'audio' | 'images'> = {
        video: 'video',
        audio: 'audio',
        photo: 'images',
      };
      const tool = toolMap[contextMenu.item.type];
      if (tool) {
        navigateToTool(tool, contextMenu.item.evidenceId);
      }
    }
    handleCloseContextMenu();
  }, [contextMenu, navigateToTool, handleCloseContextMenu]);

  // Context menu: View metadata (select the item)
  const handleViewMetadata = useCallback(() => {
    if (contextMenu?.item) {
      handleItemClick(contextMenu.item);
    }
    handleCloseContextMenu();
  }, [contextMenu, handleItemClick, handleCloseContextMenu]);

  // Context menu: Remove from timeline
  const handleRemoveFromTimeline = useCallback(() => {
    if (contextMenu?.item) {
      setRemovedItemIds(prev => new Set([...prev, contextMenu.item!.id]));
      // Clear selection if this item was selected
      if (selectedTimelineItem?.id === contextMenu.item.id) {
        setSelectedTimelineItem(null);
      }
      if (activeFileId === contextMenu.item.id) {
        setActiveFileId(null);
      }
    }
    handleCloseContextMenu();
  }, [contextMenu, selectedTimelineItem, activeFileId, handleCloseContextMenu]);

  // Get tool name for context menu label
  const getToolName = useCallback((type: string): string => {
    const toolNames: Record<string, string> = {
      video: 'Video Tool',
      audio: 'Audio Tool',
      photo: 'Image Tool',
    };
    return toolNames[type] || 'Tool';
  }, []);

  // ============================================================================
  // DRAG AND DROP HANDLERS (Evidence Bank to Timeline)
  // ============================================================================

  // Handle drag start from Evidence Bank
  const handleDragStart = useCallback((itemId: string) => {
    setDraggedEvidenceId(itemId);
  }, []);

  // Handle drag over a row
  const handleDragOverRow = useCallback((event: React.DragEvent, rowIndex: number, type: string) => {
    event.preventDefault();
    setDragOverLane({ row: rowIndex, type });
  }, []);

  // Handle drag leave
  const handleDragLeaveRow = useCallback(() => {
    setDragOverLane(null);
  }, []);

  // Handle drop on timeline row
  const handleDropOnRow = useCallback((event: React.DragEvent, targetRowIndex: number, targetType: string) => {
    event.preventDefault();
    setDragOverLane(null);

    if (!draggedEvidenceId) return;

    // Remove from removed items set (re-add to timeline)
    // The item will be auto-packed into its appropriate row
    setRemovedItemIds(prev => {
      const next = new Set(prev);
      next.delete(draggedEvidenceId);
      return next;
    });

    // Optionally assign to specific row if user drags to a specific row
    if (targetRowIndex >= 0) {
      setItemRowAssignments(prev => ({
        ...prev,
        [draggedEvidenceId]: targetRowIndex,
      }));
    }

    setDraggedEvidenceId(null);
  }, [draggedEvidenceId]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedEvidenceId(null);
    setDragOverLane(null);
  }, []);

  // Check if a row is currently being dragged over
  const isRowDragOver = useCallback((rowIndex: number, type: string): boolean => {
    return dragOverLane?.row === rowIndex && dragOverLane?.type === type;
  }, [dragOverLane]);

  // Handle lane height change
  const handleLaneHeightChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, newSize: LaneHeightSize | null) => {
      if (newSize !== null) {
        setLaneHeightSize(newSize);
      }
    },
    []
  );

  // ============================================================================
  // FILE DROP ZONE HANDLERS
  // ============================================================================

  // Show toast notification
  const showToast = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ open: true, message, severity });
  }, []);

  // Close toast notification
  const handleCloseToast = useCallback(() => {
    setToast(prev => ({ ...prev, open: false }));
  }, []);

  // Process imported files and add to timeline
  const processImportedFiles = useCallback((files: File[]) => {
    console.log('[DROP] processImportedFiles called with', files.length, 'files');
    const sortedFiles = sortFilesByType(files);
    const newItems: TimelineMediaItem[] = [];
    let importedCount = 0;
    let skippedCount = 0;

    const sessionStart = timeRange?.start || Date.now();
    const sessionEnd = timeRange?.end || (sessionStart + 90 * 60 * 1000); // Default 90 min session

    // Process each file type
    const processFile = (file: File, type: MediaFileType) => {
      console.log('[DROP] processFile called for:', file.name, 'type:', type);
      // Try to generate test metadata in development mode
      const testMetadata = generateTestMetadataIfDev(file, { start: sessionStart, end: sessionEnd });

      // Use test metadata if available (dev mode), otherwise use defaults
      const id = testMetadata?.id || generateImportId();
      const user = testMetadata?.user || extractUserFromFile(file) || ''; // Empty = Unassigned lane

      // Duration in seconds (test metadata is in ms, so divide by 1000)
      const durationSeconds = testMetadata?.duration
        ? Math.floor(testMetadata.duration / 1000)
        : type !== 'image' ? 60 : undefined;

      // Calculate timestamp - use test metadata timestamp or session start
      // Clamp to ensure clip doesn't exceed session bounds
      let capturedAt = testMetadata?.timestamp.getTime() || sessionStart;
      const durationMs = (durationSeconds || 0) * 1000;

      // If clip would extend past session end, clamp the start time earlier
      if (capturedAt + durationMs > sessionEnd) {
        capturedAt = Math.max(sessionStart, sessionEnd - durationMs);
      }

      // Debug: Log the metadata being applied
      console.log('[SessionTimeline] Processing file:', {
        fileName: file.name,
        hasTestMetadata: !!testMetadata,
        user,
        capturedAt: new Date(capturedAt).toISOString(),
        deviceInfo: testMetadata?.deviceId || 'Imported File',
      });

      const newItem: TimelineMediaItem = {
        id,
        evidenceId: `ev-${id}`,
        type: type === 'image' ? 'photo' : type,
        fileName: file.name,
        capturedAt,
        duration: durationSeconds,
        endAt: durationSeconds ? capturedAt + durationSeconds * 1000 : undefined,
        user,
        deviceInfo: testMetadata?.deviceId || 'Imported File',
        format: file.type || 'Unknown',
        gps: testMetadata?.gpsCoordinates
          ? formatGPSCoordinates(testMetadata.gpsCoordinates)
          : undefined,
        flagCount: 0,
        hasEdits: false,
        flags: [],
      };

      newItems.push(newItem);
      importedCount++;
    };

    console.log('[DROP] Sorted files:', { video: sortedFiles.video.length, audio: sortedFiles.audio.length, image: sortedFiles.image.length });

    // Process video files
    sortedFiles.video.forEach(file => processFile(file, 'video'));
    // Process audio files
    sortedFiles.audio.forEach(file => processFile(file, 'audio'));
    // Process image files
    sortedFiles.image.forEach(file => processFile(file, 'image'));

    // Count unsupported files
    const totalSupported = sortedFiles.video.length + sortedFiles.audio.length + sortedFiles.image.length;
    skippedCount = files.length - totalSupported;

    // Add new items to state
    if (newItems.length > 0) {
      // Debug: Log user distribution summary
      const userCounts = newItems.reduce((acc, item) => {
        const userKey = item.user || 'Unassigned';
        acc[userKey] = (acc[userKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log('[SessionTimeline] Import summary - User distribution:', userCounts);

      setItems(prev => [...prev, ...newItems]);

      // Persist to session store if we have an active session
      if (activeSessionId) {
        // Convert TimelineMediaItem to SessionEvidence format
        const sessionEvidence: SessionEvidence[] = newItems.map((item) => ({
          id: item.id,
          evidenceId: item.evidenceId,
          type: item.type,
          fileName: item.fileName,
          thumbnailUrl: item.thumbnailUrl,
          capturedAt: item.capturedAt,
          duration: item.duration,
          endAt: item.endAt,
          user: item.user,
          deviceInfo: item.deviceInfo,
          format: item.format,
          gps: item.gps,
          flagCount: item.flagCount,
          hasEdits: item.hasEdits,
          flags: item.flags,
        }));
        addSessionEvidence(activeSessionId, sessionEvidence);
      }

      // Show success toast
      let message = `Imported ${importedCount} file${importedCount !== 1 ? 's' : ''}`;
      if (skippedCount > 0) {
        message += ` (${skippedCount} unsupported file${skippedCount !== 1 ? 's' : ''} skipped)`;
      }
      showToast(message, 'success');
    } else if (skippedCount > 0) {
      showToast(`No supported files found. ${skippedCount} file${skippedCount !== 1 ? 's were' : ' was'} skipped.`, 'warning');
    }
  }, [timeRange, showToast, activeSessionId, addSessionEvidence]);

  // Handle file drag enter on timeline
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragCounter(prev => prev + 1);
    if (e.dataTransfer.types.includes('Files')) {
      setIsFileDragOver(true);
    }
  }, []);

  // Handle file drag leave on timeline
  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsFileDragOver(false);
        return 0;
      }
      return newCount;
    });
  }, []);

  // Handle file drag over on timeline
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Handle file drop on timeline
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    console.log('[DROP] handleFileDrop triggered, files:', e.dataTransfer.files.length);
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);
    setFileDragCounter(0);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processImportedFiles(droppedFiles);
    }
  }, [processImportedFiles]);

  // Handle Import Files button click
  const handleImportButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file input change (for Import Files button)
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      processImportedFiles(selectedFiles);
    }
    // Reset input value so same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processImportedFiles]);

  // Handle divider drag for resizing
  const handleDividerDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      e.preventDefault();
      setIsDraggingDivider(true);

      const containerRect = containerRef.current.getBoundingClientRect();

      const handleMove = (moveEvent: MouseEvent) => {
        const y = moveEvent.clientY - containerRect.top;
        const percent = (y / containerRect.height) * 100;
        // Clamp between 20% and 80%
        setDividerPosition(Math.max(20, Math.min(80, percent)));
      };

      const handleUp = () => {
        setIsDraggingDivider(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    []
  );

  // Format time for ruler
  const formatRulerTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render time ruler
  const renderTimeRuler = () => {
    if (!timeRange) return null;
    const duration = timeRange.end - timeRange.start;
    // Calculate appropriate interval based on duration
    let intervalMs = 600000; // 10 min default
    if (duration < 1800000) intervalMs = 60000; // 1 min for < 30 min
    else if (duration < 7200000) intervalMs = 300000; // 5 min for < 2 hr

    const markers: React.ReactElement[] = [];
    const startOffset = Math.ceil(timeRange.start / intervalMs) * intervalMs;

    for (let t = startOffset; t <= timeRange.end; t += intervalMs) {
      const left = ((t - timeRange.start) / duration) * 100;
      markers.push(
        <TimeRulerTick key={t} sx={{ left: `${left}%` }}>
          <Box sx={{ width: 1, height: 8, backgroundColor: '#333' }} />
          <TimeRulerLabel>{formatRulerTime(t)}</TimeRulerLabel>
        </TimeRulerTick>
      );
    }

    return markers;
  };

  // Render clips in a lane
  const renderLane = (
    laneItems: TimelineMediaItem[],
    laneType: 'video' | 'audio' | 'image'
  ) => {
    // Calculate max chars for file name based on clip height
    const maxChars = clipHeight < 20 ? 8 : clipHeight < 24 ? 12 : 18;

    return laneItems.map((item) => {
      // Use effective start time (accounts for time offsets)
      const effectiveStartTime = getEffectiveStartTime(item);
      const pos = getClipPosition(effectiveStartTime, item.duration);
      const effectiveEndTime = effectiveStartTime + (item.duration || 0) * 1000;
      const isHighlighted =
        effectiveStartTime <= globalTimestamp &&
        (effectiveEndTime >= globalTimestamp || effectiveStartTime + 1000 >= globalTimestamp);
      const isActive = activeFileId === item.id;
      const isDimmed = activeFileId !== null && !isActive;
      const isLocked = isItemLocked(item);

      // Lock button styling
      const lockButtonSize = clipHeight < 24 ? 14 : 18;
      const lockIconSize = clipHeight < 24 ? 10 : 12;

      // Lock toggle button component (rendered as tail of clip or icon)
      const LockToggle = (
        <Box
          onClick={(e) => toggleItemLock(item, e)}
          sx={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: lockButtonSize + 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isLocked ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
            '&:hover': {
              backgroundColor: isLocked ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.25)',
            },
          }}
        >
          {isLocked ? (
            <LockIcon sx={{ fontSize: lockIconSize, color: '#ffa726', opacity: 0.9 }} />
          ) : (
            <LockOpenIcon sx={{ fontSize: lockIconSize, color: '#81c784', opacity: 0.9 }} />
          )}
        </Box>
      );

      if (laneType === 'image') {
        const isHovered = hoveredImageId === item.id;
        const imageLineContent = (
          <TimelineImageLine
            key={item.id}
            highlighted={isActive}
            imageHeight={clipHeight}
            sx={{
              left: pos.left,
              opacity: isDimmed ? 0.55 : isLocked ? 0.85 : 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleFileVisibilityToggle(item.id);
              handleItemClick(item);
            }}
            onDoubleClick={(e) => { e.stopPropagation(); handleItemDoubleClick(item); }}
            onContextMenu={(e) => handleContextMenu(e, item)}
            onMouseEnter={() => setHoveredImageId(item.id)}
            onMouseLeave={() => setHoveredImageId(null)}
          >
            {/* Thumbnail popup on hover */}
            {isHovered && (
              <ImageThumbnailPopup>
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                }}>
                  <Box sx={{
                    width: 60,
                    height: 45,
                    backgroundColor: '#252525',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <PhotoIcon sx={{ fontSize: 20, color: '#5a7fbf' }} />
                  </Box>
                  <Typography sx={{ fontSize: 9, color: '#e1e1e1', textAlign: 'center', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.fileName}
                  </Typography>
                  <Typography sx={{ fontSize: 8, color: '#888' }}>
                    {formatBlockTimestamp(item.capturedAt)}
                  </Typography>
                  {isLocked && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#ffa726' }}>
                      <LockIcon sx={{ fontSize: 10 }} />
                      <Typography sx={{ fontSize: 7 }}>Locked</Typography>
                    </Box>
                  )}
                </Box>
              </ImageThumbnailPopup>
            )}
          </TimelineImageLine>
        );

        return imageLineContent;
      }

      // Render flags on clip as vertical lines
      const clipFlags = item.flags.map((flag) => {
        const flagOffset =
          item.duration && item.duration > 0
            ? (flag.timestamp / item.duration) * 100
            : 50;
        const tooltipContent = flag.note ? `${flag.title}: ${flag.note}` : flag.title;
        return (
          <Tooltip key={flag.id} title={tooltipContent} placement="top" arrow>
            <FlagLine
              color={flag.color}
              clipHeight={clipHeight}
              sx={{ left: `${Math.min(90, Math.max(5, flagOffset))}%` }}
              onClick={(e) => {
                e.stopPropagation();
                setGlobalTimestamp(flag.absoluteTimestamp);
              }}
            />
          </Tooltip>
        );
      });

      // Video/Audio clip content with all info displayed directly on block
      const clipContent = (
        <TimelineClip
          clipType={laneType}
          highlighted={isActive}
          clipHeight={clipHeight}
          sx={{
            left: pos.left,
            width: pos.width,
            minWidth: clipHeight < 20 ? 60 : 80,
            opacity: isDimmed ? 0.55 : isLocked ? 0.85 : 1,
            transition: 'opacity 0.15s, border-color 0.15s, box-shadow 0.15s',
            border: isActive ? '2px solid #19abb5' : '2px solid transparent',
            boxShadow: isActive ? '0 0 10px rgba(25, 171, 181, 0.6)' : 'none',
            paddingRight: lockButtonSize + 8,
          }}
          onClick={(e) => {
            e.stopPropagation();
            handleFileVisibilityToggle(item.id);
            handleItemClick(item);
          }}
          onDoubleClick={(e) => { e.stopPropagation(); handleItemDoubleClick(item); }}
          onContextMenu={(e) => handleContextMenu(e, item)}
        >
          {/* Main content area - show filename, timestamp, user, duration */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            justifyContent: 'center',
          }}>
            {/* Top row: filename */}
            <Typography
              sx={{
                fontSize: clipHeight < 20 ? 8 : clipHeight < 24 ? 9 : 10,
                color: '#fff',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {item.fileName.length > maxChars ? item.fileName.substring(0, maxChars - 3) + '...' : item.fileName}
            </Typography>

            {/* Bottom row: timestamp | user | duration (only if clip is tall enough) */}
            {clipHeight >= 24 && (
              <Box sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                overflow: 'hidden',
              }}>
                <Typography sx={{
                  fontSize: clipHeight < 30 ? 7 : 8,
                  color: 'rgba(255,255,255,0.7)',
                  whiteSpace: 'nowrap',
                }}>
                  {formatBlockTimestamp(item.capturedAt)}
                </Typography>
                <Typography sx={{ fontSize: clipHeight < 30 ? 7 : 8, color: 'rgba(255,255,255,0.4)' }}>•</Typography>
                <Typography sx={{
                  fontSize: clipHeight < 30 ? 7 : 8,
                  color: 'rgba(255,255,255,0.7)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {item.user || '?'}
                </Typography>
                {item.duration && (
                  <>
                    <Typography sx={{ fontSize: clipHeight < 30 ? 7 : 8, color: 'rgba(255,255,255,0.4)' }}>•</Typography>
                    <Typography sx={{
                      fontSize: clipHeight < 30 ? 7 : 8,
                      color: 'rgba(255,255,255,0.7)',
                      whiteSpace: 'nowrap',
                    }}>
                      {formatDuration(item.duration)}
                    </Typography>
                  </>
                )}
              </Box>
            )}
          </Box>

          {/* Flag markers */}
          {clipFlags}

          {/* Lock toggle button at tail */}
          {LockToggle}
        </TimelineClip>
      );

      // Wrap in tooltip only if locked
      if (isLocked) {
        return (
          <Tooltip key={item.id} title="🔒 Locked - unlock to move" placement="top" arrow>
            {clipContent}
          </Tooltip>
        );
      }
      return <React.Fragment key={item.id}>{clipContent}</React.Fragment>;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          backgroundColor: '#121212',
        }}
      >
        <CircularProgress sx={{ color: '#19abb5' }} />
      </Box>
    );
  }

  // Get active file for preview (any type - video, audio, or image)
  const activeFile = items.find((i) => i.id === activeFileId);

  // Check if any lanes have items that should be dimmed
  const hasActiveFile = activeFileId !== null;

  // Main content (center area)
  const mainContent = (
    <MainContainer
      ref={containerRef}
      onDragEnter={handleFileDragEnter}
      onDragLeave={handleFileDragLeave}
      onDragOver={handleFileDragOver}
      onDrop={handleFileDrop}
      sx={{ position: 'relative' }}
    >
      {/* Hidden file input for Import button */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.mp4,.mov,.avi,.webm,.mkv,.mp3,.wav,.ogg,.m4a,.flac,.aac,.jpg,.jpeg,.png,.gif,.webp,.tiff,.bmp"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* File drop overlay */}
      <FileDropOverlay isActive={isFileDragOver}>
        <FolderOpenIcon sx={{ fontSize: 64, color: '#19abb5', mb: 2 }} />
        <Typography sx={{ color: '#e1e1e1', fontSize: 16, fontWeight: 500 }}>
          Drop files to import
        </Typography>
        <Typography sx={{ color: '#888', fontSize: 12, mt: 1 }}>
          Video, Audio, and Image files supported
        </Typography>
      </FileDropOverlay>
      {/* Unified Preview Section - shows video/audio/image based on selection */}
      <UnifiedPreviewSection
        sx={{
          height: `${dividerPosition}%`,
          flex: 'none',
          userSelect: isDraggingDivider ? 'none' : 'auto',
        }}
      >
        {!activeFile ? (
          // No file selected placeholder
          <PreviewPlaceholder>
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
                flexDirection: 'column',
              }}
            >
              <VideocamIcon sx={{ fontSize: 48, color: '#333', mb: 1 }} />
              <Typography sx={{ color: '#555', fontSize: 12 }}>
                No file selected
              </Typography>
              <Typography sx={{ color: '#444', fontSize: 10, mt: 1 }}>
                Click a file on the timeline to preview
              </Typography>
            </Box>
          </PreviewPlaceholder>
        ) : activeFile.type === 'video' ? (
          // Video preview
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              flexDirection: 'column',
            }}
          >
            <VideocamIcon sx={{ fontSize: 56, color: '#c45c5c', mb: 1 }} />
            <Typography sx={{ color: '#e1e1e1', fontSize: 14, fontWeight: 500 }}>
              {activeFile.fileName}
            </Typography>
            <Typography sx={{ color: '#666', fontSize: 11, mt: 0.5 }}>
              {activeFile.user || 'Unknown'} • {activeFile.deviceInfo || 'Unknown device'}
            </Typography>
            <Typography sx={{ color: '#19abb5', fontSize: 11, mt: 1, fontFamily: '"JetBrains Mono", monospace' }}>
              {formatTimecode(globalTimestamp)}
            </Typography>
          </Box>
        ) : activeFile.type === 'audio' ? (
          // Audio waveform preview
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #0f1a0f 0%, #1a2a1a 50%, #0f1a0f 100%)',
              flexDirection: 'column',
            }}
          >
            <GraphicEqIcon sx={{ fontSize: 56, color: '#5a9a6b', mb: 1 }} />
            <Typography sx={{ color: '#e1e1e1', fontSize: 14, fontWeight: 500 }}>
              {activeFile.fileName}
            </Typography>
            <Typography sx={{ color: '#666', fontSize: 11, mt: 0.5 }}>
              {activeFile.user || 'Unknown'} • {activeFile.deviceInfo || 'Unknown device'}
            </Typography>
            <Typography sx={{ color: '#19abb5', fontSize: 11, mt: 1, fontFamily: '"JetBrains Mono", monospace' }}>
              {formatTimecode(globalTimestamp)}
            </Typography>
            {/* Waveform placeholder */}
            <Box
              sx={{
                width: '80%',
                height: 40,
                mt: 2,
                background: 'linear-gradient(90deg, rgba(90, 154, 107, 0.3) 0%, rgba(90, 154, 107, 0.6) 25%, rgba(90, 154, 107, 0.4) 50%, rgba(90, 154, 107, 0.7) 75%, rgba(90, 154, 107, 0.3) 100%)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ color: '#5a9a6b', fontSize: 10 }}>Waveform</Typography>
            </Box>
          </Box>
        ) : (
          // Image preview (photo type)
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2a 50%, #0f0f1a 100%)',
              flexDirection: 'column',
              cursor: 'pointer',
            }}
            onClick={() => setImageModalOpen(true)}
          >
            <ImageIcon sx={{ fontSize: 64, color: '#5a7fbf', mb: 1 }} />
            <Typography sx={{ color: '#e1e1e1', fontSize: 14, fontWeight: 500 }}>
              {activeFile.fileName}
            </Typography>
            <Typography sx={{ color: '#666', fontSize: 11, mt: 0.5 }}>
              {activeFile.user || 'Unknown'} • {activeFile.deviceInfo || 'Unknown device'}
            </Typography>
            {activeFile.gps && (
              <Typography sx={{ color: '#19abb5', fontSize: 10, mt: 1 }}>
                📍 {activeFile.gps}
              </Typography>
            )}
            <Typography sx={{ color: '#555', fontSize: 9, mt: 2 }}>
              Click to enlarge
            </Typography>
          </Box>
        )}
      </UnifiedPreviewSection>

      {/* Embedded Transport Controls - directly under preview */}
      <EmbeddedTransportControls>
        <Tooltip title="Jump to start (Home)">
          <TransportButton onClick={jumpToStart} size="small">
            <SkipPreviousIcon sx={{ fontSize: 18 }} />
          </TransportButton>
        </Tooltip>
        <Tooltip title="Step back (←)">
          <TransportButton onClick={stepBackward} size="small">
            <FastRewindIcon sx={{ fontSize: 18 }} />
          </TransportButton>
        </Tooltip>
        <Tooltip title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          <PlayButton onClick={togglePlayback} size="small">
            {isPlaying ? <PauseIcon sx={{ fontSize: 20 }} /> : <PlayArrowIcon sx={{ fontSize: 20 }} />}
          </PlayButton>
        </Tooltip>
        <Tooltip title="Step forward (→)">
          <TransportButton onClick={stepForward} size="small">
            <FastForwardIcon sx={{ fontSize: 18 }} />
          </TransportButton>
        </Tooltip>
        <Tooltip title="Jump to end (End)">
          <TransportButton onClick={jumpToEnd} size="small">
            <SkipNextIcon sx={{ fontSize: 18 }} />
          </TransportButton>
        </Tooltip>
        <Box sx={{ ml: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ color: '#19abb5', fontSize: 12, fontFamily: '"JetBrains Mono", monospace' }}>
            {formatTimecode(globalTimestamp)}
          </Typography>
        </Box>
      </EmbeddedTransportControls>

      {/* Resizable Divider */}
      <ResizeDivider onMouseDown={handleDividerDrag}>
        <DragHandleIcon sx={{ fontSize: 16, color: '#555' }} />
      </ResizeDivider>

      {/* Timeline Section - takes remaining height */}
      <TimelineSection
        sx={{
          flex: 1,
          userSelect: isDraggingDivider ? 'none' : 'auto',
        }}
      >
        {/* Lane Height Controls Toolbar + Zoom Controls */}
        <LaneHeightToolbar>
          <Typography sx={{ fontSize: 9, color: '#666', textTransform: 'uppercase' }}>
            Lane Height:
          </Typography>
          <ToggleButtonGroup
            value={laneHeightSize}
            exclusive
            onChange={handleLaneHeightChange}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                padding: '2px 8px',
                fontSize: 9,
                color: '#666',
                border: '1px solid #333',
                textTransform: 'none',
                '&.Mui-selected': {
                  backgroundColor: 'rgba(25, 171, 181, 0.2)',
                  color: '#19abb5',
                  '&:hover': {
                    backgroundColor: 'rgba(25, 171, 181, 0.3)',
                  },
                },
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                },
              },
            }}
          >
            <ToggleButton value="small">S</ToggleButton>
            <ToggleButton value="medium">M</ToggleButton>
            <ToggleButton value="large">L</ToggleButton>
          </ToggleButtonGroup>
          <Typography sx={{ fontSize: 9, color: '#555', ml: 1 }}>
            {laneHeightSize === 'small' ? '0.5x' : laneHeightSize === 'medium' ? '1x' : '1.5x'}
          </Typography>

          {/* Import Files Button */}
          <ImportButton
            startIcon={<FolderOpenIcon sx={{ fontSize: 14 }} />}
            onClick={handleImportButtonClick}
          >
            Import Files
          </ImportButton>
        </LaneHeightToolbar>

        {/* Time Ruler */}
        <TimeRuler>{renderTimeRuler()}</TimeRuler>

        {/* Swim Lanes - Row-based Tetris auto-packing */}
        <SwimLanesContainer ref={lanesContainerRef}>
          {/* VIDEO Section - only show when there are video items */}
          {hasVideoItems && (
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#c45c5c"
              onClick={() => setVideoSectionCollapsed(!videoSectionCollapsed)}
            >
              <VideocamIcon sx={{ fontSize: 14, color: '#c45c5c' }} />
              <SectionTitle>Video [x7k]</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({visibleItems.filter((i) => i.type === 'video').length})
              </Typography>
              {videoSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!videoSectionCollapsed && (
              <>
                {/* Auto-packed rows */}
                {packedRowData.videoRows.map((rowItems, rowIndex) => (
                  <SwimLane key={`video-row-${rowIndex}`} laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <Typography
                        sx={{
                          fontSize: laneHeight < 24 ? 8 : 10,
                          color: '#666',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {rowIndex + 1}
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isRowDragOver(rowIndex, 'video')}
                      canDrop={!!draggedEvidenceId}
                      onDragOver={(e) => handleDragOverRow(e, rowIndex, 'video')}
                      onDragLeave={handleDragLeaveRow}
                      onDrop={(e) => handleDropOnRow(e, rowIndex, 'video')}
                    >
                      {renderLane(rowItems, 'video')}
                    </LaneContent>
                  </SwimLane>
                ))}
              </>
            )}
          </SwimLaneSection>
          )}

          {/* AUDIO Section - only show when there are audio items */}
          {hasAudioItems && (
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#5a9a6b"
              onClick={() => setAudioSectionCollapsed(!audioSectionCollapsed)}
            >
              <MicIcon sx={{ fontSize: 14, color: '#5a9a6b' }} />
              <SectionTitle>Audio [x7k]</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({visibleItems.filter((i) => i.type === 'audio').length})
              </Typography>
              {audioSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!audioSectionCollapsed && (
              <>
                {/* Auto-packed rows */}
                {packedRowData.audioRows.map((rowItems, rowIndex) => (
                  <SwimLane key={`audio-row-${rowIndex}`} laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <Typography
                        sx={{
                          fontSize: laneHeight < 24 ? 8 : 10,
                          color: '#666',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {rowIndex + 1}
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isRowDragOver(rowIndex, 'audio')}
                      canDrop={!!draggedEvidenceId}
                      onDragOver={(e) => handleDragOverRow(e, rowIndex, 'audio')}
                      onDragLeave={handleDragLeaveRow}
                      onDrop={(e) => handleDropOnRow(e, rowIndex, 'audio')}
                    >
                      {renderLane(rowItems, 'audio')}
                    </LaneContent>
                  </SwimLane>
                ))}
              </>
            )}
          </SwimLaneSection>
          )}

          {/* IMAGES Section - only show when there are image items */}
          {hasImageItems && (
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#5a7fbf"
              onClick={() => setImagesSectionCollapsed(!imagesSectionCollapsed)}
            >
              <PhotoIcon sx={{ fontSize: 14, color: '#5a7fbf' }} />
              <SectionTitle>Images [x7k]</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({visibleItems.filter((i) => i.type === 'photo').length})
              </Typography>
              {imagesSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!imagesSectionCollapsed && (
              <>
                {/* Auto-packed rows */}
                {packedRowData.imageRows.map((rowItems, rowIndex) => (
                  <SwimLane key={`images-row-${rowIndex}`} laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <Typography
                        sx={{
                          fontSize: laneHeight < 24 ? 8 : 10,
                          color: '#666',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {rowIndex + 1}
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isRowDragOver(rowIndex, 'image')}
                      canDrop={!!draggedEvidenceId}
                      onDragOver={(e) => handleDragOverRow(e, rowIndex, 'image')}
                      onDragLeave={handleDragLeaveRow}
                      onDrop={(e) => handleDropOnRow(e, rowIndex, 'image')}
                    >
                      {renderLane(rowItems, 'image')}
                    </LaneContent>
                  </SwimLane>
                ))}
              </>
            )}
          </SwimLaneSection>
          )}
        </SwimLanesContainer>
      </TimelineSection>
    </MainContainer>
  );

  // Right panel content - Flags only (image preview moved to center)
  const inspectorContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Selected file indicator */}
      {activeFile && (
        <Box
          sx={{
            padding: '8px 12px',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #252525',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {activeFile.type === 'video' && <VideocamIcon sx={{ fontSize: 14, color: '#c45c5c' }} />}
          {activeFile.type === 'audio' && <MicIcon sx={{ fontSize: 14, color: '#5a9a6b' }} />}
          {activeFile.type === 'photo' && <PhotoIcon sx={{ fontSize: 14, color: '#5a7fbf' }} />}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 11,
                color: '#e1e1e1',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeFile.fileName}
            </Typography>
            <Typography sx={{ fontSize: 9, color: '#666' }}>
              {activeFile.user || 'Unknown'} • {activeFile.flagCount} flag{activeFile.flagCount !== 1 ? 's' : ''}
            </Typography>
          </Box>
        </Box>
      )}

      {/* No file selected message */}
      {!activeFile && (
        <Box
          sx={{
            padding: '12px',
            backgroundColor: '#1a1a1a',
            borderBottom: '1px solid #252525',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: 11, color: '#555' }}>
            Select a file to view flags
          </Typography>
        </Box>
      )}

      {/* User filter for flags - only show when a file is selected and has flags */}
      {activeFile && flagUsers.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            padding: '6px 12px',
            backgroundColor: '#161616',
            borderBottom: '1px solid #252525',
          }}
        >
          <FilterListIcon sx={{ fontSize: 14, color: '#666' }} />
          <Typography sx={{ fontSize: 10, color: '#666' }}>Filter:</Typography>
          <FormControl size="small" sx={{ minWidth: 80 }}>
            <Select
              value={flagUserFilter}
              onChange={(e) => setFlagUserFilter(e.target.value)}
              sx={{
                fontSize: 10,
                color: '#ccc',
                height: 24,
                backgroundColor: '#252525',
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& .MuiSelect-select': { padding: '2px 8px' },
              }}
            >
              <MenuItem value="all" sx={{ fontSize: 11 }}>All Users</MenuItem>
              {flagUsers.map((user) => (
                <MenuItem key={user} value={user} sx={{ fontSize: 11 }}>
                  {user}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Flags Panel - takes full remaining space */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FlagsPanel
          flags={currentFlags}
          onFlagClick={handleFlagClick}
          onFlagAdd={() => console.log('Add flag')}
          onFlagEdit={(flag) => console.log('Edit flag:', flag.id)}
          onFlagDelete={(flagId) => console.log('Delete flag:', flagId)}
          disabled={!activeFile}
        />
      </Box>
    </Box>
  );

  return (
    <>
      <WorkspaceLayout
        evidencePanel={
          <EvidenceBank
            items={evidenceItems}
            selectedId={activeFileId}
            onSelect={(item) => {
              // When clicking an item in Evidence Bank, also select it on timeline
              setActiveFileId(item.id);
              setSelectedEvidence(item);
            }}
            onDoubleClick={(item) => {
              const toolMap: Record<string, 'video' | 'audio' | 'images'> = {
                video: 'video',
                audio: 'audio',
                image: 'images',
              };
              const tool = toolMap[item.type];
              if (tool) {
                navigateToTool(tool, item.id);
              }
            }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        }
        metadataPanel={
          <MetadataPanel
            data={
              selectedEvidence
                ? {
                    fileName: selectedEvidence.fileName,
                    capturedAt: selectedEvidence.capturedAt,
                    duration: selectedEvidence.duration,
                    user: selectedEvidence.user,
                    device: selectedEvidence.deviceInfo,
                    flagCount: selectedEvidence.flagCount,
                  }
                : null
            }
            type={selectedEvidence?.type || 'video'}
          />
        }
        inspectorPanel={inspectorContent}
        mainContent={mainContent}
        evidenceTitle="Evidence"
        inspectorTitle="Flags"
        showTransport={false}
      />

      {/* Context Menu for timeline clips */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            border: '1px solid #333333',
            minWidth: 200,
            '& .MuiMenuItem-root': {
              fontSize: 12,
              py: 1,
              '&:hover': {
                backgroundColor: 'rgba(25, 171, 181, 0.1)',
              },
            },
          },
        }}
      >
        <MenuItem onClick={handleAddFlagAtPlayhead}>
          <ListItemIcon>
            <FlagIcon sx={{ fontSize: 18, color: '#19abb5' }} />
          </ListItemIcon>
          <ListItemText
            primary={`Add flag at ${formatTimecode(globalTimestamp)}`}
            primaryTypographyProps={{ fontSize: 12 }}
          />
        </MenuItem>
        <MenuItem onClick={handleOpenInTool}>
          <ListItemIcon>
            <OpenInNewIcon sx={{ fontSize: 18, color: '#888' }} />
          </ListItemIcon>
          <ListItemText
            primary={`Open in ${contextMenu?.item ? getToolName(contextMenu.item.type) : 'Tool'}`}
            primaryTypographyProps={{ fontSize: 12 }}
          />
        </MenuItem>
        <MenuItem onClick={handleViewMetadata}>
          <ListItemIcon>
            <InfoIcon sx={{ fontSize: 18, color: '#888' }} />
          </ListItemIcon>
          <ListItemText
            primary="View metadata"
            primaryTypographyProps={{ fontSize: 12 }}
          />
        </MenuItem>
        <MenuItem onClick={handleRemoveFromTimeline} sx={{ color: '#e57373' }}>
          <ListItemIcon>
            <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: '#e57373' }} />
          </ListItemIcon>
          <ListItemText
            primary="Remove from timeline"
            primaryTypographyProps={{ fontSize: 12, color: '#e57373' }}
          />
        </MenuItem>
      </Menu>

      {/* Image Preview Modal - now shows active file if it's an image */}
      <Dialog
        open={imageModalOpen && activeFile?.type === 'photo'}
        onClose={(_, reason) => {
          // Only close on X button or Esc, not on backdrop click
          if (reason !== 'backdropClick') {
            setImageModalOpen(false);
          }
        }}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: 2,
            maxHeight: '90vh',
            overflow: 'hidden',
          },
        }}
      >
        {activeFile?.type === 'photo' && (
          <>
            {/* Modal Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid #333',
                backgroundColor: '#1e1e1e',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ImageIcon sx={{ fontSize: 24, color: '#5a7fbf' }} />
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#e1e1e1' }}>
                    {activeFile.fileName}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: '#888' }}>
                    {activeFile.user || 'Unknown'} • {activeFile.deviceInfo || 'Unknown device'}
                  </Typography>
                </Box>
              </Box>
              <IconButton
                onClick={() => setImageModalOpen(false)}
                sx={{
                  color: '#888',
                  '&:hover': {
                    color: '#e1e1e1',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>

            {/* Modal Content - Image Display */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#0d0d0d',
                minHeight: 400,
                maxHeight: 'calc(90vh - 150px)',
                padding: 4,
              }}
            >
              {/* Placeholder for actual image - would normally use <img> with real URL */}
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background:
                    'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
                  borderRadius: 1,
                }}
              >
                <ImageIcon sx={{ fontSize: 80, color: '#5a7fbf', mb: 2 }} />
                <Typography sx={{ fontSize: 16, color: '#888', mb: 1 }}>
                  {activeFile.fileName}
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#555' }}>
                  {activeFile.format || 'Image format unknown'}
                </Typography>
                {activeFile.gps && (
                  <Typography sx={{ fontSize: 11, color: '#19abb5', mt: 1 }}>
                    📍 {activeFile.gps}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Modal Footer */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid #333',
                backgroundColor: '#1e1e1e',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {activeFile.flagCount > 0 && (
                  <Typography sx={{ fontSize: 12, color: '#19abb5' }}>
                    {activeFile.flagCount} flag{activeFile.flagCount !== 1 ? 's' : ''}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 11, color: '#555' }}>
                  Press Esc to close
                </Typography>
              </Box>
              <Button
                variant="contained"
                onClick={() => {
                  setImageModalOpen(false);
                  navigateToTool('images', activeFile.evidenceId);
                }}
                startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
                sx={{
                  backgroundColor: '#19abb5',
                  color: '#fff',
                  fontSize: 12,
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#147a82',
                  },
                }}
              >
                Open in Image Tool
              </Button>
            </Box>
          </>
        )}
      </Dialog>

      {/* Locked move toast notification */}
      {lockedMoveToast.visible && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            color: '#ffa726',
            padding: '10px 20px',
            borderRadius: 2,
            border: '1px solid #ffa726',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease-out',
            '@keyframes fadeIn': {
              from: { opacity: 0, transform: 'translateX(-50%) translateY(10px)' },
              to: { opacity: 1, transform: 'translateX(-50%) translateY(0)' },
            },
          }}
        >
          <LockIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
            {lockedMoveToast.message}
          </Typography>
        </Box>
      )}

      {/* Toast notification for file import feedback */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          sx={{
            width: '100%',
            backgroundColor: toast.severity === 'success' ? '#1e3d1e' :
                           toast.severity === 'error' ? '#3d1e1e' :
                           toast.severity === 'warning' ? '#3d3d1e' : '#1e2d3d',
            color: '#e1e1e1',
            border: `1px solid ${
              toast.severity === 'success' ? '#5a9a6b' :
              toast.severity === 'error' ? '#c45c5c' :
              toast.severity === 'warning' ? '#e6a23c' : '#19abb5'
            }`,
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default SessionTimeline;
