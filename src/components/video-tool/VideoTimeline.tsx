/**
 * VideoTimeline Component
 * Multi-track timeline with waveform, playhead, and file markers
 */

import React, { useRef, useCallback, useEffect, useState, memo, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';
import FlagIcon from '@mui/icons-material/Flag';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import type { VideoMarker, TimelineTrack, TimeRange, WaveformData } from '../../types/video';
import { formatTimecode, MARKER_COLORS } from '../../types/video';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const TimelineContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #2b2b2b',
  overflow: 'hidden',
  userSelect: 'none',
});

const TimelineHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '4px 8px',
  backgroundColor: '#141414',
  borderBottom: '1px solid #2b2b2b',
  gap: 8,
  minHeight: 32,
});

const TimelineBody = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const TrackLabels = styled(Box)({
  width: 80,
  flexShrink: 0,
  backgroundColor: '#141414',
  borderRight: '1px solid #2b2b2b',
  overflow: 'hidden',
});

const TrackLabelItem = styled(Box)<{ height: number }>(({ height }) => ({
  height,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 8px',
  borderBottom: '1px solid #2b2b2b',
  fontSize: 11,
  color: '#888',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
}));

const TracksContainer = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
});

const TimeRuler = styled(Box)({
  height: 24,
  backgroundColor: '#1e1e1e',
  borderBottom: '1px solid #2b2b2b',
  position: 'relative',
  overflow: 'hidden',
});

const RulerMark = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-end',
  fontSize: 10,
  color: '#666',
  paddingBottom: 2,
});

const TracksArea = styled(Box)({
  flex: 1,
  position: 'relative',
  overflow: 'hidden',
  cursor: 'pointer',
});

const TrackRow = styled(Box)<{ height: number; color: string }>(({ height, color }) => ({
  height,
  position: 'relative',
  borderBottom: '1px solid #2b2b2b',
  backgroundColor: `${color}10`,
}));

const Playhead = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: '#19abb5',
  zIndex: 100,
  pointerEvents: 'none',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -6,
    left: -5,
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '6px solid #19abb5',
  },
});

const MarkerFlag = styled(Box)<{ color: string }>(({ color }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: color,
  cursor: 'pointer',
  zIndex: 50,
  transition: 'transform 0.1s ease',
  '&:hover': {
    transform: 'scaleX(2)',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: -3,
    width: 8,
    height: 8,
    backgroundColor: color,
    borderRadius: 1,
  },
}));

const WaveformCanvas = styled('canvas')({
  width: '100%',
  height: '100%',
  display: 'block',
});

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#19abb5',
});

// ============================================================================
// PROPS
// ============================================================================

interface VideoTimelineProps {
  /** Total duration in seconds */
  duration: number;
  /** Current playback time */
  currentTime: number;
  /** Frame rate */
  fps: number;
  /** Flag markers */
  markers: VideoMarker[];
  /** Timeline tracks */
  tracks: TimelineTrack[];
  /** Visible time range */
  visibleTimeRange: TimeRange;
  /** Waveform data for audio track */
  waveformData: WaveformData | null;
  /** Zoom level (pixels per second) */
  zoom: number;
  /** Whether audio is muted */
  muted: boolean;
  /** Callback when user seeks */
  onSeek: (time: number) => void;
  /** Callback when visible range changes */
  onRangeChange: (range: TimeRange) => void;
  /** Callback when marker is clicked */
  onMarkerClick?: (marker: VideoMarker) => void;
  /** Callback when mute is toggled */
  onMuteToggle?: () => void;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const VideoTimeline: React.FC<VideoTimelineProps> = memo(({
  duration,
  currentTime,
  fps,
  markers,
  tracks,
  visibleTimeRange,
  waveformData,
  zoom,
  muted,
  onSeek,
  onRangeChange,
  onMarkerClick,
  onMuteToggle,
  onZoomChange,
}) => {
  const tracksRef = useRef<HTMLDivElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate timeline dimensions
  const timelineWidth = useMemo(() => {
    return duration * zoom;
  }, [duration, zoom]);

  const scrollOffset = useMemo(() => {
    return visibleTimeRange.start * zoom;
  }, [visibleTimeRange.start, zoom]);

  // Generate time ruler marks
  const rulerMarks = useMemo(() => {
    const marks: { time: number; label: string; isMajor: boolean }[] = [];
    const visibleDuration = visibleTimeRange.end - visibleTimeRange.start;

    // Determine mark interval based on zoom
    let majorInterval = 10; // seconds
    let minorCount = 5;

    if (zoom > 100) {
      majorInterval = 1;
      minorCount = 10;
    } else if (zoom > 50) {
      majorInterval = 5;
      minorCount = 5;
    } else if (zoom < 20) {
      majorInterval = 30;
      minorCount = 3;
    }

    const minorInterval = majorInterval / minorCount;

    // Start from a rounded time
    const startTime = Math.floor(visibleTimeRange.start / majorInterval) * majorInterval;

    for (let time = startTime; time <= visibleTimeRange.end + majorInterval; time += minorInterval) {
      const isMajor = Math.abs(time % majorInterval) < 0.001;
      marks.push({
        time,
        label: isMajor ? formatTimecode(time, fps).slice(0, 8) : '',
        isMajor,
      });
    }

    return marks;
  }, [visibleTimeRange, zoom, fps]);

  // Handle resize
  useEffect(() => {
    const container = tracksRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !waveformData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const { peaks } = waveformData;
    const samplesPerPixel = peaks.length / timelineWidth;
    const startSample = Math.floor(scrollOffset * samplesPerPixel);
    const endSample = Math.min(
      peaks.length,
      Math.floor((scrollOffset + containerWidth) * samplesPerPixel)
    );

    ctx.fillStyle = '#36d1da';
    ctx.beginPath();

    const centerY = height / 2;
    const barWidth = Math.max(1, containerWidth / (endSample - startSample));

    for (let i = startSample; i < endSample; i++) {
      const x = (i - startSample) * barWidth;
      const amplitude = peaks[i] || 0;
      const barHeight = amplitude * centerY * 0.9;

      ctx.fillRect(x, centerY - barHeight, barWidth - 0.5, barHeight * 2);
    }
  }, [waveformData, timelineWidth, scrollOffset, containerWidth]);

  // Convert x position to time
  const xToTime = useCallback(
    (x: number): number => {
      const time = visibleTimeRange.start + (x / containerWidth) * (visibleTimeRange.end - visibleTimeRange.start);
      return Math.max(0, Math.min(duration, time));
    },
    [visibleTimeRange, containerWidth, duration]
  );

  // Convert time to x position
  const timeToX = useCallback(
    (time: number): number => {
      return ((time - visibleTimeRange.start) / (visibleTimeRange.end - visibleTimeRange.start)) * containerWidth;
    },
    [visibleTimeRange, containerWidth]
  );

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = xToTime(x);
      onSeek(time);
    },
    [xToTime, onSeek]
  );

  // Handle drag seeking
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      handleClick(e);
    },
    [handleClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = xToTime(x);
      onSeek(time);
    },
    [isDragging, xToTime, onSeek]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle wheel for horizontal scroll/zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(10, Math.min(500, zoom * delta));
        onZoomChange?.(newZoom);
      } else {
        // Scroll
        const scrollAmount = (e.deltaX + e.deltaY) / zoom;
        const newStart = Math.max(0, Math.min(duration - (visibleTimeRange.end - visibleTimeRange.start), visibleTimeRange.start + scrollAmount));
        const range = visibleTimeRange.end - visibleTimeRange.start;
        onRangeChange({ start: newStart, end: newStart + range });
      }
    },
    [zoom, duration, visibleTimeRange, onZoomChange, onRangeChange]
  );

  // Get playhead position
  const playheadX = timeToX(currentTime);

  // Filter visible markers
  const visibleMarkers = useMemo(() => {
    return markers.filter(
      (m) => m.time >= visibleTimeRange.start && m.time <= visibleTimeRange.end
    );
  }, [markers, visibleTimeRange]);

  // Calculate total track height
  const totalTrackHeight = useMemo(() => {
    return tracks.filter((t) => t.visible).reduce((sum, t) => sum + t.height, 0);
  }, [tracks]);

  return (
    <TimelineContainer>
      {/* Header */}
      <TimelineHeader>
        <TimeDisplay>
          {formatTimecode(currentTime, fps)}
        </TimeDisplay>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={muted ? 'Unmute' : 'Mute'}>
          <IconButton size="small" onClick={onMuteToggle}>
            {muted ? (
              <VolumeOffIcon sx={{ fontSize: 18, color: '#ff5722' }} />
            ) : (
              <VolumeUpIcon sx={{ fontSize: 18, color: '#19abb5' }} />
            )}
          </IconButton>
        </Tooltip>
        <Typography variant="caption" sx={{ color: '#666', ml: 1 }}>
          {markers.length} markers
        </Typography>
      </TimelineHeader>

      {/* Body */}
      <TimelineBody>
        {/* Track Labels */}
        <TrackLabels>
          <Box sx={{ height: 24 }} /> {/* Ruler placeholder */}
          {tracks.filter((t) => t.visible).map((track) => (
            <TrackLabelItem key={track.id} height={track.height}>
              <Typography variant="caption" sx={{ color: track.color }}>
                {track.label}
              </Typography>
            </TrackLabelItem>
          ))}
        </TrackLabels>

        {/* Tracks */}
        <TracksContainer
          ref={tracksRef}
          onWheel={handleWheel}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Time Ruler */}
          <TimeRuler>
            {rulerMarks.map((mark, index) => {
              const x = timeToX(mark.time);
              if (x < 0 || x > containerWidth) return null;

              return (
                <RulerMark
                  key={index}
                  sx={{
                    left: x,
                    borderLeft: mark.isMajor ? '1px solid #444' : '1px solid #333',
                    height: mark.isMajor ? '100%' : '50%',
                  }}
                >
                  {mark.label && (
                    <Typography
                      variant="caption"
                      sx={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap' }}
                    >
                      {mark.label}
                    </Typography>
                  )}
                </RulerMark>
              );
            })}
          </TimeRuler>

          {/* Tracks Area */}
          <TracksArea
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
          >
            {/* Track Rows */}
            {tracks.filter((t) => t.visible).map((track) => (
              <TrackRow key={track.id} height={track.height} color={track.color}>
                {/* Audio waveform */}
                {track.type === 'audio' && waveformData && (
                  <WaveformCanvas ref={waveformCanvasRef} />
                )}

                {/* Markers track */}
                {track.type === 'markers' && visibleMarkers.map((marker) => {
                  const x = timeToX(marker.time);
                  return (
                    <Tooltip
                      key={marker.id}
                      title={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            {marker.label}
                          </Typography>
                          {marker.notes && (
                            <Typography variant="caption">
                              {marker.notes}
                            </Typography>
                          )}
                          <Typography variant="caption" color="textSecondary">
                            {formatTimecode(marker.time, fps)}
                          </Typography>
                        </Box>
                      }
                      arrow
                    >
                      <MarkerFlag
                        color={marker.color || MARKER_COLORS.default}
                        sx={{ left: x }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkerClick?.(marker);
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </TrackRow>
            ))}

            {/* Playhead */}
            {playheadX >= 0 && playheadX <= containerWidth && (
              <Playhead sx={{ left: playheadX }} />
            )}
          </TracksArea>
        </TracksContainer>
      </TimelineBody>
    </TimelineContainer>
  );
});

VideoTimeline.displayName = 'VideoTimeline';

export default VideoTimeline;
