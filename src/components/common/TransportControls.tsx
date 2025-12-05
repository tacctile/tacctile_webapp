import React, { useEffect } from 'react';
import { Box, IconButton, Typography, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import LoopIcon from '@mui/icons-material/Loop';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

const TransportContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 56,
  gap: 8,
  padding: '0 24px',
  backgroundColor: '#161616',
  borderTop: '1px solid #252525',
});

const TimecodeDisplay = styled(Typography)({
  fontFamily: '"JetBrains Mono", "Consolas", monospace',
  fontSize: '12px',
  fontWeight: 500,
  color: '#19abb5',
  minWidth: 90,
  textAlign: 'center',
  letterSpacing: '-0.3px',
});

const SpeedSelect = styled('select')({
  backgroundColor: '#1e1e1e',
  color: '#cccccc',
  border: '1px solid #303030',
  borderRadius: 2,
  padding: '3px 6px',
  fontSize: '11px',
  cursor: 'pointer',
  fontFamily: '"Inter", sans-serif',
  '&:hover': {
    borderColor: '#19abb5',
  },
  '&:focus': {
    outline: 'none',
    borderColor: '#19abb5',
  },
});

// Format timestamp to HH:MM:SS:FF (frames at 30fps)
const formatTimecode = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((ms % 1000) / 33.33); // ~30fps

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

interface TransportControlsProps {
  showTimecode?: boolean;
  showSpeed?: boolean;
  compact?: boolean;
}

export const TransportControls: React.FC<TransportControlsProps> = ({
  showTimecode = true,
  showSpeed = true,
  compact = false,
}) => {
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const play = usePlayheadStore((state) => state.play);
  const pause = usePlayheadStore((state) => state.pause);
  const togglePlayback = usePlayheadStore((state) => state.togglePlayback);
  const setPlaybackSpeed = usePlayheadStore((state) => state.setPlaybackSpeed);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);
  const jumpToStart = usePlayheadStore((state) => state.jumpToStart);
  const jumpToEnd = usePlayheadStore((state) => state.jumpToEnd);

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
          stepBackward(e.shiftKey ? 1000 : 33); // Shift = 1 second, normal = 1 frame
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward(e.shiftKey ? 1000 : 33);
          break;
        case 'Home':
          e.preventDefault();
          jumpToStart();
          break;
        case 'End':
          e.preventDefault();
          jumpToEnd();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayback, stepForward, stepBackward, jumpToStart, jumpToEnd]);

  const speeds = [0.25, 0.5, 1, 1.5, 2];

  // Common button styles for larger, easier-to-click buttons
  const transportButtonStyle = {
    color: '#888',
    padding: '8px',
    '&:hover': {
      color: '#19abb5',
      backgroundColor: 'rgba(25, 171, 181, 0.1)',
    },
  };

  const iconSize = 24;

  return (
    <TransportContainer>
      {/* Timecode Display */}
      {showTimecode && (
        <TimecodeDisplay>{formatTimecode(timestamp)}</TimecodeDisplay>
      )}

      {/* Divider after timecode */}
      <Box sx={{ width: 1, height: 24, backgroundColor: '#333', mx: 1 }} />

      {/* Skip to Start */}
      <Tooltip title="Jump to start (Home)">
        <IconButton onClick={jumpToStart} sx={transportButtonStyle}>
          <SkipPreviousIcon sx={{ fontSize: iconSize }} />
        </IconButton>
      </Tooltip>

      {/* Rewind / Step Back */}
      <Tooltip title="Rewind (←, Shift+← for 1 sec)">
        <IconButton onClick={() => stepBackward()} sx={transportButtonStyle}>
          <FastRewindIcon sx={{ fontSize: iconSize }} />
        </IconButton>
      </Tooltip>

      {/* Play/Pause - Highlighted */}
      <Tooltip title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
        <IconButton
          onClick={togglePlayback}
          sx={{
            color: '#19abb5',
            backgroundColor: 'rgba(25, 171, 181, 0.15)',
            padding: '10px',
            '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.25)' },
          }}
        >
          {isPlaying ? <PauseIcon sx={{ fontSize: 28 }} /> : <PlayArrowIcon sx={{ fontSize: 28 }} />}
        </IconButton>
      </Tooltip>

      {/* Fast Forward / Step Forward */}
      <Tooltip title="Fast forward (→, Shift+→ for 1 sec)">
        <IconButton onClick={() => stepForward()} sx={transportButtonStyle}>
          <FastForwardIcon sx={{ fontSize: iconSize }} />
        </IconButton>
      </Tooltip>

      {/* Skip to End */}
      <Tooltip title="Jump to end (End)">
        <IconButton onClick={jumpToEnd} sx={transportButtonStyle}>
          <SkipNextIcon sx={{ fontSize: iconSize }} />
        </IconButton>
      </Tooltip>

      {/* Divider before loop/speed */}
      <Box sx={{ width: 1, height: 24, backgroundColor: '#333', mx: 1 }} />

      {/* Loop toggle */}
      <Tooltip title="Loop playback">
        <IconButton sx={transportButtonStyle}>
          <LoopIcon sx={{ fontSize: iconSize - 2 }} />
        </IconButton>
      </Tooltip>

      {/* Speed selector */}
      {showSpeed && (
        <SpeedSelect
          value={playbackSpeed}
          onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
        >
          {speeds.map((speed) => (
            <option key={speed} value={speed}>
              {speed}x
            </option>
          ))}
        </SpeedSelect>
      )}
    </TransportContainer>
  );
};

export default TransportControls;
