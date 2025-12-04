import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { styled, alpha } from '@mui/material/styles';

// Icons for the 5 main tools
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import GraphicEqOutlinedIcon from '@mui/icons-material/GraphicEqOutlined';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import SensorsIcon from '@mui/icons-material/Sensors';
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined';
import LiveTvIcon from '@mui/icons-material/LiveTv';
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined';

import { ToolId, TOOL_ROUTES } from '../../types';

const RAIL_WIDTH = 56;

const RailContainer = styled(Box)(({ theme }) => ({
  width: RAIL_WIDTH,
  height: '100%',
  backgroundColor: '#0d0d0d',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  paddingTop: 8,
  paddingBottom: 8,
  gap: 4,
  flexShrink: 0,
}));

const ToolButton = styled(IconButton)<{ selected?: boolean }>(({ theme, selected }) => ({
  width: 44,
  height: 44,
  borderRadius: 8,
  color: selected ? '#19abb5' : '#6b6b6b',
  backgroundColor: selected ? alpha('#19abb5', 0.12) : 'transparent',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: selected ? alpha('#19abb5', 0.18) : alpha('#ffffff', 0.06),
    color: selected ? '#36d1da' : '#a0a0a0',
  },
  '&:active': {
    backgroundColor: alpha('#19abb5', 0.24),
    transform: 'scale(0.95)',
  },
  '& svg': {
    fontSize: 24,
  },
}));

const ActiveIndicator = styled(Box)<{ visible: boolean }>(({ visible }) => ({
  position: 'absolute',
  left: 0,
  width: 3,
  height: 24,
  borderRadius: '0 4px 4px 0',
  backgroundColor: '#19abb5',
  opacity: visible ? 1 : 0,
  transition: 'opacity 0.15s ease',
}));

const ToolWrapper = styled(Box)({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  paddingLeft: 6,
  paddingRight: 6,
});

interface ToolConfig {
  id: ToolId;
  icon: React.ReactElement;
  iconOutlined: React.ReactElement;
  label: string;
  tooltip: string;
}

const tools: ToolConfig[] = [
  {
    id: 'video',
    icon: <VideocamIcon />,
    iconOutlined: <VideocamOutlinedIcon />,
    label: 'Video',
    tooltip: 'Video Tool - DaVinci Resolve-inspired viewer',
  },
  {
    id: 'audio',
    icon: <GraphicEqIcon />,
    iconOutlined: <GraphicEqOutlinedIcon />,
    label: 'Audio',
    tooltip: 'Audio Tool - iZotope RX 11-inspired analyzer',
  },
  {
    id: 'images',
    icon: <PhotoLibraryIcon />,
    iconOutlined: <PhotoLibraryOutlinedIcon />,
    label: 'Images',
    tooltip: 'Images Tool - Adobe Lightroom-inspired editor',
  },
  {
    id: 'sensors',
    icon: <SensorsIcon />,
    iconOutlined: <SensorsOutlinedIcon />,
    label: 'Sensors',
    tooltip: 'Sensors Dashboard - Home Assistant-inspired monitoring',
  },
  {
    id: 'streaming',
    icon: <LiveTvIcon />,
    iconOutlined: <LiveTvOutlinedIcon />,
    label: 'Streaming',
    tooltip: 'Streaming Tool - OBS Studio-inspired broadcast',
  },
];

const LeftRail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getCurrentTool = (): ToolId | null => {
    const route = TOOL_ROUTES.find(r => location.pathname.startsWith(r.path));
    return route?.id || null;
  };

  const currentTool = getCurrentTool();

  const handleToolSelect = (toolId: ToolId) => {
    const route = TOOL_ROUTES.find(r => r.id === toolId);
    if (route) {
      navigate(route.path);
    }
  };

  return (
    <RailContainer>
      {tools.map((tool) => {
        const isSelected = currentTool === tool.id;
        return (
          <ToolWrapper key={tool.id}>
            <ActiveIndicator visible={isSelected} />
            <Tooltip title={tool.tooltip} placement="right" arrow>
              <ToolButton
                selected={isSelected}
                onClick={() => handleToolSelect(tool.id)}
                aria-label={tool.label}
              >
                {isSelected ? tool.icon : tool.iconOutlined}
              </ToolButton>
            </Tooltip>
          </ToolWrapper>
        );
      })}
    </RailContainer>
  );
};

export default LeftRail;
