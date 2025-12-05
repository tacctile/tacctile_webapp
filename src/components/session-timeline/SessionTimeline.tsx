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

import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import { FlagsTrack } from './FlagMarker';
import { DataLayerToggle, LayerPills } from './DataLayerToggle';
import { ClockSyncDialog, ClockSyncBanner } from './ClockSyncDialog';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';

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
import { usePlayheadStore } from '../../stores/usePlayheadStore';

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

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 32,
  textAlign: 'center',
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

const FullHeightPlayhead = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: 2,
  backgroundColor: '#19abb5',
  pointerEvents: 'none',
  zIndex: 100,
  boxShadow: '0 0 8px rgba(25, 171, 181, 0.5)',
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
  const [layerPanelCollapsed, setLayerPanelCollapsed] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  // Global playhead store
  const globalTimestamp = usePlayheadStore((state) => state.timestamp);

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
        setContainerWidth(containerRef.current.clientWidth - 140);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

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

  // Convert timeline items to evidence items for EvidenceBank
  const evidenceItems = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    return safeItems
      .filter((item) => ['video', 'audio', 'image'].includes(item.type))
      .map((item): EvidenceItem => ({
        id: item.id,
        type: item.type as 'video' | 'audio' | 'image',
        fileName: item.fileName,
        duration: item.duration,
        capturedAt: item.capturedAt,
        user: item.user || 'Unknown',
        deviceInfo: item.deviceInfo,
        flagCount: item.flagCount,
        hasFindings: item.hasEdits || item.flagCount > 0,
      }));
  }, [items]);

  // Calculate playhead pixel position from global timestamp
  const playheadPixelPosition = useMemo(() => {
    if (!timeRange || globalTimestamp === null) return null;
    return ((globalTimestamp - timeRange.start) / 1000) * zoomLevel.pixelsPerSecond;
  }, [timeRange, globalTimestamp, zoomLevel]);

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

  // Create the inspector panel content
  const inspectorPanel = (
    <Box sx={{ padding: 2 }}>
      {selectedEvidence ? (
        <>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#e1e1e1', mb: 2 }}>
            {selectedEvidence.fileName}
          </Typography>
          <Box sx={{ fontSize: 12, color: '#888' }}>
            {/* Basic metadata display */}
            <Box sx={{ py: 0.5, borderBottom: '1px solid #252525', display: 'flex', justifyContent: 'space-between' }}>
              <span>Type</span>
              <span style={{ color: '#e1e1e1', textTransform: 'capitalize' }}>{selectedEvidence.type}</span>
            </Box>
            <Box sx={{ py: 0.5, borderBottom: '1px solid #252525', display: 'flex', justifyContent: 'space-between' }}>
              <span>User</span>
              <span style={{ color: '#e1e1e1' }}>{selectedEvidence.user}</span>
            </Box>
            <Box sx={{ py: 0.5, borderBottom: '1px solid #252525', display: 'flex', justifyContent: 'space-between' }}>
              <span>Device</span>
              <span style={{ color: '#e1e1e1' }}>{selectedEvidence.deviceInfo || '—'}</span>
            </Box>
            {selectedEvidence.duration && (
              <Box sx={{ py: 0.5, borderBottom: '1px solid #252525', display: 'flex', justifyContent: 'space-between' }}>
                <span>Duration</span>
                <span style={{ color: '#e1e1e1' }}>{formatDuration(selectedEvidence.duration)}</span>
              </Box>
            )}
            <Box sx={{ py: 0.5, borderBottom: '1px solid #252525', display: 'flex', justifyContent: 'space-between' }}>
              <span>Captured</span>
              <span style={{ color: '#e1e1e1' }}>{formatTimelineTimestamp(selectedEvidence.capturedAt, 'short')}</span>
            </Box>
            <Box sx={{ py: 0.5, borderBottom: '1px solid #252525', display: 'flex', justifyContent: 'space-between' }}>
              <span>Flags</span>
              <span style={{ color: '#19abb5' }}>{selectedEvidence.flagCount || 0}</span>
            </Box>
            <Box sx={{ py: 0.5, display: 'flex', justifyContent: 'space-between' }}>
              <span>Findings</span>
              <span style={{ color: selectedEvidence.hasFindings ? '#19abb5' : '#666' }}>
                {selectedEvidence.hasFindings ? 'Yes' : 'No'}
              </span>
            </Box>
          </Box>
        </>
      ) : (
        <Typography sx={{ color: '#666', fontSize: 13, textAlign: 'center', mt: 4 }}>
          Select evidence to view metadata
        </Typography>
      )}
    </Box>
  );

  return (
    <WorkspaceLayout
      evidencePanel={
        <EvidenceBank
          items={evidenceItems}
          selectedId={selectedEvidence?.id}
          onSelect={(item) => setSelectedEvidence(item)}
          onDoubleClick={(item) => {
            // TODO: Navigate to appropriate tool
            console.log('Open in tool:', item.type, item.fileName);
          }}
        />
      }
      inspectorPanel={inspectorPanel}
      mainContent={
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
            {/* Full-height playhead overlay */}
            {playheadPixelPosition !== null && (
              <FullHeightPlayhead
                sx={{
                  left: `${140 + playheadPixelPosition - scrollPosition}px`,
                }}
              />
            )}

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
      }
      evidenceTitle="Evidence"
      inspectorTitle="Metadata"
      showTransport={true}
    />
  );
};

export default SessionTimeline;
