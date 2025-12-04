/**
 * TimelineTrack Component
 * Displays a row of timeline items for a specific track/layer
 */

import React, { useMemo } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import SensorsIcon from '@mui/icons-material/Sensors';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import MotionPhotosOnIcon from '@mui/icons-material/MotionPhotosOn';
import RadioIcon from '@mui/icons-material/Radio';
import FlagIcon from '@mui/icons-material/Flag';
import EditIcon from '@mui/icons-material/Edit';
import type { TimelineItem, TimeRange, ZoomLevel, DataLayer } from '../../types/session';
import { EVIDENCE_TYPE_COLORS, formatDuration, formatTimelineTimestamp } from '../../types/session';
import type { EvidenceType } from '../../types/index';

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
  const iconProps = { sx: { fontSize: 16, color: '#888' } };
  switch (type) {
    case 'video':
      return <VideocamIcon {...iconProps} />;
    case 'audio':
      return <MicIcon {...iconProps} />;
    case 'photo':
      return <PhotoCameraIcon {...iconProps} />;
    case 'emf_reading':
      return <SensorsIcon {...iconProps} />;
    case 'thermal':
      return <ThermostatIcon {...iconProps} />;
    case 'motion':
      return <MotionPhotosOnIcon {...iconProps} />;
    case 'spirit_box':
      return <RadioIcon {...iconProps} />;
    default:
      return <PhotoCameraIcon {...iconProps} />;
  }
};

const getTypeName = (type: EvidenceType): string => {
  const names: Record<EvidenceType, string> = {
    video: 'Video',
    audio: 'Audio',
    photo: 'Photos',
    emf_reading: 'EMF',
    thermal: 'Thermal',
    motion: 'Motion',
    spirit_box: 'Spirit Box',
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
                <Tooltip
                  key={item.id}
                  title={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#aaa' }}>
                        {formatTimelineTimestamp(item.capturedAt, 'full')}
                      </Typography>
                      {item.flagCount > 0 && (
                        <Typography variant="caption" sx={{ display: 'block', color: '#19abb5' }}>
                          {item.flagCount} flag{item.flagCount !== 1 ? 's' : ''}
                        </Typography>
                      )}
                    </Box>
                  }
                  placement="top"
                  arrow
                >
                  <InstantMarker
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
                </Tooltip>
              );
            }

            return (
              <Tooltip
                key={item.id}
                title={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
                      {formatTimelineTimestamp(item.capturedAt, 'full')}
                    </Typography>
                    {item.duration && (
                      <Typography variant="caption" sx={{ color: '#aaa', display: 'block' }}>
                        Duration: {formatDuration(item.duration)}
                      </Typography>
                    )}
                    {item.flagCount > 0 && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#19abb5' }}>
                        {item.flagCount} flag{item.flagCount !== 1 ? 's' : ''}
                      </Typography>
                    )}
                    {item.deviceInfo && (
                      <Typography variant="caption" sx={{ display: 'block', color: '#666' }}>
                        Device: {item.deviceInfo}
                      </Typography>
                    )}
                  </Box>
                }
                placement="top"
                arrow
              >
                <MediaItem
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
                      <FlagIcon sx={{ fontSize: 8 }} />
                      {item.flagCount}
                    </FlagIndicator>
                  )}

                  {item.hasEdits && (
                    <EditIndicator>
                      <EditIcon />
                    </EditIndicator>
                  )}
                </MediaItem>
              </Tooltip>
            );
          })}
        </ItemsContainer>
      </TrackContent>
    </TrackContainer>
  );
};

export default TimelineTrack;
