import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Slider,
  Snackbar,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import MicIcon from '@mui/icons-material/Mic';
import VideocamIcon from '@mui/icons-material/Videocam';
import CloseIcon from '@mui/icons-material/Close';
import ReplayIcon from '@mui/icons-material/Replay';
import LoopIcon from '@mui/icons-material/Loop';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import FastRewindIcon from '@mui/icons-material/FastRewind';
import FastForwardIcon from '@mui/icons-material/FastForward';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FileUploadIcon from '@mui/icons-material/FileUpload';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';
import { MetadataPanel, PrecisionSlider, FlagsPanel, type Flag } from '@/components/common';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import {
  isFileType,
  getFileTypeErrorMessage,
  getAcceptString,
} from '@/utils/fileTypes';

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
  height: 64,
  backgroundColor: '#1a1a1a',
  borderBottom: '1px solid #252525',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  gap: 16,
});

const FilterItem = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: 1,
  maxWidth: 200,
});

const FilterItemLabel = styled(Typography)({
  fontSize: 9,
  color: '#666',
  whiteSpace: 'nowrap',
  textTransform: 'uppercase',
  fontWeight: 600,
});

const MiniSlider = styled(Slider)({
  color: '#19abb5',
  height: 3,
  '& .MuiSlider-thumb': {
    width: 10,
    height: 10,
  },
  '& .MuiSlider-rail': {
    backgroundColor: '#333',
  },
});

const FilterValue = styled(Typography)({
  fontSize: 9,
  color: '#888',
  textAlign: 'center',
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

const FilterResetButton = styled(IconButton)({
  padding: 2,
  width: 16,
  height: 16,
  color: '#666',
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
});

// File drop zone for center canvas when no file loaded
const FileDropZone = styled(Box)<{ isActive: boolean }>(({ isActive }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  color: isActive ? '#19abb5' : '#444',
  backgroundColor: isActive ? 'rgba(25, 171, 181, 0.08)' : 'transparent',
  border: isActive ? '2px dashed #19abb5' : '2px dashed transparent',
  borderRadius: 8,
  margin: 16,
  transition: 'all 0.2s ease',
  cursor: 'pointer',
}));

// Import button for left panel
const ImportButton = styled(Button)({
  fontSize: 9,
  color: '#888',
  backgroundColor: '#252525',
  border: '1px solid #333',
  padding: '4px 8px',
  textTransform: 'none',
  minWidth: 'auto',
  '&:hover': {
    backgroundColor: '#333',
    borderColor: '#19abb5',
    color: '#19abb5',
  },
  '& .MuiButton-startIcon': {
    marginRight: 4,
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
  { id: 'a2', type: 'audio', fileName: 'recorder_01_audio_session.wav', duration: 1834, capturedAt: Date.now() - 6500000, user: 'Sarah', deviceInfo: 'Zoom H6', flagCount: 7, hasFindings: true, format: '48kHz / 24-bit', gps: '39.95°N, 75.16°W', hasVideo: false },
  { id: 'a3', type: 'audio', fileName: 'camera_01_audio_extract.wav', duration: 3847, capturedAt: Date.now() - 7000000, user: 'Sarah', deviceInfo: 'Sony A7IV', flagCount: 2, hasFindings: true, format: '48kHz / 16-bit', gps: '39.95°N, 75.16°W', hasVideo: true },
  { id: 'a4', type: 'audio', fileName: 'radio_sweep_session.wav', duration: 923, capturedAt: Date.now() - 5800000, user: 'Jen', deviceInfo: 'Tascam DR-40X', flagCount: 2, hasFindings: true, format: '44.1kHz / 16-bit', gps: null, hasVideo: false },
];

const mockFlags: Flag[] = [
  { id: 'f1', timestamp: 142000, label: 'Whisper', note: 'Possible voice, sounds like "hello" or "help". Class B audio anomaly.', createdBy: 'Sarah', createdAt: Date.now() - 3600000 },
  { id: 'f2', timestamp: 287000, label: 'Knock', note: 'Three distinct knocks in response to question.', createdBy: 'Sarah', createdAt: Date.now() - 3000000 },
  { id: 'f3', timestamp: 445000, label: 'Static burst', createdBy: 'Mike', createdAt: Date.now() - 2400000 },
  { id: 'f4', timestamp: 612000, label: 'Voice?', note: 'Very faint, needs enhancement. Possibly saying a name.', createdBy: 'Sarah', createdAt: Date.now() - 1800000 },
  { id: 'f5', timestamp: 823000, label: 'Breath sound', createdBy: 'Jen', createdAt: Date.now() - 1200000 },
  { id: 'f6', timestamp: 1105000, label: 'Audio Response', note: 'Clear response to "Is anyone here?" - sounds like "yes"', createdBy: 'Sarah', createdAt: Date.now() - 600000 },
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
  const [reverseEnabled, setReverseEnabled] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [hoveredFilter, setHoveredFilter] = useState<string | null>(null);

  // File drop zone state
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notification state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Filter values
  const [filters, setFilters] = useState({
    deNoise: 0,
    deHum: 0,
    lowCut: 20,      // 20Hz = off, up to 500Hz
    highCut: 20000,  // 20kHz = off, down to 2kHz
    clarity: 0,      // -12 to +12 dB
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

  const resetFilter = useCallback((filterName: keyof typeof filters) => {
    const defaults = {
      deNoise: 0,
      deHum: 0,
      lowCut: 20,
      highCut: 20000,
      clarity: 0,
    };
    setFilters(prev => ({ ...prev, [filterName]: defaults[filterName] }));
  }, []);

  const resetAllFilters = useCallback(() => {
    setFilters({ deNoise: 0, deHum: 0, lowCut: 20, highCut: 20000, clarity: 0 });
  }, []);

  const formatFilterValue = (filterName: keyof typeof filters, value: number) => {
    switch (filterName) {
      case 'deNoise':
      case 'deHum':
        return `${value}%`;
      case 'lowCut':
        return value === 20 ? 'Off' : `${value}Hz`;
      case 'highCut':
        return value === 20000 ? 'Off' : value >= 10000 ? `${(value/1000).toFixed(0)}k` : `${(value/1000).toFixed(1)}k`;
      case 'clarity':
        return value === 0 ? '0' : `${value > 0 ? '+' : ''}${value}dB`;
      default:
        return String(value);
    }
  };

  const isFilterAtDefault = (filterName: keyof typeof filters) => {
    const defaults = {
      deNoise: 0,
      deHum: 0,
      lowCut: 20,
      highCut: 20000,
      clarity: 0,
    };
    return filters[filterName] === defaults[filterName];
  };

  // ============================================================================
  // FILE DROP ZONE HANDLERS
  // ============================================================================

  // Show toast notification
  const showToast = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ open: true, message, severity });
  }, []);

  // Close toast
  const handleCloseToast = useCallback(() => {
    setToast(prev => ({ ...prev, open: false }));
  }, []);

  // Process dropped/imported audio file
  const processAudioFile = useCallback((file: File) => {
    if (!isFileType(file, 'audio')) {
      showToast(getFileTypeErrorMessage('audio'), 'error');
      return;
    }

    // Create a mock audio item from the imported file (Quick Analysis Mode)
    const mockItem = {
      id: `import-${Date.now()}`,
      type: 'audio' as const,
      fileName: file.name,
      duration: 180, // Default 3 minutes
      capturedAt: Date.now(),
      user: 'Imported',
      deviceInfo: 'Imported File',
      format: file.type || 'audio/unknown',
      sampleRate: 44100,
      channels: 2,
      flagCount: 0,
    };

    setLoadedAudio(mockItem);
    setSelectedEvidence(mockItem);
    showToast(`Loaded: ${file.name}`, 'success');
  }, [showToast]);

  // Handle file drag enter
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsFileDragOver(true);
    }
  }, []);

  // Handle file drag leave
  const handleFileDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);
  }, []);

  // Handle file drag over
  const handleFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  // Handle file drop
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFileDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processAudioFile(files[0]); // Only process first file for single-file tools
    }
  }, [processAudioFile]);

  // Handle Import button click
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processAudioFile(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processAudioFile]);

  // Handle drop zone click
  const handleDropZoneClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Render spectrogram placeholder (with drop zone when no file)
  const renderSpectrogram = () => {
    if (!loadedAudio) {
      return (
        <FileDropZone
          isActive={isFileDragOver}
          onDragEnter={handleFileDragEnter}
          onDragLeave={handleFileDragLeave}
          onDragOver={handleFileDragOver}
          onDrop={handleFileDrop}
          onClick={handleDropZoneClick}
        >
          <MicIcon sx={{ fontSize: 64, mb: 2, opacity: isFileDragOver ? 0.8 : 0.3 }} />
          <Typography sx={{ fontSize: 14, color: isFileDragOver ? '#19abb5' : '#555' }}>
            {isFileDragOver ? 'Drop audio file here' : 'No audio loaded'}
          </Typography>
          <Typography sx={{ fontSize: 12, color: '#444', mt: 0.5 }}>
            {isFileDragOver ? 'Release to import' : 'Drag & drop or click to import audio files'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: '#333', mt: 1 }}>
            .mp3, .wav, .ogg, .m4a, .flac, .aac
          </Typography>
        </FileDropZone>
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

      {/* Filter Bar - 5 filters evenly spaced */}
      <FilterBar>
        <FilterItem
          onMouseEnter={() => setHoveredFilter('deNoise')}
          onMouseLeave={() => setHoveredFilter(null)}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 16 }}>
            <FilterItemLabel>De-noise</FilterItemLabel>
            {hoveredFilter === 'deNoise' && !isFilterAtDefault('deNoise') && (
              <FilterResetButton onClick={() => resetFilter('deNoise')} disabled={!loadedAudio}>
                <CloseIcon sx={{ fontSize: 10 }} />
              </FilterResetButton>
            )}
          </Box>
          <MiniSlider
            value={filters.deNoise}
            onChange={(_, v) => setFilters(prev => ({ ...prev, deNoise: v as number }))}
            min={0}
            max={100}
            disabled={!loadedAudio}
          />
          <FilterValue>{formatFilterValue('deNoise', filters.deNoise)}</FilterValue>
        </FilterItem>

        <FilterItem
          onMouseEnter={() => setHoveredFilter('deHum')}
          onMouseLeave={() => setHoveredFilter(null)}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 16 }}>
            <FilterItemLabel>De-hum</FilterItemLabel>
            {hoveredFilter === 'deHum' && !isFilterAtDefault('deHum') && (
              <FilterResetButton onClick={() => resetFilter('deHum')} disabled={!loadedAudio}>
                <CloseIcon sx={{ fontSize: 10 }} />
              </FilterResetButton>
            )}
          </Box>
          <MiniSlider
            value={filters.deHum}
            onChange={(_, v) => setFilters(prev => ({ ...prev, deHum: v as number }))}
            min={0}
            max={100}
            disabled={!loadedAudio}
          />
          <FilterValue>{formatFilterValue('deHum', filters.deHum)}</FilterValue>
        </FilterItem>

        <FilterItem
          onMouseEnter={() => setHoveredFilter('lowCut')}
          onMouseLeave={() => setHoveredFilter(null)}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 16 }}>
            <FilterItemLabel>Low Cut</FilterItemLabel>
            {hoveredFilter === 'lowCut' && !isFilterAtDefault('lowCut') && (
              <FilterResetButton onClick={() => resetFilter('lowCut')} disabled={!loadedAudio}>
                <CloseIcon sx={{ fontSize: 10 }} />
              </FilterResetButton>
            )}
          </Box>
          <MiniSlider
            value={filters.lowCut}
            onChange={(_, v) => setFilters(prev => ({ ...prev, lowCut: v as number }))}
            min={20}
            max={500}
            disabled={!loadedAudio}
          />
          <FilterValue>{formatFilterValue('lowCut', filters.lowCut)}</FilterValue>
        </FilterItem>

        <FilterItem
          onMouseEnter={() => setHoveredFilter('highCut')}
          onMouseLeave={() => setHoveredFilter(null)}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 16 }}>
            <FilterItemLabel>High Cut</FilterItemLabel>
            {hoveredFilter === 'highCut' && !isFilterAtDefault('highCut') && (
              <FilterResetButton onClick={() => resetFilter('highCut')} disabled={!loadedAudio}>
                <CloseIcon sx={{ fontSize: 10 }} />
              </FilterResetButton>
            )}
          </Box>
          <MiniSlider
            value={filters.highCut}
            onChange={(_, v) => setFilters(prev => ({ ...prev, highCut: v as number }))}
            min={2000}
            max={20000}
            step={100}
            disabled={!loadedAudio}
          />
          <FilterValue>{formatFilterValue('highCut', filters.highCut)}</FilterValue>
        </FilterItem>

        <FilterItem
          onMouseEnter={() => setHoveredFilter('clarity')}
          onMouseLeave={() => setHoveredFilter(null)}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 16 }}>
            <FilterItemLabel>Clarity</FilterItemLabel>
            {hoveredFilter === 'clarity' && !isFilterAtDefault('clarity') && (
              <FilterResetButton onClick={() => resetFilter('clarity')} disabled={!loadedAudio}>
                <CloseIcon sx={{ fontSize: 10 }} />
              </FilterResetButton>
            )}
          </Box>
          <MiniSlider
            value={filters.clarity}
            onChange={(_, v) => setFilters(prev => ({ ...prev, clarity: v as number }))}
            min={-12}
            max={12}
            disabled={!loadedAudio}
          />
          <FilterValue>{formatFilterValue('clarity', filters.clarity)}</FilterValue>
        </FilterItem>

        <Button
          size="small"
          onClick={resetAllFilters}
          disabled={!loadedAudio}
          sx={{ fontSize: 9, color: '#555', alignSelf: 'center', '&:hover': { color: '#19abb5' } }}
        >
          Reset All
        </Button>
      </FilterBar>

      {/* Audio Transport - centered with Rev/Loop toggle buttons */}
      <Box sx={{
        height: 96,
        backgroundColor: '#161616',
        borderTop: '1px solid #252525',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        px: 3,
      }}>
        {/* Timecode */}
        <Typography sx={{
          fontSize: 24,
          color: '#19abb5',
          fontFamily: '"JetBrains Mono", monospace',
          minWidth: 160,
        }}>
          {loadedAudio ? '00:00:00' : '--:--:--'}
        </Typography>

        {/* Playback controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton disabled={!loadedAudio} sx={{ color: '#888', p: 1.5 }}>
            <SkipPreviousIcon sx={{ fontSize: 40 }} />
          </IconButton>
          <IconButton disabled={!loadedAudio} sx={{ color: '#888', p: 1.5 }}>
            <FastRewindIcon sx={{ fontSize: 40 }} />
          </IconButton>
          <IconButton
            disabled={!loadedAudio}
            sx={{
              color: '#19abb5',
              backgroundColor: 'rgba(25, 171, 181, 0.15)',
              mx: 1.5,
              p: 2,
              border: '2px solid rgba(25, 171, 181, 0.4)',
              '&:hover': {
                backgroundColor: 'rgba(25, 171, 181, 0.25)',
                border: '2px solid rgba(25, 171, 181, 0.6)',
              }
            }}
          >
            <PlayArrowIcon sx={{ fontSize: 56 }} />
          </IconButton>
          <IconButton disabled={!loadedAudio} sx={{ color: '#888', p: 1.5 }}>
            <FastForwardIcon sx={{ fontSize: 40 }} />
          </IconButton>
          <IconButton disabled={!loadedAudio} sx={{ color: '#888', p: 1.5 }}>
            <SkipNextIcon sx={{ fontSize: 40 }} />
          </IconButton>

          {/* Reverse toggle button */}
          <IconButton
            disabled={!loadedAudio}
            onClick={() => setReverseEnabled(!reverseEnabled)}
            sx={{
              color: reverseEnabled ? '#19abb5' : '#666',
              backgroundColor: reverseEnabled ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
              border: '2px solid',
              borderColor: reverseEnabled ? '#19abb5' : '#333',
              ml: 2,
              p: 1.5,
              '&:hover': {
                backgroundColor: reverseEnabled ? 'rgba(25, 171, 181, 0.25)' : 'rgba(25, 171, 181, 0.1)',
                borderColor: '#19abb5',
              }
            }}
          >
            <Tooltip title="Reverse">
              <ReplayIcon sx={{ fontSize: 36 }} />
            </Tooltip>
          </IconButton>

          {/* Loop toggle button */}
          <IconButton
            disabled={!loadedAudio}
            onClick={() => setLoopEnabled(!loopEnabled)}
            sx={{
              color: loopEnabled ? '#19abb5' : '#666',
              backgroundColor: loopEnabled ? 'rgba(25, 171, 181, 0.15)' : 'transparent',
              border: '2px solid',
              borderColor: loopEnabled ? '#19abb5' : '#333',
              p: 1.5,
              '&:hover': {
                backgroundColor: loopEnabled ? 'rgba(25, 171, 181, 0.25)' : 'rgba(25, 171, 181, 0.1)',
                borderColor: '#19abb5',
              }
            }}
          >
            <Tooltip title="Loop">
              <LoopIcon sx={{ fontSize: 36 }} />
            </Tooltip>
          </IconButton>
        </Box>
      </Box>
    </MainContainer>
  );

  return (
    <>
      {/* Hidden file input for imports */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptString('audio')}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <WorkspaceLayout
        evidencePanel={
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Import button header */}
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              padding: '4px 8px',
              borderBottom: '1px solid #252525',
              backgroundColor: '#1a1a1a',
            }}>
              <ImportButton
                startIcon={<FileUploadIcon sx={{ fontSize: 12 }} />}
                onClick={handleImportClick}
              >
                Import
              </ImportButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <EvidenceBank
                items={audioEvidence}
                selectedId={selectedEvidence?.id}
                onSelect={(item) => setSelectedEvidence(item as typeof audioEvidence[0])}
                onDoubleClick={(item) => handleDoubleClick(item as typeof audioEvidence[0])}
                filterByType="audio"
              />
            </Box>
          </Box>
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
        showTransport={false}
      />

      {/* Toast notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          sx={{
            width: '100%',
            backgroundColor: toast.severity === 'success' ? '#1e3d1e' :
                           toast.severity === 'error' ? '#3d1e1e' : '#1e2d3d',
            color: '#e1e1e1',
            border: `1px solid ${
              toast.severity === 'success' ? '#5a9a6b' :
              toast.severity === 'error' ? '#c45c5c' : '#19abb5'
            }`,
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AudioTool;
