import React, { useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, Slider, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import FastForwardIcon from '@mui/icons-material/FastForward';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

const TransportContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '8px 16px',
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #2b2b2b',
});

const TimecodeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: '14px',
  color: '#19abb5',
  minWidth: 100,
  textAlign: 'center',
});

const SpeedSelect = styled('select')({
  backgroundColor: '#252525',
  color: '#e1e1e1',
  border: '1px solid #333',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: '12px',
  cursor: 'pointer',
  '&:hover': {
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

  return (
    <TransportContainer>
      {showTimecode && (
        <TimecodeDisplay>{formatTimecode(timestamp)}</TimecodeDisplay>
      )}

      <Tooltip title="Jump to start (Home)">
        <IconButton size="small" onClick={jumpToStart} sx={{ color: '#888' }}>
          <SkipPreviousIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Step back (←, Shift+← for 1 sec)">
        <IconButton size="small" onClick={() => stepBackward()} sx={{ color: '#888' }}>
          <FastRewindIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
        <IconButton
          onClick={togglePlayback}
          sx={{
            color: '#19abb5',
            backgroundColor: 'rgba(25, 171, 181, 0.1)',
            '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.2)' },
          }}
        >
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
      </Tooltip>

      <Tooltip title="Step forward (→, Shift+→ for 1 sec)">
        <IconButton size="small" onClick={() => stepForward()} sx={{ color: '#888' }}>
          <FastForwardIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Jump to end (End)">
        <IconButton size="small" onClick={jumpToEnd} sx={{ color: '#888' }}>
          <SkipNextIcon />
        </IconButton>
      </Tooltip>

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
