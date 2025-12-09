/**
 * BottomBar Component
 * Unified bottom bar with logo, session info, users, sync status, and notifications
 *
 * Layout (left to right):
 * - Logo
 * - Session name
 * - Users indicator
 * - Sync status
 * - Plugin slot (reserved)
 * - Location
 * - Time
 * - Notifications
 */

import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import { styled } from '@mui/material/styles';

// Styled components
const BarContainer = styled(Box)({
  height: 50,
  minHeight: 50,
  maxHeight: 50,
  backgroundColor: '#1a1a1a',
  borderTop: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  padding: '0 16px',
  fontSize: 12,
  color: '#cccccc',
  userSelect: 'none',
  zIndex: 100,
});

const Divider = styled(Box)({
  width: 1,
  height: 28,
  backgroundColor: '#252525',
  margin: '0 12px',
  flexShrink: 0,
});

const BarItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  borderRadius: 4,
  cursor: 'default',
  whiteSpace: 'nowrap',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
});

const Logo = styled('img')({
  height: 38,
  marginRight: 4,
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
  '&:hover': {
    opacity: 0.85,
  },
});

const StatusDot = styled(Box)<{ status: 'synced' | 'syncing' | 'offline' }>(({ status }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: status === 'synced' ? '#4caf50' : status === 'syncing' ? '#ff9800' : '#f44336',
  animation: status === 'syncing' ? 'pulse 1.5s ease-in-out infinite' : 'none',
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.4 },
  },
}));

const PluginSlot = styled(Box)({
  width: 100,
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  fontSize: 10,
});

const IconWrapper = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#808080',
  '& .material-symbols-outlined': {
    fontSize: 18,
  },
});

const NotificationButton = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '4px 8px',
  borderRadius: 4,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
});

interface BottomBarProps {
  sessionName?: string;
  userCount?: number;
  syncStatus?: 'synced' | 'syncing' | 'offline';
  location?: string;
  notificationCount?: number;
  onLogoClick?: () => void;
  onNotificationsClick?: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({
  sessionName = 'Session-3',
  userCount = 3,
  syncStatus = 'synced',
  location = '45.523°N, 122.676°W',
  notificationCount = 2,
  onLogoClick,
  onNotificationsClick,
}) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const getSyncLabel = () => {
    switch (syncStatus) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'offline':
        return 'Offline';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <BarContainer>
      {/* Logo */}
      <Tooltip title="Tacctile" placement="top">
        <Logo
          src="/tacctile_app_main_logo.png"
          alt="Tacctile"
          onClick={onLogoClick}
        />
      </Tooltip>

      <Divider />

      {/* Session Name */}
      <Tooltip title="Current Session" placement="top">
        <BarItem>
          <IconWrapper>
            <span className="material-symbols-outlined">folder</span>
          </IconWrapper>
          <Typography variant="caption" sx={{ color: '#cccccc', fontWeight: 500 }}>
            {sessionName}
          </Typography>
        </BarItem>
      </Tooltip>

      <Divider />

      {/* Users */}
      <Tooltip title="Active Users" placement="top">
        <BarItem>
          <IconWrapper>
            <span className="material-symbols-outlined">person</span>
          </IconWrapper>
          <Typography variant="caption" sx={{ color: '#808080' }}>
            +{userCount}
          </Typography>
        </BarItem>
      </Tooltip>

      <Divider />

      {/* Sync Status */}
      <Tooltip title={`Cloud Status: ${getSyncLabel()}`} placement="top">
        <BarItem>
          <StatusDot status={syncStatus} />
          <Typography variant="caption" sx={{ color: '#808080' }}>
            {getSyncLabel()}
          </Typography>
        </BarItem>
      </Tooltip>

      <Divider />

      {/* Plugin Slot - Reserved Space */}
      <PluginSlot>
        {/* Plugin content will go here */}
      </PluginSlot>

      <Divider />

      {/* Location */}
      <Tooltip title="GPS Location" placement="top">
        <BarItem>
          <IconWrapper>
            <span className="material-symbols-outlined">location_on</span>
          </IconWrapper>
          <Typography variant="caption" sx={{ color: '#808080', fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>
            {location}
          </Typography>
        </BarItem>
      </Tooltip>

      <Divider />

      {/* Time */}
      <Tooltip title="Current Time" placement="top">
        <BarItem>
          <IconWrapper>
            <span className="material-symbols-outlined">schedule</span>
          </IconWrapper>
          <Typography variant="caption" sx={{ color: '#cccccc', fontFamily: '"JetBrains Mono", monospace', fontWeight: 500 }}>
            {formatTime(time)}
          </Typography>
        </BarItem>
      </Tooltip>

      <Divider />

      {/* Notifications */}
      <Tooltip title="Notifications" placement="top">
        <NotificationButton onClick={onNotificationsClick}>
          <Badge
            badgeContent={notificationCount}
            color="primary"
            max={99}
            sx={{
              '& .MuiBadge-badge': {
                backgroundColor: '#19abb5',
                fontSize: 9,
                minWidth: 14,
                height: 14,
                top: 2,
                right: 2,
              },
            }}
          >
            <IconWrapper>
              <span className="material-symbols-outlined">notifications</span>
            </IconWrapper>
          </Badge>
        </NotificationButton>
      </Tooltip>
    </BarContainer>
  );
};

export default BottomBar;
