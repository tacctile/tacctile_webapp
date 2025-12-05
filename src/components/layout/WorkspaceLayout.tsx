import React, { useState, useCallback, ReactNode } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { TransportControls } from '@/components/common';

// Layout constants
const EVIDENCE_PANEL_WIDTH = 280;
const INSPECTOR_PANEL_WIDTH = 300;
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
  backgroundColor: '#161616',
  borderColor: '#2b2b2b',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease',
}));

const LeftPanel = styled(Panel)({
  borderRight: '1px solid #2b2b2b',
});

const RightPanel = styled(Panel)({
  borderLeft: '1px solid #2b2b2b',
});

const PanelHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  minHeight: 40,
});

const PanelTitle = styled('span')({
  fontSize: '12px',
  fontWeight: 600,
  color: '#e1e1e1',
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
  width: COLLAPSED_WIDTH,
  minWidth: COLLAPSED_WIDTH,
  maxWidth: COLLAPSED_WIDTH,
  backgroundColor: '#161616',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 8,
});

const CollapseButton = styled(IconButton)({
  color: '#888',
  padding: 4,
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

interface WorkspaceLayoutProps {
  // Panel content
  evidencePanel?: ReactNode;
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
        {/* Left Panel - Evidence Bank */}
        {evidencePanel && (
          evidenceCollapsed ? (
            <CollapsedPanel sx={{ borderRight: '1px solid #2b2b2b' }}>
              <Tooltip title={`Show ${evidenceTitle}`} placement="right">
                <CollapseButton onClick={toggleEvidence} size="small">
                  <ChevronRightIcon fontSize="small" />
                </CollapseButton>
              </Tooltip>
            </CollapsedPanel>
          ) : (
            <LeftPanel width={EVIDENCE_PANEL_WIDTH}>
              <PanelHeader>
                <PanelTitle>{evidenceTitle}</PanelTitle>
                <Tooltip title={`Hide ${evidenceTitle}`}>
                  <CollapseButton onClick={toggleEvidence} size="small">
                    <ChevronLeftIcon fontSize="small" />
                  </CollapseButton>
                </Tooltip>
              </PanelHeader>
              <PanelContent>
                {evidencePanel}
              </PanelContent>
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
