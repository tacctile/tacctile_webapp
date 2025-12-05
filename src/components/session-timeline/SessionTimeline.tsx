/**
 * SessionTimeline Component
 * Main component for the Session Overview - chronological "truth" view of all investigation media
 *
 * Features:
 * - Chronological view of ALL media (video, audio, images, sensor logs)
 * - Files placed automatically based on metadata timestamps
 * - Read-only view - cannot edit, move, or trim files
 * - Shows aggregated flags/findings from all tools
 * - Visual indicators for files that have edits/findings
 * - Toggle data layers on/off
 */

import React, { useEffect, useRef, useCallback, useState, useMemo, memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import { FlagsTrack } from './FlagMarker';
import { DataLayerToggle, LayerPills } from './DataLayerToggle';
import { ClockSyncDialog, ClockSyncBanner } from './ClockSyncDialog';

import {
  useSessionTimelineStore,
  selectTimelineItems,
  selectVisibleItems,
  selectDataLayers,
  selectZoomLevel,
  selectTimeRange,
  selectSelectedItem,
  selectPlayheadPosition,
  selectClockSyncPrompt,
  selectTimelineLoading,
  selectTimelineError,
  selectInvestigationTitle,
} from '../../stores/useSessionTimelineStore';

import { ZOOM_LEVELS, EVIDENCE_TYPE_TO_LAYER, formatTimelineTimestamp, formatDuration } from '../../types/session';
import type { TimelineItem, TimelineItemFlag, DataLayerType } from '../../types/session';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const TimelineContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#121212',
  color: '#e1e1e1',
  overflow: 'hidden',
});

const Toolbar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 16px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  gap: 8,
  flexShrink: 0,
});

const ToolbarSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const ToolbarDivider = styled(Divider)({
  height: 24,
  margin: '0 8px',
  borderColor: '#2b2b2b',
});

const MainContent = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const TimelineArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const TracksContainer = styled(Box)({
  flex: 1,
  overflow: 'auto',
  position: 'relative',
  '&::-webkit-scrollbar': {
    width: 8,
    height: 8,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 4,
    '&:hover': {
      backgroundColor: '#444',
    },
  },
});

const SidePanel = styled(Box)({
  width: 280,
  backgroundColor: '#161616',
  borderLeft: '1px solid #2b2b2b',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const SidePanelHeader = styled(Box)({
  padding: '12px 16px',
  backgroundColor: '#151515',
  borderBottom: '1px solid #2b2b2b',
});

const SidePanelContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 16,
});

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 32,
  textAlign: 'center',
});

const ItemDetailsPanel = styled(Box)({
  padding: 16,
});

const DetailRow = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '8px 0',
  borderBottom: '1px solid #252525',
  '&:last-child': {
    borderBottom: 'none',
  },
});

const StatusBadge = styled(Box)<{ type: 'info' | 'warning' | 'success' }>(({ type }) => {
  const colors = {
    info: { bg: 'rgba(25, 171, 181, 0.15)', color: '#19abb5' },
    warning: { bg: 'rgba(234, 179, 8, 0.15)', color: '#eab308' },
    success: { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' },
  };
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 4,
    backgroundColor: colors[type].bg,
    color: colors[type].color,
    fontSize: '11px',
    fontWeight: 500,
  };
});

// ============================================================================
// COMPONENT
// ============================================================================

interface SessionTimelineProps {
  investigationId?: string;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({
  investigationId = 'demo-investigation',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const [layerPanelCollapsed, setLayerPanelCollapsed] = useState(false);

  // Store state
  const items = useSessionTimelineStore(selectTimelineItems);
  const visibleItems = useSessionTimelineStore(selectVisibleItems);
  const dataLayers = useSessionTimelineStore(selectDataLayers);
  const zoomLevel = useSessionTimelineStore(selectZoomLevel);
  const timeRange = useSessionTimelineStore(selectTimeRange);
  const selectedItem = useSessionTimelineStore(selectSelectedItem);
  const playheadPosition = useSessionTimelineStore(selectPlayheadPosition);
  const clockSyncPrompt = useSessionTimelineStore(selectClockSyncPrompt);
  const isLoading = useSessionTimelineStore(selectTimelineLoading);
  const error = useSessionTimelineStore(selectTimelineError);
  const investigationTitle = useSessionTimelineStore(selectInvestigationTitle);
  const selectedItemId = useSessionTimelineStore((state) => state.selectedItemId);
  const hoveredItemId = useSessionTimelineStore((state) => state.hoveredItemId);

  // Store actions - use useShallow to get stable references
  const {
    loadTimeline,
    refreshTimeline,
    importFromHub,
    setZoomLevel,
    zoomIn,
    zoomOut,
    fitToView,
    toggleDataLayer,
    showAllLayers,
    hideAllLayers,
    selectItem,
    setHoveredItem,
    setPlayheadPosition,
    acknowledgeClockSync,
    verifyDeviceClock,
  } = useSessionTimelineStore(
    useShallow((state) => ({
      loadTimeline: state.loadTimeline,
      refreshTimeline: state.refreshTimeline,
      importFromHub: state.importFromHub,
      setZoomLevel: state.setZoomLevel,
      zoomIn: state.zoomIn,
      zoomOut: state.zoomOut,
      fitToView: state.fitToView,
      toggleDataLayer: state.toggleDataLayer,
      showAllLayers: state.showAllLayers,
      hideAllLayers: state.hideAllLayers,
      selectItem: state.selectItem,
      setHoveredItem: state.setHoveredItem,
      setPlayheadPosition: state.setPlayheadPosition,
      acknowledgeClockSync: state.acknowledgeClockSync,
      verifyDeviceClock: state.verifyDeviceClock,
    }))
  );

  // Scroll state
  const [scrollPosition, setScrollPosition] = useState(0);

  // Ref to track if we've already initiated loading for current investigationId
  const loadedInvestigationRef = useRef<string | null>(null);

  // Load timeline on mount - with guard to prevent duplicate calls
  useEffect(() => {
    // Skip if we've already loaded this investigation
    if (loadedInvestigationRef.current === investigationId) return;

    loadedInvestigationRef.current = investigationId;
    loadTimeline(investigationId);
  }, [investigationId, loadTimeline]); // loadTimeline is now stable via useShallow

  // Update container width on resize
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth - (sidePanelCollapsed ? 0 : 280) - 140);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [sidePanelCollapsed]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, []);

  // Group items by layer type
  const itemsByLayer = useMemo(() => {
    const grouped: Record<DataLayerType, TimelineItem[]> = {
      video: [],
      audio: [],
      photo: [],
      emf: [],
      thermal: [],
      motion: [],
      spirit_box: [],
      flags: [],
      user_markers: [],
    };

    // Ensure visibleItems is an array
    const safeVisibleItems = Array.isArray(visibleItems) ? visibleItems : [];
    safeVisibleItems.forEach((item) => {
      const layerType = EVIDENCE_TYPE_TO_LAYER[item.type];
      if (layerType && grouped[layerType]) {
        grouped[layerType].push(item);
      }
    });

    return grouped;
  }, [visibleItems]);

  // Aggregate all flags
  const allFlags = useMemo(() => {
    const flags: TimelineItemFlag[] = [];
    // Ensure items is an array
    const safeItems = Array.isArray(items) ? items : [];
    safeItems.forEach((item) => {
      // Ensure item.flags is an array before spreading
      const itemFlags = Array.isArray(item.flags) ? item.flags : [];
      flags.push(...itemFlags);
    });
    return flags.sort((a, b) => a.absoluteTimestamp - b.absoluteTimestamp);
  }, [items]);

  // Handle item double-click (open in tool)
  const handleItemDoubleClick = useCallback((itemId: string) => {
    // Ensure items is an array
    const safeItems = Array.isArray(items) ? items : [];
    const item = safeItems.find((i) => i.id === itemId);
    if (item) {
      // TODO: Navigate to appropriate tool with this evidence
      console.log('Open in tool:', item);
    }
  }, [items]);

  // Handle ruler click (set playhead)
  const handleRulerClick = useCallback((timestamp: number) => {
    setPlayheadPosition(timestamp);
  }, [setPlayheadPosition]);

  // Clock sync dialog
  const [clockSyncDialogOpen, setClockSyncDialogOpen] = useState(false);

  useEffect(() => {
    if (clockSyncPrompt.shown && !clockSyncPrompt.acknowledged) {
      setClockSyncDialogOpen(true);
    }
  }, [clockSyncPrompt.shown, clockSyncPrompt.acknowledged]);

  // Render
  const safeItems = Array.isArray(items) ? items : [];
  if (isLoading && safeItems.length === 0) {
    return (
      <TimelineContainer>
        <EmptyState>
          <CircularProgress sx={{ color: '#19abb5', mb: 2 }} />
          <Typography variant="body1" sx={{ color: '#888' }}>
            Loading timeline...
          </Typography>
        </EmptyState>
      </TimelineContainer>
    );
  }

  if (error) {
    return (
      <TimelineContainer>
        <EmptyState>
          <Alert severity="error" sx={{ maxWidth: 400 }}>
            {error}
          </Alert>
          <Button
            variant="outlined"
            onClick={() => loadTimeline(investigationId)}
            sx={{ mt: 2, color: '#19abb5', borderColor: '#19abb5' }}
          >
            Retry
          </Button>
        </EmptyState>
      </TimelineContainer>
    );
  }

  return (
    <TimelineContainer ref={containerRef}>
      {/* Toolbar */}
      <Toolbar>
        <ToolbarSection>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e1e1e1' }}>
            Session Timeline
          </Typography>
          <StatusBadge type="info">
            <AccessTimeIcon sx={{ fontSize: 12 }} />
            Truth View
          </StatusBadge>
        </ToolbarSection>

        <ToolbarDivider orientation="vertical" />

        {/* Zoom controls */}
        <ToolbarSection>
          <Tooltip title="Zoom out">
            <IconButton
              size="small"
              onClick={zoomOut}
              disabled={zoomLevel.id === ZOOM_LEVELS[ZOOM_LEVELS.length - 1].id}
              sx={{ color: '#888' }}
            >
              <ZoomOutIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <ToggleButtonGroup
            value={zoomLevel.id}
            exclusive
            onChange={(_, value) => {
              if (value) {
                const level = ZOOM_LEVELS.find((z) => z.id === value);
                if (level) setZoomLevel(level);
              }
            }}
            size="small"
          >
            {ZOOM_LEVELS.map((level) => (
              <ToggleButton
                key={level.id}
                value={level.id}
                sx={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: '#888',
                  borderColor: '#333',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(25, 171, 181, 0.2)',
                    color: '#19abb5',
                    borderColor: '#19abb5',
                  },
                }}
              >
                {level.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Tooltip title="Zoom in">
            <IconButton
              size="small"
              onClick={zoomIn}
              disabled={zoomLevel.id === ZOOM_LEVELS[0].id}
              sx={{ color: '#888' }}
            >
              <ZoomInIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Fit to view">
            <IconButton size="small" onClick={fitToView} sx={{ color: '#888' }}>
              <FitScreenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ToolbarSection>

        <ToolbarDivider orientation="vertical" />

        {/* Layer pills */}
        <ToolbarSection sx={{ flex: 1, overflow: 'hidden' }}>
          <LayerPills layers={dataLayers} onToggleLayer={toggleDataLayer} />
        </ToolbarSection>

        <ToolbarDivider orientation="vertical" />

        {/* Actions */}
        <ToolbarSection>
          <Tooltip title="Import from Hub">
            <IconButton size="small" onClick={importFromHub} sx={{ color: '#888' }}>
              <CloudSyncIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <Tooltip title="Refresh timeline">
            <IconButton
              size="small"
              onClick={refreshTimeline}
              disabled={isLoading}
              sx={{ color: '#888' }}
            >
              {isLoading ? (
                <CircularProgress size={18} sx={{ color: '#19abb5' }} />
              ) : (
                <RefreshIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title="Verify device clocks">
            <IconButton
              size="small"
              onClick={() => setClockSyncDialogOpen(true)}
              sx={{ color: clockSyncPrompt.acknowledged ? '#888' : '#eab308' }}
            >
              <AccessTimeIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          <ToolbarDivider orientation="vertical" />

          <Tooltip title={sidePanelCollapsed ? 'Show details panel' : 'Hide details panel'}>
            <IconButton
              size="small"
              onClick={() => setSidePanelCollapsed(!sidePanelCollapsed)}
              sx={{ color: '#888' }}
            >
              {sidePanelCollapsed ? <KeyboardArrowLeftIcon /> : <KeyboardArrowRightIcon />}
            </IconButton>
          </Tooltip>
        </ToolbarSection>
      </Toolbar>

      {/* Clock sync banner */}
      {!clockSyncPrompt.acknowledged && Array.isArray(clockSyncPrompt.devices) && clockSyncPrompt.devices.length > 0 && (
        <Box sx={{ padding: '8px 16px', backgroundColor: '#1a1a1a' }}>
          <ClockSyncBanner
            devices={clockSyncPrompt.devices}
            onOpenDialog={() => setClockSyncDialogOpen(true)}
            onDismiss={acknowledgeClockSync}
          />
        </Box>
      )}

      {/* Main content */}
      <MainContent>
        <TimelineArea>
          {/* Time ruler */}
          <TimelineRuler
            timeRange={timeRange}
            zoomLevel={zoomLevel}
            scrollPosition={scrollPosition}
            containerWidth={containerWidth}
            playheadPosition={playheadPosition}
            onRulerClick={handleRulerClick}
          />

          {/* Tracks */}
          <TracksContainer ref={tracksRef} onScroll={handleScroll}>
            {safeItems.length === 0 ? (
              <EmptyState>
                <InfoOutlinedIcon sx={{ fontSize: 48, color: '#333', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#666', mb: 1 }}>
                  No media in session
                </Typography>
                <Typography variant="body2" sx={{ color: '#555', mb: 2 }}>
                  Import media from your cloud storage or connect the Tacctile Hub
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<CloudSyncIcon />}
                  onClick={importFromHub}
                  sx={{ color: '#19abb5', borderColor: '#19abb5' }}
                >
                  Import from Hub
                </Button>
              </EmptyState>
            ) : (
              <>
                {/* Flags track */}
                <FlagsTrack
                  flags={allFlags}
                  timeRange={timeRange}
                  zoomLevel={zoomLevel}
                  scrollPosition={scrollPosition}
                  visible={dataLayers.find((l) => l.id === 'flags')?.visible ?? true}
                  onFlagClick={(flagId) => console.log('Flag clicked:', flagId)}
                />

                {/* Media tracks */}
                {dataLayers
                  .filter((layer) => layer.id !== 'flags' && layer.id !== 'user_markers')
                  .map((layer) => (
                    <TimelineTrack
                      key={layer.id}
                      layer={layer}
                      items={itemsByLayer[layer.id] || []}
                      timeRange={timeRange}
                      zoomLevel={zoomLevel}
                      scrollPosition={scrollPosition}
                      selectedItemId={selectedItemId}
                      hoveredItemId={hoveredItemId}
                      onItemSelect={selectItem}
                      onItemHover={setHoveredItem}
                      onItemDoubleClick={handleItemDoubleClick}
                    />
                  ))}
              </>
            )}
          </TracksContainer>
        </TimelineArea>

        {/* Side panel */}
        {!sidePanelCollapsed && (
          <SidePanel>
            <SidePanelHeader>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#e1e1e1' }}>
                {selectedItem ? 'Item Details' : 'Session Info'}
              </Typography>
            </SidePanelHeader>

            <SidePanelContent>
              {selectedItem ? (
                <ItemDetailsPanel>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    {selectedItem.title}
                  </Typography>

                  <DetailRow>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Type
                    </Typography>
                    <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                      {selectedItem.type.replace('_', ' ')}
                    </Typography>
                  </DetailRow>

                  <DetailRow>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Captured
                    </Typography>
                    <Typography variant="body2">
                      {formatTimelineTimestamp(selectedItem.capturedAt, 'full')}
                    </Typography>
                  </DetailRow>

                  {selectedItem.duration && (
                    <DetailRow>
                      <Typography variant="caption" sx={{ color: '#888' }}>
                        Duration
                      </Typography>
                      <Typography variant="body2">
                        {formatDuration(selectedItem.duration)}
                      </Typography>
                    </DetailRow>
                  )}

                  <DetailRow>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      File
                    </Typography>
                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                      {selectedItem.fileName}
                    </Typography>
                  </DetailRow>

                  {selectedItem.deviceInfo && (
                    <DetailRow>
                      <Typography variant="caption" sx={{ color: '#888' }}>
                        Device
                      </Typography>
                      <Typography variant="body2">{selectedItem.deviceInfo}</Typography>
                    </DetailRow>
                  )}

                  <DetailRow>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Flags
                    </Typography>
                    <Typography variant="body2">{selectedItem.flagCount}</Typography>
                  </DetailRow>

                  <DetailRow>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Status
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {selectedItem.hasEdits && (
                        <StatusBadge type="warning">Edited</StatusBadge>
                      )}
                      {selectedItem.flagCount > 0 && (
                        <StatusBadge type="info">{selectedItem.flagCount} Flags</StatusBadge>
                      )}
                      {!selectedItem.hasEdits && selectedItem.flagCount === 0 && (
                        <StatusBadge type="success">Unmodified</StatusBadge>
                      )}
                    </Box>
                  </DetailRow>

                  <Box sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={() => handleItemDoubleClick(selectedItem.id)}
                      sx={{
                        color: '#19abb5',
                        borderColor: '#19abb5',
                        '&:hover': {
                          backgroundColor: 'rgba(25, 171, 181, 0.1)',
                        },
                      }}
                    >
                      Open in Tool
                    </Button>
                  </Box>
                </ItemDetailsPanel>
              ) : (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                    {investigationTitle || 'Investigation'}
                  </Typography>

                  <DetailRow>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Total Items
                    </Typography>
                    <Typography variant="body2">{safeItems.length}</Typography>
                  </DetailRow>

                  <DetailRow>
                    <Typography variant="caption" sx={{ color: '#888' }}>
                      Total Flags
                    </Typography>
                    <Typography variant="body2">{Array.isArray(allFlags) ? allFlags.length : 0}</Typography>
                  </DetailRow>

                  {timeRange && (
                    <>
                      <DetailRow>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          Start Time
                        </Typography>
                        <Typography variant="body2">
                          {formatTimelineTimestamp(timeRange.start, 'full')}
                        </Typography>
                      </DetailRow>

                      <DetailRow>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          End Time
                        </Typography>
                        <Typography variant="body2">
                          {formatTimelineTimestamp(timeRange.end, 'full')}
                        </Typography>
                      </DetailRow>

                      <DetailRow>
                        <Typography variant="caption" sx={{ color: '#888' }}>
                          Duration
                        </Typography>
                        <Typography variant="body2">
                          {formatDuration((timeRange.end - timeRange.start) / 1000)}
                        </Typography>
                      </DetailRow>
                    </>
                  )}

                  <Divider sx={{ my: 2, borderColor: '#252525' }} />

                  <DataLayerToggle
                    layers={dataLayers}
                    onToggleLayer={toggleDataLayer}
                    onShowAll={showAllLayers}
                    onHideAll={hideAllLayers}
                    collapsed={layerPanelCollapsed}
                    onToggleCollapsed={() => setLayerPanelCollapsed(!layerPanelCollapsed)}
                  />
                </>
              )}
            </SidePanelContent>
          </SidePanel>
        )}
      </MainContent>

      {/* Clock sync dialog */}
      <ClockSyncDialog
        open={clockSyncDialogOpen}
        devices={Array.isArray(clockSyncPrompt.devices) ? clockSyncPrompt.devices : []}
        onClose={() => setClockSyncDialogOpen(false)}
        onAcknowledge={() => {
          acknowledgeClockSync();
          setClockSyncDialogOpen(false);
        }}
        onVerifyDevice={verifyDeviceClock}
      />
    </TimelineContainer>
  );
};

export default SessionTimeline;
