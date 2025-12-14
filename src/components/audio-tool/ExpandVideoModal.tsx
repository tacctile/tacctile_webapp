import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import FlagIcon from '@mui/icons-material/Flag';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { Flag } from '@/components/common';

// ============================================================================
// SIZE CONFIGURATIONS
// ============================================================================

type ModalSize = 'S' | 'M' | 'L';

const MODAL_SIZES: Record<ModalSize, { width: number; height: number }> = {
  S: { width: 400, height: 350 },
  M: { width: 640, height: 500 },
  L: { width: 960, height: 740 },
};

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Backdrop = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  zIndex: 1300,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const ModalContainer = styled(Box)<{ $width: number; $height: number }>(({ $width, $height }) => ({
  position: 'absolute',
  width: $width,
  height: $height,
  backgroundColor: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'width 0.2s ease, height 0.2s ease',
}));

const ModalHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  cursor: 'grab',
  userSelect: 'none',
  '&:active': {
    cursor: 'grabbing',
  },
});

const HeaderLeft = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
});

const HeaderRight = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const FileName = styled(Typography)({
  fontSize: 13,
  fontWeight: 600,
  color: '#e1e1e1',
});

const Subtitle = styled(Typography)({
  fontSize: 10,
  color: '#666',
});

const SizeToggleGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  backgroundColor: '#161616',
  borderRadius: 4,
  padding: 2,
});

const SizeToggle = styled(Button)<{ $active: boolean }>(({ $active }) => ({
  minWidth: 28,
  height: 24,
  padding: '0 8px',
  fontSize: 10,
  fontWeight: 600,
  color: $active ? '#1e1e1e' : '#888',
  backgroundColor: $active ? '#19abb5' : 'transparent',
  border: $active ? 'none' : '1px solid #333',
  borderRadius: 3,
  '&:hover': {
    backgroundColor: $active ? '#1bc4d0' : 'rgba(255, 255, 255, 0.1)',
    color: $active ? '#1e1e1e' : '#fff',
  },
}));

const CloseButton = styled(IconButton)({
  padding: 4,
  color: '#666',
  '&:hover': {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const ModalContent = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

// Video Player Styled Components
const VideoContainer = styled(Box)({
  flex: 1,
  minHeight: 0,
  backgroundColor: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
});

const VideoPlaceholder = styled(Box)({
  color: '#444',
  textAlign: 'center',
});

// Waveform Styled Components
const WaveformContainer = styled(Box)({
  height: 50,
  backgroundColor: '#161616',
  borderTop: '1px solid #333',
  position: 'relative',
  cursor: 'crosshair',
});

const WaveformCanvas = styled('canvas')({
  width: '100%',
  height: '100%',
  display: 'block',
});

// Transport Controls Styled Components
const TransportContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 44,
  padding: '0 12px',
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #333',
});

const TransportSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

const TransportCenter = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
});

const TimecodeDisplay = styled('div')({
  fontFamily: '"JetBrains Mono", "Roboto Mono", monospace',
  fontSize: 12,
  fontWeight: 500,
  color: '#e0e0e0',
  minWidth: 64,
});

const TransportBtn = styled('button')<{ $disabled?: boolean }>(({ $disabled }) => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: $disabled ? 'default' : 'pointer',
  color: $disabled ? '#444' : '#888',
  opacity: $disabled ? 0.5 : 1,
  padding: 0,
  transition: 'all 0.15s ease',
  '&:hover': $disabled ? {} : {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
  '& svg': {
    width: 16,
    height: 16,
    fill: 'currentColor',
  },
}));

const PlayBtn = styled('button')<{ $disabled?: boolean; $isPlaying?: boolean }>(({ $disabled, $isPlaying }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: $disabled ? '#333' : '#19abb5',
  border: 'none',
  cursor: $disabled ? 'default' : 'pointer',
  color: '#fff',
  boxShadow: $disabled ? 'none' : '0 2px 8px rgba(25, 171, 181, 0.3)',
  opacity: $disabled ? 0.5 : 1,
  padding: 0,
  transition: 'all 0.15s ease',
  '&:hover': $disabled ? {} : {
    background: '#1bc4d0',
  },
  '& svg': {
    width: 18,
    height: 18,
    fill: 'currentColor',
    marginLeft: $isPlaying ? 0 : 2,
  },
}));

const ReverseBtn = styled('button')<{ $disabled?: boolean; $active?: boolean }>(({ $disabled, $active }) => ({
  width: 28,
  height: 28,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: $active && !$disabled ? 'rgba(25, 171, 181, 0.2)' : 'transparent',
  border: $active && !$disabled ? '1px solid #19abb5' : 'none',
  cursor: $disabled ? 'default' : 'pointer',
  color: $active && !$disabled ? '#19abb5' : ($disabled ? '#444' : '#888'),
  opacity: $disabled ? 0.5 : 1,
  padding: 0,
  transition: 'all 0.15s ease',
  '&:hover': $disabled ? {} : {
    background: $active ? 'rgba(25, 171, 181, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    color: $active ? '#19abb5' : '#fff',
  },
  '& svg': {
    width: 16,
    height: 16,
    fill: 'currentColor',
  },
}));

const SpeedBtn = styled('button')<{ $disabled?: boolean }>(({ $disabled }) => ({
  height: 24,
  padding: '0 8px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  background: '#252525',
  border: '1px solid #333',
  cursor: $disabled ? 'default' : 'pointer',
  color: $disabled ? '#555' : '#ccc',
  fontFamily: '"Inter", sans-serif',
  fontSize: '11px',
  fontWeight: 500,
  opacity: $disabled ? 0.5 : 1,
  '&:hover': $disabled ? {} : {
    borderColor: '#19abb5',
    color: '#fff',
  },
  '& svg': {
    width: 10,
    height: 10,
    fill: 'currentColor',
    opacity: 0.7,
  },
}));

const SpeedMenuItem = styled('button')<{ $selected?: boolean }>(({ $selected }) => ({
  display: 'block',
  width: '100%',
  padding: '5px 10px',
  background: $selected ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
  border: 'none',
  color: $selected ? '#19abb5' : '#ccc',
  fontFamily: '"Inter", sans-serif',
  fontSize: '11px',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
}));

// Flags Section Styled Components
const FlagsSection = styled(Box)({
  borderTop: '1px solid #333',
  backgroundColor: '#1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 200,
  overflow: 'hidden',
});

const FlagsSectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
});

const FlagsSectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

const FlagsList = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  '&::-webkit-scrollbar': {
    width: 4,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 2,
  },
});

const FlagItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  cursor: 'pointer',
  borderBottom: '1px solid #252525',
  '&:hover': {
    backgroundColor: 'rgba(25, 171, 181, 0.05)',
  },
});

const FlagTimestamp = styled(Typography)({
  fontSize: 10,
  fontFamily: '"JetBrains Mono", monospace',
  color: '#19abb5',
  '&:hover': {
    textDecoration: 'underline',
  },
});

const FlagLabel = styled(Typography)({
  fontSize: 11,
  color: '#ccc',
  flex: 1,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const AddFlagButton = styled(Button)({
  fontSize: 10,
  color: '#666',
  borderColor: '#333',
  padding: '4px 8px',
  margin: '8px 12px',
  '&:hover': {
    borderColor: '#19abb5',
    color: '#19abb5',
  },
});

// SVG Icons
const SkipStartSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
  </svg>
);

const StepBackSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z" />
  </svg>
);

const ReversePlaySvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19 12 8 5v14l11-7z" transform="rotate(180 12 12)" />
  </svg>
);

const PlaySvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M8 5v14l11-7L8 5z" />
  </svg>
);

const PauseSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const StepForwardSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
  </svg>
);

const SkipEndSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
  </svg>
);

const ChevronDownSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </svg>
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatTimecode = (ms: number): string => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const formatFlagTimestamp = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface ExpandVideoModalProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  duration: number;
  flags: Flag[];
  onFlagClick: (flag: Flag) => void;
  onFlagAdd: () => void;
  videoUrl?: string | null; // URL to video file for synced playback
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ExpandVideoModal: React.FC<ExpandVideoModalProps> = ({
  open,
  onClose,
  fileName,
  duration,
  flags,
  onFlagClick,
  onFlagAdd,
  videoUrl,
}) => {
  // Modal state
  const [size, setSize] = useState<ModalSize>('M');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [flagsCollapsed, setFlagsCollapsed] = useState(false);

  // Speed menu state
  const [speedAnchorEl, setSpeedAnchorEl] = useState<HTMLElement | null>(null);
  const speedMenuOpen = Boolean(speedAnchorEl);

  // Video sync state
  const [isVideoSyncing, setIsVideoSyncing] = useState(false);

  // Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Playhead store
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const isReversePlaying = usePlayheadStore((state) => state.isReversePlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const togglePlayback = usePlayheadStore((state) => state.togglePlayback);
  const toggleReversePlayback = usePlayheadStore((state) => state.toggleReversePlayback);
  const setPlaybackSpeed = usePlayheadStore((state) => state.setPlaybackSpeed);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);
  const jumpToStart = usePlayheadStore((state) => state.jumpToStart);
  const jumpToEnd = usePlayheadStore((state) => state.jumpToEnd);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  const currentSize = MODAL_SIZES[size];

  // Center modal on open
  useEffect(() => {
    if (open) {
      const centerX = (window.innerWidth - currentSize.width) / 2;
      const centerY = (window.innerHeight - currentSize.height) / 2;
      setPosition({ x: centerX, y: centerY });
    }
  }, [open, currentSize.width, currentSize.height]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    // Clear
    ctx.fillStyle = '#161616';
    ctx.fillRect(0, 0, width, height);

    // Draw centerline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Generate simple waveform data
    ctx.fillStyle = 'rgba(25, 171, 181, 0.4)';
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    for (let i = 0; i < width; i++) {
      const t = i / width;
      const envelope = 0.3 + Math.sin(t * Math.PI * 0.5) * 0.2;
      const wave = Math.sin(t * 20) * 0.3 + Math.sin(t * 47) * 0.2 + Math.sin(t * 83) * 0.1;
      const sample = Math.abs(wave * envelope);
      ctx.lineTo(i, centerY - sample * (centerY - 2));
    }

    for (let i = width - 1; i >= 0; i--) {
      const t = i / width;
      const envelope = 0.3 + Math.sin(t * Math.PI * 0.5) * 0.2;
      const wave = Math.sin(t * 20) * 0.3 + Math.sin(t * 47) * 0.2 + Math.sin(t * 83) * 0.1;
      const sample = Math.abs(wave * envelope);
      ctx.lineTo(i, centerY + sample * (centerY - 2));
    }

    ctx.closePath();
    ctx.fill();

    // Draw stroke
    ctx.strokeStyle = '#19abb5';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw playhead
    const playheadX = (timestamp / 1000 / duration) * width;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [timestamp, duration]);

  // Draw waveform on updates
  useEffect(() => {
    if (open) {
      drawWaveform();
    }
  }, [open, timestamp, drawWaveform]);

  // Redraw on resize
  useEffect(() => {
    if (open) {
      const handleResize = () => drawWaveform();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, [open, drawWaveform]);

  // Sync video playback with waveform playhead
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !open) return;

    // Prevent recursive sync loops
    if (isVideoSyncing) return;

    const currentTimeSec = timestamp / 1000;

    // Sync position: only update if difference is significant (>0.1 second)
    if (Math.abs(video.currentTime - currentTimeSec) > 0.1) {
      setIsVideoSyncing(true);
      video.currentTime = currentTimeSec;
      setTimeout(() => setIsVideoSyncing(false), 50);
    }
  }, [timestamp, videoUrl, open, isVideoSyncing]);

  // Sync video play/pause state with waveform
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl || !open) return;

    if (isPlaying) {
      video.muted = true;
      video.play().catch(() => {
        // Ignore autoplay errors
      });
    } else {
      video.pause();
    }
  }, [isPlaying, videoUrl, open]);

  // Handle waveform click to seek
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    const timeInMs = ratio * duration * 1000;
    setTimestamp(Math.max(0, Math.min(timeInMs, duration * 1000)));
  }, [duration, setTimestamp]);

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }, [position]);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep within viewport bounds
      const maxX = window.innerWidth - currentSize.width;
      const maxY = window.innerHeight - currentSize.height;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, currentSize]);

  // Handle size change - resize from center
  const handleSizeChange = useCallback((newSize: ModalSize) => {
    const oldSize = MODAL_SIZES[size];
    const newSizeConfig = MODAL_SIZES[newSize];

    // Calculate center offset
    const deltaWidth = newSizeConfig.width - oldSize.width;
    const deltaHeight = newSizeConfig.height - oldSize.height;

    setPosition(prev => ({
      x: Math.max(0, prev.x - deltaWidth / 2),
      y: Math.max(0, prev.y - deltaHeight / 2),
    }));
    setSize(newSize);
  }, [size]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle flag click
  const handleFlagClick = useCallback((flag: Flag) => {
    setTimestamp(flag.timestamp);
    onFlagClick(flag);
  }, [setTimestamp, onFlagClick]);

  if (!open) return null;

  return (
    <Backdrop onClick={handleBackdropClick}>
      <ModalContainer
        ref={modalRef}
        $width={currentSize.width}
        $height={currentSize.height}
        style={{
          left: position.x,
          top: position.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <ModalHeader onMouseDown={handleDragStart}>
          <HeaderLeft>
            <FileName>{fileName}</FileName>
            <Subtitle>Video Preview</Subtitle>
          </HeaderLeft>
          <HeaderRight>
            <SizeToggleGroup>
              <Tooltip title="Small (400x350)">
                <SizeToggle $active={size === 'S'} onClick={() => handleSizeChange('S')}>
                  S
                </SizeToggle>
              </Tooltip>
              <Tooltip title="Medium (640x500)">
                <SizeToggle $active={size === 'M'} onClick={() => handleSizeChange('M')}>
                  M
                </SizeToggle>
              </Tooltip>
              <Tooltip title="Large (960x740)">
                <SizeToggle $active={size === 'L'} onClick={() => handleSizeChange('L')}>
                  L
                </SizeToggle>
              </Tooltip>
            </SizeToggleGroup>
            <CloseButton onClick={onClose}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </CloseButton>
          </HeaderRight>
        </ModalHeader>

        {/* Content */}
        <ModalContent>
          {/* Video Player */}
          <VideoContainer>
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <VideoPlaceholder>
                <Typography sx={{ fontSize: 14, color: '#555' }}>Video Preview</Typography>
                <Typography sx={{ fontSize: 11, color: '#444', mt: 0.5 }}>
                  No video available
                </Typography>
              </VideoPlaceholder>
            )}
          </VideoContainer>

          {/* Waveform */}
          <WaveformContainer>
            <WaveformCanvas
              ref={waveformCanvasRef}
              onClick={handleWaveformClick}
            />
          </WaveformContainer>

          {/* Transport Controls */}
          <TransportContainer sx={{ position: 'relative' }}>
            <TransportSection>
              <TimecodeDisplay>
                {formatTimecode(timestamp)}
              </TimecodeDisplay>
            </TransportSection>

            <TransportCenter>
              <Tooltip title="Jump to start">
                <TransportBtn onClick={jumpToStart}>
                  <SkipStartSvg />
                </TransportBtn>
              </Tooltip>
              <Tooltip title="Step back 5s">
                <TransportBtn onClick={() => stepBackward(5000)}>
                  <StepBackSvg />
                </TransportBtn>
              </Tooltip>
              <Tooltip title="Reverse play">
                <ReverseBtn $active={isReversePlaying} onClick={toggleReversePlayback}>
                  <ReversePlaySvg />
                </ReverseBtn>
              </Tooltip>
              <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
                <PlayBtn $isPlaying={isPlaying} onClick={togglePlayback}>
                  {isPlaying ? <PauseSvg /> : <PlaySvg />}
                </PlayBtn>
              </Tooltip>
              <Tooltip title="Step forward 5s">
                <TransportBtn onClick={() => stepForward(5000)}>
                  <StepForwardSvg />
                </TransportBtn>
              </Tooltip>
              <Tooltip title="Jump to end">
                <TransportBtn onClick={jumpToEnd}>
                  <SkipEndSvg />
                </TransportBtn>
              </Tooltip>
            </TransportCenter>

            <TransportSection>
              <Tooltip title="Playback speed">
                <SpeedBtn onClick={(e) => setSpeedAnchorEl(e.currentTarget)}>
                  {playbackSpeed}x
                  <ChevronDownSvg />
                </SpeedBtn>
              </Tooltip>
            </TransportSection>

            {/* Speed Menu */}
            {speedMenuOpen && (
              <>
                <Box
                  sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 9998,
                  }}
                  onClick={() => setSpeedAnchorEl(null)}
                />
                <Box
                  sx={{
                    position: 'fixed',
                    backgroundColor: '#252525',
                    border: '1px solid #333',
                    borderRadius: 1,
                    minWidth: 70,
                    zIndex: 9999,
                    top: speedAnchorEl ? speedAnchorEl.getBoundingClientRect().top - (speeds.length * 26) - 8 : 0,
                    left: speedAnchorEl ? speedAnchorEl.getBoundingClientRect().left : 0,
                  }}
                >
                  {speeds.map((speed) => (
                    <SpeedMenuItem
                      key={speed}
                      $selected={playbackSpeed === speed}
                      onClick={() => {
                        setPlaybackSpeed(speed);
                        setSpeedAnchorEl(null);
                      }}
                    >
                      {speed}x
                    </SpeedMenuItem>
                  ))}
                </Box>
              </>
            )}
          </TransportContainer>

          {/* Flags Section */}
          <FlagsSection>
            <FlagsSectionHeader onClick={() => setFlagsCollapsed(!flagsCollapsed)}>
              <FlagsSectionTitle>
                <FlagIcon sx={{ fontSize: 12, color: '#19abb5' }} />
                Flags ({flags.length})
              </FlagsSectionTitle>
              {flagsCollapsed ? (
                <ChevronRightIcon sx={{ fontSize: 16, color: '#666' }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </FlagsSectionHeader>

            {!flagsCollapsed && (
              <>
                <FlagsList>
                  {flags.length === 0 ? (
                    <Box sx={{ padding: '12px', textAlign: 'center' }}>
                      <Typography sx={{ fontSize: 11, color: '#555' }}>No flags yet</Typography>
                    </Box>
                  ) : (
                    flags.map((flag) => (
                      <FlagItem key={flag.id} onClick={() => handleFlagClick(flag)}>
                        <FlagTimestamp>{formatFlagTimestamp(flag.timestamp)}</FlagTimestamp>
                        <FlagLabel>• {flag.label}</FlagLabel>
                      </FlagItem>
                    ))
                  )}
                </FlagsList>
                <AddFlagButton
                  variant="outlined"
                  size="small"
                  startIcon={<AddIcon sx={{ fontSize: 12 }} />}
                  onClick={onFlagAdd}
                  fullWidth
                >
                  Add Flag
                </AddFlagButton>
              </>
            )}
          </FlagsSection>
        </ModalContent>
      </ModalContainer>
    </Backdrop>
  );
};

export default ExpandVideoModal;
