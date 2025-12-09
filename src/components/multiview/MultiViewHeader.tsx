/**
 * MultiViewHeader Component
 * Minimal header bar for the multi-view pop-out window
 * Shows session name, sync indicator, fullscreen and close buttons
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { multiViewSyncService } from '@/services/multiview/MultiViewSyncService';

// Styled components
const HeaderContainer = styled(Box)({
  height: 40,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 12,
  flexShrink: 0,
  WebkitAppRegion: 'drag', // Allow dragging the window
});

const SessionInfo = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: 1,
});

const SyncIndicator = styled(Box)<{ connected: boolean }>(({ connected }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: connected ? '#22c55e' : '#ef4444',
  boxShadow: connected
    ? '0 0 6px rgba(34, 197, 94, 0.5)'
    : '0 0 6px rgba(239, 68, 68, 0.5)',
}));

const SessionName = styled(Typography)({
  fontSize: 13,
  fontWeight: 500,
  color: '#ccc',
});

const HeaderActions = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  WebkitAppRegion: 'no-drag', // Don't drag when clicking buttons
});

const ActionButton = styled(IconButton)({
  padding: 6,
  color: '#888',
  '&:hover': {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const CloseButton = styled(ActionButton)({
  '&:hover': {
    color: '#fff',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
});

const MaterialSymbol: React.FC<{ icon: string; size?: number }> = ({ icon, size = 20 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size }}
  >
    {icon}
  </span>
);

interface MultiViewHeaderProps {
  sessionName: string;
}

export const MultiViewHeader: React.FC<MultiViewHeaderProps> = ({
  sessionName,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Check sync connection periodically
  useEffect(() => {
    const checkConnection = () => {
      const connected = multiViewSyncService.getIsConnected();
      const timeSinceLastPong = multiViewSyncService.getTimeSinceLastPong();
      // Consider disconnected if no pong in 15 seconds
      setIsConnected(connected && timeSinceLastPong < 15000);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 2000);
    return () => clearInterval(interval);
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Toggle fullscreen
  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Close window
  const handleClose = useCallback(() => {
    window.close();
  }, []);

  return (
    <HeaderContainer>
      <SessionInfo>
        <Tooltip title={isConnected ? 'Synced with main window' : 'Disconnected'}>
          <SyncIndicator connected={isConnected} />
        </Tooltip>
        <SessionName>
          {sessionName || 'Multi-View'}
        </SessionName>
      </SessionInfo>

      <HeaderActions>
        <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
          <ActionButton onClick={handleToggleFullscreen}>
            <MaterialSymbol icon={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} />
          </ActionButton>
        </Tooltip>

        <Tooltip title="Close">
          <CloseButton onClick={handleClose}>
            <MaterialSymbol icon="close" />
          </CloseButton>
        </Tooltip>
      </HeaderActions>
    </HeaderContainer>
  );
};

export default MultiViewHeader;
