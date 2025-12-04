/**
 * VideoTool - DaVinci Resolve-inspired video viewer with timeline
 *
 * Philosophy: "Viewer with a timeline, not an editor"
 *
 * Features:
 * - Media pool (left panel)
 * - Main viewer (center) with camera grid toggle
 * - Timeline with multi-track (one per camera source)
 * - Playback controls (play, pause, scrub, speed, frame-by-frame)
 * - Timecode display
 * - Camera sync bin
 * - Evidence marker button (hotkey drops flag on timeline)
 * - Recording indicator
 * - Non-destructive video adjustments (brightness, contrast) - GPU-rendered live
 * - Audio waveform (linked to video, can mute)
 * - Audio annotations within video tool that sync with Audio tool
 *
 * REMOVED (we're not an editor):
 * - No transitions/titles/effects
 * - No color grading
 * - No render/export queue
 * - No keyframe animation
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { styled, alpha } from '@mui/material/styles';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import GridViewIcon from '@mui/icons-material/GridView';
import Grid4x4Icon from '@mui/icons-material/Grid4x4';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import FlagIcon from '@mui/icons-material/Flag';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import LoopIcon from '@mui/icons-material/Loop';
import SpeedIcon from '@mui/icons-material/Speed';
import VideocamIcon from '@mui/icons-material/Videocam';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import ContrastIcon from '@mui/icons-material/Contrast';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LinkIcon from '@mui/icons-material/Link';
import SettingsIcon from '@mui/icons-material/Settings';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import CreateIcon from '@mui/icons-material/Create';

// Types
interface MediaClip {
  id: string;
  name: string;
  duration: string;
  durationMs: number;
  camera: string;
  thumbnail?: string;
  resolution: string;
  frameRate: number;
  hasAudio: boolean;
}

interface TimelineTrack {
  id: string;
  name: string;
  camera: string;
  color: string;
  clips: TimelineClip[];
  locked: boolean;
  visible: boolean;
  muted: boolean;
}

interface TimelineClip {
  id: string;
  mediaId: string;
  name: string;
  startTime: number;
  endTime: number;
  inPoint: number;
  outPoint: number;
}

interface EvidenceMarker {
  id: string;
  timestamp: number;
  type: 'evidence' | 'anomaly' | 'note' | 'audio';
  label: string;
  description?: string;
  color: string;
  trackId?: string;
}

interface AudioAnnotation {
  id: string;
  timestamp: number;
  endTimestamp: number;
  label: string;
  type: 'evp' | 'voice' | 'ambient' | 'unexplained';
  confidence: number;
  syncedWithAudioTool: boolean;
}

interface VideoAdjustments {
  brightness: number;
  contrast: number;
}

type GridMode = 'single' | '2x2' | '3x3';
type PlaybackSpeed = 0.25 | 0.5 | 1 | 1.5 | 2;

// Styled Components
const ToolContainer = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
  flexDirection: 'column',
});

const MainContent = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const MediaPool = styled(Box)({
  width: 240,
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const PanelHeader = styled(Box)({
  padding: '10px 12px',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
});

const PanelHeaderTitle = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const PanelContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 8,
});

const MediaThumbnail = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  width: '100%',
  aspectRatio: '16/9',
  backgroundColor: selected ? alpha('#19abb5', 0.2) : '#1a1a1a',
  borderRadius: 4,
  marginBottom: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: selected ? '2px solid #19abb5' : '2px solid transparent',
  transition: 'all 0.15s ease',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    backgroundColor: alpha('#ffffff', 0.08),
    borderColor: selected ? '#19abb5' : '#2a2a2a',
  },
}));

const CameraBadge = styled(Box)<{ color?: string }>(({ color }) => ({
  position: 'absolute',
  top: 4,
  left: 4,
  backgroundColor: color || '#19abb5',
  color: '#000000',
  fontSize: 9,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 2,
  textTransform: 'uppercase',
}));

const DurationBadge = styled(Box)({
  position: 'absolute',
  bottom: 4,
  right: 4,
  backgroundColor: alpha('#000000', 0.8),
  color: '#c0c0c0',
  fontSize: 10,
  fontFamily: 'monospace',
  padding: '2px 4px',
  borderRadius: 2,
});

const CenterArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const ViewerContainer = styled(Box)({
  flex: 1,
  backgroundColor: '#000000',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  overflow: 'hidden',
});

const ViewerToolbar = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 40,
  backgroundColor: alpha('#0a0a0a', 0.85),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  zIndex: 10,
  backdropFilter: 'blur(8px)',
});

const ViewerGrid = styled(Box)<{ mode: GridMode }>(({ mode }) => ({
  flex: 1,
  display: 'grid',
  gap: 2,
  padding: mode === 'single' ? 0 : 4,
  gridTemplateColumns: mode === 'single' ? '1fr' : mode === '2x2' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
  gridTemplateRows: mode === 'single' ? '1fr' : mode === '2x2' ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
}));

const VideoPane = styled(Box)<{ active?: boolean; hasRecordingIndicator?: boolean }>(({ active, hasRecordingIndicator }) => ({
  backgroundColor: '#0a0a0a',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: active ? '2px solid #19abb5' : '2px solid #1a1a1a',
  position: 'relative',
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease',
  '&:hover': {
    borderColor: active ? '#19abb5' : '#2a2a2a',
  },
}));

const RecordingIndicator = styled(Box)({
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  backgroundColor: alpha('#ef4444', 0.9),
  padding: '2px 8px',
  borderRadius: 3,
  animation: 'pulse 1.5s infinite',
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.6 },
  },
});

const CameraLabel = styled(Box)({
  position: 'absolute',
  bottom: 8,
  left: 8,
  backgroundColor: alpha('#000000', 0.7),
  color: '#e0e0e0',
  fontSize: 11,
  padding: '3px 8px',
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const TimecodeOverlay = styled(Box)({
  position: 'absolute',
  bottom: 8,
  right: 8,
  backgroundColor: alpha('#000000', 0.7),
  color: '#19abb5',
  fontSize: 12,
  fontFamily: 'monospace',
  padding: '3px 8px',
  borderRadius: 3,
});

const TransportBar = styled(Box)({
  backgroundColor: '#0f0f0f',
  borderTop: '1px solid #1a1a1a',
  padding: '8px 16px',
});

const TimelineSlider = styled(Slider)({
  color: '#19abb5',
  height: 6,
  padding: '12px 0',
  '& .MuiSlider-thumb': {
    width: 14,
    height: 14,
    backgroundColor: '#19abb5',
    '&:hover, &.Mui-focusVisible': {
      boxShadow: `0 0 0 8px ${alpha('#19abb5', 0.16)}`,
    },
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#2a2a2a',
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
  },
});

const TransportControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  marginTop: 4,
});

const TransportButton = styled(IconButton)({
  color: '#808080',
  padding: 6,
  '&:hover': {
    color: '#c0c0c0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
  '&.active': {
    color: '#19abb5',
  },
});

const PlayButton = styled(IconButton)({
  width: 44,
  height: 44,
  color: '#ffffff',
  backgroundColor: '#19abb5',
  '&:hover': {
    backgroundColor: '#1992a1',
  },
  '& svg': {
    fontSize: 28,
  },
});

const Timecode = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 13,
  color: '#808080',
  minWidth: 110,
  userSelect: 'none',
});

const TimelineSection = styled(Box)({
  height: 180,
  backgroundColor: '#0a0a0a',
  borderTop: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const TimelineHeader = styled(Box)({
  height: 32,
  backgroundColor: '#0f0f0f',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  gap: 8,
});

const TimelineRuler = styled(Box)({
  height: 20,
  backgroundColor: '#0a0a0a',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'flex-end',
  position: 'relative',
  marginLeft: 140,
});

const TimelineTracks = styled(Box)({
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
});

const TimelineTrackRow = styled(Box)({
  display: 'flex',
  minHeight: 36,
  borderBottom: '1px solid #1a1a1a',
});

const TrackHeader = styled(Box)<{ color?: string }>(({ color }) => ({
  width: 140,
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  gap: 4,
  flexShrink: 0,
  borderLeft: `3px solid ${color || '#19abb5'}`,
}));

const TrackContent = styled(Box)({
  flex: 1,
  position: 'relative',
  backgroundColor: '#0a0a0a',
});

const TimelineClipBox = styled(Box)<{ color?: string }>(({ color }) => ({
  position: 'absolute',
  height: 28,
  top: 4,
  backgroundColor: alpha(color || '#19abb5', 0.4),
  border: `1px solid ${color || '#19abb5'}`,
  borderRadius: 3,
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  cursor: 'pointer',
  overflow: 'hidden',
  '&:hover': {
    backgroundColor: alpha(color || '#19abb5', 0.5),
  },
}));

const MarkerFlag = styled(Box)<{ color?: string }>(({ color }) => ({
  position: 'absolute',
  top: 0,
  width: 2,
  height: '100%',
  backgroundColor: color || '#ef4444',
  cursor: 'pointer',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: -4,
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderTop: `8px solid ${color || '#ef4444'}`,
  },
  '&:hover': {
    width: 3,
  },
}));

const RightPanel = styled(Box)({
  width: 280,
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const PanelSection = styled(Box)({
  padding: 12,
  borderBottom: '1px solid #1a1a1a',
});

const PanelSectionTitle = styled(Typography)({
  fontSize: 11,
  fontWeight: 600,
  color: '#808080',
  textTransform: 'uppercase',
  marginBottom: 10,
  letterSpacing: '0.05em',
});

const AdjustmentRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginBottom: 8,
});

const AdjustmentLabel = styled(Typography)({
  fontSize: 12,
  color: '#a0a0a0',
  width: 80,
});

const AdjustmentSlider = styled(Slider)({
  flex: 1,
  color: '#19abb5',
  height: 4,
  marginLeft: 12,
  marginRight: 8,
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
  },
});

const AdjustmentValue = styled(Typography)({
  fontSize: 11,
  color: '#606060',
  minWidth: 35,
  textAlign: 'right',
  fontFamily: 'monospace',
});

const MarkerItem = styled(Box)<{ color?: string }>(({ color }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 4,
  marginBottom: 4,
  cursor: 'pointer',
  backgroundColor: alpha(color || '#ef4444', 0.1),
  border: `1px solid ${alpha(color || '#ef4444', 0.3)}`,
  '&:hover': {
    backgroundColor: alpha(color || '#ef4444', 0.15),
  },
}));

const AnnotationItem = styled(Box)<{ color?: string }>(({ color }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '8px',
  borderRadius: 4,
  marginBottom: 6,
  backgroundColor: '#141414',
  border: `1px solid ${alpha(color || '#3b82f6', 0.3)}`,
  borderLeft: `3px solid ${color || '#3b82f6'}`,
}));

const WaveformContainer = styled(Box)({
  height: 48,
  backgroundColor: '#0a0a0a',
  borderTop: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  marginLeft: 140,
});

const WaveformPlaceholder = styled(Box)({
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: `repeating-linear-gradient(
    90deg,
    #1a1a1a 0px,
    #1a1a1a 2px,
    transparent 2px,
    transparent 4px
  )`,
});

const SyncBinSection = styled(Box)({
  padding: 8,
  borderTop: '1px solid #1a1a1a',
  backgroundColor: '#0a0a0a',
});

const SyncBinItem = styled(Box)<{ synced?: boolean }>(({ synced }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  borderRadius: 4,
  marginBottom: 4,
  backgroundColor: synced ? alpha('#22c55e', 0.1) : '#141414',
  border: `1px solid ${synced ? alpha('#22c55e', 0.3) : '#2a2a2a'}`,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: synced ? alpha('#22c55e', 0.15) : '#1a1a1a',
  },
}));

const SmallIconButton = styled(IconButton)({
  width: 24,
  height: 24,
  padding: 4,
  color: '#606060',
  '&:hover': {
    color: '#a0a0a0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
});

// Helper functions
const formatTimecode = (ms: number, dropFrame = false): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((ms % 1000) / (1000 / 30)); // Assuming 30fps
  const separator = dropFrame ? ';' : ':';
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}${separator}${frames.toString().padStart(2, '0')}`;
};

// Camera color map
const cameraColors: Record<string, string> = {
  'CAM1': '#19abb5',
  'CAM2': '#f59e0b',
  'CAM3': '#22c55e',
  'CAM4': '#8b5cf6',
  'IR': '#ef4444',
  'FULL_SPEC': '#ec4899',
  'THERMAL': '#f97316',
};

const VideoTool: React.FC = () => {
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(932000); // 15:32 in ms
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isLooping, setIsLooping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(75);

  // Viewer state
  const [gridMode, setGridMode] = useState<GridMode>('single');
  const [activePane, setActivePane] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRecording, setIsRecording] = useState(true); // Demo recording indicator

  // Media state
  const [selectedClip, setSelectedClip] = useState<string>('1');
  const [mediaClips] = useState<MediaClip[]>([
    { id: '1', name: 'Camera_01_20240115_2230.mp4', duration: '00:15:32', durationMs: 932000, camera: 'CAM1', resolution: '1920x1080', frameRate: 30, hasAudio: true },
    { id: '2', name: 'Camera_02_20240115_2230.mp4', duration: '00:15:28', durationMs: 928000, camera: 'CAM2', resolution: '1920x1080', frameRate: 30, hasAudio: true },
    { id: '3', name: 'IR_Camera_20240115_2245.mp4', duration: '00:08:45', durationMs: 525000, camera: 'IR', resolution: '1280x720', frameRate: 25, hasAudio: false },
    { id: '4', name: 'Full_Spectrum_20240115_2300.mp4', duration: '00:12:18', durationMs: 738000, camera: 'FULL_SPEC', resolution: '1920x1080', frameRate: 30, hasAudio: true },
    { id: '5', name: 'Thermal_Cam_20240115_2230.mp4', duration: '00:15:30', durationMs: 930000, camera: 'THERMAL', resolution: '640x480', frameRate: 30, hasAudio: false },
  ]);

  // Timeline state
  const [tracks] = useState<TimelineTrack[]>([
    { id: 't1', name: 'Camera 1', camera: 'CAM1', color: '#19abb5', clips: [{ id: 'c1', mediaId: '1', name: 'Camera_01', startTime: 0, endTime: 932000, inPoint: 0, outPoint: 932000 }], locked: false, visible: true, muted: false },
    { id: 't2', name: 'Camera 2', camera: 'CAM2', color: '#f59e0b', clips: [{ id: 'c2', mediaId: '2', name: 'Camera_02', startTime: 0, endTime: 928000, inPoint: 0, outPoint: 928000 }], locked: false, visible: true, muted: false },
    { id: 't3', name: 'IR Camera', camera: 'IR', color: '#ef4444', clips: [{ id: 'c3', mediaId: '3', name: 'IR_Camera', startTime: 900000, endTime: 1425000, inPoint: 0, outPoint: 525000 }], locked: false, visible: true, muted: true },
    { id: 't4', name: 'Full Spectrum', camera: 'FULL_SPEC', color: '#ec4899', clips: [{ id: 'c4', mediaId: '4', name: 'Full_Spectrum', startTime: 1800000, endTime: 2538000, inPoint: 0, outPoint: 738000 }], locked: false, visible: true, muted: false },
  ]);

  // Evidence markers
  const [markers, setMarkers] = useState<EvidenceMarker[]>([
    { id: 'm1', timestamp: 323000, type: 'evidence', label: 'Motion anomaly', color: '#ef4444' },
    { id: 'm2', timestamp: 525000, type: 'anomaly', label: 'Light orb detected', color: '#f59e0b' },
    { id: 'm3', timestamp: 731000, type: 'note', label: 'Shadow figure', color: '#22c55e' },
    { id: 'm4', timestamp: 892000, type: 'audio', label: 'EVP detected', color: '#3b82f6', trackId: 't1' },
  ]);

  // Audio annotations (synced with Audio tool)
  const [audioAnnotations] = useState<AudioAnnotation[]>([
    { id: 'a1', timestamp: 154000, endTimestamp: 157000, label: 'Voice-like pattern', type: 'voice', confidence: 0.72, syncedWithAudioTool: true },
    { id: 'a2', timestamp: 312000, endTimestamp: 315000, label: 'EVP candidate', type: 'evp', confidence: 0.85, syncedWithAudioTool: true },
    { id: 'a3', timestamp: 465000, endTimestamp: 468000, label: 'Ambient anomaly', type: 'ambient', confidence: 0.68, syncedWithAudioTool: true },
  ]);

  // Sync bin (camera sync)
  const [syncedCameras] = useState([
    { id: 's1', camera: 'CAM1', synced: true, offset: 0 },
    { id: 's2', camera: 'CAM2', synced: true, offset: -150 },
    { id: 's3', camera: 'IR', synced: true, offset: 320 },
    { id: 's4', camera: 'FULL_SPEC', synced: false, offset: 0 },
    { id: 's5', camera: 'THERMAL', synced: true, offset: 50 },
  ]);

  // Video adjustments (non-destructive, GPU-rendered)
  const [adjustments, setAdjustments] = useState<VideoAdjustments>({
    brightness: 0,
    contrast: 0,
  });

  // Speed menu
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);

  // Grid menu
  const [gridMenuAnchor, setGridMenuAnchor] = useState<null | HTMLElement>(null);

  // Ref for keyboard shortcuts
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const next = prev + (33 * playbackSpeed); // ~30fps update
          if (next >= duration) {
            if (isLooping) {
              return 0;
            }
            setIsPlaying(false);
            return duration;
          }
          return next;
        });
      }, 33);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, duration, isLooping]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) {
            setCurrentTime(prev => Math.max(0, prev - 1000));
          } else {
            setCurrentTime(prev => Math.max(0, prev - (1000 / 30))); // Frame back
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) {
            setCurrentTime(prev => Math.min(duration, prev + 1000));
          } else {
            setCurrentTime(prev => Math.min(duration, prev + (1000 / 30))); // Frame forward
          }
          break;
        case 'KeyM':
          e.preventDefault();
          addEvidenceMarker();
          break;
        case 'KeyL':
          e.preventDefault();
          setIsLooping(prev => !prev);
          break;
        case 'Home':
          e.preventDefault();
          setCurrentTime(0);
          break;
        case 'End':
          e.preventDefault();
          setCurrentTime(duration);
          break;
        case 'Digit1':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setGridMode('single');
          }
          break;
        case 'Digit2':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setGridMode('2x2');
          }
          break;
        case 'Digit3':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setGridMode('3x3');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration]);

  // Add evidence marker at current time
  const addEvidenceMarker = useCallback(() => {
    const newMarker: EvidenceMarker = {
      id: `m${Date.now()}`,
      timestamp: currentTime,
      type: 'evidence',
      label: 'New marker',
      color: '#ef4444',
    };
    setMarkers(prev => [...prev, newMarker]);
  }, [currentTime]);

  // Frame navigation
  const frameBack = () => setCurrentTime(prev => Math.max(0, prev - (1000 / 30)));
  const frameForward = () => setCurrentTime(prev => Math.min(duration, prev + (1000 / 30)));

  // Skip controls
  const skipBack = () => setCurrentTime(prev => Math.max(0, prev - 5000));
  const skipForward = () => setCurrentTime(prev => Math.min(duration, prev + 5000));

  const getAnnotationColor = (type: string): string => {
    switch (type) {
      case 'evp': return '#ef4444';
      case 'voice': return '#f59e0b';
      case 'ambient': return '#22c55e';
      case 'unexplained': return '#8b5cf6';
      default: return '#3b82f6';
    }
  };

  // Get number of panes based on grid mode
  const getPaneCount = (): number => {
    switch (gridMode) {
      case 'single': return 1;
      case '2x2': return 4;
      case '3x3': return 9;
    }
  };

  return (
    <ToolContainer ref={containerRef} tabIndex={0}>
      <MainContent>
        {/* Media Pool - Left Panel */}
        <MediaPool>
          <PanelHeader>
            <PanelHeaderTitle>
              <FolderOpenIcon sx={{ fontSize: 16, color: '#808080' }} />
              <Typography sx={{ fontSize: 12, fontWeight: 500, color: '#c0c0c0' }}>
                Media Pool
              </Typography>
            </PanelHeaderTitle>
            <Tooltip title="Import Media">
              <SmallIconButton>
                <AddIcon sx={{ fontSize: 16 }} />
              </SmallIconButton>
            </Tooltip>
          </PanelHeader>

          <PanelContent>
            {mediaClips.map((clip) => (
              <Box key={clip.id} sx={{ mb: 1.5 }}>
                <MediaThumbnail
                  selected={selectedClip === clip.id}
                  onClick={() => setSelectedClip(clip.id)}
                >
                  <VideocamIcon sx={{ fontSize: 28, color: '#404040' }} />
                  <CameraBadge color={cameraColors[clip.camera]}>
                    {clip.camera}
                  </CameraBadge>
                  <DurationBadge>{clip.duration}</DurationBadge>
                </MediaThumbnail>
                <Typography
                  sx={{
                    fontSize: 10,
                    color: selectedClip === clip.id ? '#19abb5' : '#808080',
                    px: 0.5,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {clip.name}
                </Typography>
                <Typography sx={{ fontSize: 9, color: '#505050', px: 0.5 }}>
                  {clip.resolution} • {clip.frameRate}fps
                </Typography>
              </Box>
            ))}
          </PanelContent>

          {/* Camera Sync Bin */}
          <SyncBinSection>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <SyncIcon sx={{ fontSize: 14, color: '#808080' }} />
                <Typography sx={{ fontSize: 11, fontWeight: 500, color: '#808080' }}>
                  SYNC BIN
                </Typography>
              </Box>
              <Tooltip title="Auto-Sync All">
                <SmallIconButton>
                  <LinkIcon sx={{ fontSize: 14 }} />
                </SmallIconButton>
              </Tooltip>
            </Box>
            {syncedCameras.map((cam) => (
              <SyncBinItem key={cam.id} synced={cam.synced}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: cameraColors[cam.camera] || '#808080',
                  }}
                />
                <Typography sx={{ fontSize: 10, color: '#a0a0a0', flex: 1 }}>
                  {cam.camera}
                </Typography>
                {cam.synced && (
                  <Typography sx={{ fontSize: 9, color: '#22c55e', fontFamily: 'monospace' }}>
                    {cam.offset > 0 ? '+' : ''}{cam.offset}ms
                  </Typography>
                )}
                <Tooltip title={cam.synced ? 'Synced' : 'Not synced'}>
                  <SyncIcon
                    sx={{
                      fontSize: 12,
                      color: cam.synced ? '#22c55e' : '#505050',
                    }}
                  />
                </Tooltip>
              </SyncBinItem>
            ))}
          </SyncBinSection>
        </MediaPool>

        {/* Center Area - Viewer + Timeline */}
        <CenterArea>
          {/* Video Viewer */}
          <ViewerContainer>
            {/* Viewer Toolbar */}
            <ViewerToolbar>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Tooltip title="Grid Layout">
                  <TransportButton
                    size="small"
                    onClick={(e) => setGridMenuAnchor(e.currentTarget)}
                  >
                    {gridMode === 'single' ? (
                      <CropSquareIcon sx={{ fontSize: 18 }} />
                    ) : gridMode === '2x2' ? (
                      <GridViewIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <Grid4x4Icon sx={{ fontSize: 18 }} />
                    )}
                  </TransportButton>
                </Tooltip>
                <Menu
                  anchorEl={gridMenuAnchor}
                  open={Boolean(gridMenuAnchor)}
                  onClose={() => setGridMenuAnchor(null)}
                  PaperProps={{
                    sx: { backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' },
                  }}
                >
                  <MenuItem
                    onClick={() => { setGridMode('single'); setGridMenuAnchor(null); }}
                    sx={{ fontSize: 12, color: gridMode === 'single' ? '#19abb5' : '#c0c0c0' }}
                  >
                    <CropSquareIcon sx={{ fontSize: 16, mr: 1 }} /> Single View (Ctrl+1)
                  </MenuItem>
                  <MenuItem
                    onClick={() => { setGridMode('2x2'); setGridMenuAnchor(null); }}
                    sx={{ fontSize: 12, color: gridMode === '2x2' ? '#19abb5' : '#c0c0c0' }}
                  >
                    <GridViewIcon sx={{ fontSize: 16, mr: 1 }} /> 2×2 Grid (Ctrl+2)
                  </MenuItem>
                  <MenuItem
                    onClick={() => { setGridMode('3x3'); setGridMenuAnchor(null); }}
                    sx={{ fontSize: 12, color: gridMode === '3x3' ? '#19abb5' : '#c0c0c0' }}
                  >
                    <Grid4x4Icon sx={{ fontSize: 16, mr: 1 }} /> 3×3 Grid (Ctrl+3)
                  </MenuItem>
                </Menu>
                <Typography sx={{ fontSize: 11, color: '#606060' }}>
                  {gridMode === 'single' ? 'Single View' : gridMode === '2x2' ? '2×2 Grid' : '3×3 Grid'}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Add Evidence Marker (M)">
                  <TransportButton size="small" onClick={addEvidenceMarker}>
                    <FlagIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                  </TransportButton>
                </Tooltip>
                <Tooltip title="Keyboard Shortcuts">
                  <TransportButton size="small">
                    <KeyboardIcon sx={{ fontSize: 18 }} />
                  </TransportButton>
                </Tooltip>
                <Tooltip title="Settings">
                  <TransportButton size="small">
                    <SettingsIcon sx={{ fontSize: 18 }} />
                  </TransportButton>
                </Tooltip>
                <Tooltip title="Fullscreen">
                  <TransportButton
                    size="small"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className={isFullscreen ? 'active' : ''}
                  >
                    <FullscreenIcon sx={{ fontSize: 18 }} />
                  </TransportButton>
                </Tooltip>
              </Box>
            </ViewerToolbar>

            {/* Video Grid */}
            <ViewerGrid mode={gridMode}>
              {Array.from({ length: getPaneCount() }).map((_, index) => {
                const camera = mediaClips[index % mediaClips.length];
                return (
                  <VideoPane
                    key={index}
                    active={activePane === index}
                    onClick={() => setActivePane(index)}
                    sx={{
                      filter: `brightness(${1 + adjustments.brightness / 100}) contrast(${1 + adjustments.contrast / 100})`,
                    }}
                  >
                    <VideocamIcon sx={{ fontSize: gridMode === 'single' ? 64 : 32, color: '#252525' }} />
                    <Typography sx={{ color: '#404040', fontSize: gridMode === 'single' ? 13 : 10, mt: 1 }}>
                      {camera?.name || 'No source'}
                    </Typography>

                    {/* Recording Indicator */}
                    {index === 0 && isRecording && (
                      <RecordingIndicator>
                        <FiberManualRecordIcon sx={{ fontSize: 10, color: '#ffffff' }} />
                        <Typography sx={{ fontSize: 9, color: '#ffffff', fontWeight: 600 }}>
                          REC
                        </Typography>
                      </RecordingIndicator>
                    )}

                    {/* Camera Label */}
                    <CameraLabel>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: cameraColors[camera?.camera || 'CAM1'],
                        }}
                      />
                      <span>{camera?.camera || 'CAM'}</span>
                    </CameraLabel>

                    {/* Timecode Overlay */}
                    {activePane === index && (
                      <TimecodeOverlay>
                        {formatTimecode(currentTime)}
                      </TimecodeOverlay>
                    )}
                  </VideoPane>
                );
              })}
            </ViewerGrid>
          </ViewerContainer>

          {/* Transport Bar */}
          <TransportBar>
            {/* Timeline scrubber with markers */}
            <Box sx={{ position: 'relative', mb: 0.5 }}>
              <TimelineSlider
                value={currentTime}
                onChange={(_, value) => setCurrentTime(value as number)}
                min={0}
                max={duration}
              />
              {/* Marker indicators on scrubber */}
              {markers.map((marker) => (
                <Tooltip key={marker.id} title={`${marker.label} (${formatTimecode(marker.timestamp)})`}>
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${(marker.timestamp / duration) * 100}%`,
                      top: 8,
                      width: 4,
                      height: 12,
                      backgroundColor: marker.color,
                      borderRadius: 1,
                      cursor: 'pointer',
                      transform: 'translateX(-50%)',
                      '&:hover': {
                        transform: 'translateX(-50%) scale(1.2)',
                      },
                    }}
                    onClick={() => setCurrentTime(marker.timestamp)}
                  />
                </Tooltip>
              ))}
            </Box>

            <TransportControls>
              <Timecode>{formatTimecode(currentTime)}</Timecode>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mx: 2 }}>
                <Tooltip title="Previous Frame (←)">
                  <TransportButton size="small" onClick={frameBack}>
                    <SkipPreviousIcon sx={{ fontSize: 20 }} />
                  </TransportButton>
                </Tooltip>
                <Tooltip title="Skip Back 5s (Shift+←)">
                  <TransportButton size="small" onClick={skipBack}>
                    <FastRewindIcon sx={{ fontSize: 20 }} />
                  </TransportButton>
                </Tooltip>
                <Tooltip title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
                  <PlayButton onClick={() => setIsPlaying(!isPlaying)}>
                    {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
                  </PlayButton>
                </Tooltip>
                <Tooltip title="Skip Forward 5s (Shift+→)">
                  <TransportButton size="small" onClick={skipForward}>
                    <FastForwardIcon sx={{ fontSize: 20 }} />
                  </TransportButton>
                </Tooltip>
                <Tooltip title="Next Frame (→)">
                  <TransportButton size="small" onClick={frameForward}>
                    <SkipNextIcon sx={{ fontSize: 20 }} />
                  </TransportButton>
                </Tooltip>
              </Box>

              <Timecode sx={{ textAlign: 'right' }}>{formatTimecode(duration)}</Timecode>

              <Divider orientation="vertical" flexItem sx={{ mx: 2, borderColor: '#2a2a2a' }} />

              <Tooltip title="Add Evidence Marker (M)">
                <TransportButton size="small" onClick={addEvidenceMarker}>
                  <FlagIcon sx={{ color: '#ef4444' }} />
                </TransportButton>
              </Tooltip>
              <Tooltip title="Add Bookmark">
                <TransportButton size="small">
                  <BookmarkIcon />
                </TransportButton>
              </Tooltip>
              <Tooltip title={isLooping ? 'Disable Loop (L)' : 'Enable Loop (L)'}>
                <TransportButton
                  size="small"
                  onClick={() => setIsLooping(!isLooping)}
                  className={isLooping ? 'active' : ''}
                >
                  <LoopIcon />
                </TransportButton>
              </Tooltip>

              <Tooltip title={`Speed: ${playbackSpeed}x`}>
                <TransportButton size="small" onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}>
                  <SpeedIcon />
                  <Typography sx={{ fontSize: 10, ml: 0.25, color: 'inherit' }}>
                    {playbackSpeed}x
                  </Typography>
                </TransportButton>
              </Tooltip>
              <Menu
                anchorEl={speedMenuAnchor}
                open={Boolean(speedMenuAnchor)}
                onClose={() => setSpeedMenuAnchor(null)}
                PaperProps={{
                  sx: { backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' },
                }}
              >
                {[0.25, 0.5, 1, 1.5, 2].map((speed) => (
                  <MenuItem
                    key={speed}
                    onClick={() => { setPlaybackSpeed(speed as PlaybackSpeed); setSpeedMenuAnchor(null); }}
                    sx={{
                      fontSize: 12,
                      color: playbackSpeed === speed ? '#19abb5' : '#c0c0c0',
                    }}
                  >
                    {speed}x
                  </MenuItem>
                ))}
              </Menu>

              <Divider orientation="vertical" flexItem sx={{ mx: 2, borderColor: '#2a2a2a' }} />

              <Tooltip title={isMuted ? 'Unmute' : 'Mute'}>
                <TransportButton size="small" onClick={() => setIsMuted(!isMuted)}>
                  {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                </TransportButton>
              </Tooltip>
              <Slider
                value={isMuted ? 0 : volume}
                onChange={(_, value) => { setVolume(value as number); setIsMuted(false); }}
                sx={{ width: 70, color: '#19abb5', ml: 1 }}
                size="small"
              />
            </TransportControls>
          </TransportBar>

          {/* Multi-Track Timeline */}
          <TimelineSection>
            <TimelineHeader>
              <Typography sx={{ fontSize: 11, fontWeight: 500, color: '#808080' }}>
                TIMELINE
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Tooltip title="Add Track">
                <SmallIconButton>
                  <AddIcon sx={{ fontSize: 16 }} />
                </SmallIconButton>
              </Tooltip>
            </TimelineHeader>

            {/* Timeline Ruler */}
            <TimelineRuler>
              {Array.from({ length: 16 }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    position: 'absolute',
                    left: `${i * 6.25}%`,
                    height: i % 4 === 0 ? 12 : 6,
                    borderLeft: '1px solid #404040',
                    display: 'flex',
                    alignItems: 'flex-start',
                  }}
                >
                  {i % 4 === 0 && (
                    <Typography
                      sx={{
                        fontSize: 8,
                        color: '#505050',
                        ml: 0.5,
                        fontFamily: 'monospace',
                      }}
                    >
                      {formatTimecode((duration / 16) * i).slice(0, 8)}
                    </Typography>
                  )}
                </Box>
              ))}
              {/* Playhead */}
              <Box
                sx={{
                  position: 'absolute',
                  left: `${(currentTime / duration) * 100}%`,
                  top: 0,
                  height: '100%',
                  width: 2,
                  backgroundColor: '#19abb5',
                  zIndex: 10,
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -4,
                    left: -4,
                    width: 0,
                    height: 0,
                    borderLeft: '5px solid transparent',
                    borderRight: '5px solid transparent',
                    borderTop: '6px solid #19abb5',
                  },
                }}
              />
            </TimelineRuler>

            {/* Audio Waveform Track */}
            <TimelineTrackRow>
              <TrackHeader color="#3b82f6">
                <GraphicEqIcon sx={{ fontSize: 14, color: '#3b82f6' }} />
                <Typography sx={{ fontSize: 10, color: '#a0a0a0', flex: 1 }}>Audio</Typography>
                <Tooltip title="Mute Audio">
                  <SmallIconButton onClick={() => setIsMuted(!isMuted)}>
                    {isMuted ? (
                      <VolumeOffIcon sx={{ fontSize: 12, color: '#ef4444' }} />
                    ) : (
                      <VolumeUpIcon sx={{ fontSize: 12 }} />
                    )}
                  </SmallIconButton>
                </Tooltip>
              </TrackHeader>
              <WaveformContainer>
                <WaveformPlaceholder>
                  <Typography sx={{ fontSize: 10, color: '#404040' }}>
                    Audio Waveform
                  </Typography>
                </WaveformPlaceholder>
                {/* Playhead */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: `${(currentTime / duration) * 100}%`,
                    top: 0,
                    height: '100%',
                    width: 1,
                    backgroundColor: '#19abb5',
                    zIndex: 10,
                  }}
                />
              </WaveformContainer>
            </TimelineTrackRow>

            {/* Video Tracks */}
            <TimelineTracks>
              {tracks.map((track) => (
                <TimelineTrackRow key={track.id}>
                  <TrackHeader color={track.color}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: track.color,
                      }}
                    />
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: '#a0a0a0',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {track.name}
                    </Typography>
                    <Tooltip title={track.locked ? 'Unlock' : 'Lock'}>
                      <SmallIconButton>
                        {track.locked ? (
                          <LockIcon sx={{ fontSize: 12, color: '#f59e0b' }} />
                        ) : (
                          <LockOpenIcon sx={{ fontSize: 12 }} />
                        )}
                      </SmallIconButton>
                    </Tooltip>
                    <Tooltip title={track.visible ? 'Hide' : 'Show'}>
                      <SmallIconButton>
                        {track.visible ? (
                          <VisibilityIcon sx={{ fontSize: 12 }} />
                        ) : (
                          <VisibilityOffIcon sx={{ fontSize: 12, color: '#505050' }} />
                        )}
                      </SmallIconButton>
                    </Tooltip>
                    <Tooltip title={track.muted ? 'Unmute' : 'Mute'}>
                      <SmallIconButton>
                        {track.muted ? (
                          <VolumeOffIcon sx={{ fontSize: 12, color: '#ef4444' }} />
                        ) : (
                          <VolumeUpIcon sx={{ fontSize: 12 }} />
                        )}
                      </SmallIconButton>
                    </Tooltip>
                  </TrackHeader>
                  <TrackContent>
                    {track.clips.map((clip) => (
                      <TimelineClipBox
                        key={clip.id}
                        color={track.color}
                        sx={{
                          left: `${(clip.startTime / duration) * 100}%`,
                          width: `${((clip.endTime - clip.startTime) / duration) * 100}%`,
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: 9,
                            color: '#e0e0e0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {clip.name}
                        </Typography>
                      </TimelineClipBox>
                    ))}
                    {/* Markers for this track */}
                    {markers
                      .filter((m) => !m.trackId || m.trackId === track.id)
                      .map((marker) => (
                        <MarkerFlag
                          key={marker.id}
                          color={marker.color}
                          sx={{ left: `${(marker.timestamp / duration) * 100}%` }}
                          onClick={() => setCurrentTime(marker.timestamp)}
                        />
                      ))}
                    {/* Playhead */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${(currentTime / duration) * 100}%`,
                        top: 0,
                        height: '100%',
                        width: 1,
                        backgroundColor: '#19abb5',
                        zIndex: 10,
                        pointerEvents: 'none',
                      }}
                    />
                  </TrackContent>
                </TimelineTrackRow>
              ))}
            </TimelineTracks>
          </TimelineSection>
        </CenterArea>

        {/* Right Panel - Info & Controls */}
        <RightPanel>
          {/* Video Adjustments */}
          <PanelSection>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <PanelSectionTitle sx={{ mb: 0 }}>Video Adjustments</PanelSectionTitle>
              <Tooltip title="Reset">
                <SmallIconButton onClick={() => setAdjustments({ brightness: 0, contrast: 0 })}>
                  <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                </SmallIconButton>
              </Tooltip>
            </Box>
            <Typography sx={{ fontSize: 9, color: '#505050', mb: 1.5 }}>
              Non-destructive • GPU-rendered live
            </Typography>

            <AdjustmentRow>
              <BrightnessHighIcon sx={{ fontSize: 14, color: '#606060', mr: 0.5 }} />
              <AdjustmentLabel>Brightness</AdjustmentLabel>
              <AdjustmentSlider
                value={adjustments.brightness}
                onChange={(_, value) => setAdjustments(prev => ({ ...prev, brightness: value as number }))}
                min={-50}
                max={50}
              />
              <AdjustmentValue>{adjustments.brightness > 0 ? '+' : ''}{adjustments.brightness}</AdjustmentValue>
            </AdjustmentRow>

            <AdjustmentRow>
              <ContrastIcon sx={{ fontSize: 14, color: '#606060', mr: 0.5 }} />
              <AdjustmentLabel>Contrast</AdjustmentLabel>
              <AdjustmentSlider
                value={adjustments.contrast}
                onChange={(_, value) => setAdjustments(prev => ({ ...prev, contrast: value as number }))}
                min={-50}
                max={50}
              />
              <AdjustmentValue>{adjustments.contrast > 0 ? '+' : ''}{adjustments.contrast}</AdjustmentValue>
            </AdjustmentRow>
          </PanelSection>

          {/* Evidence Markers */}
          <PanelSection>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <PanelSectionTitle sx={{ mb: 0 }}>Evidence Markers ({markers.length})</PanelSectionTitle>
              <Tooltip title="Add Marker (M)">
                <SmallIconButton onClick={addEvidenceMarker}>
                  <FlagIcon sx={{ fontSize: 14, color: '#ef4444' }} />
                </SmallIconButton>
              </Tooltip>
            </Box>

            <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
              {markers.map((marker) => (
                <MarkerItem
                  key={marker.id}
                  color={marker.color}
                  onClick={() => setCurrentTime(marker.timestamp)}
                >
                  <FlagIcon sx={{ fontSize: 12, color: marker.color }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11, color: '#c0c0c0' }}>
                      {marker.label}
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: '#606060', fontFamily: 'monospace' }}>
                      {formatTimecode(marker.timestamp)}
                    </Typography>
                  </Box>
                  <Tooltip title="Edit">
                    <SmallIconButton>
                      <CreateIcon sx={{ fontSize: 12 }} />
                    </SmallIconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <SmallIconButton onClick={(e) => {
                      e.stopPropagation();
                      setMarkers(prev => prev.filter(m => m.id !== marker.id));
                    }}>
                      <DeleteOutlineIcon sx={{ fontSize: 12 }} />
                    </SmallIconButton>
                  </Tooltip>
                </MarkerItem>
              ))}
            </Box>
          </PanelSection>

          {/* Audio Annotations (Synced with Audio Tool) */}
          <PanelSection sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <GraphicEqIcon sx={{ fontSize: 14, color: '#3b82f6' }} />
              <PanelSectionTitle sx={{ mb: 0 }}>Audio Annotations</PanelSectionTitle>
              <Tooltip title="Synced with Audio Tool">
                <LinkIcon sx={{ fontSize: 12, color: '#22c55e', ml: 'auto' }} />
              </Tooltip>
            </Box>

            <Box sx={{ maxHeight: 180, overflow: 'auto' }}>
              {audioAnnotations.map((annotation) => (
                <AnnotationItem
                  key={annotation.id}
                  color={getAnnotationColor(annotation.type)}
                  onClick={() => setCurrentTime(annotation.timestamp)}
                  sx={{ cursor: 'pointer' }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Typography
                        sx={{
                          fontSize: 9,
                          color: getAnnotationColor(annotation.type),
                          textTransform: 'uppercase',
                          fontWeight: 600,
                        }}
                      >
                        {annotation.type}
                      </Typography>
                      <Typography sx={{ fontSize: 9, color: '#505050' }}>
                        • {(annotation.confidence * 100).toFixed(0)}% confidence
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: '#c0c0c0', mb: 0.5 }}>
                      {annotation.label}
                    </Typography>
                    <Typography sx={{ fontSize: 9, color: '#606060', fontFamily: 'monospace' }}>
                      {formatTimecode(annotation.timestamp)} → {formatTimecode(annotation.endTimestamp)}
                    </Typography>
                  </Box>
                  {annotation.syncedWithAudioTool && (
                    <Tooltip title="Synced with Audio Tool">
                      <SyncIcon sx={{ fontSize: 14, color: '#22c55e' }} />
                    </Tooltip>
                  )}
                </AnnotationItem>
              ))}
            </Box>
          </PanelSection>

          {/* Clip Info */}
          <PanelSection>
            <PanelSectionTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <InfoOutlinedIcon sx={{ fontSize: 14 }} />
                Clip Info
              </Box>
            </PanelSectionTitle>

            {(() => {
              const clip = mediaClips.find((c) => c.id === selectedClip);
              if (!clip) return null;
              return (
                <>
                  <Typography
                    sx={{
                      fontSize: 11,
                      color: '#a0a0a0',
                      mb: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {clip.name}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, fontSize: 10 }}>
                    <Typography sx={{ color: '#505050' }}>Duration</Typography>
                    <Typography sx={{ color: '#808080', textAlign: 'right' }}>{clip.duration}</Typography>
                    <Typography sx={{ color: '#505050' }}>Resolution</Typography>
                    <Typography sx={{ color: '#808080', textAlign: 'right' }}>{clip.resolution}</Typography>
                    <Typography sx={{ color: '#505050' }}>Frame Rate</Typography>
                    <Typography sx={{ color: '#808080', textAlign: 'right' }}>{clip.frameRate} fps</Typography>
                    <Typography sx={{ color: '#505050' }}>Camera</Typography>
                    <Typography sx={{ color: cameraColors[clip.camera], textAlign: 'right' }}>{clip.camera}</Typography>
                    <Typography sx={{ color: '#505050' }}>Audio</Typography>
                    <Typography sx={{ color: clip.hasAudio ? '#22c55e' : '#505050', textAlign: 'right' }}>
                      {clip.hasAudio ? 'Yes' : 'No'}
                    </Typography>
                  </Box>
                </>
              );
            })()}
          </PanelSection>
        </RightPanel>
      </MainContent>
    </ToolContainer>
  );
};

export default VideoTool;
