import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Badge from '@mui/material/Badge';
import { styled } from '@mui/material/styles';

// Icons for paranormal investigation tools - using outlined/filled variants
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import MicIcon from '@mui/icons-material/Mic';
import MicOutlinedIcon from '@mui/icons-material/MicOutlined';
import WifiTetheringIcon from '@mui/icons-material/WifiTethering';
import TimelineIcon from '@mui/icons-material/Timeline';
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import DeviceThermostatOutlinedIcon from '@mui/icons-material/ThermostatOutlined';
import BlurOnIcon from '@mui/icons-material/BlurOn';
import BlurOnOutlinedIcon from '@mui/icons-material/BlurCircularOutlined';
import RadioIcon from '@mui/icons-material/Radio';
import RadioOutlinedIcon from '@mui/icons-material/RadioOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
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
});

interface Tool {
  id: string;
  icon: React.ReactElement;
  iconOutlined: React.ReactElement;
  label: string;
  tooltip: string;
  badge?: number;
}

const tools: Tool[] = [
  { id: 'photo', icon: <PhotoCameraIcon />, iconOutlined: <PhotoCameraOutlinedIcon />, label: 'Photo Evidence', tooltip: 'Capture and analyze photos' },
  { id: 'video', icon: <VideocamIcon />, iconOutlined: <VideocamOutlinedIcon />, label: 'Video Recording', tooltip: 'Record video evidence' },
  { id: 'audio', icon: <MicIcon />, iconOutlined: <MicOutlinedIcon />, label: 'EVP Recorder', tooltip: 'Electronic Voice Phenomena' },
  { id: 'emf', icon: <WifiTetheringIcon />, iconOutlined: <WifiTetheringIcon />, label: 'EMF Detector', tooltip: 'Electromagnetic field detection' },
  { id: 'analysis', icon: <TimelineIcon />, iconOutlined: <TimelineIcon />, label: 'Data Analysis', tooltip: 'Analyze investigation data' },
  { id: 'thermal', icon: <DeviceThermostatIcon />, iconOutlined: <DeviceThermostatOutlinedIcon />, label: 'Thermal Imaging', tooltip: 'Temperature anomalies' },
  { id: 'motion', icon: <BlurOnIcon />, iconOutlined: <BlurOnOutlinedIcon />, label: 'Motion Detection', tooltip: 'Detect movement patterns' },
  { id: 'spiritbox', icon: <RadioIcon />, iconOutlined: <RadioOutlinedIcon />, label: 'Spirit Box', tooltip: 'Radio frequency sweeping' },
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
                  {selectedTool === tool.id ? tool.icon : tool.iconOutlined}
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
            {selectedTool === 'settings' ? <SettingsIcon /> : <SettingsOutlinedIcon />}
            {expanded && <ToolLabel>Settings</ToolLabel>}
          </Box>
        </ToolButton>
      </Tooltip>
    </StyledActivityBar>
  );
};

export default ActivityBar;