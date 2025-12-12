/**
 * TimelineTrack Component
 * Displays a row of timeline items for a specific track/layer
 */

import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { TimelineItem, TimeRange, ZoomLevel, DataLayer } from '../../types/timeline';
import { EVIDENCE_TYPE_COLORS, formatDuration, formatTimelineTimestamp } from '../../types/timeline';
import type { EvidenceType } from '../../types/index';

// ============================================================================
// MATERIAL SYMBOL COMPONENT
// ============================================================================

interface MaterialSymbolProps {
  icon: string;
  filled?: boolean;
  size?: number;
  color?: string;
}

const MaterialSymbol: React.FC<MaterialSymbolProps> = ({ icon, filled = false, size = 24, color }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      color: color,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
    }}
  >
    {icon}
  </span>
);

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const TrackContainer = styled(Box)({
  position: 'relative',
  height: 64,
  borderBottom: '1px solid #252525',
  backgroundColor: '#1a1a1a',
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
});

const TrackLabel = styled(Box)({
  position: 'absolute',
  left: 0,
  top: 0,
  width: 140,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 12px',
  backgroundColor: '#151515',
  borderRight: '1px solid #2b2b2b',
  zIndex: 5,
});

const TrackContent = styled(Box)({
  position: 'absolute',
  left: 140,
  top: 0,
  right: 0,
  height: '100%',
  overflow: 'hidden',
});

const ItemsContainer = styled(Box)({
  position: 'relative',
  height: '100%',
});

interface MediaItemProps {
  width: number;
  color: string;
  selected: boolean;
  hovered: boolean;
}

const MediaItem = styled(Box, {
  shouldForwardProp: (prop) =>
    !['width', 'color', 'selected', 'hovered'].includes(prop as string),
})<MediaItemProps>(({ width, color, selected, hovered }) => ({
  position: 'absolute',
  top: 8,
  height: 48,
  width: Math.max(width, 24),
  backgroundColor: `${color}22`,
  border: `1px solid ${selected ? '#19abb5' : hovered ? color : `${color}66`}`,
  borderRadius: 4,
  cursor: 'pointer',
  overflow: 'hidden',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: `${color}33`,
    borderColor: color,
  },
}));

const ItemContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  height: '100%',
  padding: '0 8px',
  overflow: 'hidden',
});

const ItemTitle = styled(Typography)({
  fontSize: '11px',
  fontWeight: 500,
  color: '#e1e1e1',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const ItemMeta = styled(Typography)({
  fontSize: '9px',
  color: '#888',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const FlagIndicator = styled(Box)({
  position: 'absolute',
  top: 2,
  right: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '1px 4px',
  backgroundColor: 'rgba(25, 171, 181, 0.8)',
  borderRadius: 8,
  fontSize: '9px',
  color: '#fff',
});

const EditIndicator = styled(Box)({
  position: 'absolute',
  bottom: 2,
  right: 2,
  width: 14,
  height: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 193, 7, 0.9)',
  borderRadius: '50%',
  '& svg': {
    fontSize: 10,
    color: '#000',
  },
});

const InstantMarker = styled(Box)<{ color: string }>(({ color }) => ({
  position: 'absolute',
  top: 8,
  height: 48,
  width: 3,
  backgroundColor: color,
  borderRadius: 2,
  cursor: 'pointer',
  '&:hover': {
    transform: 'scaleX(1.5)',
  },
}));

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getTypeIcon = (type: EvidenceType): React.ReactNode => {
  const iconProps = { size: 16, color: '#888' };
  switch (type) {
    case 'video':
      return <MaterialSymbol icon="videocam" {...iconProps} />;
    case 'audio':
      return <MaterialSymbol icon="mic" {...iconProps} />;
    case 'photo':
      return <MaterialSymbol icon="photo_camera" {...iconProps} />;
    case 'sensor_reading':
      return <MaterialSymbol icon="sensors" {...iconProps} />;
    case 'thermal':
      return <MaterialSymbol icon="thermostat" {...iconProps} />;
    case 'motion':
      return <MaterialSymbol icon="motion_sensor_active" {...iconProps} />;
    case 'radio_sweep':
      return <MaterialSymbol icon="radio" {...iconProps} />;
    default:
      return <MaterialSymbol icon="photo_camera" {...iconProps} />;
  }
};

const getTypeName = (type: EvidenceType): string => {
  const names: Record<EvidenceType, string> = {
    video: 'Video',
    audio: 'Audio',
    photo: 'Photos',
    sensor_reading: 'Sensor',
    thermal: 'Thermal',
    motion: 'Motion',
    radio_sweep: 'Radio Sweep',
    document: 'Documents',
    other: 'Other',
  };
  return names[type] || type;
};

// ============================================================================
// COMPONENT
// ============================================================================

interface TimelineTrackProps {
  layer: DataLayer;
  items: TimelineItem[];
  timeRange: TimeRange | null;
  zoomLevel: ZoomLevel;
  scrollPosition: number;
  selectedItemId: string | null;
  hoveredItemId: string | null;
  onItemSelect: (itemId: string | null) => void;
  onItemHover: (itemId: string | null) => void;
  onItemDoubleClick: (itemId: string) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  layer,
  items,
  timeRange,
  zoomLevel,
  scrollPosition,
  selectedItemId,
  hoveredItemId,
  onItemSelect,
  onItemHover,
  onItemDoubleClick,
}) => {
  const totalWidth = useMemo(() => {
    if (!timeRange) return 0;
    const durationSec = (timeRange.end - timeRange.start) / 1000;
    return durationSec * zoomLevel.pixelsPerSecond;
  }, [timeRange, zoomLevel]);

  const itemPositions = useMemo(() => {
    if (!timeRange) return [];

    return items.map((item) => {
      const startOffset = ((item.capturedAt - timeRange.start) / 1000) * zoomLevel.pixelsPerSecond;
      const width = item.duration
        ? item.duration * zoomLevel.pixelsPerSecond
        : 24; // Min width for instant items

      return {
        item,
        left: startOffset,
        width,
        isInstant: !item.duration,
      };
    });
  }, [items, timeRange, zoomLevel]);

  if (!layer.visible || items.length === 0) {
    return null;
  }

  return (
    <TrackContainer>
      <TrackLabel>
        <Box
          sx={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: `${layer.color}22`,
            borderRadius: 1,
          }}
        >
          {getTypeIcon(items[0]?.type || 'other')}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontWeight: 500,
              color: '#e1e1e1',
              lineHeight: 1.2,
            }}
          >
            {layer.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontSize: '10px',
              color: '#666',
            }}
          >
            {items.length} item{items.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      </TrackLabel>

      <TrackContent>
        <ItemsContainer
          sx={{
            width: totalWidth,
            transform: `translateX(-${scrollPosition}px)`,
          }}
        >
          {itemPositions.map(({ item, left, width, isInstant }) => {
            const color = EVIDENCE_TYPE_COLORS[item.type];
            const isSelected = selectedItemId === item.id;
            const isHovered = hoveredItemId === item.id;

            if (isInstant) {
              return (
                <InstantMarker
                  key={item.id}
                  color={color}
                  sx={{
                    left,
                    boxShadow: isSelected
                      ? `0 0 0 2px #19abb5`
                      : isHovered
                      ? `0 0 0 1px ${color}`
                      : 'none',
                  }}
                  onClick={() => onItemSelect(item.id)}
                  onMouseEnter={() => onItemHover(item.id)}
                  onMouseLeave={() => onItemHover(null)}
                  onDoubleClick={() => onItemDoubleClick(item.id)}
                />
              );
            }

            return (
              <MediaItem
                key={item.id}
                width={width}
                color={color}
                selected={isSelected}
                hovered={isHovered}
                sx={{ left }}
                onClick={() => onItemSelect(item.id)}
                onMouseEnter={() => onItemHover(item.id)}
                onMouseLeave={() => onItemHover(null)}
                onDoubleClick={() => onItemDoubleClick(item.id)}
              >
                <ItemContent>
                  <ItemTitle>{item.title}</ItemTitle>
                  <ItemMeta>
                    {item.duration ? formatDuration(item.duration) : item.fileName}
                  </ItemMeta>
                </ItemContent>

                {item.flagCount > 0 && (
                  <FlagIndicator>
                    <MaterialSymbol icon="flag" size={8} />
                    {item.flagCount}
                  </FlagIndicator>
                )}

                {item.hasEdits && (
                  <EditIndicator>
                    <MaterialSymbol icon="edit" size={10} color="#000" />
                  </EditIndicator>
                )}
              </MediaItem>
            );
          })}
        </ItemsContainer>
      </TrackContent>
    </TrackContainer>
  );
};

export default TimelineTrack;
