/**
 * AudioTool - iZotope RX 11-inspired audio analyzer
 *
 * Features for EVP (Electronic Voice Phenomena) analysis:
 * - Spectrogram view (time vs frequency)
 * - Waveform view
 * - Spectral selection tools
 * - Frequency band isolation
 * - Audio enhancement controls
 * - Real-time playback with visual sync
 */

import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import { styled, alpha } from '@mui/material/styles';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import StopIcon from '@mui/icons-material/Stop';
import LoopIcon from '@mui/icons-material/Loop';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import TimelineIcon from '@mui/icons-material/Timeline';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import CropFreeIcon from '@mui/icons-material/CropFree';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import TuneIcon from '@mui/icons-material/Tune';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MicIcon from '@mui/icons-material/Mic';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import NoiseAwareIcon from '@mui/icons-material/NoiseAware';
import EqualizerIcon from '@mui/icons-material/Equalizer';

const ToolContainer = styled(Box)({
  display: 'flex',
  flex: 1,
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
});

const FileBrowser = styled(Box)({
  width: 220,
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const BrowserHeader = styled(Box)({
  padding: '12px 16px',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const BrowserContent = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: 8,
});

const AudioFileItem = styled(Box)<{ selected?: boolean }>(({ selected }) => ({
  padding: '8px 12px',
  backgroundColor: selected ? alpha('#19abb5', 0.15) : 'transparent',
  borderRadius: 4,
  marginBottom: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: selected ? `1px solid ${alpha('#19abb5', 0.4)}` : '1px solid transparent',
  '&:hover': {
    backgroundColor: selected ? alpha('#19abb5', 0.2) : alpha('#ffffff', 0.04),
  },
}));

const MainArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const Toolbar = styled(Box)({
  height: 44,
  backgroundColor: '#0f0f0f',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const ToolbarSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const ToolbarButton = styled(IconButton)({
  width: 32,
  height: 32,
  color: '#707070',
  '&:hover': {
    color: '#b0b0b0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
  '&.Mui-selected, &.active': {
    color: '#19abb5',
    backgroundColor: alpha('#19abb5', 0.1),
  },
});

const ViewToggle = styled(ToggleButtonGroup)({
  '& .MuiToggleButton-root': {
    padding: '4px 12px',
    color: '#707070',
    borderColor: '#2a2a2a',
    fontSize: 12,
    '&.Mui-selected': {
      color: '#19abb5',
      backgroundColor: alpha('#19abb5', 0.1),
    },
  },
});

const SpectrogramArea = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
});

const SpectrogramPlaceholder = styled(Box)({
  flex: 1,
  backgroundColor: '#000000',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  overflow: 'hidden',
});

const SpectrogramGrid = styled(Box)({
  position: 'absolute',
  inset: 0,
  backgroundImage: `
    linear-gradient(to right, #1a1a1a 1px, transparent 1px),
    linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)
  `,
  backgroundSize: '50px 30px',
  opacity: 0.5,
});

const FrequencyScale = styled(Box)({
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 60,
  width: 50,
  backgroundColor: alpha('#0a0a0a', 0.9),
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '8px 4px',
});

const FrequencyLabel = styled(Typography)({
  fontSize: 9,
  color: '#505050',
  textAlign: 'right',
  fontFamily: 'monospace',
});

const WaveformArea = styled(Box)({
  height: 60,
  backgroundColor: '#0a0a0a',
  borderTop: '1px solid #1a1a1a',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const TransportBar = styled(Box)({
  height: 48,
  backgroundColor: '#0f0f0f',
  borderTop: '1px solid #1a1a1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 16px',
  gap: 16,
});

const TransportButton = styled(IconButton)({
  color: '#808080',
  '&:hover': {
    color: '#c0c0c0',
    backgroundColor: alpha('#ffffff', 0.06),
  },
});

const PlayButton = styled(IconButton)({
  width: 40,
  height: 40,
  color: '#ffffff',
  backgroundColor: '#19abb5',
  '&:hover': {
    backgroundColor: '#1992a1',
  },
});

const Timecode = styled(Typography)({
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#808080',
  minWidth: 80,
});

const ControlPanel = styled(Box)({
  width: 260,
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #1a1a1a',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
});

const PanelSection = styled(Box)({
  padding: 16,
  borderBottom: '1px solid #1a1a1a',
});

const PanelTitle = styled(Typography)({
  fontSize: 11,
  fontWeight: 600,
  color: '#808080',
  textTransform: 'uppercase',
  marginBottom: 12,
  letterSpacing: '0.05em',
});

const ControlRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
});

const ControlLabel = styled(Typography)({
  fontSize: 12,
  color: '#a0a0a0',
});

const ControlSlider = styled(Slider)({
  width: 120,
  color: '#19abb5',
  height: 4,
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
  },
});

const ControlValue = styled(Typography)({
  fontSize: 11,
  color: '#606060',
  minWidth: 40,
  textAlign: 'right',
  fontFamily: 'monospace',
});

const AudioTool: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'spectrogram' | 'waveform' | 'both'>('both');
  const [selectedFile, setSelectedFile] = useState(0);
  const [selectedTool, setSelectedTool] = useState<'select' | 'lasso' | 'zoom'>('select');

  // Control values
  const [noiseReduction, setNoiseReduction] = useState(30);
  const [gain, setGain] = useState(0);
  const [highPass, setHighPass] = useState(80);
  const [lowPass, setLowPass] = useState(16000);

  const audioFiles = [
    { id: 1, name: 'EVP_Session_01.wav', duration: '00:08:23', markers: 3 },
    { id: 2, name: 'EVP_Session_02.wav', duration: '00:12:45', markers: 5 },
    { id: 3, name: 'Ambient_Recording.wav', duration: '00:45:00', markers: 1 },
    { id: 4, name: 'Spirit_Box_Session.wav', duration: '00:15:30', markers: 8 },
  ];

  const frequencyLabels = ['20kHz', '10kHz', '5kHz', '2kHz', '1kHz', '500Hz', '200Hz', '100Hz', '20Hz'];

  return (
    <ToolContainer>
      {/* File Browser */}
      <FileBrowser>
        <BrowserHeader>
          <FolderOpenIcon sx={{ fontSize: 18, color: '#808080' }} />
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#c0c0c0' }}>
            Audio Files
          </Typography>
        </BrowserHeader>
        <BrowserContent>
          {audioFiles.map((file, index) => (
            <AudioFileItem
              key={file.id}
              selected={selectedFile === index}
              onClick={() => setSelectedFile(index)}
            >
              <MicIcon sx={{ fontSize: 16, color: selectedFile === index ? '#19abb5' : '#505050' }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: 12,
                    color: selectedFile === index ? '#e0e0e0' : '#a0a0a0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {file.name}
                </Typography>
                <Typography sx={{ fontSize: 10, color: '#505050' }}>
                  {file.duration} • {file.markers} markers
                </Typography>
              </Box>
            </AudioFileItem>
          ))}
        </BrowserContent>
      </FileBrowser>

      {/* Main Area */}
      <MainArea>
        {/* Toolbar */}
        <Toolbar>
          <ToolbarSection>
            <Tooltip title="Selection Tool">
              <ToolbarButton
                className={selectedTool === 'select' ? 'active' : ''}
                onClick={() => setSelectedTool('select')}
              >
                <SelectAllIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Spectral Lasso">
              <ToolbarButton
                className={selectedTool === 'lasso' ? 'active' : ''}
                onClick={() => setSelectedTool('lasso')}
              >
                <HighlightAltIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Zoom">
              <ToolbarButton
                className={selectedTool === 'zoom' ? 'active' : ''}
                onClick={() => setSelectedTool('zoom')}
              >
                <CropFreeIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2a2a', mx: 1 }} />

          <ViewToggle
            value={viewMode}
            exclusive
            onChange={(_, value) => value && setViewMode(value)}
            size="small"
          >
            <ToggleButton value="spectrogram">
              <GraphicEqIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Spectrogram
            </ToggleButton>
            <ToggleButton value="waveform">
              <TimelineIcon sx={{ fontSize: 16, mr: 0.5 }} />
              Waveform
            </ToggleButton>
            <ToggleButton value="both">Both</ToggleButton>
          </ViewToggle>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2a2a', mx: 1 }} />

          <ToolbarSection>
            <Tooltip title="Zoom In">
              <ToolbarButton>
                <ZoomInIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <ToolbarButton>
                <ZoomOutIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Fit to Window">
              <ToolbarButton>
                <FitScreenIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>

          <Box sx={{ flex: 1 }} />

          <ToolbarSection>
            <Tooltip title="Auto-Enhance EVP">
              <ToolbarButton>
                <AutoFixHighIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Noise Profile">
              <ToolbarButton>
                <NoiseAwareIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </ToolbarSection>
        </Toolbar>

        {/* Spectrogram/Waveform Display */}
        <SpectrogramArea>
          {(viewMode === 'spectrogram' || viewMode === 'both') && (
            <SpectrogramPlaceholder sx={{ flex: viewMode === 'both' ? 1 : undefined }}>
              <SpectrogramGrid />
              <FrequencyScale>
                {frequencyLabels.map((label) => (
                  <FrequencyLabel key={label}>{label}</FrequencyLabel>
                ))}
              </FrequencyScale>
              <Box sx={{ zIndex: 1, textAlign: 'center' }}>
                <GraphicEqIcon sx={{ fontSize: 48, color: '#252525' }} />
                <Typography sx={{ color: '#404040', fontSize: 13, mt: 1 }}>
                  iZotope RX 11-inspired Spectrogram
                </Typography>
                <Typography sx={{ color: '#303030', fontSize: 11 }}>
                  Spectral view for EVP analysis
                </Typography>
              </Box>
            </SpectrogramPlaceholder>
          )}

          {(viewMode === 'waveform' || viewMode === 'both') && (
            <WaveformArea sx={{ height: viewMode === 'both' ? 60 : undefined, flex: viewMode === 'waveform' ? 1 : undefined }}>
              <Box sx={{ textAlign: 'center' }}>
                <TimelineIcon sx={{ fontSize: 24, color: '#252525' }} />
                <Typography sx={{ color: '#404040', fontSize: 11 }}>
                  Waveform Display
                </Typography>
              </Box>
            </WaveformArea>
          )}
        </SpectrogramArea>

        {/* Transport Bar */}
        <TransportBar>
          <Timecode>00:00:00.000</Timecode>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Stop">
              <TransportButton>
                <StopIcon />
              </TransportButton>
            </Tooltip>
            <Tooltip title={isPlaying ? 'Pause' : 'Play'}>
              <PlayButton onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              </PlayButton>
            </Tooltip>
            <Tooltip title="Loop Selection">
              <TransportButton>
                <LoopIcon />
              </TransportButton>
            </Tooltip>
          </Box>

          <Timecode>{audioFiles[selectedFile]?.duration || '00:00:00.000'}</Timecode>

          <Divider orientation="vertical" flexItem sx={{ borderColor: '#2a2a2a', mx: 2 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VolumeUpIcon sx={{ fontSize: 18, color: '#606060' }} />
            <Slider
              defaultValue={75}
              sx={{ width: 80, color: '#19abb5' }}
              size="small"
            />
          </Box>
        </TransportBar>
      </MainArea>

      {/* Control Panel */}
      <ControlPanel>
        <PanelSection>
          <PanelTitle>Enhancement</PanelTitle>
          <ControlRow>
            <ControlLabel>Noise Reduction</ControlLabel>
            <ControlValue>{noiseReduction} dB</ControlValue>
          </ControlRow>
          <ControlSlider
            value={noiseReduction}
            onChange={(_, value) => setNoiseReduction(value as number)}
            min={0}
            max={60}
          />

          <ControlRow sx={{ mt: 2 }}>
            <ControlLabel>Gain</ControlLabel>
            <ControlValue>{gain > 0 ? `+${gain}` : gain} dB</ControlValue>
          </ControlRow>
          <ControlSlider
            value={gain}
            onChange={(_, value) => setGain(value as number)}
            min={-24}
            max={24}
          />
        </PanelSection>

        <PanelSection>
          <PanelTitle>Frequency Filter</PanelTitle>
          <ControlRow>
            <ControlLabel>High Pass</ControlLabel>
            <ControlValue>{highPass} Hz</ControlValue>
          </ControlRow>
          <ControlSlider
            value={highPass}
            onChange={(_, value) => setHighPass(value as number)}
            min={20}
            max={500}
          />

          <ControlRow sx={{ mt: 2 }}>
            <ControlLabel>Low Pass</ControlLabel>
            <ControlValue>{(lowPass / 1000).toFixed(1)}k</ControlValue>
          </ControlRow>
          <ControlSlider
            value={lowPass}
            onChange={(_, value) => setLowPass(value as number)}
            min={1000}
            max={20000}
          />
        </PanelSection>

        <PanelSection>
          <PanelTitle>EVP Analysis Tools</PanelTitle>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Tooltip title="Isolate Voice Frequencies">
              <ToolbarButton sx={{ border: '1px solid #2a2a2a', borderRadius: 1 }}>
                <EqualizerIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Spectral Repair">
              <ToolbarButton sx={{ border: '1px solid #2a2a2a', borderRadius: 1 }}>
                <AutoFixHighIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Remove Selection">
              <ToolbarButton sx={{ border: '1px solid #2a2a2a', borderRadius: 1 }}>
                <ContentCutIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
            <Tooltip title="Advanced Settings">
              <ToolbarButton sx={{ border: '1px solid #2a2a2a', borderRadius: 1 }}>
                <TuneIcon sx={{ fontSize: 18 }} />
              </ToolbarButton>
            </Tooltip>
          </Box>
        </PanelSection>

        <PanelSection sx={{ flex: 1 }}>
          <PanelTitle>Detected Anomalies</PanelTitle>
          <Box sx={{ fontSize: 12, color: '#606060' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: '#a0a0a0' }}>
              <span>00:02:34</span>
              <span style={{ color: '#f59e0b' }}>Voice-like pattern</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: '#a0a0a0' }}>
              <span>00:05:12</span>
              <span style={{ color: '#ef4444' }}>EVP candidate</span>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', color: '#a0a0a0' }}>
              <span>00:07:45</span>
              <span style={{ color: '#22c55e' }}>Ambient anomaly</span>
            </Box>
          </Box>
        </PanelSection>
      </ControlPanel>
    </ToolContainer>
  );
};

export default AudioTool;
