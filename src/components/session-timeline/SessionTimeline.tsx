/**
 * SessionTimeline Component
 * Rebuilt to match the exact layout structure and styling of Video, Audio, and Image Tools
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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import PhotoIcon from '@mui/icons-material/Photo';
import ImageIcon from '@mui/icons-material/Image';
import PersonIcon from '@mui/icons-material/Person';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import FilterListIcon from '@mui/icons-material/FilterList';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import FlagIcon from '@mui/icons-material/Flag';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoIcon from '@mui/icons-material/Info';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';
import { MetadataPanel, FlagsPanel, type Flag } from '@/components/common';

import { usePlayheadStore } from '../../stores/usePlayheadStore';
import { useNavigationStore } from '../../stores/useNavigationStore';

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
// DUMMY DATA - Multiple users with comprehensive media files
// ============================================================================

const USERS = ['Sarah', 'Mike', 'Jen'];

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

// Video Preview Section (Top of Center)
const VideoPreviewSection = styled(Box)({
  flex: 1,
  minHeight: 200,
  backgroundColor: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  borderBottom: '1px solid #252525',
});

const VideoPlaceholder = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  color: '#444',
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

const LaneLabel = styled(Box)<{ laneHeight?: number }>(({ laneHeight = 36 }) => ({
  width: 100,
  minWidth: 100,
  padding: '0 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: laneHeight < 24 ? 8 : 10,
  color: '#666',
  backgroundColor: '#141414',
  height: '100%',
  borderRight: '1px solid #1f1f1f',
  overflow: 'hidden',
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

// Eyeball visibility button on clips
const ClipVisibilityButton = styled(Box)<{ isActive: boolean }>(({ isActive }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 2,
  borderRadius: 2,
  transition: 'all 0.15s',
  flexShrink: 0,
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  '& svg': {
    color: isActive ? '#19abb5' : 'rgba(255, 255, 255, 0.4)',
    fontSize: 14,
    transition: 'color 0.15s',
  },
}));

const FlagDot = styled(Box)<{ color?: string }>(({ color }) => ({
  position: 'absolute',
  top: 2,
  width: 6,
  height: 6,
  backgroundColor: color || '#19abb5',
  borderRadius: '50%',
  cursor: 'pointer',
  zIndex: 10,
  '&:hover': {
    transform: 'scale(1.5)',
    boxShadow: `0 0 6px ${color || '#19abb5'}`,
  },
}));

// Right Panel Components
const ImagePreviewSection = styled(Box)({
  height: 220,
  minHeight: 180,
  backgroundColor: '#0a0a0a',
  borderBottom: '1px solid #252525',
  display: 'flex',
  flexDirection: 'column',
});

const ImagePreviewHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #252525',
  minHeight: 28,
});

const ImagePreviewContent = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#000',
  position: 'relative',
});

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 32,
  textAlign: 'center',
});

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
  const [currentImage, setCurrentImage] = useState<TimelineMediaItem | null>(null);

  // Dummy data
  const [items] = useState<TimelineMediaItem[]>(() => generateDummyData());

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
  const [dragOverLane, setDragOverLane] = useState<{ user: string; type: string } | null>(null);

  // Loading state (for realistic UX)
  const [isLoading, setIsLoading] = useState(true);

  // Global playhead store
  const globalTimestamp = usePlayheadStore((state) => state.timestamp);
  const setGlobalTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const setSessionBounds = usePlayheadStore((state) => state.setSessionBounds);

  // Navigation store
  const navigateToTool = useNavigationStore((state) => state.navigateToTool);

  // Calculate time range from items
  const timeRange = useMemo(() => {
    if (items.length === 0) return null;
    let minTime = Infinity;
    let maxTime = -Infinity;
    items.forEach((item) => {
      minTime = Math.min(minTime, item.capturedAt);
      const endTime = item.endAt || item.capturedAt;
      maxTime = Math.max(maxTime, endTime);
    });
    // Add 2% padding
    const padding = (maxTime - minTime) * 0.02;
    return { start: minTime - padding, end: maxTime + padding };
  }, [items]);

  // Initialize on mount
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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

  // Determine which image is at current playhead position
  useEffect(() => {
    const photos = items
      .filter((item) => item.type === 'photo')
      .sort((a, b) => a.capturedAt - b.capturedAt);

    // Find the most recent image before or at the playhead
    let currentImg: TimelineMediaItem | null = null;
    for (const img of photos) {
      if (img.capturedAt <= globalTimestamp) {
        currentImg = img;
      } else {
        break;
      }
    }
    setCurrentImage(currentImg);
  }, [globalTimestamp, items]);

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

  // Group items by type and user for swim lanes (using visibleItems to exclude removed)
  const laneData = useMemo(() => {
    // Get unique users from items + permanent users (use all items for user list)
    const userSet = new Set<string>(USERS);
    items.forEach((item) => {
      if (item.user) userSet.add(item.user);
    });
    const users = Array.from(userSet).filter(Boolean);

    // Group by type and user (using visibleItems)
    const videoByUser: Record<string, TimelineMediaItem[]> = {};
    const audioByUser: Record<string, TimelineMediaItem[]> = {};
    const imagesByUser: Record<string, TimelineMediaItem[]> = {};
    const videoCatchAll: TimelineMediaItem[] = [];
    const audioCatchAll: TimelineMediaItem[] = [];
    const imagesCatchAll: TimelineMediaItem[] = [];

    users.forEach((u) => {
      videoByUser[u] = [];
      audioByUser[u] = [];
      imagesByUser[u] = [];
    });

    visibleItems.forEach((item) => {
      const user = item.user;
      if (item.type === 'video') {
        if (user && videoByUser[user]) {
          videoByUser[user].push(item);
        } else {
          videoCatchAll.push(item);
        }
      } else if (item.type === 'audio') {
        if (user && audioByUser[user]) {
          audioByUser[user].push(item);
        } else {
          audioCatchAll.push(item);
        }
      } else if (item.type === 'photo') {
        if (user && imagesByUser[user]) {
          imagesByUser[user].push(item);
        } else {
          imagesCatchAll.push(item);
        }
      }
    });

    return {
      users,
      videoByUser,
      audioByUser,
      imagesByUser,
      videoCatchAll,
      audioCatchAll,
      imagesCatchAll,
    };
  }, [items, visibleItems]);

  // Aggregate all flags at/near current playhead position
  const currentFlags = useMemo(() => {
    const flags: Flag[] = [];
    const tolerance = 5000; // 5 second tolerance for "at playhead"

    items.forEach((item) => {
      item.flags.forEach((flag) => {
        // Check if flag is near current playhead position
        if (Math.abs(flag.absoluteTimestamp - globalTimestamp) < tolerance) {
          flags.push({
            id: flag.id,
            timestamp: flag.absoluteTimestamp,
            label: flag.title,
            note: flag.note,
            createdBy: flag.userDisplayName,
            createdAt: flag.absoluteTimestamp,
          });
        }
      });
    });

    // Apply user filter
    if (flagUserFilter !== 'all') {
      return flags.filter((f) => f.createdBy === flagUserFilter);
    }

    return flags;
  }, [items, globalTimestamp, flagUserFilter]);

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

  // Handle drag over a lane
  const handleDragOverLane = useCallback((event: React.DragEvent, user: string, type: string) => {
    event.preventDefault();

    // Find the dragged item
    const draggedItem = items.find(i => i.id === draggedEvidenceId);
    if (!draggedItem) return;

    // Check if item can be dropped in this lane
    // Items can only go to their owner's lane or catch-all (empty user)
    const canDrop = !draggedItem.user || draggedItem.user === user || user === '';

    if (canDrop) {
      setDragOverLane({ user, type });
    }
  }, [draggedEvidenceId, items]);

  // Handle drag leave
  const handleDragLeaveLane = useCallback(() => {
    setDragOverLane(null);
  }, []);

  // Handle drop on timeline
  const handleDropOnTimeline = useCallback((event: React.DragEvent, targetUser: string, targetType: string) => {
    event.preventDefault();
    setDragOverLane(null);

    if (!draggedEvidenceId) return;

    const draggedItem = items.find(i => i.id === draggedEvidenceId);
    if (!draggedItem) return;

    // Check if item can be dropped in this lane
    const itemOwner = draggedItem.user || '';
    const canDrop = !itemOwner || itemOwner === targetUser || targetUser === '';

    if (canDrop) {
      // Remove from removed items set (re-add to timeline)
      setRemovedItemIds(prev => {
        const next = new Set(prev);
        next.delete(draggedEvidenceId);
        return next;
      });
    }

    setDraggedEvidenceId(null);
  }, [draggedEvidenceId, items]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedEvidenceId(null);
    setDragOverLane(null);
  }, []);

  // Check if dragged item can be dropped in a specific lane
  const canDropInLane = useCallback((laneUser: string): boolean => {
    if (!draggedEvidenceId) return false;
    const draggedItem = items.find(i => i.id === draggedEvidenceId);
    if (!draggedItem) return false;

    // Items can only go to their owner's lane or catch-all (empty user)
    const itemOwner = draggedItem.user || '';
    return !itemOwner || itemOwner === laneUser || laneUser === '';
  }, [draggedEvidenceId, items]);

  // Check if a lane is currently being dragged over
  const isLaneDragOver = useCallback((user: string, type: string): boolean => {
    return dragOverLane?.user === user && dragOverLane?.type === type;
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
    const maxChars = clipHeight < 20 ? 12 : clipHeight < 24 ? 18 : 25;

    return laneItems.map((item) => {
      const pos = getClipPosition(item.capturedAt, item.duration);
      const isHighlighted =
        item.capturedAt <= globalTimestamp &&
        (item.endAt ? item.endAt >= globalTimestamp : item.capturedAt + 1000 >= globalTimestamp);
      const isActive = activeFileId === item.id;
      const isDimmed = activeFileId !== null && !isActive;

      if (laneType === 'image') {
        const iconSize = clipHeight < 20 ? 8 : clipHeight < 24 ? 10 : 12;
        return (
          <TimelineImage
            key={item.id}
            highlighted={isHighlighted}
            imageHeight={clipHeight}
            sx={{
              left: pos.left,
              opacity: isDimmed ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
            onDoubleClick={(e) => { e.stopPropagation(); handleItemDoubleClick(item); }}
            onContextMenu={(e) => handleContextMenu(e, item)}
            title={`${item.fileName}\nDouble-click to focus`}
          >
            <Tooltip title={isActive ? 'Active - click to deactivate' : 'Click to activate'} placement="top">
              <ClipVisibilityButton
                isActive={isActive}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileVisibilityToggle(item.id);
                }}
              >
                {isActive ? (
                  <VisibilityIcon sx={{ fontSize: `${iconSize}px !important` }} />
                ) : (
                  <VisibilityOffIcon sx={{ fontSize: `${iconSize}px !important` }} />
                )}
              </ClipVisibilityButton>
            </Tooltip>
            {clipHeight >= 24 && (
              <PhotoIcon sx={{ fontSize: iconSize, color: '#fff' }} />
            )}
          </TimelineImage>
        );
      }

      // Render flags on clip
      const clipFlags = item.flags.map((flag) => {
        const flagOffset =
          item.duration && item.duration > 0
            ? (flag.timestamp / item.duration) * 100
            : 50;
        return (
          <FlagDot
            key={flag.id}
            color={flag.color}
            sx={{ left: `${Math.min(95, Math.max(5, flagOffset))}%` }}
            title={flag.title}
            onClick={(e) => {
              e.stopPropagation();
              setGlobalTimestamp(flag.absoluteTimestamp);
            }}
          />
        );
      });

      const eyeIconSize = clipHeight < 20 ? 10 : clipHeight < 24 ? 12 : 14;

      return (
        <TimelineClip
          key={item.id}
          clipType={laneType}
          highlighted={isHighlighted}
          clipHeight={clipHeight}
          sx={{
            left: pos.left,
            width: pos.width,
            minWidth: clipHeight < 20 ? 30 : 40,
            opacity: isDimmed ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
          onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
          onDoubleClick={(e) => { e.stopPropagation(); handleItemDoubleClick(item); }}
          onContextMenu={(e) => handleContextMenu(e, item)}
          title={`${item.fileName}\nDouble-click to focus • Right-click for options`}
        >
          {/* Eyeball visibility toggle */}
          <Tooltip title={isActive ? 'Active - click to deactivate' : 'Click to activate'} placement="top">
            <ClipVisibilityButton
              isActive={isActive}
              onClick={(e) => {
                e.stopPropagation();
                handleFileVisibilityToggle(item.id);
              }}
            >
              {isActive ? (
                <VisibilityIcon sx={{ fontSize: `${eyeIconSize}px !important` }} />
              ) : (
                <VisibilityOffIcon sx={{ fontSize: `${eyeIconSize}px !important` }} />
              )}
            </ClipVisibilityButton>
          </Tooltip>
          <Typography
            sx={{
              fontSize: clipHeight < 20 ? 8 : 10,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {item.fileName.length > maxChars ? item.fileName.substring(0, maxChars - 3) + '...' : item.fileName}
          </Typography>
          {clipFlags}
        </TimelineClip>
      );
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

  // Get active video for preview (now based on activeFileId)
  const activeVideo = items.find((i) => i.id === activeFileId && i.type === 'video');

  // Check if any lanes have items that should be dimmed
  const hasActiveFile = activeFileId !== null;

  // Main content (center area)
  const mainContent = (
    <MainContainer ref={containerRef}>
      {/* Video Preview Section - height controlled by divider */}
      <VideoPreviewSection
        sx={{
          height: `${dividerPosition}%`,
          flex: 'none',
          userSelect: isDraggingDivider ? 'none' : 'auto',
        }}
      >
        {/* Video player placeholder */}
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
            flexDirection: 'column',
          }}
        >
          <VideocamIcon sx={{ fontSize: 48, color: '#333', mb: 1 }} />
          <Typography sx={{ color: '#555', fontSize: 12 }}>
            {activeVideo?.fileName || 'Video preview'}
          </Typography>
          <Typography sx={{ color: '#444', fontSize: 10, mt: 0.5 }}>
            {new Date(globalTimestamp).toLocaleTimeString()}
          </Typography>
          {activeVideo && (
            <Typography sx={{ color: '#19abb5', fontSize: 9, mt: 0.5 }}>
              Active file
            </Typography>
          )}
        </Box>
      </VideoPreviewSection>

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

        </LaneHeightToolbar>

        {/* Time Ruler */}
        <TimeRuler>{renderTimeRuler()}</TimeRuler>

        {/* Swim Lanes */}
        <SwimLanesContainer ref={lanesContainerRef}>
          {/* VIDEO Section */}
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#c45c5c"
              onClick={() => setVideoSectionCollapsed(!videoSectionCollapsed)}
            >
              <VideocamIcon sx={{ fontSize: 14, color: '#c45c5c' }} />
              <SectionTitle>Video</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({items.filter((i) => i.type === 'video').length})
              </Typography>
              {videoSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!videoSectionCollapsed && (
              <>
                {/* Per-user lanes (permanent) */}
                {laneData.users.map((user) => (
                  <SwimLane key={`video-${user}`} laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <PersonIcon sx={{ fontSize: laneHeight < 24 ? 10 : 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: laneHeight < 24 ? 8 : 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isLaneDragOver(user, 'video')}
                      canDrop={canDropInLane(user)}
                      onDragOver={(e) => handleDragOverLane(e, user, 'video')}
                      onDragLeave={handleDragLeaveLane}
                      onDrop={(e) => handleDropOnTimeline(e, user, 'video')}
                    >
                      {renderLane(laneData.videoByUser[user] || [], 'video')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {/* Catch-all lane (always show when dragging for drop target) */}
                {(laneData.videoCatchAll.length > 0 || draggedEvidenceId) && (
                  <SwimLane laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <Typography sx={{ fontSize: laneHeight < 24 ? 8 : 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isLaneDragOver('', 'video')}
                      canDrop={canDropInLane('')}
                      onDragOver={(e) => handleDragOverLane(e, '', 'video')}
                      onDragLeave={handleDragLeaveLane}
                      onDrop={(e) => handleDropOnTimeline(e, '', 'video')}
                    >
                      {renderLane(laneData.videoCatchAll, 'video')}
                    </LaneContent>
                  </SwimLane>
                )}
              </>
            )}
          </SwimLaneSection>

          {/* AUDIO Section */}
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#5a9a6b"
              onClick={() => setAudioSectionCollapsed(!audioSectionCollapsed)}
            >
              <MicIcon sx={{ fontSize: 14, color: '#5a9a6b' }} />
              <SectionTitle>Audio</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({items.filter((i) => i.type === 'audio').length})
              </Typography>
              {audioSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!audioSectionCollapsed && (
              <>
                {laneData.users.map((user) => (
                  <SwimLane key={`audio-${user}`} laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <PersonIcon sx={{ fontSize: laneHeight < 24 ? 10 : 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: laneHeight < 24 ? 8 : 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isLaneDragOver(user, 'audio')}
                      canDrop={canDropInLane(user)}
                      onDragOver={(e) => handleDragOverLane(e, user, 'audio')}
                      onDragLeave={handleDragLeaveLane}
                      onDrop={(e) => handleDropOnTimeline(e, user, 'audio')}
                    >
                      {renderLane(laneData.audioByUser[user] || [], 'audio')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {(laneData.audioCatchAll.length > 0 || draggedEvidenceId) && (
                  <SwimLane laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <Typography sx={{ fontSize: laneHeight < 24 ? 8 : 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isLaneDragOver('', 'audio')}
                      canDrop={canDropInLane('')}
                      onDragOver={(e) => handleDragOverLane(e, '', 'audio')}
                      onDragLeave={handleDragLeaveLane}
                      onDrop={(e) => handleDropOnTimeline(e, '', 'audio')}
                    >
                      {renderLane(laneData.audioCatchAll, 'audio')}
                    </LaneContent>
                  </SwimLane>
                )}
              </>
            )}
          </SwimLaneSection>

          {/* IMAGES Section */}
          <SwimLaneSection>
            <SwimLaneSectionHeader
              color="#5a7fbf"
              onClick={() => setImagesSectionCollapsed(!imagesSectionCollapsed)}
            >
              <PhotoIcon sx={{ fontSize: 14, color: '#5a7fbf' }} />
              <SectionTitle>Images</SectionTitle>
              <Typography sx={{ fontSize: 10, color: '#555' }}>
                ({items.filter((i) => i.type === 'photo').length})
              </Typography>
              {imagesSectionCollapsed ? (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </SwimLaneSectionHeader>
            {!imagesSectionCollapsed && (
              <>
                {laneData.users.map((user) => (
                  <SwimLane key={`images-${user}`} laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <PersonIcon sx={{ fontSize: laneHeight < 24 ? 10 : 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: laneHeight < 24 ? 8 : 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isLaneDragOver(user, 'image')}
                      canDrop={canDropInLane(user)}
                      onDragOver={(e) => handleDragOverLane(e, user, 'image')}
                      onDragLeave={handleDragLeaveLane}
                      onDrop={(e) => handleDropOnTimeline(e, user, 'image')}
                    >
                      {renderLane(laneData.imagesByUser[user] || [], 'image')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {(laneData.imagesCatchAll.length > 0 || draggedEvidenceId) && (
                  <SwimLane laneHeight={laneHeight}>
                    <LaneLabel laneHeight={laneHeight}>
                      <Typography sx={{ fontSize: laneHeight < 24 ? 8 : 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent
                      isDragOver={isLaneDragOver('', 'image')}
                      canDrop={canDropInLane('')}
                      onDragOver={(e) => handleDragOverLane(e, '', 'image')}
                      onDragLeave={handleDragLeaveLane}
                      onDrop={(e) => handleDropOnTimeline(e, '', 'image')}
                    >
                      {renderLane(laneData.imagesCatchAll, 'image')}
                    </LaneContent>
                  </SwimLane>
                )}
              </>
            )}
          </SwimLaneSection>
        </SwimLanesContainer>
      </TimelineSection>
    </MainContainer>
  );

  // Right panel content (image preview + flags)
  const inspectorContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Image Preview Section */}
      <ImagePreviewSection>
        <ImagePreviewHeader>
          <Typography
            sx={{
              fontSize: 9,
              color: '#666',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Image at Playhead
          </Typography>
        </ImagePreviewHeader>
        <ImagePreviewContent>
          {currentImage ? (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                  'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #1a1a1a 100%)',
                cursor: 'pointer',
                padding: 2,
              }}
              onDoubleClick={() => handleItemDoubleClick(currentImage)}
            >
              <ImageIcon sx={{ fontSize: 40, color: '#5a7fbf', mb: 1 }} />
              <Typography
                sx={{
                  fontSize: 11,
                  color: '#ccc',
                  textAlign: 'center',
                  px: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%',
                }}
              >
                {currentImage.fileName}
              </Typography>
              <Typography sx={{ fontSize: 10, color: '#666', mt: 0.5 }}>
                {currentImage.user || 'Unknown'}
              </Typography>
              {currentImage.flagCount > 0 && (
                <Typography sx={{ fontSize: 9, color: '#19abb5', mt: 0.5 }}>
                  {currentImage.flagCount} flag{currentImage.flagCount !== 1 ? 's' : ''}
                </Typography>
              )}
              <Typography sx={{ fontSize: 9, color: '#555', mt: 1 }}>
                Double-click to open
              </Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: '#444',
              }}
            >
              <ImageIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
              <Typography sx={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
                No image at current position
              </Typography>
            </Box>
          )}
        </ImagePreviewContent>
      </ImagePreviewSection>

      {/* Flags Panel with user filter */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* User filter for flags */}
        {flagUsers.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              padding: '6px 12px',
              backgroundColor: '#1a1a1a',
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
        <FlagsPanel
          flags={currentFlags}
          onFlagClick={handleFlagClick}
          onFlagAdd={() => console.log('Add flag')}
          onFlagEdit={(flag) => console.log('Edit flag:', flag.id)}
          onFlagDelete={(flagId) => console.log('Delete flag:', flagId)}
          disabled={false}
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
            selectedId={selectedEvidence?.id}
            onSelect={(item) => setSelectedEvidence(item)}
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
        inspectorTitle="Preview & Flags"
        showTransport={true}
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
    </>
  );
};

export default SessionTimeline;
