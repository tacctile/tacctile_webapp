/**
 * RecordingPanel Component
 * Configure and control local/cloud recording using MediaRecorder API
 */

import React, { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';

// Icons
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import PauseIcon from '@mui/icons-material/Pause';
import FolderIcon from '@mui/icons-material/Folder';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import StorageIcon from '@mui/icons-material/Storage';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryIcon from '@mui/icons-material/History';
import ReplayIcon from '@mui/icons-material/Replay';

import type { RecordingSettings, RecordingFormat, RecordingQuality } from '../../types/streaming';

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

const RecordingStatus = styled(Box)<{ recording?: boolean }>(({ recording }) => ({
  backgroundColor: recording ? 'rgba(244, 67, 54, 0.1)' : '#1a1a1a',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
  border: `1px solid ${recording ? '#f44336' : '#2b2b2b'}`,
  textAlign: 'center',
}));

const TimeDisplay = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 32,
  fontWeight: 700,
  color: '#e1e1e1',
});

const FileSizeDisplay = styled(Typography)({
  fontSize: 14,
  color: '#666666',
  marginTop: 4,
});

const ControlButtons = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  gap: 12,
  marginTop: 16,
});

const RecordButton = styled(Button)<{ recording?: boolean }>(({ recording }) => ({
  minWidth: 140,
  height: 48,
  fontSize: 14,
  fontWeight: 600,
  backgroundColor: recording ? '#f44336' : '#19abb5',
  color: '#ffffff',
  '&:hover': {
    backgroundColor: recording ? '#d32f2f' : '#36d1da',
  },
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

const StorageOption = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  flex: 1,
  padding: 12,
  borderRadius: 8,
  backgroundColor: selected ? 'rgba(25, 171, 181, 0.15)' : '#1a1a1a',
  border: `1px solid ${selected ? '#19abb5' : '#2b2b2b'}`,
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: selected ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.05)',
  },
}));

const ReplayBufferStatus = styled(Box)<{ enabled?: boolean }>(({ enabled }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 12,
  borderRadius: 8,
  backgroundColor: enabled ? 'rgba(76, 175, 80, 0.1)' : '#1a1a1a',
  border: `1px solid ${enabled ? '#4caf50' : '#2b2b2b'}`,
}));

// ============================================================================
// QUALITY PRESETS
// ============================================================================

const QUALITY_PRESETS: { quality: RecordingQuality; label: string; bitrate: number }[] = [
  { quality: 'low', label: 'Low (2 Mbps)', bitrate: 2000 },
  { quality: 'medium', label: 'Medium (5 Mbps)', bitrate: 5000 },
  { quality: 'high', label: 'High (8 Mbps)', bitrate: 8000 },
  { quality: 'lossless', label: 'Lossless (20+ Mbps)', bitrate: 20000 },
];

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface RecordingPanelProps {
  recordingSettings: RecordingSettings;
  isRecording: boolean;
  recordingStartTime: Date | null;
  onUpdateSettings: (settings: Partial<RecordingSettings>) => void;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

const RecordingPanel: React.FC<RecordingPanelProps> = ({
  recordingSettings,
  isRecording,
  recordingStartTime,
  onUpdateSettings,
  onStartRecording,
  onStopRecording,
}) => {
  const [showSettings, setShowSettings] = useState(true);
  const [showReplayBuffer, setShowReplayBuffer] = useState(true);
  const [recordingDuration, setRecordingDuration] = useState('00:00:00');
  const [estimatedFileSize, setEstimatedFileSize] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Update recording duration
  useEffect(() => {
    if (!isRecording || !recordingStartTime) {
      setRecordingDuration('00:00:00');
      setEstimatedFileSize(0);
      return;
    }

    const interval = setInterval(() => {
      const diff = Date.now() - new Date(recordingStartTime).getTime();
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      setRecordingDuration(
        `${hours.toString().padStart(2, '0')}:${(minutes % 60)
          .toString()
          .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
      );

      // Estimate file size based on bitrate
      const bitrateKbps = recordingSettings.videoBitrate + recordingSettings.audioBitrate;
      const fileSizeMB = (bitrateKbps / 8) * seconds / 1000;
      setEstimatedFileSize(fileSizeMB);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording, recordingStartTime, recordingSettings]);

  const handleQualityChange = useCallback(
    (quality: RecordingQuality) => {
      const preset = QUALITY_PRESETS.find((p) => p.quality === quality);
      onUpdateSettings({
        quality,
        videoBitrate: preset?.bitrate || 8000,
      });
    },
    [onUpdateSettings]
  );

  const formatFileSize = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <Container>
      {/* Recording Status */}
      <Section>
        <RecordingStatus recording={isRecording}>
          {isRecording && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: '#f44336',
                  mr: 1,
                  animation: 'pulse 1s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
              <Chip
                label="RECORDING"
                size="small"
                sx={{
                  backgroundColor: '#f44336',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 11,
                }}
              />
            </Box>
          )}

          <TimeDisplay>{recordingDuration}</TimeDisplay>

          {isRecording && (
            <FileSizeDisplay>
              Est. Size: {formatFileSize(estimatedFileSize)}
            </FileSizeDisplay>
          )}

          <ControlButtons>
            {isRecording && (
              <Button
                variant="outlined"
                startIcon={isPaused ? <FiberManualRecordIcon /> : <PauseIcon />}
                onClick={() => setIsPaused(!isPaused)}
                sx={{
                  color: '#ff9800',
                  borderColor: '#ff9800',
                  '&:hover': {
                    borderColor: '#ffa726',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                  },
                }}
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            )}

            <RecordButton
              variant="contained"
              recording={isRecording}
              startIcon={isRecording ? <StopIcon /> : <FiberManualRecordIcon />}
              onClick={isRecording ? onStopRecording : onStartRecording}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </RecordButton>
          </ControlButtons>
        </RecordingStatus>
      </Section>

      {/* Recording Settings */}
      <Section>
        <SectionHeader onClick={() => setShowSettings(!showSettings)}>
          <SectionTitle>
            <SettingsIcon sx={{ fontSize: 14, mr: 1, verticalAlign: 'middle' }} />
            Recording Settings
          </SectionTitle>
          {showSettings ? (
            <ExpandLessIcon sx={{ fontSize: 18, color: '#888888' }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 18, color: '#888888' }} />
          )}
        </SectionHeader>

        <Collapse in={showSettings}>
          {/* Format */}
          <SettingRow>
            <SettingLabel>Format</SettingLabel>
            <FormControl size="small" fullWidth>
              <Select
                value={recordingSettings.format}
                onChange={(e) =>
                  onUpdateSettings({ format: e.target.value as RecordingFormat })
                }
                disabled={isRecording}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value="mp4">MP4 (H.264)</MenuItem>
                <MenuItem value="webm">WebM (VP9)</MenuItem>
                <MenuItem value="mkv">MKV (Matroska)</MenuItem>
              </Select>
            </FormControl>
          </SettingRow>

          {/* Quality */}
          <SettingRow>
            <SettingLabel>Quality</SettingLabel>
            <FormControl size="small" fullWidth>
              <Select
                value={recordingSettings.quality}
                onChange={(e) => handleQualityChange(e.target.value as RecordingQuality)}
                disabled={isRecording}
                sx={{ fontSize: 13 }}
              >
                {QUALITY_PRESETS.map((preset) => (
                  <MenuItem key={preset.quality} value={preset.quality}>
                    {preset.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </SettingRow>

          {/* Custom Bitrate */}
          <SettingRow>
            <SettingLabel>Video Bitrate</SettingLabel>
            <TextField
              size="small"
              fullWidth
              type="number"
              value={recordingSettings.videoBitrate}
              onChange={(e) => onUpdateSettings({ videoBitrate: Number(e.target.value) })}
              disabled={isRecording}
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
                value={recordingSettings.audioBitrate}
                onChange={(e) => onUpdateSettings({ audioBitrate: e.target.value as number })}
                disabled={isRecording}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value={128}>128 Kbps</MenuItem>
                <MenuItem value={192}>192 Kbps</MenuItem>
                <MenuItem value={256}>256 Kbps</MenuItem>
                <MenuItem value={320}>320 Kbps</MenuItem>
              </Select>
            </FormControl>
          </SettingRow>

          {/* Storage Type */}
          <Box sx={{ mb: 2 }}>
            <SettingLabel sx={{ mb: 1 }}>Storage</SettingLabel>
            <Box sx={{ display: 'flex', gap: 8 }}>
              <StorageOption
                selected={recordingSettings.storageType === 'local'}
                onClick={() => !isRecording && onUpdateSettings({ storageType: 'local' })}
              >
                <FolderIcon sx={{ fontSize: 24, color: recordingSettings.storageType === 'local' ? '#19abb5' : '#666666' }} />
                <Typography sx={{ fontSize: 12, fontWeight: 500 }}>Local</Typography>
              </StorageOption>
              <StorageOption
                selected={recordingSettings.storageType === 'cloud'}
                onClick={() => !isRecording && onUpdateSettings({ storageType: 'cloud' })}
              >
                <CloudUploadIcon sx={{ fontSize: 24, color: recordingSettings.storageType === 'cloud' ? '#19abb5' : '#666666' }} />
                <Typography sx={{ fontSize: 12, fontWeight: 500 }}>Cloud</Typography>
              </StorageOption>
              <StorageOption
                selected={recordingSettings.storageType === 'both'}
                onClick={() => !isRecording && onUpdateSettings({ storageType: 'both' })}
              >
                <StorageIcon sx={{ fontSize: 24, color: recordingSettings.storageType === 'both' ? '#19abb5' : '#666666' }} />
                <Typography sx={{ fontSize: 12, fontWeight: 500 }}>Both</Typography>
              </StorageOption>
            </Box>
          </Box>

          {/* Cloud Provider */}
          {(recordingSettings.storageType === 'cloud' ||
            recordingSettings.storageType === 'both') && (
            <SettingRow>
              <SettingLabel>Cloud Provider</SettingLabel>
              <FormControl size="small" fullWidth>
                <Select
                  value={recordingSettings.cloudProvider || 'firebase'}
                  onChange={(e) =>
                    onUpdateSettings({
                      cloudProvider: e.target.value as 'firebase' | 'supabase' | 's3',
                    })
                  }
                  disabled={isRecording}
                  sx={{ fontSize: 13 }}
                >
                  <MenuItem value="firebase">Firebase Storage</MenuItem>
                  <MenuItem value="supabase">Supabase Storage</MenuItem>
                  <MenuItem value="s3">Amazon S3</MenuItem>
                </Select>
              </FormControl>
            </SettingRow>
          )}

          {/* File Splitting */}
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #2b2b2b' }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#666666', mb: 2 }}>
              FILE SPLITTING
            </Typography>

            <SettingRow>
              <SettingLabel>Split by Size</SettingLabel>
              <TextField
                size="small"
                fullWidth
                type="number"
                value={recordingSettings.splitBySize || ''}
                onChange={(e) =>
                  onUpdateSettings({
                    splitBySize: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                disabled={isRecording}
                placeholder="Disabled"
                InputProps={{
                  endAdornment: <Typography sx={{ fontSize: 12, color: '#666666' }}>MB</Typography>,
                }}
                sx={{ '& input': { fontSize: 13 } }}
              />
            </SettingRow>

            <SettingRow>
              <SettingLabel>Split by Duration</SettingLabel>
              <TextField
                size="small"
                fullWidth
                type="number"
                value={recordingSettings.splitByDuration || ''}
                onChange={(e) =>
                  onUpdateSettings({
                    splitByDuration: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                disabled={isRecording}
                placeholder="Disabled"
                InputProps={{
                  endAdornment: <Typography sx={{ fontSize: 12, color: '#666666' }}>sec</Typography>,
                }}
                sx={{ '& input': { fontSize: 13 } }}
              />
            </SettingRow>
          </Box>
        </Collapse>
      </Section>

      {/* Replay Buffer */}
      <Section>
        <SectionHeader onClick={() => setShowReplayBuffer(!showReplayBuffer)}>
          <SectionTitle>
            <HistoryIcon sx={{ fontSize: 14, mr: 1, verticalAlign: 'middle' }} />
            Replay Buffer
          </SectionTitle>
          {showReplayBuffer ? (
            <ExpandLessIcon sx={{ fontSize: 18, color: '#888888' }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 18, color: '#888888' }} />
          )}
        </SectionHeader>

        <Collapse in={showReplayBuffer}>
          <ReplayBufferStatus enabled={recordingSettings.replayBufferEnabled}>
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#e1e1e1' }}>
                Replay Buffer
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#888888' }}>
                Save last {recordingSettings.replayBufferDuration} seconds
              </Typography>
            </Box>
            <Switch
              checked={recordingSettings.replayBufferEnabled}
              onChange={(e) => onUpdateSettings({ replayBufferEnabled: e.target.checked })}
              disabled={isRecording}
            />
          </ReplayBufferStatus>

          {recordingSettings.replayBufferEnabled && (
            <>
              <SettingRow sx={{ mt: 2 }}>
                <SettingLabel>Duration</SettingLabel>
                <Slider
                  value={recordingSettings.replayBufferDuration}
                  min={5}
                  max={120}
                  step={5}
                  onChange={(_, v) =>
                    onUpdateSettings({ replayBufferDuration: v as number })
                  }
                  disabled={isRecording}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}s`}
                  sx={{ flex: 1 }}
                />
              </SettingRow>

              <Button
                fullWidth
                variant="outlined"
                startIcon={<ReplayIcon />}
                disabled={!recordingSettings.replayBufferEnabled || isRecording}
                sx={{
                  mt: 1,
                  color: '#4caf50',
                  borderColor: '#4caf50',
                  '&:hover': {
                    borderColor: '#66bb6a',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  },
                }}
              >
                Save Replay (Last {recordingSettings.replayBufferDuration}s)
              </Button>

              <Alert severity="info" sx={{ mt: 2, fontSize: 12 }}>
                Press the hotkey or click the button to save the last{' '}
                {recordingSettings.replayBufferDuration} seconds of footage.
              </Alert>
            </>
          )}
        </Collapse>
      </Section>
    </Container>
  );
};

export default RecordingPanel;
