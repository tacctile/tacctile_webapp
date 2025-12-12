import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

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

const StyledActivityBar = styled(Box)<{ expanded: boolean }>(({ expanded }) => ({
  width: expanded ? 200 : 50,
  backgroundColor: '#181818',
  borderRight: '1px solid #2b2b2b',
  display: 'flex',
  flexDirection: 'column',
  transition: 'width 0.2s ease',
  overflow: 'hidden',
  position: 'relative',
  zIndex: 100,
}));

const ToolButton = styled(IconButton)<{ selected?: boolean }>(({ selected }) => ({
  width: '100%',
  height: 48,
  borderRadius: 0,
  color: selected ? '#19abb5' : '#858585',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.08)' : 'transparent',
  borderLeft: selected ? '2px solid #19abb5' : '2px solid transparent',
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.12)' : 'rgba(25, 171, 181, 0.04)',
    color: selected ? '#36d1da' : '#19abb5',
  },
  '&:active': {
    backgroundColor: 'rgba(25, 171, 181, 0.16)',
    color: '#1b7583',
  },
}));

const ToolLabel = styled('span')({
  marginLeft: 12,
  fontSize: 13,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontFamily: '"Manrope", sans-serif',
});

const SectionDivider = styled(Divider)({
  borderColor: '#2b2b2b',
  margin: '8px 0',
});

interface NavItem {
  id: string;
  icon: string;
  label: string;
  tooltip: string;
  route: string;
}

// TOP SECTION - Tools
const toolsSection: NavItem[] = [
  { id: 'home', icon: 'home', label: 'Home', tooltip: 'Home - Projects & Storage', route: '/home' },
  { id: 'session', icon: 'timeline', label: 'Session', tooltip: 'Session Overview timeline', route: '/session' },
  { id: 'video', icon: 'movie', label: 'Video', tooltip: 'Video analysis tool', route: '/video' },
  { id: 'audio', icon: 'graphic_eq', label: 'Audio', tooltip: 'Audio analysis tool', route: '/audio' },
  { id: 'images', icon: 'image', label: 'Images', tooltip: 'Image analysis tool', route: '/images' },
  { id: 'streaming', icon: 'cell_tower', label: 'Streaming', tooltip: 'Streaming output tool', route: '/streaming' },
  { id: 'workspace-demo', icon: 'view_quilt', label: 'Workspace', tooltip: 'Workspace layout demo', route: '/workspace-demo' },
];

// MIDDLE SECTION
const middleSection: NavItem[] = [
  { id: 'evidence', icon: 'flag', label: 'Evidence', tooltip: 'All flags/findings list', route: '/evidence' },
  { id: 'notes', icon: 'sticky_note_2', label: 'Notes', tooltip: 'Case notes and investigation log', route: '/notes' },
  { id: 'team', icon: 'group', label: 'Team', tooltip: 'Collaborators and permissions', route: '/team' },
  { id: 'export', icon: 'download', label: 'Export', tooltip: 'Generate .tacc/.teck packages', route: '/export' },
];

// BOTTOM SECTION
const bottomSection: NavItem[] = [
  { id: 'settings', icon: 'settings', label: 'Settings', tooltip: 'User preferences, storage connection, subscription', route: '/settings' },
];

interface ActivityBarProps {
  expanded: boolean;
  selectedTool: string;
  onToolSelect: (toolId: string) => void;
  onToggle: () => void;
  compact?: boolean; // For mobile/tablet - horizontal layout
}

const ActivityBar: React.FC<ActivityBarProps> = ({
  expanded,
  selectedTool,
  onToolSelect,
  onToggle,
  compact = false,
}) => {
  // Compact mode renders a horizontal bottom navigation bar for mobile
  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-around',
          alignItems: 'center',
          width: '100%',
          height: 56,
          backgroundColor: '#181818',
          borderTop: '1px solid #2b2b2b',
          overflowX: 'auto',
          overflowY: 'hidden',
          // Hide scrollbar but allow scrolling
          '&::-webkit-scrollbar': { display: 'none' },
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}
      >
        {toolsSection.map((item) => (
          <IconButton
            key={item.id}
            onClick={() => onToolSelect(item.id)}
            sx={{
              flexDirection: 'column',
              padding: '4px 12px',
              minWidth: 64,
              color: selectedTool === item.id ? '#19abb5' : '#858585',
              '&:hover': {
                backgroundColor: 'rgba(25, 171, 181, 0.08)',
              },
            }}
          >
            <MaterialSymbol
              icon={item.icon}
              filled={selectedTool === item.id}
              size={22}
            />
            <Box
              component="span"
              sx={{
                fontSize: 10,
                fontWeight: selectedTool === item.id ? 600 : 400,
                mt: 0.5,
              }}
            >
              {item.label}
            </Box>
          </IconButton>
        ))}
      </Box>
    );
  }
  const renderNavItem = (item: NavItem) => (
    <Tooltip
      key={item.id}
      title={expanded ? '' : item.label}
      placement="right"
      arrow
    >
      <ToolButton
        selected={selectedTool === item.id}
        onClick={() => onToolSelect(item.id)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: expanded ? 'flex-start' : 'center' }}>
          <MaterialSymbol
            icon={item.icon}
            filled={selectedTool === item.id}
            size={22}
          />
          {expanded && <ToolLabel>{item.label}</ToolLabel>}
        </Box>
      </ToolButton>
    </Tooltip>
  );

  return (
    <StyledActivityBar expanded={expanded}>
      {/* Toggle button */}
      <Tooltip title={expanded ? '' : 'Expand menu'} placement="right" arrow>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 0.5 }}>
          <IconButton
            size="small"
            onClick={onToggle}
            sx={{
              color: '#858585',
              '&:hover': { color: '#e1e1e1' },
            }}
          >
            {expanded ? <ChevronLeftIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Tooltip>

      {/* TOP SECTION - Tools */}
      <Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
        {toolsSection.map(renderNavItem)}
      </Box>

      {/* MIDDLE SECTION */}
      <SectionDivider />
      <Box sx={{ overflowY: 'auto', overflowX: 'hidden' }}>
        {middleSection.map(renderNavItem)}
      </Box>

      {/* Spacer to push bottom section down */}
      <Box sx={{ flex: 1 }} />

      {/* BOTTOM SECTION */}
      <SectionDivider />
      <Box sx={{ pb: 1 }}>
        {bottomSection.map(renderNavItem)}
      </Box>
    </StyledActivityBar>
  );
};

export default ActivityBar;
