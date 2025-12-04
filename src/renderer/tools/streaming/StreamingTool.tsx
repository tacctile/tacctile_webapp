/**
 * StreamingTool - OBS Studio-inspired streaming broadcast tool
 *
 * Features for paranormal investigation streaming:
 * - Multi-source preview and management
 * - Scene composition
 * - RTMP output to YouTube, Twitch, etc.
 * - Investigation overlays
 * - Audio mixing
 * - Recording with streaming
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { styled, alpha } from '@mui/material/styles';

// Icons
import LiveTvIcon from '@mui/icons-material/LiveTv';
import VideocamIcon from '@mui/icons-material/Videocam';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import ImageIcon from '@mui/icons-material/Image';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import WebIcon from '@mui/icons-material/Web';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import YouTubeIcon from '@mui/icons-material/YouTube';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import CropFreeIcon from '@mui/icons-material/CropFree';
import TuneIcon from '@mui/icons-material/Tune';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const ToolContainer = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
});

const ScenesPanel = styled(Box)({
  width: 220,
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const PanelHeader = styled(Box)({
  padding: '12px 16px',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const PanelTitle = styled(Typography)({
  fontSize: 12,
  fontWeight: 600,
  color: '#909090',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
});

const PanelContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
});

const SceneItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  padding: '10px 16px',
  cursor: 'pointer',
  backgroundColor: selected ? alpha('#19abb5', 0.15) : 'transparent',
  borderLeft: selected ? '3px solid #19abb5' : '3px solid transparent',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  '&:hover': {
    backgroundColor: selected ? alpha('#19abb5', 0.2) : alpha('#ffffff', 0.04),
  },
}));

const SourceItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  padding: '8px 12px',
  marginBottom: 2,
  cursor: 'pointer',
  backgroundColor: selected ? alpha('#19abb5', 0.1) : 'transparent',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  '&:hover': {
    backgroundColor: selected ? alpha('#19abb5', 0.15) : alpha('#ffffff', 0.04),
  },
}));

const MainArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const PreviewArea = styled(Box)({
  flex: 1,
  backgroundColor: '#000000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
});

const PreviewPlaceholder = styled(Box)({
  width: '100%',
  maxWidth: 1280,
  aspectRatio: '16/9',
  backgroundColor: '#0a0a0a',
  borderRadius: 4,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  border: '1px solid #1a1a1a',
  position: 'relative',
});

const PreviewOverlay = styled(Box)({
  position: 'absolute',
  top: 16,
  left: 16,
  display: 'flex',
  gap: 8,
});

const LiveBadge = styled(Chip)<{ live?: boolean }>(({ live }) => ({
  height: 24,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor: live ? '#ef4444' : alpha('#ffffff', 0.1),
  color: live ? '#ffffff' : '#808080',
  animation: live ? 'pulse 2s infinite' : 'none',
  '& .MuiChip-icon': {
    color: 'inherit',
    fontSize: 12,
  },
  '@keyframes pulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.7 },
  },
}));

const StatsOverlay = styled(Box)({
  position: 'absolute',
  top: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 4,
});

const StatBadge = styled(Box)({
  padding: '4px 8px',
  backgroundColor: alpha('#000000', 0.7),
  borderRadius: 4,
  fontSize: 11,
  color: '#a0a0a0',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const ControlBar = styled(Box)({
  backgroundColor: '#0f0f0f',
  borderTop: '1px solid #1a1a1a',
  padding: '12px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const ControlSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
});

const StreamButton = styled(Button)<{ streaming?: boolean }>(({ streaming }) => ({
  minWidth: 140,
  backgroundColor: streaming ? '#ef4444' : '#19abb5',
  color: '#ffffff',
  fontWeight: 600,
  '&:hover': {
    backgroundColor: streaming ? '#dc2626' : '#1992a1',
  },
  '& .MuiButton-startIcon': {
    marginRight: 8,
  },
}));

const RecordButton = styled(Button)<{ recording?: boolean }>(({ recording }) => ({
  minWidth: 120,
  backgroundColor: recording ? '#ef4444' : alpha('#ffffff', 0.1),
  color: recording ? '#ffffff' : '#c0c0c0',
  fontWeight: 500,
  '&:hover': {
    backgroundColor: recording ? '#dc2626' : alpha('#ffffff', 0.15),
  },
}));

const MixerPanel = styled(Box)({
  width: 280,
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const MixerChannel = styled(Box)({
  padding: 12,
  borderBottom: '1px solid #1a1a1a',
});

const MixerHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
});

const MeterContainer = styled(Box)({
  display: 'flex',
  gap: 4,
  height: 8,
  marginBottom: 8,
});

const MeterBar = styled(Box)<{ level: number; warning?: boolean }>(({ level, warning }) => ({
  flex: 1,
  height: '100%',
  backgroundColor: '#1a1a1a',
  borderRadius: 2,
  position: 'relative',
  overflow: 'hidden',
  '&::after': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: `${level}%`,
    backgroundColor: warning ? '#ef4444' : level > 70 ? '#f59e0b' : '#22c55e',
    transition: 'width 0.1s ease',
  },
}));

const VolumeSlider = styled(Slider)({
  color: '#19abb5',
  height: 4,
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
  },
});

const OutputPanel = styled(Box)({
  padding: 16,
  borderTop: '1px solid #1a1a1a',
});

const OutputDestination = styled(Box)<{ connected?: boolean }>(({ connected }) => ({
  padding: 12,
  backgroundColor: alpha('#ffffff', 0.04),
  borderRadius: 8,
  border: `1px solid ${connected ? alpha('#22c55e', 0.3) : '#1a1a1a'}`,
  marginBottom: 8,
}));

const SmallIconButton = styled(IconButton)({
  width: 28,
  height: 28,
  color: '#606060',
  '&:hover': {
    color: '#a0a0a0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
});

const StreamingTool: React.FC = () => {
  const [selectedScene, setSelectedScene] = useState(0);
  const [selectedSource, setSelectedSource] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [desktopMuted, setDesktopMuted] = useState(false);

  const scenes = [
    { id: 1, name: 'Main Investigation', active: true },
    { id: 2, name: 'Multi-Camera Grid', active: false },
    { id: 3, name: 'Sensor Dashboard', active: false },
    { id: 4, name: 'Starting Soon', active: false },
    { id: 5, name: 'BRB', active: false },
  ];

  const sources = [
    { id: 1, name: 'Camera 1 - Main Hall', type: 'camera', visible: true, locked: false },
    { id: 2, name: 'Camera 2 - Basement', type: 'camera', visible: true, locked: false },
    { id: 3, name: 'Sensor Overlay', type: 'overlay', visible: true, locked: true },
    { id: 4, name: 'Investigation Timer', type: 'text', visible: true, locked: false },
    { id: 5, name: 'Tacctile Watermark', type: 'image', visible: true, locked: true },
  ];

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'camera': return <VideocamIcon sx={{ fontSize: 16 }} />;
      case 'screen': return <ScreenShareIcon sx={{ fontSize: 16 }} />;
      case 'image': return <ImageIcon sx={{ fontSize: 16 }} />;
      case 'text': return <TextFieldsIcon sx={{ fontSize: 16 }} />;
      case 'overlay': return <WebIcon sx={{ fontSize: 16 }} />;
      default: return <VideocamIcon sx={{ fontSize: 16 }} />;
    }
  };

  return (
    <ToolContainer>
      {/* Scenes Panel */}
      <ScenesPanel>
        <PanelHeader>
          <PanelTitle>Scenes</PanelTitle>
          <SmallIconButton>
            <AddIcon sx={{ fontSize: 18 }} />
          </SmallIconButton>
        </PanelHeader>
        <PanelContent>
          {scenes.map((scene, index) => (
            <SceneItem
              key={scene.id}
              selected={selectedScene === index}
              onClick={() => setSelectedScene(index)}
            >
              <LiveTvIcon sx={{ fontSize: 18, color: selectedScene === index ? '#19abb5' : '#505050' }} />
              <Typography
                sx={{
                  fontSize: 13,
                  color: selectedScene === index ? '#e0e0e0' : '#909090',
                  flex: 1,
                }}
              >
                {scene.name}
              </Typography>
            </SceneItem>
          ))}
        </PanelContent>

        <Divider sx={{ borderColor: '#1a1a1a' }} />

        <PanelHeader>
          <PanelTitle>Sources</PanelTitle>
          <SmallIconButton>
            <AddIcon sx={{ fontSize: 18 }} />
          </SmallIconButton>
        </PanelHeader>
        <PanelContent sx={{ p: 1 }}>
          {sources.map((source, index) => (
            <SourceItem
              key={source.id}
              selected={selectedSource === index}
              onClick={() => setSelectedSource(index)}
            >
              <DragIndicatorIcon sx={{ fontSize: 14, color: '#404040', cursor: 'grab' }} />
              {getSourceIcon(source.type)}
              <Typography
                sx={{
                  fontSize: 12,
                  color: selectedSource === index ? '#e0e0e0' : '#808080',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {source.name}
              </Typography>
              <SmallIconButton sx={{ width: 24, height: 24 }}>
                {source.visible ? (
                  <VisibilityIcon sx={{ fontSize: 14 }} />
                ) : (
                  <VisibilityOffIcon sx={{ fontSize: 14 }} />
                )}
              </SmallIconButton>
              <SmallIconButton sx={{ width: 24, height: 24 }}>
                {source.locked ? (
                  <LockIcon sx={{ fontSize: 14 }} />
                ) : (
                  <LockOpenIcon sx={{ fontSize: 14 }} />
                )}
              </SmallIconButton>
            </SourceItem>
          ))}
        </PanelContent>
      </ScenesPanel>

      {/* Main Preview Area */}
      <MainArea>
        <PreviewArea>
          <PreviewPlaceholder>
            <PreviewOverlay>
              <LiveBadge
                live={isStreaming}
                icon={isStreaming ? <FiberManualRecordIcon /> : undefined}
                label={isStreaming ? 'LIVE' : 'OFFLINE'}
              />
              {isRecording && (
                <Chip
                  icon={<FiberManualRecordIcon sx={{ fontSize: '12px !important', color: '#ef4444' }} />}
                  label="REC"
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: 11,
                    backgroundColor: alpha('#ffffff', 0.1),
                    color: '#ef4444',
                  }}
                />
              )}
            </PreviewOverlay>

            <StatsOverlay>
              <StatBadge>
                <SignalCellularAltIcon sx={{ fontSize: 14 }} />
                3500 kbps
              </StatBadge>
              <StatBadge>
                <AccessTimeIcon sx={{ fontSize: 14 }} />
                {isStreaming ? '01:23:45' : '00:00:00'}
              </StatBadge>
            </StatsOverlay>

            <LiveTvIcon sx={{ fontSize: 64, color: '#252525' }} />
            <Typography sx={{ color: '#404040', fontSize: 14 }}>
              OBS Studio-inspired Stream Preview
            </Typography>
            <Typography sx={{ color: '#303030', fontSize: 12 }}>
              Multi-source management with RTMP output
            </Typography>
          </PreviewPlaceholder>
        </PreviewArea>

        {/* Control Bar */}
        <ControlBar>
          <ControlSection>
            <StreamButton
              streaming={isStreaming}
              startIcon={isStreaming ? <StopIcon /> : <CloudUploadIcon />}
              onClick={() => setIsStreaming(!isStreaming)}
            >
              {isStreaming ? 'End Stream' : 'Start Streaming'}
            </StreamButton>
            <RecordButton
              recording={isRecording}
              startIcon={isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
              onClick={() => setIsRecording(!isRecording)}
            >
              {isRecording ? 'Stop' : 'Record'}
            </RecordButton>
          </ControlSection>

          <ControlSection>
            <Tooltip title="Preview Mode">
              <SmallIconButton>
                <AspectRatioIcon />
              </SmallIconButton>
            </Tooltip>
            <Tooltip title="Studio Mode">
              <SmallIconButton>
                <CropFreeIcon />
              </SmallIconButton>
            </Tooltip>
            <Tooltip title="Stream Settings">
              <SmallIconButton>
                <TuneIcon />
              </SmallIconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <SmallIconButton>
                <SettingsIcon />
              </SmallIconButton>
            </Tooltip>
          </ControlSection>

          <ControlSection>
            <Typography sx={{ fontSize: 12, color: '#606060' }}>
              1920x1080 @ 30fps
            </Typography>
            <Typography sx={{ fontSize: 12, color: '#606060' }}>
              CPU: 12%
            </Typography>
          </ControlSection>
        </ControlBar>
      </MainArea>

      {/* Mixer Panel */}
      <MixerPanel>
        <PanelHeader>
          <PanelTitle>Audio Mixer</PanelTitle>
          <SmallIconButton>
            <SettingsIcon sx={{ fontSize: 18 }} />
          </SmallIconButton>
        </PanelHeader>

        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {/* Microphone Channel */}
          <MixerChannel>
            <MixerHeader>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmallIconButton onClick={() => setMicMuted(!micMuted)}>
                  {micMuted ? (
                    <MicOffIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                  ) : (
                    <MicIcon sx={{ fontSize: 18 }} />
                  )}
                </SmallIconButton>
                <Typography sx={{ fontSize: 12, color: '#a0a0a0' }}>Microphone</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: '#505050' }}>-12 dB</Typography>
            </MixerHeader>
            <MeterContainer>
              <MeterBar level={micMuted ? 0 : 65} />
              <MeterBar level={micMuted ? 0 : 58} />
            </MeterContainer>
            <VolumeSlider defaultValue={80} disabled={micMuted} />
          </MixerChannel>

          {/* Desktop Audio Channel */}
          <MixerChannel>
            <MixerHeader>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmallIconButton onClick={() => setDesktopMuted(!desktopMuted)}>
                  {desktopMuted ? (
                    <VolumeOffIcon sx={{ fontSize: 18, color: '#ef4444' }} />
                  ) : (
                    <VolumeUpIcon sx={{ fontSize: 18 }} />
                  )}
                </SmallIconButton>
                <Typography sx={{ fontSize: 12, color: '#a0a0a0' }}>Desktop Audio</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: '#505050' }}>-18 dB</Typography>
            </MixerHeader>
            <MeterContainer>
              <MeterBar level={desktopMuted ? 0 : 45} />
              <MeterBar level={desktopMuted ? 0 : 42} />
            </MeterContainer>
            <VolumeSlider defaultValue={60} disabled={desktopMuted} />
          </MixerChannel>

          {/* Camera 1 Audio */}
          <MixerChannel>
            <MixerHeader>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SmallIconButton>
                  <VolumeUpIcon sx={{ fontSize: 18 }} />
                </SmallIconButton>
                <Typography sx={{ fontSize: 12, color: '#a0a0a0' }}>Camera 1</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: '#505050' }}>-24 dB</Typography>
            </MixerHeader>
            <MeterContainer>
              <MeterBar level={35} />
              <MeterBar level={32} />
            </MeterContainer>
            <VolumeSlider defaultValue={50} />
          </MixerChannel>
        </Box>

        {/* Output Destinations */}
        <OutputPanel>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#808080', mb: 1.5, textTransform: 'uppercase' }}>
            Stream Destinations
          </Typography>

          <OutputDestination connected={isStreaming}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <YouTubeIcon sx={{ fontSize: 20, color: '#ef4444' }} />
              <Typography sx={{ fontSize: 12, color: '#e0e0e0', flex: 1 }}>YouTube Live</Typography>
              <Chip
                label={isStreaming ? 'Connected' : 'Ready'}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 10,
                  backgroundColor: isStreaming ? alpha('#22c55e', 0.15) : alpha('#ffffff', 0.08),
                  color: isStreaming ? '#22c55e' : '#707070',
                }}
              />
            </Box>
            <Typography sx={{ fontSize: 10, color: '#505050' }}>
              rtmp://a.rtmp.youtube.com/live2
            </Typography>
          </OutputDestination>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              sx={{
                fontSize: 11,
                color: '#606060',
                '&:hover': { color: '#909090', backgroundColor: alpha('#ffffff', 0.04) },
              }}
            >
              Add Destination
            </Button>
          </Box>
        </OutputPanel>
      </MixerPanel>
    </ToolContainer>
  );
};

export default StreamingTool;
