/**
 * AudioViewer Component
 * Simplified audio viewer for multi-view pop-out window
 * Displays waveform with basic transport controls
 */

import React, { useRef, useCallback, useState } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

// Styled components
const ViewerContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const WaveformContainer = styled(Box)({
  flex: 1,
  position: 'relative',
  backgroundColor: '#0d0d0d',
  cursor: 'crosshair',
  overflow: 'hidden',
});

const WaveformPlaceholder = styled(Box)({
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  height: '60%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 20px',
});

const WaveformBars = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  height: '100%',
  gap: 2,
});

const Playhead = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: '#19abb5',
  zIndex: 10,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '8px solid #19abb5',
  },
});

const PlaceholderContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  padding: 24,
  textAlign: 'center',
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
});

const ControlsBar = styled(Box)({
  height: 48,
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const TransportControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#888',
  minWidth: 80,
});

const MaterialSymbol: React.FC<{ icon: string; size?: number }> = ({ icon, size = 20 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size }}
  >
    {icon}
  </span>
);

interface AudioViewerProps {
  className?: string;
}

// Helper to format time
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((ms % 1000) / (1000 / 30));

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

// Generate fake waveform bars for placeholder
const generateWaveformBars = (count: number): number[] => {
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Create a somewhat realistic waveform pattern
    const baseHeight = 0.3 + Math.sin(i * 0.1) * 0.2;
    const variation = Math.random() * 0.5;
    bars.push(Math.min(1, baseHeight + variation));
  }
  return bars;
};

export const AudioViewer: React.FC<AudioViewerProps> = ({ className }) => {
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const timelineEnd = usePlayheadStore((state) => state.timelineEnd);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const play = usePlayheadStore((state) => state.play);
  const pause = usePlayheadStore((state) => state.pause);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hasAudio] = useState(false); // Will be true when audio is loaded
  const [waveformBars] = useState(() => generateWaveformBars(100));

  // Calculate playhead position percentage
  const duration = timelineEnd || 60000;
  const playheadPercent = (timestamp / duration) * 100;

  // Handle waveform click to jump
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTimestamp = percent * duration;
    setTimestamp(newTimestamp);
  }, [duration, setTimestamp]);

  // Toggle play/pause
  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  return (
    <ViewerContainer className={className}>
      {/* Waveform area */}
      <WaveformContainer ref={containerRef} onClick={handleWaveformClick}>
        {hasAudio ? (
          // Real waveform would render here
          <WaveformPlaceholder>
            <WaveformBars>
              {waveformBars.map((height, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 3,
                    height: `${height * 100}%`,
                    backgroundColor: '#19abb5',
                    opacity: 0.7,
                    borderRadius: 1,
                  }}
                />
              ))}
            </WaveformBars>
          </WaveformPlaceholder>
        ) : (
          <>
            <WaveformPlaceholder>
              <WaveformBars>
                {waveformBars.map((height, i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 3,
                      height: `${height * 100}%`,
                      backgroundColor: '#444',
                      opacity: 0.5,
                      borderRadius: 1,
                    }}
                  />
                ))}
              </WaveformBars>
            </WaveformPlaceholder>
            <PlaceholderContent>
              <MaterialSymbol icon="graphic_eq" size={48} />
              <Typography sx={{ mt: 2, color: '#666', fontSize: 14 }}>
                Audio Viewer
              </Typography>
              <Typography sx={{ color: '#444', fontSize: 12, mt: 1 }}>
                Connected to Session
              </Typography>
            </PlaceholderContent>
          </>
        )}
        <Playhead sx={{ left: `${playheadPercent}%` }} />
      </WaveformContainer>

      {/* Transport controls */}
      <ControlsBar>
        <TransportControls>
          <IconButton
            size="small"
            onClick={() => stepBackward(1000)}
            sx={{ color: '#888', '&:hover': { color: '#fff' } }}
          >
            <MaterialSymbol icon="skip_previous" />
          </IconButton>

          <IconButton
            size="small"
            onClick={handlePlayPause}
            sx={{
              color: isPlaying ? '#19abb5' : '#888',
              '&:hover': { color: '#fff' },
            }}
          >
            <MaterialSymbol icon={isPlaying ? 'pause' : 'play_arrow'} size={24} />
          </IconButton>

          <IconButton
            size="small"
            onClick={() => stepForward(1000)}
            sx={{ color: '#888', '&:hover': { color: '#fff' } }}
          >
            <MaterialSymbol icon="skip_next" />
          </IconButton>
        </TransportControls>

        <TimeDisplay>
          {formatTime(timestamp)}
        </TimeDisplay>

        <Box sx={{ flex: 1 }} />

        <Typography sx={{ fontSize: 11, color: '#666' }}>
          {playbackSpeed}x
        </Typography>
      </ControlsBar>
    </ViewerContainer>
  );
};

export default AudioViewer;
