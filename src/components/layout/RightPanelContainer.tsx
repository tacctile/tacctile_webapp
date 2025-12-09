/**
 * RightPanelContainer Component
 * Contains the Flags panel (top) and Knox AI Sidekick panel (bottom)
 * Full height from viewport top to bottom bar
 */

import React, { useState, useCallback, Suspense, lazy } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FlagsPanel, { Flag } from '@/components/common/FlagsPanel';

// Lazy load Knox panel for better performance
const AISidekickPanel = lazy(() => import('@/components/ai-sidekick/AISidekickPanel'));

// Constants
const PANEL_WIDTH = 320;
const COLLAPSED_WIDTH = 40;
const FLAGS_HEIGHT = 280; // Fixed height for flags section

// Styled components
const Container = styled(Box)<{ collapsed: boolean }>(({ collapsed }) => ({
  width: collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH,
  minWidth: collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH,
  maxWidth: collapsed ? COLLAPSED_WIDTH : PANEL_WIDTH,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#181818',
  borderLeft: '1px solid #252525',
  transition: 'width 0.15s ease, min-width 0.15s ease, max-width 0.15s ease',
  overflow: 'hidden',
}));

const CollapsedState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 8,
  height: '100%',
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

const FlagsSection = styled(Box)({
  height: FLAGS_HEIGHT,
  minHeight: FLAGS_HEIGHT,
  maxHeight: FLAGS_HEIGHT,
  borderBottom: '1px solid #252525',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

const KnoxSection = styled(Box)({
  flex: 1,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
});

// Demo flags data
const DEMO_FLAGS: Flag[] = [
  {
    id: 'flag-1',
    timestamp: 45200,
    label: 'Suspicious audio segment',
    note: 'Background noise detected that may indicate tampering or splicing.',
    createdBy: 'John Doe',
    createdAt: Date.now() - 3600000,
  },
  {
    id: 'flag-2',
    timestamp: 120500,
    label: 'Key testimony begins',
    note: 'Subject begins describing the events of the evening.',
    createdBy: 'Jane Smith',
    createdAt: Date.now() - 7200000,
  },
  {
    id: 'flag-3',
    timestamp: 245800,
    label: 'Contradiction noted',
    createdBy: 'John Doe',
    createdAt: Date.now() - 1800000,
  },
];

interface RightPanelContainerProps {
  showFlags?: boolean;
  showKnox?: boolean;
  flags?: Flag[];
  onFlagClick?: (flag: Flag) => void;
  onFlagAdd?: () => void;
  onFlagEdit?: (flag: Flag) => void;
  onFlagDelete?: (flagId: string) => void;
}

const RightPanelContainer: React.FC<RightPanelContainerProps> = ({
  showFlags = true,
  showKnox = true,
  flags = DEMO_FLAGS,
  onFlagClick,
  onFlagAdd,
  onFlagEdit,
  onFlagDelete,
}) => {
  // Panel collapse state - persisted to localStorage
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('tacctile-right-panel-collapsed');
    return stored ? JSON.parse(stored) : false;
  });

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('tacctile-right-panel-collapsed', JSON.stringify(next));
      return next;
    });
  }, []);

  // Collapsed state
  if (collapsed) {
    return (
      <Container collapsed={true}>
        <CollapsedState>
          <Tooltip title="Show panel" placement="left">
            <CollapseButton onClick={toggleCollapse} size="small">
              <ChevronLeftIcon fontSize="small" />
            </CollapseButton>
          </Tooltip>

          {/* Collapsed icons for Flags and Knox */}
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            {showFlags && (
              <Tooltip title="Flags" placement="left">
                <Box
                  sx={{
                    color: '#808080',
                    '& .material-symbols-outlined': { fontSize: 20 },
                    padding: '4px',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { color: '#19abb5', backgroundColor: 'rgba(25, 171, 181, 0.1)' },
                  }}
                  onClick={toggleCollapse}
                >
                  <span className="material-symbols-outlined">flag</span>
                </Box>
              </Tooltip>
            )}
            {showKnox && (
              <Tooltip title="Knox AI" placement="left">
                <Box
                  sx={{
                    color: '#808080',
                    '& .material-symbols-outlined': { fontSize: 20 },
                    padding: '4px',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { color: '#19abb5', backgroundColor: 'rgba(25, 171, 181, 0.1)' },
                  }}
                  onClick={toggleCollapse}
                >
                  <span className="material-symbols-outlined">smart_toy</span>
                </Box>
              </Tooltip>
            )}
          </Box>
        </CollapsedState>
      </Container>
    );
  }

  return (
    <Container collapsed={false}>
      {/* Collapse button header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '4px 8px',
          borderBottom: '1px solid #252525',
          backgroundColor: '#161616',
        }}
      >
        <Tooltip title="Hide panel">
          <CollapseButton onClick={toggleCollapse} size="small">
            <ChevronRightIcon fontSize="small" />
          </CollapseButton>
        </Tooltip>
      </Box>

      {/* Flags Panel */}
      {showFlags && (
        <FlagsSection>
          <FlagsPanel
            flags={flags}
            onFlagClick={onFlagClick}
            onFlagAdd={onFlagAdd}
            onFlagEdit={onFlagEdit}
            onFlagDelete={onFlagDelete}
          />
        </FlagsSection>
      )}

      {/* Knox AI Panel */}
      {showKnox && (
        <KnoxSection>
          <Suspense fallback={
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#555',
            }}>
              Loading Knox...
            </Box>
          }>
            <AISidekickPanelEmbedded />
          </Suspense>
        </KnoxSection>
      )}
    </Container>
  );
};

/**
 * Embedded version of AISidekickPanel that doesn't manage its own width
 * (since RightPanelContainer handles that)
 */
const AISidekickPanelEmbedded: React.FC = () => {
  // Import and use the panel content directly
  // For now, we'll use a simplified inline version
  // In production, you'd refactor AISidekickPanel to accept an "embedded" prop
  return (
    <Suspense fallback={null}>
      <AISidekickPanelWrapper />
    </Suspense>
  );
};

// Wrapper to modify the panel styling for embedded use
const AISidekickPanelWrapper: React.FC = () => {
  return (
    <Box sx={{
      height: '100%',
      '& > div': {
        width: '100% !important',
        minWidth: '100% !important',
        borderLeft: 'none !important',
      },
    }}>
      <AISidekickPanel />
    </Box>
  );
};

export default RightPanelContainer;
