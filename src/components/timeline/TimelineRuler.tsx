/**
 * TimelineRuler Component
 * Displays the time axis with tick marks and labels
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { TimeRange, ZoomLevel } from '../../types/timeline';
import { formatTimelineTimestamp } from '../../types/timeline';
import { usePlayheadStore } from '../../stores/usePlayheadStore';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const RulerContainer = styled(Box)({
  position: 'relative',
  height: 40,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  overflow: 'hidden',
  userSelect: 'none',
});

const RulerContent = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  height: '100%',
  display: 'flex',
  alignItems: 'flex-end',
});

const MajorTick = styled(Box)({
  position: 'absolute',
  bottom: 0,
  width: 1,
  height: 16,
  backgroundColor: '#555',
});

const MinorTick = styled(Box)({
  position: 'absolute',
  bottom: 0,
  width: 1,
  height: 8,
  backgroundColor: '#333',
});

const TickLabel = styled(Typography)({
  position: 'absolute',
  bottom: 18,
  fontSize: '10px',
  color: '#888',
  whiteSpace: 'nowrap',
  transform: 'translateX(-50%)',
});

const PlayheadIndicator = styled(Box)({
  position: 'absolute',
  top: 0,
  width: 2,
  height: '100%',
  backgroundColor: '#19abb5',
  transform: 'translateX(-1px)',
  zIndex: 10,
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: -5,
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '8px solid #19abb5',
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface TickMark {
  position: number; // Pixels from left
  timestamp: number; // Unix timestamp
  isMajor: boolean;
  label?: string;
}

const generateTicks = (
  timeRange: TimeRange,
  zoomLevel: ZoomLevel,
  containerWidth: number
): TickMark[] => {
  const ticks: TickMark[] = [];
  const { start, end } = timeRange;
  const durationMs = end - start;
  const durationSec = durationMs / 1000;
  const totalPixels = durationSec * zoomLevel.pixelsPerSecond;

  // Determine tick intervals based on zoom level
  let majorIntervalMs: number;
  let minorIntervalMs: number;
  let labelFormat: 'full' | 'time' | 'date';

  switch (zoomLevel.snapToUnit) {
    case 'second':
      majorIntervalMs = 10 * 1000; // 10 seconds
      minorIntervalMs = 1 * 1000; // 1 second
      labelFormat = 'time';
      break;
    case 'minute':
      majorIntervalMs = 5 * 60 * 1000; // 5 minutes
      minorIntervalMs = 60 * 1000; // 1 minute
      labelFormat = 'time';
      break;
    case 'hour':
    default:
      majorIntervalMs = 60 * 60 * 1000; // 1 hour
      minorIntervalMs = 15 * 60 * 1000; // 15 minutes
      labelFormat = 'full';
      break;
  }

  // Round start time to nearest interval
  const firstMajorTick = Math.ceil(start / majorIntervalMs) * majorIntervalMs;

  // Generate major ticks
  for (let ts = firstMajorTick; ts <= end; ts += majorIntervalMs) {
    const position = ((ts - start) / 1000) * zoomLevel.pixelsPerSecond;
    ticks.push({
      position,
      timestamp: ts,
      isMajor: true,
      label: formatTimelineTimestamp(ts, labelFormat),
    });
  }

  // Generate minor ticks (skip where major ticks exist)
  const firstMinorTick = Math.ceil(start / minorIntervalMs) * minorIntervalMs;
  for (let ts = firstMinorTick; ts <= end; ts += minorIntervalMs) {
    if (ts % majorIntervalMs !== 0) {
      const position = ((ts - start) / 1000) * zoomLevel.pixelsPerSecond;
      ticks.push({
        position,
        timestamp: ts,
        isMajor: false,
      });
    }
  }

  return ticks.sort((a, b) => a.position - b.position);
};

// ============================================================================
// COMPONENT
// ============================================================================

interface TimelineRulerProps {
  timeRange: TimeRange | null;
  zoomLevel: ZoomLevel;
  scrollPosition: number;
  containerWidth: number;
  playheadPosition: number | null;
  onRulerClick?: (timestamp: number) => void;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  timeRange,
  zoomLevel,
  scrollPosition,
  containerWidth,
  playheadPosition,
  onRulerClick,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const rulerRef = useRef<HTMLDivElement>(null);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  const ticks = useMemo(() => {
    if (!timeRange) return [];
    return generateTicks(timeRange, zoomLevel, containerWidth);
  }, [timeRange, zoomLevel, containerWidth]);

  const totalWidth = useMemo(() => {
    if (!timeRange) return 0;
    const durationSec = (timeRange.end - timeRange.start) / 1000;
    return durationSec * zoomLevel.pixelsPerSecond;
  }, [timeRange, zoomLevel]);

  const playheadPixelPosition = useMemo(() => {
    if (!timeRange || playheadPosition === null) return null;
    return ((playheadPosition - timeRange.start) / 1000) * zoomLevel.pixelsPerSecond;
  }, [timeRange, playheadPosition, zoomLevel]);

  const updatePlayheadFromMouse = useCallback((e: React.MouseEvent) => {
    if (!timeRange || !rulerRef.current) return;

    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollPosition;
    const timestamp = timeRange.start + (clickX / zoomLevel.pixelsPerSecond) * 1000;

    // Use global playhead store for smooth updates
    setTimestamp(timestamp);

    // Also call the legacy callback if provided
    if (onRulerClick) {
      onRulerClick(timestamp);
    }
  }, [timeRange, scrollPosition, zoomLevel, setTimestamp, onRulerClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    updatePlayheadFromMouse(e);
  }, [updatePlayheadFromMouse]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    updatePlayheadFromMouse(e);
  }, [isDragging, updatePlayheadFromMouse]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  if (!timeRange) {
    return (
      <RulerContainer>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            fontSize: '12px',
          }}
        >
          No timeline data
        </Box>
      </RulerContainer>
    );
  }

  return (
    <RulerContainer
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      sx={{ cursor: isDragging ? 'grabbing' : 'pointer' }}
    >
      <RulerContent
        sx={{
          width: totalWidth,
          transform: `translateX(-${scrollPosition}px)`,
        }}
      >
        {ticks.map((tick, index) => (
          <React.Fragment key={`${tick.timestamp}-${index}`}>
            {tick.isMajor ? (
              <>
                <MajorTick sx={{ left: tick.position }} />
                {tick.label && <TickLabel sx={{ left: tick.position }}>{tick.label}</TickLabel>}
              </>
            ) : (
              <MinorTick sx={{ left: tick.position }} />
            )}
          </React.Fragment>
        ))}

        {playheadPixelPosition !== null && (
          <PlayheadIndicator sx={{ left: playheadPixelPosition }} />
        )}
      </RulerContent>
    </RulerContainer>
  );
};

export default TimelineRuler;
