/**
 * UnifiedAudioCanvas Component
 * Displays spectral visualization with teal waveform overlay
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
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
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);
  const isPlaying = usePlayheadStore((state) => state.isPlaying);

  // Zoom state: 1 = full duration visible, higher = zoomed in
  const [zoom, setZoom] = useState(1);
  // Scroll offset: 0-1, portion of timeline scrolled
  const [scrollOffset, setScrollOffset] = useState(0);

  // Panning state
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);

  // Scrubbing state (for click+drag to seek)
  const [isDragging, setIsDragging] = useState(false);

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
    // Draw Spectral Visualization (gradient bars with noise)
    // ========================================================================

    const numBars = Math.floor(width / 3);
    for (let i = 0; i < numBars; i++) {
      const x = (i / numBars) * width;
      const barWidth = width / numBars;

      // Create varying intensity based on position
      const t = i / numBars;
      const intensity = 0.3 +
        Math.sin(t * Math.PI * 4) * 0.2 +
        Math.sin(t * Math.PI * 12) * 0.1 +
        Math.cos(t * Math.PI * 7 + 0.5) * 0.15;

      // Add some randomness for organic feel
      const noise = (Math.random() - 0.5) * 0.1;
      const finalIntensity = Math.max(0.1, Math.min(1, intensity + noise));

      // Create spectral gradient (purple at top to green at bottom)
      const gradient = ctx.createLinearGradient(x, 0, x, height);
      gradient.addColorStop(0, `rgba(80, 40, 120, ${finalIntensity * 0.7})`);     // Purple
      gradient.addColorStop(0.3, `rgba(60, 80, 140, ${finalIntensity * 0.8})`);   // Blue-purple
      gradient.addColorStop(0.5, `rgba(40, 100, 80, ${finalIntensity * 0.9})`);   // Teal-green
      gradient.addColorStop(0.7, `rgba(60, 120, 60, ${finalIntensity * 0.7})`);   // Green
      gradient.addColorStop(1, `rgba(40, 60, 40, ${finalIntensity * 0.4})`);      // Dark green

      ctx.fillStyle = gradient;
      ctx.fillRect(x, 0, barWidth + 1, height);
    }

    // Add noise texture overlay for more organic spectrogram look
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const alpha = Math.random() * 0.15;
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // ========================================================================
    // Draw Waveform Overlay
    // ========================================================================

    if (isLoaded) {
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
  }, [isLoaded, duration, timestamp, zoom, scrollOffset]);

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

  // Keyboard listeners for spacebar (pan mode)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault(); // Prevent page scroll
        setIsSpaceHeld(true);
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

    // Middle mouse button OR spacebar held = start panning
    if (e.button === 1 || isSpaceHeld) {
      e.preventDefault();
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartOffset(scrollOffset);
      return;
    }

    // Left click = start scrubbing
    if (e.button === 0) {
      setIsDragging(true);
      seekToPosition(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLoaded || !canvasRef.current || duration <= 0) return;

    // Panning (only when zoomed in)
    if (isPanning && zoom > 1) {
      const rect = canvasRef.current.getBoundingClientRect();
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
    setIsDragging(false);
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setIsPanning(false);
  };

  // Handle wheel to zoom (centered on cursor position)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isLoaded || !canvasRef.current) return;

    e.preventDefault();

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseRatio = mouseX / rect.width; // 0-1 position of mouse on canvas

    // Calculate zoom change
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Scroll down = zoom out, up = zoom in
    const newZoom = Math.max(1, Math.min(10, zoom * zoomFactor)); // Clamp between 1x and 10x

    if (newZoom !== zoom) {
      // Adjust scroll offset to keep mouse position stable
      const visibleDuration = duration / zoom;
      const mouseTime = scrollOffset * duration + mouseRatio * visibleDuration;

      const newVisibleDuration = duration / newZoom;
      const newScrollOffset = Math.max(
        0,
        Math.min(1 - 1 / newZoom, (mouseTime - mouseRatio * newVisibleDuration) / duration)
      );

      setZoom(newZoom);
      setScrollOffset(newScrollOffset);
    }
  };

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
            ? (isPanning ? 'grabbing' : isSpaceHeld ? 'grab' : isDragging ? 'grabbing' : 'pointer')
            : 'default',
        }}
      />
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
            onClick={() => setZoom(Math.max(1, zoom / 1.5))}
            sx={{ color: '#888', padding: '2px', '&:hover': { color: '#19abb5' } }}
          >
            <RemoveIcon sx={{ fontSize: 16 }} />
          </IconButton>

          {/* Zoom slider */}
          <Slider
            value={zoom}
            min={1}
            max={10}
            onChange={(_, value) => setZoom(value as number)}
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
            onClick={() => setZoom(Math.min(10, zoom * 1.5))}
            sx={{ color: '#888', padding: '2px', '&:hover': { color: '#19abb5' } }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>

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
