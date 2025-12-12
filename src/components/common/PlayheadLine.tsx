/**
 * PlayheadLine Component
 * A reusable playhead indicator line that shows current playback position
 * Used across Audio Tool, Video Tool, and Timeline
 */

import React from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLAYHEAD_COLOR = '#19abb5';
const PLAYHEAD_GLOW = 'rgba(25, 171, 181, 0.5)';
const LINE_WIDTH = 2;
const TRIANGLE_WIDTH = 8;
const TRIANGLE_HEIGHT = 6;

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const PlayheadContainer = styled(Box)<{ $left: number; $height: number | string }>(
  ({ $left, $height }) => ({
    position: 'absolute',
    top: 0,
    left: $left,
    height: $height,
    width: LINE_WIDTH,
    pointerEvents: 'none',
    zIndex: 10,
    transform: 'translateX(-50%)', // Center the line on the position
  })
);

const PlayheadLineElement = styled(Box)({
  position: 'absolute',
  top: TRIANGLE_HEIGHT, // Start below the triangle
  left: 0,
  width: LINE_WIDTH,
  height: `calc(100% - ${TRIANGLE_HEIGHT}px)`,
  backgroundColor: PLAYHEAD_COLOR,
  boxShadow: `0 0 4px ${PLAYHEAD_GLOW}`,
});

// Triangle indicator at the top of the playhead
const PlayheadTriangle = styled(Box)({
  position: 'absolute',
  top: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: `${TRIANGLE_WIDTH / 2}px solid transparent`,
  borderRight: `${TRIANGLE_WIDTH / 2}px solid transparent`,
  borderTop: `${TRIANGLE_HEIGHT}px solid ${PLAYHEAD_COLOR}`,
  filter: `drop-shadow(0 0 2px ${PLAYHEAD_GLOW})`,
});

// ============================================================================
// TYPES
// ============================================================================

interface PlayheadLineProps {
  /** Width of the timeline container in pixels */
  containerWidth: number;
  /** Total duration in milliseconds (visible duration when zoomed) */
  duration: number;
  /** Height of the line (default: '100%') */
  height?: number | string;
  /** Offset in milliseconds (visible start time when zoomed) */
  offset?: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const PlayheadLine: React.FC<PlayheadLineProps> = ({
  containerWidth,
  duration,
  height = '100%',
  offset = 0,
}) => {
  // Read timestamp from global playhead store
  const timestamp = usePlayheadStore((state) => state.timestamp);

  // Don't render if duration is invalid (prevents division by zero)
  if (duration <= 0) {
    return null;
  }

  // Calculate position relative to visible window (accounting for offset/zoom)
  // timestamp is the global time, offset is the start of the visible window
  const relativeTimestamp = timestamp - offset;

  // Calculate horizontal position within the visible window
  const position = (relativeTimestamp / duration) * containerWidth;

  // Don't render if playhead is outside the visible window
  if (position < 0 || position > containerWidth) {
    return null;
  }

  return (
    <PlayheadContainer $left={position} $height={height}>
      <PlayheadTriangle />
      <PlayheadLineElement />
    </PlayheadContainer>
  );
};

export default PlayheadLine;
