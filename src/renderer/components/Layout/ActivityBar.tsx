import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import { styled } from '@mui/material/styles';

// Icons for paranormal investigation tools
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import VideocamIcon from '@mui/icons-material/Videocam';
import MicIcon from '@mui/icons-material/Mic';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import TimelineIcon from '@mui/icons-material/Timeline';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import RadioIcon from '@mui/icons-material/Radio';
import SettingsIcon from '@mui/icons-material/Settings';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';

const StyledActivityBar = styled(Box)<{ expanded: boolean }>(({ theme, expanded }) => ({
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

const ToolButton = styled(IconButton)<{ selected?: boolean }>(({ theme, selected }) => ({
  width: '100%',
  height: 48,
  borderRadius: 0,
  color: selected ? '#e1e1e1' : '#858585',
  backgroundColor: selected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
  borderLeft: selected ? '2px solid #bb86fc' : '2px solid transparent',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: '#e1e1e1',
  },
}));

const ToolLabel = styled('span')({
  marginLeft: 12,
  fontSize: 13,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

interface Tool {
  id: string;
  icon: React.ReactElement;
  label: string;
  tooltip: string;
  badge?: number;
}

const tools: Tool[] = [
  { id: 'photo', icon: <PhotoCameraIcon />, label: 'Photo Evidence', tooltip: 'Capture and analyze photos' },
  { id: 'video', icon: <VideocamIcon />, label: 'Video Recording', tooltip: 'Record video evidence' },
  { id: 'audio', icon: <MicIcon />, label: 'EVP Recorder', tooltip: 'Electronic Voice Phenomena' },
  { id: 'emf', icon: <WifiTetheringIcon />, label: 'EMF Detector', tooltip: 'Electromagnetic field detection' },
  { id: 'analysis', icon: <TimelineIcon />, label: 'Data Analysis', tooltip: 'Analyze investigation data' },
  { id: 'thermal', icon: <DeviceThermostatIcon />, label: 'Thermal Imaging', tooltip: 'Temperature anomalies' },
  { id: 'motion', icon: <BlurOnIcon />, label: 'Motion Detection', tooltip: 'Detect movement patterns' },
  { id: 'spiritbox', icon: <RadioIcon />, label: 'Spirit Box', tooltip: 'Radio frequency sweeping' },
];

interface ActivityBarProps {
  expanded: boolean;
  pinned: boolean;
  selectedTool: string;
  onHover: (hover: boolean) => void;
  onToolSelect: (toolId: string) => void;
  onPinToggle: () => void;
}

const ActivityBar: React.FC<ActivityBarProps> = ({
  expanded,
  pinned,
  selectedTool,
  onHover,
  onToolSelect,
  onPinToggle,
}) => {
  return (
    <StyledActivityBar
      expanded={expanded}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      {/* Pin button */}
      <Box sx={{ display: 'flex', justifyContent: expanded ? 'flex-end' : 'center', p: 0.5 }}>
        <IconButton
          size="small"
          onClick={onPinToggle}
          sx={{
            color: '#858585',
            opacity: expanded ? 1 : 0,
            transition: 'opacity 0.2s',
            '&:hover': { color: '#e1e1e1' },
          }}
        >
          {pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Tools */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {tools.map((tool) => (
          <Tooltip
            key={tool.id}
            title={expanded ? '' : tool.tooltip}
            placement="right"
            arrow
          >
            <ToolButton
              selected={selectedTool === tool.id}
              onClick={() => onToolSelect(tool.id)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: expanded ? 'flex-start' : 'center' }}>
                <Badge
                  badgeContent={tool.badge}
                  color="error"
                  variant="dot"
                  invisible={!tool.badge}
                >
                  {tool.icon}
                </Badge>
                {expanded && <ToolLabel>{tool.label}</ToolLabel>}
              </Box>
            </ToolButton>
          </Tooltip>
        ))}
      </Box>

      <Divider sx={{ borderColor: '#2b2b2b' }} />

      {/* Settings */}
      <Tooltip title={expanded ? '' : 'Settings'} placement="right" arrow>
        <ToolButton onClick={() => onToolSelect('settings')}>
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: expanded ? 'flex-start' : 'center' }}>
            <SettingsIcon />
            {expanded && <ToolLabel>Settings</ToolLabel>}
          </Box>
        </ToolButton>
      </Tooltip>
    </StyledActivityBar>
  );
};

export default ActivityBar;