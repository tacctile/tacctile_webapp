/**
 * StreamingToolbar Component
 * Toolbar with streaming controls, view modes, and status indicators
 */

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { styled } from '@mui/material/styles';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import TvIcon from '@mui/icons-material/Tv';
import SettingsIcon from '@mui/icons-material/Settings';
import CellTowerIcon from '@mui/icons-material/CellTower';

import type { StreamingMode, ViewMode } from '../../types/streaming';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Toolbar = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #2b2b2b',
  gap: 8,
  flexWrap: 'wrap',
});

const ToolbarGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const ToolbarDivider = styled(Divider)({
  height: 24,
  borderColor: '#2b2b2b',
  margin: '0 8px',
});

const StyledToggleButton = styled(ToggleButton)({
  border: 'none',
  padding: '4px 8px',
  color: '#888888',
  '&.Mui-selected': {
    backgroundColor: 'rgba(25, 171, 181, 0.2)',
    color: '#19abb5',
    '&:hover': {
      backgroundColor: 'rgba(25, 171, 181, 0.3)',
    },
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const StreamButton = styled(Button)<{ streaming?: boolean }>(({ streaming }) => ({
  minWidth: 120,
  backgroundColor: streaming ? '#f44336' : '#19abb5',
  color: '#ffffff',
  fontWeight: 600,
  '&:hover': {
    backgroundColor: streaming ? '#d32f2f' : '#36d1da',
  },
}));

const RecordButton = styled(Button)<{ recording?: boolean }>(({ recording }) => ({
  minWidth: 100,
  backgroundColor: recording ? '#f44336' : '#333333',
  color: '#ffffff',
  fontWeight: 600,
  '&:hover': {
    backgroundColor: recording ? '#d32f2f' : '#444444',
  },
}));

const TransitionButton = styled(Button)({
  minWidth: 100,
  backgroundColor: '#6c5ce7',
  color: '#ffffff',
  fontWeight: 600,
  '&:hover': {
    backgroundColor: '#5b4cdb',
  },
  '&.Mui-disabled': {
    backgroundColor: '#333333',
    color: '#666666',
  },
});

const StatusIndicator = styled(Box)<{ status: 'live' | 'recording' | 'idle' }>(({ status }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 12px',
  borderRadius: 4,
  backgroundColor:
    status === 'live'
      ? 'rgba(244, 67, 54, 0.2)'
      : status === 'recording'
      ? 'rgba(255, 152, 0, 0.2)'
      : 'rgba(76, 175, 80, 0.2)',
  border: `1px solid ${
    status === 'live' ? '#f44336' : status === 'recording' ? '#ff9800' : '#4caf50'
  }`,
}));

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 14,
  fontWeight: 600,
  color: '#e1e1e1',
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface StreamingToolbarProps {
  mode: StreamingMode;
  viewMode: ViewMode;
  isStreaming: boolean;
  isRecording: boolean;
  streamStartTime: Date | null;
  recordingStartTime: Date | null;
  onModeChange: (mode: StreamingMode) => void;
  onViewModeChange: (viewMode: ViewMode) => void;
  onStartStreaming: () => void;
  onStopStreaming: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onTransition: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const StreamingToolbar: React.FC<StreamingToolbarProps> = ({
  mode,
  viewMode,
  isStreaming,
  isRecording,
  streamStartTime,
  recordingStartTime,
  onModeChange,
  onViewModeChange,
  onStartStreaming,
  onStopStreaming,
  onStartRecording,
  onStopRecording,
  onTransition,
}) => {
  const [streamDuration, setStreamDuration] = useState('00:00:00');
  const [recordDuration, setRecordDuration] = useState('00:00:00');

  // Update durations
  useEffect(() => {
    const interval = setInterval(() => {
      if (streamStartTime) {
        const diff = Date.now() - new Date(streamStartTime).getTime();
        setStreamDuration(formatDuration(diff));
      }
      if (recordingStartTime) {
        const diff = Date.now() - new Date(recordingStartTime).getTime();
        setRecordDuration(formatDuration(diff));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [streamStartTime, recordingStartTime]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours.toString().padStart(2, '0')}:${(minutes % 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const handleModeChange = (_: React.MouseEvent<HTMLElement>, newMode: StreamingMode | null) => {
    if (newMode) {
      onModeChange(newMode);
    }
  };

  const handleViewModeChange = (_: React.MouseEvent<HTMLElement>, newViewMode: ViewMode | null) => {
    if (newViewMode) {
      onViewModeChange(newViewMode);
    }
  };

  return (
    <Toolbar>
      {/* Mode Selection */}
      <ToolbarGroup>
        <Typography variant="caption" sx={{ color: '#888888', mr: 1 }}>
          Mode:
        </Typography>
        <ToggleButtonGroup value={mode} exclusive onChange={handleModeChange} size="small">
          <StyledToggleButton value="setup">
            <Tooltip title="Setup Mode">
              <SettingsIcon sx={{ fontSize: 18, mr: 0.5 }} />
            </Tooltip>
            Setup
          </StyledToggleButton>
          <StyledToggleButton value="preview">
            <Tooltip title="Preview Mode">
              <TvIcon sx={{ fontSize: 18, mr: 0.5 }} />
            </Tooltip>
            Preview
          </StyledToggleButton>
          <StyledToggleButton value="live">
            <Tooltip title="Live Mode">
              <CellTowerIcon sx={{ fontSize: 18, mr: 0.5 }} />
            </Tooltip>
            Live
          </StyledToggleButton>
        </ToggleButtonGroup>
      </ToolbarGroup>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* View Mode */}
      <ToolbarGroup>
        <Typography variant="caption" sx={{ color: '#888888', mr: 1 }}>
          View:
        </Typography>
        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewModeChange} size="small">
          <StyledToggleButton value="program">
            <Tooltip title="Program Only">
              <ViewAgendaIcon sx={{ fontSize: 18 }} />
            </Tooltip>
          </StyledToggleButton>
          <StyledToggleButton value="studio">
            <Tooltip title="Studio Mode (Preview + Program)">
              <ViewModuleIcon sx={{ fontSize: 18 }} />
            </Tooltip>
          </StyledToggleButton>
        </ToggleButtonGroup>
      </ToolbarGroup>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Transition Button */}
      <TransitionButton
        variant="contained"
        startIcon={<SwapHorizIcon />}
        onClick={onTransition}
        disabled={viewMode !== 'studio' || !isStreaming}
      >
        Transition
      </TransitionButton>

      <Box sx={{ flex: 1 }} />

      {/* Status Indicators */}
      {isStreaming && (
        <StatusIndicator status="live">
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#f44336',
              animation: 'pulse 1s infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1 },
                '50%': { opacity: 0.5 },
              },
            }}
          />
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#f44336' }}>
            LIVE
          </Typography>
          <TimeDisplay>{streamDuration}</TimeDisplay>
        </StatusIndicator>
      )}

      {isRecording && (
        <StatusIndicator status="recording">
          <FiberManualRecordIcon sx={{ fontSize: 16, color: '#ff9800' }} />
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#ff9800' }}>
            REC
          </Typography>
          <TimeDisplay>{recordDuration}</TimeDisplay>
        </StatusIndicator>
      )}

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Stream Controls */}
      <ToolbarGroup>
        <RecordButton
          variant="contained"
          recording={isRecording}
          startIcon={isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
          onClick={isRecording ? onStopRecording : onStartRecording}
        >
          {isRecording ? 'Stop' : 'Record'}
        </RecordButton>

        <StreamButton
          variant="contained"
          streaming={isStreaming}
          startIcon={isStreaming ? <StopIcon /> : <PlayArrowIcon />}
          onClick={isStreaming ? onStopStreaming : onStartStreaming}
        >
          {isStreaming ? 'End Stream' : 'Go Live'}
        </StreamButton>
      </ToolbarGroup>
    </Toolbar>
  );
};

export default StreamingToolbar;
