/**
 * CameraGrid Component
 * Multi-camera grid view (1x1, 2x2, 3x3) for synchronized multi-source viewing
 */

import React, { useCallback, memo, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { styled } from '@mui/material/styles';
import Grid1x1Icon from '@mui/icons-material/CropSquare';
import Grid2x2Icon from '@mui/icons-material/Grid4x4';
import Grid3x3Icon from '@mui/icons-material/GridOn';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import SyncIcon from '@mui/icons-material/Sync';
import SyncDisabledIcon from '@mui/icons-material/SyncDisabled';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import VideocamIcon from '@mui/icons-material/Videocam';
import type { CameraGridLayout, CameraSlot, VideoSource, VideoAdjustments, PlaybackSpeed } from '../../types/video';
import VideoPlayer from './VideoPlayer';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const GridContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#121212',
  overflow: 'hidden',
});

const GridHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 8px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  minHeight: 36,
});

const LayoutSelector = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const LayoutButton = styled(IconButton)<{ active?: boolean }>(({ active }) => ({
  padding: 4,
  borderRadius: 4,
  backgroundColor: active ? 'rgba(25, 171, 181, 0.2)' : 'transparent',
  color: active ? '#19abb5' : '#888',
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.3)' : 'rgba(255, 255, 255, 0.1)',
  },
}));

const GridBody = styled(Box)({
  flex: 1,
  display: 'grid',
  padding: 4,
  gap: 4,
  overflow: 'hidden',
});

const GridCell = styled(Box)<{ active?: boolean }>(({ active }) => ({
  position: 'relative',
  backgroundColor: '#000',
  borderRadius: 4,
  overflow: 'hidden',
  border: active ? '2px solid #19abb5' : '1px solid #333',
  transition: 'border-color 0.15s ease',
  '&:hover': {
    borderColor: active ? '#19abb5' : '#555',
  },
}));

const CellOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  padding: '4px 8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  zIndex: 10,
});

const CellLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  color: '#fff',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '60%',
});

const CellControls = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
});

const CellButton = styled(IconButton)({
  padding: 2,
  '& svg': {
    fontSize: 16,
  },
});

const EmptyCell = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: '#555',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#888',
  },
});

const CellIndex = styled(Typography)({
  position: 'absolute',
  bottom: 4,
  left: 8,
  fontSize: 10,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.5)',
  fontFamily: 'monospace',
});

// ============================================================================
// PROPS
// ============================================================================

interface CameraGridProps {
  /** Grid layout */
  layout: CameraGridLayout;
  /** Camera slots configuration */
  slots: CameraSlot[];
  /** All available video sources */
  sources: VideoSource[];
  /** Currently active slot index (for highlight) */
  activeSlotIndex?: number;
  /** Whether video is playing */
  isPlaying: boolean;
  /** Current playback time */
  currentTime: number;
  /** Playback speed */
  speed: PlaybackSpeed;
  /** Volume */
  volume: number;
  /** Video adjustments */
  adjustments: VideoAdjustments;
  /** Callback when layout changes */
  onLayoutChange: (layout: CameraGridLayout) => void;
  /** Callback when source is assigned to slot */
  onSourceAssign: (slotIndex: number, sourceId: string | null) => void;
  /** Callback when slot sync is toggled */
  onSlotSyncToggle: (slotIndex: number) => void;
  /** Callback when slot mute is toggled */
  onSlotMuteToggle: (slotIndex: number) => void;
  /** Callback when a slot is clicked */
  onSlotClick?: (slotIndex: number) => void;
  /** Callback when time updates from a player */
  onTimeUpdate?: (time: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const CameraGrid: React.FC<CameraGridProps> = memo(({
  layout,
  slots,
  sources,
  activeSlotIndex,
  isPlaying,
  currentTime,
  speed,
  volume,
  adjustments,
  onLayoutChange,
  onSourceAssign,
  onSlotSyncToggle,
  onSlotMuteToggle,
  onSlotClick,
  onTimeUpdate,
}) => {
  const [menuAnchor, setMenuAnchor] = React.useState<null | HTMLElement>(null);
  const [menuSlotIndex, setMenuSlotIndex] = React.useState<number | null>(null);

  // Get grid dimensions
  const gridDimensions = useMemo(() => {
    switch (layout) {
      case '1x1':
        return { cols: 1, rows: 1 };
      case '2x2':
        return { cols: 2, rows: 2 };
      case '3x3':
        return { cols: 3, rows: 3 };
      default:
        return { cols: 1, rows: 1 };
    }
  }, [layout]);

  // Get source for a slot
  const getSourceForSlot = useCallback(
    (slot: CameraSlot): VideoSource | null => {
      if (!slot.sourceId) return null;
      return sources.find((s) => s.id === slot.sourceId) ?? null;
    },
    [sources]
  );

  // Get unassigned sources
  const unassignedSources = useMemo(() => {
    const assignedIds = new Set(slots.filter((s) => s.sourceId).map((s) => s.sourceId));
    return sources.filter((s) => !assignedIds.has(s.id));
  }, [sources, slots]);

  // Handle menu open
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>, slotIndex: number) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuSlotIndex(slotIndex);
  }, []);

  // Handle menu close
  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
    setMenuSlotIndex(null);
  }, []);

  // Handle source selection
  const handleSourceSelect = useCallback(
    (sourceId: string) => {
      if (menuSlotIndex !== null) {
        onSourceAssign(menuSlotIndex, sourceId);
      }
      handleMenuClose();
    },
    [menuSlotIndex, onSourceAssign, handleMenuClose]
  );

  // Handle remove source
  const handleRemoveSource = useCallback(
    (slotIndex: number, event: React.MouseEvent) => {
      event.stopPropagation();
      onSourceAssign(slotIndex, null);
    },
    [onSourceAssign]
  );

  // Render cell content
  const renderCell = useCallback(
    (slot: CameraSlot) => {
      const source = getSourceForSlot(slot);
      const isActive = slot.index === activeSlotIndex;

      if (!source) {
        return (
          <EmptyCell onClick={(e) => handleMenuOpen(e as React.MouseEvent<HTMLElement>, slot.index)}>
            <AddIcon sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="caption">Add Source</Typography>
          </EmptyCell>
        );
      }

      return (
        <>
          <VideoPlayer
            source={source}
            isPlaying={isPlaying && slot.syncEnabled}
            currentTime={currentTime}
            speed={speed}
            volume={slot.muted ? 0 : volume}
            muted={slot.muted}
            loop={false}
            adjustments={adjustments}
            showTimecode={false}
            showFilterBadge={false}
            onTimeUpdate={slot.index === 0 ? onTimeUpdate : undefined}
          />

          {/* Cell Overlay */}
          <CellOverlay>
            <CellLabel>{source.name}</CellLabel>
            <CellControls>
              <Tooltip title={slot.syncEnabled ? 'Synced' : 'Not synced'}>
                <CellButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlotSyncToggle(slot.index);
                  }}
                >
                  {slot.syncEnabled ? (
                    <SyncIcon sx={{ color: '#4caf50' }} />
                  ) : (
                    <SyncDisabledIcon sx={{ color: '#666' }} />
                  )}
                </CellButton>
              </Tooltip>
              <Tooltip title={slot.muted ? 'Unmute' : 'Mute'}>
                <CellButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSlotMuteToggle(slot.index);
                  }}
                >
                  {slot.muted ? (
                    <VolumeOffIcon sx={{ color: '#ff5722' }} />
                  ) : (
                    <VolumeUpIcon sx={{ color: '#19abb5' }} />
                  )}
                </CellButton>
              </Tooltip>
              <Tooltip title="Remove">
                <CellButton
                  size="small"
                  onClick={(e) => handleRemoveSource(slot.index, e)}
                >
                  <CloseIcon sx={{ color: '#888' }} />
                </CellButton>
              </Tooltip>
            </CellControls>
          </CellOverlay>

          {/* Cell Index */}
          <CellIndex>CAM {slot.index + 1}</CellIndex>
        </>
      );
    },
    [
      getSourceForSlot,
      activeSlotIndex,
      isPlaying,
      currentTime,
      speed,
      volume,
      adjustments,
      handleMenuOpen,
      handleRemoveSource,
      onSlotSyncToggle,
      onSlotMuteToggle,
      onTimeUpdate,
    ]
  );

  return (
    <GridContainer>
      {/* Header */}
      <GridHeader>
        <Typography variant="subtitle2" sx={{ fontWeight: 500, color: '#888' }}>
          Camera Grid
        </Typography>
        <LayoutSelector>
          <Tooltip title="Single View (1x1)">
            <LayoutButton
              active={layout === '1x1'}
              onClick={() => onLayoutChange('1x1')}
            >
              <Grid1x1Icon sx={{ fontSize: 18 }} />
            </LayoutButton>
          </Tooltip>
          <Tooltip title="Quad View (2x2)">
            <LayoutButton
              active={layout === '2x2'}
              onClick={() => onLayoutChange('2x2')}
            >
              <Grid2x2Icon sx={{ fontSize: 18 }} />
            </LayoutButton>
          </Tooltip>
          <Tooltip title="Nine View (3x3)">
            <LayoutButton
              active={layout === '3x3'}
              onClick={() => onLayoutChange('3x3')}
            >
              <Grid3x3Icon sx={{ fontSize: 18 }} />
            </LayoutButton>
          </Tooltip>
        </LayoutSelector>
      </GridHeader>

      {/* Grid Body */}
      <GridBody
        sx={{
          gridTemplateColumns: `repeat(${gridDimensions.cols}, 1fr)`,
          gridTemplateRows: `repeat(${gridDimensions.rows}, 1fr)`,
        }}
      >
        {slots.slice(0, gridDimensions.cols * gridDimensions.rows).map((slot) => (
          <GridCell
            key={slot.index}
            active={slot.index === activeSlotIndex}
            onClick={() => onSlotClick?.(slot.index)}
          >
            {renderCell(slot)}
          </GridCell>
        ))}
      </GridBody>

      {/* Source Selection Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            border: '1px solid #333',
            minWidth: 200,
          },
        }}
      >
        {sources.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="textSecondary">
              No video sources available
            </Typography>
          </MenuItem>
        ) : (
          sources.map((source) => {
            const isAssigned = slots.some((s) => s.sourceId === source.id);
            return (
              <MenuItem
                key={source.id}
                onClick={() => handleSourceSelect(source.id)}
                disabled={isAssigned}
                sx={{
                  opacity: isAssigned ? 0.5 : 1,
                }}
              >
                <ListItemIcon>
                  <VideocamIcon sx={{ color: isAssigned ? '#555' : '#19abb5' }} />
                </ListItemIcon>
                <ListItemText
                  primary={source.name}
                  secondary={`${source.width}x${source.height} • ${source.fps}fps`}
                  primaryTypographyProps={{ fontSize: 13 }}
                  secondaryTypographyProps={{ fontSize: 11 }}
                />
              </MenuItem>
            );
          })
        )}
      </Menu>
    </GridContainer>
  );
});

CameraGrid.displayName = 'CameraGrid';

export default CameraGrid;
