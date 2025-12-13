import React, { useEffect, useCallback, useState } from 'react';
import { Box, Tooltip, Menu, MenuItem } from '@mui/material';
import { styled } from '@mui/material/styles';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useAudioToolStore } from '@/stores/useAudioToolStore';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const TransportContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: 52,
  backgroundColor: '#161616',
  borderTop: '1px solid #2a2a2a',
});

// Left section - contains controls to the left of Play/Pause
// Uses flex: 1 and right-aligns content so buttons extend leftward from center
const LeftControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flex: 1,
  gap: 8,
});

// Center section - contains only the Play/Pause button
// This is positioned at the exact center of the container
const CenterControl = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
});

// Right section - contains controls to the right of Play/Pause
// Uses flex: 1 and left-aligns content so buttons extend rightward from center
const RightControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  flex: 1,
  gap: 8,
});

// Base transport button - circular with hover states
const TransportButton = styled('button')<{ $active?: boolean }>(({ $active }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  color: $active ? '#19abb5' : '#888',
  '&:hover': {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
  '&:active': {
    color: '#19abb5',
  },
  '& svg': {
    width: 20,
    height: 20,
    fill: 'currentColor',
  },
}));

// Hero play button - circular with teal background
const PlayButton = styled('button')<{ $isPlaying?: boolean }>(({ $isPlaying }) => ({
  width: 40,
  height: 40,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#19abb5',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  color: '#0d0d0d',
  margin: '0 8px',
  '&:hover': {
    background: '#1db8c4',
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
  '& svg': {
    width: 24,
    height: 24,
    fill: 'currentColor',
    marginLeft: $isPlaying ? 0 : 2, // Slight offset for play icon visual centering
  },
}));

// Modifier button (Reverse/Loop) - gray normally, teal when active
const ModifierButton = styled('button')<{ $active?: boolean }>(({ $active }) => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  color: $active ? '#19abb5' : '#888',
  '&:hover': {
    color: '#19abb5',
  },
  '& svg': {
    width: 18,
    height: 18,
    fill: 'currentColor',
  },
}));

// Speed cycling button
const SpeedButton = styled('button')({
  minWidth: 40,
  height: 28,
  padding: '0 8px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  color: '#888',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '11px',
  fontWeight: 500,
  textTransform: 'none',
  '&:hover': {
    color: '#19abb5',
  },
});

// ============================================================================
// ICONS (SVG)
// ============================================================================

const SkipStartIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
  </svg>
);

const StepBackIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z" />
  </svg>
);

const PlayIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M8 5v14l11-7L8 5z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const StepForwardIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
  </svg>
);

const LoopIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
  </svg>
);

// ============================================================================
// COMPONENT
// ============================================================================

interface TransportControlsProps {
  showSpeed?: boolean;
  compact?: boolean;
}

export const TransportControls: React.FC<TransportControlsProps> = () => {
  // Playhead store
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const togglePlayback = usePlayheadStore((state) => state.togglePlayback);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const setPlaybackSpeed = usePlayheadStore((state) => state.setPlaybackSpeed);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);
  const jumpToStart = usePlayheadStore((state) => state.jumpToStart);

  // Audio tool store for loop toggle and selection
  const looping = useAudioToolStore((state) => state.playback.looping);
  const toggleLooping = useAudioToolStore((state) => state.toggleLooping);
  const selectionStart = useAudioToolStore((state) => state.waveformSelectionStart);
  const selectionEnd = useAudioToolStore((state) => state.waveformSelectionEnd);

  // Speed menu state
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<null | HTMLElement>(null);
  const speedMenuOpen = Boolean(speedMenuAnchor);

  // Handle play/pause with selection awareness
  const handlePlayPause = useCallback(() => {
    // If starting playback and selection exists
    if (!isPlaying && selectionStart !== null && selectionEnd !== null) {
      const currentTimeSec = timestamp / 1000;
      const selStart = Math.min(selectionStart, selectionEnd);
      const selEnd = Math.max(selectionStart, selectionEnd);

      // If playhead is outside selection, jump to selection start
      if (currentTimeSec < selStart || currentTimeSec > selEnd) {
        setTimestamp(selStart * 1000);
      }
    }
    togglePlayback();
  }, [isPlaying, selectionStart, selectionEnd, timestamp, setTimestamp, togglePlayback]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBackward(e.shiftKey ? 5000 : 33); // Shift = 5 seconds, normal = 1 frame
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward(e.shiftKey ? 5000 : 33);
          break;
        case 'Home':
          e.preventDefault();
          jumpToStart();
          break;
        case 'KeyL':
          e.preventDefault();
          toggleLooping();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, stepForward, stepBackward, jumpToStart, toggleLooping]);

  return (
    <TransportContainer>
      {/* Left controls - extend leftward from center */}
      <LeftControls>
        {/* Jump to Start */}
        <Tooltip title="Jump to start (Home)">
          <TransportButton onClick={jumpToStart} aria-label="Jump to start">
            <SkipStartIcon />
          </TransportButton>
        </Tooltip>

        {/* Step Back 5 seconds */}
        <Tooltip title="Step back 5s (Shift+←)">
          <TransportButton onClick={() => stepBackward(5000)} aria-label="Step back 5 seconds">
            <StepBackIcon />
          </TransportButton>
        </Tooltip>
      </LeftControls>

      {/* Center control - Play/Pause at absolute center */}
      <CenterControl>
        <Tooltip title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          <PlayButton
            onClick={handlePlayPause}
            $isPlaying={isPlaying}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </PlayButton>
        </Tooltip>
      </CenterControl>

      {/* Right controls - extend rightward from center */}
      <RightControls>
        {/* Step Forward 5 seconds */}
        <Tooltip title="Step forward 5s (Shift+→)">
          <TransportButton onClick={() => stepForward(5000)} aria-label="Step forward 5 seconds">
            <StepForwardIcon />
          </TransportButton>
        </Tooltip>

        {/* Loop */}
        <Tooltip title={looping ? 'Loop enabled (L)' : 'Enable loop (L)'}>
          <ModifierButton
            onClick={toggleLooping}
            $active={looping}
            aria-label={looping ? 'Disable loop' : 'Enable loop'}
          >
            <LoopIcon />
          </ModifierButton>
        </Tooltip>

        {/* Playback Speed */}
        <Tooltip title="Playback speed">
          <SpeedButton
            onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
            aria-label="Playback speed"
            style={{ color: playbackSpeed !== 1 ? '#19abb5' : '#888' }}
          >
            {playbackSpeed}x
          </SpeedButton>
        </Tooltip>
      </RightControls>

      <Menu
        anchorEl={speedMenuAnchor}
        open={speedMenuOpen}
        onClose={() => setSpeedMenuAnchor(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        sx={{
          '& .MuiPaper-root': {
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            minWidth: 60,
          },
        }}
      >
        {[2, 1.5, 1, 0.75, 0.5].map((speed) => (
          <MenuItem
            key={speed}
            onClick={() => {
              setPlaybackSpeed(speed);
              setSpeedMenuAnchor(null);
            }}
            selected={playbackSpeed === speed}
            sx={{
              fontSize: 11,
              fontFamily: '"JetBrains Mono", monospace',
              color: playbackSpeed === speed ? '#19abb5' : '#888',
              backgroundColor: 'transparent',
              justifyContent: 'center',
              py: 0.5,
              '&:hover': {
                backgroundColor: 'rgba(25, 171, 181, 0.1)',
                color: '#19abb5',
              },
              '&.Mui-selected': {
                backgroundColor: 'rgba(25, 171, 181, 0.15)',
              },
            }}
          >
            {speed}x
          </MenuItem>
        ))}
      </Menu>
    </TransportContainer>
  );
};

export default TransportControls;
