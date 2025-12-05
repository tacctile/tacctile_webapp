import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Slider,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import VideocamIcon from '@mui/icons-material/Videocam';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import LoopIcon from '@mui/icons-material/Loop';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';
import { MetadataPanel, PrecisionSlider, FlagsPanel, type Flag } from '@/components/common';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useNavigationStore } from '@/stores/useNavigationStore';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const MainContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: '#0d0d0d',
});

const SpectrogramSection = styled(Box)({
  flex: 1,
  minHeight: 0,
  position: 'relative',
  backgroundColor: '#0a0a0a',
  borderBottom: '1px solid #252525',
});

const FrequencyScale = styled(Box)({
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 36,
  backgroundColor: 'rgba(0,0,0,0.7)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '8px 4px',
  fontSize: 9,
  color: '#555',
  fontFamily: '"JetBrains Mono", monospace',
});

const TimeScale = styled(Box)({
  height: 18,
  backgroundColor: '#111',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 44px 0 8px',
  fontSize: 9,
  color: '#555',
  fontFamily: '"JetBrains Mono", monospace',
  borderBottom: '1px solid #252525',
});

const WaveformSection = styled(Box)({
  height: 60,
  backgroundColor: '#0d0d0d',
  borderBottom: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  gap: 8,
});

const EQSection = styled(Box)({
  height: 150,
  backgroundColor: '#0d0d0d',
  borderBottom: '1px solid #252525',
  display: 'flex',
  flexDirection: 'column',
});

const ToolbarSection = styled(Box)({
  height: 28,
  backgroundColor: '#161616',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 8,
  borderTop: '1px solid #252525',
});

const FilterSection = styled(Box)({
  padding: '8px 12px',
  borderBottom: '1px solid #252525',
});

const SectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
  marginBottom: 8,
});

const FilterBar = styled(Box)({
  height: 44,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  padding: '0 12px',
  gap: 16,
});

const FilterItem = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
});

const FilterItemLabel = styled(Typography)({
  fontSize: 10,
  color: '#666',
  minWidth: 55,
});

const MiniSlider = styled(Slider)({
  width: 70,
  color: '#19abb5',
  height: 3,
  padding: '6px 0',
  '& .MuiSlider-thumb': {
    width: 10,
    height: 10,
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#333',
  },
});

const FilterValue = styled(Typography)({
  fontSize: 10,
  color: '#888',
  minWidth: 35,
  textAlign: 'right',
  fontFamily: '"JetBrains Mono", monospace',
});

const FilterButton = styled(Button)({
  fontSize: 9,
  color: '#666',
  borderColor: '#333',
  padding: '4px 10px',
  minWidth: 'auto',
  '&:hover': {
    borderColor: '#19abb5',
    color: '#19abb5',
  },
});

// ============================================================================
// EQ COMPONENT
// ============================================================================

const EQ_BANDS = [
  { freq: 60, label: '60' },
  { freq: 125, label: '125' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1k' },
  { freq: 2000, label: '2k' },
  { freq: 4000, label: '4k' },
  { freq: 6000, label: '6k' },
  { freq: 8000, label: '8k' },
  { freq: 16000, label: '16k' },
];

interface IntegratedEQProps {
  values: number[];
  onChange: (index: number, value: number) => void;
  analyzerData: number[];
  disabled?: boolean;
}

const IntegratedEQ: React.FC<IntegratedEQProps> = ({ values, onChange, analyzerData, disabled }) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle drag start
  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setDraggingIndex(index);
  };

  // Handle dragging
  useEffect(() => {
    if (draggingIndex === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;
      // Map y position to +12 to -12 dB range (top = +12, bottom = -12)
      const value = Math.round(((height / 2 - y) / (height / 2)) * 12);
      const clampedValue = Math.max(-12, Math.min(12, value));
      onChange(draggingIndex, clampedValue);
    };

    const handleMouseUp = () => setDraggingIndex(null);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingIndex, onChange]);

  // Convert dB value to Y percentage (0-100, where 0 is top)
  const dbToY = (db: number) => 50 - (db / 12) * 45;

  // Generate smooth bezier curve path for EQ line
  const generateEQPath = () => {
    if (values.length === 0) return '';

    const points = values.map((v, i) => ({
      x: 5 + (i / (values.length - 1)) * 90, // 5% to 95% of width
      y: dbToY(v),
    }));

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const cp = (points[i - 1].x + points[i].x) / 2;
      path += ` C ${cp} ${points[i - 1].y}, ${cp} ${points[i].y}, ${points[i].x} ${points[i].y}`;
    }

    return path;
  };

  // Generate analyzer wave path (jagged, organic)
  const generateAnalyzerPath = () => {
    if (analyzerData.length === 0) return '';

    const points = analyzerData.map((level, i) => ({
      x: 5 + (i / (analyzerData.length - 1)) * 90,
      y: 50 - (level / 100) * 40, // Convert 0-100 level to Y position
    }));

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      // Slightly jagged line (not as smooth as EQ curve)
      path += ` L ${points[i].x} ${points[i].y}`;
    }

    return path;
  };

  // Reset single band on double-click
  const handleDoubleClick = (index: number) => {
    if (!disabled) {
      onChange(index, 0);
    }
  };

  // Reset single band via button
  const handleResetBand = (index: number) => {
    if (!disabled) {
      onChange(index, 0);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Main EQ Canvas */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#0a0a0a',
          borderRadius: 1,
          overflow: 'hidden',
          cursor: disabled ? 'default' : 'crosshair',
        }}
      >
        {/* Grid lines */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Horizontal grid lines */}
          <line x1="5" y1="5" x2="95" y2="5" stroke="#1a1a1a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="#2a2a2a" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="5" y1="95" x2="95" y2="95" stroke="#1a1a1a" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />

          {/* Vertical grid lines for each frequency */}
          {EQ_BANDS.map((_, i) => {
            const x = 5 + (i / (EQ_BANDS.length - 1)) * 90;
            return (
              <line
                key={i}
                x1={x}
                y1="5"
                x2={x}
                y2="95"
                stroke="#1a1a1a"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* dB labels */}
        <Box sx={{ position: 'absolute', left: 4, top: 2, fontSize: 8, color: '#444', fontFamily: '"JetBrains Mono", monospace' }}>
          +12
        </Box>
        <Box sx={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', fontSize: 8, color: '#555', fontFamily: '"JetBrains Mono", monospace' }}>
          0dB
        </Box>
        <Box sx={{ position: 'absolute', left: 4, bottom: 2, fontSize: 8, color: '#444', fontFamily: '"JetBrains Mono", monospace' }}>
          -12
        </Box>

        {/* Analyzer wave (behind) */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={generateAnalyzerPath()}
            fill="none"
            stroke="#3a4a3a"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
        </svg>

        {/* EQ Curve (on top) */}
        <svg
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={generateEQPath()}
            fill="none"
            stroke="#19abb5"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Draggable nodes */}
        {values.map((value, i) => {
          const x = 5 + (i / (values.length - 1)) * 90;
          const y = dbToY(value);
          return (
            <Box
              key={i}
              onMouseDown={handleMouseDown(i)}
              onDoubleClick={() => handleDoubleClick(i)}
              sx={{
                position: 'absolute',
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: disabled ? '#333' : value === 0 ? '#19abb5' : '#4dd4df',
                border: '2px solid #0a0a0a',
                cursor: disabled ? 'default' : 'ns-resize',
                zIndex: draggingIndex === i ? 10 : 1,
                transition: draggingIndex === i ? 'none' : 'top 0.05s ease-out',
                boxShadow: value !== 0 ? '0 0 8px rgba(25, 171, 181, 0.5)' : 'none',
                '&:hover': {
                  backgroundColor: disabled ? '#333' : '#6ee4ec',
                  transform: 'translate(-50%, -50%) scale(1.15)',
                },
              }}
            />
          );
        })}
      </Box>

      {/* Frequency labels + reset buttons */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '6px 5% 0',
        alignItems: 'center',
      }}>
        {EQ_BANDS.map((band, i) => (
          <Box
            key={band.freq}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Typography sx={{ fontSize: 8, color: '#555', fontFamily: '"JetBrains Mono", monospace' }}>
              {band.label}
            </Typography>
            <Box
              onClick={() => handleResetBand(i)}
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '1px solid #333',
                backgroundColor: values[i] === 0 ? 'transparent' : '#252525',
                cursor: disabled ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  borderColor: disabled ? '#333' : '#19abb5',
                  backgroundColor: disabled ? 'transparent' : 'rgba(25, 171, 181, 0.1)',
                },
              }}
            >
              {values[i] !== 0 && (
                <Box sx={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: '#19abb5' }} />
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ============================================================================
// MOCK DATA
// ============================================================================

const audioEvidence: (EvidenceItem & { format?: string; gps?: string | null; hasVideo?: boolean })[] = [
  { id: 'a1', type: 'audio', fileName: 'ambient_baseline.wav', duration: 1080, capturedAt: Date.now() - 7200000, user: 'Mike', deviceInfo: 'Zoom H6', flagCount: 0, hasFindings: false, format: '48kHz / 24-bit', gps: null, hasVideo: false },
  { id: 'a2', type: 'audio', fileName: 'recorder_01_evp_session.wav', duration: 1834, capturedAt: Date.now() - 6500000, user: 'Sarah', deviceInfo: 'Zoom H6', flagCount: 7, hasFindings: true, format: '48kHz / 24-bit', gps: '39.95°N, 75.16°W', hasVideo: false },
  { id: 'a3', type: 'audio', fileName: 'camera_01_audio_extract.wav', duration: 3847, capturedAt: Date.now() - 7000000, user: 'Sarah', deviceInfo: 'Sony A7IV', flagCount: 2, hasFindings: true, format: '48kHz / 16-bit', gps: '39.95°N, 75.16°W', hasVideo: true },
  { id: 'a4', type: 'audio', fileName: 'spirit_box_session.wav', duration: 923, capturedAt: Date.now() - 5800000, user: 'Jen', deviceInfo: 'Tascam DR-40X', flagCount: 2, hasFindings: true, format: '44.1kHz / 16-bit', gps: null, hasVideo: false },
];

const mockFlags: Flag[] = [
  { id: 'f1', timestamp: 142000, label: 'Whisper', note: 'Possible voice, sounds like "hello" or "help". Class B EVP.', createdBy: 'Sarah', createdAt: Date.now() - 3600000 },
  { id: 'f2', timestamp: 287000, label: 'Knock', note: 'Three distinct knocks in response to question.', createdBy: 'Sarah', createdAt: Date.now() - 3000000 },
  { id: 'f3', timestamp: 445000, label: 'Static burst', createdBy: 'Mike', createdAt: Date.now() - 2400000 },
  { id: 'f4', timestamp: 612000, label: 'Voice?', note: 'Very faint, needs enhancement. Possibly saying a name.', createdBy: 'Sarah', createdAt: Date.now() - 1800000 },
  { id: 'f5', timestamp: 823000, label: 'Breath sound', createdBy: 'Jen', createdAt: Date.now() - 1200000 },
  { id: 'f6', timestamp: 1105000, label: 'EVP Response', note: 'Clear response to "Is anyone here?" - sounds like "yes"', createdBy: 'Sarah', createdAt: Date.now() - 600000 },
  { id: 'f7', timestamp: 1342000, label: 'Footsteps?', note: 'Rhythmic sounds, could be footsteps or pipes.', createdBy: 'Mike', createdAt: Date.now() - 300000 },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface AudioToolProps {
  investigationId?: string;
}

export const AudioTool: React.FC<AudioToolProps> = ({ investigationId }) => {
  const [selectedEvidence, setSelectedEvidence] = useState<typeof audioEvidence[0] | null>(null);
  const [loadedAudio, setLoadedAudio] = useState<typeof audioEvidence[0] | null>(null);
  const [videoRefVisible, setVideoRefVisible] = useState(true);
  const [flags, setFlags] = useState<Flag[]>(mockFlags);

  // Filter values
  const [filters, setFilters] = useState({
    deNoise: 0,
    deHum: 0,
    gain: 0,
    speed: 1,
  });

  // EQ values (-12 to +12 dB for each band)
  const [eqValues, setEqValues] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  // Simulated meter levels (would come from Web Audio API in real implementation)
  const [meterLevels, setMeterLevels] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  const navigateToTool = useNavigationStore((state) => state.navigateToTool);
  const loadedFileId = useNavigationStore((state) => state.loadedFiles.audio);

  // Simulate bouncing meters when audio is loaded
  useEffect(() => {
    if (!loadedAudio) {
      setMeterLevels([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      return;
    }

    const interval = setInterval(() => {
      setMeterLevels(prev => prev.map((_, i) => {
        // Simulate frequency distribution (more energy in low-mids)
        const baseLevel = 40 + Math.sin(i * 0.5) * 20;
        const variation = Math.random() * 30;
        return Math.min(100, Math.max(0, baseLevel + variation));
      }));
    }, 100);

    return () => clearInterval(interval);
  }, [loadedAudio]);

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

  const handleEQChange = useCallback((index: number, value: number) => {
    setEqValues(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  const resetEQ = useCallback(() => {
    setEqValues([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }, []);

  // Render spectrogram placeholder
  const renderSpectrogram = () => {
    if (!loadedAudio) {
      return (
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
      );
    }

    return (
      <Box sx={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(180deg, #0a0612 0%, #0d1a2e 30%, #1a2a1a 60%, #1a1a0a 100%)',
        position: 'relative',
      }}>
        {/* Fake spectrogram visualization */}
        {Array.from({ length: 60 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${(i / 60) * 100}%`,
              top: 0,
              bottom: 0,
              width: '1.5%',
              background: `linear-gradient(180deg,
                rgba(255,100,0,${Math.random() * 0.4}) 0%,
                rgba(255,150,0,${Math.random() * 0.6 + 0.2}) 30%,
                rgba(200,200,0,${Math.random() * 0.5}) 50%,
                rgba(0,150,100,${Math.random() * 0.4}) 70%,
                rgba(0,50,100,${Math.random() * 0.2}) 100%
              )`,
              opacity: 0.6 + Math.random() * 0.4,
            }}
          />
        ))}

        {/* Playhead */}
        <Box sx={{
          position: 'absolute',
          left: '35%',
          top: 0,
          bottom: 0,
          width: 2,
          backgroundColor: '#19abb5',
          boxShadow: '0 0 8px rgba(25, 171, 181, 0.5)',
          zIndex: 5,
        }} />
      </Box>
    );
  };

  // Render waveform placeholder
  const renderWaveform = () => {
    if (!loadedAudio) {
      return (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: '#333', fontSize: 10 }}>No waveform</Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', gap: '1px' }}>
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

  // Right panel content - Video Reference (if applicable) + Flags
  const inspectorContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Video Reference - only show if audio is from video */}
      {loadedAudio?.hasVideo && (
        <Box sx={{
          height: 150,
          flexShrink: 0,
          borderBottom: '1px solid #252525',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            backgroundColor: '#1e1e1e',
          }}>
            <Typography sx={{ fontSize: 9, color: '#666', textTransform: 'uppercase', fontWeight: 600 }}>
              Video Reference
            </Typography>
            <IconButton
              size="small"
              onClick={() => setVideoRefVisible(!videoRefVisible)}
              sx={{ padding: '2px', color: '#555' }}
            >
              {videoRefVisible ? <CloseIcon sx={{ fontSize: 12 }} /> : <VideocamIcon sx={{ fontSize: 12 }} />}
            </IconButton>
          </Box>
          {videoRefVisible ? (
            <>
              <Box sx={{ flex: 1, backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: '#333', fontSize: 10 }}>Synced video</Typography>
              </Box>
              <Button
                fullWidth
                size="small"
                onClick={() => navigateToTool('video', loadedAudio?.id)}
                sx={{ fontSize: 9, color: '#19abb5', borderRadius: 0, py: 0.5, borderTop: '1px solid #252525' }}
              >
                Open in Video Tool
              </Button>
            </>
          ) : (
            <Box
              sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backgroundColor: '#0d0d0d' }}
              onClick={() => setVideoRefVisible(true)}
            >
              <Typography sx={{ color: '#444', fontSize: 10 }}>Click to show</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Flags - takes all remaining space */}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <FlagsPanel
          flags={flags}
          onFlagClick={(flag) => console.log('Jump to:', flag.timestamp)}
          onFlagAdd={() => console.log('Add flag')}
          onFlagEdit={(flag) => console.log('Edit flag:', flag.id)}
          onFlagDelete={(flagId) => setFlags(prev => prev.filter(f => f.id !== flagId))}
          disabled={!loadedAudio}
        />
      </Box>
    </Box>
  );

  // Main content
  const mainContent = (
    <MainContainer>
      {/* Spectrogram */}
      <SpectrogramSection>
        {renderSpectrogram()}

        {/* Frequency scale */}
        {loadedAudio && (
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
        )}
      </SpectrogramSection>

      {/* Time scale */}
      {loadedAudio && (
        <TimeScale>
          <span>0:00</span>
          <span>5:00</span>
          <span>10:00</span>
          <span>15:00</span>
          <span>20:00</span>
          <span>25:00</span>
          <span>30:00</span>
        </TimeScale>
      )}

      {/* Waveform */}
      <WaveformSection>
        <Typography sx={{ fontSize: 10, color: '#555', width: 50 }}>WAVE</Typography>
        {renderWaveform()}
      </WaveformSection>

      {/* EQ Section - thinner header */}
      <EQSection>
        <Box sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: 24,
          px: 1,
          borderBottom: '1px solid #1a1a1a',
        }}>
          <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#555', textTransform: 'uppercase' }}>
            EQ
          </Typography>
          <Button
            size="small"
            onClick={resetEQ}
            disabled={!loadedAudio}
            sx={{ fontSize: 8, color: '#444', minWidth: 'auto', py: 0, px: 1, '&:hover': { color: '#19abb5' } }}
          >
            Reset
          </Button>
        </Box>

        <Box sx={{ flex: 1, p: 1 }}>
          <IntegratedEQ
            values={eqValues}
            onChange={handleEQChange}
            analyzerData={meterLevels}
            disabled={!loadedAudio}
          />
        </Box>
      </EQSection>

      {/* Filter Bar - always visible */}
      <FilterBar>
        <FilterItem>
          <FilterItemLabel>De-noise</FilterItemLabel>
          <MiniSlider
            value={filters.deNoise}
            onChange={(_, v) => setFilters(prev => ({ ...prev, deNoise: v as number }))}
            min={0}
            max={100}
            disabled={!loadedAudio}
          />
          <FilterValue>{filters.deNoise}%</FilterValue>
        </FilterItem>

        <FilterItem>
          <FilterItemLabel>De-hum</FilterItemLabel>
          <MiniSlider
            value={filters.deHum}
            onChange={(_, v) => setFilters(prev => ({ ...prev, deHum: v as number }))}
            min={0}
            max={100}
            disabled={!loadedAudio}
          />
          <FilterValue>{filters.deHum}%</FilterValue>
        </FilterItem>

        <FilterItem>
          <FilterItemLabel>Gain</FilterItemLabel>
          <MiniSlider
            value={filters.gain}
            onChange={(_, v) => setFilters(prev => ({ ...prev, gain: v as number }))}
            min={-24}
            max={24}
            disabled={!loadedAudio}
          />
          <FilterValue>{filters.gain > 0 ? '+' : ''}{filters.gain}dB</FilterValue>
        </FilterItem>

        <FilterItem>
          <FilterItemLabel>Speed</FilterItemLabel>
          <MiniSlider
            value={filters.speed}
            onChange={(_, v) => setFilters(prev => ({ ...prev, speed: v as number }))}
            min={0.25}
            max={2}
            step={0.25}
            disabled={!loadedAudio}
          />
          <FilterValue>{filters.speed}x</FilterValue>
        </FilterItem>

        {/* Just a spacer - NO background color */}
        <Box sx={{ flex: 1 }} />

        <Button
          size="small"
          onClick={() => setFilters({ deNoise: 0, deHum: 0, gain: 0, speed: 1 })}
          disabled={!loadedAudio}
          sx={{ fontSize: 9, color: '#555', '&:hover': { color: '#19abb5' } }}
        >
          Reset Filters
        </Button>
      </FilterBar>

      {/* Bottom toolbar - clean and minimal */}
      <ToolbarSection>
        {loadedAudio?.hasVideo && !videoRefVisible && (
          <Tooltip title="Show video reference">
            <IconButton size="small" onClick={() => setVideoRefVisible(true)} sx={{ color: '#666' }}>
              <VideocamIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}

        <Box sx={{ flex: 1 }} />

        {/* Level meters */}
        {loadedAudio && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 2 }}>
            <Typography sx={{ fontSize: 9, color: '#555', mr: 1 }}>L</Typography>
            <Box sx={{ width: 60, height: 6, backgroundColor: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
              <Box sx={{ width: '65%', height: '100%', backgroundColor: '#5a9a6b' }} />
            </Box>
            <Typography sx={{ fontSize: 9, color: '#555', ml: 2, mr: 1 }}>R</Typography>
            <Box sx={{ width: 60, height: 6, backgroundColor: '#1a1a1a', borderRadius: 1, overflow: 'hidden' }}>
              <Box sx={{ width: '58%', height: '100%', backgroundColor: '#5a9a6b' }} />
            </Box>
          </Box>
        )}

        {/* Timecode */}
        <Typography sx={{
          fontSize: 11,
          color: '#19abb5',
          fontFamily: '"JetBrains Mono", monospace',
          minWidth: 80,
          textAlign: 'right',
        }}>
          {loadedAudio ? '00:10:32.450' : '--:--:--.---'}
        </Typography>
      </ToolbarSection>
    </MainContainer>
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
      inspectorTitle=""
      showTransport={true}
    />
  );
};

export default AudioTool;
