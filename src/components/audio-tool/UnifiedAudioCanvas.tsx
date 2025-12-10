/**
 * UnifiedAudioCanvas Component
 * Displays spectral visualization with teal waveform overlay
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
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
    // Draw Spectral Visualization (iZotope RX style - vertical frequency bands)
    // ========================================================================

    if (showSpectral && isLoaded) {
      const numColumns = Math.floor(width / 2); // One column every 2 pixels
      const numFreqBins = 128; // Frequency resolution

      for (let col = 0; col < numColumns; col++) {
        const x = (col / numColumns) * width;
        const colWidth = width / numColumns + 1; // +1 to avoid gaps

        // Time position for this column (accounting for zoom/scroll)
        const colTime = startTime + (col / numColumns) * visibleDuration;
        const timeRatio = colTime / duration;

        // Generate frequency data for this time slice (mock data)
        for (let freqBin = 0; freqBin < numFreqBins; freqBin++) {
          const freqRatio = freqBin / numFreqBins; // 0 = low freq, 1 = high freq
          const y = height - 20 - (freqRatio * (height - 20)); // Bottom to top, above time scale
          const binHeight = (height - 20) / numFreqBins + 1;

          // Generate intensity based on mock audio patterns
          // Combine multiple sine waves for realistic-looking content
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

          // Add some noise for texture
          intensity += (Math.random() - 0.5) * 0.1;
          intensity = Math.max(0, Math.min(1, intensity));

          // Color based on intensity (purple -> teal -> yellow for peaks)
          let r, g, b;
          if (intensity < 0.3) {
            // Low: dark purple
            r = Math.floor(30 + intensity * 100);
            g = Math.floor(10 + intensity * 50);
            b = Math.floor(60 + intensity * 80);
          } else if (intensity < 0.6) {
            // Mid: teal/cyan
            const tt = (intensity - 0.3) / 0.3;
            r = Math.floor(60 - tt * 40);
            g = Math.floor(40 + tt * 120);
            b = Math.floor(100 + tt * 50);
          } else {
            // High: yellow/green peaks
            const tt = (intensity - 0.6) / 0.4;
            r = Math.floor(20 + tt * 180);
            g = Math.floor(160 + tt * 60);
            b = Math.floor(150 - tt * 100);
          }

          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
          ctx.fillRect(x, y - binHeight, colWidth, binHeight);
        }
      }
    }

    // ========================================================================
    // Draw Waveform Overlay
    // ========================================================================

    if (showWaveform && isLoaded) {
      const centerY = height / 2;

      // Generate mock waveform data
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

      // Draw filled waveform (mirrored top and bottom)
      ctx.fillStyle = 'rgba(25, 171, 181, 0.6)'; // Teal with transparency
      ctx.beginPath();
      ctx.moveTo(0, centerY);

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
  }, [isLoaded, duration, timestamp, zoom, scrollOffset, showSpectral, showWaveform, zoomToolActive, marqueeStart, marqueeEnd]);

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
            ? (zoomToolActive ? 'zoom-in' : isPanning ? 'grabbing' : isSpaceHeld ? 'grab' : isDragging ? 'ew-resize' : isHoveringPlayhead ? 'ew-resize' : 'default')
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
          <Tooltip title={showSpectral ? "Hide Spectral" : "Show Spectral"}>
            <IconButton
              size="small"
              onClick={() => setShowSpectral(!showSpectral)}
              sx={{
                color: showSpectral ? '#19abb5' : '#555',
                padding: '4px',
                '&:hover': { backgroundColor: 'rgba(25, 171, 181, 0.1)' },
              }}
            >
              <GridOnIcon sx={{ fontSize: 18 }} />
            </IconButton>
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
          <Tooltip title="Zoom Tool (draw to zoom)">
            <IconButton
              size="small"
              onClick={() => setZoomToolActive(!zoomToolActive)}
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
