/**
 * TimelineViewer Component
 * Simplified timeline viewer for multi-view pop-out window
 * Shows session timeline with video/audio tracks and playhead
 */

import React, { useRef, useCallback, useState } from 'react';
import { Box, Typography } from '@mui/material';
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

const TimelineHeader = styled(Box)({
  height: 32,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
});

const TimeRuler = styled(Box)({
  height: 24,
  backgroundColor: '#161616',
  borderBottom: '1px solid #2a2a2a',
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-end',
});

const TimeMarker = styled(Box)({
  position: 'absolute',
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

const TracksContainer = styled(Box)({
  flex: 1,
  position: 'relative',
  backgroundColor: '#0d0d0d',
  overflow: 'hidden',
  cursor: 'pointer',
});

const Track = styled(Box)({
  height: 48,
  borderBottom: '1px solid #222',
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
});

const TrackLabel = styled(Box)({
  width: 80,
  height: '100%',
  backgroundColor: '#1a1a1a',
  borderRight: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  flexShrink: 0,
});

const TrackContent = styled(Box)({
  flex: 1,
  height: '100%',
  position: 'relative',
  padding: '6px 0',
});

const Clip = styled(Box)({
  position: 'absolute',
  top: 6,
  bottom: 6,
  backgroundColor: 'rgba(25, 171, 181, 0.3)',
  border: '1px solid rgba(25, 171, 181, 0.5)',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  overflow: 'hidden',
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
    top: -8,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '8px solid #19abb5',
  },
});

const PlaceholderContent = styled(Box)({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  textAlign: 'center',
  zIndex: 5,
});

const MaterialSymbol: React.FC<{ icon: string; size?: number }> = ({ icon, size = 20 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size }}
  >
    {icon}
  </span>
);

interface TimelineViewerProps {
  className?: string;
}

// Helper to format time for ruler
const formatRulerTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const TimelineViewer: React.FC<TimelineViewerProps> = ({ className }) => {
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const timelineEnd = usePlayheadStore((state) => state.timelineEnd);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  const containerRef = useRef<HTMLDivElement>(null);
  const [hasSession] = useState(false); // Will be true when session is loaded

  // Calculate playhead position percentage
  const duration = timelineEnd || 60000;
  const playheadPercent = (timestamp / duration) * 100;

  // Generate time markers
  const timeMarkers: number[] = [];
  const markerInterval = Math.max(5000, Math.floor(duration / 10)); // At least every 5 seconds
  for (let t = 0; t <= duration; t += markerInterval) {
    timeMarkers.push(t);
  }

  // Handle click to jump
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - 80; // Subtract track label width
    const contentWidth = rect.width - 80;
    if (x < 0) return;
    const percent = x / contentWidth;
    const newTimestamp = percent * duration;
    setTimestamp(Math.max(0, Math.min(duration, newTimestamp)));
  }, [duration, setTimestamp]);

  // Demo clips for placeholder
  const demoClips = [
    { track: 'video', start: 0, end: 80 },
    { track: 'audio', start: 10, end: 90 },
  ];

  return (
    <ViewerContainer className={className}>
      {/* Header */}
      <TimelineHeader>
        <MaterialSymbol icon="calendar_month" size={16} />
        <Typography sx={{ ml: 1, fontSize: 12, color: '#888' }}>
          Project Timeline
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: '#666' }}>
          {formatRulerTime(timestamp)} / {formatRulerTime(duration)}
        </Typography>
      </TimelineHeader>

      {/* Time ruler */}
      <TimeRuler>
        {timeMarkers.map((time) => (
          <TimeMarker
            key={time}
            sx={{ left: `calc(80px + ${(time / duration) * (100)}% - ${(time / duration) * 80}px)` }}
          >
            <Box sx={{ width: 1, height: 8, backgroundColor: '#444' }} />
            <Typography sx={{ fontSize: 9, color: '#666', mt: 0.25 }}>
              {formatRulerTime(time)}
            </Typography>
          </TimeMarker>
        ))}
      </TimeRuler>

      {/* Tracks */}
      <TracksContainer ref={containerRef} onClick={handleClick}>
        {!hasSession && (
          <PlaceholderContent>
            <MaterialSymbol icon="calendar_month" size={48} />
            <Typography sx={{ mt: 2, color: '#666', fontSize: 14 }}>
              Timeline
            </Typography>
            <Typography sx={{ color: '#444', fontSize: 12, mt: 1 }}>
              Connected to Session
            </Typography>
          </PlaceholderContent>
        )}

        {/* Video track */}
        <Track>
          <TrackLabel>
            <MaterialSymbol icon="movie" size={16} />
            <Typography sx={{ ml: 1, fontSize: 11, color: '#888' }}>
              Video
            </Typography>
          </TrackLabel>
          <TrackContent>
            {demoClips
              .filter(c => c.track === 'video')
              .map((clip, i) => (
                <Clip
                  key={i}
                  sx={{
                    left: `${clip.start}%`,
                    width: `${clip.end - clip.start}%`,
                    backgroundColor: 'rgba(100, 180, 100, 0.2)',
                    borderColor: 'rgba(100, 180, 100, 0.4)',
                  }}
                >
                  <Typography sx={{ fontSize: 10, color: '#888' }}>
                    Video Clip
                  </Typography>
                </Clip>
              ))}
          </TrackContent>
        </Track>

        {/* Audio track */}
        <Track>
          <TrackLabel>
            <MaterialSymbol icon="graphic_eq" size={16} />
            <Typography sx={{ ml: 1, fontSize: 11, color: '#888' }}>
              Audio
            </Typography>
          </TrackLabel>
          <TrackContent>
            {demoClips
              .filter(c => c.track === 'audio')
              .map((clip, i) => (
                <Clip
                  key={i}
                  sx={{
                    left: `${clip.start}%`,
                    width: `${clip.end - clip.start}%`,
                    backgroundColor: 'rgba(25, 171, 181, 0.2)',
                    borderColor: 'rgba(25, 171, 181, 0.4)',
                  }}
                >
                  <Typography sx={{ fontSize: 10, color: '#888' }}>
                    Audio Clip
                  </Typography>
                </Clip>
              ))}
          </TrackContent>
        </Track>

        {/* Playhead */}
        <Playhead sx={{ left: `calc(80px + ${playheadPercent}% - ${playheadPercent * 0.8}px)` }} />
      </TracksContainer>
    </ViewerContainer>
  );
};

export default TimelineViewer;
