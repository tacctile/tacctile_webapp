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
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import { WorkspaceLayout } from '@/components/layout';
import { EvidenceBank, type EvidenceItem } from '@/components/evidence-bank';
import { MetadataPanel, FlagsPanel, type Flag } from '@/components/common';
import { ProfessionalWaveform } from './ProfessionalWaveform';
import { usePlayheadStore } from '@/stores/usePlayheadStore';
import { useNavigationStore } from '@/stores/useNavigationStore';
import {
  isFileType,
  getFileTypeErrorMessage,
  getAcceptString,
} from '@/utils/fileTypes';
import {
  generateTestMetadataIfDev,
  formatGPSCoordinates,
} from '@/utils/testMetadataGenerator';

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
  flex: '1 1 50%',
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
  flex: '1 1 auto',
  minHeight: 80,
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


// Inspector Panel Styled Components (matching Image Tool)
const InspectorSection = styled(Box)({
  borderBottom: '1px solid #252525',
});

const InspectorSectionHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  cursor: 'pointer',
  backgroundColor: '#1a1a1a',
  '&:hover': {
    backgroundColor: '#1e1e1e',
  },
});

const InspectorSectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: '#666',
  textTransform: 'uppercase',
});

const InspectorSectionContent = styled(Box)({
  padding: '8px 12px',
});

// Filter slider for inspector panel - matching Image Tool style
const FilterRow = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
});

const FilterRowHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});

const FilterRowLabel = styled(Typography)({
  fontSize: 11,
  color: '#888',
});

const FilterRowValue = styled(Typography)({
  fontSize: 11,
  color: '#ccc',
  fontFamily: '"JetBrains Mono", monospace',
});

const InspectorSlider = styled(Slider)({
  color: '#19abb5',
  height: 4,
  padding: '4px 0',
  '& .MuiSlider-rail': {
    backgroundColor: '#333',
    borderRadius: 2,
    opacity: 1,
  },
  '& .MuiSlider-track': {
    backgroundColor: '#19abb5',
    borderRadius: 2,
    border: 'none',
  },
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    backgroundColor: '#fff',
    border: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
    '&:hover': {
      boxShadow: '0 0 0 4px rgba(25, 171, 181, 0.2), 0 1px 3px rgba(0, 0, 0, 0.3)',
    },
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

// Import button for left panel - full width
const ImportButton = styled(Button)({
  fontSize: 9,
  color: '#888',
  backgroundColor: '#252525',
  border: '1px solid #333',
  padding: '6px 8px',
  textTransform: 'none',
  width: '100%',
  justifyContent: 'center',
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

        {/* Draggable nodes (EQ dots) */}
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
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: disabled ? '#333' : '#19abb5',
                border: '2px solid rgba(255, 255, 255, 0.8)',
                cursor: disabled ? 'default' : 'grab',
                zIndex: draggingIndex === i ? 10 : 1,
                transition: draggingIndex === i ? 'none' : 'transform 0.15s, box-shadow 0.15s, top 0.05s ease-out',
                boxShadow: 'none',
                // Larger hit area via pseudo-element
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  width: 24,
                  height: 24,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                },
                '&:hover': {
                  transform: disabled ? 'translate(-50%, -50%)' : 'translate(-50%, -50%) scale(1.2)',
                  boxShadow: disabled ? 'none' : '0 0 8px rgba(25, 171, 181, 0.6)',
                },
                '&:active': {
                  cursor: disabled ? 'default' : 'grabbing',
                  boxShadow: disabled ? 'none' : '0 0 12px rgba(25, 171, 181, 0.8)',
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
// AUDIO TRANSPORT COMPONENT (Pro Tools-inspired design)
// ============================================================================

const AudioTransportContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: 52,
  padding: '0 16px',
  backgroundColor: '#161616',
  borderTop: '1px solid #2a2a2a',
  position: 'relative',
  overflow: 'visible', // Prevent clipping of play button shadow
});

const TransportSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

const TransportCenter = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
});

const TimecodeDisplay = styled('div')({
  fontFamily: '"JetBrains Mono", "Roboto Mono", "Consolas", monospace',
  fontSize: '15px',
  fontWeight: 500,
  color: '#e0e0e0',
  letterSpacing: '-0.3px',
  minWidth: 80,
  userSelect: 'none',
});

// Styled transport button - circular with hover states
const TransportBtn = styled('button')<{ $disabled?: boolean }>(({ $disabled }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: $disabled ? 'default' : 'pointer',
  transition: 'all 0.15s ease',
  color: $disabled ? '#444' : '#888',
  opacity: $disabled ? 0.5 : 1,
  padding: 0,
  '&:hover': $disabled ? {} : {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
  '&:active': $disabled ? {} : {
    color: '#19abb5',
  },
  '& svg': {
    width: 20,
    height: 20,
    fill: 'currentColor',
  },
}));

// Hero play button - circular with teal background
const PlayBtn = styled('button')<{ $disabled?: boolean; $isPlaying?: boolean }>(({ $disabled, $isPlaying }) => ({
  width: 44,
  height: 44,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: $disabled ? '#333' : '#19abb5',
  border: 'none',
  cursor: $disabled ? 'default' : 'pointer',
  transition: 'all 0.15s ease',
  color: '#fff',
  boxShadow: $disabled ? 'none' : '0 2px 8px rgba(25, 171, 181, 0.3)',
  opacity: $disabled ? 0.5 : 1,
  padding: 0,
  flexShrink: 0,
  '&:hover': $disabled ? {} : {
    background: '#1bc4d0',
    boxShadow: '0 4px 12px rgba(25, 171, 181, 0.4)',
  },
  '&:active': $disabled ? {} : {
    transform: 'scale(0.95)',
  },
  '& svg': {
    width: 22,
    height: 22,
    fill: 'currentColor',
    marginLeft: $isPlaying ? 0 : 2, // Visual centering for play icon
  },
}));

// Reverse play button - highlighted when active
const ReverseBtn = styled('button')<{ $disabled?: boolean; $active?: boolean }>(({ $disabled, $active }) => ({
  width: 36,
  height: 36,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: $active && !$disabled ? 'rgba(25, 171, 181, 0.2)' : 'transparent',
  border: $active && !$disabled ? '1px solid #19abb5' : 'none',
  cursor: $disabled ? 'default' : 'pointer',
  transition: 'all 0.15s ease',
  color: $active && !$disabled ? '#19abb5' : ($disabled ? '#444' : '#888'),
  opacity: $disabled ? 0.5 : 1,
  padding: 0,
  '&:hover': $disabled ? {} : {
    background: $active ? 'rgba(25, 171, 181, 0.3)' : 'rgba(255, 255, 255, 0.1)',
    color: $active ? '#19abb5' : '#fff',
  },
  '& svg': {
    width: 20,
    height: 20,
    fill: 'currentColor',
  },
}));

// Loop toggle button
const LoopBtn = styled('button')<{ $disabled?: boolean; $active?: boolean }>(({ $disabled, $active }) => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  cursor: $disabled ? 'default' : 'pointer',
  transition: 'all 0.15s ease',
  color: $active && !$disabled ? '#19abb5' : ($disabled ? '#444' : '#888'),
  opacity: $disabled ? 0.5 : 1,
  padding: 0,
  '&:hover': $disabled ? {} : {
    background: 'rgba(255, 255, 255, 0.1)',
  },
  '& svg': {
    width: 18,
    height: 18,
    fill: 'currentColor',
  },
}));

// Speed selector button
const SpeedBtn = styled('button')<{ $disabled?: boolean }>(({ $disabled }) => ({
  height: 28,
  padding: '0 10px',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  background: '#1e1e1e',
  border: '1px solid #303030',
  cursor: $disabled ? 'default' : 'pointer',
  transition: 'all 0.15s ease',
  color: $disabled ? '#555' : '#ccc',
  fontFamily: '"Inter", sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  opacity: $disabled ? 0.5 : 1,
  '&:hover': $disabled ? {} : {
    borderColor: '#19abb5',
    color: '#fff',
  },
  '& svg': {
    width: 12,
    height: 12,
    fill: 'currentColor',
    opacity: 0.7,
  },
}));

// Speed menu item
const SpeedMenuItem = styled('button')<{ $selected?: boolean }>(({ $selected }) => ({
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  background: $selected ? 'rgba(25, 171, 181, 0.1)' : 'transparent',
  border: 'none',
  color: $selected ? '#19abb5' : '#ccc',
  fontFamily: '"Inter", sans-serif',
  fontSize: '12px',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
  },
}));

// SVG Icons for transport
const SkipStartSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
  </svg>
);

const StepBackSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z" />
  </svg>
);

const ReversePlaySvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M19 12 8 5v14l11-7z" transform="rotate(180 12 12)" />
  </svg>
);

const PlaySvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M8 5v14l11-7L8 5z" />
  </svg>
);

const PauseSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const StepForwardSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
  </svg>
);

const SkipEndSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" />
  </svg>
);

const LoopSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />
  </svg>
);

const ChevronDownSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
  </svg>
);

// Format timestamp to HH:MM:SS
const formatTimecode = (ms: number): string => {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

interface AudioTransportProps {
  disabled?: boolean;
}

const AudioTransport: React.FC<AudioTransportProps> = ({ disabled = false }) => {
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const isReversePlaying = usePlayheadStore((state) => state.isReversePlaying);
  const playbackSpeed = usePlayheadStore((state) => state.playbackSpeed);
  const togglePlayback = usePlayheadStore((state) => state.togglePlayback);
  const toggleReversePlayback = usePlayheadStore((state) => state.toggleReversePlayback);
  const setPlaybackSpeed = usePlayheadStore((state) => state.setPlaybackSpeed);
  const stepForward = usePlayheadStore((state) => state.stepForward);
  const stepBackward = usePlayheadStore((state) => state.stepBackward);
  const jumpToStart = usePlayheadStore((state) => state.jumpToStart);
  const jumpToEnd = usePlayheadStore((state) => state.jumpToEnd);

  const [loopEnabled, setLoopEnabled] = useState(false);
  const [speedAnchorEl, setSpeedAnchorEl] = useState<HTMLElement | null>(null);
  const speedMenuOpen = Boolean(speedAnchorEl);

  const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <AudioTransportContainer>
      {/* Left: Timecode */}
      <TransportSection>
        <Tooltip title="Playback position">
          <TimecodeDisplay style={{ color: disabled ? '#555' : '#e0e0e0' }}>
            {disabled ? '--:--:--' : formatTimecode(timestamp)}
          </TimecodeDisplay>
        </Tooltip>
      </TransportSection>

      {/* Center: Transport Controls */}
      <TransportCenter>
        {/* Skip to Start */}
        <Tooltip title="Jump to start (Home)">
          <TransportBtn $disabled={disabled} onClick={() => !disabled && jumpToStart()}>
            <SkipStartSvg />
          </TransportBtn>
        </Tooltip>

        {/* Step Back 5s */}
        <Tooltip title="Step back 5s">
          <TransportBtn $disabled={disabled} onClick={() => !disabled && stepBackward(5000)}>
            <StepBackSvg />
          </TransportBtn>
        </Tooltip>

        {/* Reverse Play */}
        <Tooltip title="Reverse play (R) - for reverse audio analysis">
          <ReverseBtn $disabled={disabled} $active={isReversePlaying} onClick={() => !disabled && toggleReversePlayback()}>
            <ReversePlaySvg />
          </ReverseBtn>
        </Tooltip>

        {/* Play/Pause - Hero Button */}
        <Tooltip title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
          <PlayBtn $disabled={disabled} $isPlaying={isPlaying} onClick={() => !disabled && togglePlayback()}>
            {isPlaying ? <PauseSvg /> : <PlaySvg />}
          </PlayBtn>
        </Tooltip>

        {/* Step Forward 5s */}
        <Tooltip title="Step forward 5s">
          <TransportBtn $disabled={disabled} onClick={() => !disabled && stepForward(5000)}>
            <StepForwardSvg />
          </TransportBtn>
        </Tooltip>

        {/* Skip to End */}
        <Tooltip title="Jump to end (End)">
          <TransportBtn $disabled={disabled} onClick={() => !disabled && jumpToEnd()}>
            <SkipEndSvg />
          </TransportBtn>
        </Tooltip>
      </TransportCenter>

      {/* Right: Loop + Speed */}
      <TransportSection>
        {/* Loop Toggle */}
        <Tooltip title={loopEnabled ? 'Loop enabled (L)' : 'Enable loop (L)'}>
          <LoopBtn $disabled={disabled} $active={loopEnabled} onClick={() => !disabled && setLoopEnabled(!loopEnabled)}>
            <LoopSvg />
          </LoopBtn>
        </Tooltip>

        {/* Speed Selector */}
        <Tooltip title="Playback speed">
          <SpeedBtn $disabled={disabled} onClick={(e) => !disabled && setSpeedAnchorEl(e.currentTarget)}>
            {playbackSpeed}x
            <ChevronDownSvg />
          </SpeedBtn>
        </Tooltip>

        {/* Speed Menu */}
        {speedMenuOpen && (
          <>
            {/* Click-away backdrop */}
            <Box
              sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9998,
              }}
              onClick={() => setSpeedAnchorEl(null)}
            />
            {/* Menu */}
            <Box
              sx={{
                position: 'fixed',
                backgroundColor: '#1e1e1e',
                border: '1px solid #303030',
                borderRadius: 1,
                minWidth: 80,
                zIndex: 9999,
                top: speedAnchorEl ? speedAnchorEl.getBoundingClientRect().top - (speeds.length * 30) - 8 : 0,
                left: speedAnchorEl ? speedAnchorEl.getBoundingClientRect().left : 0,
              }}
            >
              {speeds.map((speed) => (
                <SpeedMenuItem
                  key={speed}
                  $selected={playbackSpeed === speed}
                  onClick={() => {
                    setPlaybackSpeed(speed);
                    setSpeedAnchorEl(null);
                  }}
                >
                  {speed}x
                </SpeedMenuItem>
              ))}
            </Box>
          </>
        )}
      </TransportSection>
    </AudioTransportContainer>
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
  const [videoRefCollapsed, setVideoRefCollapsed] = useState(true); // collapsed by default, expands when video exists
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [flags, setFlags] = useState<Flag[]>(mockFlags);

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

  // Waveform selection state
  const [waveformSelection, setWaveformSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);

  // Playhead store for waveform integration
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

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

  // Auto-expand video reference when video exists
  useEffect(() => {
    if (loadedAudio?.hasVideo) {
      setVideoRefCollapsed(false);
    } else {
      setVideoRefCollapsed(true);
    }
  }, [loadedAudio?.hasVideo]);

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

    // Try to generate test metadata in development mode
    const testMetadata = generateTestMetadataIfDev(file);

    // Create a mock audio item from the imported file (Quick Analysis Mode)
    // Use test metadata if available (dev mode), otherwise use defaults
    const mockItem = {
      id: testMetadata?.id || `import-${Date.now()}`,
      type: 'audio' as const,
      fileName: file.name,
      duration: testMetadata?.duration
        ? Math.floor(testMetadata.duration / 1000) // Convert ms to seconds
        : 180, // Default 3 minutes
      capturedAt: testMetadata?.timestamp.getTime() || Date.now(),
      user: testMetadata?.user || 'Imported',
      deviceInfo: testMetadata?.deviceId || 'Imported File',
      format: file.type || 'audio/unknown',
      sampleRate: 44100,
      channels: 2,
      flagCount: 0,
      gps: testMetadata?.gpsCoordinates
        ? formatGPSCoordinates(testMetadata.gpsCoordinates)
        : null,
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
  const handleDropZoneClick = useCallback((e: React.MouseEvent) => {
    // Open the file picker
    fileInputRef.current?.click();
    // Stop propagation to prevent parent handlers from triggering (e.g., fullscreen exit)
    e.stopPropagation();
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

  // Waveform seek handler - converts seconds to milliseconds for playhead store
  const handleWaveformSeek = useCallback((timeInSeconds: number) => {
    setTimestamp(timeInSeconds * 1000); // Convert to milliseconds
  }, [setTimestamp]);

  // Waveform selection handler
  const handleWaveformSelection = useCallback((startTime: number, endTime: number) => {
    setWaveformSelection({ start: startTime, end: endTime });
    // Could be used for loop points or region editing
    console.log('Waveform selection:', startTime, '-', endTime, 'seconds');
  }, []);

  // Right panel content - Video Reference + Filters + Flags
  const inspectorContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Video Reference - collapsible section (always show header) */}
      <InspectorSection sx={{ flexShrink: 0 }}>
        <InspectorSectionHeader onClick={() => setVideoRefCollapsed(!videoRefCollapsed)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InspectorSectionTitle>Video Reference</InspectorSectionTitle>
            {loadedAudio?.hasVideo && (
              <VideocamIcon sx={{ fontSize: 12, color: '#19abb5' }} />
            )}
          </Box>
          {videoRefCollapsed ? (
            <ChevronRightIcon sx={{ fontSize: 16, color: '#666' }} />
          ) : (
            <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
          )}
        </InspectorSectionHeader>
        {!videoRefCollapsed && (
          <InspectorSectionContent sx={{ p: 0 }}>
            {loadedAudio?.hasVideo ? (
              <>
                <Box sx={{
                  height: 100,
                  backgroundColor: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography sx={{ color: '#333', fontSize: 10 }}>Synced video preview</Typography>
                </Box>
                <Box sx={{ padding: '8px 12px' }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    size="small"
                    onClick={() => navigateToTool('video', loadedAudio?.id)}
                    sx={{
                      fontSize: 10,
                      color: '#888',
                      borderColor: '#333',
                      py: 0.75,
                      '&:hover': {
                        borderColor: '#19abb5',
                        color: '#19abb5',
                        backgroundColor: 'rgba(25, 171, 181, 0.05)',
                      },
                    }}
                  >
                    Open in Video Tool
                  </Button>
                </Box>
              </>
            ) : (
              <Box sx={{
                padding: '16px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography sx={{ color: '#444', fontSize: 10 }}>
                  No video linked to this audio
                </Typography>
              </Box>
            )}
          </InspectorSectionContent>
        )}
      </InspectorSection>

      {/* Filters - collapsible section */}
      <InspectorSection sx={{ flexShrink: 0 }}>
        <InspectorSectionHeader onClick={() => setFiltersCollapsed(!filtersCollapsed)}>
          <InspectorSectionTitle>Filters</InspectorSectionTitle>
          {filtersCollapsed ? (
            <ExpandMoreIcon sx={{ fontSize: 16, color: '#666' }} />
          ) : (
            <ExpandLessIcon sx={{ fontSize: 16, color: '#666' }} />
          )}
        </InspectorSectionHeader>
        {!filtersCollapsed && (
          <InspectorSectionContent>
            {/* De-Noise */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>De-Noise</FilterRowLabel>
                <FilterRowValue>{formatFilterValue('deNoise', filters.deNoise)}</FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.deNoise}
                onChange={(_, v) => setFilters(prev => ({ ...prev, deNoise: v as number }))}
                min={0}
                max={100}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* De-Hum */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>De-Hum</FilterRowLabel>
                <FilterRowValue>{formatFilterValue('deHum', filters.deHum)}</FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.deHum}
                onChange={(_, v) => setFilters(prev => ({ ...prev, deHum: v as number }))}
                min={0}
                max={100}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* Low Cut */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>Low Cut</FilterRowLabel>
                <FilterRowValue>{formatFilterValue('lowCut', filters.lowCut)}</FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.lowCut}
                onChange={(_, v) => setFilters(prev => ({ ...prev, lowCut: v as number }))}
                min={20}
                max={500}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* High Cut */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>High Cut</FilterRowLabel>
                <FilterRowValue>{formatFilterValue('highCut', filters.highCut)}</FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.highCut}
                onChange={(_, v) => setFilters(prev => ({ ...prev, highCut: v as number }))}
                min={2000}
                max={20000}
                step={100}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* Clarity */}
            <FilterRow sx={{ mb: 1 }}>
              <FilterRowHeader>
                <FilterRowLabel>Clarity</FilterRowLabel>
                <FilterRowValue>{formatFilterValue('clarity', filters.clarity)}</FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.clarity}
                onChange={(_, v) => setFilters(prev => ({ ...prev, clarity: v as number }))}
                min={-12}
                max={12}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* Reset All Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={resetAllFilters}
                disabled={!loadedAudio}
                sx={{
                  fontSize: 10,
                  color: '#666',
                  textTransform: 'none',
                  py: 0.25,
                  px: 1,
                  '&:hover': { color: '#19abb5' },
                }}
              >
                Reset All
              </Button>
            </Box>
          </InspectorSectionContent>
        )}
      </InspectorSection>

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
        <Typography sx={{ fontSize: 10, color: '#555', width: 50, flexShrink: 0 }}>WAVE</Typography>
        <ProfessionalWaveform
          isLoaded={!!loadedAudio}
          duration={loadedAudio?.duration || 0}
          currentTime={timestamp / 1000} // Convert from ms to seconds
          isPlaying={isPlaying}
          onSeek={handleWaveformSeek}
          onSelection={handleWaveformSelection}
          selectionStart={waveformSelection?.start}
          selectionEnd={waveformSelection?.end}
        />
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

      {/* Audio Transport - Professional Pro Tools-inspired design */}
      <AudioTransport disabled={!loadedAudio} />
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
            {/* Import button header - full width */}
            <Box sx={{
              display: 'flex',
              padding: '6px',
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
