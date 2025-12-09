/**
 * VideoViewer Component
 * Simplified video viewer for multi-view pop-out window
 * Displays video with basic transport controls
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Box, IconButton, Typography, Slider } from '@mui/material';
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

const VideoContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#000',
  position: 'relative',
  overflow: 'hidden',
});

const PlaceholderContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  padding: 24,
  textAlign: 'center',
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

const WaveformBar = styled(Box)({
  height: 40,
  backgroundColor: '#161616',
  borderTop: '1px solid #2a2a2a',
  position: 'relative',
  cursor: 'pointer',
});

const WaveformPlaceholder = styled(Box)({
  position: 'absolute',
  left: 0,
  right: 0,
  top: '50%',
  transform: 'translateY(-50%)',
  height: 20,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const Playhead = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: '#19abb5',
  zIndex: 10,
});

const MaterialSymbol: React.FC<{ icon: string; size?: number }> = ({ icon, size = 20 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size }}
  >
    {icon}
  </span>
);

interface VideoViewerProps {
  className?: string;
}

// Helper to format time
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor((ms % 1000) / (1000 / 30)); // Assume 30fps

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
};

export const VideoViewer: React.FC<VideoViewerProps> = ({ className }) => {
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const sessionEnd = usePlayheadStore((state) => state.sessionEnd);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const play = usePlayheadStore((state) => state.play);
  const pause = usePlayheadStore((state) => state.pause);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);

  const waveformRef = useRef<HTMLDivElement>(null);
  const [hasVideo] = useState(false); // Will be true when video is loaded

  // Calculate playhead position percentage
  const duration = sessionEnd || 60000; // Default to 1 minute if no session
  const playheadPercent = (timestamp / duration) * 100;

  // Handle waveform click to jump
  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
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
      {/* Video area */}
      <VideoContainer>
        {hasVideo ? (
          // Video player would go here
          <video style={{ maxWidth: '100%', maxHeight: '100%' }} />
        ) : (
          <PlaceholderContent>
            <MaterialSymbol icon="movie" size={48} />
            <Typography sx={{ mt: 2, color: '#666', fontSize: 14 }}>
              Video Viewer
            </Typography>
            <Typography sx={{ color: '#444', fontSize: 12, mt: 1 }}>
              Connected to Session
            </Typography>
          </PlaceholderContent>
        )}
      </VideoContainer>

      {/* Waveform reference bar */}
      <WaveformBar ref={waveformRef} onClick={handleWaveformClick}>
        <WaveformPlaceholder>
          {/* Simple placeholder waveform visualization */}
          <Box sx={{
            width: '100%',
            height: 16,
            background: 'linear-gradient(90deg, #333 0%, #444 50%, #333 100%)',
            opacity: 0.5,
          }} />
        </WaveformPlaceholder>
        <Playhead sx={{ left: `${playheadPercent}%` }} />
      </WaveformBar>

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

export default VideoViewer;
