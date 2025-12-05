import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Slider,
  Collapse,
  Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import VideocamIcon from '@mui/icons-material/Videocam';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ReplayIcon from '@mui/icons-material/Replay';
import SpeedIcon from '@mui/icons-material/Speed';
import FlagIcon from '@mui/icons-material/Flag';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';
import { MetadataPanel } from '@/components/common';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useNavigationStore } from '@/stores/useNavigationStore';

// Styled components
const SpectrogramContainer = styled(Box)({
  flex: 1,
  backgroundColor: '#0a0a0a',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  cursor: 'crosshair',
});

const FrequencyScale = styled(Box)({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 40,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '8px 4px',
  fontSize: 9,
  color: '#666',
  fontFamily: '"JetBrains Mono", monospace',
});

const TimeScale = styled(Box)({
  height: 20,
  backgroundColor: '#111',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 48px 0 8px',
  fontSize: 9,
  color: '#666',
  fontFamily: '"JetBrains Mono", monospace',
  borderTop: '1px solid #252525',
});

const WaveformContainer = styled(Box)({
  height: 80,
  backgroundColor: '#0d0d0d',
  borderTop: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  gap: 8,
});

const ToolbarRow = styled(Box)({
  height: 36,
  backgroundColor: '#161616',
  borderTop: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
});

const VideoRefPanel = styled(Box)({
  position: 'absolute',
  top: 8,
  right: 56,
  width: 200,
  backgroundColor: '#1a1a1a',
  border: '1px solid #252525',
  borderRadius: 2,
  overflow: 'hidden',
  zIndex: 10,
});

const FilterSection = styled(Box)({
  marginBottom: 8,
});

const FilterHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  backgroundColor: '#1a1a1a',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: '#1f1f1f',
  },
});

const FilterContent = styled(Box)({
  padding: '8px 12px',
});

const FilterRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
  '&:last-child': {
    marginBottom: 0,
  },
});

// Mock audio evidence with format and GPS
const audioEvidence: (EvidenceItem & { format?: string; gps?: string | null; hasVideo?: boolean })[] = [
  { id: 'a1', type: 'audio', fileName: 'ambient_baseline.wav', duration: 1080, capturedAt: Date.now() - 7200000, user: 'Mike', deviceInfo: 'Zoom H6', flagCount: 0, hasFindings: false, format: '48kHz / 24-bit', gps: null, hasVideo: false },
  { id: 'a2', type: 'audio', fileName: 'recorder_01_evp_session.wav', duration: 1834, capturedAt: Date.now() - 6500000, user: 'Sarah', deviceInfo: 'Zoom H6', flagCount: 7, hasFindings: true, format: '48kHz / 24-bit', gps: '39.95°N, 75.16°W', hasVideo: false },
  { id: 'a3', type: 'audio', fileName: 'camera_01_audio_extract.wav', duration: 3847, capturedAt: Date.now() - 7000000, user: 'Sarah', deviceInfo: 'Sony A7IV', flagCount: 2, hasFindings: true, format: '48kHz / 16-bit', gps: '39.95°N, 75.16°W', hasVideo: true },
  { id: 'a4', type: 'audio', fileName: 'spirit_box_session.wav', duration: 923, capturedAt: Date.now() - 5800000, user: 'Jen', deviceInfo: 'Tascam DR-40X', flagCount: 2, hasFindings: true, format: '44.1kHz / 16-bit', gps: null, hasVideo: false },
];

interface AudioToolProps {
  investigationId?: string;
}

export const AudioTool: React.FC<AudioToolProps> = ({ investigationId }) => {
  const [selectedEvidence, setSelectedEvidence] = useState<typeof audioEvidence[0] | null>(null);
  const [loadedAudio, setLoadedAudio] = useState<typeof audioEvidence[0] | null>(null);
  const [videoRefVisible, setVideoRefVisible] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Selection state for spectral selection
  const [selection, setSelection] = useState<{
    startTime: number;
    endTime: number;
    lowFreq: number;
    highFreq: number;
  } | null>(null);

  // Filter sections collapsed state
  const [repairOpen, setRepairOpen] = useState(true);
  const [enhanceOpen, setEnhanceOpen] = useState(true);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);

  // Filter values
  const [filters, setFilters] = useState({
    deNoise: 0,
    deHum: 0,
    deClick: 0,
    eq: { low: 0, mid: 0, high: 0 },
    gain: 0,
    speed: 1,
  });

  const navigateToTool = useNavigationStore((state) => state.navigateToTool);
  const loadedFileId = useNavigationStore((state) => state.loadedFiles.audio);

  // Load file when navigated to
  useEffect(() => {
    if (loadedFileId) {
      const file = audioEvidence.find(f => f.id === loadedFileId);
      if (file) {
        setLoadedAudio(file);
        setSelectedEvidence(file);
      }
    }
  }, [loadedFileId]);

  const handleDoubleClick = useCallback((item: typeof audioEvidence[0]) => {
    setLoadedAudio(item);
    setSelectedEvidence(item);
  }, []);

  const handleFilterChange = (key: string, value: number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Generate fake spectrogram data for visual placeholder
  const renderSpectrogramPlaceholder = () => {
    if (!loadedAudio) return null;
    return (
      <Box sx={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0a0612 0%, #0d1a2e 30%, #1a2a1a 60%, #1a1a0a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Fake spectrogram lines */}
        {Array.from({ length: 50 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${(i / 50) * 100}%`,
              top: 0,
              bottom: 0,
              width: '2%',
              background: `linear-gradient(180deg,
                rgba(255,100,0,${Math.random() * 0.3}) 0%,
                rgba(255,150,0,${Math.random() * 0.5 + 0.2}) 30%,
                rgba(200,200,0,${Math.random() * 0.4}) 50%,
                rgba(0,150,100,${Math.random() * 0.3}) 70%,
                rgba(0,50,100,${Math.random() * 0.2}) 100%
              )`,
              opacity: 0.7 + Math.random() * 0.3,
            }}
          />
        ))}

        {/* Selection overlay */}
        {selection && (
          <Box sx={{
            position: 'absolute',
            left: `${selection.startTime}%`,
            right: `${100 - selection.endTime}%`,
            top: `${100 - selection.highFreq}%`,
            bottom: `${selection.lowFreq}%`,
            border: '2px solid #19abb5',
            backgroundColor: 'rgba(25, 171, 181, 0.2)',
            pointerEvents: 'none',
          }} />
        )}

        {/* Playhead */}
        <Box sx={{
          position: 'absolute',
          left: '30%',
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: '#19abb5',
          boxShadow: '0 0 8px rgba(25, 171, 181, 0.5)',
        }} />
      </Box>
    );
  };

  // Render fake waveform
  const renderWaveform = () => {
    if (!loadedAudio) {
      return (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: '#444', fontSize: 11 }}>No waveform</Typography>
        </Box>
      );
    }
    return (
      <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', gap: '1px', px: 1 }}>
        {Array.from({ length: 200 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: `${15 + Math.sin(i * 0.08) * 25 + Math.random() * 35}%`,
              backgroundColor: '#5a9a6b',
              borderRadius: 0.5,
              opacity: 0.8,
            }}
          />
        ))}
      </Box>
    );
  };

  // Inspector panel - categorized filters
  const inspectorContent = (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      {/* Repair Section */}
      <FilterSection>
        <FilterHeader onClick={() => setRepairOpen(!repairOpen)}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#ccc', textTransform: 'uppercase' }}>
            Repair
          </Typography>
          {repairOpen ? <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />}
        </FilterHeader>
        <Collapse in={repairOpen}>
          <FilterContent>
            <FilterRow>
              <Typography sx={{ fontSize: 11, color: '#888' }}>De-noise</Typography>
              <Slider
                size="small"
                value={filters.deNoise}
                onChange={(_, v) => handleFilterChange('deNoise', v as number)}
                min={0}
                max={100}
                sx={{ width: 100, color: '#19abb5' }}
                disabled={!loadedAudio}
              />
            </FilterRow>
            <FilterRow>
              <Typography sx={{ fontSize: 11, color: '#888' }}>De-hum (60Hz)</Typography>
              <Slider
                size="small"
                value={filters.deHum}
                onChange={(_, v) => handleFilterChange('deHum', v as number)}
                min={0}
                max={100}
                sx={{ width: 100, color: '#19abb5' }}
                disabled={!loadedAudio}
              />
            </FilterRow>
            <FilterRow>
              <Typography sx={{ fontSize: 11, color: '#888' }}>De-click</Typography>
              <Slider
                size="small"
                value={filters.deClick}
                onChange={(_, v) => handleFilterChange('deClick', v as number)}
                min={0}
                max={100}
                sx={{ width: 100, color: '#19abb5' }}
                disabled={!loadedAudio}
              />
            </FilterRow>
          </FilterContent>
        </Collapse>
      </FilterSection>

      {/* Enhance Section */}
      <FilterSection>
        <FilterHeader onClick={() => setEnhanceOpen(!enhanceOpen)}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#ccc', textTransform: 'uppercase' }}>
            Enhance
          </Typography>
          {enhanceOpen ? <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />}
        </FilterHeader>
        <Collapse in={enhanceOpen}>
          <FilterContent>
            <Typography sx={{ fontSize: 10, color: '#666', mb: 1 }}>EQ</Typography>
            <FilterRow>
              <Typography sx={{ fontSize: 10, color: '#666' }}>Low</Typography>
              <Slider
                size="small"
                value={filters.eq.low}
                onChange={(_, v) => setFilters(prev => ({ ...prev, eq: { ...prev.eq, low: v as number } }))}
                min={-12}
                max={12}
                sx={{ width: 80, color: '#19abb5' }}
                disabled={!loadedAudio}
              />
            </FilterRow>
            <FilterRow>
              <Typography sx={{ fontSize: 10, color: '#666' }}>Mid</Typography>
              <Slider
                size="small"
                value={filters.eq.mid}
                onChange={(_, v) => setFilters(prev => ({ ...prev, eq: { ...prev.eq, mid: v as number } }))}
                min={-12}
                max={12}
                sx={{ width: 80, color: '#19abb5' }}
                disabled={!loadedAudio}
              />
            </FilterRow>
            <FilterRow>
              <Typography sx={{ fontSize: 10, color: '#666' }}>High</Typography>
              <Slider
                size="small"
                value={filters.eq.high}
                onChange={(_, v) => setFilters(prev => ({ ...prev, eq: { ...prev.eq, high: v as number } }))}
                min={-12}
                max={12}
                sx={{ width: 80, color: '#19abb5' }}
                disabled={!loadedAudio}
              />
            </FilterRow>
            <FilterRow>
              <Typography sx={{ fontSize: 11, color: '#888' }}>Gain</Typography>
              <Slider
                size="small"
                value={filters.gain}
                onChange={(_, v) => handleFilterChange('gain', v as number)}
                min={-24}
                max={24}
                sx={{ width: 100, color: '#19abb5' }}
                disabled={!loadedAudio}
              />
            </FilterRow>
          </FilterContent>
        </Collapse>
      </FilterSection>

      {/* Analyze Section */}
      <FilterSection>
        <FilterHeader onClick={() => setAnalyzeOpen(!analyzeOpen)}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: '#ccc', textTransform: 'uppercase' }}>
            Analyze
          </Typography>
          {analyzeOpen ? <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />}
        </FilterHeader>
        <Collapse in={analyzeOpen}>
          <FilterContent>
            <FilterRow>
              <Typography sx={{ fontSize: 11, color: '#888' }}>Speed</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Slider
                  size="small"
                  value={filters.speed}
                  onChange={(_, v) => handleFilterChange('speed', v as number)}
                  min={0.25}
                  max={2}
                  step={0.25}
                  sx={{ width: 60, color: '#19abb5' }}
                  disabled={!loadedAudio}
                />
                <Typography sx={{ fontSize: 10, color: '#666', minWidth: 30 }}>
                  {filters.speed}x
                </Typography>
              </Box>
            </FilterRow>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button size="small" variant="outlined" sx={{ fontSize: 10, flex: 1, color: '#888', borderColor: '#333' }} disabled={!loadedAudio}>
                Reverse
              </Button>
              <Button size="small" variant="outlined" sx={{ fontSize: 10, flex: 1, color: '#888', borderColor: '#333' }} disabled={!loadedAudio}>
                Loop
              </Button>
            </Box>
          </FilterContent>
        </Collapse>
      </FilterSection>

      {/* Reset button */}
      <Box sx={{ padding: '12px' }}>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          sx={{ fontSize: 10, color: '#666', borderColor: '#333' }}
          disabled={!loadedAudio}
          onClick={() => setFilters({
            deNoise: 0,
            deHum: 0,
            deClick: 0,
            eq: { low: 0, mid: 0, high: 0 },
            gain: 0,
            speed: 1,
          })}
        >
          Reset All
        </Button>
      </Box>
    </Box>
  );

  // Main content - spectrogram focused
  const mainContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#0d0d0d' }}>
      {/* Spectrogram area */}
      <SpectrogramContainer>
        {loadedAudio ? (
          <>
            {renderSpectrogramPlaceholder()}

            {/* Frequency scale */}
            <FrequencyScale>
              <span>20k</span>
              <span>10k</span>
              <span>5k</span>
              <span>2k</span>
              <span>1k</span>
              <span>500</span>
              <span>200</span>
              <span>100</span>
              <span>Hz</span>
            </FrequencyScale>

            {/* Video reference panel - only if audio is from video */}
            {loadedAudio.hasVideo && videoRefVisible && (
              <VideoRefPanel>
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  borderBottom: '1px solid #252525',
                }}>
                  <Typography sx={{ fontSize: 9, color: '#888', textTransform: 'uppercase' }}>
                    Video Reference
                  </Typography>
                  <IconButton size="small" onClick={() => setVideoRefVisible(false)} sx={{ padding: '2px' }}>
                    <CloseIcon sx={{ fontSize: 12, color: '#666' }} />
                  </IconButton>
                </Box>
                <Box sx={{ height: 112, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography sx={{ color: '#333', fontSize: 10 }}>Synced video</Typography>
                </Box>
                <Button
                  fullWidth
                  size="small"
                  onClick={() => navigateToTool('video', loadedAudio.id)}
                  sx={{ fontSize: 9, color: '#19abb5', borderRadius: 0 }}
                >
                  Open in Video Tool
                </Button>
              </VideoRefPanel>
            )}
          </>
        ) : (
          <Box sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#444',
          }}>
            <MicIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography sx={{ fontSize: 14, color: '#555' }}>No audio loaded</Typography>
            <Typography sx={{ fontSize: 12, color: '#444', mt: 0.5 }}>
              Double-click an audio file in the Evidence panel
            </Typography>
          </Box>
        )}
      </SpectrogramContainer>

      {/* Time scale */}
      {loadedAudio && (
        <TimeScale>
          <span>0:00</span>
          <span>0:30</span>
          <span>1:00</span>
          <span>1:30</span>
          <span>2:00</span>
        </TimeScale>
      )}

      {/* Waveform */}
      <WaveformContainer>
        <Typography sx={{ fontSize: 10, color: '#666', width: 60 }}>WAVE</Typography>
        {renderWaveform()}
      </WaveformContainer>

      {/* Toolbar with zoom, selection tools, meters */}
      <ToolbarRow>
        <Tooltip title="Zoom in">
          <IconButton size="small" sx={{ color: '#666' }} disabled={!loadedAudio}>
            <ZoomInIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Zoom out">
          <IconButton size="small" sx={{ color: '#666' }} disabled={!loadedAudio}>
            <ZoomOutIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ width: 1, height: 20, backgroundColor: '#333', mx: 1 }} />

        {loadedAudio?.hasVideo && !videoRefVisible && (
          <Tooltip title="Show video reference">
            <IconButton size="small" onClick={() => setVideoRefVisible(true)} sx={{ color: '#666' }}>
              <VideocamIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="Add flag">
          <IconButton size="small" sx={{ color: '#666' }} disabled={!loadedAudio}>
            <FlagIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Level meters placeholder */}
        {loadedAudio && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 2 }}>
            <Typography sx={{ fontSize: 9, color: '#666', mr: 1 }}>L</Typography>
            <Box sx={{ width: 80, height: 8, backgroundColor: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
              <Box sx={{ width: '60%', height: '100%', backgroundColor: '#5a9a6b' }} />
            </Box>
            <Typography sx={{ fontSize: 9, color: '#666', ml: 2, mr: 1 }}>R</Typography>
            <Box sx={{ width: 80, height: 8, backgroundColor: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
              <Box sx={{ width: '55%', height: '100%', backgroundColor: '#5a9a6b' }} />
            </Box>
          </Box>
        )}

        {/* Timecode */}
        <Typography sx={{
          fontSize: 12,
          color: '#19abb5',
          fontFamily: '"JetBrains Mono", monospace',
          minWidth: 90,
          textAlign: 'right',
        }}>
          {loadedAudio ? '00:00:00.000' : '--:--:--.---'}
        </Typography>
      </ToolbarRow>
    </Box>
  );

  return (
    <WorkspaceLayout
      evidencePanel={
        <EvidenceBank
          items={audioEvidence}
          selectedId={selectedEvidence?.id}
          onSelect={(item) => setSelectedEvidence(item as typeof audioEvidence[0])}
          onDoubleClick={(item) => handleDoubleClick(item as typeof audioEvidence[0])}
          filterByType="audio"
        />
      }
      metadataPanel={
        <MetadataPanel
          data={selectedEvidence ? {
            fileName: selectedEvidence.fileName,
            capturedAt: selectedEvidence.capturedAt,
            duration: selectedEvidence.duration,
            user: selectedEvidence.user,
            device: selectedEvidence.deviceInfo,
            format: selectedEvidence.format,
            gps: selectedEvidence.gps || undefined,
            flagCount: selectedEvidence.flagCount,
          } : null}
          type="audio"
        />
      }
      inspectorPanel={inspectorContent}
      mainContent={mainContent}
      evidenceTitle="Audio Files"
      inspectorTitle="Filters"
      showTransport={true}
    />
  );
};

export default AudioTool;
