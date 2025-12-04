/**
 * SpectrogramView Component
 * Displays audio spectrogram with spectral selection capabilities
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { styled } from '@mui/material/styles';
import { spectrogramService, type SpectrogramData } from '../../services/audio/SpectrogramService';
import type { SpectrogramSettings, SpectralSelection, LoopRegion, AudioFinding } from '../../types/audio';
import { DEFAULT_SPECTROGRAM_SETTINGS } from '../../types/audio';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const SpectrogramContainer = styled(Box)({
  width: '100%',
  height: '100%',
  position: 'relative',
  backgroundColor: '#0a0a0a',
  borderRadius: 4,
  overflow: 'hidden',
  cursor: 'crosshair',
});

const CanvasContainer = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 40,
  right: 0,
  bottom: 24,
});

const FrequencyAxis = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  width: 40,
  bottom: 24,
  backgroundColor: '#141414',
  borderRight: '1px solid #2b2b2b',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '4px 2px',
});

const TimeAxis = styled(Box)({
  position: 'absolute',
  bottom: 0,
  left: 40,
  right: 0,
  height: 24,
  backgroundColor: '#141414',
  borderTop: '1px solid #2b2b2b',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 8px',
});

const AxisLabel = styled(Typography)({
  fontSize: 10,
  color: '#888888',
  fontFamily: 'Manrope, monospace',
  whiteSpace: 'nowrap',
});

const PlayheadLine = styled(Box)({
  position: 'absolute',
  top: 0,
  bottom: 24,
  width: 2,
  backgroundColor: '#ffffff',
  pointerEvents: 'none',
  zIndex: 10,
  '&::after': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: -4,
    width: 10,
    height: 10,
    backgroundColor: '#ffffff',
    clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
  },
});

const SelectionOverlay = styled(Box)<{ active?: boolean }>(({ active }) => ({
  position: 'absolute',
  border: `2px solid ${active ? '#19abb5' : '#ffffff'}`,
  backgroundColor: active ? 'rgba(25, 171, 181, 0.2)' : 'rgba(255, 255, 255, 0.1)',
  pointerEvents: 'none',
  zIndex: 5,
}));

const FindingMarker = styled(Box)<{ visible?: boolean }>(({ visible }) => ({
  position: 'absolute',
  border: '2px solid #ff9800',
  backgroundColor: 'rgba(255, 152, 0, 0.15)',
  pointerEvents: 'auto',
  cursor: 'pointer',
  zIndex: 4,
  opacity: visible ? 1 : 0.3,
  transition: 'opacity 0.2s',
  '&:hover': {
    backgroundColor: 'rgba(255, 152, 0, 0.3)',
  },
}));

const LoopRegionOverlay = styled(Box)<{ active?: boolean }>(({ active }) => ({
  position: 'absolute',
  backgroundColor: active ? 'rgba(255, 193, 7, 0.25)' : 'rgba(255, 193, 7, 0.1)',
  borderLeft: '2px solid #ffc107',
  borderRight: '2px solid #ffc107',
  pointerEvents: 'none',
  zIndex: 3,
}));

const InfoTooltip = styled(Box)({
  position: 'absolute',
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  color: '#e1e1e1',
  padding: '4px 8px',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'Manrope, monospace',
  pointerEvents: 'none',
  zIndex: 20,
  whiteSpace: 'nowrap',
});

const LoadingOverlay = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  zIndex: 30,
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface SpectrogramViewProps {
  /** Audio buffer to visualize */
  audioBuffer: AudioBuffer | null;
  /** Spectrogram settings */
  settings?: SpectrogramSettings;
  /** Current playback time */
  currentTime: number;
  /** Total duration */
  duration: number;
  /** Zoom level (pixels per second) */
  zoom?: number;
  /** Scroll position (seconds) */
  scrollPosition?: number;
  /** Current selection being drawn */
  currentSelection: SpectralSelection | null;
  /** Saved selections */
  selections: SpectralSelection[];
  /** Loop regions */
  loopRegions: LoopRegion[];
  /** Active loop ID */
  activeLoopId: string | null;
  /** Audio findings */
  findings: AudioFinding[];
  /** Whether selection mode is enabled */
  selectionEnabled?: boolean;
  /** Callback when selection starts */
  onSelectionStart?: (startTime: number, lowFreq: number) => void;
  /** Callback when selection updates */
  onSelectionUpdate?: (endTime: number, highFreq: number) => void;
  /** Callback when selection ends */
  onSelectionEnd?: () => void;
  /** Callback when selection is cancelled */
  onSelectionCancel?: () => void;
  /** Callback when seeking */
  onSeek?: (time: number) => void;
  /** Callback when a finding is clicked */
  onFindingClick?: (findingId: string) => void;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const SpectrogramView: React.FC<SpectrogramViewProps> = ({
  audioBuffer,
  settings = DEFAULT_SPECTROGRAM_SETTINGS,
  currentTime,
  duration: _duration,
  zoom = 100,
  scrollPosition = 0,
  currentSelection,
  selections,
  loopRegions,
  activeLoopId,
  findings,
  selectionEnabled = true,
  onSelectionStart,
  onSelectionUpdate,
  onSelectionEnd,
  onSelectionCancel,
  onSeek,
  onFindingClick,
  onZoomChange,
}) => {
  // _duration available for future time scale calculations
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spectrogramData, setSpectrogramData] = useState<SpectrogramData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number; time: number; freq: number } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  // Calculate visible time range
  const visibleDuration = useMemo(() => {
    return canvasSize.width / zoom;
  }, [canvasSize.width, zoom]);

  const visibleStartTime = scrollPosition;
  const visibleEndTime = scrollPosition + visibleDuration;

  // Generate spectrogram data when audio buffer changes
  useEffect(() => {
    if (!audioBuffer) {
      setSpectrogramData(null);
      return;
    }

    const generateSpectrogram = async () => {
      setIsLoading(true);
      try {
        const data = await spectrogramService.getOrGenerateSpectrogram(
          audioBuffer,
          settings,
          `${audioBuffer.length}-${audioBuffer.sampleRate}`
        );
        setSpectrogramData(data);
      } catch (error) {
        console.error('[SpectrogramView] Failed to generate spectrogram:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateSpectrogram();
  }, [audioBuffer, settings.fftSize, settings.windowFunction, settings.overlap]);

  // Render spectrogram when data or settings change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spectrogramData) return;

    spectrogramService.renderSpectrogram({
      canvas,
      data: spectrogramData,
      settings,
      startTime: visibleStartTime,
      endTime: visibleEndTime,
      width: canvasSize.width,
      height: canvasSize.height,
    });
  }, [spectrogramData, settings, canvasSize, visibleStartTime, visibleEndTime]);

  // Handle canvas resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      // Account for axes
      setCanvasSize({
        width: Math.max(0, rect.width - 40),
        height: Math.max(0, rect.height - 24),
      });
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Convert pixel position to time/frequency
  const pixelToTimeFreq = useCallback(
    (x: number, y: number) => {
      const time = visibleStartTime + (x / canvasSize.width) * visibleDuration;
      const freq = spectrogramService.getFrequencyAtY(y, canvasSize.height, settings);
      return { time, freq };
    },
    [canvasSize, settings, visibleStartTime, visibleDuration]
  );

  // Convert time/frequency to pixel position
  const timeFreqToPixel = useCallback(
    (time: number, freq: number) => {
      const x = ((time - visibleStartTime) / visibleDuration) * canvasSize.width;
      const y = spectrogramService.getYForFrequency(freq, canvasSize.height, settings);
      return { x, y };
    },
    [canvasSize, settings, visibleStartTime, visibleDuration]
  );

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!selectionEnabled) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 40; // Account for frequency axis
      const y = e.clientY - rect.top;

      if (x < 0 || y > canvasSize.height) return;

      const { time, freq } = pixelToTimeFreq(x, y);

      setIsDrawing(true);
      setDrawStart({ x, y });
      onSelectionStart?.(time, freq);
    },
    [selectionEnabled, canvasSize, pixelToTimeFreq, onSelectionStart]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 40;
      const y = e.clientY - rect.top;

      if (x >= 0 && x <= canvasSize.width && y >= 0 && y <= canvasSize.height) {
        const { time, freq } = pixelToTimeFreq(x, y);
        setMousePos({ x, y, time, freq });
        setShowTooltip(true);

        if (isDrawing) {
          onSelectionUpdate?.(time, freq);
        }
      } else {
        setShowTooltip(false);
      }
    },
    [canvasSize, pixelToTimeFreq, isDrawing, onSelectionUpdate]
  );

  const handleMouseUp = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false);
      setDrawStart(null);
      onSelectionEnd?.();
    }
  }, [isDrawing, onSelectionEnd]);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
    if (isDrawing) {
      onSelectionCancel?.();
      setIsDrawing(false);
      setDrawStart(null);
    }
  }, [isDrawing, onSelectionCancel]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDrawing) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - 40;

      if (x >= 0 && x <= canvasSize.width) {
        const { time } = pixelToTimeFreq(x, 0);
        onSeek?.(time);
      }
    },
    [canvasSize, pixelToTimeFreq, onSeek, isDrawing]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(10, Math.min(1000, zoom * delta));
        onZoomChange?.(newZoom);
      }
    },
    [zoom, onZoomChange]
  );

  // Generate frequency axis labels
  const frequencyLabels = useMemo(() => {
    const { minFrequency, maxFrequency, frequencyScale } = settings;
    const labels: { freq: number; label: string }[] = [];

    if (frequencyScale === 'logarithmic' || frequencyScale === 'mel') {
      const freqs = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      freqs.forEach((f) => {
        if (f >= minFrequency && f <= maxFrequency) {
          const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
          labels.push({ freq: f, label });
        }
      });
    } else {
      const step = (maxFrequency - minFrequency) / 6;
      for (let f = minFrequency; f <= maxFrequency; f += step) {
        const freq = Math.round(f);
        const label = freq >= 1000 ? `${(freq / 1000).toFixed(1)}k` : `${freq}`;
        labels.push({ freq, label });
      }
    }

    return labels;
  }, [settings]);

  // Generate time axis labels
  const timeLabels = useMemo(() => {
    const labels: { time: number; label: string }[] = [];
    const numLabels = Math.min(10, Math.floor(visibleDuration) + 1);
    const step = visibleDuration / Math.max(numLabels - 1, 1);

    for (let i = 0; i < numLabels; i++) {
      const time = visibleStartTime + i * step;
      const label = formatTime(time);
      labels.push({ time, label });
    }

    return labels;
  }, [visibleStartTime, visibleDuration]);

  // Calculate playhead position
  const playheadX = useMemo(() => {
    if (currentTime < visibleStartTime || currentTime > visibleEndTime) return null;
    return ((currentTime - visibleStartTime) / visibleDuration) * canvasSize.width + 40;
  }, [currentTime, visibleStartTime, visibleDuration, canvasSize.width, visibleEndTime]);

  // Render selection box
  const renderSelectionBox = useCallback(
    (selection: SpectralSelection | null, isActive = false) => {
      if (!selection) return null;

      const start = timeFreqToPixel(selection.startTime, selection.highFrequency);
      const end = timeFreqToPixel(selection.endTime, selection.lowFrequency);

      const left = Math.min(start.x, end.x) + 40;
      const top = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);

      if (left + width < 40 || left > canvasSize.width + 40) return null;

      return (
        <SelectionOverlay
          key={selection.id}
          active={isActive}
          sx={{
            left: Math.max(40, left),
            top,
            width: Math.min(width, canvasSize.width + 40 - left),
            height,
          }}
        />
      );
    },
    [timeFreqToPixel, canvasSize]
  );

  return (
    <SpectrogramContainer
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onWheel={handleWheel}
    >
      {/* Frequency Axis */}
      <FrequencyAxis>
        {frequencyLabels.map(({ freq, label }, idx) => {
          const y = spectrogramService.getYForFrequency(freq, canvasSize.height, settings);
          return (
            <AxisLabel
              key={idx}
              sx={{
                position: 'absolute',
                right: 4,
                top: y - 6,
                textAlign: 'right',
              }}
            >
              {label}
            </AxisLabel>
          );
        })}
      </FrequencyAxis>

      {/* Canvas */}
      <CanvasContainer>
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          style={{ width: '100%', height: '100%' }}
        />
      </CanvasContainer>

      {/* Time Axis */}
      <TimeAxis>
        {timeLabels.map(({ label }, idx) => (
          <AxisLabel key={idx}>{label}</AxisLabel>
        ))}
      </TimeAxis>

      {/* Loop Regions */}
      {loopRegions.map((region) => {
        const startX = ((region.startTime - visibleStartTime) / visibleDuration) * canvasSize.width + 40;
        const endX = ((region.endTime - visibleStartTime) / visibleDuration) * canvasSize.width + 40;
        const width = endX - startX;

        if (endX < 40 || startX > canvasSize.width + 40) return null;

        return (
          <LoopRegionOverlay
            key={region.id}
            active={region.id === activeLoopId}
            sx={{
              left: Math.max(40, startX),
              top: 0,
              width: Math.min(width, canvasSize.width + 40 - startX),
              height: canvasSize.height,
            }}
          />
        );
      })}

      {/* Saved Selections */}
      {selections.filter((s) => s.visible).map((selection) => renderSelectionBox(selection, false))}

      {/* Current Selection */}
      {currentSelection && renderSelectionBox(currentSelection, true)}

      {/* Findings */}
      {findings
        .filter((f) => f.visible)
        .map((finding) => {
          const start = timeFreqToPixel(finding.selection.startTime, finding.selection.highFrequency);
          const end = timeFreqToPixel(finding.selection.endTime, finding.selection.lowFrequency);

          const left = Math.min(start.x, end.x) + 40;
          const top = Math.min(start.y, end.y);
          const width = Math.abs(end.x - start.x);
          const height = Math.abs(end.y - start.y);

          if (left + width < 40 || left > canvasSize.width + 40) return null;

          return (
            <FindingMarker
              key={finding.id}
              visible={finding.visible}
              onClick={(e) => {
                e.stopPropagation();
                onFindingClick?.(finding.id);
              }}
              sx={{
                left: Math.max(40, left),
                top,
                width: Math.min(width, canvasSize.width + 40 - left),
                height,
              }}
              title={finding.title}
            />
          );
        })}

      {/* Playhead */}
      {playheadX !== null && (
        <PlayheadLine sx={{ left: playheadX }} />
      )}

      {/* Tooltip */}
      {showTooltip && mousePos && (
        <InfoTooltip
          sx={{
            left: mousePos.x + 50,
            top: mousePos.y - 30,
          }}
        >
          {formatTime(mousePos.time)} | {formatFrequency(mousePos.freq)}
        </InfoTooltip>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <LoadingOverlay>
          <CircularProgress size={40} sx={{ color: '#19abb5', mb: 2 }} />
          <Typography variant="body2" sx={{ color: '#e1e1e1' }}>
            Generating spectrogram...
          </Typography>
        </LoadingOverlay>
      )}
    </SpectrogramContainer>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0').slice(0, 2)}`;
  }
  return `${secs}.${ms.toString().padStart(3, '0').slice(0, 2)}s`;
}

function formatFrequency(hz: number): string {
  if (hz >= 1000) {
    return `${(hz / 1000).toFixed(2)} kHz`;
  }
  return `${Math.round(hz)} Hz`;
}

export default SpectrogramView;
