/**
 * TopHeaderBar Component
 * Fixed top navigation bar with tool icons, logo, and user controls
 *
 * Layout (~50px height):
 * - Far left: Tacctile logo
 * - Center: Tool navigation icons (evenly spaced)
 * - Far right: Search, Notifications, User avatar
 */

import React from 'react';
import { Box, IconButton, Tooltip, Avatar, Badge } from '@mui/material';
import { styled } from '@mui/material/styles';

// Navigation tool configuration
export interface NavTool {
  id: string;
  icon: string;
  label: string;
  tooltip: string;
}

export const NAV_TOOLS: NavTool[] = [
  { id: 'home', icon: 'home', label: 'Home', tooltip: 'Home - Sessions & Storage' },
  { id: 'session', icon: 'calendar_month', label: 'Session', tooltip: 'Session Timeline' },
  { id: 'video', icon: 'movie', label: 'Video', tooltip: 'Video Analysis' },
  { id: 'audio', icon: 'graphic_eq', label: 'Audio', tooltip: 'Audio Analysis' },
  { id: 'images', icon: 'photo_library', label: 'Images', tooltip: 'Image Analysis' },
  { id: 'streaming', icon: 'cell_tower', label: 'Streaming', tooltip: 'Live Streaming' },
  { id: 'export', icon: 'download', label: 'Export', tooltip: 'Export Data' },
  { id: 'notes', icon: 'sticky_note_2', label: 'Notes', tooltip: 'Case Notes' },
  { id: 'team', icon: 'group', label: 'Team', tooltip: 'Team Collaboration' },
  { id: 'settings', icon: 'settings', label: 'Settings', tooltip: 'Settings' },
];

// Material Symbol component for Google Material Symbols
interface MaterialSymbolProps {
  icon: string;
  filled?: boolean;
  size?: number;
  className?: string;
}

const MaterialSymbol: React.FC<MaterialSymbolProps> = ({ icon, filled = false, size = 24, className }) => (
  <span
    className={`material-symbols-outlined ${className || ''}`}
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
    }}
  >
    {icon}
  </span>
);

// Styled components
const HeaderContainer = styled(Box)({
  height: 50,
  minHeight: 50,
  maxHeight: 50,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px',
  zIndex: 100,
});

const LeftSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const Logo = styled('img')({
  height: 28,
  cursor: 'pointer',
  transition: 'opacity 0.15s ease',
  '&:hover': {
    opacity: 0.85,
  },
});

const CenterSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  flex: 1,
  maxWidth: 800,
});

const NavButton = styled(IconButton)<{ active?: boolean }>(({ active }) => ({
  width: 44,
  height: 44,
  borderRadius: 6,
  color: active ? '#19abb5' : '#808080',
  backgroundColor: active ? 'rgba(25, 171, 181, 0.12)' : 'transparent',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: active ? 'rgba(25, 171, 181, 0.18)' : 'rgba(255, 255, 255, 0.06)',
    color: active ? '#36d1da' : '#19abb5',
  },
  '&:active': {
    backgroundColor: 'rgba(25, 171, 181, 0.24)',
  },
}));

const RightSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const ActionButton = styled(IconButton)({
  width: 36,
  height: 36,
  borderRadius: 4,
  color: '#808080',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    color: '#e1e1e1',
  },
});

const UserAvatar = styled(Avatar)({
  width: 32,
  height: 32,
  backgroundColor: '#19abb5',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'transform 0.15s ease',
  '&:hover': {
    transform: 'scale(1.05)',
  },
});

interface TopHeaderBarProps {
  selectedTool: string;
  onToolSelect: (toolId: string) => void;
  onLogoClick?: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onUserClick?: () => void;
  notificationCount?: number;
  userName?: string;
}

export const TopHeaderBar: React.FC<TopHeaderBarProps> = ({
  selectedTool,
  onToolSelect,
  onLogoClick,
  onSearchClick,
  onNotificationsClick,
  onUserClick,
  notificationCount = 0,
  userName = 'User',
}) => {
  const userInitials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  return (
    <HeaderContainer>
      {/* Left Section - Logo */}
      <LeftSection>
        <Logo
          src="/tacctile_app_main_logo.png"
          alt="Tacctile"
          onClick={onLogoClick || (() => onToolSelect('home'))}
        />
      </LeftSection>

      {/* Center Section - Navigation Icons */}
      <CenterSection>
        {NAV_TOOLS.map((tool) => (
          <Tooltip key={tool.id} title={tool.tooltip} placement="bottom" arrow>
            <NavButton
              active={selectedTool === tool.id}
              onClick={() => onToolSelect(tool.id)}
            >
              <MaterialSymbol
                icon={tool.icon}
                filled={selectedTool === tool.id}
                size={28}
              />
            </NavButton>
          </Tooltip>
        ))}
      </CenterSection>

      {/* Right Section - Actions & User */}
      <RightSection>
        <Tooltip title="Search" placement="bottom">
          <ActionButton onClick={onSearchClick}>
            <MaterialSymbol icon="search" size={20} />
          </ActionButton>
        </Tooltip>

        <Tooltip title="Notifications" placement="bottom">
          <ActionButton onClick={onNotificationsClick}>
            <Badge
              badgeContent={notificationCount}
              color="primary"
              max={99}
              sx={{
                '& .MuiBadge-badge': {
                  backgroundColor: '#19abb5',
                  fontSize: 10,
                  minWidth: 16,
                  height: 16,
                },
              }}
            >
              <MaterialSymbol icon="notifications" size={20} />
            </Badge>
          </ActionButton>
        </Tooltip>

        <Tooltip title={userName} placement="bottom">
          <UserAvatar onClick={onUserClick}>{userInitials}</UserAvatar>
        </Tooltip>
      </RightSection>
    </HeaderContainer>
  );
};

export default TopHeaderBar;
