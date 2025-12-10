import React, { useEffect, useState } from 'react';
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
  justifyContent: 'space-between',
  height: 52,
  padding: '0 16px',
  backgroundColor: '#161616',
  borderTop: '1px solid #2a2a2a',
  position: 'relative',
});

const TransportSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const TransportCenter = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
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
  width: 44,
  height: 44,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#19abb5',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  color: '#fff',
  boxShadow: '0 2px 8px rgba(25, 171, 181, 0.3)',
  '&:hover': {
    background: '#1bc4d0',
    boxShadow: '0 4px 12px rgba(25, 171, 181, 0.4)',
  },
  '&:active': {
    transform: 'scale(0.95)',
  },
  '& svg': {
    width: 22,
    height: 22,
    fill: 'currentColor',
    marginLeft: $isPlaying ? 0 : 2, // Slight offset for play icon visual centering
  },
}));

// Reverse play button - similar styling to hero but secondary color when active
const ReversePlayButton = styled('button')<{ $active?: boolean }>(({ $active }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: $active ? 'rgba(25, 171, 181, 0.2)' : 'transparent',
  border: $active ? '1px solid #19abb5' : 'none',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  color: $active ? '#19abb5' : '#888',
  '&:hover': {
    background: $active ? 'rgba(25, 171, 181, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    color: $active ? '#19abb5' : '#fff',
  },
  '& svg': {
    width: 20,
    height: 20,
    fill: 'currentColor',
  },
}));

// Loop toggle button
const LoopButton = styled('button')<{ $active?: boolean }>(({ $active }) => ({
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
    background: 'rgba(255, 255, 255, 0.1)',
    color: $active ? '#19abb5' : '#fff',
  },
  '& svg': {
    width: 18,
    height: 18,
    fill: 'currentColor',
  },
}));

// Speed selector button
const SpeedButton = styled('button')({
  height: 28,
  padding: '0 10px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  background: '#1e1e1e',
  border: '1px solid #303030',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  color: '#ccc',
  fontFamily: '"Inter", sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  '&:hover': {
    borderColor: '#19abb5',
    color: '#fff',
  },
  '& svg': {
    width: 12,
    height: 12,
    fill: 'currentColor',
    opacity: 0.7,
  },
});

const SpeedMenu = styled(Menu)({
  '& .MuiPaper-root': {
    backgroundColor: '#1e1e1e',
    border: '1px solid #303030',
    borderRadius: 4,
    minWidth: 80,
  },
});

const SpeedMenuItem = styled(MenuItem)<{ $selected?: boolean }>(({ $selected }) => ({
  fontFamily: '"Inter", sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  color: $selected ? '#19abb5' : '#ccc',
  backgroundColor: $selected ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
  padding: '6px 12px',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
}));

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

const ReversePlayIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19 12 8 5v14l11-7z" transform="rotate(180 12 12)" />
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

const SkipEndIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
  </svg>
);

const LoopIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </svg>
);

// ============================================================================
// HELPERS
// ============================================================================

// Speed options
const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

// ============================================================================
// COMPONENT
// ============================================================================

interface TransportControlsProps {
  showSpeed?: boolean;
  compact?: boolean;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  showSpeed = true,
}) => {
  // Playhead store
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

  // Audio tool store for loop toggle
  const looping = useAudioToolStore((state) => state.playback.looping);
  const toggleLooping = useAudioToolStore((state) => state.toggleLooping);

  // Speed menu state
  const [speedAnchor, setSpeedAnchor] = useState<null | HTMLElement>(null);
  const speedMenuOpen = Boolean(speedAnchor);

  const handleSpeedClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setSpeedAnchor(event.currentTarget);
  };

  const handleSpeedClose = () => {
    setSpeedAnchor(null);
  };

  const handleSpeedSelect = (speed: number) => {
    setPlaybackSpeed(speed);
    handleSpeedClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayback();
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
        case 'End':
          e.preventDefault();
          jumpToEnd();
          break;
        case 'KeyL':
          e.preventDefault();
          toggleLooping();
          break;
        case 'KeyR':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleReversePlayback();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, stepForward, stepBackward, jumpToStart, jumpToEnd, toggleLooping, toggleReversePlayback]);

  return (
    <TransportContainer>
      {/* LEFT SECTION: Loop Toggle + Speed Selector */}
      <TransportSection>
        {/* Loop Toggle */}
        <Tooltip title={looping ? 'Loop enabled (L)' : 'Enable loop (L)'}>
          <LoopButton
            onClick={toggleLooping}
            $active={looping}
            aria-label={looping ? 'Disable loop' : 'Enable loop'}
          >
            <LoopIcon />
          </LoopButton>
        </Tooltip>

        {/* Speed Selector */}
        {showSpeed && (
          <>
            <Tooltip title="Playback speed">
              <SpeedButton onClick={handleSpeedClick} aria-label="Playback speed">
                {playbackSpeed}x
                <ChevronDownIcon />
              </SpeedButton>
            </Tooltip>
            <SpeedMenu
              anchorEl={speedAnchor}
              open={speedMenuOpen}
              onClose={handleSpeedClose}
              anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
              transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              {SPEEDS.map((speed) => (
                <SpeedMenuItem
                  key={speed}
                  onClick={() => handleSpeedSelect(speed)}
                  $selected={playbackSpeed === speed}
                >
                  {speed}x
                </SpeedMenuItem>
              ))}
            </SpeedMenu>
          </>
        )}
      </TransportSection>

      {/* CENTER SECTION: Transport Controls */}
      <TransportCenter>
        {/* Skip to Start */}
        <Tooltip title="Jump to start (Home)">
          <TransportButton onClick={jumpToStart} aria-label="Skip to start">
            <SkipStartIcon />
          </TransportButton>
        </Tooltip>

        {/* Step Back (5 seconds) */}
        <Tooltip title="Step back 5s (←, Shift+← for more)">
          <TransportButton onClick={() => stepBackward(5000)} aria-label="Step back">
            <StepBackIcon />
          </TransportButton>
        </Tooltip>

        {/* Reverse Play */}
        <Tooltip title="Reverse play (R) - for reverse audio analysis">
          <ReversePlayButton
            onClick={toggleReversePlayback}
            $active={isReversePlaying}
            aria-label="Reverse play"
          >
            <ReversePlayIcon />
          </ReversePlayButton>
        </Tooltip>

        {/* Play/Pause - Hero Button */}
        <Tooltip title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          <PlayButton
            onClick={togglePlayback}
            $isPlaying={isPlaying}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </PlayButton>
        </Tooltip>

        {/* Step Forward (5 seconds) */}
        <Tooltip title="Step forward 5s (→, Shift+→ for more)">
          <TransportButton onClick={() => stepForward(5000)} aria-label="Step forward">
            <StepForwardIcon />
          </TransportButton>
        </Tooltip>

        {/* Skip to End */}
        <Tooltip title="Jump to end (End)">
          <TransportButton onClick={jumpToEnd} aria-label="Skip to end">
            <SkipEndIcon />
          </TransportButton>
        </Tooltip>
      </TransportCenter>

      {/* RIGHT SECTION: Reserved for future tool-specific controls (e.g., volume) */}
      <TransportSection />
    </TransportContainer>
  );
};

export default TransportControls;
