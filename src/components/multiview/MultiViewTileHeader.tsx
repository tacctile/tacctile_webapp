/**
 * MultiViewTileHeader Component
 * Header bar for each tile in the multi-view layout
 * Shows tool name with dropdown to change tool assignment
 */

import React, { useCallback } from 'react';
import { Box, Typography, Select, MenuItem, FormControl, SelectChangeEvent } from '@mui/material';
import { styled } from '@mui/material/styles';
import { MultiViewToolType, TOOL_DISPLAY_NAMES, TOOL_ICONS } from '@/types/multiview';

// Styled components
const HeaderContainer = styled(Box)({
  height: 32,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  gap: 8,
  flexShrink: 0,
});

const ToolIcon = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#19abb5',
});

const StyledSelect = styled(Select)({
  fontSize: 12,
  height: 24,
  minWidth: 120,
  backgroundColor: 'transparent',
  color: '#ccc',
  '& .MuiSelect-select': {
    padding: '2px 8px',
    paddingRight: '24px !important',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiSvgIcon-root': {
    color: '#666',
    fontSize: 18,
  },
});

const StyledMenuItem = styled(MenuItem)({
  fontSize: 12,
  padding: '8px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  '&.Mui-selected': {
    backgroundColor: 'rgba(25, 171, 181, 0.15)',
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.2)',
    },
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const MaterialSymbol: React.FC<{ icon: string; size?: number }> = ({ icon, size = 16 }) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size }}
  >
    {icon}
  </span>
);

interface MultiViewTileHeaderProps {
  tool: MultiViewToolType;
  onToolChange: (tool: MultiViewToolType) => void;
  tileIndex: number;
}

// Available tools for the dropdown
const AVAILABLE_TOOLS: { id: MultiViewToolType; name: string; icon: string }[] = [
  { id: 'video-viewer', name: 'Video Viewer', icon: 'movie' },
  { id: 'audio-viewer', name: 'Audio Viewer', icon: 'graphic_eq' },
  { id: 'timeline', name: 'Timeline', icon: 'calendar_month' },
  { id: 'notes', name: 'Notes', icon: 'sticky_note_2' },
  { id: 'images', name: 'Images', icon: 'photo_library' },
  { id: 'flags', name: 'Flags', icon: 'flag' },
];

export const MultiViewTileHeader: React.FC<MultiViewTileHeaderProps> = ({
  tool,
  onToolChange,
  tileIndex,
}) => {
  const handleChange = useCallback((event: SelectChangeEvent<string>) => {
    const value = event.target.value as MultiViewToolType;
    onToolChange(value || null);
  }, [onToolChange]);

  const currentTool = AVAILABLE_TOOLS.find(t => t.id === tool);
  const displayName = tool ? TOOL_DISPLAY_NAMES[tool] : 'Empty';
  const iconName = tool ? TOOL_ICONS[tool] : 'grid_view';

  return (
    <HeaderContainer>
      <ToolIcon>
        <MaterialSymbol icon={iconName} size={16} />
      </ToolIcon>

      <FormControl size="small">
        <StyledSelect
          value={tool || ''}
          onChange={handleChange}
          displayEmpty
          renderValue={() => displayName}
          MenuProps={{
            PaperProps: {
              sx: {
                backgroundColor: '#252525',
                border: '1px solid #333',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
              },
            },
          }}
        >
          <StyledMenuItem value="">
            <MaterialSymbol icon="grid_view" />
            <span style={{ color: '#888' }}>None</span>
          </StyledMenuItem>
          {AVAILABLE_TOOLS.map((t) => (
            <StyledMenuItem key={t.id} value={t.id}>
              <MaterialSymbol icon={t.icon} />
              {t.name}
            </StyledMenuItem>
          ))}
        </StyledSelect>
      </FormControl>
    </HeaderContainer>
  );
};

export default MultiViewTileHeader;
