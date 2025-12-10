/**
 * UnifiedAudioCanvas Component
 * Displays spectral visualization with teal waveform overlay
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import GridOnIcon from '@mui/icons-material/GridOn';
import RemoveIcon from '@mui/icons-material/Remove';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

// ============================================================================
// STYLED COMPONENTS
// ============================================================================

const CanvasContainer = styled(Box)({
  width: '100%',
  height: '100%',
  position: 'relative',
  backgroundColor: '#0a0a0a',
  overflow: 'hidden',
});

// ============================================================================
// COMPONENT PROPS
// ============================================================================

interface UnifiedAudioCanvasProps {
  /** Whether audio is loaded */
  isLoaded: boolean;
  /** Total duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  currentTime: number;
  /** Zoom level (1 = full duration visible, higher = zoomed in) */
  zoom?: number;
  /** Scroll offset (0-1, portion of timeline scrolled) */
  scrollOffset?: number;
  /** Callback when zoom changes */
  onZoomChange?: (newZoom: number) => void;
  /** Callback when scroll offset changes */
  onScrollOffsetChange?: (newOffset: number) => void;
  /** Callback when user clicks to seek */
  onSeek?: (timeInSeconds: number) => void;
  /** Real waveform data from audio decoding */
  waveformData?: Float32Array | null;
  /** Real spectral data (FFT frames) from audio analysis */
  spectralData?: Float32Array[] | null;
  /** Whether spectral data is currently being generated in background */
  spectralLoading?: boolean;
  /** Whether spectral data just became ready (triggers pulse animation) */
  spectralReady?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

const UnifiedAudioCanvas: React.FC<UnifiedAudioCanvasProps> = ({
  isLoaded,
  duration,
  currentTime,
  zoom: zoomProp = 1,
  scrollOffset: scrollOffsetProp = 0,
  onZoomChange,
  onScrollOffsetChange,
  onSeek,
  waveformData,
  spectralData,
  spectralLoading = false,
  spectralReady = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);

  // Use internal state if no external control, otherwise use props
  const [internalZoom, setInternalZoom] = useState(1);
  const [internalScrollOffset, setInternalScrollOffset] = useState(0);

  // Determine if we're controlled or uncontrolled
  const isControlled = onZoomChange !== undefined || onScrollOffsetChange !== undefined;
  const zoom = isControlled ? zoomProp : internalZoom;
  const scrollOffset = isControlled ? scrollOffsetProp : internalScrollOffset;

  // Unified setters that work for both controlled and uncontrolled modes
  const setZoom = useCallback((newZoom: number) => {
    if (isControlled && onZoomChange) {
      onZoomChange(newZoom);
    } else {
      setInternalZoom(newZoom);
    }
  }, [isControlled, onZoomChange]);

  const setScrollOffset = useCallback((newOffset: number) => {
    if (isControlled && onScrollOffsetChange) {
      onScrollOffsetChange(newOffset);
    } else {
      setInternalScrollOffset(newOffset);
    }
  }, [isControlled, onScrollOffsetChange]);

  // Panning state
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);

  // Scrubbing state (for click+drag to seek)
  const [isDragging, setIsDragging] = useState(false);
  // Track if mouse is near playhead handle for cursor feedback
  const [isHoveringPlayhead, setIsHoveringPlayhead] = useState(false);

  // Layer visibility state
  const [showSpectral, setShowSpectral] = useState(true);
  const [showWaveform, setShowWaveform] = useState(true);

  // Zoom marquee tool state
  const [zoomToolActive, setZoomToolActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; time: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; time: number } | null>(null);

  // Draw function - renders spectral visualization and waveform overlay
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded) return;

    // Calculate visible time range based on zoom and scroll
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const endTime = startTime + visibleDuration;

    // ========================================================================
    // Draw Spectral Visualization (iZotope RX style - smooth aurora gradients)
    // Skip if loading or no data available
    // ========================================================================

    // Aurora borealis color function - deep purple → teal → green → pink peaks
    const getAuroraColor = (intensity: number): { r: number; g: number; b: number; a: number } => {
      const i = Math.max(0, Math.min(1, intensity));

      let r, g, b, a;

      if (i < 0.15) {
        // Silence/very low: deep purple/black
        const t = i / 0.15;
        r = Math.floor(15 + t * 30);
        g = Math.floor(8 + t * 19);
        b = Math.floor(35 + t * 43);
        a = 0.4 + t * 0.3;
      } else if (i < 0.3) {
        // Low: purple/violet
        const t = (i - 0.15) / 0.15;
        r = Math.floor(45 + t * 25);
        g = Math.floor(27 + t * 40);
        b = Math.floor(78 + t * 30);
        a = 0.7 + t * 0.1;
      } else if (i < 0.45) {
        // Low-mid: purple to teal
        const t = (i - 0.3) / 0.15;
        r = Math.floor(70 - t * 45);
        g = Math.floor(67 + t * 71);
        b = Math.floor(108 + t * 46);
        a = 0.8 + t * 0.1;
      } else if (i < 0.6) {
        // Mid: teal/cyan
        const t = (i - 0.45) / 0.15;
        r = Math.floor(25 + t * 10);
        g = Math.floor(138 + t * 30);
        b = Math.floor(154 - t * 10);
        a = 0.9;
      } else if (i < 0.75) {
        // Mid-high: teal to green
        const t = (i - 0.6) / 0.15;
        r = Math.floor(35 + t * 11);
        g = Math.floor(168 + t * 36);
        b = Math.floor(144 - t * 72);
        a = 0.92;
      } else if (i < 0.9) {
        // High: green
        const t = (i - 0.75) / 0.15;
        r = Math.floor(46 + t * 30);
        g = Math.floor(204 + t * 18);
        b = Math.floor(72 + t * 30);
        a = 0.95;
      } else {
        // Peak: green with pink/magenta hints (rare, only true peaks)
        const t = (i - 0.9) / 0.1;
        r = Math.floor(76 + t * 160);
        g = Math.floor(222 - t * 80);
        b = Math.floor(102 + t * 80);
        a = 1.0;
      }

      return { r, g, b, a };
    };

    if (showSpectral && isLoaded && !spectralLoading) {
      // Use real spectral data if available
      if (spectralData && spectralData.length > 0) {
        const numBins = spectralData[0].length;
        const spectralHeight = height - 20; // Reserve space for time scale

        // Calculate column width based on data density for smooth rendering
        const dataPointsVisible = Math.floor((visibleDuration / duration) * spectralData.length);
        const columnWidth = Math.max(1, width / dataPointsVisible);

        // Draw smooth columns using vertical gradients
        for (let x = 0; x < width; x += columnWidth) {
          const time = startTime + (x / width) * visibleDuration;
          const frameIndex = Math.floor((time / duration) * spectralData.length);

          if (frameIndex >= 0 && frameIndex < spectralData.length) {
            const frame = spectralData[frameIndex];

            // Create vertical gradient for this column (smooth aurora effect)
            const gradient = ctx.createLinearGradient(x, spectralHeight, x, 0);

            // Sample multiple points along the frequency spectrum for smooth gradient
            const gradientStops = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0];

            gradientStops.forEach(stop => {
              const binIndex = Math.floor(stop * (numBins - 1));
              const magnitude = frame[binIndex];
              // Use logarithmic scaling for better dynamic range (prevents everything from being yellow/peak)
              const intensity = Math.min(1, Math.log10(1 + magnitude * 50) / 2);
              const color = getAuroraColor(intensity);
              gradient.addColorStop(stop, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
            });

            ctx.fillStyle = gradient;
            ctx.fillRect(x, 0, columnWidth + 1, spectralHeight); // +1 to avoid gaps
          }
        }
      } else {
        // Fall back to mock spectral visualization with smooth gradients
        const spectralHeight = height - 20;
        const mockColumnWidth = 3; // Smooth columns for mock data

        for (let x = 0; x < width; x += mockColumnWidth) {
          // Time position for this column (accounting for zoom/scroll)
          const colTime = startTime + (x / width) * visibleDuration;
          const timeRatio = colTime / duration;

          // Create vertical gradient for this column
          const gradient = ctx.createLinearGradient(x, spectralHeight, x, 0);

          // Sample gradient stops with mock intensity values
          const gradientStops = [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1.0];

          gradientStops.forEach(stop => {
            const freqRatio = stop;
            const t = timeRatio * Math.PI * 20;
            const f = freqRatio * Math.PI * 4;

            // More energy in low-mid frequencies, less in highs
            const freqFalloff = 1 - freqRatio * 0.7;

            // Create some variation over time
            const timeVariation =
              Math.sin(t) * 0.3 +
              Math.sin(t * 2.5 + 1) * 0.2 +
              Math.sin(t * 0.5 + freqRatio * 10) * 0.25;

            // Frequency-dependent patterns (harmonics simulation)
            const freqPattern =
              Math.sin(f + t * 0.5) * 0.3 +
              Math.cos(f * 2 + t) * 0.2;

            // Combine for final intensity
            let intensity = (0.3 + timeVariation + freqPattern) * freqFalloff;
            intensity = Math.max(0, Math.min(1, intensity));

            const color = getAuroraColor(intensity);
            gradient.addColorStop(stop, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
          });

          ctx.fillStyle = gradient;
          ctx.fillRect(x, 0, mockColumnWidth + 1, spectralHeight);
        }
      }
    }

    // ========================================================================
    // Draw Waveform Overlay
    // ========================================================================

    if (showWaveform && isLoaded) {
      const centerY = height / 2;

      ctx.fillStyle = 'rgba(25, 171, 181, 0.6)'; // Teal with transparency
      ctx.beginPath();
      ctx.moveTo(0, centerY);

      if (waveformData && waveformData.length > 0) {
        // Use real waveform data
        // Top half
        for (let x = 0; x < width; x++) {
          const time = startTime + (x / width) * visibleDuration;
          const dataIndex = Math.floor((time / duration) * waveformData.length);
          const amplitude = dataIndex >= 0 && dataIndex < waveformData.length ? waveformData[dataIndex] : 0;
          const y = centerY - amplitude * (height * 0.4);
          ctx.lineTo(x, y);
        }

        // Bottom half (mirror)
        for (let x = width - 1; x >= 0; x--) {
          const time = startTime + (x / width) * visibleDuration;
          const dataIndex = Math.floor((time / duration) * waveformData.length);
          const amplitude = dataIndex >= 0 && dataIndex < waveformData.length ? waveformData[dataIndex] : 0;
          const y = centerY + amplitude * (height * 0.4);
          ctx.lineTo(x, y);
        }
      } else {
        // Fall back to mock waveform data
        const waveformPoints: number[] = [];
        for (let i = 0; i < width; i++) {
          const t = i / width;
          // Create realistic-looking audio waveform with varying amplitude
          const envelope = 0.3 +
            Math.sin(t * Math.PI * 2) * 0.15 +
            Math.sin(t * Math.PI * 8) * 0.1 +
            Math.cos(t * Math.PI * 4 + 1) * 0.12;
          const noise = (Math.random() - 0.5) * 0.15;
          const sample = (Math.sin(t * 150) * 0.3 + Math.sin(t * 80) * 0.2 + noise) * envelope;
          waveformPoints.push(sample);
        }

        // Top half
        for (let i = 0; i < waveformPoints.length; i++) {
          const y = centerY - Math.abs(waveformPoints[i]) * height * 0.4;
          ctx.lineTo(i, y);
        }

        // Bottom half (mirror)
        for (let i = waveformPoints.length - 1; i >= 0; i--) {
          const y = centerY + Math.abs(waveformPoints[i]) * height * 0.4;
          ctx.lineTo(i, y);
        }
      }

      ctx.closePath();
      ctx.fill();

      // Draw center line
      ctx.strokeStyle = 'rgba(25, 171, 181, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }

    // ========================================================================
    // Draw Playhead
    // ========================================================================

    if (isLoaded && duration > 0) {
      // Calculate playhead position based on visible time range
      const playheadTime = timestamp / 1000;
      const playheadX = ((playheadTime - startTime) / visibleDuration) * width;

      // Only draw if playhead is in visible range
      if (playheadX >= 0 && playheadX <= width) {
        // Glow effect
        ctx.shadowColor = '#19abb5';
        ctx.shadowBlur = 8;

        // Playhead line
        ctx.strokeStyle = '#19abb5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;

        // Triangle at top
        ctx.fillStyle = '#19abb5';
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, 0);
        ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX, 8);
        ctx.closePath();
        ctx.fill();

        // Draw playhead handle (draggable grab point) just above time scale
        const handleY = height - 28; // Just above time scale
        const handleWidth = 12;
        const handleHeight = 16;

        // Handle background
        ctx.fillStyle = '#19abb5';
        ctx.beginPath();
        ctx.roundRect(
          playheadX - handleWidth / 2,
          handleY,
          handleWidth,
          handleHeight,
          3 // border radius
        );
        ctx.fill();

        // Handle grip lines (subtle detail)
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i += 2) {
          ctx.beginPath();
          ctx.moveTo(playheadX + i, handleY + 4);
          ctx.lineTo(playheadX + i, handleY + handleHeight - 4);
          ctx.stroke();
        }
      }
    }

    // ========================================================================
    // Draw Time Scale
    // ========================================================================

    if (isLoaded && duration > 0) {
      const timeScaleHeight = 20;

      // Semi-transparent background for time scale
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, height - timeScaleHeight, width, timeScaleHeight);

      // Adjust interval based on visible duration (zoom level)
      let interval: number; // in seconds
      if (visibleDuration <= 10) {
        interval = 1;
      } else if (visibleDuration <= 30) {
        interval = 5;
      } else if (visibleDuration <= 60) {
        interval = 10;
      } else if (visibleDuration <= 300) {
        interval = 30;
      } else if (visibleDuration <= 600) {
        interval = 60;
      } else if (visibleDuration <= 1800) {
        interval = 120;
      } else {
        interval = 300;
      }

      // Draw time markers
      ctx.fillStyle = '#888';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';

      // Calculate first and last marker in visible range
      const firstMarker = Math.ceil(startTime / interval) * interval;
      const lastMarker = Math.floor(endTime / interval) * interval;

      for (let time = firstMarker; time <= lastMarker; time += interval) {
        const x = ((time - startTime) / visibleDuration) * width;

        // Skip if too close to edges
        if (x < 30 || x > width - 50) continue;

        // Tick mark
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, height - timeScaleHeight);
        ctx.lineTo(x, height - timeScaleHeight + 5);
        ctx.stroke();

        // Time label
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const label = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        ctx.fillText(label, x, height - 5);
      }

      // Draw end time marker (visible end of range)
      const visibleEndX = width - 2;
      const visibleEndTime = endTime;
      const endMinutes = Math.floor(visibleEndTime / 60);
      const endSeconds = Math.floor(visibleEndTime % 60);
      const endLabel = `${endMinutes}:${endSeconds.toString().padStart(2, '0')}`;
      ctx.textAlign = 'right';
      ctx.fillText(endLabel, visibleEndX, height - 5);
    }

    // ========================================================================
    // Draw Frequency Scale
    // ========================================================================

    if (isLoaded) {
      const freqScaleWidth = 40;

      // Semi-transparent background for frequency scale
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(width - freqScaleWidth, 0, freqScaleWidth, height - 20); // Stop above time scale

      // Frequency markers (logarithmic scale typical for audio)
      const frequencies = [20, 50, 100, 200, 500, '1k', '2k', '5k', '10k', '20k'];
      const freqValues = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];

      ctx.fillStyle = '#888';
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';

      const usableHeight = height - 20; // Account for time scale

      frequencies.forEach((label, i) => {
        // Logarithmic positioning (low frequencies at bottom, high at top)
        const freqRatio = Math.log10(freqValues[i] / 20) / Math.log10(20000 / 20);
        const y = usableHeight - (freqRatio * usableHeight);

        // Only draw if in visible range
        if (y > 10 && y < usableHeight - 5) {
          // Tick mark
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(width - freqScaleWidth, y);
          ctx.lineTo(width - freqScaleWidth + 5, y);
          ctx.stroke();

          // Frequency label
          ctx.fillText(String(label), width - 5, y + 3);
        }
      });

      // "Hz" label at top
      ctx.fillStyle = '#666';
      ctx.font = '8px Inter, system-ui, sans-serif';
      ctx.fillText('Hz', width - 5, 12);
    }

    // ========================================================================
    // Draw dB Scale
    // ========================================================================

    // Draw dB scale along left edge
    if (isLoaded) {
      const dbScaleWidth = 30;

      // Semi-transparent background for dB scale
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, dbScaleWidth, height - 20); // Stop above time scale

      // dB markers (0dB at top, -60dB at bottom)
      const dbMarkers = [0, -6, -12, -18, -24, -36, -48, -60];

      ctx.fillStyle = '#888';
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';

      const usableHeight = height - 20; // Account for time scale

      dbMarkers.forEach((db) => {
        // Linear positioning (0dB at top, -60dB at bottom)
        const ratio = Math.abs(db) / 60;
        const y = ratio * usableHeight;

        // Only draw if in visible range
        if (y > 10 && y < usableHeight - 5) {
          // Tick mark
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(dbScaleWidth - 5, y);
          ctx.lineTo(dbScaleWidth, y);
          ctx.stroke();

          // dB label
          ctx.fillText(`${db}`, 3, y + 3);
        }
      });

      // "dB" label at top
      ctx.fillStyle = '#666';
      ctx.font = '8px Inter, system-ui, sans-serif';
      ctx.fillText('dB', 3, 12);
    }

    // ========================================================================
    // Draw Zoom Marquee Selection
    // ========================================================================

    if (zoomToolActive && marqueeStart && marqueeEnd) {
      const x1 = Math.min(marqueeStart.x, marqueeEnd.x);
      const x2 = Math.max(marqueeStart.x, marqueeEnd.x);
      const marqueeWidth = x2 - x1;

      // Semi-transparent fill
      ctx.fillStyle = 'rgba(25, 171, 181, 0.2)';
      ctx.fillRect(x1, 0, marqueeWidth, height - 20);

      // Border
      ctx.strokeStyle = '#19abb5';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x1, 0, marqueeWidth, height - 20);
      ctx.setLineDash([]);
    }
  }, [isLoaded, duration, timestamp, zoom, scrollOffset, showSpectral, showWaveform, zoomToolActive, marqueeStart, marqueeEnd, waveformData, spectralData, spectralLoading]);

  // Redraw on mount and when dependencies change
  useEffect(() => {
    draw();
  }, [draw, timestamp]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Auto-scroll to follow playhead during playback
  useEffect(() => {
    if (!isPlaying || !isLoaded || zoom <= 1) return;

    const currentTimeSeconds = timestamp / 1000;
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const endTime = startTime + visibleDuration;

    // Check if playhead is outside visible range
    if (currentTimeSeconds < startTime || currentTimeSeconds > endTime) {
      // Center the view on the playhead
      const newScrollOffset = Math.max(0, Math.min(1 - 1/zoom,
        (currentTimeSeconds - visibleDuration / 2) / duration));
      setScrollOffset(newScrollOffset);
    }
    // If playhead is approaching the right edge (within 10% of visible area), scroll ahead
    else if (currentTimeSeconds > startTime + visibleDuration * 0.9) {
      const newScrollOffset = Math.max(0, Math.min(1 - 1/zoom,
        (currentTimeSeconds - visibleDuration * 0.1) / duration));
      setScrollOffset(newScrollOffset);
    }
  }, [timestamp, isPlaying, isLoaded, zoom, duration, scrollOffset]);

  // Keyboard listeners for spacebar (pan mode) and Escape (cancel zoom tool)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault(); // Prevent page scroll
        setIsSpaceHeld(true);
      }
      // Escape key cancels zoom tool
      if (e.code === 'Escape') {
        setZoomToolActive(false);
        setMarqueeStart(null);
        setMarqueeEnd(null);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Check if mouse is near the playhead handle for easier grabbing
  const isNearPlayhead = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || duration <= 0) return false;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const playheadX = ((timestamp / 1000 - startTime) / visibleDuration) * rect.width;

    return Math.abs(mouseX - playheadX) < 15; // Within 15px of playhead
  }, [duration, zoom, scrollOffset, timestamp]);

  // Seek to position helper
  const seekToPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickRatio = x / rect.width;

    // Calculate time based on visible range
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const clickTime = startTime + clickRatio * visibleDuration;
    const newTimeMs = clickTime * 1000;

    setTimestamp(newTimeMs);
  };

  // Mouse handlers for panning and scrubbing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLoaded || !canvasRef.current || duration <= 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Zoom tool - start marquee
    if (zoomToolActive && e.button === 0) {
      const visibleDuration = duration / zoom;
      const startTime = scrollOffset * duration;
      const clickTime = startTime + (mouseX / rect.width) * visibleDuration;

      setMarqueeStart({ x: mouseX, time: clickTime });
      setMarqueeEnd({ x: mouseX, time: clickTime });
      return;
    }

    // Middle mouse button OR spacebar held = start panning
    if (e.button === 1 || isSpaceHeld) {
      e.preventDefault();
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartOffset(scrollOffset);
      return;
    }

    // Left click on playhead = start scrubbing (don't seek, just enable drag)
    if (e.button === 0 && isNearPlayhead(e)) {
      setIsDragging(true);
      return;
    }

    // Left click elsewhere = seek to that position (single click only, no drag)
    seekToPosition(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLoaded || !canvasRef.current || duration <= 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Zoom tool - update marquee
    if (zoomToolActive && marqueeStart) {
      const visibleDuration = duration / zoom;
      const startTime = scrollOffset * duration;
      const currentTime = startTime + (mouseX / rect.width) * visibleDuration;

      setMarqueeEnd({ x: mouseX, time: currentTime });
      return;
    }

    // Update hover state for cursor feedback
    const nearPlayhead = isNearPlayhead(e);
    if (nearPlayhead !== isHoveringPlayhead) {
      setIsHoveringPlayhead(nearPlayhead);
    }

    // Panning (only when zoomed in)
    if (isPanning && zoom > 1) {
      const deltaX = e.clientX - panStartX;
      const deltaRatio = deltaX / rect.width;
      const visibleFraction = 1 / zoom;

      // Moving mouse right = scrolling left (earlier in timeline)
      const newOffset = Math.max(0, Math.min(1 - visibleFraction,
        panStartOffset - deltaRatio * visibleFraction));
      setScrollOffset(newOffset);
      return;
    }

    // Scrubbing
    if (isDragging) {
      seekToPosition(e);
    }
  };

  const handleMouseUp = () => {
    // Zoom tool - complete marquee and zoom
    if (zoomToolActive && marqueeStart && marqueeEnd) {
      const timeStart = Math.min(marqueeStart.time, marqueeEnd.time);
      const timeEnd = Math.max(marqueeStart.time, marqueeEnd.time);
      const selectedDuration = timeEnd - timeStart;

      // Only zoom if selection is meaningful (> 1 second)
      if (selectedDuration > 1) {
        const newZoom = Math.min(10, duration / selectedDuration);
        const newScrollOffset = Math.max(0, Math.min(1 - 1/newZoom, timeStart / duration));

        setZoom(newZoom);
        setScrollOffset(newScrollOffset);
      }

      setMarqueeStart(null);
      setMarqueeEnd(null);
      setZoomToolActive(false); // Deactivate after use
      return;
    }

    setIsDragging(false);
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsPanning(false);
    setIsHoveringPlayhead(false);
    // Cancel marquee if mouse leaves canvas
    if (marqueeStart) {
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }
  };

  // Handle wheel to zoom (centered on playhead position)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isLoaded || duration <= 0) return;

    e.preventDefault();

    // Calculate zoom change
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Scroll down = zoom out, up = zoom in
    const newZoom = Math.max(1, Math.min(10, zoom * zoomFactor)); // Clamp between 1x and 10x

    if (newZoom !== zoom) {
      // Center on PLAYHEAD, not mouse
      const playheadTime = timestamp / 1000;
      const newVisibleDuration = duration / newZoom;
      const newScrollOffset = Math.max(0, Math.min(1 - 1/newZoom,
        (playheadTime - newVisibleDuration / 2) / duration));

      setZoom(newZoom);
      setScrollOffset(newScrollOffset);
    }
  }, [isLoaded, zoom, duration, timestamp]);

  return (
    <CanvasContainer ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()} // Prevent context menu during pan
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: isLoaded
            ? (zoomToolActive ? 'crosshair' : isPanning ? 'grabbing' : isSpaceHeld ? 'grab' : isDragging ? 'ew-resize' : isHoveringPlayhead ? 'ew-resize' : 'default')
            : 'default',
        }}
      />
      {/* Layer Toggle Buttons */}
      {isLoaded && (
        <Box sx={{
          position: 'absolute',
          top: 8,
          left: 40, // After dB scale
          display: 'flex',
          gap: 0.5,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 1,
          padding: '4px',
        }}>
          {/* Spectral toggle */}
          <Tooltip title={
            spectralLoading
              ? "Loading spectral analysis..."
              : showSpectral
                ? "Hide Spectral"
                : "Show Spectral"
          }>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <IconButton
                size="small"
                onClick={() => !spectralLoading && setShowSpectral(!showSpectral)}
                disabled={spectralLoading}
                sx={{
                  color: spectralLoading ? '#555' : showSpectral ? '#19abb5' : '#555',
                  padding: '4px',
                  '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
                  // Pulse animation when ready
                  animation: spectralReady ? 'spectralPulse 1s ease-in-out 5' : 'none',
                  '@keyframes spectralPulse': {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(25, 171, 181, 0)' },
                    '50%': { boxShadow: '0 0 0 8px rgba(25, 171, 181, 0.3)' },
                  },
                }}
              >
                {spectralLoading ? (
                  <CircularProgress size={16} sx={{ color: '#19abb5' }} />
                ) : (
                  <GridOnIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Box>
          </Tooltip>

          {/* Waveform toggle */}
          <Tooltip title={showWaveform ? "Hide Waveform" : "Show Waveform"}>
            <IconButton
              size="small"
              onClick={() => setShowWaveform(!showWaveform)}
              sx={{
                color: showWaveform ? '#19abb5' : '#555',
                padding: '4px',
                '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
              }}
            >
              <GraphicEqIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
      {/* Zoom Controls */}
      {isLoaded && (
        <Box sx={{
          position: 'absolute',
          top: 8,
          right: 50, // Leave room for Hz scale
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          borderRadius: 1,
          padding: '4px 8px',
        }}>
          {/* Zoom out button */}
          <IconButton
            size="small"
            onClick={() => {
              const newZoom = Math.max(1, zoom / 1.5);
              const playheadTime = timestamp / 1000;
              const newVisibleDuration = duration / newZoom;
              let newScrollOffset = (playheadTime - newVisibleDuration / 2) / duration;
              newScrollOffset = Math.max(0, Math.min(1 - 1/newZoom, newScrollOffset));
              setZoom(newZoom);
              setScrollOffset(newScrollOffset);
            }}
            sx={{ color: '#888', padding: '2px', '&:hover': { color: '#19abb5' } }}
          >
            <RemoveIcon sx={{ fontSize: 16 }} />
          </IconButton>

          {/* Zoom slider */}
          <Slider
            value={zoom}
            min={1}
            max={10}
            onChange={(_, value) => {
              const newZoom = value as number;
              const playheadTime = timestamp / 1000;
              const newVisibleDuration = duration / newZoom;
              let newScrollOffset = (playheadTime - newVisibleDuration / 2) / duration;
              newScrollOffset = Math.max(0, Math.min(1 - 1/newZoom, newScrollOffset));
              setZoom(newZoom);
              setScrollOffset(newScrollOffset);
            }}
            sx={{
              width: 80,
              color: '#19abb5',
              '& .MuiSlider-thumb': { width: 12, height: 12 },
              '& .MuiSlider-track': { height: 3 },
              '& .MuiSlider-rail': { height: 3, backgroundColor: '#333' },
            }}
          />

          {/* Zoom in button */}
          <IconButton
            size="small"
            onClick={() => {
              const newZoom = Math.min(10, zoom * 1.5);
              const playheadTime = timestamp / 1000;
              const newVisibleDuration = duration / newZoom;
              let newScrollOffset = (playheadTime - newVisibleDuration / 2) / duration;
              newScrollOffset = Math.max(0, Math.min(1 - 1/newZoom, newScrollOffset));
              setZoom(newZoom);
              setScrollOffset(newScrollOffset);
            }}
            sx={{ color: '#888', padding: '2px', '&:hover': { color: '#19abb5' } }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>

          {/* Zoom Tool Button */}
          <Tooltip title={zoomToolActive ? "Cancel Zoom Tool" : "Zoom Tool - Draw to zoom"}>
            <IconButton
              size="small"
              onClick={() => {
                setZoomToolActive(!zoomToolActive);
                setMarqueeStart(null);
                setMarqueeEnd(null);
              }}
              sx={{
                color: zoomToolActive ? '#19abb5' : '#888',
                padding: '4px',
                marginLeft: '4px',
                backgroundColor: zoomToolActive ? 'rgba(25, 171, 181, 0.2)' : 'transparent',
                '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
              }}
            >
              <ZoomInIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          {/* Zoom level display */}
          <Typography sx={{ color: '#888', fontSize: 10, minWidth: 35, textAlign: 'right' }}>
            {zoom.toFixed(1)}x
          </Typography>
        </Box>
      )}
    </CanvasContainer>
  );
};

export default UnifiedAudioCanvas;
