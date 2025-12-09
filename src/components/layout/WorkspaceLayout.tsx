import React, { useState, useCallback, ReactNode } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TransportControls } from '@/components/common';

// Layout constants
const EVIDENCE_PANEL_WIDTH = 280;
const INSPECTOR_PANEL_WIDTH = 280; // Was 300, now matches left column
const COLLAPSED_WIDTH = 40;

const LayoutContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#121212',
  overflow: 'hidden',
});

const MainRow = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
});

const Panel = styled(Box)<{ width: number }>(({ width }) => ({
  width,
  minWidth: width,
  maxWidth: width,
  backgroundColor: '#181818',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'width 0.15s ease, min-width 0.15s ease, max-width 0.15s ease',
}));

const LeftPanel = styled(Panel)({
  borderRight: '1px solid #252525',
});

const RightPanel = styled(Panel)({
  borderLeft: '1px solid #252525',
});

const PanelHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #252525',
  minHeight: 32,
});

const PanelTitle = styled('span')({
  fontSize: '10px',
  fontWeight: 600,
  color: '#808080',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
});

const PanelContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#1a1a1a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333',
    borderRadius: 3,
  },
});

const CenterArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  minWidth: 0, // Allows flex shrinking
});

const CenterContent = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  position: 'relative',
});

const CollapsedPanel = styled(Box)({
  width: 40,
  minWidth: 40,
  maxWidth: 40,
  backgroundColor: '#181818',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 8,
});

const CollapseButton = styled(IconButton)({
  color: '#808080',
  padding: 6,
  minWidth: 28,
  minHeight: 28,
  borderRadius: 4,
  transition: 'all 0.15s ease',
  '& .MuiSvgIcon-root': {
    fontSize: 20,
  },
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

// ============================================================================
// METADATA INSPECTOR COMPONENT
// ============================================================================

export interface SelectedEvidence {
  id: string;
  type: 'video' | 'audio' | 'image';
  fileName: string;
  duration?: number;
  capturedAt: number;
  user: string;
  deviceInfo?: string;
  flagCount: number;
  hasFindings: boolean;
  // Extended metadata
  fileSize?: number;
  resolution?: string;
  codec?: string;
  gpsLocation?: string;
  hash?: string;
}

export const MetadataInspector: React.FC<{ item: SelectedEvidence | null }> = ({ item }) => {
  if (!item) {
    return (
      <Box sx={{
        padding: 2,
        color: '#666',
        fontSize: '13px',
        textAlign: 'center',
        marginTop: 4,
      }}>
        Select evidence to view metadata
      </Box>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const MetadataRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <Box sx={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '6px 0',
      borderBottom: '1px solid #252525',
    }}>
      <Typography sx={{ fontSize: '12px', color: '#888' }}>{label}</Typography>
      <Typography sx={{ fontSize: '12px', color: '#e1e1e1' }}>{value || '—'}</Typography>
    </Box>
  );

  return (
    <Box sx={{ padding: 2 }}>
      {/* File name header */}
      <Typography sx={{
        fontSize: '14px',
        fontWeight: 600,
        color: '#e1e1e1',
        marginBottom: 2,
        wordBreak: 'break-word',
      }}>
        {item.fileName}
      </Typography>

      {/* Type badge */}
      <Box sx={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 1,
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        marginBottom: 2,
        backgroundColor: item.type === 'video' ? '#c45c5c' : item.type === 'audio' ? '#5a9a6b' : '#5a7fbf',
        color: '#fff',
      }}>
        {item.type}
      </Box>

      {/* Metadata rows */}
      <Box sx={{ marginTop: 2 }}>
        <MetadataRow label="Captured" value={formatDate(item.capturedAt)} />
        <MetadataRow label="User" value={item.user} />
        <MetadataRow label="Device" value={item.deviceInfo} />
        <MetadataRow label="Duration" value={item.duration ? `${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}` : undefined} />
        <MetadataRow label="File Size" value={formatFileSize(item.fileSize)} />
        <MetadataRow label="Resolution" value={item.resolution} />
        <MetadataRow label="Codec" value={item.codec} />
        <MetadataRow label="GPS" value={item.gpsLocation} />
        <MetadataRow label="Flags" value={item.flagCount} />
        <MetadataRow label="SHA-256" value={item.hash?.substring(0, 16) + '...'} />
      </Box>

      {/* Findings indicator */}
      {item.hasFindings && (
        <Box sx={{
          marginTop: 2,
          padding: '8px 12px',
          backgroundColor: 'rgba(25, 171, 181, 0.1)',
          border: '1px solid rgba(25, 171, 181, 0.3)',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}>
          <Box sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#19abb5',
            boxShadow: '0 0 6px #19abb5',
          }} />
          <Typography sx={{ fontSize: '12px', color: '#19abb5' }}>
            Has findings
          </Typography>
        </Box>
      )}
    </Box>
  );
};

interface WorkspaceLayoutProps {
  // Panel content
  evidencePanel?: ReactNode;
  metadataPanel?: ReactNode;
  inspectorPanel?: ReactNode;
  mainContent: ReactNode;
  timelineContent?: ReactNode;

  // Panel titles
  evidenceTitle?: string;
  inspectorTitle?: string;

  // Transport controls
  showTransport?: boolean;

  // Initial collapse state (reads from localStorage by default)
  defaultEvidenceCollapsed?: boolean;
  defaultInspectorCollapsed?: boolean;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  evidencePanel,
  metadataPanel,
  inspectorPanel,
  mainContent,
  timelineContent,
  evidenceTitle = 'Evidence',
  inspectorTitle = 'Inspector',
  showTransport = true,
  defaultEvidenceCollapsed = false,
  defaultInspectorCollapsed = false,
}) => {
  // Panel collapse state - persisted to localStorage
  const [evidenceCollapsed, setEvidenceCollapsed] = useState(() => {
    const stored = localStorage.getItem('tacctile-evidence-collapsed');
    return stored ? JSON.parse(stored) : defaultEvidenceCollapsed;
  });

  const [inspectorCollapsed, setInspectorCollapsed] = useState(() => {
    const stored = localStorage.getItem('tacctile-inspector-collapsed');
    return stored ? JSON.parse(stored) : defaultInspectorCollapsed;
  });

  const toggleEvidence = useCallback(() => {
    setEvidenceCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('tacctile-evidence-collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  const toggleInspector = useCallback(() => {
    setInspectorCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('tacctile-inspector-collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <LayoutContainer>
      <MainRow>
        {/* Left Panel - Evidence Bank + Metadata */}
        {(evidencePanel || metadataPanel) && (
          evidenceCollapsed ? (
            <CollapsedPanel sx={{ borderRight: '1px solid #252525' }}>
              <Tooltip title="Show panel" placement="right">
                <CollapseButton onClick={toggleEvidence} size="small">
                  <ChevronRightIcon fontSize="small" />
                </CollapseButton>
              </Tooltip>
            </CollapsedPanel>
          ) : (
            <LeftPanel width={EVIDENCE_PANEL_WIDTH}>
              {/* Evidence Bank - flexible top section */}
              {evidencePanel && (
                <Box sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }}>
                  <PanelHeader>
                    <PanelTitle>{evidenceTitle}</PanelTitle>
                    <Tooltip title="Hide panel">
                      <CollapseButton onClick={toggleEvidence} size="small">
                        <ChevronLeftIcon fontSize="small" />
                      </CollapseButton>
                    </Tooltip>
                  </PanelHeader>
                  <PanelContent>
                    {evidencePanel}
                  </PanelContent>
                </Box>
              )}

              {/* Metadata - fixed 200px bottom section */}
              {metadataPanel && (
                <Box sx={{
                  height: 200,
                  minHeight: 200,
                  maxHeight: 200,
                  borderTop: '1px solid #252525',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  backgroundColor: '#161616',
                }}>
                  <PanelHeader sx={{ minHeight: 28, padding: '4px 10px' }}>
                    <PanelTitle>Metadata</PanelTitle>
                  </PanelHeader>
                  <Box sx={{ flex: 1, overflow: 'hidden' }}>
                    {metadataPanel}
                  </Box>
                </Box>
              )}
            </LeftPanel>
          )
        )}

        {/* Center - Main Content + Timeline */}
        <CenterArea>
          <CenterContent>
            {mainContent}
          </CenterContent>

          {/* Timeline area (optional, for tools that have timelines) */}
          {timelineContent && (
            <Box sx={{
              borderTop: '1px solid #2b2b2b',
              backgroundColor: '#1a1a1a',
            }}>
              {timelineContent}
            </Box>
          )}
        </CenterArea>

        {/* Right Panel - Inspector */}
        {inspectorPanel && (
          inspectorCollapsed ? (
            <CollapsedPanel sx={{ borderLeft: '1px solid #2b2b2b' }}>
              <Tooltip title={`Show ${inspectorTitle}`} placement="left">
                <CollapseButton onClick={toggleInspector} size="small">
                  <ChevronLeftIcon fontSize="small" />
                </CollapseButton>
              </Tooltip>
            </CollapsedPanel>
          ) : (
            <RightPanel width={INSPECTOR_PANEL_WIDTH}>
              <PanelHeader>
                <PanelTitle>{inspectorTitle}</PanelTitle>
                <Tooltip title={`Hide ${inspectorTitle}`}>
                  <CollapseButton onClick={toggleInspector} size="small">
                    <ChevronRightIcon fontSize="small" />
                  </CollapseButton>
                </Tooltip>
              </PanelHeader>
              <PanelContent>
                {inspectorPanel}
              </PanelContent>
            </RightPanel>
          )
        )}
      </MainRow>

      {/* Transport Controls */}
      {showTransport && <TransportControls />}
    </LayoutContainer>
  );
};

export default WorkspaceLayout;
