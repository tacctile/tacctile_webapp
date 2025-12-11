/**
 * SpectralCanvas Component
 * Renders spectral visualization (aurora borealis style)
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { usePlayheadStore } from '@/stores/usePlayheadStore';

interface SpectralCanvasProps {
  isLoaded: boolean;
  duration: number;
  zoom?: number;
  scrollOffset?: number;
  spectralData?: Float32Array[] | null;
  spectralLoading?: boolean;
  spectralReady?: boolean;
  onSeek?: (timeInSeconds: number) => void;
  onZoomChange?: (zoom: number) => void;
  onScrollChange?: (scrollOffset: number) => void;
}

export const SpectralCanvas: React.FC<SpectralCanvasProps> = ({
  isLoaded,
  duration,
  zoom = 1,
  scrollOffset = 0,
  spectralData,
  spectralLoading = false,
  spectralReady = false,
  onSeek,
  onZoomChange,
  onScrollChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timestamp = usePlayheadStore((state) => state.timestamp);
  const setTimestamp = usePlayheadStore((state) => state.setTimestamp);

  // Scrubbing state (drag playhead)
  const [isDragging, setIsDragging] = useState(false);
  const [isNearPlayhead, setIsNearPlayhead] = useState(false);

  // Spacebar + drag panning state
  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartOffset, setPanStartOffset] = useState(0);

  // Aurora borealis color function
  const getAuroraColor = useCallback((intensity: number): { r: number; g: number; b: number; a: number } => {
    const i = Math.max(0, Math.min(1, intensity));

    let r, g, b, a;

    if (i < 0.15) {
      const t = i / 0.15;
      r = Math.floor(15 + t * 30);
      g = Math.floor(8 + t * 19);
      b = Math.floor(35 + t * 43);
      a = 0.4 + t * 0.3;
    } else if (i < 0.3) {
      const t = (i - 0.15) / 0.15;
      r = Math.floor(45 + t * 25);
      g = Math.floor(27 + t * 40);
      b = Math.floor(78 + t * 30);
      a = 0.7 + t * 0.1;
    } else if (i < 0.45) {
      const t = (i - 0.3) / 0.15;
      r = Math.floor(70 - t * 45);
      g = Math.floor(67 + t * 71);
      b = Math.floor(108 + t * 46);
      a = 0.8 + t * 0.1;
    } else if (i < 0.6) {
      const t = (i - 0.45) / 0.15;
      r = Math.floor(25 + t * 10);
      g = Math.floor(138 + t * 30);
      b = Math.floor(154 - t * 10);
      a = 0.9;
    } else if (i < 0.75) {
      const t = (i - 0.6) / 0.15;
      r = Math.floor(35 + t * 11);
      g = Math.floor(168 + t * 36);
      b = Math.floor(144 - t * 72);
      a = 0.92;
    } else if (i < 0.9) {
      const t = (i - 0.75) / 0.15;
      r = Math.floor(46 + t * 30);
      g = Math.floor(204 + t * 18);
      b = Math.floor(72 + t * 30);
      a = 0.95;
    } else {
      const t = (i - 0.9) / 0.1;
      r = Math.floor(76 + t * 160);
      g = Math.floor(222 - t * 80);
      b = Math.floor(102 + t * 80);
      a = 1.0;
    }

    return { r, g, b, a };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
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

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    if (!isLoaded || spectralLoading) return;

    // Calculate visible time range
    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;

    // Draw spectral visualization
    if (spectralData && spectralData.length > 0) {
      const numBins = spectralData[0].length;
      const dataPointsVisible = Math.floor((visibleDuration / duration) * spectralData.length);
      const columnWidth = Math.max(1, width / dataPointsVisible);

      for (let x = 0; x < width; x += columnWidth) {
        const time = startTime + (x / width) * visibleDuration;

        // Don't draw beyond actual duration
        if (time > duration) break;

        const frameIndex = Math.min(
          spectralData.length - 1,
          Math.floor((time / duration) * spectralData.length)
        );

        if (frameIndex >= 0) {
          const frame = spectralData[frameIndex];
          const gradient = ctx.createLinearGradient(x, height, x, 0);
          const gradientStops = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 1.0];

          gradientStops.forEach(stop => {
            const binIndex = Math.floor(stop * (numBins - 1));
            const magnitude = frame[binIndex];
            const intensity = Math.min(1, Math.log10(1 + magnitude * 50) / 2);
            const color = getAuroraColor(intensity);
            gradient.addColorStop(stop, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
          });

          ctx.fillStyle = gradient;
          ctx.fillRect(x, 0, columnWidth + 1, height);
        }
      }
    } else {
      // Mock spectral visualization
      const mockColumnWidth = 3;

      for (let x = 0; x < width; x += mockColumnWidth) {
        const colTime = startTime + (x / width) * visibleDuration;

        // Don't draw beyond actual duration
        if (colTime > duration) break;

        const timeRatio = colTime / duration;

        const gradient = ctx.createLinearGradient(x, height, x, 0);
        const gradientStops = [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 1.0];

        gradientStops.forEach(stop => {
          const freqRatio = stop;
          const t = timeRatio * Math.PI * 20;
          const f = freqRatio * Math.PI * 4;
          const freqFalloff = 1 - freqRatio * 0.7;
          const timeVariation =
            Math.sin(t) * 0.3 +
            Math.sin(t * 2.5 + 1) * 0.2 +
            Math.sin(t * 0.5 + freqRatio * 10) * 0.25;
          const freqPattern =
            Math.sin(f + t * 0.5) * 0.3 +
            Math.cos(f * 2 + t) * 0.2;
          let intensity = (0.3 + timeVariation + freqPattern) * freqFalloff;
          intensity = Math.max(0, Math.min(1, intensity));

          const color = getAuroraColor(intensity);
          gradient.addColorStop(stop, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(x, 0, mockColumnWidth + 1, height);
      }
    }

    // Draw playhead
    if (duration > 0) {
      const playheadTime = timestamp / 1000;
      const playheadX = ((playheadTime - startTime) / visibleDuration) * width;

      if (playheadX >= 0 && playheadX <= width) {
        ctx.shadowColor = '#19abb5';
        ctx.shadowBlur = 8;

        ctx.strokeStyle = '#19abb5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();

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
  }, [isLoaded, duration, zoom, scrollOffset, timestamp, spectralData, spectralLoading, getAuroraColor]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  // Helper to check if mouse is near playhead
  const checkNearPlayhead = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || duration <= 0) return false;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const playheadX = ((timestamp / 1000 - startTime) / visibleDuration) * rect.width;

    return Math.abs(mouseX - playheadX) < 10;
  }, [duration, zoom, scrollOffset, timestamp]);

  // Seek to position helper
  const seekToPosition = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || duration <= 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const clickRatio = Math.max(0, Math.min(1, mouseX / rect.width));

    const visibleDuration = duration / zoom;
    const startTime = scrollOffset * duration;
    const clickTime = startTime + (clickRatio * visibleDuration);

    setTimestamp(clickTime * 1000);
    onSeek?.(clickTime);
  }, [duration, zoom, scrollOffset, setTimestamp, onSeek]);

  // Mouse handlers for scrubbing and panning
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isLoaded || duration <= 0) return;

    // Spacebar held = start panning
    if (isSpaceHeld && zoom > 1) {
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartOffset(scrollOffset);
      return;
    }

    // Near playhead = start scrubbing
    if (checkNearPlayhead(e)) {
      setIsDragging(true);
      return;
    }

    // Otherwise click to seek
    seekToPosition(e);
  }, [isLoaded, duration, isSpaceHeld, zoom, scrollOffset, checkNearPlayhead, seekToPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Panning
    if (isPanning && canvasRef.current && onScrollChange) {
      const rect = canvasRef.current.getBoundingClientRect();
      const deltaX = e.clientX - panStartX;
      const deltaRatio = deltaX / rect.width;
      const visibleFraction = 1 / zoom;

      const newOffset = Math.max(0, Math.min(1 - visibleFraction,
        panStartOffset - deltaRatio * visibleFraction));
      onScrollChange(newOffset);
      return;
    }

    // Update cursor based on proximity to playhead
    if (!isSpaceHeld) {
      setIsNearPlayhead(checkNearPlayhead(e));
    }

    // Scrubbing
    if (isDragging) {
      seekToPosition(e);
    }
  }, [isPanning, panStartX, panStartOffset, zoom, onScrollChange, isSpaceHeld, checkNearPlayhead, isDragging, seekToPosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setIsPanning(false);
    setIsNearPlayhead(false);
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isLoaded || duration <= 0 || !onZoomChange || !onScrollChange) return;
    e.preventDefault();

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(1, Math.min(10, zoom * zoomFactor));

    // Center zoom on playhead
    const playheadTime = timestamp / 1000;
    const newVisibleDuration = duration / newZoom;
    const newScrollOffset = Math.max(0, Math.min(1 - 1 / newZoom,
      (playheadTime - newVisibleDuration / 2) / duration));

    onZoomChange(newZoom);
    onScrollChange(newScrollOffset);
  }, [isLoaded, duration, zoom, timestamp, onZoomChange, onScrollChange]);

  // Spacebar keyboard listener for panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
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

  // Determine cursor based on state
  const getCursor = () => {
    if (isPanning) return 'grabbing';
    if (isSpaceHeld) return 'grab';
    if (isNearPlayhead || isDragging) return 'ew-resize';
    if (isLoaded) return 'crosshair';
    return 'default';
  };

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: getCursor(),
        }}
      />
      {/* Loading overlay */}
      {spectralLoading && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(10, 10, 10, 0.8)',
        }}>
          <CircularProgress size={32} sx={{ color: '#19abb5' }} />
          <Typography sx={{ color: '#666', mt: 1, fontSize: 11 }}>
            Generating spectral...
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default SpectralCanvas;
