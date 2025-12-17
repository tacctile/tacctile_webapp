import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Button,
  Slider,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import MicIcon from "@mui/icons-material/Mic";
import VideocamIcon from "@mui/icons-material/Videocam";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

import { WorkspaceLayout } from "@/components/layout";
import { FileLibrary, type FileItem } from "@/components/file-library";
import {
  MetadataPanel,
  FlagsPanel,
  TransportControls,
  type Flag,
  type FlagUser,
} from "@/components/common";
import { ExpandVideoModal } from "./ExpandVideoModal";
import { WaveformCanvas } from "./WaveformCanvas";
import { TimeScaleBar } from "./TimeScaleBar";
import { usePlayheadStore } from "@/stores/usePlayheadStore";
import { useNavigationStore } from "@/stores/useNavigationStore";
import { useAudioToolStore } from "@/stores/useAudioToolStore";
import type { LoadedAudioFile } from "@/types/audio";
import {
  isFileType,
  getFileTypeErrorMessage,
  getAcceptString,
} from "@/utils/fileTypes";
import {
  generateTestMetadataIfDev,
  formatGPSCoordinates,
} from "@/utils/testMetadataGenerator";
import { useAudioPlayback, useVideoSync } from "@/hooks";

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const MainContainer = styled(Box)({
  display: "flex",
  flexDirection: "column",
  height: "100%",
  backgroundColor: "#0d0d0d",
});

const EQSection = styled(Box)({
  height: 280, // Twice as tall for better EQ visualization
  backgroundColor: "#0d0d0d",
  borderBottom: "1px solid #252525",
  display: "flex",
  flexDirection: "column",
  position: "relative",
});

// Overview Bar styled components (iZotope RX-style navigation)
const OverviewBarContainer = styled(Box)({
  height: 40,
  backgroundColor: "#111",
  borderBottom: "1px solid #252525",
  position: "relative",
  display: "flex",
  alignItems: "center",
  padding: 0,
});

const OverviewBarContent = styled(Box)({
  flex: 1,
  height: 36,
  backgroundColor: "#1a1a1a",
  borderRadius: 0,
  position: "relative",
  overflow: "hidden",
});

const ToolbarSection = styled(Box)({
  height: 28,
  backgroundColor: "#161616",
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  gap: 8,
  borderTop: "1px solid #252525",
});

// Inspector Panel Styled Components (matching Image Tool)
const InspectorSection = styled(Box)({
  borderBottom: "1px solid #252525",
});

const InspectorSectionHeader = styled(Box)({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  cursor: "pointer",
  backgroundColor: "#1a1a1a",
  "&:hover": {
    backgroundColor: "#1e1e1e",
  },
});

const InspectorSectionTitle = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  color: "#666",
  textTransform: "uppercase",
});

const InspectorSectionContent = styled(Box)({
  padding: "8px 12px",
});

// Filter slider for inspector panel - matching Image Tool style
const FilterRow = styled(Box)({
  display: "flex",
  flexDirection: "column",
  gap: 4,
  marginBottom: 12,
});

const FilterRowHeader = styled(Box)({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
});

const FilterRowLabel = styled(Typography)({
  fontSize: 11,
  color: "#888",
});

const FilterRowValue = styled(Typography)({
  fontSize: 11,
  color: "#ccc",
  fontFamily: '"JetBrains Mono", monospace',
});

const InspectorSlider = styled(Slider)({
  color: "#19abb5",
  height: 4,
  padding: "4px 0",
  "& .MuiSlider-rail": {
    backgroundColor: "#333",
    borderRadius: 2,
    opacity: 1,
  },
  "& .MuiSlider-track": {
    backgroundColor: "#19abb5",
    borderRadius: 2,
    border: "none",
  },
  "& .MuiSlider-thumb": {
    width: 12,
    height: 12,
    backgroundColor: "#fff",
    border: "none",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
    "&:hover": {
      boxShadow:
        "0 0 0 4px rgba(25, 171, 181, 0.2), 0 1px 3px rgba(0, 0, 0, 0.3)",
    },
  },
});

// Horizontal draggable divider for resizing sections
const HorizontalDivider = styled(Box)<{ isDragging?: boolean }>(
  ({ isDragging }) => ({
    height: 6,
    backgroundColor: isDragging ? "#333" : "#252525",
    cursor: "row-resize",
    flexShrink: 0,
    position: "relative",
    transition: "background-color 0.15s ease",
    "&:hover": {
      backgroundColor: "#333",
    },
    // Grip indicator in center
    "&::after": {
      content: '""',
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 32,
      height: 2,
      backgroundColor: isDragging ? "#555" : "#444",
      borderRadius: 1,
    },
    "&:hover::after": {
      backgroundColor: "#555",
    },
  }),
);

// File drop zone for center canvas when no file loaded
const FileDropZone = styled(Box)<{ isActive: boolean }>(({ isActive }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  color: isActive ? "#19abb5" : "#444",
  backgroundColor: isActive ? "rgba(25, 171, 181, 0.08)" : "transparent",
  border: isActive ? "2px dashed #19abb5" : "2px dashed transparent",
  borderRadius: 8,
  margin: 16,
  transition: "all 0.2s ease",
  cursor: "pointer",
}));

// Import/Export buttons for left panel - side by side
const ImportButton = styled(Button)({
  fontSize: 9,
  color: "#888",
  backgroundColor: "#252525",
  border: "1px solid #333",
  padding: "6px 8px",
  textTransform: "none",
  flex: 1,
  minWidth: 0,
  justifyContent: "center",
  "&:hover": {
    backgroundColor: "#333",
    borderColor: "#19abb5",
    color: "#19abb5",
  },
  "& .MuiButton-startIcon": {
    marginRight: 4,
  },
});

const ExportButton = styled(Button)({
  fontSize: 9,
  color: "#888",
  backgroundColor: "#252525",
  border: "1px solid #333",
  padding: "6px 8px",
  textTransform: "none",
  flex: 1,
  minWidth: 0,
  justifyContent: "center",
  "&:hover": {
    backgroundColor: "#333",
    borderColor: "#19abb5",
    color: "#19abb5",
  },
  "& .MuiButton-startIcon": {
    marginRight: 4,
  },
  "&.Mui-disabled": {
    color: "#444",
    backgroundColor: "#1a1a1a",
    borderColor: "#252525",
  },
});

// ============================================================================
// EQ COMPONENT
// ============================================================================

const EQ_BANDS = [
  { freq: 31, label: "31" },
  { freq: 62, label: "62" },
  { freq: 125, label: "125" },
  { freq: 250, label: "250" },
  { freq: 500, label: "500" },
  { freq: 1000, label: "1k" },
  { freq: 2000, label: "2k" },
  { freq: 4000, label: "4k" },
  { freq: 8000, label: "8k" },
  { freq: 16000, label: "16k" },
];

interface IntegratedEQProps {
  values: number[];
  onChange: (index: number, value: number) => void;
  onResetAll: () => void;
  disabled?: boolean;
}

const IntegratedEQ: React.FC<IntegratedEQProps> = ({
  values,
  onChange,
  onResetAll,
  disabled,
}) => {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert frequency to X position (0-100) using logarithmic scale
  // Human hearing is logarithmic: 20Hz-200Hz feels like same "distance" as 2kHz-20kHz
  const freqToX = (freq: number): number => {
    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logFreq = Math.log10(freq);
    return 5 + ((logFreq - logMin) / (logMax - logMin)) * 90;
  };

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

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingIndex, onChange]);

  // Convert dB value to Y percentage (0-100, where 0 is top)
  const dbToY = (db: number) => 50 - (db / 12) * 45;

  // Generate smooth bezier curve path for EQ line
  const generateEQPath = () => {
    if (values.length === 0) return "";

    const points = EQ_BANDS.map((band, i) => ({
      x: freqToX(band.freq),
      y: dbToY(values[i]),
    }));

    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 1; i < points.length; i++) {
      const cp = (points[i - 1].x + points[i].x) / 2;
      path += ` C ${cp} ${points[i - 1].y}, ${cp} ${points[i].y}, ${points[i].x} ${points[i].y}`;
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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Main EQ Canvas */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          position: "relative",
          backgroundColor: "#0a0a0a",
          borderRadius: 1,
          overflow: "hidden",
          cursor: disabled ? "default" : "crosshair",
        }}
      >
        {/* Grid lines */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Horizontal grid lines */}
          <line
            x1="5"
            y1="5"
            x2="95"
            y2="5"
            stroke="#1a1a1a"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="5"
            y1="50"
            x2="95"
            y2="50"
            stroke="#2a2a2a"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="5"
            y1="95"
            x2="95"
            y2="95"
            stroke="#1a1a1a"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />

          {/* Vertical grid lines for each frequency */}
          {EQ_BANDS.map((band, i) => {
            const x = freqToX(band.freq);
            return (
              <line
                key={i}
                x1={x}
                y1="5"
                x2={x}
                y2="95"
                stroke="#2a2a2a"
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {/* dB labels - Left side (aligned with grid lines at 5%, 50%, 95%) */}
        <Box
          sx={{
            position: "absolute",
            left: 6,
            top: "5%",
            transform: "translateY(-50%)",
            fontSize: 9,
            color: "#555",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          +12
        </Box>
        <Box
          sx={{
            position: "absolute",
            left: 6,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 9,
            color: "#777",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          0dB
        </Box>
        <Box
          sx={{
            position: "absolute",
            left: 6,
            top: "95%",
            transform: "translateY(-50%)",
            fontSize: 9,
            color: "#555",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          -12
        </Box>

        {/* dB labels - Right side (aligned with grid lines at 5%, 50%, 95%) */}
        <Box
          sx={{
            position: "absolute",
            right: 6,
            top: "5%",
            transform: "translateY(-50%)",
            fontSize: 9,
            color: "#555",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          +12
        </Box>
        <Box
          sx={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 9,
            color: "#777",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          0dB
        </Box>
        <Box
          sx={{
            position: "absolute",
            right: 6,
            top: "95%",
            transform: "translateY(-50%)",
            fontSize: 9,
            color: "#555",
            fontFamily: '"JetBrains Mono", monospace',
          }}
        >
          -12
        </Box>

        {/* EQ Curve */}
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
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
          const x = freqToX(EQ_BANDS[i].freq);
          const y = dbToY(value);
          return (
            <Box
              key={i}
              onMouseDown={handleMouseDown(i)}
              onDoubleClick={() => handleDoubleClick(i)}
              sx={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                transform: "translate(-50%, -50%)",
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: disabled ? "#333" : "#19abb5",
                border: "2px solid rgba(255, 255, 255, 0.8)",
                cursor: disabled ? "default" : "grab",
                zIndex: draggingIndex === i ? 10 : 1,
                transition:
                  draggingIndex === i
                    ? "none"
                    : "transform 0.15s, box-shadow 0.15s, top 0.05s ease-out",
                boxShadow: "none",
                // Larger hit area via pseudo-element
                "&::before": {
                  content: '""',
                  position: "absolute",
                  width: 24,
                  height: 24,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                },
                "&:hover": {
                  transform: disabled
                    ? "translate(-50%, -50%)"
                    : "translate(-50%, -50%) scale(1.2)",
                  boxShadow: disabled
                    ? "none"
                    : "0 0 8px rgba(25, 171, 181, 0.6)",
                },
                "&:active": {
                  cursor: disabled ? "default" : "grabbing",
                  boxShadow: disabled
                    ? "none"
                    : "0 0 12px rgba(25, 171, 181, 0.8)",
                },
              }}
            />
          );
        })}
      </Box>

      {/* Frequency labels + reset buttons row */}
      <Box
        sx={{
          position: "relative",
          height: 36,
          marginTop: "8px",
          display: "flex",
          alignItems: "flex-start",
        }}
      >
        {/* Reset All button - lower left corner */}
        <Box
          onClick={() => !disabled && onResetAll()}
          sx={{
            position: "absolute",
            left: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            padding: "4px 8px",
            backgroundColor: "#2a2a2a",
            border: "1px solid #555",
            borderRadius: "4px",
            cursor: disabled ? "default" : "pointer",
            transition: "all 0.15s ease",
            zIndex: 5,
            "&:hover": {
              borderColor: disabled ? "#555" : "#888",
              backgroundColor: disabled ? "#2a2a2a" : "#333",
              "& .reset-text": {
                color: disabled ? "#666" : "#ccc",
              },
            },
            "&:active": {
              backgroundColor: disabled ? "#2a2a2a" : "#3a3a3a",
            },
          }}
        >
          <Typography
            className="reset-text"
            sx={{
              fontSize: 11,
              color: "#888",
              fontFamily: '"JetBrains Mono", monospace',
              textTransform: "uppercase",
              letterSpacing: 0.5,
              transition: "color 0.15s ease",
            }}
          >
            Reset All
          </Typography>
        </Box>

        {/* Frequency labels + individual reset buttons */}
        {EQ_BANDS.map((band, i) => (
          <Box
            key={band.freq}
            sx={{
              position: "absolute",
              left: `${freqToX(band.freq)}%`,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
            }}
          >
            <Typography
              sx={{
                fontSize: 10,
                color: "#777",
                fontFamily: '"JetBrains Mono", monospace',
                whiteSpace: "nowrap",
              }}
            >
              {band.freq >= 1000 ? band.label : `${band.label}Hz`}
            </Typography>
            <Box
              onClick={() => handleResetBand(i)}
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                border: "1px solid #333",
                backgroundColor: values[i] === 0 ? "transparent" : "#252525",
                cursor: disabled ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: disabled ? "#333" : "#19abb5",
                  backgroundColor: disabled
                    ? "transparent"
                    : "rgba(25, 171, 181, 0.1)",
                },
              }}
            >
              {values[i] !== 0 && (
                <Box
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    backgroundColor: "#19abb5",
                  }}
                />
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// ============================================================================
// OVERVIEW BAR COMPONENT (iZotope RX-style navigation)
// ============================================================================

interface OverviewBarProps {
  /** Whether audio is loaded */
  isLoaded: boolean;
  /** Total duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  currentTime: number;
  /** Zoom level (1 = fit to view) */
  zoom: number;
  /** Scroll offset (0-1) */
  scrollOffset: number;
  /** Real waveform data from decoded audio */
  waveformData?: Float32Array | null;
  /** Callback when user clicks to seek */
  onSeek?: (timeInSeconds: number) => void;
  /** Callback when user drags viewport */
  onViewportDrag?: (newScrollOffset: number) => void;
  /** Callback when user is scrubbing (dragging playhead) */
  onScrub?: (timeInSeconds: number, isScrubbing: boolean) => void;
  /** When true, disables playhead dragging - click-to-seek only (for video files) */
  hasVideo?: boolean;
}

const OverviewBar: React.FC<OverviewBarProps> = ({
  isLoaded,
  duration,
  currentTime,
  zoom,
  scrollOffset,
  waveformData,
  onSeek,
  onViewportDrag,
  onScrub,
  hasVideo = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [isNearPlayhead, setIsNearPlayhead] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartOffset, setDragStartOffset] = useState(0);
  const waveformDataRef = useRef<Float32Array | null>(null);

  // Colors
  const COLORS = {
    background: "#1a1a1a",
    waveform: "#666",
    waveformPeak: "#888",
    viewportFill: "rgba(25, 171, 181, 0.25)",
    viewportBorder: "rgba(25, 171, 181, 0.8)",
    playhead: "#19abb5",
    timeLabel: "#555",
  };

  // Generate simplified waveform data for overview
  const generateMiniWaveformData = useCallback(
    (numSamples: number): Float32Array => {
      if (
        waveformDataRef.current &&
        waveformDataRef.current.length === numSamples
      ) {
        return waveformDataRef.current;
      }

      const data = new Float32Array(numSamples);
      let phase = 0;
      let envelope = 0.3;
      let envelopeTarget = 0.5;

      for (let i = 0; i < numSamples; i++) {
        if (Math.random() < 0.002) {
          envelopeTarget = 0.1 + Math.random() * 0.7;
        }
        envelope += (envelopeTarget - envelope) * 0.0002;

        const f1 = Math.sin(phase * 0.1) * 0.4;
        const f2 = Math.sin(phase * 0.37) * 0.25;
        const noise = (Math.random() - 0.5) * 0.2;

        let sample = (f1 + f2 + noise) * envelope;

        // Add quiet sections
        const t = i / numSamples;
        if (t > 0.15 && t < 0.18) sample *= 0.1;
        if (t > 0.45 && t < 0.47) sample *= 0.05;
        if (t > 0.72 && t < 0.74) sample *= 0.15;

        data[i] = Math.max(-1, Math.min(1, sample));
        phase += 0.01 + Math.random() * 0.015;
      }

      waveformDataRef.current = data;
      return data;
    },
    [],
  );

  // Calculate viewport indicator position and width
  const getViewportBounds = useCallback(() => {
    const visibleWidth = 1 / zoom;
    const maxOffset = Math.max(0, 1 - visibleWidth);
    const clampedOffset = Math.min(scrollOffset, maxOffset);
    return {
      left: clampedOffset * 100,
      width: visibleWidth * 100,
    };
  }, [zoom, scrollOffset]);

  // Draw the overview bar
  const drawOverview = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded) return;

    // Draw waveform - use real data when available, fall back to mock
    ctx.fillStyle = COLORS.waveform;
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    if (waveformData && waveformData.length > 0) {
      // Use real waveform data - sample from the data array
      // Draw top half
      for (let i = 0; i < width; i++) {
        const dataIndex = Math.floor((i / width) * waveformData.length);
        const sample = waveformData[dataIndex] || 0;
        const y = centerY - sample * (centerY - 2);
        ctx.lineTo(i, y);
      }

      // Draw bottom half (mirror)
      for (let i = width - 1; i >= 0; i--) {
        const dataIndex = Math.floor((i / width) * waveformData.length);
        const sample = waveformData[dataIndex] || 0;
        const y = centerY + sample * (centerY - 2);
        ctx.lineTo(i, y);
      }
    } else {
      // Fall back to mock data when real data isn't available yet
      const mockData = generateMiniWaveformData(width);

      // Draw top half
      for (let i = 0; i < width; i++) {
        const sample = Math.abs(mockData[i]);
        const y = centerY - sample * (centerY - 1);
        ctx.lineTo(i, y);
      }

      // Draw bottom half (mirror)
      for (let i = width - 1; i >= 0; i--) {
        const sample = Math.abs(mockData[i]);
        const y = centerY + sample * (centerY - 1);
        ctx.lineTo(i, y);
      }
    }

    ctx.closePath();
    ctx.fill();

    // Draw viewport indicator (only if zoomed in)
    if (zoom > 1) {
      const viewport = getViewportBounds();
      const viewportX = (viewport.left / 100) * width;
      const viewportWidth = (viewport.width / 100) * width;

      ctx.fillStyle = COLORS.viewportFill;
      ctx.fillRect(viewportX, 0, viewportWidth, height);

      ctx.strokeStyle = COLORS.viewportBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(viewportX + 0.5, 0.5, viewportWidth - 1, height - 1);
    }

    // Draw playhead
    const playheadX = (currentTime / duration) * width;
    if (playheadX >= 0 && playheadX <= width) {
      ctx.strokeStyle = COLORS.playhead;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [
    isLoaded,
    duration,
    currentTime,
    zoom,
    waveformData,
    generateMiniWaveformData,
    getViewportBounds,
    COLORS,
  ]);

  // Animation and resize effects
  useEffect(() => {
    drawOverview();
  }, [drawOverview]);

  // ResizeObserver for container size changes (column collapse/expand)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      drawOverview();
    });

    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [drawOverview]);

  // Format time for labels
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if mouse is near the playhead (within 10px)
  const checkNearPlayhead = useCallback(
    (mouseX: number, containerWidth: number): boolean => {
      if (!duration || duration <= 0) return false;
      const playheadX = (currentTime / duration) * containerWidth;
      return Math.abs(mouseX - playheadX) < 10;
    },
    [currentTime, duration],
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isLoaded || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const clickTime = ratio * duration;

      // Check if clicking on viewport indicator
      if (zoom > 1) {
        const viewport = getViewportBounds();
        const viewportStart = (viewport.left / 100) * rect.width;
        const viewportEnd = viewportStart + (viewport.width / 100) * rect.width;

        if (x >= viewportStart && x <= viewportEnd) {
          // Start dragging viewport
          setIsDraggingViewport(true);
          setDragStartX(x);
          setDragStartOffset(scrollOffset);
          return;
        }
      }

      // Check if clicking near playhead (for scrubbing) - DISABLED for video files
      if (!hasVideo) {
        const playheadX = (currentTime / duration) * rect.width;
        const playheadThreshold = 8;
        if (Math.abs(x - playheadX) < playheadThreshold) {
          setIsDraggingPlayhead(true);
          onScrub?.(clickTime, true);
          return;
        }
      }

      // Click to seek (works for both audio and video)
      onSeek?.(Math.max(0, Math.min(clickTime, duration)));
    },
    [
      isLoaded,
      duration,
      zoom,
      scrollOffset,
      currentTime,
      getViewportBounds,
      onSeek,
      onScrub,
      hasVideo,
    ],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;

      // Update hover state for cursor (only when not dragging)
      // For video, don't show playhead drag cursor since dragging is disabled
      if (!isDraggingViewport && !isDraggingPlayhead) {
        setIsNearPlayhead(!hasVideo && checkNearPlayhead(x, rect.width));
      }

      if (isDraggingViewport) {
        const deltaX = x - dragStartX;
        const deltaRatio = deltaX / rect.width;
        const newOffset = Math.max(
          0,
          Math.min(1 - 1 / zoom, dragStartOffset + deltaRatio),
        );
        onViewportDrag?.(newOffset);
      } else if (isDraggingPlayhead) {
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        const time = ratio * duration;
        onScrub?.(time, true);
      }
    },
    [
      isDraggingViewport,
      isDraggingPlayhead,
      dragStartX,
      dragStartOffset,
      zoom,
      duration,
      onViewportDrag,
      onScrub,
      checkNearPlayhead,
      hasVideo,
    ],
  );

  const handleMouseUp = useCallback(() => {
    if (isDraggingPlayhead) {
      onScrub?.(currentTime, false);
    }
    setIsDraggingViewport(false);
    setIsDraggingPlayhead(false);
  }, [isDraggingPlayhead, currentTime, onScrub]);

  const handleMouseLeave = useCallback(() => {
    if (isDraggingPlayhead) {
      onScrub?.(currentTime, false);
    }
    setIsDraggingViewport(false);
    setIsDraggingPlayhead(false);
    setIsNearPlayhead(false);
  }, [isDraggingPlayhead, currentTime, onScrub]);

  if (!isLoaded) {
    return (
      <OverviewBarContainer>
        <OverviewBarContent
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ fontSize: 9, color: "#444" }}>
            No audio loaded
          </Typography>
        </OverviewBarContent>
      </OverviewBarContainer>
    );
  }

  return (
    <OverviewBarContainer>
      <OverviewBarContent
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        sx={{
          cursor: isLoaded
            ? isNearPlayhead || isDraggingPlayhead
              ? "ew-resize"
              : "pointer"
            : "default",
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      </OverviewBarContent>
    </OverviewBarContainer>
  );
};

// ============================================================================
// MOCK DATA
// ============================================================================

// Extended file type with video properties
type MediaFileItem = FileItem & {
  format?: string;
  gps?: string | null;
  hasVideo?: boolean;
  path?: string;
  videoUrl?: string; // URL to video file when hasVideo is true
};

// Helper to convert MediaFileItem to LoadedAudioFile (for audio and video only)
const toLoadedAudioFile = (item: MediaFileItem): LoadedAudioFile | null => {
  if (item.type === "image") return null;
  return {
    id: item.id,
    type: item.type, // 'audio' | 'video'
    fileName: item.fileName,
    duration: item.duration || 0,
    capturedAt: item.capturedAt,
    user: item.user,
    deviceInfo: item.deviceInfo || "",
    flagCount: item.flagCount,
    hasFindings: item.hasFindings,
    format: item.format,
    gps: item.gps,
    hasVideo: item.hasVideo,
    path: item.path,
    videoUrl: item.videoUrl,
  };
};

const audioFiles: MediaFileItem[] = [
  {
    id: "test-drums",
    type: "audio",
    fileName: "test_drums.mp3",
    duration: 0,
    capturedAt: Date.now(),
    user: "You",
    deviceInfo: "Imported",
    flagCount: 0,
    hasFindings: false,
    format: "44.1kHz / 16-bit",
    gps: null,
    hasVideo: false,
    path: "/audio/test_drums.mp3",
  },
  {
    id: "test-drums-1",
    type: "audio",
    fileName: "test_drums1.mp3",
    duration: 0,
    capturedAt: Date.now(),
    user: "You",
    deviceInfo: "Imported",
    flagCount: 0,
    hasFindings: false,
    format: "44.1kHz / 16-bit",
    gps: null,
    hasVideo: false,
    path: "/audio/test_drums1.mp3",
  },
  {
    id: "a1",
    type: "audio",
    fileName: "ambient_baseline.wav",
    duration: 1080,
    capturedAt: Date.now() - 7200000,
    user: "Mike",
    deviceInfo: "Zoom H6",
    flagCount: 0,
    hasFindings: false,
    format: "48kHz / 24-bit",
    gps: null,
    hasVideo: false,
  },
  {
    id: "a2",
    type: "audio",
    fileName: "recorder_01_audio_session.wav",
    duration: 1834,
    capturedAt: Date.now() - 6500000,
    user: "Sarah",
    deviceInfo: "Zoom H6",
    flagCount: 7,
    hasFindings: true,
    format: "48kHz / 24-bit",
    gps: "39.95°N, 75.16°W",
    hasVideo: false,
  },
  {
    id: "a3",
    type: "audio",
    fileName: "camera_01_audio_extract.wav",
    duration: 3847,
    capturedAt: Date.now() - 7000000,
    user: "Sarah",
    deviceInfo: "Sony A7IV",
    flagCount: 2,
    hasFindings: true,
    format: "48kHz / 16-bit",
    gps: "39.95°N, 75.16°W",
    hasVideo: true,
  },
  {
    id: "a4",
    type: "audio",
    fileName: "radio_sweep_session.wav",
    duration: 923,
    capturedAt: Date.now() - 5800000,
    user: "Jen",
    deviceInfo: "Tascam DR-40X",
    flagCount: 2,
    hasFindings: true,
    format: "44.1kHz / 16-bit",
    gps: null,
    hasVideo: false,
  },
];

// Video files that can be loaded for audio editing
const videoFiles: MediaFileItem[] = [
  {
    id: "test-video",
    type: "video",
    fileName: "test_video.mp4",
    duration: 0,
    capturedAt: Date.now(),
    user: "You",
    deviceInfo: "Imported",
    flagCount: 0,
    hasFindings: false,
    format: "1080p / H.264",
    gps: null,
    hasVideo: true,
    path: "/video/test_video.mp4",
    videoUrl: "/video/test_video.mp4",
  },
  {
    id: "test-video-2",
    type: "video",
    fileName: "1456996-hd_1920_1080_30fps.mp4",
    duration: 0,
    capturedAt: Date.now() - 3600000,
    user: "Nick",
    deviceInfo: "Sample Video",
    flagCount: 0,
    hasFindings: false,
    format: "1080p / H.264",
    gps: null,
    hasVideo: true,
    path: "/video/1456996-hd_1920_1080_30fps.mp4",
    videoUrl: "/video/1456996-hd_1920_1080_30fps.mp4",
  },
];

// Combined files for the file library
const allMediaFiles: MediaFileItem[] = [...audioFiles, ...videoFiles];

// Test users for multi-user collaboration simulation
const TEST_USERS = [
  { id: "nick", name: "Nick", color: "#19abb5" },
  { id: "ben", name: "Ben", color: "#e74c3c" },
  { id: "jen", name: "Jen", color: "#9b59b6" },
  { id: "greg", name: "Greg", color: "#27ae60" },
  { id: "mike", name: "Mike", color: "#f39c12" },
  { id: "alex", name: "Alex", color: "#3498db" },
];

// Labels and descriptions for generated test flags
const FLAG_LABELS = [
  "Odd sound",
  "Check this",
  "Possible anomaly",
  "Background noise",
  "Interesting",
  "Listen closely",
  "Sounds strange",
  "Review needed",
  "Potential hit",
  "Unclear audio",
];

const FLAG_DESCRIPTIONS = [
  "Need second opinion on this section",
  "Heard something unusual here",
  "Could be significant",
  "Might be nothing but flagging anyway",
  "Team should review",
  "Sounds different from baseline",
  "Worth a closer look",
  "Not sure what this is",
  "Caught my attention",
  "Possible artifact",
];

// Get a random test user
const getRandomTestUser = () =>
  TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];

// Generate random test flags for test_drums.mp3 (105 seconds = 105000ms)
const generateTestFlags = (): Flag[] => {
  const numFlags = 15 + Math.floor(Math.random() * 6); // 15-20 flags
  const flags: Flag[] = [];
  const usedTimestamps = new Set<number>();

  for (let i = 0; i < numFlags; i++) {
    // Generate a random timestamp, avoiding duplicates and clustering
    let timestamp: number;
    do {
      timestamp = Math.floor(Math.random() * 105000);
    } while (
      // Ensure at least 3 seconds apart from other flags
      Array.from(usedTimestamps).some((t) => Math.abs(t - timestamp) < 3000)
    );
    usedTimestamps.add(timestamp);

    const user = getRandomTestUser();
    const label = FLAG_LABELS[Math.floor(Math.random() * FLAG_LABELS.length)];
    const description =
      FLAG_DESCRIPTIONS[Math.floor(Math.random() * FLAG_DESCRIPTIONS.length)];

    flags.push({
      id: `flag-${i}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      label,
      note: description,
      createdBy: user.name,
      createdAt: Date.now() - Math.floor(Math.random() * 3600000), // Random time in last hour
      userColor: user.color,
    });
  }

  // Sort by timestamp
  return flags.sort((a, b) => a.timestamp - b.timestamp);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface AudioToolProps {
  investigationId?: string;
}

export const AudioTool: React.FC<AudioToolProps> = ({ investigationId }) => {
  const [selectedFile, setSelectedFile] = useState<MediaFileItem | null>(null);
  const [flags, setFlags] = useState<Flag[]>([]);

  // Draggable divider state for Filters/Flags sections (percentage for filters section)
  const [sectionDividerPosition, setSectionDividerPosition] = useState(50); // 50% for filters
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const dividerContainerRef = useRef<HTMLDivElement>(null);
  const [expandVideoModalOpen, setExpandVideoModalOpen] = useState(false);

  // Video reference panel state
  const [loadedVideoUrl, setLoadedVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Flag user filter state
  const [enabledUserIds, setEnabledUserIds] = useState<string[]>([]);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const flagsListRef = useRef<HTMLDivElement>(null);

  // Flag visibility on waveform state
  const [flagsVisibleOnWaveform, setFlagsVisibleOnWaveform] = useState(true);

  // File drop zone state
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio data from Zustand store (persists across navigation)
  const loadedAudio = useAudioToolStore((state) => state.loadedAudioFile);
  const audioBuffer = useAudioToolStore((state) => state.audioBuffer);
  const waveformData = useAudioToolStore((state) => state.waveformData);
  const setStoreLoadedAudioFile = useAudioToolStore(
    (state) => state.setLoadedAudioFile,
  );
  const setStoreAudioBuffer = useAudioToolStore(
    (state) => state.setAudioBuffer,
  );
  const setStoreWaveformData = useAudioToolStore(
    (state) => state.setWaveformData,
  );

  // Real audio data state (Web Audio API) - AudioContext needs to be local as it can't be serialized
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  // Unified container ref and width for PlayheadLine (spans TimeScale + Waveform)
  const unifiedContainerRef = useRef<HTMLDivElement>(null);
  const [unifiedContainerWidth, setUnifiedContainerWidth] = useState(0);

  // Toast notification state
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "info" | "warning";
  }>({
    open: false,
    message: "",
    severity: "info",
  });

  // Filter values
  const [filters, setFilters] = useState({
    deNoise: 0,
    deHum: 0,
    lowCut: 20, // 20Hz = off, up to 300Hz
    highCut: 20000, // 20kHz = off, down to 2kHz
    clarity: 0, // 0 = off, up to +12dB boost
  });

  // EQ values (-12 to +12 dB for each band)
  const [eqValues, setEqValues] = useState<number[]>([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);

  // Waveform selection state
  const [waveformSelection, setWaveformSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);

  // Overview bar / zoom state
  const [overviewZoom, setOverviewZoom] = useState(1); // 1 = fit to view
  const [overviewScrollOffset, setOverviewScrollOffset] = useState(0); // 0-1 position
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [zoomToolActive, setZoomToolActive] = useState(false);

  // Waveform height state
  const [waveformHeight, setWaveformHeight] = useState(1); // 0.5 to 2.0

  // Marquee zoom selection state
  const [marqueeStart, setMarqueeStart] = useState<number | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<number | null>(null);

  // Time selection state (separate from marquee zoom - for selecting audio regions to play/loop)
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);

  // Enhanced interaction state for proper waveform behaviors
  const [mouseDownPos, setMouseDownPos] = useState<{
    x: number;
    time: number;
  } | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [interactionType, setInteractionType] = useState<
    | "none"
    | "panView"
    | "scrubPlayhead"
    | "createSelection"
    | "moveSelection"
    | "adjustHandleStart"
    | "adjustHandleEnd"
  >("none");
  const [selectionDragOffset, setSelectionDragOffset] = useState<number>(0);

  // Ref for waveform container to calculate selection positions
  const waveformContainerRef = useRef<HTMLDivElement>(null);

  // Playhead store for waveform integration
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const setClickOrigin = usePlayheadStore((state) => state.setClickOrigin);

  // Audio tool store for loop state and selection sync
  const looping = useAudioToolStore((state) => state.playback.looping);
  const toggleLooping = useAudioToolStore((state) => state.toggleLooping);
  const syncWaveformSelectionToStore = useAudioToolStore(
    (state) => state.setWaveformSelection,
  );

  const navigateToTool = useNavigationStore((state) => state.navigateToTool);
  const loadedFileId = useNavigationStore((state) => state.loadedFiles.audio);

  // Audio playback hook - wires up Web Audio API playback with playhead store
  // Also handles EQ filtering, low cut filter, high cut filter, De-Hum filter, De-Noise filter
  const { seek: audioSeek, scrub: audioScrub } = useAudioPlayback({
    audioContext,
    audioBuffer,
    duration: loadedAudio?.duration || 0,
    eqValues,
    lowCutFrequency: filters.lowCut,
    highCutFrequency: filters.highCut,
    deHumAmount: filters.deHum,
    deNoiseAmount: filters.deNoise,
    clarityAmount: filters.clarity,
  });

  // Load file when navigated to
  useEffect(() => {
    if (loadedFileId) {
      const file = allMediaFiles.find((f) => f.id === loadedFileId);
      if (file) {
        // Store in Zustand for persistence across navigation
        const loaded = toLoadedAudioFile(file);
        if (loaded) setStoreLoadedAudioFile(loaded);
        setSelectedFile(file);
      }
    }
  }, [loadedFileId, setStoreLoadedAudioFile]);

  // Restore AudioContext on mount when audio data exists in store
  // AudioContext can't be serialized, so we need to create it when component mounts
  useEffect(() => {
    if (audioBuffer && !audioContext) {
      // Create a new AudioContext for the restored audio
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      audioBufferRef.current = audioBuffer;
      setAudioContext(ctx);
    }
  }, [audioBuffer, audioContext]);

  // Sync selectedFile with loadedAudio from store on mount
  useEffect(() => {
    if (loadedAudio && !selectedFile) {
      setSelectedFile(loadedAudio as (typeof audioFiles)[0]);
    }
  }, [loadedAudio, selectedFile]);

  // Generate test flags when test_drums.mp3 is loaded
  useEffect(() => {
    if (loadedAudio?.fileName === "test_drums.mp3") {
      // Generate random test flags for multi-user simulation
      setFlags(generateTestFlags());
      // Initialize enabled users to all users
      setEnabledUserIds(TEST_USERS.map((u) => u.id));
    } else {
      // Clear flags when loading different files
      setFlags([]);
      setEnabledUserIds([]);
    }
    // Also clear selected flag
    setSelectedFlagId(null);
  }, [loadedAudio?.fileName]);

  // Measure unified container width for PlayheadLine positioning
  useEffect(() => {
    if (unifiedContainerRef.current) {
      const resizeObserver = new ResizeObserver((entries) => {
        setUnifiedContainerWidth(entries[0].contentRect.width);
      });
      resizeObserver.observe(unifiedContainerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Calculate combined scrubbing state for audio-only file selection interactions
  // Note: Video files use click-to-seek only (no playhead dragging)
  // This state is mainly for audio-only file selection creation/move/resize
  const isVideoScrubbing =
    isScrubbing ||
    (hasDragged &&
      (interactionType === "scrubPlayhead" ||
        interactionType === "createSelection" ||
        interactionType === "moveSelection" ||
        interactionType === "adjustHandleStart" ||
        interactionType === "adjustHandleEnd"));

  // Use the video sync hook for smooth video playback synchronized with waveform
  // Only active when video reference panel is visible (not when modal is open)
  const { isVideoLoading, isVideoReady } = useVideoSync({
    videoRef,
    videoUrl: loadedVideoUrl,
    isActive: !expandVideoModalOpen && !!loadedVideoUrl,
    duration: loadedAudio?.duration || 0,
    isScrubbing: isVideoScrubbing,
  });

  // Sync local selection state with audio tool store (for TransportControls access)
  useEffect(() => {
    syncWaveformSelectionToStore(selectionStart, selectionEnd);
  }, [selectionStart, selectionEnd, syncWaveformSelectionToStore]);

  // Loop within selection effect
  // When looping is enabled and a selection exists, loop within the selection bounds
  useEffect(() => {
    if (!isPlaying || !looping || !loadedAudio || !loadedAudio.duration) return;

    const currentTimeSec = timestamp / 1000;
    const duration = loadedAudio.duration;

    // If selection exists and playhead is past the selection end, loop back to start
    if (selectionStart !== null && selectionEnd !== null) {
      const loopStart = selectionStart;
      const loopEnd = selectionEnd;
      if (currentTimeSec >= loopEnd) {
        setTimestamp(loopStart * 1000);
      }
    } else {
      // No selection - loop entire track
      if (currentTimeSec >= duration) {
        setTimestamp(0);
      }
    }
  }, [
    isPlaying,
    looping,
    timestamp,
    selectionStart,
    selectionEnd,
    loadedAudio,
    setTimestamp,
  ]);

  // Page scroll effect - DAW-style page snap during playback
  // When the playhead reaches the right edge of the visible waveform area during playback,
  // snap the view to the next "page" so the playhead appears near the left side
  useEffect(() => {
    // Only trigger during active playback
    if (!isPlaying) return;
    // Need audio loaded with valid duration
    if (!loadedAudio || !loadedAudio.duration || loadedAudio.duration <= 0)
      return;
    // Only needed when zoomed in (zoom > 1 means not all content is visible)
    if (overviewZoom <= 1) return;

    const duration = loadedAudio.duration;
    const currentTimeSec = timestamp / 1000;

    // Calculate the visible window
    const visibleWidth = 1 / overviewZoom; // Fraction of total duration visible
    const visibleEnd = overviewScrollOffset + visibleWidth; // End of visible area as fraction

    // Calculate playhead position as a fraction of total duration
    const playheadFraction = currentTimeSec / duration;

    // Check if playhead has reached or exceeded the right edge of visible area
    if (playheadFraction >= visibleEnd) {
      // Calculate new scroll offset to place playhead at the left side of the view
      // We set the new scroll offset to the playhead position, so it appears at the left edge
      const newScrollOffset = Math.max(
        0,
        Math.min(1 - visibleWidth, playheadFraction),
      );

      // Only update if the new offset is meaningfully different (avoid unnecessary renders)
      if (Math.abs(newScrollOffset - overviewScrollOffset) > 0.001) {
        setOverviewScrollOffset(newScrollOffset);
      }
    }
  }, [isPlaying, timestamp, loadedAudio, overviewZoom, overviewScrollOffset]);

  // Load and decode real audio file
  const loadAudioFile = useCallback(
    async (filePath: string, fileItem: MediaFileItem) => {
      try {
        setIsLoadingAudio(true);

        // Create and resume audio context (needed for user interaction)
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        // Must resume after user interaction
        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        const ctx = audioContextRef.current;

        // Fetch and decode audio
        const response = await fetch(filePath);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

        // Store the decoded buffer for playback (both ref and state for hook reactivity)
        audioBufferRef.current = decodedBuffer;
        setStoreAudioBuffer(decodedBuffer);
        setAudioContext(ctx);

        // PHASE 1: Waveform (instant)
        const channelData = decodedBuffer.getChannelData(0); // Mono or left channel
        const samples = channelData.length;
        const audioDuration = decodedBuffer.duration;

        // Calculate points based on actual duration (40 points per second for good resolution)
        // This ensures waveform data length is proportional to duration
        const targetPoints = Math.min(4000, Math.ceil(audioDuration * 40));
        const blockSize = Math.floor(samples / targetPoints);
        const waveform = new Float32Array(targetPoints);

        for (let i = 0; i < targetPoints; i++) {
          let max = 0;
          const startSample = i * blockSize;
          const endSample = Math.min(startSample + blockSize, samples); // Don't exceed actual samples

          for (let j = startSample; j < endSample; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          waveform[i] = max; // Use peak value for each block
        }
        setStoreWaveformData(waveform);

        // Clear video URL since this is an audio file
        setLoadedVideoUrl(null);

        // Set loaded state immediately (waveform ready) - store in Zustand for persistence
        const loadedFile: MediaFileItem = {
          ...fileItem,
          duration: decodedBuffer.duration,
          hasVideo: false,
        };
        const loaded = toLoadedAudioFile(loadedFile);
        if (loaded) setStoreLoadedAudioFile(loaded);
        setSelectedFile(loadedFile);

        setIsLoadingAudio(false);
      } catch (error) {
        console.error("Error loading audio:", error);
        // Fall back to mock data on error - still store in Zustand for persistence
        const loaded = toLoadedAudioFile(fileItem);
        if (loaded) setStoreLoadedAudioFile(loaded);
        setSelectedFile(fileItem);
        setIsLoadingAudio(false);
      }
    },
    [setStoreAudioBuffer, setStoreWaveformData, setStoreLoadedAudioFile],
  );

  // Load video file and extract audio for waveform editing
  const loadVideoAudio = useCallback(
    async (videoPath: string, fileItem: MediaFileItem) => {
      try {
        setIsLoadingAudio(true);

        // Create and resume audio context (needed for user interaction)
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        if (audioContextRef.current.state === "suspended") {
          await audioContextRef.current.resume();
        }

        const ctx = audioContextRef.current;

        // Set video URL for the Video Reference panel
        setLoadedVideoUrl(videoPath);

        // Extract audio from video using fetch + Web Audio API
        // The browser will decode the video and give us the audio track
        const response = await fetch(videoPath);
        const arrayBuffer = await response.arrayBuffer();

        // Try to decode audio from the video file
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

        // Store the decoded buffer for playback
        audioBufferRef.current = decodedBuffer;
        setStoreAudioBuffer(decodedBuffer);
        setAudioContext(ctx);

        // Generate waveform data
        const channelData = decodedBuffer.getChannelData(0);
        const samples = channelData.length;
        const audioDuration = decodedBuffer.duration;

        const targetPoints = Math.min(4000, Math.ceil(audioDuration * 40));
        const blockSize = Math.floor(samples / targetPoints);
        const waveform = new Float32Array(targetPoints);

        for (let i = 0; i < targetPoints; i++) {
          let max = 0;
          const startSample = i * blockSize;
          const endSample = Math.min(startSample + blockSize, samples);

          for (let j = startSample; j < endSample; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          waveform[i] = max;
        }
        setStoreWaveformData(waveform);

        // Set loaded state - mark as having video
        const loadedFile: MediaFileItem = {
          ...fileItem,
          duration: decodedBuffer.duration,
          hasVideo: true,
          videoUrl: videoPath,
        };
        const loaded = toLoadedAudioFile(loadedFile);
        if (loaded) setStoreLoadedAudioFile(loaded);
        setSelectedFile(loadedFile);

        setIsLoadingAudio(false);
      } catch (error) {
        console.error("Error loading video audio:", error);
        // Fall back - still show video but without audio waveform
        setLoadedVideoUrl(videoPath);
        const loadedFile: MediaFileItem = {
          ...fileItem,
          hasVideo: true,
          videoUrl: videoPath,
        };
        const loaded = toLoadedAudioFile(loadedFile);
        if (loaded) setStoreLoadedAudioFile(loaded);
        setSelectedFile(loadedFile);
        setIsLoadingAudio(false);
      }
    },
    [setStoreAudioBuffer, setStoreWaveformData, setStoreLoadedAudioFile],
  );

  const handleDoubleClick = useCallback(
    (item: MediaFileItem) => {
      // Clear previous real audio data from store
      setStoreWaveformData(null);
      setStoreAudioBuffer(null);

      // Check if this is a video file
      if (item.type === "video" && item.videoUrl) {
        // Load video and extract audio
        loadVideoAudio(item.videoUrl, item);
      } else if (item.path) {
        // Load regular audio file
        loadAudioFile(item.path, item);
      } else {
        // Use mock data for files without a path
        setLoadedVideoUrl(null);
        const loaded = toLoadedAudioFile(item);
        if (loaded) setStoreLoadedAudioFile(loaded);
        setSelectedFile(item);
      }
    },
    [
      loadAudioFile,
      loadVideoAudio,
      setStoreWaveformData,
      setStoreAudioBuffer,
      setStoreLoadedAudioFile,
    ],
  );

  const handleEQChange = useCallback((index: number, value: number) => {
    setEqValues((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }, []);

  // Reset all EQ bands to 0dB (flat)
  const resetAllEQ = useCallback(() => {
    setEqValues([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }, []);

  const resetAllFilters = useCallback(() => {
    setFilters({
      deNoise: 0,
      deHum: 0,
      lowCut: 20,
      highCut: 20000,
      clarity: 0,
    });
  }, []);

  // Handlers for the horizontal divider between filters and flags
  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDivider(true);
  }, []);

  const handleDividerMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingDivider || !dividerContainerRef.current) return;

      const containerRect = dividerContainerRef.current.getBoundingClientRect();
      const y = e.clientY - containerRect.top;
      const containerHeight = containerRect.height;

      // Calculate percentage, clamping to reasonable limits
      // Filters section: 120px minimum (enough for sliders)
      // Flags section: 150px minimum (enough for header + 2-3 rows)
      const minFiltersHeight = 120;
      const minFlagsHeight = 150;
      const minFiltersPercent = (minFiltersHeight / containerHeight) * 100;
      const maxFiltersPercent =
        ((containerHeight - minFlagsHeight) / containerHeight) * 100;

      const newPosition = Math.max(
        minFiltersPercent,
        Math.min(maxFiltersPercent, (y / containerHeight) * 100),
      );
      setSectionDividerPosition(newPosition);
    },
    [isDraggingDivider],
  );

  const handleDividerMouseUp = useCallback(() => {
    setIsDraggingDivider(false);
  }, []);

  // Add/remove global mouse listeners for divider dragging
  useEffect(() => {
    if (isDraggingDivider) {
      document.addEventListener("mousemove", handleDividerMouseMove);
      document.addEventListener("mouseup", handleDividerMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleDividerMouseMove);
        document.removeEventListener("mouseup", handleDividerMouseUp);
      };
    }
  }, [isDraggingDivider, handleDividerMouseMove, handleDividerMouseUp]);

  const formatFilterValue = (
    filterName: keyof typeof filters,
    value: number,
  ) => {
    switch (filterName) {
      case "deNoise":
      case "deHum":
        return `${value}%`;
      case "lowCut":
        return value === 20 ? "Off" : `${value}Hz`;
      case "highCut":
        return value === 20000
          ? "Off"
          : value >= 10000
            ? `${(value / 1000).toFixed(0)}k`
            : `${(value / 1000).toFixed(1)}k`;
      case "clarity":
        return value === 0 ? "0" : `${value > 0 ? "+" : ""}${value}dB`;
      default:
        return String(value);
    }
  };

  // ============================================================================
  // FILE DROP ZONE HANDLERS
  // ============================================================================

  // Show toast notification
  const showToast = useCallback(
    (
      message: string,
      severity: "success" | "error" | "info" | "warning" = "info",
    ) => {
      setToast({ open: true, message, severity });
    },
    [],
  );

  // Close toast
  const handleCloseToast = useCallback(() => {
    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  // Process dropped/imported audio file
  const processAudioFile = useCallback(
    (file: File) => {
      if (!isFileType(file, "audio")) {
        showToast(getFileTypeErrorMessage("audio"), "error");
        return;
      }

      // Try to generate test metadata in development mode
      const testMetadata = generateTestMetadataIfDev(file);

      // Create a mock audio item from the imported file (Quick Analysis Mode)
      // Use test metadata if available (dev mode), otherwise use defaults
      const mockItem = {
        id: testMetadata?.id || `import-${Date.now()}`,
        type: "audio" as const,
        fileName: file.name,
        duration: testMetadata?.duration
          ? Math.floor(testMetadata.duration / 1000) // Convert ms to seconds
          : 180, // Default 3 minutes
        capturedAt: testMetadata?.timestamp.getTime() || Date.now(),
        user: testMetadata?.user || "Imported",
        deviceInfo: testMetadata?.deviceId || "Imported File",
        format: file.type || "audio/unknown",
        sampleRate: 44100,
        channels: 2,
        flagCount: 0,
        gps: testMetadata?.gpsCoordinates
          ? formatGPSCoordinates(testMetadata.gpsCoordinates)
          : null,
      };

      // Store in Zustand for persistence across navigation
      setStoreLoadedAudioFile(mockItem as LoadedAudioFile);
      setSelectedFile(mockItem as MediaFileItem);
      showToast(`Loaded: ${file.name}`, "success");
    },
    [showToast, setStoreLoadedAudioFile],
  );

  // Handle file drag enter
  const handleFileDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
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
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  // Handle file drop
  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsFileDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        processAudioFile(files[0]); // Only process first file for single-file tools
      }
    },
    [processAudioFile],
  );

  // Handle Import button click
  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle Export button click
  const handleExportClick = useCallback(() => {
    console.log("Export clicked - will open export panel");
  }, []);

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        processAudioFile(files[0]);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [processAudioFile],
  );

  // Handle drop zone click
  const handleDropZoneClick = useCallback((e: React.MouseEvent) => {
    // Open the file picker
    fileInputRef.current?.click();
    // Stop propagation to prevent parent handlers from triggering (e.g., fullscreen exit)
    e.stopPropagation();
  }, []);

  // Waveform seek handler - converts seconds to milliseconds for playhead store
  const handleWaveformSeek = useCallback(
    (timeInSeconds: number) => {
      setTimestamp(timeInSeconds * 1000); // Convert to milliseconds
    },
    [setTimestamp],
  );

  // Waveform selection handler
  const handleWaveformSelection = useCallback(
    (startTime: number, endTime: number) => {
      setWaveformSelection({ start: startTime, end: endTime });
      // Could be used for loop points or region editing
      console.log("Waveform selection:", startTime, "-", endTime, "seconds");
    },
    [],
  );

  // Overview bar handlers
  const handleOverviewSeek = useCallback(
    (timeInSeconds: number) => {
      // Use audioSeek which handles both timestamp update and playback restart if playing
      audioSeek(timeInSeconds);
    },
    [audioSeek],
  );

  const handleOverviewViewportDrag = useCallback((newScrollOffset: number) => {
    setOverviewScrollOffset(newScrollOffset);
  }, []);

  const handleOverviewScrub = useCallback(
    (timeInSeconds: number, scrubbing: boolean) => {
      setIsScrubbing(scrubbing);
      setTimestamp(timeInSeconds * 1000); // Convert to milliseconds
      // TODO: In a real implementation, we would play audio snippets during scrubbing
    },
    [setTimestamp],
  );

  // Zoom/scroll handlers for waveform
  const handleZoomChange = useCallback((newZoom: number) => {
    setOverviewZoom(newZoom);
  }, []);

  const handleScrollChange = useCallback((newOffset: number) => {
    setOverviewScrollOffset(newOffset);
  }, []);

  // Zoom in/out button handlers - snap to 0.1 increments
  const handleZoomIn = useCallback(() => {
    // Snap to next 0.1 increment
    const newZoom = Math.min(10, Math.round((overviewZoom + 0.1) * 10) / 10);
    const snappedZoom = Math.round(newZoom * 10) / 10; // Ensure clean 0.1 snap
    const playheadTime = timestamp / 1000;
    const duration = loadedAudio?.duration || 0;
    const newVisibleDuration = duration / snappedZoom;
    const newScrollOffset = Math.max(
      0,
      Math.min(
        1 - 1 / snappedZoom,
        (playheadTime - newVisibleDuration / 2) / duration,
      ),
    );

    setOverviewZoom(snappedZoom);
    setOverviewScrollOffset(newScrollOffset);
  }, [overviewZoom, timestamp, loadedAudio?.duration]);

  const handleZoomOut = useCallback(() => {
    // Snap to previous 0.1 increment
    const newZoom = Math.max(1, Math.round((overviewZoom - 0.1) * 10) / 10);
    const snappedZoom = Math.max(1, Math.round(newZoom * 10) / 10); // Ensure clean 0.1 snap and min of 1
    const playheadTime = timestamp / 1000;
    const duration = loadedAudio?.duration || 0;
    const newVisibleDuration = duration / snappedZoom;
    const newScrollOffset = Math.max(
      0,
      Math.min(
        1 - 1 / snappedZoom,
        (playheadTime - newVisibleDuration / 2) / duration,
      ),
    );

    setOverviewZoom(snappedZoom);
    setOverviewScrollOffset(newScrollOffset);
  }, [overviewZoom, timestamp, loadedAudio?.duration]);

  // Zoom slider handler - keeps playhead centered (same logic as +/- buttons)
  // Slider step is already 0.5, so newZoom should be a clean 0.5 value
  const handleZoomSliderChange = useCallback(
    (newZoom: number) => {
      // Ensure clean 0.5 snap (defensive)
      const snappedZoom = Math.round(newZoom * 2) / 2;
      const duration = loadedAudio?.duration || 1;
      const playheadRatio = timestamp / 1000 / duration;

      // Calculate the visible window at new zoom level
      const visibleDuration = duration / snappedZoom;

      // Center the scroll offset on the playhead
      const newScrollOffset = Math.max(
        0,
        Math.min(1 - 1 / snappedZoom, playheadRatio - 0.5 / snappedZoom),
      );

      setOverviewZoom(snappedZoom);
      setOverviewScrollOffset(newScrollOffset);
    },
    [timestamp, loadedAudio?.duration],
  );

  // Marquee zoom handlers
  const handleMarqueeMouseDown = useCallback(
    (e: React.MouseEvent, containerRect: DOMRect) => {
      if (!zoomToolActive || !loadedAudio) return;

      const x = (e.clientX - containerRect.left) / containerRect.width;
      // Account for zoom and scroll when calculating time
      const visibleDuration = loadedAudio.duration / overviewZoom;
      const visibleStart = overviewScrollOffset * loadedAudio.duration;
      const time = visibleStart + x * visibleDuration;

      setMarqueeStart(time);
      setMarqueeEnd(time);
    },
    [zoomToolActive, loadedAudio, overviewZoom, overviewScrollOffset],
  );

  const handleMarqueeMouseMove = useCallback(
    (e: React.MouseEvent, containerRect: DOMRect) => {
      if (!zoomToolActive || marqueeStart === null || !loadedAudio) return;

      const x = (e.clientX - containerRect.left) / containerRect.width;
      // Account for zoom and scroll when calculating time
      const visibleDuration = loadedAudio.duration / overviewZoom;
      const visibleStart = overviewScrollOffset * loadedAudio.duration;
      const time = visibleStart + x * visibleDuration;

      setMarqueeEnd(time);
    },
    [
      zoomToolActive,
      marqueeStart,
      loadedAudio,
      overviewZoom,
      overviewScrollOffset,
    ],
  );

  const handleMarqueeMouseUp = useCallback(() => {
    if (
      !zoomToolActive ||
      marqueeStart === null ||
      marqueeEnd === null ||
      !loadedAudio
    ) {
      setMarqueeStart(null);
      setMarqueeEnd(null);
      return;
    }

    const startTime = Math.min(marqueeStart, marqueeEnd);
    const endTime = Math.max(marqueeStart, marqueeEnd);
    const selectionDuration = endTime - startTime;

    if (selectionDuration > 0.1) {
      // Minimum selection of 0.1 seconds
      // Calculate zoom level to fit selection
      const newZoom = Math.min(10, loadedAudio.duration / selectionDuration);

      // Place playhead at CENTER of selection
      const centerTime = (startTime + endTime) / 2;
      setTimestamp(centerTime * 1000); // Convert to ms

      // Center the scroll offset on the playhead (center of selection)
      const playheadRatio = centerTime / loadedAudio.duration;
      const newScrollOffset = Math.max(
        0,
        Math.min(1 - 1 / newZoom, playheadRatio - 0.5 / newZoom),
      );

      setOverviewZoom(newZoom);
      setOverviewScrollOffset(newScrollOffset);
    }

    setMarqueeStart(null);
    setMarqueeEnd(null);
    setZoomToolActive(false);
  }, [zoomToolActive, marqueeStart, marqueeEnd, loadedAudio, setTimestamp]);

  // ============================================================================
  // TIME SELECTION HELPERS AND HANDLERS
  // ============================================================================

  // Convert pixel position to time based on current zoom and scroll
  const pixelToTime = useCallback(
    (pixelX: number, containerWidth: number): number => {
      const duration = loadedAudio?.duration || 0;
      const visibleDuration = duration / overviewZoom;
      const visibleStart = overviewScrollOffset * duration;
      const relativeX = pixelX / containerWidth;
      return visibleStart + relativeX * visibleDuration;
    },
    [loadedAudio?.duration, overviewZoom, overviewScrollOffset],
  );

  // Convert time to pixel position based on current zoom and scroll
  const timeToPixel = useCallback(
    (time: number, containerWidth: number): number => {
      const duration = loadedAudio?.duration || 0;
      const visibleDuration = duration / overviewZoom;
      const visibleStart = overviewScrollOffset * duration;
      const relativeTime = (time - visibleStart) / visibleDuration;
      return relativeTime * containerWidth;
    },
    [loadedAudio?.duration, overviewZoom, overviewScrollOffset],
  );

  // Determine what element was clicked on the waveform
  const getClickTarget = useCallback(
    (
      x: number,
      containerWidth: number,
    ): "playhead" | "selection" | "handleStart" | "handleEnd" | "waveform" => {
      // Check playhead (within 6 pixels)
      const playheadPixel = timeToPixel(timestamp / 1000, containerWidth);
      if (Math.abs(x - playheadPixel) < 6) {
        return "playhead";
      }

      // Check selection handles and area (if selection exists)
      if (selectionStart !== null && selectionEnd !== null) {
        const startPixel = timeToPixel(
          Math.min(selectionStart, selectionEnd),
          containerWidth,
        );
        const endPixel = timeToPixel(
          Math.max(selectionStart, selectionEnd),
          containerWidth,
        );

        // Handle start (within 8 pixels)
        if (Math.abs(x - startPixel) < 8) {
          return "handleStart";
        }
        // Handle end (within 8 pixels)
        if (Math.abs(x - endPixel) < 8) {
          return "handleEnd";
        }
        // Inside selection area
        if (x > startPixel && x < endPixel) {
          return "selection";
        }
      }

      return "waveform";
    },
    [timeToPixel, timestamp, selectionStart, selectionEnd],
  );

  // Handle waveform mouse down - detect what was clicked and set interaction type
  const handleWaveformMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!loadedAudio || zoomToolActive) return;

      const rect = waveformContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const time = pixelToTime(x, rect.width);

      setMouseDownPos({ x: e.clientX, time });
      setHasDragged(false);

      const target = getClickTarget(x, rect.width);

      switch (target) {
        case "playhead":
          setInteractionType("scrubPlayhead");
          break;
        case "handleStart":
          setInteractionType("adjustHandleStart");
          break;
        case "handleEnd":
          setInteractionType("adjustHandleEnd");
          break;
        case "selection":
          setInteractionType("moveSelection");
          // Store offset from click position to selection start
          setSelectionDragOffset(time - (selectionStart || 0));
          break;
        case "waveform":
          setInteractionType("createSelection");
          // Don't start selection yet - wait for drag
          break;
      }
    },
    [loadedAudio, zoomToolActive, pixelToTime, getClickTarget, selectionStart],
  );

  // Handle waveform mouse move - process dragging based on interaction type
  const handleWaveformMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!loadedAudio || interactionType === "none") return;

      const rect = waveformContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const time = pixelToTime(x, rect.width);
      const clampedTime = Math.max(0, Math.min(loadedAudio.duration, time));

      // Check if we've moved enough to count as a drag
      if (mouseDownPos && !hasDragged) {
        const distance = Math.abs(e.clientX - mouseDownPos.x);
        if (distance > 5) {
          setHasDragged(true);

          // If creating selection, initialize it now (only when paused)
          // When playing, selection creation is blocked - drag is treated as single click
          if (interactionType === "createSelection" && !isPlaying) {
            setSelectionStart(mouseDownPos.time);
            setSelectionEnd(mouseDownPos.time);
          }
        }
      }

      if (!hasDragged) return;

      switch (interactionType) {
        case "panView": {
          // Pan the waveform view left/right
          const deltaX = e.clientX - (mouseDownPos?.x || 0);
          const duration = loadedAudio.duration;
          const visibleDuration = duration / overviewZoom;
          const deltaTime = (deltaX / rect.width) * visibleDuration;
          const deltaOffset = deltaTime / duration;

          const newScrollOffset = Math.max(
            0,
            Math.min(1 - 1 / overviewZoom, overviewScrollOffset - deltaOffset),
          );
          setOverviewScrollOffset(newScrollOffset);

          // Update mouseDownPos for continuous panning
          setMouseDownPos({ x: e.clientX, time: mouseDownPos?.time || 0 });
          break;
        }

        case "scrubPlayhead":
          setTimestamp(clampedTime * 1000);
          break;

        case "createSelection":
          // Only update selection when paused - when playing, drag is ignored
          if (!isPlaying) {
            setSelectionEnd(clampedTime);
          }
          break;

        case "adjustHandleStart": {
          const currentEnd = selectionEnd ?? 0;
          if (clampedTime < currentEnd) {
            setSelectionStart(clampedTime);
          } else {
            // Swap: start becomes end, dragged position becomes new end
            setSelectionStart(currentEnd);
            setSelectionEnd(clampedTime);
            setInteractionType("adjustHandleEnd");
          }
          break;
        }

        case "adjustHandleEnd": {
          const currentStart = selectionStart ?? 0;
          if (clampedTime > currentStart) {
            setSelectionEnd(clampedTime);
          } else {
            // Swap: end becomes start, dragged position becomes new start
            setSelectionEnd(currentStart);
            setSelectionStart(clampedTime);
            setInteractionType("adjustHandleStart");
          }
          break;
        }

        case "moveSelection":
          if (selectionStart !== null && selectionEnd !== null) {
            const selectionDuration = Math.abs(selectionEnd - selectionStart);
            const newStart = clampedTime - selectionDragOffset;
            const newEnd = newStart + selectionDuration;

            // Keep selection within bounds
            if (newStart >= 0 && newEnd <= loadedAudio.duration) {
              setSelectionStart(newStart);
              setSelectionEnd(newEnd);
            } else if (newStart < 0) {
              setSelectionStart(0);
              setSelectionEnd(selectionDuration);
            } else {
              setSelectionStart(loadedAudio.duration - selectionDuration);
              setSelectionEnd(loadedAudio.duration);
            }
          }
          break;
      }
    },
    [
      loadedAudio,
      interactionType,
      pixelToTime,
      mouseDownPos,
      hasDragged,
      selectionStart,
      selectionEnd,
      selectionDragOffset,
      setTimestamp,
      overviewZoom,
      overviewScrollOffset,
      isPlaying,
    ],
  );

  // Handle waveform mouse up - finalize interaction
  const handleWaveformMouseUp = useCallback(
    (e?: React.MouseEvent) => {
      if (!loadedAudio) {
        setInteractionType("none");
        setMouseDownPos(null);
        setHasDragged(false);
        setSelectionDragOffset(0);
        return;
      }

      // Single click (no drag)
      if (!hasDragged) {
        if (
          interactionType === "createSelection" ||
          interactionType === "none"
        ) {
          // Single click on waveform = move playhead and clear any existing selection
          const rect = waveformContainerRef.current?.getBoundingClientRect();
          if (rect && e) {
            const x = e.clientX - rect.left;
            const time = pixelToTime(x, rect.width);
            const clampedTime = Math.max(
              0,
              Math.min(loadedAudio.duration, time),
            );
            const timestampMs = clampedTime * 1000;
            setTimestamp(timestampMs);
            // Set click origin for "return to click" feature
            setClickOrigin(timestampMs);
            // Clear any existing selection on single click
            setSelectionStart(null);
            setSelectionEnd(null);
          }
        }
        // Single click on playhead, selection, or handles = do nothing (no drag occurred)
      }
      // Drag completed
      else {
        if (interactionType === "createSelection") {
          // If playing, selection creation was blocked - treat as single click at mousedown position
          if (isPlaying) {
            if (mouseDownPos) {
              const clampedTime = Math.max(
                0,
                Math.min(loadedAudio.duration, mouseDownPos.time),
              );
              const timestampMs = clampedTime * 1000;
              setTimestamp(timestampMs);
              setClickOrigin(timestampMs);
            }
          } else {
            // Paused: finalize the selection
            if (selectionStart !== null && selectionEnd !== null) {
              const finalStart = Math.min(selectionStart, selectionEnd);
              const finalEnd = Math.max(selectionStart, selectionEnd);

              // Clear if too small
              if (finalEnd - finalStart < 0.05) {
                setSelectionStart(null);
                setSelectionEnd(null);
              } else {
                setSelectionStart(finalStart);
                setSelectionEnd(finalEnd);
                // Auto-enable loop mode when selection is created
                if (!looping) {
                  toggleLooping();
                }
                // Move playhead to selection start
                setTimestamp(finalStart * 1000);
              }
            }
          }
        }
        // Other drag types (panView, scrub, move selection, adjust handles) are already applied
      }

      // Reset interaction state
      setInteractionType("none");
      setMouseDownPos(null);
      setHasDragged(false);
      setSelectionDragOffset(0);
    },
    [
      loadedAudio,
      hasDragged,
      interactionType,
      selectionStart,
      selectionEnd,
      pixelToTime,
      setTimestamp,
      setClickOrigin,
      isPlaying,
      mouseDownPos,
      looping,
      toggleLooping,
    ],
  );

  // Handle mouse leaving the waveform area
  const handleWaveformMouseLeave = useCallback(() => {
    // If we were creating a selection but hadn't dragged yet, cancel it
    if (interactionType === "createSelection" && !hasDragged) {
      setSelectionStart(null);
      setSelectionEnd(null);
    }

    setInteractionType("none");
    setMouseDownPos(null);
    setHasDragged(false);
    setSelectionDragOffset(0);
  }, [interactionType, hasDragged]);

  // Clear selection function
  const clearSelection = useCallback(() => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setInteractionType("none");
  }, []);

  // Filter flags for display based on enabled users
  const filteredFlagsForDisplay = flags.filter((flag) => {
    const flagUserId = flag.createdBy?.toLowerCase() || "";
    return enabledUserIds.includes(flagUserId);
  });

  // Get sorted flags by timestamp for navigation
  const sortedFlags = [...filteredFlagsForDisplay].sort(
    (a, b) => a.timestamp - b.timestamp,
  );

  // Handle flag click from waveform - jump to flag timestamp and select it
  const handleWaveformFlagClick = useCallback(
    (flag: Flag) => {
      // Jump playhead to flag timestamp
      setTimestamp(flag.timestamp);
      audioSeek(flag.timestamp / 1000);
      // Select the flag
      setSelectedFlagId(flag.id);
      // Scroll flag into view in the list
      setTimeout(() => {
        const flagElement = document.querySelector(
          `[data-flag-id="${flag.id}"]`,
        );
        if (flagElement) {
          flagElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 0);
    },
    [setTimestamp, audioSeek],
  );

  // Handle flag drag from waveform - update flag timestamp
  const handleWaveformFlagDrag = useCallback(
    (flagId: string, newTimestamp: number) => {
      // Clamp timestamp to valid audio range
      const clampedTimestamp = Math.max(
        0,
        Math.min(newTimestamp, (loadedAudio?.duration || 0) * 1000),
      );
      // Update the flag's timestamp in state
      setFlags((prev) =>
        prev
          .map((f) =>
            f.id === flagId ? { ...f, timestamp: clampedTimestamp } : f,
          )
          .sort((a, b) => a.timestamp - b.timestamp),
      ); // Re-sort by timestamp
      // Select the dragged flag
      setSelectedFlagId(flagId);
    },
    [loadedAudio?.duration],
  );

  // Navigate to next/previous flag based on current playhead position
  const navigateToFlag = useCallback(
    (direction: "next" | "prev") => {
      if (sortedFlags.length === 0) return;

      // Current playhead position in milliseconds
      const currentPlayhead = timestamp;

      let targetFlag: Flag | undefined;

      if (direction === "next") {
        // Find the first flag whose timestamp is GREATER than current playhead
        targetFlag = sortedFlags.find((f) => f.timestamp > currentPlayhead);
        // If no flag exists after current position, wrap to the first flag
        if (!targetFlag) {
          targetFlag = sortedFlags[0];
        }
      } else {
        // Find the last flag whose timestamp is LESS than current playhead
        // Filter to flags before current position, then take the last one
        const flagsBefore = sortedFlags.filter(
          (f) => f.timestamp < currentPlayhead,
        );
        if (flagsBefore.length > 0) {
          targetFlag = flagsBefore[flagsBefore.length - 1];
        } else {
          // If no flag exists before current position, wrap to the last flag
          targetFlag = sortedFlags[sortedFlags.length - 1];
        }
      }

      if (targetFlag) {
        handleWaveformFlagClick(targetFlag);
      }
    },
    [sortedFlags, timestamp, handleWaveformFlagClick],
  );

  // Keyboard handler for escape to clear selection and Tab navigation for flags
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or contentEditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "Escape") {
        clearSelection();
        setSelectedFlagId(null);
      }

      // Tab / Shift+Tab navigation between flags
      if (e.key === "Tab" && sortedFlags.length > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          navigateToFlag("prev");
        } else {
          navigateToFlag("next");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [clearSelection, sortedFlags.length, navigateToFlag]);

  // Click-to-seek handler for unified container
  // Calculates time position accounting for zoom and scroll
  const handleUnifiedContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (
        !unifiedContainerRef.current ||
        !loadedAudio ||
        loadedAudio.duration <= 0
      )
        return;
      const rect = unifiedContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickRatio = clickX / rect.width;

      // Account for zoom and scroll
      const visibleWidth = 1 / overviewZoom;
      const visibleStartNormalized = overviewScrollOffset;
      const clickNormalized =
        visibleStartNormalized + clickRatio * visibleWidth;

      const durationMs = loadedAudio.duration * 1000; // Convert seconds to milliseconds
      const newTimestamp = Math.max(
        0,
        Math.min(durationMs, clickNormalized * durationMs),
      );
      setTimestamp(newTimestamp);
      // Set click origin for "return to click" feature
      setClickOrigin(newTimestamp);
    },
    [
      loadedAudio,
      setTimestamp,
      setClickOrigin,
      overviewZoom,
      overviewScrollOffset,
    ],
  );

  // Right panel content - Video Reference + Filters + Flags
  const inspectorContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Video Reference - Always visible, no collapse */}
      <InspectorSection sx={{ flexShrink: 0 }}>
        <InspectorSectionHeader
          sx={{
            cursor: "default",
            "&:hover": { backgroundColor: "#1a1a1a" },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <InspectorSectionTitle>Video Reference</InspectorSectionTitle>
            {loadedAudio?.hasVideo && (
              <VideocamIcon sx={{ fontSize: 12, color: "#19abb5" }} />
            )}
          </Box>
        </InspectorSectionHeader>
        <InspectorSectionContent sx={{ p: 0 }}>
          {loadedAudio?.hasVideo && loadedVideoUrl ? (
            <>
              <Box
                sx={{
                  position: "relative",
                  backgroundColor: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  aspectRatio: "16/9",
                  maxHeight: 140,
                }}
              >
                {/* Only render video when modal is closed to avoid two video instances */}
                {!expandVideoModalOpen ? (
                  <>
                    <video
                      ref={videoRef}
                      src={loadedVideoUrl}
                      muted
                      playsInline
                      preload="auto"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                    {/* Loading spinner when video is seeking (delayed to avoid flicker) */}
                    {isVideoLoading && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0, 0, 0, 0.3)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          pointerEvents: "none",
                        }}
                      >
                        <CircularProgress size={24} sx={{ color: "#19abb5" }} />
                      </Box>
                    )}
                  </>
                ) : (
                  <Typography sx={{ color: "#555", fontSize: 10 }}>
                    Video playing in expanded view
                  </Typography>
                )}
              </Box>
              <Box
                sx={{
                  padding: "8px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                }}
              >
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    // Navigate to Video Tool without pausing playback
                    navigateToTool("video", loadedAudio?.id);
                  }}
                  sx={{
                    fontSize: 10,
                    color: "#888",
                    borderColor: "#333",
                    py: 0.75,
                    "&:hover": {
                      borderColor: "#19abb5",
                      color: "#19abb5",
                      backgroundColor: "rgba(25, 171, 181, 0.05)",
                    },
                  }}
                >
                  Open in Video Tool
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    // Open expand modal without pausing playback
                    setExpandVideoModalOpen(true);
                  }}
                  sx={{
                    fontSize: 10,
                    color: "#888",
                    borderColor: "#333",
                    py: 0.75,
                    "&:hover": {
                      borderColor: "#19abb5",
                      color: "#19abb5",
                      backgroundColor: "rgba(25, 171, 181, 0.05)",
                    },
                  }}
                >
                  Expand Video
                </Button>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                padding: "16px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography sx={{ color: "#444", fontSize: 10 }}>
                No video linked to this audio
              </Typography>
            </Box>
          )}
        </InspectorSectionContent>
      </InspectorSection>

      {/* Container for Filters and Flags with draggable divider */}
      <Box
        ref={dividerContainerRef}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* Filters Section - Always visible, no collapse */}
        <InspectorSection
          sx={{
            flex: `0 0 ${sectionDividerPosition}%`,
            minHeight: 120,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <InspectorSectionHeader
            sx={{
              cursor: "default",
              "&:hover": { backgroundColor: "#1a1a1a" },
            }}
          >
            <InspectorSectionTitle>Filters</InspectorSectionTitle>
            <Button
              size="small"
              onClick={resetAllFilters}
              disabled={!loadedAudio}
              sx={{
                fontSize: 9,
                color: "#666",
                py: 0.25,
                px: 1,
                minWidth: "auto",
                textTransform: "none",
                "&:hover": { color: "#19abb5", backgroundColor: "transparent" },
              }}
            >
              Reset All
            </Button>
          </InspectorSectionHeader>
          <InspectorSectionContent sx={{ pb: 2, flex: 1, overflow: "auto" }}>
            {/* De-Noise */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>De-Noise</FilterRowLabel>
                <FilterRowValue>
                  {formatFilterValue("deNoise", filters.deNoise)}
                </FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.deNoise}
                onChange={(_, v) =>
                  setFilters((prev) => ({ ...prev, deNoise: v as number }))
                }
                min={0}
                max={100}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* De-Hum */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>De-Hum</FilterRowLabel>
                <FilterRowValue>
                  {formatFilterValue("deHum", filters.deHum)}
                </FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.deHum}
                onChange={(_, v) =>
                  setFilters((prev) => ({ ...prev, deHum: v as number }))
                }
                min={0}
                max={100}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* Low Cut */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>Low Cut</FilterRowLabel>
                <FilterRowValue>
                  {formatFilterValue("lowCut", filters.lowCut)}
                </FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.lowCut}
                onChange={(_, v) =>
                  setFilters((prev) => ({ ...prev, lowCut: v as number }))
                }
                min={20}
                max={300}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* High Cut */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>High Cut</FilterRowLabel>
                <FilterRowValue>
                  {formatFilterValue("highCut", filters.highCut)}
                </FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={24000 - filters.highCut}
                onChange={(_, v) =>
                  setFilters((prev) => ({
                    ...prev,
                    highCut: 24000 - (v as number),
                  }))
                }
                min={4000}
                max={20000}
                step={100}
                disabled={!loadedAudio}
              />
            </FilterRow>

            {/* Clarity */}
            <FilterRow>
              <FilterRowHeader>
                <FilterRowLabel>Clarity</FilterRowLabel>
                <FilterRowValue>
                  {formatFilterValue("clarity", filters.clarity)}
                </FilterRowValue>
              </FilterRowHeader>
              <InspectorSlider
                value={filters.clarity}
                onChange={(_, v) =>
                  setFilters((prev) => ({ ...prev, clarity: v as number }))
                }
                min={0}
                max={12}
                disabled={!loadedAudio}
              />
            </FilterRow>
          </InspectorSectionContent>
        </InspectorSection>

        {/* Draggable Divider */}
        <HorizontalDivider
          isDragging={isDraggingDivider}
          onMouseDown={handleDividerMouseDown}
        />

        {/* Flags Section - Always visible, takes remaining space */}
        <Box sx={{ flex: 1, minHeight: 150, overflow: "hidden" }}>
          <FlagsPanel
            flags={flags}
            users={TEST_USERS as FlagUser[]}
            enabledUserIds={enabledUserIds}
            onFilterChange={setEnabledUserIds}
            selectedFlagId={selectedFlagId}
            flagsListRef={flagsListRef}
            onFlagClick={(flag) => {
              // Jump playhead to flag timestamp
              setTimestamp(flag.timestamp);
              // Also update audio playback position
              audioSeek(flag.timestamp / 1000);
              // Select the flag
              setSelectedFlagId(flag.id);
            }}
            onFlagAdd={() => {
              // Create a new flag at current playhead position
              // Randomly assign one of the test users to simulate multi-user collaboration
              const randomUser = getRandomTestUser();
              const newFlag: Flag = {
                id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: timestamp, // Current playhead position in ms
                label: "", // Empty label, user can edit later
                note: "", // Empty description
                createdBy: randomUser.name,
                createdAt: Date.now(),
                userColor: randomUser.color,
              };
              setFlags((prev) =>
                [...prev, newFlag].sort((a, b) => a.timestamp - b.timestamp),
              );
              // Select the new flag
              setSelectedFlagId(newFlag.id);
            }}
            onFlagEdit={(flag) => console.log("Edit flag:", flag.id)}
            onFlagUpdate={(flagId, updates) => {
              setFlags((prev) =>
                prev.map((f) =>
                  f.id === flagId
                    ? {
                        ...f,
                        label: updates.label ?? f.label,
                        note: updates.note ?? f.note,
                        color: updates.color ?? f.color,
                        visible:
                          updates.visible !== undefined
                            ? updates.visible
                            : f.visible,
                        locked:
                          updates.locked !== undefined
                            ? updates.locked
                            : f.locked,
                      }
                    : f,
                ),
              );
            }}
            onFlagDelete={(flagId) => {
              setFlags((prev) => prev.filter((f) => f.id !== flagId));
              // Clear selection if deleted flag was selected
              if (selectedFlagId === flagId) {
                setSelectedFlagId(null);
              }
            }}
            disabled={!loadedAudio}
            flagsVisibleOnWaveform={flagsVisibleOnWaveform}
            onWaveformVisibilityToggle={() =>
              setFlagsVisibleOnWaveform((prev) => !prev)
            }
          />
        </Box>
      </Box>
    </Box>
  );

  // Calculate visible time range for unified playhead
  const visibleDuration = (loadedAudio?.duration || 0) / overviewZoom;
  const visibleStartTime = overviewScrollOffset * (loadedAudio?.duration || 0);

  // Main content
  const mainContent = (
    <MainContainer>
      {/* Overview Bar - iZotope RX-style navigation */}
      <OverviewBar
        isLoaded={!!loadedAudio}
        duration={loadedAudio?.duration || 0}
        currentTime={timestamp / 1000} // Convert from ms to seconds
        zoom={overviewZoom}
        scrollOffset={overviewScrollOffset}
        waveformData={waveformData}
        onSeek={handleOverviewSeek}
        onViewportDrag={handleOverviewViewportDrag}
        onScrub={handleOverviewScrub}
        hasVideo={loadedAudio?.hasVideo}
      />

      {/* Center content area - TimeScale, Waveform */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Waveform Section - fills remaining space */}
        <Box
          ref={waveformContainerRef}
          sx={{
            flex: 1,
            position: "relative",
            backgroundColor: "#0a0a0a",
            minHeight: 100,
            cursor: zoomToolActive
              ? "crosshair"
              : interactionType === "scrubPlayhead"
                ? "ew-resize"
                : interactionType === "moveSelection"
                  ? "grabbing"
                  : interactionType === "adjustHandleStart" ||
                      interactionType === "adjustHandleEnd"
                    ? "ew-resize"
                    : interactionType === "createSelection"
                      ? "crosshair"
                      : "crosshair",
          }}
          onMouseDown={(e) => {
            // Zoom marquee takes priority when active
            if (zoomToolActive) {
              const rect = e.currentTarget.getBoundingClientRect();
              handleMarqueeMouseDown(e, rect);
            } else {
              // Waveform interactions when zoom tool is not active
              handleWaveformMouseDown(e);
            }
          }}
          onMouseMove={(e) => {
            if (zoomToolActive) {
              const rect = e.currentTarget.getBoundingClientRect();
              handleMarqueeMouseMove(e, rect);
            } else if (interactionType !== "none") {
              handleWaveformMouseMove(e);
            }
          }}
          onMouseUp={(e) => {
            handleMarqueeMouseUp();
            handleWaveformMouseUp(e);
          }}
          onMouseLeave={() => {
            handleMarqueeMouseUp();
            handleWaveformMouseLeave();
          }}
        >
          <WaveformCanvas
            isLoaded={!!loadedAudio}
            duration={loadedAudio?.duration || 0}
            zoom={overviewZoom}
            scrollOffset={overviewScrollOffset}
            waveformData={waveformData}
            waveformHeight={waveformHeight}
            flags={flagsVisibleOnWaveform ? filteredFlagsForDisplay : []}
            onFlagClick={handleWaveformFlagClick}
            onFlagDrag={handleWaveformFlagDrag}
            onSeek={handleOverviewSeek}
            onScrub={audioScrub}
            onZoomChange={handleZoomChange}
            onScrollChange={handleScrollChange}
            hasVideo={loadedAudio?.hasVideo}
          />

          {/* Marquee selection overlay */}
          {zoomToolActive &&
            marqueeStart !== null &&
            marqueeEnd !== null &&
            loadedAudio && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: (() => {
                    const visibleDuration = loadedAudio.duration / overviewZoom;
                    const visibleStart =
                      overviewScrollOffset * loadedAudio.duration;
                    const startTime = Math.min(marqueeStart, marqueeEnd);
                    return `${((startTime - visibleStart) / visibleDuration) * 100}%`;
                  })(),
                  width: (() => {
                    const visibleDuration = loadedAudio.duration / overviewZoom;
                    return `${(Math.abs(marqueeEnd - marqueeStart) / visibleDuration) * 100}%`;
                  })(),
                  backgroundColor: "rgba(25, 171, 181, 0.2)",
                  border: "1px solid #19abb5",
                  pointerEvents: "none",
                  zIndex: 5,
                }}
              />
            )}

          {/* Zoom tool active indicator */}
          {zoomToolActive && (
            <Box
              sx={{
                position: "absolute",
                top: 8,
                left: 8,
                backgroundColor: "rgba(25, 171, 181, 0.9)",
                color: "#fff",
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 1,
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              Click and drag to zoom
            </Box>
          )}

          {/* Time selection overlay */}
          {selectionStart !== null &&
            selectionEnd !== null &&
            loadedAudio &&
            waveformContainerRef.current &&
            (() => {
              const containerWidth = waveformContainerRef.current.clientWidth;
              const startTime = Math.min(selectionStart, selectionEnd);
              const endTime = Math.max(selectionStart, selectionEnd);
              const leftPx = timeToPixel(startTime, containerWidth);
              const rightPx = timeToPixel(endTime, containerWidth);
              const widthPx = rightPx - leftPx;
              const selectionDuration = endTime - startTime;

              // Only render if selection is visible in the current viewport
              if (rightPx < 0 || leftPx > containerWidth) return null;

              return (
                <Box
                  sx={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: `${Math.max(0, leftPx)}px`,
                    width: `${Math.min(widthPx, containerWidth - Math.max(0, leftPx))}px`,
                    backgroundColor: "rgba(25, 171, 181, 0.2)",
                    borderLeft: leftPx >= 0 ? "2px solid #19abb5" : "none",
                    borderRight:
                      rightPx <= containerWidth ? "2px solid #19abb5" : "none",
                    pointerEvents: "auto",
                    cursor:
                      interactionType === "moveSelection" ? "grabbing" : "grab",
                    zIndex: 4,
                  }}
                  onMouseDown={(e) => {
                    // Don't handle if clicking on handles
                    const rect = e.currentTarget.getBoundingClientRect();
                    const localX = e.clientX - rect.left;
                    const handleWidth = 8;

                    // If clicking near edges (handles), let the handle handlers take over
                    if (
                      localX < handleWidth ||
                      localX > rect.width - handleWidth
                    ) {
                      return;
                    }

                    // Start moving the selection
                    e.stopPropagation();
                    const time = pixelToTime(
                      e.clientX -
                        waveformContainerRef.current!.getBoundingClientRect()
                          .left,
                      containerWidth,
                    );
                    setInteractionType("moveSelection");
                    setSelectionDragOffset(time - startTime);
                    setHasDragged(true);
                    setMouseDownPos({ x: e.clientX, time });
                  }}
                >
                  {/* Start handle */}
                  {leftPx >= 0 && (
                    <Box
                      sx={{
                        position: "absolute",
                        left: -4,
                        top: 0,
                        bottom: 0,
                        width: 8,
                        cursor: "ew-resize",
                        pointerEvents: "auto",
                        backgroundColor: "transparent",
                        "&:hover": {
                          backgroundColor: "rgba(25, 171, 181, 0.3)",
                        },
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setInteractionType("adjustHandleStart");
                        setHasDragged(true); // Handle dragging starts immediately
                      }}
                    />
                  )}
                  {/* End handle */}
                  {rightPx <= containerWidth && (
                    <Box
                      sx={{
                        position: "absolute",
                        right: -4,
                        top: 0,
                        bottom: 0,
                        width: 8,
                        cursor: "ew-resize",
                        pointerEvents: "auto",
                        backgroundColor: "transparent",
                        "&:hover": {
                          backgroundColor: "rgba(25, 171, 181, 0.3)",
                        },
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setInteractionType("adjustHandleEnd");
                        setHasDragged(true); // Handle dragging starts immediately
                      }}
                    />
                  )}
                  {/* Selection duration label */}
                  {widthPx > 50 && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 4,
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        color: "#19abb5",
                        fontSize: 10,
                        fontFamily: '"JetBrains Mono", monospace',
                        padding: "2px 6px",
                        borderRadius: 1,
                        pointerEvents: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {selectionDuration >= 1
                        ? `${selectionDuration.toFixed(2)}s`
                        : `${(selectionDuration * 1000).toFixed(0)}ms`}
                    </Box>
                  )}
                  {/* Clear selection X button - upper right corner */}
                  <Tooltip title="Clear selection" placement="top">
                    <Box
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSelection();
                      }}
                      sx={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        backgroundColor: "rgba(42, 42, 42, 0.9)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        pointerEvents: "auto",
                        transition: "all 0.15s ease",
                        "&:hover": {
                          backgroundColor: "rgba(60, 60, 60, 0.95)",
                          "& svg": {
                            color: "#fff",
                          },
                        },
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#ccc"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ transition: "color 0.15s ease" }}
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </Box>
                  </Tooltip>
                </Box>
              );
            })()}
        </Box>

        {/* Time Scale Bar */}
        <Box
          sx={{
            height: 24,
            backgroundColor: "#111",
            borderTop: "1px solid #252525",
            borderBottom: "1px solid #252525",
            position: "relative",
          }}
        >
          <TimeScaleBar
            duration={loadedAudio?.duration || 0}
            zoom={overviewZoom}
            scrollOffset={overviewScrollOffset}
          />
        </Box>

        {/* Waveform Controls - Zoom and Height */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 1.5,
            py: 0.75,
            backgroundColor: "#111",
            borderBottom: "1px solid #252525",
          }}
        >
          {/* Zoom controls - 2/3 width */}
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 2 }}
          >
            <Tooltip title="Zoom to selection">
              <IconButton
                size="small"
                onClick={() => setZoomToolActive(!zoomToolActive)}
                disabled={!loadedAudio}
                sx={{
                  color: zoomToolActive ? "#19abb5" : "#666",
                  padding: "2px",
                  "&:hover": { color: "#19abb5" },
                  "&.Mui-disabled": { color: "#333" },
                }}
              >
                <ZoomInIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={handleZoomOut}
              disabled={!loadedAudio}
              sx={{
                color: "#666",
                padding: "2px",
                "&:hover": { color: "#19abb5" },
                "&.Mui-disabled": { color: "#333" },
              }}
            >
              <RemoveIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <Slider
              value={overviewZoom}
              min={1}
              max={10}
              step={0.1}
              onChange={(_, value) => handleZoomSliderChange(value as number)}
              disabled={!loadedAudio}
              sx={{
                flex: 1,
                minWidth: 60,
                color: "#19abb5",
                "& .MuiSlider-thumb": { width: 18, height: 18 },
                "& .MuiSlider-track": { height: 2 },
                "& .MuiSlider-rail": { height: 2, backgroundColor: "#333" },
              }}
            />
            <IconButton
              size="small"
              onClick={handleZoomIn}
              disabled={!loadedAudio}
              sx={{
                color: "#666",
                padding: "2px",
                "&:hover": { color: "#19abb5" },
                "&.Mui-disabled": { color: "#333" },
              }}
            >
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <Typography
              sx={{
                color: "#666",
                fontSize: 10,
                minWidth: 28,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {overviewZoom.toFixed(1)}x
            </Typography>
          </Box>

          {/* Height control - 1/3 width */}
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 0.5, flex: 1 }}
          >
            <Typography sx={{ fontSize: 10, color: "#666" }}>Height</Typography>
            <Slider
              value={waveformHeight}
              min={0.5}
              max={2}
              step={0.1}
              onChange={(_, value) => setWaveformHeight(value as number)}
              disabled={!loadedAudio}
              sx={{
                flex: 1,
                minWidth: 50,
                color: "#19abb5",
                "& .MuiSlider-thumb": { width: 18, height: 18 },
                "& .MuiSlider-track": { height: 2 },
                "& .MuiSlider-rail": { height: 2, backgroundColor: "#333" },
              }}
            />
            <Typography
              sx={{
                color: "#666",
                fontSize: 10,
                minWidth: 26,
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {waveformHeight.toFixed(1)}x
            </Typography>
          </Box>
        </Box>

        {/* Loading indicator overlay */}
        {isLoadingAudio && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              zIndex: 10,
            }}
          >
            <CircularProgress size={40} sx={{ color: "#19abb5" }} />
            <Typography sx={{ color: "#888", mt: 1, fontSize: 12 }}>
              Loading audio...
            </Typography>
          </Box>
        )}
      </Box>

      {/* EQ Section */}
      <EQSection>
        <Box sx={{ flex: 1, p: 1.5 }}>
          <IntegratedEQ
            values={eqValues}
            onChange={handleEQChange}
            onResetAll={resetAllEQ}
            disabled={!loadedAudio}
          />
        </Box>
      </EQSection>

      {/* Shared Transport Controls */}
      <TransportControls />
    </MainContainer>
  );

  return (
    <>
      {/* Hidden file input for imports */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptString("audio")}
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      <WorkspaceLayout
        filesPanel={
          <Box
            sx={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {/* Import/Export buttons header - side by side */}
            <Box
              sx={{
                display: "flex",
                padding: "6px",
                gap: "6px",
                borderBottom: "1px solid #252525",
                backgroundColor: "#1a1a1a",
              }}
            >
              <ImportButton
                startIcon={<FileUploadIcon sx={{ fontSize: 12 }} />}
                onClick={handleImportClick}
              >
                Import
              </ImportButton>
              <ExportButton
                startIcon={<FileDownloadIcon sx={{ fontSize: 12 }} />}
                onClick={handleExportClick}
                disabled={!loadedAudio}
              >
                Export
              </ExportButton>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <FileLibrary
                items={allMediaFiles}
                selectedId={selectedFile?.id}
                onSelect={(item) => setSelectedFile(item as MediaFileItem)}
                onDoubleClick={(item) =>
                  handleDoubleClick(item as MediaFileItem)
                }
              />
            </Box>
          </Box>
        }
        metadataPanel={
          <MetadataPanel
            data={
              selectedFile
                ? {
                    fileName: selectedFile.fileName,
                    capturedAt: selectedFile.capturedAt,
                    duration: selectedFile.duration,
                    user: selectedFile.user,
                    device: selectedFile.deviceInfo,
                    format: selectedFile.format,
                    gps: selectedFile.gps || undefined,
                    flagCount: selectedFile.flagCount,
                  }
                : null
            }
            type={selectedFile?.type === "video" ? "video" : "audio"}
          />
        }
        inspectorPanel={inspectorContent}
        mainContent={mainContent}
        filesTitle="Media Files"
        inspectorTitle=""
        showTransport={false}
      />

      {/* Toast notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleCloseToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseToast}
          severity={toast.severity}
          sx={{
            width: "100%",
            backgroundColor:
              toast.severity === "success"
                ? "#1e3d1e"
                : toast.severity === "error"
                  ? "#3d1e1e"
                  : "#1e2d3d",
            color: "#e1e1e1",
            border: `1px solid ${
              toast.severity === "success"
                ? "#5a9a6b"
                : toast.severity === "error"
                  ? "#c45c5c"
                  : "#19abb5"
            }`,
          }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Expand Video Modal */}
      <ExpandVideoModal
        open={expandVideoModalOpen}
        onClose={() => setExpandVideoModalOpen(false)}
        fileName={loadedAudio?.fileName || "Unknown File"}
        duration={loadedAudio?.duration || 0}
        flags={flags}
        videoUrl={loadedVideoUrl}
        isParentScrubbing={isVideoScrubbing}
        onFlagClick={(flag) => {
          console.log("Jump to:", flag.timestamp);
          setTimestamp(flag.timestamp);
        }}
        onFlagAdd={() => {
          // Randomly assign one of the test users to simulate multi-user collaboration
          const randomUser = getRandomTestUser();
          const newFlag: Flag = {
            id: `flag-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: timestamp,
            label: "", // Empty label, user can edit later
            note: "",
            createdBy: randomUser.name,
            createdAt: Date.now(),
            userColor: randomUser.color,
          };
          setFlags((prev) =>
            [...prev, newFlag].sort((a, b) => a.timestamp - b.timestamp),
          );
        }}
      />
    </>
  );
};

export default AudioTool;
