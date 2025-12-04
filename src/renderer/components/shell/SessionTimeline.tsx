import React, { useRef, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { styled, alpha } from '@mui/material/styles';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import VideocamIcon from '@mui/icons-material/Videocam';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import PhotoIcon from '@mui/icons-material/Photo';
import SensorsIcon from '@mui/icons-material/Sensors';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import FlagIcon from '@mui/icons-material/Flag';

import { TimelineItem, TimelineMarker } from '../../types';

const TIMELINE_HEIGHT = 120;

const TimelineContainer = styled(Box)(({ theme }) => ({
  height: TIMELINE_HEIGHT,
  backgroundColor: '#0f0f0f',
  borderTop: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  position: 'relative',
}));

const TimelineHeader = styled(Box)({
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  borderBottom: '1px solid #1a1a1a',
  backgroundColor: '#121212',
});

const TransportControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const TransportButton = styled(IconButton)({
  width: 28,
  height: 28,
  color: '#808080',
  '&:hover': {
    color: '#c0c0c0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
  '& svg': {
    fontSize: 18,
  },
});

const PlayButton = styled(IconButton)({
  width: 32,
  height: 32,
  color: '#19abb5',
  backgroundColor: alpha('#19abb5', 0.1),
  '&:hover': {
    color: '#36d1da',
    backgroundColor: alpha('#19abb5', 0.2),
  },
  '& svg': {
    fontSize: 20,
  },
});

const TimecodeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#a0a0a0',
  minWidth: 160,
  textAlign: 'center',
});

const ZoomControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const TimelineBody = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const TimeRuler = styled(Box)({
  height: 20,
  backgroundColor: '#0d0d0d',
  borderBottom: '1px solid #1a1a1a',
  position: 'relative',
  overflow: 'hidden',
});

const TimeMarker = styled(Typography)<{ position: number }>(({ position }) => ({
  position: 'absolute',
  left: `${position}%`,
  top: 2,
  fontSize: 10,
  color: '#606060',
  fontFamily: 'monospace',
  transform: 'translateX(-50%)',
}));

const TracksContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
});

const Track = styled(Box)<{ trackColor?: string }>(({ trackColor = '#1a1a1a' }) => ({
  height: 16,
  backgroundColor: trackColor,
  borderBottom: '1px solid #1a1a1a',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
}));

const TrackLabel = styled(Box)({
  position: 'absolute',
  left: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  zIndex: 1,
  '& svg': {
    fontSize: 12,
    color: '#606060',
  },
});

const MediaClip = styled(Box)<{ start: number; width: number; clipColor: string }>(({ start, width, clipColor }) => ({
  position: 'absolute',
  left: `${start}%`,
  width: `${width}%`,
  height: 12,
  backgroundColor: clipColor,
  borderRadius: 2,
  cursor: 'pointer',
  opacity: 0.8,
  transition: 'opacity 0.1s ease',
  '&:hover': {
    opacity: 1,
  },
}));

const PlayheadLine = styled(Box)<{ position: number }>(({ position }) => ({
  position: 'absolute',
  left: `${position}%`,
  top: 0,
  bottom: 0,
  width: 1,
  backgroundColor: '#19abb5',
  pointerEvents: 'none',
  zIndex: 10,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -4,
    left: -4,
    width: 8,
    height: 8,
    backgroundColor: '#19abb5',
    borderRadius: '50%',
  },
}));

const MarkerFlag = styled(Box)<{ position: number; color: string }>(({ position, color }) => ({
  position: 'absolute',
  left: `${position}%`,
  top: 0,
  width: 8,
  height: 8,
  backgroundColor: color,
  clipPath: 'polygon(0 0, 100% 50%, 0 100%)',
  cursor: 'pointer',
  zIndex: 5,
  '&:hover': {
    transform: 'scale(1.2)',
  },
}));

interface SessionTimelineProps {
  items?: TimelineItem[];
  sessionStart?: Date;
  sessionEnd?: Date;
  currentTime?: Date;
  isPlaying?: boolean;
  onPlayPause?: () => void;
  onSeek?: (time: Date) => void;
  onItemSelect?: (item: TimelineItem) => void;
}

const SessionTimeline: React.FC<SessionTimelineProps> = ({
  items = [],
  sessionStart = new Date(Date.now() - 3600000), // 1 hour ago
  sessionEnd = new Date(),
  currentTime = new Date(Date.now() - 1800000), // 30 min ago
  isPlaying = false,
  onPlayPause,
  onSeek,
  onItemSelect,
}) => {
  const [zoom, setZoom] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);

  const sessionDuration = sessionEnd.getTime() - sessionStart.getTime();
  const playheadPosition = ((currentTime.getTime() - sessionStart.getTime()) / sessionDuration) * 100;

  const formatTimecode = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const frames = Math.floor((date.getMilliseconds() / 1000) * 30).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}:${frames}`;
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Generate time markers every 10% of the timeline
  const timeMarkers = Array.from({ length: 11 }, (_, i) => {
    const position = i * 10;
    const markerTime = new Date(sessionStart.getTime() + (sessionDuration * position) / 100);
    return { position, time: markerTime };
  });

  // Group items by type for track display
  const tracks = [
    { id: 'video', icon: <VideocamIcon />, label: 'Video', color: '#3b82f6' },
    { id: 'audio', icon: <GraphicEqIcon />, label: 'Audio', color: '#22c55e' },
    { id: 'image', icon: <PhotoIcon />, label: 'Images', color: '#f59e0b' },
    { id: 'sensor_event', icon: <SensorsIcon />, label: 'Sensors', color: '#ef4444' },
    { id: 'stream_clip', icon: <LiveTvIcon />, label: 'Stream', color: '#8b5cf6' },
  ];

  const getItemPosition = (item: TimelineItem) => {
    const start = ((item.timestamp.getTime() - sessionStart.getTime()) / sessionDuration) * 100;
    const width = item.duration ? (item.duration * 1000 / sessionDuration) * 100 : 1;
    return { start: Math.max(0, Math.min(start, 100)), width: Math.min(width, 100 - start) };
  };

  const handleZoomIn = () => setZoom(Math.min(zoom * 1.5, 10));
  const handleZoomOut = () => setZoom(Math.max(zoom / 1.5, 0.5));
  const handleFitToWindow = () => setZoom(1);

  return (
    <TimelineContainer>
      <TimelineHeader>
        {/* Transport Controls */}
        <TransportControls>
          <Tooltip title="Previous Marker">
            <TransportButton>
              <SkipPreviousIcon />
            </TransportButton>
          </Tooltip>
          <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
            <PlayButton onClick={onPlayPause}>
              {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
            </PlayButton>
          </Tooltip>
          <Tooltip title="Next Marker">
            <TransportButton>
              <SkipNextIcon />
            </TransportButton>
          </Tooltip>
        </TransportControls>

        {/* Timecode Display */}
        <TimecodeDisplay>
          {formatTimecode(currentTime)} / {formatDuration(sessionDuration)}
        </TimecodeDisplay>

        {/* Zoom Controls */}
        <ZoomControls>
          <Typography sx={{ fontSize: 11, color: '#606060', mr: 1 }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <Tooltip title="Zoom Out">
            <TransportButton onClick={handleZoomOut}>
              <ZoomOutIcon />
            </TransportButton>
          </Tooltip>
          <Tooltip title="Fit to Window">
            <TransportButton onClick={handleFitToWindow}>
              <FitScreenIcon />
            </TransportButton>
          </Tooltip>
          <Tooltip title="Zoom In">
            <TransportButton onClick={handleZoomIn}>
              <ZoomInIcon />
            </TransportButton>
          </Tooltip>
        </ZoomControls>
      </TimelineHeader>

      <TimelineBody ref={timelineRef}>
        {/* Time Ruler */}
        <TimeRuler>
          {timeMarkers.map(({ position, time }) => (
            <TimeMarker key={position} position={position}>
              {time.getHours().toString().padStart(2, '0')}:
              {time.getMinutes().toString().padStart(2, '0')}
            </TimeMarker>
          ))}
        </TimeRuler>

        {/* Tracks */}
        <TracksContainer>
          {tracks.map((track) => {
            const trackItems = items.filter(item => item.type === track.id);
            return (
              <Track key={track.id}>
                <TrackLabel>
                  {track.icon}
                </TrackLabel>
                {trackItems.map((item) => {
                  const { start, width } = getItemPosition(item);
                  return (
                    <MediaClip
                      key={item.id}
                      start={start}
                      width={Math.max(width, 0.5)}
                      clipColor={track.color}
                      onClick={() => onItemSelect?.(item)}
                    />
                  );
                })}
                {/* Markers */}
                {trackItems.flatMap(item =>
                  (item.markers || []).map(marker => {
                    const markerPos = ((marker.timestamp.getTime() - sessionStart.getTime()) / sessionDuration) * 100;
                    return (
                      <Tooltip key={marker.id} title={marker.label} placement="top">
                        <MarkerFlag
                          position={markerPos}
                          color={marker.color || '#f59e0b'}
                        />
                      </Tooltip>
                    );
                  })
                )}
              </Track>
            );
          })}

          {/* Playhead */}
          <PlayheadLine position={playheadPosition} />
        </TracksContainer>
      </TimelineBody>
    </TimelineContainer>
  );
};

export default SessionTimeline;
