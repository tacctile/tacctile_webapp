/**
 * IconRail Component
 * Vertical navigation rail on the left edge of the viewport
 * Contains all tool/navigation icons with tooltips
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Tooltip, Snackbar, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigationStore, ToolType } from '@/stores/useNavigationStore';
import { MultiViewLayoutPicker } from './MultiViewLayoutPicker';

// Navigation tool configuration (same as TopHeaderBar)
interface NavTool {
  id: ToolType;
  icon: string;
  label: string;
  tooltip: string;
}

const NAV_TOOLS: NavTool[] = [
  { id: 'home', icon: 'home', label: 'Home', tooltip: 'Home - Projects & Storage' },
  { id: 'timeline', icon: 'calendar_month', label: 'Timeline', tooltip: 'Project Timeline' },
  { id: 'video', icon: 'movie', label: 'Video', tooltip: 'Video Analysis' },
  { id: 'audio', icon: 'graphic_eq', label: 'Audio', tooltip: 'Audio Analysis' },
  { id: 'images', icon: 'photo_library', label: 'Images', tooltip: 'Image Analysis' },
  { id: 'streaming', icon: 'cell_tower', label: 'Streaming', tooltip: 'Live Streaming' },
  { id: 'export', icon: 'download', label: 'Export', tooltip: 'Export Data' },
  { id: 'notes', icon: 'sticky_note_2', label: 'Notes', tooltip: 'Case Notes' },
  { id: 'team', icon: 'group', label: 'Team', tooltip: 'Team Collaboration' },
];

// Settings is separate - pushed to bottom
const SETTINGS_TOOL: NavTool = {
  id: 'settings',
  icon: 'settings',
  label: 'Settings',
  tooltip: 'Settings',
};

// Material Symbol component for Google Material Symbols
interface MaterialSymbolProps {
  icon: string;
  filled?: boolean;
  size?: number;
}

const MaterialSymbol: React.FC<MaterialSymbolProps> = ({ icon, filled = false, size = 24 }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
    }}
  >
    {icon}
  </span>
);

// Styled components
const RailContainer = styled(Box)({
  position: 'fixed',
  left: 0,
  top: 0,
  width: 56,
  height: 'calc(100vh - 52px)',
  backgroundColor: '#1a1a1a',
  borderRight: '1px solid #2a2a2a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 12,
  zIndex: 1000,
});

const IconsContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  width: '100%',
});

const BottomContainer = styled(Box)({
  marginTop: 'auto',
  paddingBottom: 12,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
});

const IconButton = styled(Box)<{ active?: boolean }>(({ active }) => ({
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 8,
  cursor: 'pointer',
  color: active ? '#19abb5' : '#888',
  backgroundColor: active ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.1)',
    color: active ? '#19abb5' : '#fff',
  },
}));

export const IconRail: React.FC = () => {
  const activeTool = useNavigationStore((state) => state.activeTool);
  const setActiveTool = useNavigationStore((state) => state.setActiveTool);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMultiViewOpen, setIsMultiViewOpen] = useState(false);
  const [liveSyncToast, setLiveSyncToast] = useState(false);

  // Listen for fullscreen changes (including Escape key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToolClick = (toolId: ToolType) => {
    setActiveTool(toolId);
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <RailContainer>
      {/* Main navigation icons */}
      <IconsContainer>
        {NAV_TOOLS.map((tool) => (
          <Tooltip
            key={tool.id}
            title={tool.tooltip}
            placement="right"
            arrow
          >
            <IconButton
              active={activeTool === tool.id}
              onClick={() => handleToolClick(tool.id)}
            >
              <MaterialSymbol
                icon={tool.icon}
                filled={activeTool === tool.id}
                size={24}
              />
            </IconButton>
          </Tooltip>
        ))}

        {/* Live Sync - placeholder for collaboration feature */}
        <Tooltip
          title="Live Sync (Coming Soon)"
          placement="right"
          arrow
        >
          <IconButton
            onClick={() => setLiveSyncToast(true)}
          >
            <MaterialSymbol
              icon="wifi_tethering"
              size={24}
            />
          </IconButton>
        </Tooltip>
      </IconsContainer>

      {/* Bottom icons - Fullscreen, Multi-View, and Settings */}
      <BottomContainer>
        {/* Fullscreen toggle */}
        <Tooltip
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          placement="right"
          arrow
        >
          <IconButton
            onClick={toggleFullscreen}
          >
            <MaterialSymbol
              icon={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              size={24}
            />
          </IconButton>
        </Tooltip>

        {/* Multi-View toggle */}
        <Tooltip
          title="Multi-View"
          placement="right"
          arrow
        >
          <IconButton
            active={isMultiViewOpen}
            onClick={() => setIsMultiViewOpen(true)}
          >
            <MaterialSymbol
              icon="grid_view"
              size={24}
            />
          </IconButton>
        </Tooltip>

        {/* Settings icon */}
        <Tooltip
          title={SETTINGS_TOOL.tooltip}
          placement="right"
          arrow
        >
          <IconButton
            active={activeTool === SETTINGS_TOOL.id}
            onClick={() => handleToolClick(SETTINGS_TOOL.id)}
          >
            <MaterialSymbol
              icon={SETTINGS_TOOL.icon}
              filled={activeTool === SETTINGS_TOOL.id}
              size={24}
            />
          </IconButton>
        </Tooltip>
      </BottomContainer>

      {/* Multi-View Layout Picker Modal */}
      <MultiViewLayoutPicker
        open={isMultiViewOpen}
        onClose={() => setIsMultiViewOpen(false)}
      />

      {/* Live Sync coming soon toast */}
      <Snackbar
        open={liveSyncToast}
        autoHideDuration={4000}
        onClose={() => setLiveSyncToast(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setLiveSyncToast(false)}
          severity="info"
          sx={{
            backgroundColor: '#1e3a3c',
            color: '#fff',
            '& .MuiAlert-icon': {
              color: '#19abb5',
            },
          }}
        >
          Live Sync is coming soon! Real-time collaboration and follow mode will be available in a future update.
        </Alert>
      </Snackbar>
    </RailContainer>
  );
};

export default IconRail;
