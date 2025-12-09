/**
 * FlagsViewer Component
 * Simplified flags viewer for multi-view pop-out window
 * Displays session flags with ability to add new flags and jump to timestamps
 */

import React, { useState, useCallback } from 'react';
import { Box, TextField, IconButton, Typography, Button, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { multiViewSyncService } from '@/services/multiview/MultiViewSyncService';

// Styled components
const ViewerContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

const FlagsHeader = styled(Box)({
  height: 40,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #333',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const FlagsContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 12,
});

const FlagItem = styled(Box)({
  padding: 10,
  backgroundColor: '#1a1a1a',
  borderRadius: 4,
  marginBottom: 8,
  border: '1px solid #2a2a2a',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    borderColor: '#19abb5',
    backgroundColor: '#1e1e1e',
  },
});

const FlagIcon = styled(Box)<{ color: string }>(({ color }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  backgroundColor: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}));

const FlagInfo = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const FlagTimestamp = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#19abb5',
});

const FlagLabel = styled(Typography)({
  fontSize: 13,
  color: '#ccc',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const AddFlagSection = styled(Box)({
  borderTop: '1px solid #333',
  padding: 12,
  backgroundColor: '#161616',
});

const ColorPicker = styled(Box)({
  display: 'flex',
  gap: 6,
  marginTop: 8,
  marginBottom: 8,
});

const ColorOption = styled(Box)<{ color: string; selected: boolean }>(({ color, selected }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  backgroundColor: color,
  cursor: 'pointer',
  border: selected ? '2px solid #fff' : '2px solid transparent',
  transition: 'all 0.15s ease',
  '&:hover': {
    transform: 'scale(1.1)',
  },
}));

const PlaceholderContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#555',
  padding: 24,
  textAlign: 'center',
  flex: 1,
});

const MaterialSymbol: React.FC<{ icon: string; size?: number; color?: string }> = ({
  icon,
  size = 20,
  color = 'inherit',
}) => (
  <span
    className="material-symbols-outlined"
    style={{ fontSize: size, color }}
  >
    {icon}
  </span>
);

interface Flag {
  id: string;
  timestamp: number;
  label: string;
  color: string;
  createdAt: Date;
}

interface FlagsViewerProps {
  className?: string;
}

// Available flag colors
const FLAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#19abb5', // teal (brand)
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
];

// Helper to format time
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const FlagsViewer: React.FC<FlagsViewerProps> = ({ className }) => {
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  const [flags, setFlags] = useState<Flag[]>([
    // Demo flags for placeholder
    {
      id: '1',
      timestamp: 5000,
      label: 'Subject enters',
      color: '#22c55e',
      createdAt: new Date(),
    },
    {
      id: '2',
      timestamp: 12000,
      label: 'Audio anomaly',
      color: '#ef4444',
      createdAt: new Date(),
    },
    {
      id: '3',
      timestamp: 25000,
      label: 'Point of interest',
      color: '#19abb5',
      createdAt: new Date(),
    },
  ]);

  const [newFlagLabel, setNewFlagLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState(FLAG_COLORS[4]); // Default to brand teal

  // Add flag at current timestamp
  const handleAddFlag = useCallback(() => {
    if (!newFlagLabel.trim()) return;

    const newFlag: Flag = {
      id: Date.now().toString(),
      timestamp,
      label: newFlagLabel.trim(),
      color: selectedColor,
      createdAt: new Date(),
    };

    setFlags(prev => [...prev, newFlag].sort((a, b) => a.timestamp - b.timestamp));
    setNewFlagLabel('');

    // Broadcast to other windows
    multiViewSyncService.broadcastFlagAdded(newFlag.id, newFlag.timestamp, newFlag.label);
  }, [timestamp, newFlagLabel, selectedColor]);

  // Jump to flag timestamp
  const handleFlagClick = useCallback((flagTimestamp: number) => {
    setTimestamp(flagTimestamp);
  }, [setTimestamp]);

  // Delete flag
  const handleDeleteFlag = useCallback((e: React.MouseEvent, flagId: string) => {
    e.stopPropagation();
    setFlags(prev => prev.filter(f => f.id !== flagId));
    multiViewSyncService.broadcastFlagRemoved(flagId);
  }, []);

  // Handle Enter key to submit
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddFlag();
    }
  }, [handleAddFlag]);

  return (
    <ViewerContainer className={className}>
      {/* Header */}
      <FlagsHeader>
        <MaterialSymbol icon="flag" size={18} />
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>
          Flags
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography sx={{ fontSize: 11, color: '#666' }}>
          {flags.length} flags
        </Typography>
      </FlagsHeader>

      {/* Flags list */}
      <FlagsContent>
        {flags.length === 0 ? (
          <PlaceholderContent>
            <MaterialSymbol icon="flag" size={48} />
            <Typography sx={{ mt: 2, color: '#666', fontSize: 14 }}>
              No flags yet
            </Typography>
            <Typography sx={{ color: '#444', fontSize: 12, mt: 1 }}>
              Add a flag at the current timestamp
            </Typography>
          </PlaceholderContent>
        ) : (
          flags.map((flag) => (
            <FlagItem key={flag.id} onClick={() => handleFlagClick(flag.timestamp)}>
              <FlagIcon color={flag.color}>
                <MaterialSymbol icon="flag" size={14} color="#fff" />
              </FlagIcon>
              <FlagInfo>
                <FlagTimestamp>
                  {formatTime(flag.timestamp)}
                </FlagTimestamp>
                <FlagLabel>
                  {flag.label}
                </FlagLabel>
              </FlagInfo>
              <IconButton
                size="small"
                onClick={(e) => handleDeleteFlag(e, flag.id)}
                sx={{
                  color: '#555',
                  '&:hover': { color: '#ef4444' },
                }}
              >
                <MaterialSymbol icon="close" size={16} />
              </IconButton>
            </FlagItem>
          ))
        )}
      </FlagsContent>

      {/* Add flag section */}
      <AddFlagSection>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Typography sx={{ fontSize: 11, color: '#666' }}>
            Add flag at
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#19abb5', fontFamily: 'monospace' }}>
            {formatTime(timestamp)}
          </Typography>
        </Box>

        <ColorPicker>
          {FLAG_COLORS.map((color) => (
            <ColorOption
              key={color}
              color={color}
              selected={selectedColor === color}
              onClick={() => setSelectedColor(color)}
            />
          ))}
        </ColorPicker>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Flag label..."
            value={newFlagLabel}
            onChange={(e) => setNewFlagLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#1a1a1a',
                fontSize: 13,
                '& fieldset': { borderColor: '#333' },
                '&:hover fieldset': { borderColor: '#444' },
                '&.Mui-focused fieldset': { borderColor: '#19abb5' },
              },
              '& .MuiInputBase-input': { color: '#ccc' },
            }}
          />
          <Button
            variant="contained"
            onClick={handleAddFlag}
            disabled={!newFlagLabel.trim()}
            sx={{
              backgroundColor: selectedColor,
              color: '#fff',
              minWidth: 80,
              '&:hover': {
                backgroundColor: selectedColor,
                filter: 'brightness(1.1)',
              },
              '&.Mui-disabled': {
                backgroundColor: '#333',
                color: '#666',
              },
            }}
          >
            Add
          </Button>
        </Box>
      </AddFlagSection>
    </ViewerContainer>
  );
};

export default FlagsViewer;
