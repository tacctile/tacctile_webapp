/**
 * OutputPanel Component
 * Configure RTMP output and streaming destinations
 */

import React, { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';

// Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import YouTubeIcon from '@mui/icons-material/YouTube';
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled';
import CellTowerIcon from '@mui/icons-material/CellTower';
import SettingsIcon from '@mui/icons-material/Settings';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import type {
  StreamDestination,
  StreamSettings,
  StreamPlatform,
} from '../../types/streaming';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const Container = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'auto',
});

const Section = styled(Box)({
  padding: 12,
  borderBottom: '1px solid #2b2b2b',
});

const SectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
  cursor: 'pointer',
});

const SectionTitle = styled(Typography)({
  fontSize: 12,
  fontWeight: 600,
  color: '#888888',
  textTransform: 'uppercase',
  letterSpacing: 1,
});

const DestinationCard = styled(Box)<{ enabled?: boolean; hasError?: boolean }>(
  ({ enabled, hasError }) => ({
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    border: `1px solid ${hasError ? '#f44336' : enabled ? '#19abb5' : '#2b2b2b'}`,
  })
);

const DestinationHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
});

const PlatformIcon = styled(Box)<{ platform: StreamPlatform }>(({ platform }) => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor:
    platform === 'youtube'
      ? '#ff0000'
      : platform === 'twitch'
      ? '#9146ff'
      : platform === 'facebook'
      ? '#1877f2'
      : platform === 'kick'
      ? '#53fc18'
      : '#19abb5',
  marginRight: 10,
}));

const StatusChip = styled(Chip)<{ status: StreamDestination['status'] }>(({ status }) => ({
  height: 24,
  fontSize: 11,
  fontWeight: 600,
  backgroundColor:
    status === 'connected'
      ? 'rgba(76, 175, 80, 0.2)'
      : status === 'connecting'
      ? 'rgba(255, 152, 0, 0.2)'
      : status === 'error'
      ? 'rgba(244, 67, 54, 0.2)'
      : 'rgba(100, 100, 100, 0.2)',
  color:
    status === 'connected'
      ? '#4caf50'
      : status === 'connecting'
      ? '#ff9800'
      : status === 'error'
      ? '#f44336'
      : '#666666',
  border: `1px solid ${
    status === 'connected'
      ? '#4caf50'
      : status === 'connecting'
      ? '#ff9800'
      : status === 'error'
      ? '#f44336'
      : '#444444'
  }`,
}));

const SettingRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  marginBottom: 12,
  gap: 8,
});

const SettingLabel = styled(Typography)({
  fontSize: 12,
  color: '#888888',
  width: 100,
  flexShrink: 0,
});

const AddButton = styled(Button)({
  backgroundColor: '#252525',
  color: '#e1e1e1',
  '&:hover': {
    backgroundColor: '#333333',
  },
});

// ============================================================================
// PLATFORM PRESETS
// ============================================================================

const PLATFORMS: { platform: StreamPlatform; label: string; serverUrl: string }[] = [
  { platform: 'custom_rtmp', label: 'Custom RTMP Server', serverUrl: '' },
  { platform: 'youtube', label: 'YouTube Live', serverUrl: 'rtmp://a.rtmp.youtube.com/live2' },
  { platform: 'twitch', label: 'Twitch', serverUrl: 'rtmp://live.twitch.tv/app' },
  { platform: 'facebook', label: 'Facebook Live', serverUrl: 'rtmps://live-api-s.facebook.com:443/rtmp' },
  { platform: 'kick', label: 'Kick', serverUrl: 'rtmp://ingest.kick.com/live' },
  { platform: 'tiktok', label: 'TikTok Live', serverUrl: 'rtmp://push.tiktokv.com/live' },
];

const RESOLUTIONS = [
  { width: 854, height: 480, label: '480p' },
  { width: 1280, height: 720, label: '720p' },
  { width: 1920, height: 1080, label: '1080p' },
  { width: 2560, height: 1440, label: '1440p' },
  { width: 3840, height: 2160, label: '4K' },
];

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface OutputPanelProps {
  destinations: StreamDestination[];
  streamSettings: StreamSettings;
  isStreaming: boolean;
  onAddDestination: (destination: Omit<StreamDestination, 'id' | 'status'>) => string;
  onRemoveDestination: (destinationId: string) => void;
  onUpdateDestination: (destinationId: string, updates: Partial<StreamDestination>) => void;
  onToggleDestination: (destinationId: string) => void;
  onTestDestination: (destinationId: string) => Promise<boolean>;
  onUpdateSettings: (settings: Partial<StreamSettings>) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const OutputPanel: React.FC<OutputPanelProps> = ({
  destinations,
  streamSettings,
  isStreaming,
  onAddDestination,
  onRemoveDestination,
  onUpdateDestination,
  onToggleDestination,
  onTestDestination,
  onUpdateSettings,
}) => {
  const [showDestinations, setShowDestinations] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [showStreamKey, setShowStreamKey] = useState<Record<string, boolean>>({});
  const [testingDestinations, setTestingDestinations] = useState<Set<string>>(new Set());

  const handleAddDestination = useCallback(() => {
    onAddDestination({
      name: 'New Destination',
      platform: 'custom_rtmp',
      enabled: false,
      serverUrl: '',
      streamKey: '',
    });
  }, [onAddDestination]);

  const handlePlatformChange = useCallback(
    (destinationId: string, platform: StreamPlatform) => {
      const preset = PLATFORMS.find((p) => p.platform === platform);
      onUpdateDestination(destinationId, {
        platform,
        serverUrl: preset?.serverUrl || '',
        name: preset?.label || 'Custom',
      });
    },
    [onUpdateDestination]
  );

  const handleTestConnection = useCallback(
    async (destinationId: string) => {
      setTestingDestinations((prev) => new Set(prev).add(destinationId));
      await onTestDestination(destinationId);
      setTestingDestinations((prev) => {
        const next = new Set(prev);
        next.delete(destinationId);
        return next;
      });
    },
    [onTestDestination]
  );

  const getPlatformIcon = (platform: StreamPlatform) => {
    switch (platform) {
      case 'youtube':
        return <YouTubeIcon sx={{ fontSize: 18, color: '#ffffff' }} />;
      case 'twitch':
        return <PlayCircleFilledIcon sx={{ fontSize: 18, color: '#ffffff' }} />;
      default:
        return <CellTowerIcon sx={{ fontSize: 18, color: '#ffffff' }} />;
    }
  };

  const getStatusLabel = (status: StreamDestination['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <Container>
      {/* Destinations Section */}
      <Section>
        <SectionHeader onClick={() => setShowDestinations(!showDestinations)}>
          <SectionTitle>Stream Destinations</SectionTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Add Destination">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddDestination();
                }}
              >
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            {showDestinations ? (
              <ExpandLessIcon sx={{ fontSize: 18, color: '#888888' }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18, color: '#888888' }} />
            )}
          </Box>
        </SectionHeader>

        <Collapse in={showDestinations}>
          {destinations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3, color: '#666666' }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                No destinations configured
              </Typography>
              <AddButton variant="contained" startIcon={<AddIcon />} onClick={handleAddDestination}>
                Add Destination
              </AddButton>
            </Box>
          ) : (
            destinations.map((destination) => (
              <DestinationCard
                key={destination.id}
                enabled={destination.enabled}
                hasError={destination.status === 'error'}
              >
                <DestinationHeader>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <PlatformIcon platform={destination.platform}>
                      {getPlatformIcon(destination.platform)}
                    </PlatformIcon>
                    <Box>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#e1e1e1' }}>
                        {destination.name}
                      </Typography>
                      <StatusChip
                        size="small"
                        status={destination.status}
                        label={getStatusLabel(destination.status)}
                        icon={
                          destination.status === 'connected' ? (
                            <CheckCircleIcon sx={{ fontSize: 14 }} />
                          ) : destination.status === 'error' ? (
                            <ErrorIcon sx={{ fontSize: 14 }} />
                          ) : undefined
                        }
                      />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Switch
                      size="small"
                      checked={destination.enabled}
                      onChange={() => onToggleDestination(destination.id)}
                      disabled={isStreaming}
                    />
                    <IconButton
                      size="small"
                      onClick={() => onRemoveDestination(destination.id)}
                      disabled={isStreaming}
                      sx={{ color: '#666666', '&:hover': { color: '#f44336' } }}
                    >
                      <DeleteIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>
                </DestinationHeader>

                {/* Platform Selection */}
                <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
                  <InputLabel sx={{ fontSize: 12 }}>Platform</InputLabel>
                  <Select
                    value={destination.platform}
                    label="Platform"
                    onChange={(e) =>
                      handlePlatformChange(destination.id, e.target.value as StreamPlatform)
                    }
                    disabled={isStreaming}
                    sx={{ fontSize: 13 }}
                  >
                    {PLATFORMS.map((p) => (
                      <MenuItem key={p.platform} value={p.platform}>
                        {p.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Server URL */}
                <TextField
                  size="small"
                  fullWidth
                  label="Server URL"
                  value={destination.serverUrl}
                  onChange={(e) =>
                    onUpdateDestination(destination.id, { serverUrl: e.target.value })
                  }
                  disabled={isStreaming}
                  sx={{ mb: 1.5, '& input': { fontSize: 13 } }}
                />

                {/* Stream Key */}
                <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Stream Key"
                    type={showStreamKey[destination.id] ? 'text' : 'password'}
                    value={destination.streamKey}
                    onChange={(e) =>
                      onUpdateDestination(destination.id, { streamKey: e.target.value })
                    }
                    disabled={isStreaming}
                    sx={{ '& input': { fontSize: 13 } }}
                  />
                  <IconButton
                    size="small"
                    onClick={() =>
                      setShowStreamKey((prev) => ({
                        ...prev,
                        [destination.id]: !prev[destination.id],
                      }))
                    }
                  >
                    {showStreamKey[destination.id] ? (
                      <VisibilityOffIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <VisibilityIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Box>

                {/* Test Connection Button */}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleTestConnection(destination.id)}
                  disabled={isStreaming || testingDestinations.has(destination.id)}
                  startIcon={
                    testingDestinations.has(destination.id) ? (
                      <CircularProgress size={14} />
                    ) : undefined
                  }
                  sx={{
                    fontSize: 12,
                    color: '#19abb5',
                    borderColor: '#19abb5',
                    '&:hover': {
                      borderColor: '#36d1da',
                      backgroundColor: 'rgba(25, 171, 181, 0.1)',
                    },
                  }}
                >
                  {testingDestinations.has(destination.id) ? 'Testing...' : 'Test Connection'}
                </Button>

                {/* Error Message */}
                {destination.status === 'error' && destination.error && (
                  <Alert severity="error" sx={{ mt: 1.5, fontSize: 12 }}>
                    {destination.error}
                  </Alert>
                )}
              </DestinationCard>
            ))
          )}
        </Collapse>
      </Section>

      {/* Output Settings Section */}
      <Section>
        <SectionHeader onClick={() => setShowSettings(!showSettings)}>
          <SectionTitle>
            <SettingsIcon sx={{ fontSize: 14, mr: 1, verticalAlign: 'middle' }} />
            Output Settings
          </SectionTitle>
          {showSettings ? (
            <ExpandLessIcon sx={{ fontSize: 18, color: '#888888' }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 18, color: '#888888' }} />
          )}
        </SectionHeader>

        <Collapse in={showSettings}>
          {/* Resolution */}
          <SettingRow>
            <SettingLabel>Resolution</SettingLabel>
            <FormControl size="small" fullWidth>
              <Select
                value={`${streamSettings.resolution.width}x${streamSettings.resolution.height}`}
                onChange={(e) => {
                  const [width, height] = e.target.value.split('x').map(Number);
                  const resolution = RESOLUTIONS.find(
                    (r) => r.width === width && r.height === height
                  );
                  if (resolution) {
                    onUpdateSettings({ resolution });
                  }
                }}
                disabled={isStreaming}
                sx={{ fontSize: 13 }}
              >
                {RESOLUTIONS.map((r) => (
                  <MenuItem key={r.label} value={`${r.width}x${r.height}`}>
                    {r.label} ({r.width}x{r.height})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </SettingRow>

          {/* FPS */}
          <SettingRow>
            <SettingLabel>Frame Rate</SettingLabel>
            <FormControl size="small" fullWidth>
              <Select
                value={streamSettings.fps}
                onChange={(e) => onUpdateSettings({ fps: e.target.value as 24 | 30 | 60 })}
                disabled={isStreaming}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value={24}>24 fps</MenuItem>
                <MenuItem value={30}>30 fps</MenuItem>
                <MenuItem value={60}>60 fps</MenuItem>
              </Select>
            </FormControl>
          </SettingRow>

          {/* Video Bitrate */}
          <SettingRow>
            <SettingLabel>Video Bitrate</SettingLabel>
            <TextField
              size="small"
              fullWidth
              type="number"
              value={streamSettings.videoBitrate}
              onChange={(e) => onUpdateSettings({ videoBitrate: Number(e.target.value) })}
              disabled={isStreaming}
              InputProps={{
                endAdornment: <Typography sx={{ fontSize: 12, color: '#666666' }}>Kbps</Typography>,
              }}
              sx={{ '& input': { fontSize: 13 } }}
            />
          </SettingRow>

          {/* Audio Bitrate */}
          <SettingRow>
            <SettingLabel>Audio Bitrate</SettingLabel>
            <FormControl size="small" fullWidth>
              <Select
                value={streamSettings.audioBitrate}
                onChange={(e) => onUpdateSettings({ audioBitrate: e.target.value as number })}
                disabled={isStreaming}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value={64}>64 Kbps</MenuItem>
                <MenuItem value={96}>96 Kbps</MenuItem>
                <MenuItem value={128}>128 Kbps</MenuItem>
                <MenuItem value={160}>160 Kbps</MenuItem>
                <MenuItem value={192}>192 Kbps</MenuItem>
                <MenuItem value={256}>256 Kbps</MenuItem>
                <MenuItem value={320}>320 Kbps</MenuItem>
              </Select>
            </FormControl>
          </SettingRow>

          {/* Video Codec */}
          <SettingRow>
            <SettingLabel>Video Codec</SettingLabel>
            <FormControl size="small" fullWidth>
              <Select
                value={streamSettings.videoCodec}
                onChange={(e) =>
                  onUpdateSettings({ videoCodec: e.target.value as 'h264' | 'vp9' | 'av1' })
                }
                disabled={isStreaming}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value="h264">H.264 (Most Compatible)</MenuItem>
                <MenuItem value="vp9">VP9</MenuItem>
                <MenuItem value="av1">AV1 (Best Quality)</MenuItem>
              </Select>
            </FormControl>
          </SettingRow>

          {/* Encoder Preset */}
          <SettingRow>
            <SettingLabel>Encoder Preset</SettingLabel>
            <FormControl size="small" fullWidth>
              <Select
                value={streamSettings.preset}
                onChange={(e) => onUpdateSettings({ preset: e.target.value as StreamSettings['preset'] })}
                disabled={isStreaming}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value="ultrafast">Ultra Fast (Low CPU)</MenuItem>
                <MenuItem value="superfast">Super Fast</MenuItem>
                <MenuItem value="veryfast">Very Fast</MenuItem>
                <MenuItem value="faster">Faster</MenuItem>
                <MenuItem value="fast">Fast</MenuItem>
                <MenuItem value="medium">Medium (Balanced)</MenuItem>
                <MenuItem value="slow">Slow (High Quality)</MenuItem>
              </Select>
            </FormControl>
          </SettingRow>
        </Collapse>
      </Section>
    </Container>
  );
};

export default OutputPanel;
