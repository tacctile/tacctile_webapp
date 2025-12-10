import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, IconButton, Typography, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FitScreenIcon from '@mui/icons-material/FitScreen';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const WaveformContainer = styled(Box)({
  flex: 1,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  backgroundColor: '#1a1a1a',
  borderRadius: 2,
  overflow: 'hidden',
});

const CanvasWrapper = styled(Box)({
  flex: 1,
  position: 'relative',
  cursor: 'crosshair',
  minHeight: 0,
});

const ZoomControls = styled(Box)({
  position: 'absolute',
  top: 4,
  right: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 4,
  padding: '2px 4px',
  zIndex: 10,
});

const ZoomButton = styled(IconButton)({
  padding: 2,
  color: '#888',
  '&:hover': {
    color: '#19abb5',
    backgroundColor: 'rgba(25, 171, 181, 0.1)',
  },
  '& svg': {
    fontSize: 14,
  },
});

const ZoomLevel = styled(Typography)({
  fontSize: 9,
  color: '#666',
  fontFamily: '"JetBrains Mono", monospace',
  minWidth: 32,
  textAlign: 'center',
});

const ScrollbarTrack = styled(Box)({
  height: 6,
  backgroundColor: '#111',
  borderTop: '1px solid #252525',
  position: 'relative',
});

const ScrollbarThumb = styled(Box)<{ $left: number; $width: number }>(({ $left, $width }) => ({
  position: 'absolute',
  top: 1,
  height: 4,
  left: `${$left}%`,
  width: `${$width}%`,
  backgroundColor: '#19abb5',
  borderRadius: 2,
  opacity: 0.6,
  cursor: 'grab',
  '&:hover': {
    opacity: 0.8,
  },
  '&:active': {
    cursor: 'grabbing',
  },
}));

// ============================================================================
// TYPES
// ============================================================================

interface ProfessionalWaveformProps {
  /** Whether audio is loaded */
  isLoaded: boolean;
  /** Total duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  currentTime: number;
  /** Whether currently playing */
  isPlaying: boolean;
  /** Audio buffer data (optional - generates mock if not provided) */
  audioBuffer?: AudioBuffer | null;
  /** Callback when user clicks to seek */
  onSeek?: (timeInSeconds: number) => void;
  /** Callback when user selects a region */
  onSelection?: (startTime: number, endTime: number) => void;
  /** Selection start time */
  selectionStart?: number | null;
  /** Selection end time */
  selectionEnd?: number | null;
  /** Zoom level (1 = fit to view) - controlled externally */
  zoom?: number;
  /** Scroll offset (0-1) - controlled externally */
  scrollOffset?: number;
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when scroll offset changes */
  onScrollChange?: (offset: number) => void;
}

// ============================================================================
// WAVEFORM DATA GENERATION
// ============================================================================

/**
 * Generates realistic-looking waveform data when no real audio is available
 */
const generateMockWaveformData = (numSamples: number): Float32Array => {
  const data = new Float32Array(numSamples);

  // Create realistic audio-like patterns with varying amplitude
  let phase = 0;
  let envelope = 0.3;
  let envelopeTarget = 0.5;

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;

    // Slowly vary the envelope (creates loud/quiet sections)
    if (Math.random() < 0.001) {
      envelopeTarget = 0.1 + Math.random() * 0.8;
    }
    envelope += (envelopeTarget - envelope) * 0.0001;

    // Mix multiple frequencies for realistic audio appearance
    const f1 = Math.sin(phase * 0.1) * 0.4;
    const f2 = Math.sin(phase * 0.37) * 0.3;
    const f3 = Math.sin(phase * 1.3) * 0.2;
    const f4 = Math.sin(phase * 3.7) * 0.1;

    // Add some noise
    const noise = (Math.random() - 0.5) * 0.3;

    // Combine and apply envelope
    let sample = (f1 + f2 + f3 + f4 + noise) * envelope;

    // Add occasional transients (like drum hits)
    if (Math.random() < 0.0005) {
      sample += (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.5);
    }

    // Add some quiet sections
    if (t > 0.15 && t < 0.18) sample *= 0.1;
    if (t > 0.45 && t < 0.47) sample *= 0.05;
    if (t > 0.72 && t < 0.74) sample *= 0.15;

    // Clamp to -1, 1
    data[i] = Math.max(-1, Math.min(1, sample));

    phase += 0.01 + Math.random() * 0.02;
  }

  return data;
};

/**
 * Extract waveform data from AudioBuffer
 */
const extractWaveformData = (buffer: AudioBuffer, targetLength: number): Float32Array => {
  const channelData = buffer.getChannelData(0); // Get first channel
  const step = Math.floor(channelData.length / targetLength);
  const data = new Float32Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const start = i * step;
    const end = Math.min(start + step, channelData.length);

    // Get min and max in this segment
    let min = 0;
    let max = 0;
    for (let j = start; j < end; j++) {
      if (channelData[j] < min) min = channelData[j];
      if (channelData[j] > max) max = channelData[j];
    }

    // Store the larger absolute value, preserving sign
    data[i] = Math.abs(max) > Math.abs(min) ? max : min;
  }

  return data;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProfessionalWaveform: React.FC<ProfessionalWaveformProps> = ({
  isLoaded,
  duration,
  currentTime,
  isPlaying,
  audioBuffer,
  onSeek,
  onSelection,
  selectionStart,
  selectionEnd,
  zoom: externalZoom,
  scrollOffset: externalScrollOffset,
  onZoomChange,
  onScrollChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);

  // Zoom and scroll state - use external if provided, otherwise internal
  const [internalZoom, setInternalZoom] = useState(1); // 1 = fit to view
  const [internalScrollOffset, setInternalScrollOffset] = useState(0); // 0-1, position in the file

  // Use controlled or uncontrolled mode
  const zoom = externalZoom ?? internalZoom;
  const scrollOffset = externalScrollOffset ?? internalScrollOffset;

  const setZoom = useCallback((newZoom: number | ((prev: number) => number)) => {
    const resolvedZoom = typeof newZoom === 'function' ? newZoom(zoom) : newZoom;
    if (onZoomChange) {
      onZoomChange(resolvedZoom);
    } else {
      setInternalZoom(resolvedZoom);
    }
  }, [zoom, onZoomChange]);

  const setScrollOffset = useCallback((newOffset: number | ((prev: number) => number)) => {
    const resolvedOffset = typeof newOffset === 'function' ? newOffset(scrollOffset) : newOffset;
    if (onScrollChange) {
      onScrollChange(resolvedOffset);
    } else {
      setInternalScrollOffset(resolvedOffset);
    }
  }, [scrollOffset, onScrollChange]);

  // Selection state for dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [localSelection, setLocalSelection] = useState<{ start: number; end: number } | null>(null);

  // Waveform data cache
  const waveformDataRef = useRef<Float32Array | null>(null);

  // Colors (playhead colors removed - unified playhead is rendered by parent)
  const COLORS = {
    background: '#1a1a1a',
    waveformFill: 'rgba(25, 171, 181, 0.4)',
    waveformStroke: '#19abb5',
    waveformGradientTop: 'rgba(25, 171, 181, 0.6)',
    waveformGradientBottom: 'rgba(25, 171, 181, 0.2)',
    centerline: 'rgba(255, 255, 255, 0.15)',
    selection: 'rgba(25, 171, 181, 0.3)',
    selectionBorder: 'rgba(25, 171, 181, 0.8)',
  };

  // Get or generate waveform data
  const getWaveformData = useCallback((width: number): Float32Array => {
    const targetLength = Math.max(width * zoom, 1000);

    if (audioBuffer) {
      return extractWaveformData(audioBuffer, targetLength);
    }

    // Use cached data if available and correct length
    if (waveformDataRef.current && waveformDataRef.current.length === targetLength) {
      return waveformDataRef.current;
    }

    // Generate mock data
    waveformDataRef.current = generateMockWaveformData(targetLength);
    return waveformDataRef.current;
  }, [audioBuffer, zoom]);

  // Calculate visible range based on zoom and scroll
  const getVisibleRange = useCallback(() => {
    const visibleWidth = 1 / zoom;
    const maxOffset = Math.max(0, 1 - visibleWidth);
    const clampedOffset = Math.min(scrollOffset, maxOffset);

    return {
      start: clampedOffset,
      end: clampedOffset + visibleWidth,
      visibleWidth,
    };
  }, [zoom, scrollOffset]);

  // Convert pixel X to time
  const pixelToTime = useCallback((pixelX: number, canvasWidth: number): number => {
    const { start, visibleWidth } = getVisibleRange();
    const normalizedX = pixelX / canvasWidth;
    const timeNormalized = start + normalizedX * visibleWidth;
    return timeNormalized * duration;
  }, [getVisibleRange, duration]);

  // Convert time to pixel X
  const timeToPixel = useCallback((time: number, canvasWidth: number): number => {
    const { start, visibleWidth } = getVisibleRange();
    const timeNormalized = time / duration;
    const relativePosition = (timeNormalized - start) / visibleWidth;
    return relativePosition * canvasWidth;
  }, [getVisibleRange, duration]);

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container (with device pixel ratio for sharpness)
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

    if (!isLoaded) {
      // Draw empty state
      ctx.fillStyle = '#333';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('No audio loaded', width / 2, centerY);
      return;
    }

    // Get waveform data
    const waveformData = getWaveformData(width);
    const { start, visibleWidth } = getVisibleRange();

    // Calculate which samples to draw
    const startSample = Math.floor(start * waveformData.length);
    const endSample = Math.ceil((start + visibleWidth) * waveformData.length);
    const samplesVisible = endSample - startSample;

    // Draw centerline
    ctx.strokeStyle = COLORS.centerline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Create gradient for fill
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, COLORS.waveformGradientTop);
    gradient.addColorStop(0.5, COLORS.waveformFill);
    gradient.addColorStop(1, COLORS.waveformGradientTop);

    // Draw filled waveform
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(0, centerY);

    // Draw top half (positive values)
    for (let i = 0; i < width; i++) {
      const sampleIndex = Math.floor(startSample + (i / width) * samplesVisible);
      const clampedIndex = Math.max(0, Math.min(sampleIndex, waveformData.length - 1));

      // Get min/max for this pixel column for better rendering
      const rangeStart = Math.floor(startSample + (i / width) * samplesVisible);
      const rangeEnd = Math.floor(startSample + ((i + 1) / width) * samplesVisible);

      let maxVal = 0;
      let minVal = 0;
      for (let j = rangeStart; j < rangeEnd && j < waveformData.length; j++) {
        if (j >= 0) {
          if (waveformData[j] > maxVal) maxVal = waveformData[j];
          if (waveformData[j] < minVal) minVal = waveformData[j];
        }
      }

      // Draw line from min to max (mirrored waveform)
      const yMax = centerY - maxVal * (centerY - 2);
      ctx.lineTo(i, yMax);
    }

    // Draw bottom half (back through negative values)
    for (let i = width - 1; i >= 0; i--) {
      const rangeStart = Math.floor(startSample + (i / width) * samplesVisible);
      const rangeEnd = Math.floor(startSample + ((i + 1) / width) * samplesVisible);

      let minVal = 0;
      for (let j = rangeStart; j < rangeEnd && j < waveformData.length; j++) {
        if (j >= 0 && waveformData[j] < minVal) minVal = waveformData[j];
      }

      const yMin = centerY - minVal * (centerY - 2);
      ctx.lineTo(i, yMin);
    }

    ctx.closePath();
    ctx.fill();

    // Draw waveform outline for crispness
    ctx.strokeStyle = COLORS.waveformStroke;
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
      const rangeStart = Math.floor(startSample + (i / width) * samplesVisible);
      const rangeEnd = Math.floor(startSample + ((i + 1) / width) * samplesVisible);

      let maxVal = 0;
      let minVal = 0;
      for (let j = rangeStart; j < rangeEnd && j < waveformData.length; j++) {
        if (j >= 0) {
          if (waveformData[j] > maxVal) maxVal = waveformData[j];
          if (waveformData[j] < minVal) minVal = waveformData[j];
        }
      }

      const yMax = centerY - maxVal * (centerY - 2);
      const yMin = centerY - minVal * (centerY - 2);

      if (i === 0) {
        ctx.moveTo(i, yMax);
      } else {
        ctx.lineTo(i, yMax);
      }
      ctx.lineTo(i, yMin);
    }
    ctx.stroke();

    // Draw selection if exists
    const activeSelection = localSelection || (selectionStart != null && selectionEnd != null
      ? { start: selectionStart, end: selectionEnd }
      : null);

    if (activeSelection) {
      const selStartX = timeToPixel(activeSelection.start, width);
      const selEndX = timeToPixel(activeSelection.end, width);
      const selLeft = Math.min(selStartX, selEndX);
      const selWidth = Math.abs(selEndX - selStartX);

      if (selWidth > 0) {
        ctx.fillStyle = COLORS.selection;
        ctx.fillRect(selLeft, 0, selWidth, height);

        ctx.strokeStyle = COLORS.selectionBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(selLeft, 0, selWidth, height);
      }
    }

    // Note: Playhead is now rendered by parent component as a unified PlayheadLine
    // spanning both SpectrogramSection and WaveformSection
  }, [isLoaded, getWaveformData, getVisibleRange, timeToPixel, localSelection, selectionStart, selectionEnd, COLORS]);

  // Animation loop for smooth playhead during playback
  useEffect(() => {
    if (isPlaying) {
      const animate = () => {
        drawWaveform();
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      drawWaveform();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, drawWaveform]);

  // Redraw on relevant state changes
  useEffect(() => {
    drawWaveform();
  }, [zoom, scrollOffset, isLoaded, currentTime, localSelection, selectionStart, selectionEnd, drawWaveform]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => drawWaveform();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawWaveform]);

  // Mouse handlers for click-to-seek and selection
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLoaded || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelToTime(x, rect.width);

    setIsDragging(true);
    setDragStart(time);
    setLocalSelection(null);
  }, [isLoaded, pixelToTime]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragStart === null || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelToTime(x, rect.width);

    // Only create selection if dragged more than a small threshold
    const threshold = 0.05; // seconds
    if (Math.abs(time - dragStart) > threshold) {
      setLocalSelection({
        start: Math.min(dragStart, time),
        end: Math.max(dragStart, time),
      });
    }
  }, [isDragging, dragStart, pixelToTime]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragStart === null || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelToTime(x, rect.width);

    if (localSelection) {
      // Finish selection
      onSelection?.(localSelection.start, localSelection.end);
    } else {
      // Single click - seek to position
      onSeek?.(Math.max(0, Math.min(time, duration)));
    }

    setIsDragging(false);
    setDragStart(null);
  }, [isDragging, dragStart, pixelToTime, localSelection, onSeek, onSelection, duration]);

  const handleMouseLeave = useCallback(() => {
    if (isDragging && !localSelection) {
      setIsDragging(false);
      setDragStart(null);
    }
  }, [isDragging, localSelection]);

  // Scroll wheel zoom (centered on cursor)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isLoaded || !canvasRef.current) return;
    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseRatio = mouseX / rect.width;

    // Calculate time at cursor before zoom
    const timeAtCursor = pixelToTime(mouseX, rect.width);

    // Zoom factor
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(100, zoom * zoomFactor));

    // Calculate new scroll offset to keep cursor at same time position
    const newVisibleWidth = 1 / newZoom;
    const timeNormalized = timeAtCursor / duration;
    const newScrollOffset = timeNormalized - mouseRatio * newVisibleWidth;

    setZoom(newZoom);
    setScrollOffset(Math.max(0, Math.min(1 - newVisibleWidth, newScrollOffset)));
  }, [isLoaded, pixelToTime, zoom, duration]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(100, prev * 1.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(1, zoom / 1.5);
    setZoom(newZoom);
    // Adjust scroll if needed
    const newVisibleWidth = 1 / newZoom;
    setScrollOffset(prev => Math.min(prev, Math.max(0, 1 - newVisibleWidth)));
  }, [zoom]);

  const handleZoomFit = useCallback(() => {
    setZoom(1);
    setScrollOffset(0);
  }, []);

  // Scrollbar drag handling
  const handleScrollbarDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clickX / rect.width;
    const visibleWidth = 1 / zoom;
    const newOffset = Math.max(0, Math.min(1 - visibleWidth, ratio - visibleWidth / 2));
    setScrollOffset(newOffset);
  }, [zoom]);

  const { visibleWidth } = getVisibleRange();
  const scrollbarWidth = Math.max(10, visibleWidth * 100);
  const scrollbarLeft = scrollOffset * 100;

  return (
    <WaveformContainer>
      {/* Zoom Controls */}
      {isLoaded && (
        <ZoomControls>
          <Tooltip title="Zoom out (-)">
            <ZoomButton onClick={handleZoomOut} size="small">
              <RemoveIcon />
            </ZoomButton>
          </Tooltip>
          <ZoomLevel>{Math.round(zoom * 100)}%</ZoomLevel>
          <Tooltip title="Zoom in (+)">
            <ZoomButton onClick={handleZoomIn} size="small">
              <AddIcon />
            </ZoomButton>
          </Tooltip>
          <Tooltip title="Fit to view">
            <ZoomButton onClick={handleZoomFit} size="small">
              <FitScreenIcon />
            </ZoomButton>
          </Tooltip>
        </ZoomControls>
      )}

      {/* Canvas */}
      <CanvasWrapper ref={containerRef}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        />
      </CanvasWrapper>

      {/* Scrollbar (only visible when zoomed) */}
      {isLoaded && zoom > 1 && (
        <ScrollbarTrack onClick={handleScrollbarDrag}>
          <ScrollbarThumb
            $left={scrollbarLeft}
            $width={scrollbarWidth}
          />
        </ScrollbarTrack>
      )}
    </WaveformContainer>
  );
};

export default ProfessionalWaveform;
