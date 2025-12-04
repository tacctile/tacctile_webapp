import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { styled, alpha } from '@mui/material/styles';

// Icons
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import { Investigation, User } from '../../types';

const TOP_BAR_HEIGHT = 48;

const TopBarContainer = styled(Box)(({ theme }) => ({
  height: TOP_BAR_HEIGHT,
  backgroundColor: '#141414',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 16,
  paddingRight: 12,
  flexShrink: 0,
  WebkitAppRegion: 'drag', // Allow window dragging on desktop
}));

const LogoSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  WebkitAppRegion: 'no-drag',
});

const AppLogo = styled(Typography)(({ theme }) => ({
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: '-0.02em',
  color: '#ffffff',
  '& span': {
    color: '#19abb5',
  },
}));

const InvestigationSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  WebkitAppRegion: 'no-drag',
});

const InvestigationButton = styled(Box)<{ active?: boolean }>(({ active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  borderRadius: 6,
  backgroundColor: alpha('#ffffff', 0.04),
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: alpha('#ffffff', 0.08),
  },
}));

const StatusIndicator = styled(FiberManualRecordIcon)<{ status: 'active' | 'paused' | 'completed' }>(({ status }) => ({
  fontSize: 10,
  color: status === 'active' ? '#22c55e' : status === 'paused' ? '#f59e0b' : '#6b7280',
}));

const ActionsSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  WebkitAppRegion: 'no-drag',
});

const ActionButton = styled(IconButton)(({ theme }) => ({
  width: 36,
  height: 36,
  color: '#808080',
  '&:hover': {
    color: '#c0c0c0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
  '& svg': {
    fontSize: 20,
  },
}));

const SyncChip = styled(Chip)<{ synced: boolean }>(({ synced }) => ({
  height: 28,
  fontSize: 12,
  backgroundColor: synced ? alpha('#22c55e', 0.12) : alpha('#f59e0b', 0.12),
  color: synced ? '#22c55e' : '#f59e0b',
  border: 'none',
  '& .MuiChip-icon': {
    color: 'inherit',
  },
}));

const UserAvatar = styled(Avatar)(({ theme }) => ({
  width: 32,
  height: 32,
  fontSize: 14,
  fontWeight: 600,
  backgroundColor: '#19abb5',
  cursor: 'pointer',
  '&:hover': {
    boxShadow: `0 0 0 2px ${alpha('#19abb5', 0.3)}`,
  },
}));

interface TopBarProps {
  investigation?: Investigation;
  user?: User;
  onOpenInvestigation?: () => void;
  onOpenSettings?: () => void;
  onOpenNotifications?: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  investigation,
  user,
  onOpenInvestigation,
  onOpenSettings,
  onOpenNotifications,
}) => {
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'offline'>('synced');

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  // Default user for demo
  const currentUser: User = user || {
    id: '1',
    name: 'Investigator',
    role: 'lead',
  };

  // Default investigation for demo
  const currentInvestigation: Investigation = investigation || {
    id: '1',
    name: 'Untitled Investigation',
    location: 'Unknown Location',
    startTime: new Date(),
    status: 'active',
  };

  const getUserInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <TopBarContainer>
      {/* Logo Section */}
      <LogoSection>
        <AppLogo>
          <span>T</span>acctile
        </AppLogo>
        <Divider orientation="vertical" flexItem sx={{ borderColor: '#2b2b2b', mx: 1 }} />
      </LogoSection>

      {/* Investigation Section */}
      <InvestigationSection>
        <Tooltip title="Open Investigation" placement="bottom">
          <InvestigationButton onClick={onOpenInvestigation}>
            <FolderOpenOutlinedIcon sx={{ fontSize: 18, color: '#808080' }} />
            <Typography sx={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>
              {currentInvestigation.name}
            </Typography>
            <StatusIndicator status={currentInvestigation.status} />
            <KeyboardArrowDownIcon sx={{ fontSize: 18, color: '#606060' }} />
          </InvestigationButton>
        </Tooltip>

        {/* Sync Status */}
        <Tooltip title={syncStatus === 'synced' ? 'All changes saved' : 'Syncing...'} placement="bottom">
          <SyncChip
            synced={syncStatus === 'synced'}
            icon={
              syncStatus === 'synced' ? (
                <CloudDoneOutlinedIcon sx={{ fontSize: '16px !important' }} />
              ) : syncStatus === 'syncing' ? (
                <SyncIcon sx={{ fontSize: '16px !important', animation: 'spin 1s linear infinite' }} />
              ) : (
                <CloudOffOutlinedIcon sx={{ fontSize: '16px !important' }} />
              )
            }
            label={syncStatus === 'synced' ? 'Saved' : syncStatus === 'syncing' ? 'Syncing' : 'Offline'}
            size="small"
          />
        </Tooltip>
      </InvestigationSection>

      {/* Actions Section */}
      <ActionsSection>
        <Tooltip title="Notifications" placement="bottom">
          <ActionButton onClick={onOpenNotifications}>
            <NotificationsOutlinedIcon />
          </ActionButton>
        </Tooltip>

        <Tooltip title="Settings" placement="bottom">
          <ActionButton onClick={onOpenSettings}>
            <SettingsOutlinedIcon />
          </ActionButton>
        </Tooltip>

        <Box sx={{ width: 8 }} />

        <Tooltip title={currentUser.name} placement="bottom">
          <UserAvatar onClick={handleUserMenuOpen}>
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt={currentUser.name} style={{ width: '100%', height: '100%' }} />
            ) : (
              getUserInitials(currentUser.name)
            )}
          </UserAvatar>
        </Tooltip>

        {/* User Menu */}
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={handleUserMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{
            sx: {
              mt: 1,
              backgroundColor: '#1e1e1e',
              border: '1px solid #2b2b2b',
              minWidth: 180,
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontWeight: 600, color: '#e0e0e0' }}>{currentUser.name}</Typography>
            <Typography sx={{ fontSize: 12, color: '#808080', textTransform: 'capitalize' }}>
              {currentUser.role}
            </Typography>
          </Box>
          <Divider sx={{ borderColor: '#2b2b2b' }} />
          <MenuItem onClick={handleUserMenuClose} sx={{ fontSize: 13 }}>Profile</MenuItem>
          <MenuItem onClick={handleUserMenuClose} sx={{ fontSize: 13 }}>Team Settings</MenuItem>
          <MenuItem onClick={handleUserMenuClose} sx={{ fontSize: 13 }}>Keyboard Shortcuts</MenuItem>
          <Divider sx={{ borderColor: '#2b2b2b' }} />
          <MenuItem onClick={handleUserMenuClose} sx={{ fontSize: 13, color: '#ef4444' }}>Sign Out</MenuItem>
        </Menu>
      </ActionsSection>
    </TopBarContainer>
  );
};

export default TopBar;
