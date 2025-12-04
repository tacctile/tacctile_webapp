/**
 * AudioMixerPanel Component
 * Audio mixer with volume controls and audio source management
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { styled } from '@mui/material/styles';

// Icons
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SpeakerIcon from '@mui/icons-material/Speaker';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';

import type { AudioMixer, AudioSource } from '../../types/streaming';
import { useStreamingToolStore } from '../../stores/useStreamingToolStore';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled(Box)({
  backgroundColor: '#1a1a1a',
  borderRadius: 8,
  padding: 12,
  border: '1px solid #2b2b2b',
});

const Header = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
});

const Title = styled(Typography)({
  fontSize: 12,
  fontWeight: 600,
  color: '#888888',
  textTransform: 'uppercase',
  letterSpacing: 1,
});

const MixerGrid = styled(Box)({
  display: 'flex',
  gap: 12,
  overflowX: 'auto',
  paddingBottom: 4,
  '&::-webkit-scrollbar': {
    height: 4,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: '#0a0a0a',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#333333',
    borderRadius: 2,
  },
});

const ChannelStrip = styled(Box)<{ isMaster?: boolean }>(({ isMaster }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '12px 8px',
  backgroundColor: isMaster ? 'rgba(25, 171, 181, 0.1)' : '#141414',
  borderRadius: 8,
  border: `1px solid ${isMaster ? '#19abb5' : '#252525'}`,
  minWidth: 70,
  flexShrink: 0,
}));

const ChannelIcon = styled(Box)<{ muted?: boolean }>(({ muted }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  backgroundColor: muted ? '#333333' : '#252525',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 8,
}));

const ChannelName = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  color: '#e1e1e1',
  textAlign: 'center',
  marginBottom: 8,
  maxWidth: 60,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

const VolumeSliderContainer = styled(Box)({
  height: 100,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  marginBottom: 8,
});

const LevelMeter = styled(Box)({
  width: 8,
  height: 80,
  backgroundColor: '#0a0a0a',
  borderRadius: 4,
  position: 'relative',
  marginBottom: 8,
  overflow: 'hidden',
});

const LevelFill = styled(Box)<{ level: number }>(({ level }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: `${Math.min(100, level * 100)}%`,
  background: level > 0.9 ? '#f44336' : level > 0.7 ? '#ff9800' : '#4caf50',
  borderRadius: 4,
  transition: 'height 0.05s ease',
}));

const VolumeValue = styled(Typography)({
  fontSize: 10,
  color: '#666666',
  fontFamily: 'monospace',
});

const ControlButtons = styled(Box)({
  display: 'flex',
  gap: 4,
});

const AddButton = styled(IconButton)({
  backgroundColor: '#252525',
  '&:hover': {
    backgroundColor: '#333333',
  },
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface AudioMixerPanelProps {
  audioMixer: AudioMixer;
  availableDevices: MediaDeviceInfo[];
}

// ============================================================================
// COMPONENT
// ============================================================================

const AudioMixerPanel: React.FC<AudioMixerPanelProps> = ({ audioMixer, availableDevices }) => {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(new Map());
  // Reserved for real audio level analysis implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const analyserRefs = useRef<Map<string, AnalyserNode>>(new Map());
  void analyserRefs; // Intentionally unused, reserved for Web Audio API integration

  // Store actions - extract stable references
  const updateAudioSource = useStreamingToolStore((state) => state.updateAudioSource);
  const addAudioSource = useStreamingToolStore((state) => state.addAudioSource);
  const removeAudioSource = useStreamingToolStore((state) => state.removeAudioSource);
  const setMasterVolume = useStreamingToolStore((state) => state.setMasterVolume);
  const setMasterMuted = useStreamingToolStore((state) => state.setMasterMuted);

  // Simulate audio levels (in real implementation, use Web Audio API AnalyserNode)
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioLevels((prev) => {
        const next = new Map(prev);
        audioMixer.sources.forEach((source) => {
          if (!source.muted) {
            // Simulate varying audio levels
            const baseLevel = 0.3 + Math.random() * 0.4;
            next.set(source.id, baseLevel * source.volume);
          } else {
            next.set(source.id, 0);
          }
        });
        // Master level
        if (!audioMixer.masterMuted) {
          next.set('master', 0.4 + Math.random() * 0.3);
        } else {
          next.set('master', 0);
        }
        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [audioMixer.sources, audioMixer.masterMuted]);

  const handleOpenMenu = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleAddSource = useCallback(
    (type: AudioSource['type'], deviceId?: string) => {
      const audioDevices = availableDevices.filter((d) => d.kind === 'audioinput');
      const device = deviceId
        ? audioDevices.find((d) => d.deviceId === deviceId)
        : audioDevices[0];

      addAudioSource({
        name: type === 'microphone' ? 'Microphone' : type === 'system' ? 'Desktop Audio' : 'Virtual',
        type,
        deviceId: device?.deviceId,
        volume: 1,
        muted: false,
        monitorEnabled: false,
      });

      handleCloseMenu();
    },
    [availableDevices, addAudioSource, handleCloseMenu]
  );

  const handleVolumeChange = useCallback(
    (sourceId: string, volume: number) => {
      updateAudioSource(sourceId, { volume });
    },
    [updateAudioSource]
  );

  const handleToggleMute = useCallback(
    (sourceId: string, currentMuted: boolean) => {
      updateAudioSource(sourceId, { muted: !currentMuted });
    },
    [updateAudioSource]
  );

  const handleToggleMonitor = useCallback(
    (sourceId: string, currentEnabled: boolean) => {
      updateAudioSource(sourceId, { monitorEnabled: !currentEnabled });
    },
    [updateAudioSource]
  );

  const formatDb = (volume: number): string => {
    if (volume === 0) return '-∞';
    const db = 20 * Math.log10(volume);
    return `${db.toFixed(1)} dB`;
  };

  const getSourceIcon = (source: AudioSource) => {
    if (source.muted) {
      return source.type === 'microphone' ? (
        <MicOffIcon sx={{ fontSize: 18, color: '#f44336' }} />
      ) : (
        <VolumeOffIcon sx={{ fontSize: 18, color: '#f44336' }} />
      );
    }
    return source.type === 'microphone' ? (
      <MicIcon sx={{ fontSize: 18, color: '#19abb5' }} />
    ) : source.type === 'system' ? (
      <DesktopWindowsIcon sx={{ fontSize: 18, color: '#19abb5' }} />
    ) : (
      <SpeakerIcon sx={{ fontSize: 18, color: '#19abb5' }} />
    );
  };

  const audioInputDevices = availableDevices.filter((d) => d.kind === 'audioinput');

  return (
    <Container>
      <Header>
        <Title>Audio Mixer</Title>
        <Tooltip title="Add Audio Source">
          <AddButton size="small" onClick={handleOpenMenu}>
            <AddIcon sx={{ fontSize: 18 }} />
          </AddButton>
        </Tooltip>
      </Header>

      <MixerGrid>
        {/* Audio Sources */}
        {audioMixer.sources.map((source) => (
          <ChannelStrip key={source.id}>
            <ChannelIcon muted={source.muted}>{getSourceIcon(source)}</ChannelIcon>
            <ChannelName>{source.name}</ChannelName>

            <VolumeSliderContainer>
              <LevelMeter>
                <LevelFill level={audioLevels.get(source.id) || 0} />
              </LevelMeter>
              <Slider
                orientation="vertical"
                value={source.volume}
                min={0}
                max={1}
                step={0.01}
                onChange={(_, v) => handleVolumeChange(source.id, v as number)}
                sx={{
                  height: 80,
                  '& .MuiSlider-thumb': {
                    width: 12,
                    height: 12,
                    backgroundColor: '#19abb5',
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: '#19abb5',
                    width: 4,
                  },
                  '& .MuiSlider-rail': {
                    backgroundColor: '#333333',
                    width: 4,
                  },
                }}
              />
            </VolumeSliderContainer>

            <VolumeValue>{formatDb(source.volume)}</VolumeValue>

            <ControlButtons>
              <Tooltip title={source.muted ? 'Unmute' : 'Mute'}>
                <IconButton
                  size="small"
                  onClick={() => handleToggleMute(source.id, source.muted)}
                  sx={{ color: source.muted ? '#f44336' : '#666666' }}
                >
                  {source.muted ? (
                    <VolumeOffIcon sx={{ fontSize: 16 }} />
                  ) : (
                    <VolumeUpIcon sx={{ fontSize: 16 }} />
                  )}
                </IconButton>
              </Tooltip>
              <Tooltip title={source.monitorEnabled ? 'Disable Monitor' : 'Enable Monitor'}>
                <IconButton
                  size="small"
                  onClick={() => handleToggleMonitor(source.id, source.monitorEnabled)}
                  sx={{ color: source.monitorEnabled ? '#19abb5' : '#666666' }}
                >
                  <HeadphonesIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove">
                <IconButton
                  size="small"
                  onClick={() => removeAudioSource(source.id)}
                  sx={{ color: '#666666', '&:hover': { color: '#f44336' } }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </ControlButtons>
          </ChannelStrip>
        ))}

        {/* Master Channel */}
        <ChannelStrip isMaster>
          <ChannelIcon muted={audioMixer.masterMuted}>
            {audioMixer.masterMuted ? (
              <VolumeOffIcon sx={{ fontSize: 18, color: '#f44336' }} />
            ) : (
              <VolumeUpIcon sx={{ fontSize: 18, color: '#19abb5' }} />
            )}
          </ChannelIcon>
          <ChannelName>Master</ChannelName>

          <VolumeSliderContainer>
            <LevelMeter>
              <LevelFill level={audioLevels.get('master') || 0} />
            </LevelMeter>
            <Slider
              orientation="vertical"
              value={audioMixer.masterVolume}
              min={0}
              max={1}
              step={0.01}
              onChange={(_, v) => setMasterVolume(v as number)}
              sx={{
                height: 80,
                '& .MuiSlider-thumb': {
                  width: 12,
                  height: 12,
                  backgroundColor: '#19abb5',
                },
                '& .MuiSlider-track': {
                  backgroundColor: '#19abb5',
                  width: 4,
                },
                '& .MuiSlider-rail': {
                  backgroundColor: '#333333',
                  width: 4,
                },
              }}
            />
          </VolumeSliderContainer>

          <VolumeValue>{formatDb(audioMixer.masterVolume)}</VolumeValue>

          <ControlButtons>
            <Tooltip title={audioMixer.masterMuted ? 'Unmute' : 'Mute'}>
              <IconButton
                size="small"
                onClick={() => setMasterMuted(!audioMixer.masterMuted)}
                sx={{ color: audioMixer.masterMuted ? '#f44336' : '#666666' }}
              >
                {audioMixer.masterMuted ? (
                  <VolumeOffIcon sx={{ fontSize: 16 }} />
                ) : (
                  <VolumeUpIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          </ControlButtons>
        </ChannelStrip>
      </MixerGrid>

      {/* Add Source Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            backgroundColor: '#1e1e1e',
            border: '1px solid #333333',
          },
        }}
      >
        <MenuItem onClick={() => handleAddSource('microphone')}>
          <ListItemIcon>
            <MicIcon sx={{ fontSize: 18, color: '#19abb5' }} />
          </ListItemIcon>
          <ListItemText>Microphone</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleAddSource('system')}>
          <ListItemIcon>
            <DesktopWindowsIcon sx={{ fontSize: 18, color: '#19abb5' }} />
          </ListItemIcon>
          <ListItemText>Desktop Audio</ListItemText>
        </MenuItem>

        {audioInputDevices.length > 0 && (
          <Box sx={{ borderTop: '1px solid #333333', mt: 1, pt: 1 }}>
            <Typography
              sx={{ fontSize: 11, color: '#666666', px: 2, py: 0.5, textTransform: 'uppercase' }}
            >
              Available Devices
            </Typography>
            {audioInputDevices.map((device) => (
              <MenuItem
                key={device.deviceId}
                onClick={() => handleAddSource('microphone', device.deviceId)}
              >
                <ListItemIcon>
                  <MicIcon sx={{ fontSize: 18, color: '#666666' }} />
                </ListItemIcon>
                <ListItemText
                  sx={{
                    '& .MuiTypography-root': {
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 200,
                    },
                  }}
                >
                  {device.label || `Device ${device.deviceId.slice(0, 8)}`}
                </ListItemText>
              </MenuItem>
            ))}
          </Box>
        )}
      </Menu>
    </Container>
  );
};

export default AudioMixerPanel;
