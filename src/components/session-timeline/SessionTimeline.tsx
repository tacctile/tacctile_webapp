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
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FilterListIcon from '@mui/icons-material/FilterList';

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

interface VideoTrack {
  id: string;
  fileName: string;
  userName: string;
  visible: boolean;
  muted: boolean;
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

const VideoTrackSelector = styled(Box)({
  position: 'absolute',
  top: 8,
  left: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  borderRadius: 4,
  padding: '8px',
  maxHeight: 240,
  overflowY: 'auto',
  border: '1px solid #333',
  '&::-webkit-scrollbar': {
    width: 4,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#444',
    borderRadius: 2,
  },
});

const VideoTrackItem = styled(Box)<{ active?: boolean }>(({ active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 10,
  color: active ? '#ccc' : '#666',
  cursor: 'pointer',
  padding: '4px 6px',
  borderRadius: 2,
  backgroundColor: active ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
}));

// Timeline Section (Bottom of Center)
const TimelineSection = styled(Box)({
  height: 320,
  minHeight: 200,
  backgroundColor: '#0d0d0d',
  display: 'flex',
  flexDirection: 'column',
  borderTop: '1px solid #252525',
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

const SwimLane = styled(Box)({
  height: 36,
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  borderBottom: '1px solid #1a1a1a',
  backgroundColor: '#0d0d0d',
});

const LaneLabel = styled(Box)({
  width: 100,
  minWidth: 100,
  padding: '0 8px',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  color: '#666',
  backgroundColor: '#141414',
  height: '100%',
  borderRight: '1px solid #1f1f1f',
  overflow: 'hidden',
});

const LaneContent = styled(Box)({
  flex: 1,
  height: '100%',
  position: 'relative',
  overflow: 'hidden',
});

const TimelineClip = styled(Box)<{ clipType: 'video' | 'audio' | 'image'; highlighted?: boolean }>(({ clipType, highlighted }) => {
  const colors: Record<string, string> = {
    video: '#c45c5c',
    audio: '#5a9a6b',
    image: '#5a7fbf',
  };
  return {
    position: 'absolute',
    top: 4,
    height: 28,
    backgroundColor: colors[clipType] || '#666',
    borderRadius: 3,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    cursor: 'pointer',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    fontSize: 10,
    color: '#fff',
    border: highlighted ? '2px solid #19abb5' : '2px solid transparent',
    boxShadow: highlighted ? '0 0 10px rgba(25, 171, 181, 0.6)' : 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    '&:hover': {
      filter: 'brightness(1.15)',
      zIndex: 5,
    },
  };
});

const TimelineImage = styled(Box)<{ highlighted?: boolean }>(({ highlighted }) => ({
  position: 'absolute',
  top: 4,
  width: 16,
  height: 28,
  backgroundColor: '#5a7fbf',
  borderRadius: 3,
  cursor: 'pointer',
  border: highlighted ? '2px solid #19abb5' : '2px solid transparent',
  boxShadow: highlighted ? '0 0 10px rgba(25, 171, 181, 0.6)' : 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    filter: 'brightness(1.15)',
    zIndex: 5,
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

const GlobalPlayhead = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: '#19abb5',
  boxShadow: '0 0 10px rgba(25, 171, 181, 0.7)',
  zIndex: 100,
  cursor: 'ew-resize',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: -5,
    width: 12,
    height: 12,
    backgroundColor: '#19abb5',
    borderRadius: '50% 50% 50% 0',
    transform: 'rotate(-45deg)',
  },
});

const PlayheadDragArea = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 20,
  marginLeft: -9,
  cursor: 'ew-resize',
  zIndex: 99,
});

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

  // Video track visibility and state
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [activeVideoTrack, setActiveVideoTrack] = useState<string | null>(null);
  const [isVideoMuted, setIsVideoMuted] = useState(false);

  // Flag user filter
  const [flagUserFilter, setFlagUserFilter] = useState<string>('all');

  // Playhead dragging
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

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

  // Generate video tracks from items
  useEffect(() => {
    const videos = items.filter((item) => item.type === 'video');
    setVideoTracks(
      videos.map((v) => ({
        id: v.id,
        fileName: v.fileName,
        userName: v.user || 'Unassigned',
        visible: true,
        muted: false,
      }))
    );
    if (videos.length > 0 && !activeVideoTrack) {
      setActiveVideoTrack(videos[0].id);
    }
  }, [items, activeVideoTrack]);

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

  // Group items by type and user for swim lanes
  const laneData = useMemo(() => {
    // Get unique users from items + permanent users
    const userSet = new Set<string>(USERS);
    items.forEach((item) => {
      if (item.user) userSet.add(item.user);
    });
    const users = Array.from(userSet).filter(Boolean);

    // Group by type and user
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

    items.forEach((item) => {
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
  }, [items]);

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

  // Calculate playhead position
  const playheadPosition = useMemo(() => {
    if (!timeRange) return 0;
    const totalDuration = timeRange.end - timeRange.start;
    return ((globalTimestamp - timeRange.start) / totalDuration) * 100;
  }, [timeRange, globalTimestamp]);

  // Handle timeline click (set playhead)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!timeRange || !lanesContainerRef.current || isDraggingPlayhead) return;
      const rect = lanesContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 100; // 100px for lane label width
      const width = rect.width - 100;
      const percent = Math.max(0, Math.min(1, x / width));
      const newTimestamp = timeRange.start + percent * (timeRange.end - timeRange.start);
      setGlobalTimestamp(newTimestamp);
    },
    [timeRange, setGlobalTimestamp, isDraggingPlayhead]
  );

  // Handle playhead drag
  const handlePlayheadDrag = useCallback(
    (e: React.MouseEvent) => {
      if (!timeRange || !lanesContainerRef.current) return;
      e.preventDefault();
      setIsDraggingPlayhead(true);

      const handleMove = (moveEvent: MouseEvent) => {
        const rect = lanesContainerRef.current!.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left - 100;
        const width = rect.width - 100;
        const percent = Math.max(0, Math.min(1, x / width));
        const newTimestamp = timeRange.start + percent * (timeRange.end - timeRange.start);
        setGlobalTimestamp(newTimestamp);
      };

      const handleUp = () => {
        setIsDraggingPlayhead(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [timeRange, setGlobalTimestamp]
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

  // Handle item double click (open in tool)
  const handleItemDoubleClick = useCallback(
    (item: TimelineMediaItem) => {
      const toolMap: Record<string, 'video' | 'audio' | 'images'> = {
        video: 'video',
        audio: 'audio',
        photo: 'images',
      };
      const tool = toolMap[item.type];
      if (tool) {
        navigateToTool(tool, item.evidenceId);
      }
    },
    [navigateToTool]
  );

  // Handle flag click (jump to timestamp)
  const handleFlagClick = useCallback(
    (flag: Flag) => {
      setGlobalTimestamp(flag.timestamp);
    },
    [setGlobalTimestamp]
  );

  // Toggle video track visibility
  const toggleVideoTrack = useCallback((trackId: string) => {
    setVideoTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t))
    );
  }, []);

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
    return laneItems.map((item) => {
      const pos = getClipPosition(item.capturedAt, item.duration);
      const isHighlighted =
        item.capturedAt <= globalTimestamp &&
        (item.endAt ? item.endAt >= globalTimestamp : item.capturedAt + 1000 >= globalTimestamp);

      if (laneType === 'image') {
        return (
          <TimelineImage
            key={item.id}
            highlighted={isHighlighted}
            sx={{ left: pos.left }}
            onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
            onDoubleClick={(e) => { e.stopPropagation(); handleItemDoubleClick(item); }}
            title={item.fileName}
          >
            <PhotoIcon sx={{ fontSize: 10, color: '#fff' }} />
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

      return (
        <TimelineClip
          key={item.id}
          clipType={laneType}
          highlighted={isHighlighted}
          sx={{ left: pos.left, width: pos.width, minWidth: 40 }}
          onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
          onDoubleClick={(e) => { e.stopPropagation(); handleItemDoubleClick(item); }}
          title={`${item.fileName}\nDouble-click to open in ${laneType} tool`}
        >
          <Typography
            sx={{
              fontSize: 10,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {item.fileName.length > 25 ? item.fileName.substring(0, 22) + '...' : item.fileName}
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

  // Get active video for preview
  const activeVideo = items.find((i) => i.id === activeVideoTrack);
  const visibleVideoTracks = videoTracks.filter((t) => t.visible);

  // Main content (center area)
  const mainContent = (
    <MainContainer ref={containerRef}>
      {/* Video Preview Section */}
      <VideoPreviewSection>
        {visibleVideoTracks.length > 0 ? (
          <>
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
            </Box>

            {/* Video track selector */}
            <VideoTrackSelector>
              <Typography
                sx={{
                  fontSize: 9,
                  color: '#666',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  mb: 1,
                  px: 0.5,
                }}
              >
                Video Tracks
              </Typography>
              {videoTracks.map((track) => (
                <VideoTrackItem
                  key={track.id}
                  active={track.visible}
                >
                  <IconButton
                    size="small"
                    onClick={() => toggleVideoTrack(track.id)}
                    sx={{ padding: 0, color: track.visible ? '#19abb5' : '#555' }}
                  >
                    {track.visible ? (
                      <VisibilityIcon sx={{ fontSize: 14 }} />
                    ) : (
                      <VisibilityOffIcon sx={{ fontSize: 14 }} />
                    )}
                  </IconButton>
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: track.visible ? '#ccc' : '#555',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      cursor: 'pointer',
                    }}
                    onClick={() => setActiveVideoTrack(track.id)}
                  >
                    {track.fileName}
                  </Typography>
                  <Typography sx={{ fontSize: 9, color: '#555' }}>
                    {track.userName}
                  </Typography>
                </VideoTrackItem>
              ))}

              {/* Audio mute toggle */}
              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #333' }}>
                <VideoTrackItem onClick={() => setIsVideoMuted(!isVideoMuted)}>
                  {isVideoMuted ? (
                    <VolumeOffIcon sx={{ fontSize: 14, color: '#c45c5c' }} />
                  ) : (
                    <VolumeUpIcon sx={{ fontSize: 14, color: '#19abb5' }} />
                  )}
                  <Typography sx={{ fontSize: 10, color: '#888' }}>
                    {isVideoMuted ? 'Audio muted' : 'Audio enabled'}
                  </Typography>
                </VideoTrackItem>
              </Box>
            </VideoTrackSelector>
          </>
        ) : (
          <VideoPlaceholder>
            <VideocamIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 12, color: '#555' }}>
              No video tracks visible
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#444', mt: 0.5 }}>
              Enable tracks in the selector above
            </Typography>
          </VideoPlaceholder>
        )}
      </VideoPreviewSection>

      {/* Timeline Section */}
      <TimelineSection>
        {/* Time Ruler */}
        <TimeRuler>{renderTimeRuler()}</TimeRuler>

        {/* Swim Lanes */}
        <SwimLanesContainer ref={lanesContainerRef} onClick={handleTimelineClick}>
          {/* Global Playhead */}
          {timeRange && (
            <>
              <GlobalPlayhead
                sx={{
                  left: `calc(100px + ${playheadPosition}% * (100% - 100px) / 100)`,
                }}
              />
              <PlayheadDragArea
                sx={{
                  left: `calc(100px + ${playheadPosition}% * (100% - 100px) / 100)`,
                }}
                onMouseDown={handlePlayheadDrag}
              />
            </>
          )}

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
                  <SwimLane key={`video-${user}`}>
                    <LaneLabel>
                      <PersonIcon sx={{ fontSize: 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.videoByUser[user] || [], 'video')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {/* Catch-all lane (only if has items) */}
                {laneData.videoCatchAll.length > 0 && (
                  <SwimLane>
                    <LaneLabel>
                      <Typography sx={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
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
                  <SwimLane key={`audio-${user}`}>
                    <LaneLabel>
                      <PersonIcon sx={{ fontSize: 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.audioByUser[user] || [], 'audio')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {laneData.audioCatchAll.length > 0 && (
                  <SwimLane>
                    <LaneLabel>
                      <Typography sx={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
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
                  <SwimLane key={`images-${user}`}>
                    <LaneLabel>
                      <PersonIcon sx={{ fontSize: 12, color: '#555' }} />
                      <Typography
                        sx={{
                          fontSize: 10,
                          color: '#888',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1,
                        }}
                      >
                        {user}
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
                      {renderLane(laneData.imagesByUser[user] || [], 'image')}
                    </LaneContent>
                  </SwimLane>
                ))}
                {laneData.imagesCatchAll.length > 0 && (
                  <SwimLane>
                    <LaneLabel>
                      <Typography sx={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                        Unassigned
                      </Typography>
                    </LaneLabel>
                    <LaneContent>
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
  );
};

export default SessionTimeline;
