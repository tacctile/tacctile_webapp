/**
 * ToolIconBar Component
 * Horizontal toolbar with tool icons positioned at the top of the content area
 * Icons are centered between left and right panels
 */

import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import { NAV_TOOLS } from './navTools';

// Constants
const BAR_HEIGHT = 44;

// Styled components
const BarContainer = styled(Box)({
  height: BAR_HEIGHT,
  minHeight: BAR_HEIGHT,
  maxHeight: BAR_HEIGHT,
  backgroundColor: '#161616',
  borderBottom: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  padding: '0 8px',
  flexShrink: 0,
});

const ToolButton = styled(IconButton)<{ selected?: boolean }>(({ selected }) => ({
  width: 36,
  height: 36,
  borderRadius: 4,
  color: selected ? '#19abb5' : '#808080',
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.12)' : 'transparent',
  transition: 'all 0.15s ease',
  '& .material-symbols-outlined': {
    fontSize: 20,
  },
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.16)' : 'rgba(255, 255, 255, 0.06)',
    color: selected ? '#19abb5' : '#cccccc',
  },
}));

const ActiveIndicator = styled(Box)({
  position: 'absolute',
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 20,
  height: 2,
  backgroundColor: '#19abb5',
  borderRadius: 1,
});

interface ToolIconBarProps {
  selectedTool: string;
  onToolSelect: (toolId: string) => void;
}

const ToolIconBar: React.FC<ToolIconBarProps> = ({
  selectedTool,
  onToolSelect,
}) => {
  return (
    <BarContainer>
      {NAV_TOOLS.map((tool) => {
        const isSelected = selectedTool === tool.id;
        return (
          <Tooltip key={tool.id} title={tool.tooltip} placement="bottom" arrow>
            <Box sx={{ position: 'relative' }}>
              <ToolButton
                selected={isSelected}
                onClick={() => onToolSelect(tool.id)}
                size="small"
              >
                <span className="material-symbols-outlined">
                  {tool.icon}
                </span>
              </ToolButton>
              {isSelected && <ActiveIndicator />}
            </Box>
          </Tooltip>
        );
      })}
    </BarContainer>
  );
};

export default ToolIconBar;
